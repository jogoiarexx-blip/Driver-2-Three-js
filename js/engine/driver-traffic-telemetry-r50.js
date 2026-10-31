/**
 * R50 diagnostic: low-frequency traffic and render telemetry.
 * F8 toggles the overlay; monitoring itself never changes NPC physics.
 */
class DriverTrafficTelemetryR50 {
    constructor(){
        this.vehicles=new WeakMap();
        this.elapsed=0;this.frames=0;this.slowFrames=0;
        this.frameTotal=0;this.framePeak=0;
        this.lastReport=null;this.visible=false;
        if(typeof document!=='undefined'){
            document.addEventListener('keydown',event=>{
                if(event.code!=='F8'||event.repeat)return;
                if(['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName))
                    return;
                event.preventDefault();this.toggle();
            });
        }
    }
    toggle(){
        this.visible=!this.visible;
        const panel=typeof document!=='undefined'?
            document.getElementById('d2-traffic-telemetry'):null;
        if(panel)panel.classList.toggle('hidden',!this.visible);
        return this.visible;
    }
    sample(game,dt,rawDt=dt){
        if(!game||!Number.isFinite(dt)||dt<0)return null;
        const frame=Math.max(0,Math.min(1,Number(rawDt)||dt));
        this.elapsed+=dt;this.frames++;
        this.frameTotal+=frame*1000;
        this.framePeak=Math.max(this.framePeak,frame*1000);
        if(frame>.045)this.slowFrames++;
        if(this.elapsed<1)return null;
        const vehicles=game.vehicles||[];
        const tick=Math.min(2,this.elapsed);
        let stuck=0,damageEvents=0,stationCarLift=0;
        for(const car of vehicles){
            if(!car||!Number.isFinite(car.x)||!Number.isFinite(car.z))continue;
            const before=this.vehicles.get(car)||{
                x:car.x,z:car.z,damage:car.damage||0,stalled:0
            };
            const displacement=Math.hypot(car.x-before.x,car.z-before.z);
            // Only count an NPC as stuck when its active controller
            // wants movement. Red lights, yielding, or parked mission cars
            // must not be mistaken for an AI navigation failure.
            const requested=car.chicagoMixedTrafficStatusR49?.speedLimit ??
                car.chicagoNeighborhoodTrafficStatus?.limit;
            const expectedToMove=Number.isFinite(requested)&&requested>2;
            const stalled=expectedToMove && Math.abs(car.speed||0)<1.5 &&
                displacement<.5 ?before.stalled+tick:0;
            if(stalled>=2.5)stuck++;
            if((car.damage||0)>before.damage+1.5)damageEvents++;
            if(game.city?.trainStation &&
               car.y>2&&car.y<game.city.trainStation.platform.height-2 &&
               car.x>-25&&car.x<-5&&car.z>-288&&car.z<-213)
                stationCarLift++;
            this.vehicles.set(car,{
                x:car.x,z:car.z,damage:car.damage||0,stalled
            });
        }
        const report={
            city:game.currentCityKey||'unknown',
            mode:game.missionType||'freeroam',
            vehicles:vehicles.length,
            activeNPC:vehicles.filter(v=>v!==game.playerCar&&!v.missionParked).length,
            stuck,damageEvents,stationCarLift,
            fps:Math.round(this.frames/this.elapsed),
            avgFrameMs:+(this.frameTotal/this.frames).toFixed(1),
            peakFrameMs:+this.framePeak.toFixed(1),
            slowFrames:this.slowFrames,
            r49:vehicles.filter(v=>v.chicagoMixedTrafficR49).length,
            roadsR50:!!game.city?.chicagoConnectorsR50?.ready
        };
        this.lastReport=report;
        this.elapsed=0;this.frames=0;this.frameTotal=0;
        this.framePeak=0;this.slowFrames=0;
        if(this.visible&&typeof document!=='undefined'){
            const panel=document.getElementById('d2-traffic-telemetry');
            if(panel)panel.textContent=[
                'DRIVER 2 | QA DE TRÁFEGO | F8',
                'Cidade: '+report.city+' | '+report.mode,
                'FPS: '+report.fps+' | média: '+report.avgFrameMs+
                    ' ms | pico: '+report.peakFrameMs+' ms',
                'Quadros >45ms: '+report.slowFrames,
                'Veículos: '+report.vehicles+' | NPCs: '+report.activeNPC,
                'Rotas R49: '+report.r49+' | presos >2.5s: '+report.stuck,
                'Dano novo (carros): '+report.damageEvents,
                'Carros suspensos na estação: '+report.stationCarLift,
                'Rede norte R50: '+(report.roadsR50?'sim':'não')
            ].join('\n');
        }
        return report;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverTrafficTelemetryR50;
