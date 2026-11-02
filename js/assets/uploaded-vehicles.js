/** Uploaded GLBs: cached local models; physics/mission fleet stays independent. */
class DriverUploadedVehicles {
    static DEFINITIONS={
        'pickup-new':{url:'./assets/vehicles/caminhonete-nova-otimizada.glb',name:'CAMINHONETE NOVA',bodyStyle:'truck'},
        'pickup-old':{url:'./assets/vehicles/caminhonete%20velha.glb',name:'CAMINHONETE ANTIGA',bodyStyle:'truck'},
        // GLB de 23 MB adicionado ao repositório em 02/11. Usado somente nos
        // furgões de entrega, reutilizando malha/texturas entre os clones.
        'cargo-van':{url:'./assets/vehicles/Van_Rustica_Otimizada_23MB.glb',name:'FURGÃO DE ENTREGAS',bodyStyle:'truck'},
        motorcycle:{url:'./assets/vehicles/moto-otimizada.glb',name:'MOTO',bodyStyle:'motorcycle'},
        // Esse ônibus substitui o ônibus civil já existente, não cria outro.
        'school-bus':{url:'./assets/vehicles/onibus%20escolar.glb',
            name:'ÔNIBUS ESCOLAR',bodyStyle:'bus'},
        boat:{url:'./assets/barco%20de%20pesca.glb'}
    };
    constructor(engine,library){
        this.engine=engine;this.library=library;this.cache=new Map();
        this.queue=Promise.resolve();this.states={};this.boat=null;
    }
    // Veículos enviados pelo usuário participam do tráfego normal.
    // Cada ponto é uma faixa da grade existente (±4 do eixo da rua),
    // não uma vaga de estacionamento. Alternativas evitam água/obstáculos.
    static TRAFFIC_SPECS=[
        {id:'pickup-new',color:0x65746d,maxSpeed:44,accel:24,
            slots:[{x:4,z:-60,heading:0},{x:4,z:92,heading:0},
                {x:84,z:28,heading:0},{x:-44,z:4,heading:-Math.PI/2}]},
        {id:'pickup-old',color:0x8b7355,maxSpeed:42,accel:22,
            slots:[{x:84,z:-60,heading:0},{x:-84,z:-195,heading:0},
                {x:164,z:-4,heading:Math.PI/2},{x:-4,z:195,heading:Math.PI}]},
        {id:'cargo-van',color:0x807565,maxSpeed:38,accel:20,
            slots:[{x:-84,z:-54,heading:0},{x:84,z:32,heading:0},
                {x:-164,z:4,heading:-Math.PI/2},{x:4,z:175,heading:0}]},
        {id:'motorcycle',color:0x64748b,maxSpeed:48,accel:29,
            slots:[{x:-44,z:-84,heading:Math.PI/2},{x:36,z:76,heading:Math.PI/2},
                {x:-4,z:195,heading:Math.PI},{x:164,z:-4,heading:Math.PI/2}]}
    ];
    static isTrafficLaneOpen(engine,spec,position){
        const city=engine.city;
        const radius=spec.id==='motorcycle'?1.1:1.55;
        const {x,z,heading}=position;
        if(!Number.isFinite(x)||!Number.isFinite(z)||
            !Number.isFinite(heading))return false;
        if(city.isWaterAt(x,z)||city.isPointBlocked(x,z,radius))return false;
        // Certificar também o trecho inicial adiante das rodas: uma vaga seca
        // isolada não significa que a IA consiga sair para a avenida.
        if(typeof DriverRoadGeometry!=='undefined'){
            const ahead=18;
            if(!DriverRoadGeometry.segmentDrivable(city,x,z,
                x+Math.sin(heading)*ahead,z+Math.cos(heading)*ahead,
                radius))return false;
        }
        const separation=spec.id==='motorcycle'?9:12;
        return !engine.vehicles.some(v=>
            Math.hypot((v.x??Infinity)-x,(v.z??Infinity)-z)<separation);
    }
    static spawn(engine){
        const added=[];
        for(const spec of this.TRAFFIC_SPECS){
            const definition=this.DEFINITIONS[spec.id];
            if(engine.vehicles.some(v=>v.uploadedModel===spec.id))continue;
            const position=spec.slots.find(slot=>
                this.isTrafficLaneOpen(engine,spec,slot));
            if(!position)continue; // Nunca spawnar em água ou sobre um prédio.
            const vehicle=new DriverVehicle(engine.scene,{
                name:definition.name,bodyStyle:definition.bodyStyle,
                uploadedModel:spec.id,color:spec.color,
                x:position.x,z:position.z,heading:position.heading,
                maxSpeed:spec.maxSpeed,accel:spec.accel
            });
            vehicle.uploadedTraffic=true;
            vehicle.missionParked=false;
            engine.vehicles.push(vehicle);
            added.push(vehicle);
        }
        return added;
    }
    static updateRiders(engine){
        for(const vehicle of engine.vehicles){
            const rider=vehicle.motorcycleRider;
            if(!rider)continue;
            const transition=engine.vehicleMountTransition;
            if(engine.tanner?.motorcycleVehicle===vehicle){
                // O mesmo GLB Tanner está conectado à moto: nunca sobrepor
                // o boneco procedural, que permanece só como fallback.
                rider.visible=false;
                if(!transition)engine.tanner.updateMotorcycleRidePose?.(
                    Math.max(0,Math.min(.08,engine._riderDelta||0)));
            }else if(transition?.vehicle===vehicle&&transition.bike){
                // O GLB real continua visível até o último quadro da
                // montagem. O proxy só entra quando o GLB não carregou.
                rider.visible=transition.kind==='enter'?
                    (!engine.tanner?.vehicleBoneRig&&transition.progress>=.83):
                    transition.progress<.16;
            }else{
                rider.visible=engine.mode==='driving'&&engine.playerCar===vehicle;
            }
            if(rider.visible){
                rider.rotation.z=Math.max(-.12,Math.min(.12,
                    -(vehicle.rollAngle||0)*.20));
                rider.rotation.x=Math.max(-.10,Math.min(.10,
                    Math.abs(vehicle.speed||0)*-.0018));
            }else{
                rider.rotation.x=0;rider.rotation.z=0;
            }
        }
    }
    static resizeTextures(root){
        const replacements=new Map();
        root.traverse(node=>{
            for(const mat of (Array.isArray(node.material)?node.material:[node.material]).filter(Boolean)){
                for(const key of Object.keys(mat)){
                    const tex=mat[key],img=tex?.image;
                    if(!tex?.isTexture||!img||Math.max(img.width||0,img.height||0)<=1024)continue;
                    if(!replacements.has(tex)){
                        const ratio=1024/Math.max(img.width,img.height),canvas=document.createElement('canvas');
                        canvas.width=Math.max(1,Math.round(img.width*ratio));canvas.height=Math.max(1,Math.round(img.height*ratio));
                        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
                        const resized=tex.clone();resized.image=canvas;resized.needsUpdate=true;replacements.set(tex,resized);
                    }
                    mat[key]=replacements.get(tex);mat.needsUpdate=true;
                }
            }
        });
        for(const tex of replacements.keys())tex.dispose();
    }
    getTemplate(id){
        if(!this.cache.has(id)){
            const definition=DriverUploadedVehicles.DEFINITIONS[id];
            if(!definition)return Promise.resolve(null);
            const task=this.queue.then(()=>new Promise(resolve=>{
                this.states[id]='loading';
                if(!THREE.GLTFLoader){this.states[id]='unsupported';resolve(null);return;}
                const fail=()=>{this.states[id]='missing';resolve(null);};
                try{new THREE.GLTFLoader().load(definition.url,gltf=>{
                    try{
                        const root=gltf.scene;if(!root)return fail();
                        DriverUploadedVehicles.resizeTextures(root);
                        this.states[id]='ready';resolve(root);
                    }catch(_){fail();}
                },undefined,fail);}catch(_){fail();}
            }));
            const retryable=task.then(template=>{
                if(!template)this.cache.delete(id);
                return template;
            });
            this.cache.set(id,retryable);
            this.queue=retryable.then(()=>undefined,()=>undefined);
        }
        return this.cache.get(id);
    }
    decorate(vehicle, forcedId=null){
        const id=forcedId||vehicle.uploadedModel;
        if(!id || vehicle._uploadedCustomModel===id)return;
        this.getTemplate(id).then(template=>{
            if(!this.library.enabled||!this.engine.vehicles.includes(vehicle)||
                !vehicle.root.parent||vehicle._userCustomModel||vehicle._uploadedCustomModel===id||
                vehicle._cc0ModelApplied)return;
            if(!template){
                this.library.decorateRepositoryFallback?.(vehicle,id);
                return;
            }
            const wrapped=new THREE.Group(),clone=template.clone(true);
            // No GLB de veículos, o comprimento vem no eixo X.
            // +90° alinha o comprimento ao eixo Z da física do Driver 2.
            clone.rotation.y=Math.PI/2;wrapped.add(clone);wrapped.updateMatrixWorld(true);
            vehicle._userCustomModel=false;
            vehicle._repositoryModelPending=id;
            const applied=vehicle.applyCC0Model(wrapped,true)!==false;
            vehicle._repositoryModelPending=null;
            if(!applied){
                this.library.decorateRepositoryFallback?.(vehicle,id);
                return;
            }
            vehicle._userCustomModel=true;
            vehicle._uploadedCustomModel=id;
            vehicle._repositoryModelId=id;
            vehicle._modelLoadFailed=false;
            // Unified uploads have no individually addressable wheels or doors.
            // Keep the original mesh; do not invent four wheel pivots on the bike.
            DriverUploadedVehicles.updateRiders(this.engine);this.library.updateStatus();
        });
    }
    attachBoat(){
        const city=this.engine.city;
        if(city?.preset?.id!=='chicago')return;
        this.getTemplate('boat').then(template=>{
            if(!template||!this.library.enabled||this.engine.city!==city||city.preset?.id!=='chicago'||!city.cityGroup?.parent)return;
            if(this.boat?.parent===city.cityGroup){this.boat.visible=true;return;}
            const root=new THREE.Group(),model=template.clone(true);root.add(model);
            model.rotation.y=Math.PI/2;root.updateMatrixWorld(true);
            const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
            if(!Number.isFinite(size.z)||size.z<.01)return;
            const scale=11/size.z;model.scale.setScalar(scale);
            model.position.set(-(box.min.x+box.max.x)*.5*scale,-box.min.y*scale-.35,
                -(box.min.z+box.max.z)*.5*scale);
            root.position.set(390,.08,-64);root.name='uploaded-fishing-boat';
            root.userData.cc0SharedAsset=true;city.cityGroup.add(root);this.boat=root;
        });
    }
}
