/**
 * Chicago 04 — Tailing the Drop.
 * Mecânica de seguimento furtivo e percurso programado até o depósito.
 * O percurso é original/adaptado à malha do projeto, não é extraído do PS1.
 */
class DriverTailingDropMission {
    static ROUTE = Object.freeze([
        {x:4,z:0},{x:4,z:80},{x:84,z:80},
        {x:84,z:-80},{x:164,z:-80},{x:164,z:-160},
        {x:204,z:-160}
    ]);
    static DESTINATION = Object.freeze({x:200,z:-179});
    static NEAR = 18;
    static FAR = 100;
    constructor() { this.reset(); }
    reset() {
        this.suspicion=0;
        this.lost=0;
        this.safeSeconds=0;
        this.failed=null;
        this.arrived=false;
        this.lastStatus='green';
    }
    static attachRoute(target) {
        if(!target)return null;
        target.scriptedDrive = {
            waypoints:this.ROUTE.map(p=>({x:p.x,z:p.z})),
            index:0,done:false,maxSpeed:23
        };
        return target.scriptedDrive;
    }
    static advanceRoute(car) {
        const route=car?.scriptedDrive;
        if(!route || !Array.isArray(route.waypoints) || !route.waypoints.length)
            return null;
        if(route.done)return null;
        let waypoint=route.waypoints[route.index];
        if(!waypoint){route.done=true;return null;}
        if(Math.hypot(car.x-waypoint.x,car.z-waypoint.z)<=10.5){
            route.index++;
            waypoint=route.waypoints[route.index];
            if(!waypoint){route.done=true;return null;}
        }
        return waypoint;
    }
    static progress(target) {
        const route=target?.scriptedDrive;
        if(!route)return 0;
        return route.done?1:Math.min(0.99,route.index/route.waypoints.length);
    }
    update(dt,player,target,mode='driving') {
        const seconds=Math.max(0,Math.min(.05,Number(dt)||0));
        const distance=player&&target ?
            Math.hypot(player.x-target.x,player.z-target.z) : Infinity;
        if(this.failed) return {
            distance,failed:this.failed,complete:false,zone:this.lastStatus,
            progress:DriverTailingDropMission.progress(target),
            suspicion:this.suspicion,lost:this.lost
        };
        const close=distance < DriverTailingDropMission.NEAR;
        const dangerouslyClose=distance<11;
        const far=distance>DriverTailingDropMission.FAR;
        const veryFar=distance>135;
        const routeDone=!!target?.scriptedDrive?.done;
        const parkedNearDepot=routeDone && Math.hypot(
            target.x-DriverTailingDropMission.DESTINATION.x,
            target.z-DriverTailingDropMission.DESTINATION.z
        )<32;
        this.arrived=parkedNearDepot;
        if(close) this.suspicion=Math.min(100,
            this.suspicion+seconds*(dangerouslyClose?60:22));
        else this.suspicion=Math.max(0,this.suspicion-seconds*12);
        if(far) this.lost=Math.min(100,this.lost+seconds*(veryFar?38:17));
        else this.lost=Math.max(0,this.lost-seconds*18);
        if(!close&&!far&&mode==='driving')this.safeSeconds+=seconds;
        this.lastStatus=close?'close':far?'far':'green';
        if(this.suspicion>=100) this.failed='seen';
        else if(this.lost>=100) this.failed='lost';
        else if(target?.damage>=95) this.failed='wrecked';
        const complete=parkedNearDepot && distance>=DriverTailingDropMission.NEAR &&
            distance<=DriverTailingDropMission.FAR && mode==='driving' &&
            !this.failed && this.safeSeconds>=5;
        return {
            distance,zone:this.lastStatus,suspicion:this.suspicion,
            lost:this.lost,failed:this.failed,complete,
            progress:DriverTailingDropMission.progress(target),
            arrived:parkedNearDepot
        };
    }
}
