
/**
 * Frota 3D com arquivos GLB publicados neste repositório.
 * Física e missões independentes do visual; templates em cache e clones leves.
 * Nenhum modelo externo/CDN é utilizado para gerar veículos automaticamente.
 */
class FreeVehicleAssets {
    constructor(engine) {
        this.engine = engine;
        this.enabled = true;
        this.cache = new Map();
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
        this.uploaded=typeof DriverUploadedVehicles!=='undefined'?new DriverUploadedVehicles(engine,this):null;
        this.updateButton();
    }

    // Todas as categorias são mapeadas a modelos realmente hospedados no jogo.
    // Não há mais download automático do Kenney Car Kit nem alternância PS1.
    getModelName(vehicle) {
        if(vehicle.isPolice)return 'police';
        if(vehicle.uploadedModel)return vehicle.uploadedModel;
        if(vehicle.bodyStyle==='bus')return 'school-bus';
        if(vehicle.bodyStyle==='motorcycle')return 'motorcycle';
        if(vehicle.bodyStyle==='truck'){
            // Distribuição estável: a mesma missão conserva a mesma caminhonete.
            const seed=Math.abs(Math.round((vehicle.x||0)*13+
                (vehicle.z||0)*7+(vehicle.name||'').length*11));
            return seed%2?'pickup-old':'pickup-new';
        }
        // Até que uma limusine específica seja publicada, o carro do próprio
        // repositório recebe proporções longas sem alterar o colisor físico.
        return 'driver2';
    }

    getScene(filename) {
        if(filename==='driver2')return this.getUserTemplate();
        if(filename==='police')return this.getPoliceTemplate();
        if(this.uploaded && typeof DriverUploadedVehicles!=='undefined' &&
            DriverUploadedVehicles.DEFINITIONS[filename])
            return this.uploaded.getTemplate(filename);
        return Promise.resolve(null);
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
        return !!vehicle && (vehicle.bodyStyle==='muscle' ||
            vehicle.bodyStyle==='limo') && !vehicle.isPolice &&
            !vehicle.uploadedModel;
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
            if(car._userCustomModel){
                car._userCustomModel=false;
                car._cc0ModelApplied=false;
            }
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

    isLive(vehicle) {
        return !!vehicle?.root?.parent &&
            this.engine.vehicles.includes(vehicle) && this.enabled;
    }

    // Alternativa LOCAL caso o arquivo específico não carregue. Em falha
    // total, mantém a direção utilizável e avisa explicitamente na interface.
    decorateRepositoryFallback(vehicle, failedId) {
        if(!this.isLive(vehicle) || vehicle._cc0ModelApplied ||
            vehicle._userCustomModel)return;
        this.failed.add(failedId);
        const alternative=failedId==='driver2'?'pickup-new':'driver2';
        this.getScene(alternative).then(template=>{
            if(!this.isLive(vehicle) || vehicle._cc0ModelApplied ||
                vehicle._userCustomModel)return;
            if(template){
                if(alternative==='driver2')
                    this.applyDriver2Model(vehicle,template);
                else this.applyRepositoryModel(vehicle,template,alternative);
            }else{
                vehicle.showProceduralFallback?.();
                vehicle._modelLoadFailed=true;
            }
            this.updateStatus();
        });
    }

    applyRepositoryModel(vehicle,template,id) {
        if(!template || !this.isLive(vehicle) || vehicle._userCustomModel ||
            vehicle._cc0ModelApplied)return false;
        const wrapped=new THREE.Group(),clone=template.clone(true);
        clone.rotation.y=Math.PI/2;
        wrapped.add(clone);
        wrapped.updateMatrixWorld(true);
        vehicle._repositoryModelPending=id;
        const applied=vehicle.applyCC0Model(wrapped,true)!==false;
        vehicle._repositoryModelPending=null;
        if(!applied)return false;
        vehicle._uploadedCustomModel=id;
        vehicle._repositoryModelId=id;
        vehicle._modelLoadFailed=false;
        if(typeof DriverVehicleWheelRig!=='undefined')
            vehicle.wheelRig=DriverVehicleWheelRig.mount(vehicle,wrapped);
        return true;
    }

    decorateFleet() {
        if(!this.enabled)return;
        for(const vehicle of this.engine.vehicles){
            if(!this.isLive(vehicle) || vehicle._userCustomModel ||
                vehicle._cc0ModelApplied)continue;
            if(vehicle.uploadedModel && this.uploaded){
                this.uploaded.decorate(vehicle);
            }else if(vehicle.isPolice){
                this.getPoliceTemplate().then(template=>{
                    if(!this.isLive(vehicle) || vehicle._userCustomModel ||
                        vehicle._cc0ModelApplied)return;
                    if(template)this.applyPoliceModel(vehicle,template);
                    else this.decorateRepositoryFallback(vehicle,'police');
                    this.updateStatus();
                });
            }else if(this.canUseDriver2Model(vehicle)){
                this.getUserTemplate().then(template=>{
                    if(!this.isLive(vehicle) || vehicle._userCustomModel ||
                        vehicle._cc0ModelApplied)return;
                    if(template)this.applyDriver2Model(vehicle,template);
                    else this.decorateRepositoryFallback(vehicle,'driver2');
                    this.updateStatus();
                });
            }else this.decorateStandard(vehicle);
        }
        // O barco decorativo fica por último na fila de downloads, para
        // não atrasar os modelos dos veículos que participam da direção.
        this.uploaded?.attachBoat();
        this.updateStatus();
    }

    decorateStandard(vehicle) {
        if(!this.isLive(vehicle) || vehicle._userCustomModel ||
            vehicle._cc0ModelApplied)return;
        const filename=this.getModelName(vehicle);
        this.getScene(filename).then(template=>{
            if(!this.isLive(vehicle) || vehicle._userCustomModel ||
                vehicle._cc0ModelApplied)return;
            if(template){
                if(filename==='driver2')this.applyDriver2Model(vehicle,template);
                else if(filename==='police')this.applyPoliceModel(vehicle,template);
                else this.applyRepositoryModel(vehicle,template,filename);
            }else this.decorateRepositoryFallback(vehicle,filename);
            this.updateStatus();
        });
    }

    // Tecla M e botão agora repetem downloads que falharam, sem reativar
    // carros de caixas e sem apagar GLBs que já carregaram.
    toggle() {
        this.enabled=true;
        this.failed.clear();
        this.cache.clear();
        this.engine.vehicles.forEach(vehicle=>{
            if(vehicle._modelLoadFailed)vehicle._modelLoadFailed=false;
        });
        this.decorateFleet();
        this.updateButton();
        this.updateStatus();
    }

    updateButton() {
        const button=document.getElementById('btn-free-assets');
        if(!button)return;
        button.textContent='🚘 GLB LOCAL';
        button.title='Veículos 3D do repositório • clique ou M para tentar novamente modelos ausentes';
        button.setAttribute('aria-pressed','true');
    }

    updateStatus() {
        const el=document.getElementById('asset-loader-status');
        if(!el)return;
        const vehicles=this.engine.vehicles||[];
        const loaded=vehicles.filter(v=>v._cc0ModelApplied).length;
        const missing=vehicles.filter(v=>v._modelLoadFailed).length;
        const waiting=Math.max(0,vehicles.length-loaded-missing);
        const police=vehicles.filter(v=>v.isPolice && v._policeCustomModel).length;
        el.textContent='GLB do repositório: '+loaded+'/'+vehicles.length+
            ' veículos • polícia '+police+
            ' • carregando '+waiting+
            (missing?' • '+missing+' com modelo de emergência (falha de download).':'')+
            (this.failed.size?' • Arquivos indisponíveis: '+[...this.failed].join(', '):'')+
            ' • M: tentar novamente.';
    }


}
