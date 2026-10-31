/** GLBs do criador do jogo, sem substitutos procedurais.
 * Vagas 0 e 1 pertencem aos modelos originais; as demais usam esta lista.
 * A altura é medida automaticamente pelo bounding box e normalizada em metros.
 */
class DriverPedestrianVariants {
    static DEFINITIONS=[
        {id:'mendigo',url:'./assets/pedestrians/mendingo.glb',pedestrianIndex:2,height:2.04,walkName:'Walking',textureMaxSize:1024},
        {id:'woman-2',url:'./assets/pedestrians/mulher%202.glb',pedestrianIndex:3,height:2.05,walkName:'Walking_Woman',textureMaxSize:1024},
        {id:'woman-3',url:'./assets/pedestrians/mulher%203.glb',pedestrianIndex:4,height:2.05,walkName:'Walking_Woman',textureMaxSize:1024,repairSkinDeformation:true},
        // Crianças realmente menores, mantendo o rig/animações de cada GLB.
        {id:'girl',url:'./assets/pedestrians/menina.glb',pedestrianIndex:5,height:1.27,species:'child',walkSpeed:2.05,textureMaxSize:1024,allowAnyAnimation:true,allowStatic:true},
        {id:'boy',url:'./assets/pedestrians/menino.glb',pedestrianIndex:6,height:1.32,species:'child',walkSpeed:2.10,textureMaxSize:1024,allowAnyAnimation:true,allowStatic:true},
        // O pastor-alemão é maior; os dois cães restantes são menores.
        {id:'german-shepherd',url:'./assets/pedestrians/pastor%20alemao.glb',pedestrianIndex:7,height:0.87,species:'dog',walkSpeed:3.25,textureMaxSize:1024,allowAnyAnimation:true,allowStatic:true},
        {id:'dog-mailou',url:'./assets/pedestrians/mailou.glb',pedestrianIndex:8,height:0.59,species:'dog',walkSpeed:2.85,textureMaxSize:1024,allowAnyAnimation:true,allowStatic:true},
        {id:'dog-3',url:'./assets/pedestrians/cachorro%203.glb',pedestrianIndex:9,height:0.54,species:'dog',walkSpeed:2.75,textureMaxSize:1024,allowAnyAnimation:true,allowStatic:true},
        // Novos adultos/idosos, além dos cinco modelos já em uso.
        {id:'old-man',url:'./assets/pedestrians/homem%20velho.glb',pedestrianIndex:10,height:1.80,species:'adult',walkSpeed:1.95,textureMaxSize:1024,allowAnyAnimation:true,allowStatic:true},
        {id:'old-man-2',url:'./assets/velho%202.glb',pedestrianIndex:11,height:1.79,species:'adult',walkSpeed:1.95,textureMaxSize:1024,allowAnyAnimation:true,allowStatic:true},
        {id:'bald-old-man',url:'./assets/pedestrians/velho%20cauvo.glb',pedestrianIndex:12,height:1.78,species:'adult',walkSpeed:1.95,textureMaxSize:1024,allowAnyAnimation:true,allowStatic:true},
        {id:'woman-skirt',url:'./assets/pedestrians/mulher%20de%20saia.glb',pedestrianIndex:13,height:1.96,species:'adult',textureMaxSize:1024,allowAnyAnimation:true,allowStatic:true},
        {id:'woman-4',url:'./assets/pedestrians/pedestre_feminina_4_CORRIGIDA_FINAL.glb',pedestrianIndex:14,height:1.97,species:'adult',textureMaxSize:1024,allowAnyAnimation:true,allowStatic:true}
    ];
    constructor(manager){
        this.manager=manager;
        this.models=DriverPedestrianVariants.DEFINITIONS.map(config=>
            new DriverMalePedestrian(manager,{...config,tag:'glbVariant'}));
        this.promise=null;
    }
    release(){for(const model of this.models)model.release();}
    attach(){for(const model of this.models)model.attachToPedestrian();}
    load(){
        if(!this.promise)this.promise=(async()=>{
            // Modelos grandes: carregar um por vez, sem causar picos de memória.
            // Publicar cada recém-carregado imediatamente, sem esperar a fila inteira.
            for(const model of this.models){
                try{await model.load();}
                catch(error){model.state='error';model.error=String(error?.message||error);}
                finally{this.manager.uploadedCrowd?.fill();}
            }
            return this.models.every(model=>model.state==='ready');
        })();
        return this.promise;
    }
    update(ped,dt,moving,crossing){for(const model of this.models)model.update(ped,dt,moving,crossing);}
    status(){return this.models.map(model=>model.status());}
}
