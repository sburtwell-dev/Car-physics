import { Game } from './Game.js'
import * as THREE from 'three/webgpu'

export class AIDriver
{
    constructor(physicsVehicle)
    {
        this.game = Game.getInstance()
        this.physicsVehicle = physicsVehicle

        this.accelerating = 0
        this.steering = 0
        this.boosting = 0
        this.braking = 0
        this.suspensions = ['low', 'low', 'low', 'low']

        this.track = this.game.proceduralTrack
        this.checkpoints = this.track.checkpoints
        this.currentCheckpoint = 1  // Start targeting checkpoint 1 (spawned at 0)
        this.checkpointRadius = this.track.trackHalfWidth + 2

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 1)
    }

    update()
    {
        const pos = this.physicsVehicle.position
        const forward = this.physicsVehicle.forward
        const speed = this.physicsVehicle.xzSpeed || 0

        // Current target checkpoint
        const target = this.checkpoints[this.currentCheckpoint]

        // Check if we reached the current checkpoint
        const dxCheck = pos.x - target.position.x
        const dzCheck = pos.z - target.position.z
        const distToCheckpoint = Math.sqrt(dxCheck * dxCheck + dzCheck * dzCheck)

        if(distToCheckpoint < this.checkpointRadius)
        {
            // Advance to next checkpoint (wrap around)
            this.currentCheckpoint = (this.currentCheckpoint + 1) % this.checkpoints.length
        }

        // Steer toward target checkpoint
        const toTargetX = target.position.x - pos.x
        const toTargetZ = target.position.z - pos.z
        const toTargetLen = Math.sqrt(toTargetX * toTargetX + toTargetZ * toTargetZ)

        if(toTargetLen < 0.01)
        {
            this.steering = 0
            this.accelerating = 0.3
            return
        }

        const dirX = toTargetX / toTargetLen
        const dirZ = toTargetZ / toTargetLen

        // Cross product for signed turn direction
        const cross = forward.x * dirZ - forward.z * dirX

        // Dot product for alignment
        const dot = forward.x * dirX + forward.z * dirZ

        // Steering: proportional to cross, clamped
        this.steering = Math.max(-1, Math.min(1, cross * 3))

        // Look ahead to next checkpoint to anticipate sharp turns
        const nextCheckpointIdx = (this.currentCheckpoint + 1) % this.checkpoints.length
        const nextTarget = this.checkpoints[nextCheckpointIdx]
        const toNextX = nextTarget.position.x - target.position.x
        const toNextZ = nextTarget.position.z - target.position.z
        const toNextLen = Math.sqrt(toNextX * toNextX + toNextZ * toNextZ)

        let turnSharpness = 0
        if(toNextLen > 0.01)
        {
            const nextDirX = toNextX / toNextLen
            const nextDirZ = toNextZ / toNextLen
            turnSharpness = 1 - (dirX * nextDirX + dirZ * nextDirZ)
        }

        // Throttle and braking
        if(dot < 0)
        {
            // Facing wrong way — brake hard and turn
            this.accelerating = 0.1
            this.braking = 0.5
            this.boosting = 0
        }
        else if(dot < 0.3)
        {
            // Almost perpendicular — light throttle, no brake
            this.accelerating = 0.3
            this.braking = 0
            this.boosting = 0
        }
        else if(turnSharpness > 0.4 && speed > 2 && distToCheckpoint < 20)
        {
            // Sharp turn coming up — slow down
            this.accelerating = 0.3
            this.braking = 0.15
            this.boosting = 0
        }
        else
        {
            // Straight or gentle curve
            this.accelerating = 0.8
            this.braking = 0
            this.boosting = dot > 0.9 && turnSharpness < 0.15 && speed > 3 ? 1 : 0
        }
    }
}
        }
        else
        {
            // Straight or gentle curve — full throttle
            this.accelerating = 0.7
            this.braking = 0
            this.boosting = speed > this.targetSpeed * 0.8 && turnSharpness < 0.1 ? 1 : 0
        }
    }
}
