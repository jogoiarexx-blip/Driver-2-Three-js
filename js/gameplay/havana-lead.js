/**
 * Havana 09 — Follow Up the Lead.
 * Missão adaptada à cidade procedural deste projeto: seguir o intermediário
 * da rede de Caine sem alertá-lo e confirmar o encontro nos cais.
 * Diretor puro: a física e o motorista são responsabilidade do motor.
 */
class DriverHavanaLead {
    static START=Object.freeze({x:4,z:-235,heading:0});
    static SUSPECT=Object.freeze({x:4,z:-162,heading:0});
    static RENDEZVOUS=Object.freeze({x:164,z:160});
    static ROUTE=Object.freeze([
        {x:4,z:-80}, {x:84,z:-80}, {x:84,z:-160},
        {x:164,z:-160}, {x:164,z:-80}, {x:84,z:-80},
        {x:84,z:0}, {x:4,z:0}, {x:4,z:80},
        {x:84,z:80}, {x:164,z:80}, {x:164,z:160}
    ]);
    static LIMIT=195;
    static MIN_DISTANCE=16;
    static MAX_DISTANCE=125;
    static LOSE_SECONDS=5.5;
    static ALERT_SECONDS=3.3;
    static REQUIRED_TAIL_SECONDS=12;
    static FINAL_RADIUS=40;

    constructor(){this.reset();}
    reset(){
        this.lostSeconds=0;
        this.alertSeconds=0;
        this.tailSeconds=0;
        this.complete=false;
        this.failed=null;
        this.phase='follow';
    }
    static attachRoute(car){
        if(!car)return null;
        car.scriptedDrive={
            waypoints:this.ROUTE.map(p=>({x:p.x,z:p.z})),
            index:0,done:false,maxSpeed:24,waitSeconds:3
        };
        return car.scriptedDrive;
    }
    static progress(target){
        const route=target?.scriptedDrive;
        if(!route||!Array.isArray(route.waypoints)||!route.waypoints.length)
            return 0;
        return route.done?1:Math.min(.99,
            Math.max(0,(Number(route.index)||0)/route.waypoints.length));
    }
    update(dt,{player,target,mode='driving',timeLeft=DriverHavanaLead.LIMIT}={}){
        const seconds=Math.max(0,Math.min(.05,Number(dt)||0));
        const distance=player&&target?Math.hypot(player.x-target.x,
            player.z-target.z):Infinity;
        if(this.complete||this.failed)
            return this.status(distance,target);

        if(!target||!player){
            this.failed='missing_target';
            return this.status(distance,target);
        }
        const tooClose=distance<this.constructor.MIN_DISTANCE;
        const tooFar=distance>this.constructor.MAX_DISTANCE;
        // Se o suspeito parar no ponto final, Tanner ainda pode alcançá-lo.
        const done=!!target.scriptedDrive?.done &&
            Math.hypot(target.x-this.constructor.RENDEZVOUS.x,
                target.z-this.constructor.RENDEZVOUS.z)<
                this.constructor.FINAL_RADIUS;

        if(mode!=='driving'){
            this.lostSeconds+=seconds;
        }else if(tooFar){
            this.lostSeconds+=seconds;
        }else this.lostSeconds=Math.max(0,this.lostSeconds-seconds*.75);

        if(tooClose && mode==='driving'){
            this.alertSeconds+=seconds;
        }else this.alertSeconds=Math.max(0,this.alertSeconds-seconds*1.5);

        if(!tooClose && !tooFar && mode==='driving')
            this.tailSeconds+=seconds;

        this.phase=done?'meet':'follow';
        if(this.alertSeconds>=this.constructor.ALERT_SECONDS)
            this.failed='detected';
        else if(this.lostSeconds>=this.constructor.LOSE_SECONDS)
            this.failed='lost';
        else if(target.damage>=95)this.failed='destroyed';
        else if(timeLeft<=0)this.failed='timeout';
        else if(done && !tooClose && !tooFar &&
            mode==='driving' &&
            this.tailSeconds>=this.constructor.REQUIRED_TAIL_SECONDS)
            this.complete=true;

        return this.status(distance,target);
    }
    status(distance,target){
        const progress=this.constructor.progress(target);
        const zone=distance<this.constructor.MIN_DISTANCE?'close':
            distance>this.constructor.MAX_DISTANCE?'far':'safe';
        const message=this.phase==='meet'?
            'ENCONTRO NOS CAIS • CONFIRME O CONTATO':
            'SIGA O SUSPEITO • '+Math.round(distance)+'m';
        return {phase:this.phase,complete:this.complete,failed:this.failed,
            distance,zone,progress,message,tailSeconds:this.tailSeconds,
            alertSeconds:this.alertSeconds,lostSeconds:this.lostSeconds};
    }
    export(target){
        return {
            lostSeconds:this.lostSeconds,alertSeconds:this.alertSeconds,
            tailSeconds:this.tailSeconds,complete:this.complete,
            phase:this.phase,failed:this.failed,
            routeIndex:Math.floor(Math.max(0,
                Number(target?.scriptedDrive?.index)||0)),
            routeDone:!!target?.scriptedDrive?.done,
            waitSeconds:Math.max(0,
                Number(target?.scriptedDrive?.waitSeconds)||0)
        };
    }
    restore(data,target){
        this.reset();
        if(!data||typeof data!=='object')return;
        const bounded=(value,max)=>{
            const n=Number(value);
            return Number.isFinite(n)?Math.max(0,Math.min(max,n)):0;
        };
        this.lostSeconds=bounded(data.lostSeconds,this.constructor.LOSE_SECONDS);
        this.alertSeconds=bounded(data.alertSeconds,this.constructor.ALERT_SECONDS);
        this.tailSeconds=bounded(data.tailSeconds,300);
        this.complete=data.complete===true;
        this.failed=['detected','lost','destroyed','timeout'].includes(data.failed)?
            data.failed:null;
        this.phase=this.complete||data.phase==='meet'?'meet':'follow';
        const route=target?.scriptedDrive;
        if(route&&Array.isArray(route.waypoints)){
            route.index=Math.floor(bounded(data.routeIndex,route.waypoints.length));
            route.done=!!data.routeDone;
            route.waitSeconds=bounded(data.waitSeconds,5);
        }
    }
}
