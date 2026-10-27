/**
 * Driver 2 — Chicago 05: Escape to the Safe House.
 * A missão depende de despistar a polícia e chegar à entrada existente
 * do esconderijo, sem teleportes ou checkpoints obrigatórios.
 * Os limiares são adaptados para a escala procedural do mapa.
 */
class DriverSafeHouseEscape {
    static MAX_FELONY = 32;
    static LOST_SIGHT_SECONDS = 5.5;
    static ARRIVAL_RADIUS = 7.8;
    constructor(){this.reset();}
    reset(){
        this.hiddenSeconds=0;
        this.phase='escape';
        this.safeToArrive=false;
        this.lastDistance=Infinity;
    }
    static policeHasSight(vehicles, playerPos, lineOfSight, radius=95) {
        if(!playerPos || !Array.isArray(vehicles))return false;
        return vehicles.some(car=>{
            if(!car?.isPolice || car===playerPos)return false;
            if(Math.hypot(car.x-playerPos.x,car.z-playerPos.z)>radius)return false;
            return typeof lineOfSight==='function' ?
                !!lineOfSight(car,playerPos) : true;
        });
    }
    update(dt,state){
        const step=Math.max(0,Math.min(0.05,Number(dt)||0));
        const pos=state?.position||null;
        const home=state?.safeHouseZone||null;
        const distance=pos&&home?Math.hypot(pos.x-home.x,pos.z-home.z):Infinity;
        const policeWatching=!!state?.policeWatching;
        const felony=Math.max(0,Number(state?.felony)||0);
        const clear=(!policeWatching && felony<DriverSafeHouseEscape.MAX_FELONY);
        if(policeWatching){
            this.hiddenSeconds=0;
        }else if(clear){
            this.hiddenSeconds=Math.min(DriverSafeHouseEscape.LOST_SIGHT_SECONDS,
                this.hiddenSeconds+step);
            // Normaliza o limite para não guardar 5.49999999 no save.
            if(this.hiddenSeconds>=DriverSafeHouseEscape.LOST_SIGHT_SECONDS-1e-6)
                this.hiddenSeconds=DriverSafeHouseEscape.LOST_SIGHT_SECONDS;
        }else{
            this.hiddenSeconds=Math.max(0,this.hiddenSeconds-step*0.5);
        }
        this.safeToArrive=clear &&
            this.hiddenSeconds>=DriverSafeHouseEscape.LOST_SIGHT_SECONDS-1e-6;
        const previous=this.phase;
        this.phase=this.safeToArrive?'reach_home':'escape';
        this.lastDistance=distance;
        const atHome=distance<=Math.max(
            DriverSafeHouseEscape.ARRIVAL_RADIUS,home?.radius||0
        );
        const stopped=state?.mode==='driving' &&
            Math.abs(Number(state?.speed)||0)<7;
        // Também aceita entrar a pé na casa após despistar as viaturas.
        const entered=state?.mode==='on_foot' && state?.interiorId==='home';
        const completed=this.safeToArrive &&
            ((atHome&&stopped)||entered);
        const label=this.phase==='escape' ?
            (policeWatching?'POLÍCIA NO ENCALÇO • QUEBRE A VISÃO':
             felony>=DriverSafeHouseEscape.MAX_FELONY?
             'DESPISTE A POLÍCIA • DELITO '+Math.round(felony)+'%':
             'SEM CONTATO • '+Math.ceil(
                DriverSafeHouseEscape.LOST_SIGHT_SECONDS-this.hiddenSeconds
             )+'s PARA ESCAPAR') :
            'ROTA LIBERADA • CASA SEGURA A '+Math.round(distance)+'m';
        return {
            phase:this.phase,changed:previous!==this.phase,
            hiddenSeconds:this.hiddenSeconds,
            distance,policeWatching,felony,
            completed,atHome,
            label
        };
    }
    export(){
        return {phase:this.phase,hiddenSeconds:this.hiddenSeconds};
    }
    restore(data){
        this.hiddenSeconds=Math.min(DriverSafeHouseEscape.LOST_SIGHT_SECONDS,
            Math.max(0,Number.isFinite(data?.hiddenSeconds)?data.hiddenSeconds:0));
        this.phase=data?.phase==='reach_home'?'reach_home':'escape';
        this.safeToArrive=this.phase==='reach_home';
    }
}
