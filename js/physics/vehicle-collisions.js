/**
 * Driver 2 — colisões veículo/veículo sem atravessar estruturas da cidade.
 * Resolve separação por massa, impulso e dano por par com cooldown.
 * A lógica é independente de THREE/WebGL e pode ser testada em Node.
 */
class DriverVehicleCollisions {
    constructor() { this.reset(); }
    reset() { this.pairs = new WeakMap(); }

    // Frente/traseira/laterais no referencial local do carro (+Z = frente).
    static impactZone(car, directionX, directionZ) {
        const forward=directionX*Math.sin(car.heading)+directionZ*Math.cos(car.heading);
        const right=directionX*Math.cos(car.heading)-directionZ*Math.sin(car.heading);
        if (forward>=Math.abs(right)*0.85) return 'front';
        if (-forward>=Math.abs(right)*0.85) return 'rear';
        return right>=0 ? 'right' : 'left';
    }

    static recordZone(car, nx, nz, speed) {
        const zone=this.impactZone(car,nx,nz);
        if (!car.damageZones) car.damageZones={front:0,rear:0,left:0,right:0};
        const increment=Math.max(0,Math.min(42,Math.abs(speed)*1.15));
        car.damageZones[zone]=Math.min(100,(car.damageZones[zone]||0)+increment);
        car.lastImpactZone=zone;
        return zone;
    }

    collisionRadius(a, b) {
        const heavy = v => v.bodyStyle === 'bus' || v.bodyStyle === 'truck';
        return heavy(a) || heavy(b) ? 4.5 : 3.6;
    }

    isFree(city, x, z) {
        return !city || typeof city.isPointBlocked !== 'function' ||
            !city.isPointBlocked(x, z, 1.55);
    }

    timestamp(a, b) {
        return this.pairs.get(a)?.get(b) ?? -Infinity;
    }

    storeTimestamp(a, b, time) {
        let entries = this.pairs.get(a);
        if (!entries) {
            entries = new WeakMap();
            this.pairs.set(a, entries);
        }
        entries.set(b, time);
    }

    resolve(a, b, city, time, player, onPlayerImpact) {
        const dx = b.x - a.x, dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        const radius = this.collisionRadius(a, b);
        if (dist >= radius) return false;

        const va = DriverArcadePhysics.velocity(a);
        const vb = DriverArcadePhysics.velocity(b);
        const rvx = va.x - vb.x, rvz = va.z - vb.z;
        // Quando os centros coincidem, escolhe a normal pela velocidade relativa.
        const normalLength = Math.hypot(rvx, rvz);
        const nx = dist > 0.001 ? dx / dist :
            normalLength > 0.001 ? rvx / normalLength : Math.sin(a.heading);
        const nz = dist > 0.001 ? dz / dist :
            normalLength > 0.001 ? rvz / normalLength : Math.cos(a.heading);
        const invA = 1 / DriverArcadePhysics.mass(a);
        const invB = 1 / DriverArcadePhysics.mass(b);
        const sum = invA + invB;
        const separation = Math.min(2.0, radius - dist + 0.03);
        let moveA = separation * invA / sum, moveB = separation * invB / sum;
        const aFree = this.isFree(city, a.x - nx * moveA, a.z - nz * moveA);
        const bFree = this.isFree(city, b.x + nx * moveB, b.z + nz * moveB);
        if (!aFree && bFree) moveB = separation;
        if (!bFree && aFree) moveA = separation;
        // Revalida também o deslocamento redistribuído quando a outra
        // carroceria está encostada em uma parede.
        if (aFree && this.isFree(city, a.x - nx * moveA, a.z - nz * moveA)) {
            a.x -= nx * moveA; a.z -= nz * moveA;
        }
        if (bFree && this.isFree(city, b.x + nx * moveB, b.z + nz * moveB)) {
            b.x += nx * moveB; b.z += nz * moveB;
        }

        const approachA = va.x * nx + va.z * nz;
        const approachB = -(vb.x * nx + vb.z * nz);
        const closing = DriverArcadePhysics.resolveImpact(a, b, nx, nz);
        if (closing > 5.5 && time - this.timestamp(a, b) >= 480) {
            this.storeTimestamp(a, b, time);
            const massA = DriverArcadePhysics.mass(a);
            const massB = DriverArcadePhysics.mass(b);
            const strength = Math.min(18, closing * 0.27);
            a.damage = Math.min(100, a.damage + strength * Math.min(1.5, Math.sqrt(massB / massA)));
            b.damage = Math.min(100, b.damage + strength * Math.min(1.5, Math.sqrt(massA / massB)));
            const zoneA=DriverVehicleCollisions.recordZone(a,nx,nz,closing);
            const zoneB=DriverVehicleCollisions.recordZone(b,-nx,-nz,closing);
            if (typeof onPlayerImpact === 'function' && (a === player || b === player)) {
                const other = a === player ? b : a;
                onPlayerImpact({
                    closingSpeed: closing,
                    other,
                    playerApproach: a === player ? approachA : approachB,
                    impactZone: a === player ? zoneA : zoneB
                });
            }
        }
        if (typeof a.updateTransform === 'function') a.updateTransform();
        if (typeof b.updateTransform === 'function') b.updateTransform();
        return true;
    }

    step(vehicles, player, city, time, onPlayerImpact) {
        let contacts = 0;
        for (let i = 0; i < vehicles.length; i++) {
            for (let j = i + 1; j < vehicles.length; j++) {
                if (this.resolve(vehicles[i], vehicles[j], city, time, player, onPlayerImpact)) {
                    contacts++;
                }
            }
        }
        return contacts;
    }
}
