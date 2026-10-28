/**
 * Física arcade de direção, colisões e transferência de massa.
 * Separado da cena Three.js para facilitar testes e ajustes.
 */
class DriverArcadePhysics {
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
    static response(rate, dt) {
        return 1 - Math.exp(-rate * Math.max(0, dt));
    }
    static mass(vehicle) {
        return vehicle.bodyStyle === 'bus' ? 5200 :
            vehicle.bodyStyle === 'truck' ? 3800 :
            vehicle.bodyStyle === 'limo' ? 2150 : 1450;
    }
    static velocity(vehicle) {
        const heading = vehicle.heading;
        const side = vehicle.lateralVelocity || 0;
        return {
            x: Math.sin(heading) * vehicle.speed + Math.cos(heading) * side,
            z: Math.cos(heading) * vehicle.speed - Math.sin(heading) * side
        };
    }
    static project(vehicle, vx, vz) {
        const sx = Math.sin(vehicle.heading), cz = Math.cos(vehicle.heading);
        vehicle.speed = this.clamp(vx * sx + vz * cz, -vehicle.maxSpeed * 0.42, vehicle.maxSpeed);
        vehicle.lateralVelocity = this.clamp(vx * cz - vz * sx, -18, 18);
    }
    static resolveImpact(a, b, nx, nz, restitution = 0.26) {
        const av = this.velocity(a), bv = this.velocity(b);
        const closing = (av.x - bv.x) * nx + (av.z - bv.z) * nz;
        if (closing <= 0) return 0;
        const inverseA = 1 / this.mass(a), inverseB = 1 / this.mass(b);
        const impulse = (1 + restitution) * closing / (inverseA + inverseB);
        this.project(a, av.x - nx * impulse * inverseA, av.z - nz * impulse * inverseA);
        this.project(b, bv.x + nx * impulse * inverseB, bv.z + nz * impulse * inverseB);
        return closing;
    }
    static update(vehicle, dt, forwardThrottle, steerInput, handbrake, burnoutKey) {
        dt = this.clamp(dt, 0, 0.05);
        const health = Math.max(0.38, 1 - vehicle.damage / 140);
        const maxSpeed = vehicle.maxSpeed * (burnoutKey ? 1.16 : 1) * health;
        const prevSpeed = vehicle.speed;
        if (forwardThrottle > 0) {
            vehicle.speed += vehicle.accel * (burnoutKey ? 1.27 : 1) * dt;
        } else if (forwardThrottle < 0) {
            vehicle.speed -= vehicle.accel * (vehicle.speed > 1 ? 1.95 : 0.78) * dt;
        } else {
            vehicle.speed *= Math.exp(-0.85 * dt);
        }
        if (handbrake) vehicle.speed *= Math.exp(-1.4 * dt);
        vehicle.speed = this.clamp(vehicle.speed, -maxSpeed * 0.42, maxSpeed);
        if (Math.abs(vehicle.speed) < 0.06 && forwardThrottle === 0) vehicle.speed = 0;

        const absSpeed = Math.abs(vehicle.speed);
        const turnAbility = this.clamp(absSpeed / 8, 0, 1);
        const topSpeedSteer = 1 / (1 + (absSpeed / Math.max(1, vehicle.maxSpeed)) * 0.85);
        const wetRoad = vehicle.wetRoad === true;
        const secretDrift=Number.isFinite(vehicle.driftMultiplier) ?
            Math.max(1,Math.min(1.6,vehicle.driftMultiplier)) : 1;
        const driftBoost = (burnoutKey ? 1.66 : handbrake ? 1.53 : 1) *
            (1+(secretDrift-1)*.18);
        const yawRate = (1.78 * turnAbility * topSpeedSteer * driftBoost *
            (wetRoad ? 0.91 : 1)) *
            (vehicle.speed >= -0.1 ? 1 : -1);
        vehicle.steerAngle += (steerInput * 0.46 - vehicle.steerAngle) * this.response(10, dt);
        vehicle.heading += steerInput * yawRate * dt;
        if (vehicle.heading > Math.PI) vehicle.heading -= 2 * Math.PI;
        if (vehicle.heading < -Math.PI) vehicle.heading += 2 * Math.PI;
        vehicle.wheelSpin += vehicle.speed / 0.44 * dt;

        const centrifugal = steerInput * (vehicle.speed / Math.max(1,vehicle.maxSpeed));
        const slide = handbrake || burnoutKey;
        // No molhado, menor aderência aumenta a deriva lateral e demora
        // mais para reestabilizar o carro. Sem chuva, física original.
        const lateralTarget = -centrifugal *
            (slide ? 12.7 : wetRoad ? 6.0 : 3.6) * secretDrift;
        vehicle.lateralVelocity += (lateralTarget - vehicle.lateralVelocity) *
            this.response(slide ? 4.4 : wetRoad ? 4.3 : 8.5, dt);
        vehicle.isBurnout = burnoutKey && (forwardThrottle > 0 || steerInput !== 0);
        // Curvas rápidas também devem cantar pneu, sem exigir Shift.
        const fastCorner = absSpeed > 22 &&
            Math.abs(steerInput) > .45 && Math.abs(centrifugal) > .26;
        vehicle.isDrifting = vehicle.isBurnout ||
            (handbrake && absSpeed > 10) || fastCorner ||
            (Math.abs(centrifugal) > 0.55 && absSpeed > 22);

        // Real transfer of weight follows acceleration and curve radius,
        // not merely input buttons. Spring/damper settles after steering.
        const acceleration=this.clamp(
            (vehicle.speed-prevSpeed)/Math.max(dt,.0001),-40,40);
        const lateralForce=this.clamp(
            steerInput*absSpeed*Math.abs(yawRate)/(Math.max(1,vehicle.maxSpeed)),
            -.95,.95);
        const targetPitch=this.clamp(-acceleration*.0027+
            (handbrake?.026:0),-.115,.115);
        const targetRoll=this.clamp(-lateralForce*
            (slide?.235:.18),-.235,.235);
        const spring=(axis,target,stiffness,damping)=>{
            const vKey=axis+'SpringVelocity';
            const previous=Number(vehicle[vKey])||0;
            const position=Number(vehicle[axis])||0;
            const v=(previous+(target-position)*stiffness*dt)/
                (1+damping*dt);
            vehicle[vKey]=v;
            return position+v*dt;
        };
        vehicle.pitchAngle=spring('pitchAngle',targetPitch,130,18);
        vehicle.rollAngle=spring('rollAngle',targetRoll,120,17);
        vehicle.chassisTilt.rotation.x=vehicle.pitchAngle;
        vehicle.chassisTilt.rotation.z=vehicle.rollAngle;
        vehicle.suspensionLateralLoad=lateralForce;
        vehicle.suspensionLongitudinalLoad=this.clamp(
            acceleration/40,-1,1);

        vehicle.longitudinalG=(vehicle.speed-prevSpeed)/Math.max(dt,.0001);
        return centrifugal;
    }
}
