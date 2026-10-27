/**
 * Chicago 06 — Chase the Intruder.
 * Sequência adaptada do Driver 2 (PS1): perseguição ao invasor, pátio
 * industrial e van amarela fechando a saída. Sem teleporte do carro fugitivo.
 */
class DriverIntruderPursuit {
    static ROUTE=Object.freeze([
        {x:-80,z:0},{x:0,z:0},{x:80,z:0},
        {x:80,z:-80},{x:160,z:-80},{x:160,z:-160},
        {x:240,z:-160},{x:200,z:-160}
    ]);
    static YARD=Object.freeze({x:200,z:-160});
    static MAX_GAP=150;
    static LOST_LIMIT=6;
    static YARD_WAIT=20;
    static WAIT_AT_START=7;
    constructor(){this.reset();}
    reset() {
        this.phase='opening';
        this.lostSeconds=0;
        this.yardSeconds=0;
        this.captureSeconds=0;
        this.failed=null;
        this.blockadeShown=false;
    }
    static attach(target) {
        if (!target)return null;
        target.scriptedDrive={
            waypoints:this.ROUTE.map(p=>({x:p.x,z:p.z})),
            index:0,done:false,maxSpeed:27,
            waitSeconds:this.WAIT_AT_START
        };
        return target.scriptedDrive;
    }
    static isAtYard(pos,radius=22) {
        return !!pos &&
            Math.hypot(pos.x-this.YARD.x,pos.z-this.YARD.z)<=radius;
    }
    static distance(player,target) {
        return player&&target?Math.hypot(
            player.x-target.x,player.z-target.z):Infinity;
    }
    update(dt,player,target,mode='driving') {
        const step=Math.max(0,Math.min(0.05,Number(dt)||0));
        const route=target?.scriptedDrive;
        const distance=DriverIntruderPursuit.distance(player,target);
        const previous=this.phase;
        if (!route || !player)return {
            phase:this.phase,changed:false,distance,failed:'target_missing',
            complete:false,blockadeShown:this.blockadeShown
        };
        if (this.failed)return {
            phase:this.phase,changed:false,distance,failed:this.failed,
            complete:false,blockadeShown:this.blockadeShown
        };
        if (target.damage>=100) this.failed='wrecked';
        if (this.phase==='opening' && route.waitSeconds<=0)
            this.phase='chase';
        if (this.phase==='chase' && !route.done) {
            if (distance>DriverIntruderPursuit.MAX_GAP && mode==='driving')
                this.lostSeconds+=step;
            else if (distance>DriverIntruderPursuit.MAX_GAP && mode==='on_foot')
                this.lostSeconds+=step;
            else this.lostSeconds=Math.max(0,this.lostSeconds-step*1.6);
            if(this.lostSeconds>=DriverIntruderPursuit.LOST_LIMIT-1e-6)
                this.failed='lost';
        }
        if (route.done && !this.failed && this.phase!=='blocked') {
            this.phase='yard';
        }
        if(this.phase==='yard'){
            this.yardSeconds+=step;
            const stopped=(Math.abs(Number(player.speed)||0)<8) ||
                mode==='on_foot';
            if(DriverIntruderPursuit.isAtYard(player) && stopped){
                this.phase='blocked';
                this.blockadeShown=true;
            }else if(this.yardSeconds>=DriverIntruderPursuit.YARD_WAIT){
                this.failed='left_behind';
            }
        }
        if(this.phase==='blocked'){
            this.captureSeconds=Math.min(2,this.captureSeconds+step);
        }
        const complete=this.phase==='blocked' &&
            this.captureSeconds>=1.75-1e-6 && !this.failed;
        const message=this.phase==='opening' ?
            'ENTRE NO ESPORTIVO PRETO • O INVASOR ESTÁ FUGINDO' :
            this.phase==='chase'?
            'NÃO PERCA O INVASOR • DISTÂNCIA '+Math.round(distance)+'m':
            this.phase==='yard'?
            'PÁTIO DOS DEPÓSITOS • PARE PRÓXIMO AO CARRO DO INVASOR':
            'VAN AMARELA BLOQUEANDO A SAÍDA • VOCÊ CONSEGUIU SEGUI-LO';
        return {
            phase:this.phase,changed:previous!==this.phase,
            distance,routeProgress:route.done?1:route.index/route.waypoints.length,
            lostSeconds:this.lostSeconds,yardSeconds:this.yardSeconds,
            captureSeconds:this.captureSeconds,failed:this.failed,complete,
            blockadeShown:this.blockadeShown,message
        };
    }
    export(target) {
        const route=target?.scriptedDrive;
        return {
            phase:this.phase,lostSeconds:this.lostSeconds,
            yardSeconds:this.yardSeconds,captureSeconds:this.captureSeconds,
            blockadeShown:this.blockadeShown,
            routeIndex:route?.index||0,done:!!route?.done,
            waitSeconds:route?.waitSeconds||0
        };
    }
    restore(data,target) {
        this.reset();
        const states=['opening','chase','yard','blocked'];
        this.phase=states.includes(data?.phase)?data.phase:'opening';
        const number=(n,a,b)=>Number.isFinite(n)?Math.max(a,Math.min(b,n)):a;
        this.lostSeconds=number(data?.lostSeconds,0,DriverIntruderPursuit.LOST_LIMIT);
        this.yardSeconds=number(data?.yardSeconds,0,DriverIntruderPursuit.YARD_WAIT);
        this.captureSeconds=number(data?.captureSeconds,0,2);
        this.blockadeShown=!!data?.blockadeShown;
        if(target?.scriptedDrive){
            const route=target.scriptedDrive;
            route.index=Math.floor(number(data?.routeIndex,0,route.waypoints.length));
            route.done=!!data?.done;
            route.waitSeconds=number(data?.waitSeconds,0,DriverIntruderPursuit.WAIT_AT_START);
        }
    }
}
