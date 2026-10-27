/**
 * Iluminação e pequenos movimentos de suspensão de todos os veículos.
 * Geometria preservada ao trocar PS1 <-> GLB. Sem luzes WebGL por carro:
 * usa materiais emissivos simples para não sobrecarregar celulares.
 */
class VehicleVisuals {
    static lightState(vehicle, input) {
        const braking = !!(input.down && vehicle.speed > -1) ||
            !!(input.handbrake && Math.abs(vehicle.speed) > 2);
        return { headlamps: !!vehicle.headlightsOn, braking };
    }

    static update(vehicle, dt, input) {
        const time = vehicle.motionClock = (vehicle.motionClock || 0) + Math.max(0,dt);
        const state = this.lightState(vehicle,input);
        vehicle.brakeLightsOn = state.braking;
        if (vehicle.headlightMaterial) {
            vehicle.headlightMaterial.color.setHex(state.headlamps ? 0xfff6bf : 0x605735);
        }
        if (vehicle.tailMaterial) {
            vehicle.tailMaterial.color.setHex(state.braking ? 0xff2434 : 0x6b171d);
        }
        if (vehicle.headlightBeams) vehicle.headlightBeams.visible = state.headlamps;
        const speed = Math.abs(vehicle.speed);
        const roadPulse = Math.sin(time * (6 + speed * 0.65));
        const amplitude = Math.min(0.060, speed * 0.00095);
        const vertical = roadPulse * amplitude;
        // As rodas primitivas ficam no root; a carroceria se move sobre elas.
        const targetHeight = vehicle._suspensionBaseY + vertical;
        const response = 1 - Math.exp(-9 * Math.min(0.05,Math.max(0,dt)));
        vehicle.chassisTilt.position.y +=
            (targetHeight - vehicle.chassisTilt.position.y) * response;
        if (vehicle.wheels && vehicle.wheels.length === 4) {
            vehicle.wheels.forEach((wheel, i) => {
                const phase = i % 2 ? Math.PI * 0.8 : 0;
                const axlePhase = i < 2 ? 0 : 1.45;
                wheel.position.y = 0.44 + amplitude * 0.45 *
                    Math.sin(time * (7 + speed * 0.5) + phase + axlePhase);
            });
        }
    }

    static setHeadlights(vehicle, on) {
        if (!vehicle) return;
        vehicle.headlightsOn = !!on;
        if (vehicle.headlightBeams) vehicle.headlightBeams.visible = !!on;
        if (vehicle.headlightMaterial) {
            vehicle.headlightMaterial.color.setHex(on ? 0xfff6bf : 0x605735);
        }
    }
}
