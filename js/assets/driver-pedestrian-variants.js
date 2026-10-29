/** User-uploaded civilians. Reuse existing slots/AI and cache one rig per model. */
class DriverPedestrianVariants {
    static DEFINITIONS=[
        {id:'mendigo',url:'./assets/pedestrians/mendingo.glb',pedestrianIndex:2,height:2.04,walkName:'Walking',textureMaxSize:1024},
        {id:'woman-2',url:'./assets/pedestrians/mulher%202.glb',pedestrianIndex:3,height:2.05,walkName:'Walking_Woman',textureMaxSize:1024},
        {id:'woman-3',url:'./assets/pedestrians/mulher%203.glb',pedestrianIndex:4,height:2.05,walkName:'Walking_Woman',textureMaxSize:1024,repairSkinDeformation:true}
    ];
    constructor(manager){
        this.models=DriverPedestrianVariants.DEFINITIONS.map(config=>new DriverMalePedestrian(manager,{...config,tag:'glbVariant'}));
        this.promise=null;
    }
    release(){for(const model of this.models)model.release();}
    attach(){for(const model of this.models)model.attachToPedestrian();}
    load(){
        if(!this.promise)this.promise=(async()=>{
            // Parse/upload one large GLB at a time. Gameplay keeps its fallback.
            for(const model of this.models){
                try{await model.load();}catch(error){model.state='error';model.error=String(error?.message||error);}
            }
            return this.models.every(model=>model.state==='ready');
        })();
        return this.promise;
    }
    update(ped,dt,moving,crossing){for(const model of this.models)model.update(ped,dt,moving,crossing);}
    status(){return this.models.map(model=>model.status());}
}
