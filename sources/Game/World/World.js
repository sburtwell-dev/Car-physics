import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Floor } from './Floor.js'
import { color, float, Fn, instance, normalWorld, positionLocal, texture, vec3, vec4 } from 'three/tsl'
import { VisualVehicle } from './VisualVehicle.js'

export class World
{
    constructor()
    {
        this.game = Game.getInstance()
    }

    step(step)
    {
        if(step === 1)
        {
            this.visualVehicle = new VisualVehicle(this.game.resources.vehicle.scene)
            this.floor = new Floor()
        }
    }

    setPhysicalFloor()
    {
        this.game.objects.add(
            null,
            {
                type: 'fixed',
                friction: 0.25,
                restitution: 0,
                colliders: [
                    { shape: 'cuboid', parameters: [ 1000, 1, 1000 ], position: { x: 0, y: - 1.01, z: 0 }, category: 'floor' },
                ]
            }
        )
    }
}
