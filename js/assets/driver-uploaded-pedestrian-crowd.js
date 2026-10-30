/**
 * Civis exclusivamente GLB enviados pelo criador do jogo.
 * Mantém 28 vagas lógicas, uma IA/colisor por pedestre e reusa geometria e
 * texturas dos cinco modelos. Clona somente o esqueleto por personagem.
 * Nenhum humano procedural é usado quando faltar um arquivo.
 */
class DriverUploadedPedestrianCrowd {
    constructor(manager) {
        this.manager=manager;
        this.instances=new Map();
        this.officers=new Map();
        this.lastError='';
    }

    sources() {
        const m=this.manager;
        return [
            m.femalePedestrian,
            m.malePedestrian,
            ...(m.variantPedestrians?.models||[])
        ];
    }

    available() {
        return this.sources().filter(model=>
            model?.state==='ready' &&
            (model.root||model.asset) &&
            (model.walkAction||model.action)?.getClip?.());
    }

    /** SkeletonUtils.clone equivalente, sem CDN adicional.
     * Object3D.clone sozinho deixa os SkinnedMesh associados aos ossos antigos.
     * Geometrias, materiais e texturas seguem compartilhados entre as cópias.
     */
    static cloneRig(source) {
        if(THREE.SkeletonUtils?.clone)
            return THREE.SkeletonUtils.clone(source);
        const clone=source.clone(true);
        const from=[],to=[];
        source.traverse(node=>from.push(node));
        clone.traverse(node=>to.push(node));
        if(from.length!==to.length)
            throw new Error('Hierarquia GLB inconsistente');
        const mapping=new Map(from.map((node,i)=>[node,to[i]]));
        for(let i=0;i<from.length;i++){
            const original=from[i],copy=to[i];
            if(!original.isSkinnedMesh)continue;
            if(!original.skeleton?.bones?.length)
                throw new Error('GLB sem skeleton');
            const skeleton=original.skeleton.clone();
            skeleton.bones=original.skeleton.bones.map(bone=>mapping.get(bone));
            if(skeleton.bones.some(bone=>!bone))
                throw new Error('Os ossos do GLB estão fora da raiz clonada');
            copy.bind(skeleton,original.bindMatrix);
        }
        return clone;
    }

    makeInstance(source,ped,index) {
        const sourceRoot=source.root||source.asset;
        const root=DriverUploadedPedestrianCrowd.cloneRig(sourceRoot);
        const container=new THREE.Group();
        // Variação sutil na altura para que cópias não formem clones idênticos.
        container.scale.setScalar(0.975+(index%5)*0.0125);
        container.add(root);
        ped.mesh.add(container);
        const mixer=new THREE.AnimationMixer(root);
        const walkClip=(source.walkAction||source.action).getClip();
        const runClip=source.runAction?.getClip?.()||null;
        const walk=mixer.clipAction(walkClip);
        walk.setLoop(THREE.LoopRepeat,Infinity);
        walk.reset().play();
        walk.time=(index*.43)%Math.max(.1,walkClip.duration||1);
        walk.paused=true;
        const run=runClip?mixer.clipAction(runClip):null;
        run?.setLoop(THREE.LoopRepeat,Infinity);
        return {container,root,mixer,walk,run,action:walk,
            source,sourceId:source.config?.id||
                (source===this.manager.femalePedestrian?'female':'male'),
            moving:false,running:false,accumulator:0};
    }

    detach(record) {
        if(!record)return;
        record.mixer.stopAllAction();
        record.mixer.uncacheRoot(record.root);
        record.container.parent?.remove(record.container);
    }

    releaseSlot(index) {
        const record=this.instances.get(index);
        if(!record)return;
        this.detach(record);
        this.instances.delete(index);
        const ped=this.manager.pedestrians[index];
        if(ped){ped.glbCrowd=false;delete ped.crowdId;}
    }

    release() {
        for(const index of [...this.instances.keys()])this.releaseSlot(index);
        for(const record of this.officers.values())this.detach(record);
        this.officers.clear();
    }

    /** Distribuição circular: todos os 5 modelos aparecem no mapa.
     * Se um modelo falhar, as vagas recebem outro GLB real já carregado.
     */
    fill() {
        const ready=this.available();
        const all=this.sources();
        for(let i=0;i<this.manager.pedestrians.length;i++){
            const ped=this.manager.pedestrians[i];
            if(ped.glbFemale||ped.glbMale||ped.glbVariant){
                this.releaseSlot(i);
                continue;
            }
            const preferred=all[i%all.length];
            const model=ready.includes(preferred)?preferred:
                ready.length?ready[i%ready.length]:null;
            const existing=this.instances.get(i);
            if(existing?.source===model)continue;
            this.releaseSlot(i);
            if(!model)continue;
            try{
                const record=this.makeInstance(model,ped,i);
                this.instances.set(i,record);
                ped.glbCrowd=true;
                ped.crowdId=record.sourceId;
            }catch(e){
                this.lastError=String(e?.message||e);
                // Nunca introduzir um personagem procedural como fallback.
            }
        }
        for(const officer of this.manager.roadblockOfficers)
            this.attachOfficer(officer);
    }

    attachOfficer(officer) {
        if(this.officers.has(officer))return;
        const models=this.available();
        const male=this.manager.malePedestrian;
        const model=models.includes(male)?male:models[0];
        if(!model||!officer.mesh)return;
        try{
            const record=this.makeInstance(model,officer,
                this.manager.roadblockOfficers.indexOf(officer));
            this.officers.set(officer,record);
        }catch(e){this.lastError=String(e?.message||e);}
    }

    releaseOfficer(officer) {
        const record=this.officers.get(officer);
        if(!record)return;
        this.detach(record);
        this.officers.delete(officer);
    }

    update(ped,dt,moving,crossing=false,distance=0) {
        const index=this.manager.pedestrians.indexOf(ped);
        const record=this.instances.get(index);
        if(!record||!ped.mesh.visible)return;
        this.animate(record,dt,moving,crossing,ped.walkSpeed,distance);
    }

    animate(record,dt,moving,crossing,speed,distance=0) {
        const running=!!(moving&&crossing&&record.run);
        if(record.moving!==!!moving||record.running!==running){
            const next=running?record.run:record.walk;
            if(next!==record.action){
                record.action.stop();
                next.reset().play();
                record.action=next;
            }else if(moving)next.play();
            record.action.paused=!moving;
            record.moving=!!moving;
            record.running=running;
        }
        if(!moving){record.accumulator=0;return;}
        const base=running?6.5:2.7;
        const rate=Math.max(.7,Math.min(1.8,
            (crossing?6.6:(speed||2.4))/base));
        // LOD de animação: longe, atualizar ossos a 10 Hz; IA continua a 60 Hz.
        record.accumulator+=Math.max(0,Math.min(.07,dt));
        if(distance>115&&record.accumulator<.1)return;
        record.mixer.update(Math.min(.12,record.accumulator)*rate);
        record.accumulator=0;
    }

    status() {
        const filled=this.instances.size+
            this.manager.pedestrians.filter(p=>
                p.glbFemale||p.glbMale||p.glbVariant).length;
        return {
            mode:'uploaded-glb-only',
            configuredSlots:this.manager.pedestrians.length,
            loadedModels:this.available().length,
            filledSlots:filled,
            waitingSlots:Math.max(0,this.manager.pedestrians.length-filled),
            proceduralCivilians:0,
            officerModels:this.officers.size,
            models:this.sources().map(m=>({id:m?.config?.id||
                (m===this.manager.femalePedestrian?'female':'unknown'),
                state:m?.state||'unavailable',error:m?.error||''})),
            error:this.lastError
        };
    }
}
