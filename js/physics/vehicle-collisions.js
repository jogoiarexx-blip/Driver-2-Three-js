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

    static dimensions(vehicle) {
        // O volume físico é independente do GLB/texturas. As proporções
        // acompanham o chassi procedural e os veículos compridos.
        const type=vehicle?.bodyStyle;
        const values=type==='bus'?{width:2.72,length:8.00,height:3.45}:
            type==='truck'?{width:2.65,length:6.80,height:3.35}:
            type==='limo'?{width:2.48,length:7.47,height:2.12}:
            {width:2.45,length:5.15,height:2.05};
        const declared=vehicle?.colliderSize;
        if(declared && Number.isFinite(declared.width) &&
            Number.isFinite(declared.length) &&
            declared.width>=1.4 && declared.width<=4.5 &&
            declared.length>=2.5 && declared.length<=12)
            return {width:declared.width,length:declared.length,
                height:values.height};
        return values;
    }

    static axes(car) {
        const h=Number(car?.heading)||0;
        return [
            {x:Math.cos(h),z:-Math.sin(h),type:'right'},
            {x:Math.sin(h),z:Math.cos(h),type:'front'}
        ];
    }

    static projectionRadius(car,axis) {
        const dims=this.dimensions(car);
        const [right,forward]=this.axes(car);
        return (Math.abs(axis.x*right.x+axis.z*right.z)*dims.width+
            Math.abs(axis.x*forward.x+axis.z*forward.z)*dims.length)*.5;
    }

    static orientedContact(a,b,va=null,vb=null) {
        const dx=b.x-a.x,dz=b.z-a.z;
        let least=null,impactAxis=null,largestClosing=0;
        for(const axis of [...this.axes(a),...this.axes(b)]){
            const projection=dx*axis.x+dz*axis.z;
            const overlap=this.projectionRadius(a,axis)+
                this.projectionRadius(b,axis)-Math.abs(projection);
            if(overlap<=0)return null;
            const velocity=va&&vb?
                (va.x-vb.x)*axis.x+(va.z-vb.z)*axis.z:0;
            const sign=Math.abs(projection)>1e-5?
                Math.sign(projection):velocity<0?-1:1;
            const nx=axis.x*sign,nz=axis.z*sign;
            const info={nx,nz,depth:overlap};
            if(!least||overlap<least.depth)least=info;
            const closing=va&&vb?(va.x-vb.x)*nx+(va.z-vb.z)*nz:0;
            if(closing>largestClosing+.001){
                largestClosing=closing;
                impactAxis=info;
            }
        }
        // Batidas rápidas usam a normal da aproximação, evitando que
        // um impacto frontal profundo seja confundido com batida lateral.
        return largestClosing>2?impactAxis:least;
    }

    collisionRadius(a,b) {
        // Mantido para clientes antigos; o contato real usa SAT OBB.
        return (DriverVehicleCollisions.dimensions(a).length+
            DriverVehicleCollisions.dimensions(b).length)*.5;
    }

    sweptOrientedContact(a,b) {
        const nums=[a.prevX,a.prevZ,b.prevX,b.prevZ,
            a.x,a.z,b.x,b.z];
        if(!nums.every(Number.isFinite))return null;
        const dax=a.x-a.prevX,daz=a.z-a.prevZ;
        const dbx=b.x-b.prevX,dbz=b.z-b.prevZ;
        const limit=v=>Math.max(7,Math.abs(Number(v.speed)||0)*.12+4);
        if(Math.hypot(dax,daz)>limit(a) ||
            Math.hypot(dbx,dbz)>limit(b))return null;
        const px=b.prevX-a.prevX,pz=b.prevZ-a.prevZ;
        const vx=dbx-dax,vz=dbz-daz;
        if(vx*vx+vz*vz<1e-8)return null;
        let enter=-Infinity,exit=Infinity,normal=null;
        let overlappingStart=true;
        for(const axis of [
            ...DriverVehicleCollisions.axes(a),
            ...DriverVehicleCollisions.axes(b)]){
            const distance=px*axis.x+pz*axis.z;
            const motion=vx*axis.x+vz*axis.z;
            const radius=DriverVehicleCollisions.projectionRadius(a,axis)+
                DriverVehicleCollisions.projectionRadius(b,axis);
            if(Math.abs(distance)>=radius)overlappingStart=false;
            if(Math.abs(motion)<1e-9){
                if(Math.abs(distance)>=radius)return null;
                continue;
            }
            const t1=(-radius-distance)/motion;
            const t2=(radius-distance)/motion;
            const min=Math.min(t1,t2),max=Math.max(t1,t2);
            if(min>enter){
                enter=min;
                const at=distance+motion*min;
                const sign=at>=0?1:-1;
                normal={nx:axis.x*sign,nz:axis.z*sign};
            }
            exit=Math.min(exit,max);
            if(enter>exit)return null;
        }
        if(overlappingStart || enter<0 || enter>1 ||
            exit<0 || !normal)return null;
        return {
            t:enter,nx:normal.nx,nz:normal.nz,
            ax:a.prevX+dax*enter,az:a.prevZ+daz*enter,
            bx:b.prevX+dbx*enter,bz:b.prevZ+dbz*enter
        };
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
        if(Math.abs((a.y||0)-(b.y||0))>3.2)return false;
        const va=DriverArcadePhysics.velocity(a);
        const vb=DriverArcadePhysics.velocity(b);
        let contact=DriverVehicleCollisions.orientedContact(a,b,va,vb);
        let swept=null;
        if(!contact){
            swept=this.sweptOrientedContact(a,b);
            if(!swept)return false;
            if(!this.isFree(city,swept.ax,swept.az) ||
                !this.isFree(city,swept.bx,swept.bz))return false;
            a.x=swept.ax;a.z=swept.az;
            b.x=swept.bx;b.z=swept.bz;
            contact={nx:swept.nx,nz:swept.nz,depth:0};
        }
        const nx=contact.nx,nz=contact.nz;
        const invA = 1 / DriverArcadePhysics.mass(a);
        const invB = 1 / DriverArcadePhysics.mass(b);
        const sum = invA + invB;
        const separation = swept ? 0.035 :
            Math.min(2.0,contact.depth+0.03);
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
