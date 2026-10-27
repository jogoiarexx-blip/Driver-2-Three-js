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

    // Teste contínuo no espaço relativo: evita que carros se atravessem
    // entre dois quadros, sem colisões falsas quando seus caminhos cruzam
    // em momentos diferentes.
    sweptContact(a,b,radius) {
        const keys=[a.prevX,a.prevZ,b.prevX,b.prevZ,
            a.x,a.z,b.x,b.z];
        if(!keys.every(Number.isFinite))return null;
        const dax=a.x-a.prevX,daz=a.z-a.prevZ;
        const dbx=b.x-b.prevX,dbz=b.z-b.prevZ;
        // Mudanças bruscas de fase/cidade e teleporte não são movimentos.
        const limit=v=>Math.max(7,Math.abs(Number(v.speed)||0)*.12+4);
        if(Math.hypot(dax,daz)>limit(a) ||
            Math.hypot(dbx,dbz)>limit(b))return null;
        const px=b.prevX-a.prevX,pz=b.prevZ-a.prevZ;
        const vx=dbx-dax,vz=dbz-daz;
        const motion=vx*vx+vz*vz;
        if(motion<1e-8)return null;
        const start=px*px+pz*pz-radius*radius;
        // Sobreposição no frame anterior: deixar o separador discreto tratar.
        if(start<=0)return null;
        const closing=2*(px*vx+pz*vz);
        if(closing>=0)return null;
        const discriminant=closing*closing-4*motion*start;
        if(discriminant<0)return null;
        const t=(-closing-Math.sqrt(discriminant))/(2*motion);
        if(t<0||t>1)return null;
        const rx=px+vx*t,rz=pz+vz*t;
        const length=Math.hypot(rx,rz);
        if(length<1e-7)return null;
        return {
            t,nx:rx/length,nz:rz/length,
            ax:a.prevX+dax*t,az:a.prevZ+daz*t,
            bx:b.prevX+dbx*t,bz:b.prevZ+dbz*t
        };
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

    resolve(a, b, city, time, player, onPlayerImpact, onAnyImpact) {
        const dx = b.x - a.x, dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        const radius = this.collisionRadius(a, b);
        if(Math.abs((a.y||0)-(b.y||0))>3.2)return false;
        let swept=null;
        if(dist>=radius){
            swept=this.sweptContact(a,b,radius);
            if(!swept)return false;
            // Retorna ao primeiro contato, sem fazer a carcaça atravessar
            // uma parede próxima. Projetar impulso só após verificar ambos.
            if(!this.isFree(city,swept.ax,swept.az) ||
                !this.isFree(city,swept.bx,swept.bz))
                return false;
            a.x=swept.ax;a.z=swept.az;
            b.x=swept.bx;b.z=swept.bz;
        }

        const va = DriverArcadePhysics.velocity(a);
        const vb = DriverArcadePhysics.velocity(b);
        const rvx = va.x - vb.x, rvz = va.z - vb.z;
        // Quando os centros coincidem, escolhe a normal pela velocidade relativa.
        const normalLength = Math.hypot(rvx, rvz);
        const nx = swept ? swept.nx : dist > 0.001 ? dx / dist :
            normalLength > 0.001 ? rvx / normalLength : Math.sin(a.heading);
        const nz = swept ? swept.nz : dist > 0.001 ? dz / dist :
            normalLength > 0.001 ? rvz / normalLength : Math.cos(a.heading);
        const invA = 1 / DriverArcadePhysics.mass(a);
        const invB = 1 / DriverArcadePhysics.mass(b);
        const sum = invA + invB;
        const separation = swept ? 0.035 :
            Math.min(2.0, radius - dist + 0.03);
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
            if(typeof onAnyImpact==='function')
                onAnyImpact({a,b,zoneA,zoneB,closingSpeed:closing,swept:!!swept});
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

    step(vehicles, player, city, time, onPlayerImpact, onAnyImpact) {
        let contacts = 0;
        for (let i = 0; i < vehicles.length; i++) {
            for (let j = i + 1; j < vehicles.length; j++) {
                if (this.resolve(vehicles[i], vehicles[j], city, time, player, onPlayerImpact, onAnyImpact)) {
                    contacts++;
                }
            }
        }
        return contacts;
    }
}
