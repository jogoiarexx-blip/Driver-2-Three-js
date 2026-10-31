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
            height:DriverMalePedestrian.HEIGHT_METERS,tag:'glbMale',id:'male',species:'adult',
            textureMaxSize:0,allowAnyAnimation:false,allowStatic:false,...options};
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
        this.visualRepairs={normalizedSkins:0,scaleTracksRemoved:0,invalidTracksRemoved:0};
        this.skinnedScaleReport=null;
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
                        if(!gltf?.scene)
                            throw new Error('Cena ausente no GLB');
                        const clips=Array.isArray(gltf.animations)?gltf.animations:[];
                        // Reparação opcional de deformações nos modelos Meshy.
                        this.repairRigAndAnimations(gltf.scene,clips);
                        const usable=clips.filter(clip=>clip?.tracks?.length);
                        let walk=usable.find(clip=>clip.name===this.config.walkName)||
                            usable.find(clip=>/^(walking|walk)$/i.test(clip.name))||
                            usable.find(clip=>/walk|andar|trot|locomotion/i.test(clip.name));
                        // Os GLBs novos podem usar nomes de animação diferentes.
                        if(!walk&&this.config.allowAnyAnimation)
                            walk=usable.find(clip=>/run|move|gait/i.test(clip.name))||
                                usable.find(clip=>/idle|stand/i.test(clip.name))||usable[0];
                        let staticPose=false;
                        if(!walk&&this.config.allowStatic&&
                           typeof THREE.AnimationClip==='function'){
                            walk=new THREE.AnimationClip('Static_Pose',1,[]);
                            staticPose=true;
                        }
                        if(!walk||(!staticPose&&!walk.tracks?.length))
                            throw new Error('GLB sem caminhada ou pose utilizável');
                        const run=usable.find(clip=>
                            /^(running|run)$/i.test(clip.name)&&clip!==walk)||null;

                        const root=gltf.scene;
                        root.updateMatrixWorld(true);
                        const bounds=new THREE.Box3().setFromObject(root);
                        const size=bounds.getSize(new THREE.Vector3());
                        // Cachorros podem ser exportados em centímetros
                        // ou com bounding box inferior a 50 cm. A normalização
                        // converte para a altura visual definida no cadastro.
                        // Alguns animais do Meshy chegam em metros 0.01 x 0.01:
                        // geometria pequena + escala da Armature 0.01. Não
                        // descartar o GLB: normalizar o bounds para a altura alvo.
                        if(!Number.isFinite(size.y)||size.y<=1e-10)
                            throw new Error('Altura inexistente no modelo GLB');

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
                        this.animationNames=clips.map(a=>a.name);
                        this.staticPose=staticPose;
                        this.walkAction.reset().play();
                        // Three.js r128 Box3 ignora a deformação CPU dos
                        // SkinnedMesh. Meshy GLBs caninos dão até 67 metros
                        // animados apesar do Box3 estático medir 0,87 m!
                        // Normalizar com a geometria realmente deformada,
                        // antes de anexar à vaga e antes de clonar o rig.
                        if(this.config.normalizeSkinnedBounds)
                            this.normalizeAnimatedSkinnedBounds();
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

    /**
     * Mede vértices transformados pelos ossos em Three.js r128.
     * Box3.setFromObject lê só o atributo POSITION, sem skinning, e
     * não representa o cão renderizado. Amostra cada malha skinned
     * (sem alocar novos NPCs / buffers de GPU) em vários frames.
     */
    static animatedSkinnedBounds(root,budget=1200){
        const box=new THREE.Box3().makeEmpty();
        const vector=new THREE.Vector3();
        let samples=0;
        root.updateMatrixWorld(true);
        root.traverse(mesh=>{
            if(!mesh.isSkinnedMesh||
                !mesh.geometry?.attributes?.position||
                typeof mesh.boneTransform!=='function')return;
            mesh.skeleton?.update();
            const attr=mesh.geometry.attributes.position;
            const stride=Math.max(1,Math.floor(attr.count/budget));
            for(let i=0;i<attr.count;i+=stride){
                vector.fromBufferAttribute(attr,i);
                mesh.boneTransform(i,vector);
                mesh.localToWorld(vector);
                if(Number.isFinite(vector.x)&&Number.isFinite(vector.y)&&
                    Number.isFinite(vector.z)){
                    box.expandByPoint(vector);
                    samples++;
                }
            }
        });
        return samples?box:null;
    }

    normalizeAnimatedSkinnedBounds(){
        const clip=this.walkAction?.getClip();
        const duration=Math.max(.01,clip?.duration||1);
        const frames=[.05,.20,.37,.56,.76,.94];
        let highest=0,seen=0;
        this.walkAction.paused=false;
        for(const fraction of frames){
            this.mixer.setTime(duration*fraction);
            const box=DriverMalePedestrian.animatedSkinnedBounds(this.root);
            if(!box)continue;
            const size=box.getSize(new THREE.Vector3());
            if(Number.isFinite(size.y)&&size.y>highest)highest=size.y;
            seen++;
        }
        if(!seen||highest<=1e-8)
            throw new Error('GLB canino sem malha animada mensurável');
        const factor=this.config.height/highest;
        if(!Number.isFinite(factor)||factor<=0||factor>1e6)
            throw new Error('Normalização real do GLB canino inválida');
        this.root.scale.multiplyScalar(factor);
        // Centragem e alinhamento ao piso usando a pose REAL,
        // em vez de bounding boxes da malha sem skinning.
        this.mixer.setTime(duration*.20);
        const adjusted=DriverMalePedestrian.animatedSkinnedBounds(this.root);
        if(!adjusted)throw new Error('Bounds skinned ausentes após escala');
        const center=adjusted.getCenter(new THREE.Vector3());
        this.root.position.x-=center.x;
        this.root.position.z-=center.z;
        this.root.position.y-=adjusted.min.y;
        this.root.updateMatrixWorld(true);
        this.skinnedScaleReport={unfixedHeight:highest,
            factor,referenceHeight:this.config.height,
            measuredHeight:DriverMalePedestrian.animatedSkinnedBounds(this.root)
                ?.getSize(new THREE.Vector3()).y||0,
            framesChecked:seen};
        // A animação permanece pronta para quando o pedestre se mover.
        this.walkAction.reset().play();
        this.mixer.update(0);
        this.walkAction.paused=true;
    }

    repairRigAndAnimations(root,clips){
        // Alguns GLBs caninos têm escala 0.01 no nó Armature. Uma track
        // 'Armature.scale' da animação sobrescreve a escala importada e
        // multiplica o cachorro por 100 ou mais enquanto ele anda.
        // Remover somente essas tracks, mantendo translação/rotação,
        // preserva o rig e a escala original do modelo.
        const skinRepair=!!this.config.repairSkinDeformation;
        const scaleLock=skinRepair||!!this.config.suppressAnimatedScale;
        if(!scaleLock)return;
        this.visualRepairs={normalizedSkins:0,scaleTracksRemoved:0,invalidTracksRemoved:0};
        if(skinRepair)root.traverse(node=>{
            if(!node.isSkinnedMesh)return;
            if(typeof node.normalizeSkinWeights==='function'){
                node.normalizeSkinWeights();
                this.visualRepairs.normalizedSkins++;
            }
        });
        for(const clip of clips){
            if(!Array.isArray(clip.tracks))continue;
            clip.tracks=clip.tracks.filter(track=>{
                if(/\.scale$/i.test(track?.name||'')){
                    this.visualRepairs.scaleTracksRemoved++;
                    return false;
                }
                if(track?.values && Array.from(track.values).some(v=>!Number.isFinite(v))){
                    this.visualRepairs.invalidTracksRemoved++;
                    return false;
                }
                return true;
            });
        }
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
            if(Number.isFinite(this.current.baseWalkSpeed))
                this.current.walkSpeed=this.current.baseWalkSpeed;
            delete this.current.species;
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
        this.manager.uploadedCrowd?.releaseSlot(this.config.pedestrianIndex);
        for(const child of ped.mesh.children)child.visible=false;
        ped.mesh.add(this.container);
        ped[this.config.tag]=true;
        if(this.config.tag==='glbVariant')ped.variantId=this.config.id;
        if(!Number.isFinite(ped.baseWalkSpeed))
            ped.baseWalkSpeed=ped.walkSpeed;
        ped.walkSpeed=this.config.walkSpeed||ped.baseWalkSpeed;
        ped.species=this.config.species||'adult';
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
            animated:!!this.walkAction,staticPose:!!this.staticPose,
            species:this.config.species||'adult',height:this.config.height,
            animations:this.animationNames.slice(),
            originalHeight:this.originalHeight,visualRepairs:{...this.visualRepairs},
            skinnedScale:this.skinnedScaleReport,error:this.error,
            pedestrianCount:this.manager?.pedestrians?.length||0};
    }
}
