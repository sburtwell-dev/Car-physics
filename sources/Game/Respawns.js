import * as THREE from 'three/webgpu'
import { Game } from './Game.js'

export class Respawns
{
    constructor(defaultName = 'landing')
    {
        this.game = Game.getInstance()
        this.defaultName = defaultName

        this.setItems()
    }

    setItems()
    {
        // Use procedural track respawn points
        this.items = this.game.proceduralTrack.respawnItems
    }

    getByName(name)
    {
        return this.items.get(name)
    }

    getDefault()
    {
        return this.items.get(this.defaultName)
    }

    getClosest(position)
    {
        let closestItem = null
        let closestDistance = Infinity

        this.items.forEach((item) =>
        {
            const distance = Math.hypot(item.position.x - position.x, item.position.z - position.z)

            if(distance < closestDistance)
            {
                closestDistance = distance
                closestItem = item
            }
        })

        return closestItem
    }
}