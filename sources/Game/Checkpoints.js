import * as THREE from 'three/webgpu'
import { Game } from './Game.js'

export class Checkpoints
{
    constructor(proceduralTrack)
    {
        this.game = Game.getInstance()
        this.track = proceduralTrack

        this.currentCheckpoint = 0
        this.lap = 0
        this.bestLapTime = Infinity
        this.lapStartTime = 0
        this.lastLapTime = 0
        this.checkpointRadius = this.track.trackHalfWidth + 1
        this.totalCheckpoints = this.track.checkpoints.length

        this.setGateMeshes()
        this.setHUD()
        
        this.lapStartTime = performance.now()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 8)
    }

    setGateMeshes()
    {
        this.gates = []
        const gateHeight = 4
        const poleRadius = 0.15
        const barRadius = 0.1

        for(let i = 0; i < this.track.checkpoints.length; i++)
        {
            const cp = this.track.checkpoints[i]
            const group = new THREE.Group()

            // Gate color: first checkpoint (start/finish) is special
            const isStart = i === 0
            const gateColor = isStart ? 0xffcc00 : 0x00aaff
            const poleMaterial = new THREE.MeshBasicMaterial({ color: gateColor, transparent: true, opacity: 0.7 })
            const barMaterial = new THREE.MeshBasicMaterial({ color: gateColor, transparent: true, opacity: 0.5 })

            // Left pole
            const poleGeometry = new THREE.CylinderGeometry(poleRadius, poleRadius, gateHeight, 8)
            const leftPole = new THREE.Mesh(poleGeometry, poleMaterial)
            leftPole.position.set(
                cp.position.x + cp.normal.x * this.track.trackHalfWidth,
                gateHeight / 2,
                cp.position.z + cp.normal.z * this.track.trackHalfWidth
            )
            group.add(leftPole)

            // Right pole
            const rightPole = new THREE.Mesh(poleGeometry, poleMaterial)
            rightPole.position.set(
                cp.position.x - cp.normal.x * this.track.trackHalfWidth,
                gateHeight / 2,
                cp.position.z - cp.normal.z * this.track.trackHalfWidth
            )
            group.add(rightPole)

            // Top bar
            const barLength = this.track.trackHalfWidth * 2
            const barGeometry = new THREE.CylinderGeometry(barRadius, barRadius, barLength, 8)
            const bar = new THREE.Mesh(barGeometry, barMaterial)
            bar.position.set(cp.position.x, gateHeight, cp.position.z)
            bar.rotation.z = Math.PI / 2
            bar.rotation.y = -cp.angle
            group.add(bar)

            // Checkpoint number label indicator (simple ring on ground)
            const ringGeometry = new THREE.RingGeometry(0.5, 0.8, 16)
            const ringMaterial = new THREE.MeshBasicMaterial({ color: gateColor, side: THREE.DoubleSide, transparent: true, opacity: 0.4 })
            const ring = new THREE.Mesh(ringGeometry, ringMaterial)
            ring.position.set(cp.position.x, 0.05, cp.position.z)
            ring.rotation.x = -Math.PI / 2
            group.add(ring)

            this.game.scene.add(group)
            this.gates.push({ group, poleMaterial, barMaterial, ringMaterial, isStart })
        }
    }

    setHUD()
    {
        this.hudElement = document.createElement('div')
        this.hudElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            color: white;
            font-family: monospace;
            font-size: 16px;
            background: rgba(0, 0, 0, 0.6);
            padding: 12px 18px;
            border-radius: 8px;
            z-index: 100;
            pointer-events: none;
            line-height: 1.6;
            min-width: 200px;
        `
        document.body.appendChild(this.hudElement)
    }

    formatTime(ms)
    {
        const totalSeconds = ms / 1000
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = Math.floor(totalSeconds % 60)
        const millis = Math.floor(ms % 1000)
        return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
    }

    update()
    {
        const playerPos = this.game.player.position

        // Check if player crosses current checkpoint
        const targetCheckpoint = this.currentCheckpoint
        const cp = this.track.checkpoints[targetCheckpoint]

        const dx = playerPos.x - cp.position.x
        const dz = playerPos.z - cp.position.z
        const dist = Math.sqrt(dx * dx + dz * dz)

        if(dist < this.checkpointRadius)
        {
            this.currentCheckpoint++

            if(this.currentCheckpoint >= this.totalCheckpoints)
            {
                // Lap complete
                this.currentCheckpoint = 0
                const now = performance.now()
                this.lastLapTime = now - this.lapStartTime

                if(this.lastLapTime < this.bestLapTime)
                    this.bestLapTime = this.lastLapTime

                this.lap++
                this.lapStartTime = now

                // Flash start/finish gate
                this.flashGate(0, 0xffcc00)
            }
            else
            {
                // Flash checkpoint gate
                this.flashGate(targetCheckpoint, 0x00ff88)
            }
        }

        // Update gate visuals - highlight next checkpoint
        for(let i = 0; i < this.gates.length; i++)
        {
            const gate = this.gates[i]
            const isNext = i === this.currentCheckpoint
            const alpha = isNext ? 0.9 : 0.3
            
            gate.poleMaterial.opacity = isNext ? 0.9 : 0.5
            gate.barMaterial.opacity = isNext ? 0.7 : 0.3
            gate.ringMaterial.opacity = isNext ? 0.6 : 0.2

            if(isNext)
            {
                const pulse = Math.sin(performance.now() * 0.005) * 0.2 + 0.8
                gate.poleMaterial.opacity = pulse
                gate.barMaterial.opacity = pulse * 0.8
            }
        }

        // Update HUD
        const currentTime = performance.now() - this.lapStartTime
        const bestStr = this.bestLapTime < Infinity ? this.formatTime(this.bestLapTime) : '--:--.---'
        const lastStr = this.lastLapTime > 0 ? this.formatTime(this.lastLapTime) : '--:--.---'

        this.hudElement.innerHTML = `
            <div style="font-size: 12px; color: #aaa; text-transform: uppercase; margin-bottom: 4px;">Race</div>
            <div>Lap: <strong>${this.lap + 1}</strong></div>
            <div>CP: <strong>${this.currentCheckpoint}/${this.totalCheckpoints}</strong></div>
            <div style="margin-top: 6px;">Time: <strong>${this.formatTime(currentTime)}</strong></div>
            <div>Last: <strong>${lastStr}</strong></div>
            <div>Best: <strong style="color: ${this.bestLapTime < Infinity ? '#00ff88' : '#aaa'}">${bestStr}</strong></div>
        `
    }

    flashGate(index, color)
    {
        const gate = this.gates[index]
        const originalColor = gate.isStart ? 0xffcc00 : 0x00aaff
        
        gate.poleMaterial.color.setHex(color)
        gate.barMaterial.color.setHex(color)
        gate.poleMaterial.opacity = 1
        gate.barMaterial.opacity = 1
        
        setTimeout(() =>
        {
            gate.poleMaterial.color.setHex(originalColor)
            gate.barMaterial.color.setHex(originalColor)
        }, 500)
    }
}
