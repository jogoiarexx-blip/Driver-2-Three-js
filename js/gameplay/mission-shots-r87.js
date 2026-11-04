/**
 * Driver 2 R87 — camera coverage of ACTUAL actors already present in the
 * mission scene. Not a pre-rendered cinematic or a newly spawned stunt NPC.
 *
 * All fifteen R86 story mission IDs have a short foreground shot plan.
 * Distant targets and actors that have not spawned fall back to the real
 * player. Actors are NEVER moved or cloned and no mission state changes.
 * The only pose is a small arm gesture on the existing Jones station mesh.
 */
class DriverMissionShotsR87 {
    static VERSION='r87-real-actors-dynamic-fov-jones-gesture';
    static SHOTS={
        story_tipoff:{focus:'tanner',zoom:4},
        story_witness:{focus:'target',zoom:7},
        story_train:{focus:'player',zoom:5},
        story_drop:{focus:'target',zoom:6},
        story_safehouse:{focus:'player',zoom:5},
        story_intruder:{focus:'target',zoom:7},
        story_caine:{focus:'player',zoom:6},
        story_leaving:{focus:'jones',zoom:7},
        story_havana_lead:{focus:'target',zoom:6},
        story_vegas_ambulance:{focus:'target',zoom:6},
        story_vegas_c4:{focus:'player',zoom:5},
        story_vegas_heist:{focus:'target',zoom:6},
        story_rio_barge:{focus:'player',zoom:5},
        story_rio_jericho:{focus:'target',zoom:7},
        story_rio_helicopter:{focus:'player',zoom:5}
    };
    static point(actor){
        if(!actor)return null;
        const p=actor.position||actor.group?.position||actor;
        if(!Number.isFinite(p.x)||!Number.isFinite(p.z))return null;
        return {x:p.x,y:Number.isFinite(p.y)?p.y:0,z:p.z};
    }
    static player(game){
        if(game?.mode==='on_foot'&&game.tanner?.group?.visible)
            return {actor:game.tanner.group,id:'tanner'};
        if(game?.playerCar)return {actor:game.playerCar,id:'playerCar'};
        if(game?.tanner?.group?.visible)
            return {actor:game.tanner.group,id:'tanner'};
        return null;
    }
    static resolve(game,type){
        const spec=this.SHOTS[type],base=this.player(game);
        if(!spec||!game)return null;
        if(spec.focus==='player')return base;
        let actor=null,id=null;
        if(spec.focus==='jones'&&game.stationJones){
            actor=game.stationJones;id='stationJones';
        }else if(spec.focus==='tanner'&&game.tanner?.group?.visible){
            actor=game.tanner.group;id='tanner';
        }else if(spec.focus==='target'&&game.targetCar){
            actor=game.targetCar;id='targetCar';
        }
        const subject=this.point(actor),origin=this.point(base?.actor);
        // The real Jones station actor might be hundreds of metres away
        // at mission start. Never jump the camera across Chicago.
        if(subject&&origin&&Math.hypot(subject.x-origin.x,
            subject.z-origin.z)<=45)return {actor,id};
        return base;
    }
    constructor(game,type){
        this.game=game;
        this.type=Object.prototype.hasOwnProperty.call(
            DriverMissionShotsR87.SHOTS,type)?type:null;
        this.camera=game?.camera||null;
        this.originalFov=Number.isFinite(this.camera?.fov)?
            this.camera.fov:null;
        this.lastShot=null;
        this.poseApplied=false;
    }
    poseJones(seconds){
        if(this.type!=='story_leaving')return false;
        const group=this.game?.stationJones;
        const arms=group?.userData?.r87JonesArms;
        if(!Array.isArray(arms)||arms.length!==2)return false;
        const t=Math.max(0,Math.min(1,(seconds-2.05)/2.95));
        const wave=Math.sin(Math.PI*t)*Math.sin(t*4*Math.PI);
        // Mesh limb rotations only. Jones' world transform never moves.
        arms[0].rotation.z=-.2-.2*Math.sin(t*Math.PI);
        arms[1].rotation.z=-.18-.75*Math.sin(t*Math.PI)-
            .1*wave;
        this.poseApplied=true;
        return true;
    }
    decorate(camera,seconds){
        if(!this.type||!camera||seconds<=2.05||seconds>=5)
            return null;
        const spec=DriverMissionShotsR87.SHOTS[this.type];
        const t=Math.max(0,Math.min(1,(seconds-2.05)/2.95));
        const weight=Math.sin(Math.PI*t);
        // Transient zoom, small enough for the stock camera rig.
        // Restored unconditionally by cancel/finish below.
        if(this.originalFov!==null){
            const next=this.originalFov-spec.zoom*weight;
            if(Math.abs(camera.fov-next)>.04){
                camera.fov=next;
                camera.updateProjectionMatrix?.();
            }
        }
        const choice=DriverMissionShotsR87.resolve(
            this.game,this.type);
        const p=DriverMissionShotsR87.point(choice?.actor);
        let framed=false;
        if(p&&camera.position&&typeof camera.lookAt==='function'){
            const distance=Math.hypot(
                camera.position.x-p.x,
                camera.position.z-p.z);
            if(distance<50){
                // Actor is physically in the current camera area.
                // Looking at the ACTUAL live actor, not a stand-in.
                camera.lookAt(p.x,p.y+1.35,p.z);
                framed=true;
            }
        }
        const gestured=this.poseJones(seconds);
        this.lastShot={type:this.type,actor:choice?.id||null,
            framed,zoom:Number((spec.zoom*weight).toFixed(2)),
            gestured};
        return this.lastShot;
    }
    release(){
        if(this.originalFov!==null&&this.camera){
            this.camera.fov=this.originalFov;
            this.camera.updateProjectionMatrix?.();
        }
        const arms=this.game?.stationJones?.userData?.r87JonesArms;
        if(Array.isArray(arms))
            for(const arm of arms)arm.rotation.z=0;
        this.poseApplied=false;
    }
}
if(typeof window!=='undefined')
    window.DriverMissionShotsR87=DriverMissionShotsR87;
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverMissionShotsR87;
