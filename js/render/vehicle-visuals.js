/**
 * Iluminação e pequenos movimentos de suspensão de todos os veículos.
 * Geometria preservada ao trocar PS1 <-> GLB. Sem luzes WebGL por carro:
 * usa materiais emissivos simples para não sobrecarregar celulares.
 */
class VehicleVisuals {
    static lightState(vehicle, input={}) {
        const speed=Number(vehicle?.speed)||0;
        const braking=!!(input.down && speed > -1) ||
            !!(input.handbrake && Math.abs(speed)>2) ||
            (Number(vehicle?.longitudinalG)||0)<-7;
        const reversing=speed<-.7;
        const blink=!!vehicle.hazardLightsOn ||
            !!(input.left || input.right);
        return {
            headlamps:!!vehicle.headlightsOn,braking,reversing,
            left:blink && (!!vehicle.hazardLightsOn || !!input.left),
            right:blink && (!!vehicle.hazardLightsOn || !!input.right)
        };
    }

    static update(vehicle, dt, input) {
        const time = vehicle.motionClock = (vehicle.motionClock || 0) + Math.max(0,dt);
        const state = this.lightState(vehicle,input);
        vehicle.brakeLightsOn = state.braking;
        if (vehicle.headlightMaterial) {
            vehicle.headlightMaterial.color.setHex(state.headlamps ? 0xfff6bf : 0x605735);
        }
        if (vehicle.tailMaterial) {
            // Lanterna de posição no escuro + freio em vermelho intenso.
            vehicle.tailMaterial.color.setHex(
                state.braking?0xff293c:
                state.headlamps?0xb3242d:0x52151a);
        }
        if(vehicle.reverseLightMaterial)
            vehicle.reverseLightMaterial.color.setHex(
                state.reversing?0xf8fafc:0x332d20);
        const pulse=Math.floor(time*2.6)%2===0;
        if(vehicle.turnSignalMaterials){
            vehicle.turnSignalMaterials.left.color.setHex(
                state.left && pulse?0xffaa23:0x59320d);
            vehicle.turnSignalMaterials.right.color.setHex(
                state.right && pulse?0xffaa23:0x59320d);
        }
        if (vehicle.headlightBeams){
            vehicle.headlightBeams.visible=state.headlamps;
            if(vehicle.headlightBeams.material)
                vehicle.headlightBeams.material.opacity=
                    state.headlamps?(vehicle.wetRoad?.20:.13):0;
        }
        VehicleDamageFX.update(vehicle);
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
                // Independent wheel travel: outside wheels compress in
                // corners; front axle compresses under braking.
                const side=i%2?1:-1,front=i<2?1:-1;
                const lat=Math.max(-1,Math.min(1,
                    Number(vehicle.suspensionLateralLoad)||0));
                const lon=Math.max(-1,Math.min(1,
                    Number(vehicle.suspensionLongitudinalLoad)||0));
                const target=.44+amplitude*.45*
                    Math.sin(time*(7+speed*.5)+phase+axlePhase)-
                    side*lat*.018-front*lon*.012;
                wheel.position.y+=(target-wheel.position.y)*
                    (1-Math.exp(-12*Math.min(.05,Math.max(0,dt))));
            });
        }
        if(typeof DriverVehicleWheelRig!=='undefined')
            DriverVehicleWheelRig.update(vehicle);
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
