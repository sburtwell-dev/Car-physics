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
        try
        {
            console.log('[VehicleManager] Spawning AI vehicle at', position.x, position.y, position.z)

            // Create physics first with a placeholder driver
            const placeholderDriver = { accelerating: 0, steering: 0, boosting: 0, braking: 0, suspensions: ['low', 'low', 'low', 'low'] }

            const physicsVehicle = new PhysicsVehicle({
                driver: placeholderDriver,
                position: position,
                isLocal: false
            })

            // Now create the real AI driver with access to physics vehicle
            const driver = new AIDriver(physicsVehicle)
            physicsVehicle.driver = driver

            console.log('[VehicleManager] PhysicsVehicle created, chassis body:', physicsVehicle.chassis.physical.body.translation())

            const model = this.game.vehicleModelTemplate.clone(true)
            console.log('[VehicleManager] Cloned model children:', model.children.length)

            const visualVehicle = new VisualVehicle(model, {
                physicsVehicle: physicsVehicle,
                driver: driver,
                isLocal: false
            })

            console.log('[VehicleManager] VisualVehicle created, chassis part:', !!visualVehicle.parts.chassis)

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
        catch(error)
        {
            console.error('[VehicleManager] Failed to spawn AI vehicle:', error)
        }
    }
}
