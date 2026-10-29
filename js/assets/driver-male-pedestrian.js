/**
 * Homem low-poly enviado pelo usuário — uma das 28 entidades civis
 * existentes, sem adicionar NPC, disparos, IA, colisores ou materiais.
 *
 * O arquivo real já está publicado em assets/pedestrians/ no GitHub.
 * Rig e animações preservados: Walking, Running, Aim_Pistol,
 * Shoot_Pistol, Shoot_From_Idle. Apenas andar/correr são usados
 * automaticamente no tráfego civil; o NPC não atira sozinho.
 */
class DriverMalePedestrian {
    static ASSET_URL='./assets/pedestrians/Pedestre_Masculino_Driver2_Atirar_Com_Pistola.glb';
    static PEDESTRIAN_INDEX=1;
    static HEIGHT_METERS=2.08;

    constructor(manager,options={}){
        this.config={url:DriverMalePedestrian.ASSET_URL,pedestrianIndex:DriverMalePedestrian.PEDESTRIAN_INDEX,
            height:DriverMalePedestrian.HEIGHT_METERS,tag:'glbMale',id:'male',textureMaxSize:0,...options};
        this.resizedTextures=0;
        this.manager=manager;
        this.promise=null;
        this.state='pending';
        this.error='';
        this.container=null;
        this.root=null;
        this.current=null;
        this.mixer=null;
        this.walkAction=null;
        this.runAction=null;
        this.action=null;
        this.animationNames=[];
        this.lastMoving=false;
        this.lastRunning=false;
        this.originalHeight=0;
    }

    load(){
        if(this.promise)return this.promise;
        if(typeof THREE==='undefined'||
            typeof THREE.GLTFLoader!=='function'){
            this.state='unsupported';
            return Promise.resolve(false);
        }
        this.state='loading';
        this.promise=new Promise(resolve=>{
            new THREE.GLTFLoader().load(
                this.config.url,gltf=>{
                    try{
                        if(!gltf?.scene||!gltf?.animations?.length)
                            throw new Error('Cena ou animações ausentes no GLB');
                        const walk=gltf.animations.find(clip=>clip.name===this.config.walkName)||
                            gltf.animations.find(clip=>
                            /^(walking|walk)$/i.test(clip.name))||
                            gltf.animations.find(clip=>
                                /walk|andar/i.test(clip.name));
                        const run=gltf.animations.find(clip=>
                            /^(running|run)$/i.test(clip.name))||null;
                        if(!walk?.tracks?.length)
                            throw new Error('O GLB não possui animação Walking válida');

                        const root=gltf.scene;
                        root.updateMatrixWorld(true);
                        const bounds=new THREE.Box3().setFromObject(root);
                        const size=bounds.getSize(new THREE.Vector3());
                        if(!(size.y>.5)&&!Number.isFinite(size.y))
                            throw new Error('Altura inválida do pedestre');
                        if(!Number.isFinite(size.y)||size.y<=.5)
                            throw new Error('Altura inválida do pedestre');

                        // O arquivo tem aproximadamente 1,87m de altura;
                        // o pedestre do mundo terá 2,08m, sem pés flutuando.
                        const scale=this.config.height/size.y;
                        root.scale.multiplyScalar(scale);
                        root.position.set(
                            -(bounds.min.x+bounds.max.x)*.5*scale,
                            -bounds.min.y*scale,
                            -(bounds.min.z+bounds.max.z)*.5*scale
                        );
                        // O osso HeadFront está em +Z: segue a mesma
                        // orientação das rotas da IA, não anda de costas.
                        root.rotation.y=0;
                        root.traverse(node=>{
                            if(node.isMesh||node.isSkinnedMesh){
                                node.frustumCulled=false;
                                node.castShadow=false;
                                node.receiveShadow=false;
                            }
                        });
                        this.resizeTextures(root);
                        this.container=new THREE.Group();
                        this.container.position.y=0;
                        this.container.add(root);
                        this.root=root;
                        this.mixer=new THREE.AnimationMixer(root);
                        this.walkAction=this.mixer.clipAction(walk);
                        this.walkAction.setLoop(THREE.LoopRepeat,Infinity);
                        this.runAction=run?.tracks?.length?
                            this.mixer.clipAction(run):null;
                        this.runAction?.setLoop(THREE.LoopRepeat,Infinity);
                        this.animationNames=gltf.animations.map(a=>a.name);
                        this.walkAction.reset().play();
                        this.walkAction.paused=true;
                        this.action=this.walkAction;
                        this.originalHeight=size.y;
                        this.state='ready';
                        this.attachToPedestrian();
                        resolve(true);
                    }catch(e){
                        this.state='error';
                        this.error=String(e?.message||e);
                        resolve(false);
                    }
                },undefined,error=>{
                    this.state='missing';
                    this.error=String(error?.message||'GLB indisponível');
                    resolve(false);
                });
        });
        return this.promise;
    }

    resizeTextures(root){
        const cap=this.config.textureMaxSize;
        if(!cap||typeof document==='undefined')return;
        const replacements=new Map();
        root.traverse(node=>{
            for(const material of (Array.isArray(node.material)?node.material:[node.material]).filter(Boolean)){
                for(const key of Object.keys(material)){
                    const texture=material[key],image=texture?.image;
                    if(!texture?.isTexture||!image||Math.max(image.width||0,image.height||0)<=cap)continue;
                    if(!replacements.has(texture)){
                        const canvas=document.createElement('canvas'),ratio=cap/Math.max(image.width,image.height);
                        canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
                        canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
                        const resized=texture.clone();resized.image=canvas;resized.needsUpdate=true;
                        replacements.set(texture,resized);this.resizedTextures++;
                    }
                    material[key]=replacements.get(texture);material.needsUpdate=true;
                }
            }
        });
        for(const texture of replacements.keys())texture.dispose();
    }

    release(){
        if(this.container?.parent)this.container.parent.remove(this.container);
        if(this.current){
            // Restaurar o modelo procedural ao liberar a vaga.
            for(const child of this.current.mesh?.children||[])
                child.visible=true;
            this.current[this.config.tag]=false;
            if(this.config.tag==='glbVariant')delete this.current.variantId;
            this.current=null;
        }
        this.lastMoving=false;
        this.lastRunning=false;
    }

    attachToPedestrian(){
        if(this.state!=='ready'||!this.container)return false;
        // A primeira vaga (0) pertence à pedestre feminina.
        const ped=this.manager?.pedestrians?.[
            this.config.pedestrianIndex];
        if(!ped?.mesh)return false;
        if(this.current===ped)return true;
        if(ped.glbFemale||ped.glbMale||ped.glbVariant)return false;
        this.release();
        for(const child of ped.mesh.children)child.visible=false;
        ped.mesh.add(this.container);
        ped[this.config.tag]=true;
        if(this.config.tag==='glbVariant')ped.variantId=this.config.id;
        this.current=ped;
        this.walkAction.reset().play();
        this.walkAction.paused=true;
        this.runAction?.stop();
        this.action=this.walkAction;
        this.lastMoving=false;
        this.lastRunning=false;
        return true;
    }

    update(ped,dt,moving,crossing=false){
        if(ped!==this.current||!this.mixer||!ped.mesh.visible)return;
        // Correr na travessia, andar na calçada; idle pausa o rig.
        const running=!!(moving&&crossing&&this.runAction);
        if(moving!==this.lastMoving||running!==this.lastRunning){
            const next=running?this.runAction:this.walkAction;
            if(this.action!==next){
                this.action.stop();
                next.reset().play();
                this.action=next;
            }else if(moving)this.action.play();
            this.action.paused=!moving;
            this.lastMoving=!!moving;
            this.lastRunning=running;
        }
        if(!moving)return;
        const speed=running?6.5:2.7;
        const rate=Math.max(.7,Math.min(1.8,
            (crossing?6.6:(ped.walkSpeed||2.4))/speed));
        this.mixer.update(Math.max(0,Math.min(.07,dt))*rate);
    }

    status(){
        return {state:this.state,active:!!this.current,
            pedestrianIndex:this.config.pedestrianIndex,
            id:this.config.id,assetUrl:this.config.url,resizedTextures:this.resizedTextures,
            animated:!!this.walkAction,
            animations:this.animationNames.slice(),
            originalHeight:this.originalHeight,error:this.error,
            pedestrianCount:this.manager?.pedestrians?.length||0};
    }
}
