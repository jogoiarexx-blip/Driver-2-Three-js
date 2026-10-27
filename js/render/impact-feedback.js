/**
 * Feedback cinematográfico de colisões sem bibliotecas nem efeitos caros.
 * Não altera a simulação do carro e respeita a preferência por movimento reduzido.
 */
class DriverImpactFeedback {
    constructor() { this.reset(); }
    reset() { this.strength = 0; this.phase = 0; }
    trigger(speed) {
        const intensity = Math.max(0, Math.min(1, (Number(speed)||0)/48));
        this.strength = Math.max(this.strength, intensity);
    }
    update(dt, camera, element, reducedMotion = false) {
        const step = Math.max(0,Math.min(0.05,Number(dt)||0));
        this.strength = Math.max(0, this.strength - 2.7*step);
        this.phase += step * 54;
        const strength = this.strength;
        if (camera && camera.position && !reducedMotion && strength>0) {
            const shake = Math.min(0.28, strength * 0.23);
            camera.position.x += Math.sin(this.phase*1.2)*shake;
            camera.position.y += Math.cos(this.phase*1.7)*shake*0.4;
            camera.position.z += Math.cos(this.phase*0.7)*shake*0.45;
        }
        const opacity = reducedMotion ? 0 : Math.min(0.30,strength*0.24);
        if (element && element.style) element.style.opacity = opacity.toFixed(3);
        return opacity;
    }
}
