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
        this.trackT = 0           // Current parameter on spline [0..1]
        this.lookahead = 15        // How far ahead on track to aim (meters)
        this.targetSpeed = 4       // Desired cruising speed
        this.brakeDistance = 8     // Start braking if sharp turn within this distance

        // Find initial closest point on track
        this.trackT = this.findClosestT(this.physicsVehicle.position)

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 1)
    }

    findClosestT(position)
    {
        const samples = 200
        let bestT = 0
        let bestDist = Infinity

        for(let i = 0; i < samples; i++)
        {
            const t = i / samples
            const point = this.track.curve.getPointAt(t)
            const dx = position.x - point.x
            const dz = position.z - point.z
            const dist = dx * dx + dz * dz

            if(dist < bestDist)
            {
                bestDist = dist
                bestT = t
            }
        }

        return bestT
    }

    update()
    {
        const pos = this.physicsVehicle.position
        const forward = this.physicsVehicle.forward
        const speed = this.physicsVehicle.xzSpeed || 0

        // Advance trackT to stay near the car's actual position
        this.trackT = this.findClosestT(pos)

        // Get a target point ahead on the spline
        const lookaheadT = this.lookahead / this.track.trackLength
        let targetT = (this.trackT + lookaheadT) % 1
        const target = this.track.curve.getPointAt(targetT)

        // Direction to target in world XZ
        const toTargetX = target.x - pos.x
        const toTargetZ = target.z - pos.z
        const toTargetLen = Math.sqrt(toTargetX * toTargetX + toTargetZ * toTargetZ)

        if(toTargetLen < 0.01)
        {
            this.steering = 0
            this.accelerating = 0.3
            return
        }

        // Normalize
        const dirX = toTargetX / toTargetLen
        const dirZ = toTargetZ / toTargetLen

        // Cross product (forward × toTarget) gives signed turn direction
        // forward is (forward.x, 0, forward.z) in world space
        const cross = forward.x * dirZ - forward.z * dirX

        // Dot product for how aligned we are
        const dot = forward.x * dirX + forward.z * dirZ

        // Steering: proportional to cross product, clamped
        this.steering = Math.max(-1, Math.min(1, cross * 3))

        // Check for upcoming sharp turn (lookahead further)
        const farLookaheadT = (this.trackT + lookaheadT * 2.5) % 1
        const tangentNow = this.track.curve.getTangentAt(this.trackT)
        const tangentFar = this.track.curve.getTangentAt(farLookaheadT)
        const turnSharpness = 1 - (tangentNow.x * tangentFar.x + tangentNow.z * tangentFar.z)

        // Throttle and braking
        if(dot < 0.2)
        {
            // Facing wrong way — brake and turn
            this.accelerating = 0.2
            this.braking = 0.3
            this.boosting = 0
        }
        else if(turnSharpness > 0.3 && speed > 2)
        {
            // Sharp turn ahead — slow down
            this.accelerating = 0.2
            this.braking = 0.2
            this.boosting = 0
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
