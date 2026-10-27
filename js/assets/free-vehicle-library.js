
/**
 * Assets 3D opcionais CC0, provenientes do Kenney Car Kit.
 * Cache único de glTF por tipo, com fallback integral para os carros procedurais.
 * Esta biblioteca não altera o modelo da física nem depende de um build JS.
 */
class FreeVehicleAssets {
    constructor(engine) {
        this.engine = engine;
        this.enabled = true;
        this.cache = new Map();
        this.baseUrl = 'https://cdn.jsdelivr.net/gh/Hidencod/tge-assets@7be9b573bc74f32ed766b44b3f46550d02ca83b5/packs/car-kit/';
        this.failed = new Set();
        this.userTemplate=null;
        this.userPromise=null;
        this.userModelSource='pending';
        this.userModelError='';
        this.importedCount=0;
        this.userModelUrl='./assets/vehicles/carro_driver2_otimizado.glb';
        this.policeModelUrl='./assets/vehicles/car%20police.glb';
        this.policeTemplate=null;
        this.policePromise=null;
        this.policeStatus='pending';
        this.updateButton();
    }

    getModelName(vehicle) {
        if (vehicle.isPolice) return 'police.glb';
        if (vehicle.isSecret) return 'race.glb';
        if (vehicle === this.engine.playerCar) return 'sedan-sports.glb';
        if (vehicle.bodyStyle === 'truck') return 'truck.glb';
        // Os modelos especiais de ônibus e limusine continuam procedurais.
        if (vehicle.bodyStyle === 'bus' || vehicle.bodyStyle === 'limo') return null;
        if (vehicle.name.includes('COUPE')) return 'hatchback-sports.glb';
        return 'sedan.glb';
    }

    getScene(filename) {
        if (!this.cache.has(filename)) {
            this.cache.set(filename, new Promise(resolve => {
                if (!THREE.GLTFLoader) {
                    this.failed.add(filename);
                    resolve(null);
                    return;
                }
                const loader = new THREE.GLTFLoader();
                loader.load(this.baseUrl + filename,
                    gltf => resolve(gltf.scene),
                    undefined,
                    () => {
                        this.failed.add(filename);
                        resolve(null);
                    }
                );
            }));
        }
        return this.cache.get(filename);
    }

    getPoliceTemplate(){
        if(this.policeTemplate)return Promise.resolve(this.policeTemplate);
        if(!this.policePromise){
            this.policePromise=new Promise(resolve=>{
                if(!THREE.GLTFLoader){resolve(null);return}
                try{
                    new THREE.GLTFLoader().load(this.policeModelUrl,
                        gltf=>resolve(gltf?.scene||null),undefined,
                        ()=>resolve(null));
                }catch(_){resolve(null)}
            }).then(scene=>{
                if(scene){this.policeTemplate=scene;this.policeStatus='github'}
                else{
                    this.policeStatus='missing';
                    this.policePromise=null;
                }
                return scene;
            });
        }
        return this.policePromise;
    }

    applyPoliceModel(vehicle,template){
        if(!this.enabled || !vehicle?.isPolice ||
            !this.engine.vehicles.includes(vehicle)||
            !vehicle.root?.parent||!template)return false;
        const clone=template.clone(true),wrapped=new THREE.Group();
        // Mesma correção de orientação do carro GLB pessoal.
        // Frente do arquivo aponta para -X e chassi avança para +Z.
        clone.rotation.y=Math.PI/2;
        wrapped.add(clone);
        wrapped.updateMatrixWorld(true);
        vehicle._userCustomModel=false;
        if(vehicle.applyCC0Model(wrapped,true)===false)return false;
        vehicle._userCustomModel=true;
        vehicle._policeCustomModel=true;
        // Porta do motorista em pivô real; o GLB original também pode
        // ser separado automaticamente no navegador.
        if(typeof DriverPoliceDoorRig!=='undefined')
            DriverPoliceDoorRig.mount(vehicle,wrapped);
        if(typeof DriverVehicleWheelRig!=='undefined')
            vehicle.wheelRig=DriverVehicleWheelRig.mount(vehicle,wrapped);
        this.updateStatus();
        return true;
    }

    canUseDriver2Model(vehicle){
        return vehicle && vehicle.bodyStyle==='muscle' &&
            !vehicle.isPolice && !vehicle.isSecret && !vehicle.isTarget;
    }

    static openStore(){
        return new Promise(resolve=>{
            if(typeof indexedDB==='undefined')return resolve(null);
            let req;
            try{req=indexedDB.open('driver2-car-import-v1',1)}
            catch(_){return resolve(null)}
            req.onupgradeneeded=()=>{
                if(!req.result.objectStoreNames.contains('vehicles'))
                    req.result.createObjectStore('vehicles');
            };
            req.onsuccess=()=>resolve(req.result);
            req.onerror=()=>resolve(null);
            req.onblocked=()=>resolve(null);
        });
    }

    static async storedBytes(){
        const db=await this.openStore();
        if(!db)return null;
        return new Promise(resolve=>{
            try {
                const tx=db.transaction('vehicles','readonly');
                const req=tx.objectStore('vehicles').get('driver2');
                req.onsuccess=async()=>{
                    try{
                        const blob=req.result;
                        resolve(blob && typeof blob.arrayBuffer==='function'?
                            await blob.arrayBuffer():null);
                    }catch(_){resolve(null)}
                };
                req.onerror=()=>resolve(null);
                tx.oncomplete=()=>db.close();
                tx.onerror=()=>{db.close();resolve(null)};
            } catch(_) {db.close();resolve(null)}
        });
    }
    static async persist(file){
        const db=await this.openStore();
        if(!db)return false;
        return new Promise(resolve=>{
            try{
                const tx=db.transaction('vehicles','readwrite');
                tx.objectStore('vehicles').put(file,'driver2');
                tx.oncomplete=()=>{db.close();resolve(true)};
                tx.onerror=()=>{db.close();resolve(false)};
            }catch(_){db.close();resolve(false)}
        });
    }

    static parseGLB(buffer){
        return new Promise(resolve=>{
            if(!THREE.GLTFLoader)return resolve(null);
            try{
                new THREE.GLTFLoader().parse(buffer,'',
                    gltf=>resolve(gltf?.scene||null),()=>resolve(null));
            }catch(_){resolve(null)}
        });
    }

    getUserTemplate(){
        if(this.userTemplate)return Promise.resolve(this.userTemplate);
        if(!this.userPromise){
            // O GLB que agora integra o GitHub tem prioridade sobre
            // importações antigas persistidas no navegador.
            this.userPromise=(async()=>{
                let model=null;
                if(THREE.GLTFLoader){
                    model=await new Promise(resolve=>{
                        try{
                            const loader=new THREE.GLTFLoader();
                            loader.load(this.userModelUrl,
                                gltf=>resolve(gltf?.scene||null),
                                undefined,()=>resolve(null));
                        }catch(_){resolve(null)}
                    });
                }
                if(model){
                    this.userTemplate=model;
                    this.userModelSource='github';
                    this.userModelError='';
                    return model;
                }
                // Um modelo carregado pelo usuário anteriormente ainda
                // pode funcionar offline se o GitHub não responder.
                const stored=await FreeVehicleAssets.storedBytes();
                if(stored)model=await FreeVehicleAssets.parseGLB(stored);
                if(model){
                    this.userTemplate=model;
                    this.userModelSource='local';
                    this.userModelError='';
                    return model;
                }
                this.userModelSource='unavailable';
                this.userModelError='GLB nao carregou do GitHub nem do armazenamento local';
                return null;
            })().then(model=>{
                // Um erro transitório não pode envenenar o cache para
                // toda a sessão; a próxima tentativa poderá recuperar.
                if(!model)this.userPromise=null;
                return model;
            }).catch(()=>{
                this.userModelSource='unavailable';
                this.userModelError='Erro inesperado ao processar o GLB';
                this.userPromise=null;
                return null;
            });
        }
        return this.userPromise;
    }

    async importUserCar(file){
        if(!file || !/\.glb$/i.test(file.name||'') ||
            file.size>12*1024*1024 || file.size<100)return false;
        const data=await file.arrayBuffer();
        const model=await FreeVehicleAssets.parseGLB(data);
        if(!model)return false;
        this.userTemplate=model;
        this.userPromise=Promise.resolve(model);
        this.userModelSource='imported';
        this.userModelError='';
        this.enabled=true;
        await FreeVehicleAssets.persist(file);
        // Reimportação substitui inclusive carros que já receberam GLB,
        // sem duplicar a carroceria no chassi.
        for(const car of this.engine.vehicles)
            if(car._userCustomModel)car._userCustomModel=false;
        this.updateButton();
        this.decorateFleet();
        this.updateStatus();
        return true;
    }

    applyDriver2Model(vehicle,template){
        if(!this.enabled || !this.engine.vehicles.includes(vehicle) ||
            !vehicle.root.parent || !template)return false;
        const wrapped=new THREE.Group();
        const clone=template.clone(true);
        // O GLB usa X como eixo longitudinal e a frente aponta para -X.
        // +90° traz o para-choque dianteiro para +Z (frente física do jogo).
        // Não alterar heading, controle, velocidade ou sistema de colisão.
        clone.rotation.y=Math.PI/2;
        wrapped.add(clone);
        wrapped.updateMatrixWorld(true);
        DriverUserCarPaint.prepare(wrapped,vehicle.color);
        vehicle._userCustomModel=false;
        const applied=vehicle.applyCC0Model(wrapped,true);
        if(applied===false)return false;
        vehicle._userCustomModel=true;
        if(typeof DriverPoliceDoorRig!=='undefined')
            DriverPoliceDoorRig.mount(vehicle,wrapped);
        if(typeof DriverVehicleWheelRig!=='undefined')
            vehicle.wheelRig=DriverVehicleWheelRig.mount(vehicle,wrapped);
        this.importedCount++;
        return true;
    }

    decorateFleet() {
        if (!this.enabled) return;
        this.engine.vehicles.forEach(vehicle=>{
            if(this.canUseDriver2Model(vehicle)){
                this.getUserTemplate().then(template=>{
                    if(template && this.enabled){
                        if(!vehicle._userCustomModel &&
                            this.applyDriver2Model(vehicle,template))
                            this.updateStatus();
                    }else this.decorateStandard(vehicle);
                });
            } else if(vehicle.isPolice){
                this.getPoliceTemplate().then(template=>{
                    if(template&&this.enabled &&
                        this.engine.vehicles.includes(vehicle)&&
                        !vehicle._policeCustomModel){
                        this.applyPoliceModel(vehicle,template);
                    }else if(!template)this.decorateStandard(vehicle);
                });
            } else this.decorateStandard(vehicle);
        });
    }

    decorateStandard(vehicle){
        if(vehicle._userCustomModel || vehicle._cc0ModelApplied ||
            vehicle._policeCustomModel || !this.enabled)return;
        const filename=this.getModelName(vehicle);
        if(!filename)return;
        this.getScene(filename).then(template=>{
            if(!template || !this.enabled || vehicle._userCustomModel ||
                !this.engine.vehicles.includes(vehicle) || !vehicle.root.parent)return;
            const scene=template.clone(true);
            if(vehicle.applyCC0Model(scene)!==false &&
                typeof DriverVehicleWheelRig!=='undefined')
                vehicle.wheelRig=DriverVehicleWheelRig.mount(vehicle,scene);
            this.updateStatus();
        });
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            this.decorateFleet();
        } else {
            this.engine.vehicles.forEach(v => {
                if (v._cc0ModelApplied){
                    if(v.isPolice){
                        if(typeof DriverPoliceDoorRig!=='undefined')
                            DriverPoliceDoorRig.cancel(v);
                        v.policeDoorRig=null;
                        v._policeCustomModel=false;
                        v._userCustomModel=false;
                    }
                    v.buildCarMesh();
                }
            });
        }
        this.updateButton();
        this.updateStatus();
    }

    updateButton() {
        const button = document.getElementById('btn-free-assets');
        if (!button) return;
        button.textContent = this.enabled ? '🚘 3D CC0' : '🚘 PS1';
        button.title = this.enabled ?
            'Modelos 3D gratuitos Kenney CC0 ativos (M para alternar)' :
            'Malhas clássicas procedurais ativas (M para alternar)';
        button.setAttribute('aria-pressed', this.enabled ? 'true' : 'false');
    }

    updateStatus() {
        const el = document.getElementById('asset-loader-status');
        if (!el) return;
        const count = this.engine.vehicles.filter(v => v._cc0ModelApplied).length;
        const custom=this.engine.vehicles.filter(v=>v._userCustomModel).length;
        el.textContent = this.enabled ?
            (custom>0?'Carro Driver 2 GLB ('+this.userModelSource+
                '): '+custom+' veículos com pintura individual. ':
                this.userModelSource==='unavailable'?
                'GLB não disponível; carros alternativos ativos. ':
                'Preparando carro_driver2_otimizado.glb… ')+
            'Modelos 3D ativos: '+count+
            (this.policeStatus==='github'?
                ' • Viaturas GLB do usuário'+
                (this.engine.vehicles.some(v=>v.policeDoorRig)?
                    ' com portas móveis':'')+'.':
                this.policeStatus==='missing'?
                ' • car police.glb ausente: viaturas alternativas.':'')+
            (this.failed.size?' • Alguns externos indisponíveis.':'') :
            'Malhas PS1 procedurais ativas. Pressione M para ativar 3D.';
    }
}
