import * as THREE from 'three/webgpu'

export class ProceduralTrack
{
    constructor(options = {})
    {
        this.seed = options.seed ?? 42
        this.terrainSize = options.terrainSize ?? 192
        this.textureResolution = options.textureResolution ?? 512
        this.heightfieldResolution = options.heightfieldResolution ?? 129 // 128 subdivisions + 1
        this.trackHalfWidth = options.trackHalfWidth ?? 5
        this.curbWidth = options.curbWidth ?? 1.0
        this.wallHeight = options.wallHeight ?? 1.5
        this.wallWidth = options.wallWidth ?? 0.8
        this.numControlPoints = options.numControlPoints ?? 10
        this.baseRadius = options.baseRadius ?? 55
        this.radiusVariation = options.radiusVariation ?? 18
        this.numCheckpoints = options.numCheckpoints ?? 8

        this.rng = this.createRng(this.seed)
        
        this.generateTrack()
        this.generateTrackSamples()
        this.generateHeightfield()
        this.generateTexture()
        this.generateCheckpoints()
        this.generateRespawns()
    }

    // Simple seeded RNG (mulberry32)
    createRng(seed)
    {
        let s = seed | 0
        return () =>
        {
            s = (s + 0x6D2B79F5) | 0
            let t = Math.imul(s ^ (s >>> 15), 1 | s)
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        }
    }

    generateTrack()
    {
        // Generate control points around a deformed ellipse
        const controlPoints = []

        for(let i = 0; i < this.numControlPoints; i++)
        {
            const angle = (i / this.numControlPoints) * Math.PI * 2
            const radiusOffset = (this.rng() - 0.5) * 2 * this.radiusVariation
            const radius = this.baseRadius + radiusOffset

            // Add slight angular perturbation
            const angleOffset = (this.rng() - 0.5) * 0.3

            const x = Math.cos(angle + angleOffset) * radius
            const z = Math.sin(angle + angleOffset) * radius

            controlPoints.push(new THREE.Vector3(x, 0, z))
        }

        // Create closed Catmull-Rom spline
        this.curve = new THREE.CatmullRomCurve3(controlPoints, true, 'catmullrom', 0.5)
        this.trackLength = this.curve.getLength()
    }

    generateTrackSamples()
    {
        // Dense sampling of track for SDF computation
        const numSamples = 2000
        this.trackPoints = []
        this.trackTangents = []

        for(let i = 0; i < numSamples; i++)
        {
            const t = i / numSamples
            const point = this.curve.getPointAt(t)
            const tangent = this.curve.getTangentAt(t)
            this.trackPoints.push(point)
            this.trackTangents.push(tangent)
        }
    }

    // Get signed distance and nearest info for a world position
    getTrackInfo(x, z)
    {
        let minDist = Infinity
        let nearestIndex = 0

        for(let i = 0; i < this.trackPoints.length; i++)
        {
            const p = this.trackPoints[i]
            const dx = x - p.x
            const dz = z - p.z
            const dist = dx * dx + dz * dz

            if(dist < minDist)
            {
                minDist = dist
                nearestIndex = i
            }
        }

        const dist = Math.sqrt(minDist)
        return { distance: dist, nearestIndex }
    }

    generateHeightfield()
    {
        const res = this.heightfieldResolution
        this.heights = new Float32Array(res * res)
        const halfSize = this.terrainSize / 2

        for(let iz = 0; iz < res; iz++)
        {
            for(let ix = 0; ix < res; ix++)
            {
                const worldX = (ix / (res - 1) - 0.5) * this.terrainSize
                const worldZ = (iz / (res - 1) - 0.5) * this.terrainSize

                const info = this.getTrackInfo(worldX, worldZ)
                const dist = info.distance

                let height = 0

                if(dist < this.trackHalfWidth)
                {
                    // Track surface - flat
                    height = 0
                }
                else if(dist < this.trackHalfWidth + this.curbWidth)
                {
                    // Curb - slightly raised with bumps
                    const curbT = (dist - this.trackHalfWidth) / this.curbWidth
                    height = 0.08 * Math.sin(curbT * Math.PI)
                }
                else if(dist < this.trackHalfWidth + this.curbWidth + this.wallWidth)
                {
                    // Wall/barrier
                    const wallT = (dist - this.trackHalfWidth - this.curbWidth) / this.wallWidth
                    height = this.wallHeight * (1 - wallT * wallT)
                }
                else
                {
                    // Grass - gentle undulation
                    const grassSeed1 = Math.sin(worldX * 0.05) * Math.cos(worldZ * 0.07) * 0.3
                    const grassSeed2 = Math.sin(worldX * 0.13 + 1.7) * Math.cos(worldZ * 0.11 + 0.5) * 0.15
                    height = -0.1 + grassSeed1 + grassSeed2
                }

                // RAPIER heightfield: row-major with rows along X, columns along Z
                const index = iz * res + ix
                this.heights[index] = height
            }
        }
    }

    generateTexture()
    {
        const res = this.textureResolution
        const data = new Uint8Array(res * res * 4)
        const halfSize = this.terrainSize / 2

        for(let iy = 0; iy < res; iy++)
        {
            for(let ix = 0; ix < res; ix++)
            {
                const worldX = (ix / res - 0.5) * this.terrainSize
                const worldZ = (iy / res - 0.5) * this.terrainSize

                const info = this.getTrackInfo(worldX, worldZ)
                const dist = info.distance

                let r = 0 // Track/slab
                let g = 0 // Grass
                let b = 0 // Height/displacement (higher = lower terrain visually)

                if(dist < this.trackHalfWidth)
                {
                    // Track surface
                    r = 255 // Full slab
                    g = 0   // No grass
                    b = 0   // No displacement (flat)
                }
                else if(dist < this.trackHalfWidth + this.curbWidth)
                {
                    // Curb
                    const curbT = (dist - this.trackHalfWidth) / this.curbWidth
                    const stripeFreq = 12
                    const tangent = this.trackTangents[info.nearestIndex]
                    const trackAngle = Math.atan2(tangent.z, tangent.x)
                    const projected = worldX * Math.cos(trackAngle) + worldZ * Math.sin(trackAngle)
                    const stripe = Math.sin(projected * stripeFreq) > 0 ? 1 : 0

                    r = Math.round(stripe * 200 + 55) // Red/white curb pattern
                    g = 0
                    b = 0 // Flat curb visually
                }
                else if(dist < this.trackHalfWidth + this.curbWidth + this.wallWidth)
                {
                    // Wall
                    r = 80
                    g = 0
                    b = 0 // Wall displacement handled by physics only
                }
                else
                {
                    // Grass
                    const edgeFade = Math.min(1, (dist - this.trackHalfWidth - this.curbWidth - this.wallWidth) / 3)
                    r = 0
                    g = Math.round(edgeFade * 255) // Full grass
                    const grassVariation = Math.sin(worldX * 0.05) * Math.cos(worldZ * 0.07) * 10
                    b = Math.round(Math.max(0, Math.min(255, 10 + grassVariation))) // Slight undulation
                }

                const pixelIndex = (iy * res + ix) * 4
                data[pixelIndex + 0] = r
                data[pixelIndex + 1] = g
                data[pixelIndex + 2] = b
                data[pixelIndex + 3] = 255
            }
        }

        this.texture = new THREE.DataTexture(data, res, res, THREE.RGBAFormat)
        this.texture.flipY = false
        this.texture.wrapS = THREE.ClampToEdgeWrapping
        this.texture.wrapT = THREE.ClampToEdgeWrapping
        this.texture.minFilter = THREE.LinearFilter
        this.texture.magFilter = THREE.LinearFilter
        this.texture.needsUpdate = true
    }

    generateCheckpoints()
    {
        this.checkpoints = []

        for(let i = 0; i < this.numCheckpoints; i++)
        {
            const t = i / this.numCheckpoints
            const point = this.curve.getPointAt(t)
            const tangent = this.curve.getTangentAt(t)

            // Normal perpendicular to tangent in XZ plane
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
            const angle = Math.atan2(tangent.z, tangent.x)

            this.checkpoints.push({
                position: point.clone(),
                normal: normal,
                tangent: tangent.clone(),
                angle: angle,
                width: this.trackHalfWidth * 2,
                t: t
            })
        }
    }

    generateRespawns()
    {
        this.respawnItems = new Map()

        // Generate respawns at checkpoint locations + midpoints
        const numRespawns = this.numCheckpoints * 2

        for(let i = 0; i < numRespawns; i++)
        {
            const t = i / numRespawns
            const point = this.curve.getPointAt(t)
            const tangent = this.curve.getTangentAt(t)
            const angle = Math.atan2(-tangent.x, -tangent.z) // Rotation to face along track

            const name = i === 0 ? 'start' : `respawn${i}`
            this.respawnItems.set(name, {
                name: name,
                position: new THREE.Vector3(point.x, 4, point.z),
                rotation: angle
            })
        }

        // Also add a 'landing' respawn at the start for compatibility
        const startPoint = this.curve.getPointAt(0)
        const startTangent = this.curve.getTangentAt(0)
        const startAngle = Math.atan2(-startTangent.x, -startTangent.z)
        
        this.respawnItems.set('landing', {
            name: 'landing',
            position: new THREE.Vector3(startPoint.x, 4, startPoint.z),
            rotation: startAngle
        })
    }

    // Get the start position and direction for placing the car
    getStartPosition()
    {
        const point = this.curve.getPointAt(0)
        const tangent = this.curve.getTangentAt(0)
        const angle = Math.atan2(-tangent.x, -tangent.z)

        return {
            position: new THREE.Vector3(point.x, 4, point.z),
            rotation: angle
        }
    }
}
