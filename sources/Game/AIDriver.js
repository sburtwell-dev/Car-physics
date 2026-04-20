import { Game } from './Game.js'

export class AIDriver
{
    constructor()
    {
        this.game = Game.getInstance()

        this.accelerating = 0
        this.steering = 0
        this.boosting = 0
        this.braking = 0
        this.suspensions = ['low', 'low', 'low', 'low']

        this.time = 0
        this.steerPhase = Math.random() * Math.PI * 2
        this.steerFrequency = 0.3 + Math.random() * 0.4
        this.steerAmplitude = 0.4 + Math.random() * 0.4

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 1)
    }

    update()
    {
        this.time += this.game.ticker.deltaScaled

        // Drive forward with gentle steering variation
        this.accelerating = 0.5
        this.steering = Math.sin(this.time * this.steerFrequency + this.steerPhase) * this.steerAmplitude
        this.boosting = 0
        this.braking = 0
    }
}
