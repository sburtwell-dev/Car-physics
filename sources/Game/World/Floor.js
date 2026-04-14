import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { color, float, Fn, materialNormal, min, mix, mul, normalWorld, positionLocal, positionWorld, texture, uniform, uv, vec3, vec4 } from 'three/tsl'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

export class Floor
{
    constructor()
    {
        this.game = Game.getInstance()

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '⏥ Floor',
                expanded: false,
            })
        }
        this.subdivision = this.game.terrain.subdivision

        this.setVisual()
        this.setPhysical()
        this.setBedRock()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 10)
    }

    setVisual()
    {
        this.size = Math.round(this.game.view.optimalArea.radius * 2) + 1
        this.halfSize = this.size * 0.5
        this.cellSize = 1.5
        this.subdivisions = this.size / this.cellSize

        // Geometry
        let geometry = new THREE.PlaneGeometry(this.size, this.size, this.subdivisions, this.subdivisions)
        geometry.rotateX(-Math.PI * 0.5)
        geometry.deleteAttribute('normal')

        // Terrain data
        const terrainData = this.game.terrain.terrainNode(positionWorld.xz)
        const colorNode = Fn(() =>
        {
            const baseColor = this.game.terrain.colorNode(terrainData)
            return baseColor
        })()

        // Material
        const material = new MeshDefaultMaterial({
            colorNode: colorNode,
            normalNode: vec3(0, 1, 0),
            shadowNode: float(0),
            hasWater: false,
            hasLightBounce: false,
            wireframe: false
        })
        // Displacement
        material.positionNode = Fn(() =>
        {
            const uvDim = min(min(uv().x, uv().y).mul(20), 1)

            const newPosition = positionLocal
            newPosition.y.addAssign(terrainData.b.mul(-1.5).mul(uvDim))

            return newPosition
        })()

        // Mesh
        this.mesh = new THREE.Mesh(geometry, material)
        this.mesh.receiveShadow = true
        this.game.scene.add(this.mesh)

        // Resize
        this.game.viewport.events.on('throttleChange', () =>
        {
            this.size = Math.round(this.game.view.optimalArea.radius * 2) + 1
            this.halfSize = this.size * 0.5
            this.subdivisions = this.size
            
            geometry.dispose()
            
            geometry = new THREE.PlaneGeometry(this.size, this.size, this.subdivisions, this.subdivisions)
            geometry.rotateX(-Math.PI * 0.5)
            geometry.deleteAttribute('normal')

            this.mesh.geometry = geometry
        }, 2)
    }

    setPhysical()
    {
        // Use procedural heightfield from track generator
        const track = this.game.proceduralTrack
        const res = track.heightfieldResolution
        const heights = track.heights
        
        const object = this.game.objects.add(
            null,
            {
                type: 'fixed',
                friction: 0.2,
                restitution: 0.15,
                colliders: [
                    { shape: 'heightfield', parameters: [ res - 1, res - 1, heights, { x: this.game.terrain.size, y: 1, z: this.game.terrain.size } ], category: 'floor' }
                ]
            }
        )
        this.physical = object.physical
    }

    setBedRock()
    {
        this.bedRock = {}
        this.bedRock.halfHeight = 0.5
        this.bedRock.halfWidth = 6
        this.bedRock.enabled = false


        this.bedRock.physical = this.game.physics.getPhysical({
            type: 'kinematicPositionBased',
            position: new THREE.Vector3(0, this.game.water.depthElevation - this.bedRock.halfHeight, 0),
            frictionRule: 'min',
            friction: 0.5,
            enabled: true,
            colliders:
            [
                { shape: 'cuboid', parameters: [ this.bedRock.halfWidth, this.bedRock.halfHeight, this.bedRock.halfWidth ] },
            ]
        })
    }

    update()
    {
        this.mesh.position.x = Math.round(this.game.view.optimalArea.position.x / this.cellSize) * this.cellSize
        this.mesh.position.z = Math.round(this.game.view.optimalArea.position.z / this.cellSize) * this.cellSize

        // Bedrock
        if(
            Math.abs(this.game.player.position.x) > this.game.terrain.size / 2 - this.bedRock.halfWidth ||
            Math.abs(this.game.player.position.z) > this.game.terrain.size / 2 - this.bedRock.halfWidth
        )
        {
            if(!this.bedRock.enabled)
            {
                this.bedRock.enabled = true
                this.bedRock.physical.body.setEnabled(true)
            }
            const x = Math.round(this.game.player.position.x)
            const z = Math.round(this.game.player.position.z)
            this.bedRock.physical.body.setNextKinematicTranslation({
                x,
                y: this.game.water.depthElevation - this.bedRock.halfHeight,
                z
            })
            this.bedRock.physical.body.setLinvel({ x: 0, y: 0, z: 0 })
        }
        else
        {
            if(this.bedRock.enabled)
            {
                this.bedRock.enabled = false
                this.bedRock.physical.body.setEnabled(false)
            }
        }
    }
}