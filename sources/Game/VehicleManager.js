import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { PhysicsVehicle } from './Physics/PhysicsVehicle.js'
import { VisualVehicle } from './World/VisualVehicle.js'
import { AIDriver } from './AIDriver.js'

export class VehicleManager
{
    constructor()
    {
        this.game = Game.getInstance()
        this.vehicles = []
    }

    spawnAIVehicle(position)
    {
        const driver = new AIDriver()

        const physicsVehicle = new PhysicsVehicle({
            driver: driver,
            position: position,
            isLocal: false
        })

        const model = this.game.resources.vehicle.scene.clone(true)
        const visualVehicle = new VisualVehicle(model, {
            physicsVehicle: physicsVehicle,
            driver: driver,
            isLocal: false
        })

        // Set a different paint for AI vehicles
        visualVehicle.paints.changeTo('orange')

        const vehicle = {
            driver,
            physicsVehicle,
            visualVehicle
        }

        this.vehicles.push(vehicle)

        return vehicle
    }
}
