/** Uploaded GLBs: cached local models; physics/mission fleet stays independent. */
class DriverUploadedVehicles {
    static DEFINITIONS={
        'pickup-new':{url:'./assets/vehicles/caminhonete-nova-otimizada.glb',name:'CAMINHONETE NOVA',bodyStyle:'truck',z:-38},
        'pickup-old':{url:'./assets/vehicles/caminhonete%20velha.glb',name:'CAMINHONETE ANTIGA',bodyStyle:'truck',z:-58},
        motorcycle:{url:'./assets/vehicles/moto-otimizada.glb',name:'MOTO',bodyStyle:'motorcycle',z:-78},
        boat:{url:'./assets/barco%20de%20pesca.glb'}
    };
    constructor(engine,library){
        this.engine=engine;this.library=library;this.cache=new Map();
        this.queue=Promise.resolve();this.states={};this.boat=null;
    }
    static spawn(engine){
        for(const [id,d] of Object.entries(this.DEFINITIONS)){
            if(id==='boat')continue;
            const x=9,z=d.z;
            if(engine.city.isWaterAt(x,z)||engine.city.isPointBlocked(x,z,1.55))continue;
            if(engine.vehicles.some(v=>Math.hypot(v.x-x,v.z-z)<9))continue;
            const vehicle=new DriverVehicle(engine.scene,{name:d.name,bodyStyle:d.bodyStyle,
                uploadedModel:id,color:0x65746d,x,z,heading:0,maxSpeed:id==='motorcycle'?48:44,accel:25});
            vehicle.missionParked=true;engine.vehicles.push(vehicle);
        }
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
                rider.visible=transition.kind==='enter'?
                    transition.progress>=.83:transition.progress<.16;
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
            this.cache.set(id,task);this.queue=task.then(()=>undefined,()=>undefined);
        }
        return this.cache.get(id);
    }
    decorate(vehicle){
        const id=vehicle.uploadedModel;
        if(vehicle._uploadedCustomModel===id)return;
        this.getTemplate(id).then(template=>{
            if(!template||!this.library.enabled||!this.engine.vehicles.includes(vehicle)||
                !vehicle.root.parent||vehicle._userCustomModel||vehicle._uploadedCustomModel===id)return;
            const wrapped=new THREE.Group(),clone=template.clone(true);
            clone.rotation.y=Math.PI/2;wrapped.add(clone);wrapped.updateMatrixWorld(true);
            vehicle._userCustomModel=false;
            if(vehicle.applyCC0Model(wrapped,true)===false)return;
            vehicle._userCustomModel=true;vehicle._uploadedCustomModel=id;
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
