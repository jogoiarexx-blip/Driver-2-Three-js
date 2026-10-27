
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
        this.importedCount=0;
        this.userModelUrl='./assets/vehicles/carro_driver2_otimizado.glb';
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
            this.userPromise=(async()=>{
                const stored=await FreeVehicleAssets.storedBytes();
                if(stored){
                    const local=await FreeVehicleAssets.parseGLB(stored);
                    if(local){this.userTemplate=local;return local}
                }
                if(!THREE.GLTFLoader)return null;
                return new Promise(resolve=>{
                    new THREE.GLTFLoader().load(this.userModelUrl,gltf=>{
                        this.userTemplate=gltf.scene;
                        resolve(this.userTemplate);
                    },undefined,()=>resolve(null));
                });
            })();
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
        this.enabled=true;
        await FreeVehicleAssets.persist(file);
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
        // GLB enviado é alongado em X; o motor usa Z como eixo longitudinal.
        clone.rotation.y=-Math.PI/2;
        wrapped.add(clone);
        wrapped.updateMatrixWorld(true);
        DriverUserCarPaint.prepare(wrapped,vehicle.color);
        vehicle._userCustomModel=false;
        vehicle.applyCC0Model(wrapped,true);
        vehicle._userCustomModel=true;
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
            } else this.decorateStandard(vehicle);
        });
    }

    decorateStandard(vehicle){
        if(vehicle._userCustomModel || vehicle._cc0ModelApplied ||
            !this.enabled)return;
        const filename=this.getModelName(vehicle);
        if(!filename)return;
        this.getScene(filename).then(template=>{
            if(!template || !this.enabled || vehicle._userCustomModel ||
                !this.engine.vehicles.includes(vehicle) || !vehicle.root.parent)return;
            vehicle.applyCC0Model(template.clone(true));
            this.updateStatus();
        });
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            this.decorateFleet();
        } else {
            this.engine.vehicles.forEach(v => {
                if (v._cc0ModelApplied) v.buildCarMesh();
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
            (custom>0?'Carro Driver 2 GLB: '+custom+' veículos com pintura individual. ':
                'Modelo personalizado: use IMPORTAR GLB para adicioná-lo. ')+
            'Modelos 3D ativos: '+count+
            (this.failed.size?' • Alguns externos indisponíveis.':'') :
            'Malhas PS1 procedurais ativas. Pressione M para ativar 3D.';
    }
}
