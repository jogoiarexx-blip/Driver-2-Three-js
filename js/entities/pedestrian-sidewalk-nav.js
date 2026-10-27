/**
 * Navegação de pedestres pelos passeios de blocos de 80m.
 * Mantém as pessoas fora da malha de asfalto e dos colliders de edifícios.
 * Independente de THREE; testável com Node e reutilizável em quatro cidades.
 */
class DriverPedestrianSidewalks {
    static HALF=23;
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
        if(city?.isPointBlocked?.(x,z,.40,0))return false;
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
            const d=Math.hypot(x-p.x,z-p.z);
            if(d<limit){limit=d;near=car}
        }
        return near;
    }
    static step(p,dt,city,vehicles){
        if(!p.route||p.route.length!==4)return {state:'idle'};
        dt=Math.min(.08,Math.max(0,dt));
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
            return {state:'dodge',newDodge:true};
        }
        if(p.waitTimer>0){
            p.waitTimer=Math.max(0,p.waitTimer-dt);
            return {state:'waiting'};
        }
        const dest=p.route[p.nextCorner%4];
        const dx=dest.x-p.x,dz=dest.z-p.z;
        const length=Math.hypot(dx,dz);
        const step=Math.min(length,(p.walkSpeed||2.65)*dt);
        if(length<=.045){
            p.x=dest.x;p.z=dest.z;
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
