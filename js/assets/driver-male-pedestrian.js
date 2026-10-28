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

    constructor(manager){
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
                DriverMalePedestrian.ASSET_URL,gltf=>{
                    try{
                        if(!gltf?.scene||!gltf?.animations?.length)
                            throw new Error('Cena ou animações ausentes no GLB');
                        const walk=gltf.animations.find(clip=>
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
                        const scale=DriverMalePedestrian.HEIGHT_METERS/size.y;
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

    release(){
        if(this.container?.parent)this.container.parent.remove(this.container);
        if(this.current){
            // Restaurar o modelo procedural ao liberar a vaga.
            for(const child of this.current.mesh?.children||[])
                child.visible=true;
            this.current.glbMale=false;
            this.current=null;
        }
        this.lastMoving=false;
        this.lastRunning=false;
    }

    attachToPedestrian(){
        if(this.state!=='ready'||!this.container)return false;
        // A primeira vaga (0) pertence à pedestre feminina.
        const ped=this.manager?.pedestrians?.[
            DriverMalePedestrian.PEDESTRIAN_INDEX];
        if(!ped?.mesh||ped.glbFemale)return false;
        if(this.current===ped)return true;
        this.release();
        for(const child of ped.mesh.children)child.visible=false;
        ped.mesh.add(this.container);
        ped.glbMale=true;
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
            pedestrianIndex:DriverMalePedestrian.PEDESTRIAN_INDEX,
            animated:!!this.walkAction,
            animations:this.animationNames.slice(),
            originalHeight:this.originalHeight,error:this.error,
            pedestrianCount:this.manager?.pedestrians?.length||0};
    }
}
