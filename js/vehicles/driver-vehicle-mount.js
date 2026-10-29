/**
 * Driver 2 — entrada e saída cinematográfica de carros e motos.
 * A física só troca de estado após a animação; nunca teleporta Tanner
 * enquanto o jogador ainda controla o veículo.
 */
class DriverVehicleMount {
    static clamp(t){return Math.max(0,Math.min(1,t));}
    static ease(t){t=this.clamp(t);return t*t*(3-2*t);}
    static lerp(a,b,t){return a+(b-a)*this.ease(t);}
    static position(vehicle,side,distance,forward=0){
        const h=Number(vehicle.heading)||0;
        return {
            x:vehicle.x+Math.cos(h)*distance*side+Math.sin(h)*forward,
            z:vehicle.z-Math.sin(h)*distance*side+Math.cos(h)*forward,
            y:Number(vehicle.y)||0,
            heading:h
        };
    }
    static permitted(city,p){
        if(city?.isWaterAt?.(p.x,p.z))return false;
        if(city?.isPointBlocked?.(p.x,p.z,.55,p.y))return false;
        return true;
    }
    static chooseStandPoint(engine,vehicle,kind){
        const motorcycle=vehicle.bodyStyle==='motorcycle';
        const distance=motorcycle?1.65:2.40;
        const actor=engine.tanner?.group?.position;
        const h=Number(vehicle.heading)||0;
        const projection=actor?
            (actor.x-vehicle.x)*Math.cos(h)-(actor.z-vehicle.z)*Math.sin(h):0;
        const first=kind==='enter'?(projection>=0?1:-1):-1;
        for(const side of [first,-first]){
            for(const extra of [0,.55,1.1]){
                const pt=this.position(vehicle,side,distance+extra,motorcycle?-.18:0);
                if(this.permitted(engine.city,pt))return {...pt,side};
            }
        }
        return null;
    }
    static start(engine,vehicle,kind){
        if(!vehicle||!engine?.tanner||engine.vehicleMountTransition||
            engine.policeDoorTransition||!['enter','exit'].includes(kind))
            return false;
        const bike=vehicle.bodyStyle==='motorcycle';
        const stand=this.chooseStandPoint(engine,vehicle,kind);
        if(!stand)return false; // Não materializar Tanner dentro de paredes.
        // A moto conserva o Tanner real até o momento em que a
        // perna começa a passar por cima do banco (sem trocar de modelo).
        const source=engine.tanner.group.position;
        const from=kind==='enter'?
            {x:source.x,y:source.y,z:source.z,heading:engine.tanner.heading}:
            this.position(vehicle,stand.side,bike?.12:.28,bike?-.28:.15);
        const near=this.position(vehicle,stand.side,bike?.68:1.18,bike?-.32:.12);
        const seat=this.position(vehicle,stand.side,bike?0:.16,bike?-.35:.12);
        vehicle.speed=0;
        vehicle.lateralVelocity=0;
        engine.vehicleMountTransition={
            vehicle,kind,bike,clock:0,progress:0,
            duration:bike?(kind==='enter'?1.55:1.35):
                (kind==='enter'?1.30:1.20),
            from,near,seat,stand,originalCar:engine.playerCar
        };
        if(kind==='enter')engine.tanner.setVisible(true);
        else engine.tanner.setVisible(false);
        return true;
    }
    static setActor(engine,p,heading,style,kind,t,dt,side=-1){
        const person=engine.tanner;
        const ground=engine.city?.getGroundHeightAt?.(p.x,p.z,p.y)??p.y;
        person.setPosition(p.x,Math.max(p.y,Number.isFinite(ground)?ground:p.y),
            p.z,heading);
        person.applyVehicleTransitionPose?.(style,kind,t,dt,side);
    }
    static move(a,b,t,raise=0){
        return {
            x:this.lerp(a.x,b.x,t),
            y:this.lerp(a.y,b.y,t)+raise,
            z:this.lerp(a.z,b.z,t)
        };
    }
    static badge(engine,text,driving){
        if(typeof document==='undefined')return;
        const badge=document.getElementById('player-state-badge');
        if(!badge)return;
        badge.textContent=text;
        badge.className=driving?
            'px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold':
            'px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold';
    }
    static finish(engine,s){
        engine.vehicleMountTransition=null;
        engine.tanner.resetVehicleTransitionPose?.();
        if(s.kind==='enter'){
            const changed=s.vehicle!==s.originalCar;
            engine.playerCar=s.vehicle;
            engine.mode='driving';
            engine.tanner.setVisible(false);
            if(s.bike)
                engine.tanner.mountOnMotorcycle?.(s.vehicle);
            if(changed&&!engine.isPoliceNearPlayer?.(45))
                engine.felony=Math.max(0,(engine.felony||0)-65);
            else if(s.vehicle.isPolice)
                engine.felony=Math.min(100,(engine.felony||0)+35);
            this.badge(engine,s.bike?'NA MOTO':
                s.vehicle.isSecret?'CARRO SECRETO!':'NO VOLANTE (V8)',true);
        }else{
            engine.mode='on_foot';
            const ground=engine.city?.getGroundHeightAt?.(
                s.stand.x,s.stand.z,s.stand.y);
            engine.tanner.setPosition(s.stand.x,
                Number.isFinite(ground)?ground:s.stand.y,
                s.stand.z,s.vehicle.heading);
            engine.tanner.setVisible(true);
            this.badge(engine,'TANNER (A PÉ)',false);
        }
    }
    static update(engine,dt){
        const s=engine.vehicleMountTransition;
        if(!s)return false;
        // Substeps limitados para não avançar 1,5s em um frame travado.
        s.clock=Math.min(s.duration,s.clock+
            Math.max(0,Math.min(.08,Number(dt)||0)));
        const t=this.clamp(s.clock/s.duration);
        s.progress=t;
        const style=s.bike?'motorcycle':'car';
        if(s.kind==='enter'){
            if(t<.30){
                const p=this.move(s.from,s.near,t/.30);
                this.setActor(engine,p,s.vehicle.heading,style,'enter',t,dt,s.stand.side);
            }else if(t<.83){
                const f=(t-.30)/.53;
                // Joelho sobre o banco da moto; cabeça e tronco acompanham.
                const lift=s.bike?.35*Math.sin(Math.PI*f):-.12*Math.sin(Math.PI*f);
                const p=this.move(s.near,s.seat,f,lift);
                this.setActor(engine,p,s.vehicle.heading,style,'enter',t,dt,s.stand.side);
            }
            if(t>=.83){
                if(s.bike&&engine.tanner.vehicleBoneRig){
                    // Terminamos a pose com o GLB real, sem mostrar o
                    // piloto procedural durante os últimos 0,25 segundos.
                    this.setActor(engine,s.seat,s.vehicle.heading,
                        style,'enter',t,dt,s.stand.side);
                }else engine.tanner.setVisible(false);
            }
        }else{
            if(t>=.16&&s.bike&&
                engine.tanner.motorcycleVehicle===s.vehicle)
                engine.tanner.detachFromMotorcycle?.();
            if(t>=.16)engine.tanner.setVisible(true);
            if(t>=.16&&t<.77){
                const f=(t-.16)/.61;
                const lift=s.bike?.28*Math.sin(Math.PI*f):-.10*Math.sin(Math.PI*f);
                const p=this.move(s.seat,s.near,f,lift);
                this.setActor(engine,p,s.vehicle.heading,style,'exit',t,dt,s.stand.side);
            }else if(t>=.77){
                const p=this.move(s.near,s.stand,(t-.77)/.23);
                this.setActor(engine,p,s.vehicle.heading,style,'exit',t,dt,s.stand.side);
            }
        }
        if(t>=1)this.finish(engine,s);
        return true;
    }
}
