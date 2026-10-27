/**
 * Save persistente do jogador, local à origem de GitHub Pages.
 * Inclui estado da missão, frota, checkpoints, Tanner e interiores.
 * I/O isolado para testes com storage simulado.
 */
class DriverHomeSave {
    static KEY = 'driver2-three-save-v1';
    static VERSION = 1;
    static CITIES = ['chicago','havana','vegas','rio'];
    static TYPES = [
        'freeroam','chase','checkpoints','getaway','evidence','survival',
        'trailblazer','tail','mountainpass','quickchase','gauntlet','bomb',
        'heist','race','secret','pursuit','story_tipoff','story_witness','story_train','story_drop','story_safehouse','story_intruder','story_caine','story_leaving','story_havana_lead'
    ];
    constructor(storage) { this.storage=storage; }

    static bounded(value,min,max,defaultValue=0) {
        const number=Number(value);
        return Number.isFinite(number)?Math.min(max,Math.max(min,number)):defaultValue;
    }
    static position(vehicle) {
        return {
            x:this.bounded(vehicle.x,-1500,1500),
            y:this.bounded(vehicle.y,0,150),
            z:this.bounded(vehicle.z,-500,500),
            heading:this.bounded(vehicle.heading,-30,30),
            speed:this.bounded(vehicle.speed,-100,100),
            damage:this.bounded(vehicle.damage,0,100),
            damageZones: {
                front:this.bounded(vehicle.damageZones?.front,0,100),
                rear:this.bounded(vehicle.damageZones?.rear,0,100),
                left:this.bounded(vehicle.damageZones?.left,0,100),
                right:this.bounded(vehicle.damageZones?.right,0,100)
            },
            breakawayFlags:{
                front:vehicle.breakawayFlags?.front===true,
                rear:vehicle.breakawayFlags?.rear===true,
                left:vehicle.breakawayFlags?.left===true,
                right:vehicle.breakawayFlags?.right===true
            }
        };
    }
    capture(game) {
        const t=game.tanner.group.position;
        return {
            version:DriverHomeSave.VERSION,
            savedAt:new Date().toISOString(),
            city:game.currentCityKey,
            weather:game.weatherMode,
            felony:DriverHomeSave.bounded(game.felony,0,100),
            mode:game.mode==='on_foot'?'on_foot':'driving',
            interior:game.interiorPlace?.id || null,
            tanner:{x:t.x,y:t.y,z:t.z,heading:game.tanner.heading},
            vehicles:game.vehicles.map(v=>DriverHomeSave.position(v)),
            playerIndex:Math.max(0,game.vehicles.indexOf(game.playerCar)),
            secretGateOpen:!!game.city.secretGateOpen,
            mission:{
                type:game.missionType,
                active:!!game.missionActive,
                timeLeft:DriverHomeSave.bounded(game.missionTimeLeft,0,9999),
                survivalElapsed:DriverHomeSave.bounded(game.survivalElapsed,0,99999),
                tailOutOfRangeTimer:DriverHomeSave.bounded(game.tailOutOfRangeTimer,0,300),
                witnessCloseTime:DriverHomeSave.bounded(game.witnessCloseTime,0,300),
                evidencePhase:game.evidencePhase||0,
                pursuitPhase:game.pursuitChapter.phase,
                pursuitElapsed:game.pursuitChapter.elapsed,
                markers:game.missionMarkers.map(m=>!!m.collected),
                c4:game.c4State?{...game.c4State}:null
            },
            train:game.trainLine&&game.missionType==='story_train'?{
                elapsed:game.trainLine.elapsed,
                position:game.trainLine.position.z,
                arrived:game.trainLine.arrived,
                lost:game.trainLostSeconds||0
            }:null,
            leaving:game.missionType==='story_leaving' &&
                game.leavingDirector?game.leavingDirector.export():null,
            havanaLead:game.missionType==='story_havana_lead' &&
                game.havanaLeadDirector?
                game.havanaLeadDirector.export(game.targetCar):null,
            caine:game.missionType==='story_caine' && game.caineDirector?
                game.caineDirector.export():null,
            intruder:game.missionType==='story_intruder' && game.intruderDirector?
                game.intruderDirector.export(game.targetCar):null,
            safeEscape:game.missionType==='story_safehouse' &&
                game.safeHouseEscape?game.safeHouseEscape.export():null,
            drop:game.missionType==='story_drop'?{
                routeIndex:game.targetCar?.scriptedDrive?.index||0,
                done:!!game.targetCar?.scriptedDrive?.done,
                suspicion:game.dropDirector.suspicion,
                lost:game.dropDirector.lost,
                safeSeconds:game.dropDirector.safeSeconds
            }:null,
            completed:Array.from(game.completedMissions||[])
        };
    }
    write(data) {
        try {
            if(!this.storage || !this.valid(data))return false;
            this.storage.setItem(DriverHomeSave.KEY,JSON.stringify(data));
            return true;
        }catch(e){return false;}
    }
    valid(data) {
        return !!data && data.version===DriverHomeSave.VERSION &&
            DriverHomeSave.CITIES.includes(data.city) &&
            DriverHomeSave.TYPES.includes(data.mission?.type) &&
            Array.isArray(data.vehicles) && data.vehicles.length>=1 &&
            data.vehicles.length<=32 && typeof data.tanner?.x==='number' &&
            typeof data.tanner?.z==='number' &&
            Number.isFinite(data.tanner.x) && Number.isFinite(data.tanner.z) &&
            (data.interior==null||['home','warehouse','diner','garage'].includes(data.interior));
    }
    read() {
        try {
            const raw=this.storage?.getItem(DriverHomeSave.KEY);
            if(!raw || raw.length>60000)return null;
            const data=JSON.parse(raw);
            return this.valid(data)?data:null;
        }catch(e){return null;}
    }
    restore(game,data) {
        if(!this.valid(data))return false;
        if (game.currentCityKey!==data.city) {
            // Evita que a missão atual force Chicago durante a troca de cidade.
            game.missionType='freeroam';
            game.changeCity(data.city);
        }
        game.startMission(data.mission.type);
        // Restaura a frota dinâmica ANTES de aplicar posições persistidas.
        // Do contrário os carros adicionais não recebem o estado salvo.
        if(data.leaving&&game.missionType==='story_leaving'&&game.leavingDirector)
            game.leavingDirector.restore(data.leaving);
        if(data.havanaLead&&game.missionType==='story_havana_lead'&&
            game.havanaLeadDirector)
            game.havanaLeadDirector.restore(data.havanaLead,game.targetCar);
        if(data.caine && game.missionType==='story_caine' && game.caineDirector){
            game.caineDirector.restore(data.caine);
            game.city.caineBridgeClosed=game.caineDirector.bridgeClosed;
            game.city.bridgeRaised=game.caineDirector.bridgeClosing;
            if(game.caineDirector.vansActivated &&
                typeof game.activateCaineVans==='function')
                game.activateCaineVans();
        }
        for(let i=0;i<Math.min(data.vehicles.length,game.vehicles.length);i++){
            const car=game.vehicles[i],raw=data.vehicles[i];
            const safe=DriverHomeSave.position(raw);
            Object.assign(car,safe);
            car.speed=safe.speed;
            car.breakawayFlags={...safe.breakawayFlags};
            car.prevX=car.x;car.prevZ=car.z;
            car.lateralVelocity=0;
            if(typeof car.updateTransform==='function')car.updateTransform();
        }
        const index=Math.floor(DriverHomeSave.bounded(data.playerIndex,0,game.vehicles.length-1));
        game.playerCar=game.vehicles[index] || game.vehicles[0];
        game.felony=DriverHomeSave.bounded(data.felony,0,100);
        if (data.secretGateOpen)game.city.unlockSecretGate();
        game.missionTimeLeft=DriverHomeSave.bounded(data.mission.timeLeft,0,9999);
        game.survivalElapsed=DriverHomeSave.bounded(data.mission.survivalElapsed,0,99999);
        game.tailOutOfRangeTimer=DriverHomeSave.bounded(data.mission.tailOutOfRangeTimer,0,300);
        game.witnessCloseTime=DriverHomeSave.bounded(data.mission.witnessCloseTime,0,300);
        game.evidencePhase=data.mission.evidencePhase||0;
        if(data.mission.pursuitPhase!=null){
            game.pursuitChapter.phase=DriverHomeSave.bounded(data.mission.pursuitPhase,0,2);
            game.pursuitChapter.elapsed=DriverHomeSave.bounded(data.mission.pursuitElapsed,0,24);
        }
        if(data.intruder && game.missionType==='story_intruder' &&
            game.intruderDirector){
            game.intruderDirector.restore(data.intruder,game.targetCar);
            if(data.intruder.blockadeShown &&
                typeof game.spawnIntruderBlocker==='function')
                game.spawnIntruderBlocker();
        }
        if(data.safeEscape && game.missionType==='story_safehouse' &&
            game.safeHouseEscape)game.safeHouseEscape.restore(data.safeEscape);
        if(data.drop && game.missionType==='story_drop' &&
            game.targetCar?.scriptedDrive && game.dropDirector){
            const director=game.dropDirector,route=game.targetCar.scriptedDrive;
            route.index=Math.floor(DriverHomeSave.bounded(
                data.drop.routeIndex,0,route.waypoints.length));
            route.done=!!data.drop.done;
            director.suspicion=DriverHomeSave.bounded(data.drop.suspicion,0,100);
            director.lost=DriverHomeSave.bounded(data.drop.lost,0,100);
            director.safeSeconds=DriverHomeSave.bounded(data.drop.safeSeconds,0,999);
        }
        if(data.train&&game.missionType==='story_train'&&game.trainLine){
            const train=game.trainLine;
            train.elapsed=DriverHomeSave.bounded(data.train.elapsed,0,120);
            train.group.position.z=DriverHomeSave.bounded(
                data.train.position,DriverChicagoTrain.STOP_Z,DriverChicagoTrain.START_Z,
                DriverChicagoTrain.START_Z
            );
            train.arrived=train.group.position.z<=DriverChicagoTrain.STOP_Z;
            game.trainLostSeconds=DriverHomeSave.bounded(data.train.lost,0,6);
        }
        if(data.mission.c4&&game.c4State?.active){
            game.c4State.planted=!!data.mission.c4.planted;
            game.c4State.timer=DriverHomeSave.bounded(data.mission.c4.timer,0,15);
        }
        const checkpoint=data.mission.markers||[];
        game.missionMarkers.forEach((marker,i)=>{
            marker.collected=checkpoint[i]===true;
            marker.mesh.visible=!marker.collected;
        });
        game.markersCollected=game.missionMarkers.filter(m=>m.collected).length;
        DriverCheckpointRoute.refresh(game.missionType,game.missionMarkers);
        game.completedMissions=new Set(
            (Array.isArray(data.completed)?data.completed:[])
            .filter(t=>DriverHomeSave.TYPES.includes(t)).slice(0,40)
        );
        if(game.chapterProgress){
            if(game.completedMissions.has('story_leaving') ||
                game.completedMissions.has('story_havana_lead'))
                game.chapterProgress.unlockHavana();
            if(game.completedMissions.has('story_havana_lead'))
                game.chapterProgress.completeHavanaLead();
            if(typeof game.updateChapterMenu==='function')game.updateChapterMenu();
        }
        game.mode=data.mode==='on_foot'?'on_foot':'driving';
        const t=data.tanner||{};
        game.tanner.setPosition(
            DriverHomeSave.bounded(t.x,-1500,1500),
            DriverHomeSave.bounded(t.y,0,150),
            DriverHomeSave.bounded(t.z,-500,500),
            DriverHomeSave.bounded(t.heading,-30,30)
        );
        game.tanner.setVisible(game.mode==='on_foot');
        game.interiorPlace=data.interior && game.mode==='on_foot' ?
            (game.city.interiors.find(p=>p.id===data.interior)||null):null;
        game.setWeather(data.weather||'day');
        game.cameraRig.lastMode=-1;
        game.cameraRig.focus=null;
        game.gameEnded=false;
        return true;
    }
}
