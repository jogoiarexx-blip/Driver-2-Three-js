/**
 * Mulher low-poly enviada pelo usuário (rig + animação Walking_Woman).
 * Uma instância animada integrada à IA normal dos pedestres de calçada.
 * Arquivo: assets/pedestrians/mulher_walk.glb
 * Caso o arquivo não esteja publicado, os 28 pedestres originais continuam.
 */
class DriverFemalePedestrian {
    static ASSET_URL='./assets/pedestrians/mulher_walk.glb';

    constructor(manager) {
        this.manager=manager;
        this.asset=null;
        this.promise=null;
        this.mixer=null;
        this.action=null;
        this.container=null;
        this.current=null;
        this.state='pending';
        this.error='';
        this.size=0;
        this.lastMoving=false;
    }

    load() {
        if(this.promise)return this.promise;
        if(typeof THREE==='undefined'||typeof THREE.GLTFLoader!=='function'){
            this.state='unsupported';
            return Promise.resolve(false);
        }
        this.state='loading';
        this.promise=new Promise(resolve=>{
            const loader=new THREE.GLTFLoader();
            loader.load(DriverFemalePedestrian.ASSET_URL,gltf=>{
                try{
                    if(!gltf?.scene || !gltf?.animations?.length)
                        throw new Error('GLB sem cena animada');
                    const clip=gltf.animations.find(a=>
                        /walk|walking|andar/i.test(a.name))||gltf.animations[0];
                    if(!clip?.tracks?.length)
                        throw new Error('Animação de caminhada vazia');
                    const root=gltf.scene;
                    root.updateMatrixWorld(true);
                    const bounds=new THREE.Box3().setFromObject(root);
                    const dimensions=bounds.getSize(new THREE.Vector3());
                    if(!(dimensions.y>0.5) || !Number.isFinite(dimensions.y))
                        throw new Error('Escala inválida do pedestre');
                    // O modelo original tem aprox. 1,72 unidades de altura.
                    // Conservar 1,7m no mundo; pés no y=0, independentemente do GLB.
                    const scale=1.7/dimensions.y;
                    root.scale.multiplyScalar(scale);
                    root.position.set(
                        -(bounds.min.x+bounds.max.x)*.5*scale,
                        -bounds.min.y*scale,
                        -(bounds.min.z+bounds.max.z)*.5*scale
                    );
                    root.rotation.y=Math.PI;
                    root.traverse(node=>{
                        if(node.isMesh){
                            node.castShadow=false;
                            node.receiveShadow=false;
                            node.frustumCulled=false; // skin animated bounding box
                        }
                    });
                    this.container=new THREE.Group();
                    // O pedestre procedural tem origem y=+0.35;
                    // neutralizar para os pés do GLB encostarem no passeio.
                    this.container.position.y=-.35;
                    this.container.add(root);
                    this.mixer=new THREE.AnimationMixer(root);
                    this.action=this.mixer.clipAction(clip);
                    this.action.setLoop(THREE.LoopRepeat,Infinity);
                    this.action.play();
                    this.action.paused=true;
                    this.asset=root;
                    this.size=dimensions.y;
                    this.state='ready';
                    this.attachToFirst();
                    resolve(true);
                }catch(error){
                    this.state='error';
                    this.error=String(error?.message||error);
                    resolve(false);
                }
            },undefined,error=>{
                this.state='missing';
                this.error=String(error?.message||'GLB não publicado');
                resolve(false);
            });
        });
        return this.promise;
    }

    // Antes do descarte de pedestres antigos, preservar o esqueleto carregado:
    // GPUResourceUtils.disposeSubtree não deve liberar suas texturas e bones.
    release() {
        if(this.container?.parent)this.container.parent.remove(this.container);
        if(this.current){
            this.current.glbFemale=false;
            this.current=null;
        }
    }

    attachToFirst() {
        if(this.state!=='ready'||!this.container)return false;
        const ped=this.manager?.pedestrians?.[0];
        if(!ped?.mesh)return false;
        if(this.current===ped)return true;
        this.release();
        // O corpo procedural continua na memória como fallback, mas invisível.
        for(const child of ped.mesh.children) child.visible=false;
        ped.mesh.add(this.container);
        ped.glbFemale=true;
        this.current=ped;
        this.action.reset().play();
        this.action.paused=true;
        return true;
    }

    update(ped,dt,moving,crossing=false) {
        if(this.current!==ped||!this.mixer||!ped.mesh.visible)return;
        if(moving!==this.lastMoving){
            this.action.paused=!moving;
            this.lastMoving=moving;
        }
        if(!moving)return;
        const pace=Math.max(.7,Math.min(1.7,
            (crossing?6.6:ped.walkSpeed||2.4)/2.7));
        this.mixer.update(Math.max(0,Math.min(.07,dt))*pace);
    }

    status() {
        return {state:this.state,animated:!!this.action,
            pedestrianCount:this.manager?.pedestrians?.length||0,
            active:!!this.current,error:this.error};
    }
}
