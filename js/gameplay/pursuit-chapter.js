/**
 * Missão cinematográfica de três atos:
 * 1) resistir ao cerco, 2) atravessar checkpoints ordenados,
 * 3) chegar ao esconderijo a pé após despistar as viaturas.
 * Sem dependências de DOM/Three.js.
 */
class DriverPursuitChapter {
    constructor() { this.reset(); }

    reset() {
        this.phase = 0;
        this.elapsed = 0;
        this.introSeconds = 3.5;
        this.surviveSeconds = 24;
        this.requiredMarkers = 3;
    }

    update(dt, state) {
        const tick = Math.max(0, Math.min(dt, 0.05));
        const previous = this.phase;
        this.introSeconds = Math.max(0, this.introSeconds - tick);
        if (this.phase === 0) {
            this.elapsed += tick;
            if (this.elapsed >= this.surviveSeconds) this.phase = 1;
        } else if (this.phase === 1) {
            if (state.markersCollected >= this.requiredMarkers) this.phase = 2;
        }
        const distance = this.phase === 2 && state.position && state.safeHouseZone ?
            Math.hypot(state.position.x - state.safeHouseZone.x,
                state.position.z - state.safeHouseZone.z) : Infinity;
        const hidden = state.felony < 35 && !state.policeNear;
        const complete = this.phase === 2 && hidden && state.mode === 'on_foot' &&
            distance <= state.safeHouseZone.radius;
        return {
            phase: this.phase,
            changed: this.phase !== previous,
            complete,
            distance,
            introSeconds: this.introSeconds,
            remaining: Math.max(0, this.surviveSeconds - this.elapsed),
            status: this.phase === 0 ?
                'CERCO POLICIAL: RESISTA ' + Math.ceil(Math.max(0, this.surviveSeconds - this.elapsed)) + 's' :
                this.phase === 1 ?
                'FUJA PELA ROTA: ' + Math.min(this.requiredMarkers,state.markersCollected) +
                    '/' + this.requiredMarkers + ' PORTÕES' :
                'DESPISTE A POLÍCIA: ' + Math.round(state.felony) +
                    '% DE DELITO | ABRIGO ' + Math.round(distance) + 'm'
        };
    }
}
