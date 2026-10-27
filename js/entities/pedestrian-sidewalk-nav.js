/**
 * Navegação de pedestres pelos passeios de blocos de 80m.
 * Mantém as pessoas fora da malha de asfalto e dos colliders de edifícios.
 * Independente de THREE; testável com Node e reutilizável em quatro cidades.
 */
class DriverPedestrianSidewalks {
    // Rota agora 3 m para dentro da borda de 25 m do passeio;
    // mantém espaço para braços, roupa e esquiva da personagem GLB maior.
    static HALF=22;
    static BODY_RADIUS=.7;
    static route(block) {
        const h=this.HALF;
        return [
            {x:block.x-h,z:block.z-h},
            {x:block.x+h,z:block.z-h},
            {x:block.x+h,z:block.z+h},
            {x:block.x-h,z:block.z+h}
        ];
    }
    static fallbackBlocks(){
        const blocks=[];
        for(const x of [-280,-200,-120,-40,40,120,200,280])
            for(const z of [-280,-200,-120,-40,120,200,280])
                blocks.push({x,z});
        return blocks;
    }
    static cityBlocks(city) {
        const source=city?.districtBuildings?.length ?
            city.districtBuildings : this.fallbackBlocks();
        return source.filter(b=>Number.isFinite(b.x)&&
            Number.isFinite(b.z)&&!(b.z>10&&b.z<90) &&
            Math.abs(b.x)<=320&&Math.abs(b.z)<=320);
    }
    static permitted(city,x,z){
        if(!Number.isFinite(x)||!Number.isFinite(z))return false;
        if(typeof DriverRoadGeometry!=='undefined' &&
            DriverRoadGeometry.inDrivingLane(x,z,.75))return false;
        if(city?.isWaterAt?.(x,z))return false;
        // Fora da travessia sinalizada, o corpo inteiro deve caber na
        // calçada física. Nenhum pedestre pisa na pista por flutuação.
        if(city?.sidewalkGrid?.size && city?.isOnSidewalk &&
            !city.isOnSidewalk(x,z,this.BODY_RADIUS))return false;
        if(city?.isPointBlocked?.(x,z,this.BODY_RADIUS,0))return false;
        return true;
    }
    static blockSafe(city,block){
        return this.route(block).every(p=>this.permitted(city,p.x,p.z));
    }
    static pick(city,focus,count=28){
        const pool=this.cityBlocks(city).filter(b=>this.blockSafe(city,b));
        const selected=pool.sort((a,b)=>{
            const ad=Math.hypot(a.x-focus.x,a.z-focus.z);
            const bd=Math.hypot(b.x-focus.x,b.z-focus.z);
            return ad-bd || a.x-b.x || a.z-b.z;
        });
        if(!selected.length)return [];
        return Array.from({length:count},(_,i)=>selected[i%selected.length]);
    }
    static point(route,index,t=0){
        const n=((index%4)+4)%4;
        const a=route[n],b=route[(n+1)%4];
        return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
    }
    static nearestVehicle(vehicles,p,maxDistance=10){
        let near=null,limit=maxDistance;
        for(const car of vehicles||[]){
            if(!car||!Number.isFinite(car.x)||!Number.isFinite(car.z))
                continue;
            const vx=Math.sin(car.heading||0)*(car.speed||0);
            const vz=Math.cos(car.heading||0)*(car.speed||0);
            const x=car.x+vx*.28,z=car.z+vz*.28;
            // Considerar perigo agora E previsão de curto prazo:
            // não perder o pedestre que já está sob o para-choque.
            const d=Math.min(
                Math.hypot(car.x-p.x,car.z-p.z),
                Math.hypot(x-p.x,z-p.z)
            );
            if(d<limit){limit=d;near=car}
        }
        return near;
    }
    static crossingPlan(p,corner,city) {
        if(!city?.isTrafficGreen || !city?.getTrafficPhase ||
            !p.block)return null;
        const directions=[
            {dx:0,dz:-80,target:3,axis:'z'},
            {dx:80,dz:0,target:0,axis:'x'},
            {dx:0,dz:80,target:1,axis:'z'},
            {dx:-80,dz:0,target:2,axis:'x'}
        ];
        const move=directions[corner%4];
        const block={x:p.block.x+move.dx,z:p.block.z+move.dz};
        // Somente quadras existentes: não atravessar canal nem entrar em
        // locais usados por missões, parques ou edifícios especiais.
        if(city.districtBuildings?.length &&
            !city.districtBuildings.some(b=>b.x===block.x&&b.z===block.z))
            return null;
        if(!this.blockSafe(city,block))return null;
        const from=this.route(p.block)[corner];
        const destination=this.route(block)[move.target];
        if(Math.hypot(from.x-p.x,from.z-p.z)>0.2)return null;
        const distance=Math.hypot(destination.x-from.x,
            destination.z-from.z);
        if(distance>36||distance<28)return null;
        const steps=12;
        for(let i=0;i<=steps;i++){
            const t=i/steps;
            const x=from.x+(destination.x-from.x)*t;
            const z=from.z+(destination.z-from.z)*t;
            if(city.isWaterAt?.(x,z) ||
                city.isPointBlocked?.(x,z,this.BODY_RADIUS,0))return null;
        }
        return {x:destination.x,z:destination.z,
            startX:from.x,startZ:from.z,
            axis:move.axis,route:this.route(block),block,
            nextCorner:(move.target+1)%4,distance};
    }
    static crossingGreen(city,plan) {
        if(!plan || !city?.isTrafficGreen || !city?.getTrafficPhase)
            return false;
        const phase=city.getTrafficPhase();
        if(!Number.isFinite(phase))return false;
        // Semáforos: carros em Z têm verde 0..10, em X 12..22.
        // Pedestres cruzam apenas na fase vermelha do eixo percorrido
        // e com tempo suficiente para percorrer 34m a 6.6m/s.
        const time=plan.distance/6.6+1.2;
        if(plan.axis==='x')
            return phase>=.4&&phase+time<=12 &&
                !city.isTrafficGreen('x');
        return phase>=12.4&&phase+time<=24 &&
            !city.isTrafficGreen('z');
    }
    static crossingTrafficClear(plan,vehicles) {
        if(!plan)return false;
        for(const car of vehicles||[]){
            if(!Number.isFinite(car?.x)||!Number.isFinite(car?.z))
                continue;
            const vx=Math.sin(car.heading||0)*(car.speed||0);
            const vz=Math.cos(car.heading||0)*(car.speed||0);
            for(const t of [0,.55,1.1,1.8,2.4]){
                const x=car.x+vx*t,z=car.z+vz*t;
                const ux=plan.x-plan.startX,uz=plan.z-plan.startZ;
                const denominator=ux*ux+uz*uz;
                const projected=denominator>0?Math.max(0,Math.min(1,
                    ((x-plan.startX)*ux+(z-plan.startZ)*uz)/denominator)):0;
                const nearestX=plan.startX+projected*ux;
                const nearestZ=plan.startZ+projected*uz;
                if(Math.hypot(x-nearestX,z-nearestZ)<7)return false;
            }
        }
        return true;
    }
    static stepCrossing(p,dt,city) {
        const plan=p.crossing;
        if(!plan)return null;
        const dx=plan.x-p.x,dz=plan.z-p.z;
        const length=Math.hypot(dx,dz);
        const delta=Math.min(length,6.6*dt);
        if(length>1e-6){
            p.x+=dx/length*delta;
            p.z+=dz/length*delta;
        }
        if(length<=delta+.02){
            p.x=plan.x;p.z=plan.z;
            p.route=plan.route;p.block=plan.block;
            p.nextCorner=plan.nextCorner;
            p.crossing=null;
            p.waitingCrossingPlan=null;
            p.signalWaitElapsed=0;
            return {state:'crossing',dx:dx/(length||1),
                dz:dz/(length||1),completed:true};
        }
        return {state:'crossing',dx:dx/(length||1),dz:dz/(length||1)};
    }
    static approachingCrossing(car,walkers,lookAhead=22){
        if(!walkers?.length||!Number.isFinite(car?.x)||
            !Number.isFinite(car?.z))return Infinity;
        const heading=Number(car.heading)||0;
        const forward={x:Math.sin(heading),z:Math.cos(heading)};
        let nearest=Infinity;
        for(const p of walkers){
            if(!p?.crossing||!Number.isFinite(p.x)||!Number.isFinite(p.z))
                continue;
            const dx=p.x-car.x,dz=p.z-car.z;
            const along=dx*forward.x+dz*forward.z;
            const side=Math.abs(dx*forward.z-dz*forward.x);
            if(along>=-1&&along<=lookAhead&&side<4.5)
                nearest=Math.min(nearest,Math.max(0,along));
        }
        return nearest;
    }
    static step(p,dt,city,vehicles){
        if(!p.route||p.route.length!==4)return {state:'idle'};
        dt=Math.min(.08,Math.max(0,dt));
        // Nunca parar no meio da pista devido ao semáforo virar verde.
        // O sinal é validado ANTES de iniciar e a travessia segue até
        // o passeio oposto.
        if(p.crossing)return this.stepCrossing(p,dt,city);
        if(p.diveTimer>0){
            p.diveTimer=Math.max(0,p.diveTimer-dt);
            return {state:'dodge'};
        }
        const imminent=this.nearestVehicle(vehicles,p,8.0);
        if(imminent&&Math.abs(imminent.speed||0)>7){
            p.diveTimer=.62;
            // Esquiva visual e espera na calçada: um mergulho com
            // deslocamento irrestrito levaria o pedestre para o asfalto.
            p.waitTimer=.45;
            p.dodgeSide=Math.sign(Math.sin((p.walkPhase||0)+1))||1;
            return {state:'dodge',newDodge:true};
        }
        if(p.waitTimer>0){
            p.waitTimer=Math.max(0,p.waitTimer-dt);
            return {state:'waiting'};
        }
        // Durante espera no canto, a direção segura é reavaliada no
        // próximo frame; nenhuma tentativa invade a pista no vermelho.

        const dest=p.route[p.nextCorner%4];
        const dx=dest.x-p.x,dz=dest.z-p.z;
        const length=Math.hypot(dx,dz);
        const step=Math.min(length,(p.walkSpeed||2.65)*dt);
        if(length<=.045){
            p.x=dest.x;p.z=dest.z;
            // Um canto em espera não conta como novo canto a cada frame.
            if(!p.waitingCrossingPlan)p.walkCorners=(p.walkCorners||0)+1;
            // Um de cada três cantos tenta cruzar, para não formar uma
            // fila de 28 pessoas no mesmo semáforo.
            const want=p.waitingCrossingPlan ||
                (p.walkCorners%3===0?
                    this.crossingPlan(p,p.nextCorner%4,city):null);
            if(want){
                if(this.crossingGreen(city,want) &&
                    this.crossingTrafficClear(want,vehicles)){
                    p.crossing=want;p.waitingCrossingPlan=null;
                    p.signalWaitElapsed=0;
                    return this.stepCrossing(p,dt,city);
                }
                p.signalWaitElapsed=(p.signalWaitElapsed||0)+dt;
                if(p.signalWaitElapsed<25){
                    p.waitingCrossingPlan=want;
                    return {state:'signal_wait'};
                }
                p.waitingCrossingPlan=null;
                p.signalWaitElapsed=0;
            }
            p.nextCorner=(p.nextCorner+1)%4;
            return {state:'walk',dx:0,dz:0};
        }
        const nx=p.x+dx/length*step,nz=p.z+dz/length*step;
        if(!this.permitted(city,nx,nz)){
            p.waitTimer=.65;
            p.nextCorner=(p.nextCorner+2)%4;
            return {state:'waiting'};
        }
        p.x=nx;p.z=nz;
        return {state:'walk',dx:dx/length,dz:dz/length};
    }
}
