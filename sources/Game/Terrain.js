import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import MeshGridMaterial, { MeshGridMaterialLine } from './Materials/MeshGridMaterial.js'
import { color, Fn, mix, round, smoothstep, texture, uniform, uv, vec2 } from 'three/tsl'

export class Terrain
{
    constructor()
    {
        this.game = Game.getInstance()

        this.subdivision = 128
        this.size = 192

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🏔️ Terrain Data',
                expanded: false,
            })
        }

        this.setNodes()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 10)
    }

    setNodes()
    {
        this.grassColorUniform = uniform(color('#4a8c2a'))
        this.trackColorUniform = uniform(color('#3a3a3a'))
        this.curbColorUniform = uniform(color('#cc2222'))
        this.wallColorUniform = uniform(color('#888888'))
        this.tracksDelta = uniform(vec2(0))

        const worldPositionToUvNode = Fn(([position]) =>
        {
            return position.div(this.subdivision).div(1.5).add(0.5)
        })

        this.terrainNode = Fn(([position]) =>
        {
            const textureUv = worldPositionToUvNode(position)
            const data = texture(this.game.proceduralTrack.texture, textureUv)

            // Wheel tracks
            const groundDataColor = texture(
                this.game.tracks.renderTarget.texture,
                position.sub(- this.game.tracks.halfSize).sub(this.tracksDelta).div(this.game.tracks.size)
            )
            data.g.mulAssign(groundDataColor.r.oneMinus())

            return data
        })
        
        this.colorNode = Fn(([terrainData]) =>
        {
            // Track surface (R channel high = on track)
            const trackStrength = terrainData.r

            // Grass (G channel)
            const grassStrength = terrainData.g

            // Start with track color, blend wall color for low R values
            const baseColor = mix(this.wallColorUniform, this.trackColorUniform, smoothstep(0.3, 0.8, trackStrength))

            // Mix grass
            const finalColor = mix(baseColor, this.grassColorUniform, grassStrength)

            return finalColor.rgb
        })

        if(this.game.debug.active)
        {
            this.game.debug.addThreeColorBinding(this.debugPanel, this.grassColorUniform.value, 'grassColor')
            this.game.debug.addThreeColorBinding(this.debugPanel, this.trackColorUniform.value, 'trackColor')
        }
    }
    
    update()
    {
        // Tracks delta
        this.tracksDelta.value.set(
            this.game.tracks.focusPoint.x,
            this.game.tracks.focusPoint.y
        )
    }
}