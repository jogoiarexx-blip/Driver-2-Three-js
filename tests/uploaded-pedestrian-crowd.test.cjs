'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/assets/driver-uploaded-pedestrian-crowd.js','utf8');
const managerSource=fs.readFileSync('js/entities/pedestrians-roadblocks.js','utf8');
const html=fs.readFileSync('index.html','utf8');
let serial=0;
class Group {
    constructor(){
        this.uuid='test-'+(++serial);this.children=[];this.parent=null;
        this.visible=true;this.isSkinnedMesh=false;
        this.scale={setScalar(value){this.value=value}};
    }
    add(x){x.parent?.remove(x);this.children.push(x);x.parent=this;}
    remove(x){this.children=this.children.filter(v=>v!==x);x.parent=null;}
    traverse(callback){callback(this);for(const c of this.children)c.traverse(callback);}
    clone(deep){
        const n=new this.constructor();
        if(this.isSkinnedMesh)n.skeleton=this.skeleton;
        if(deep)for(const c of this.children)n.add(c.clone(true));
        return n;
    }
}
class Skinned extends Group {
    constructor(){super();this.isSkinnedMesh=true;
        this.bindMatrix='bind';
        this.skeleton={bones:[],clone(){return {bones:[...this.bones]}}};
    }
    bind(skeleton){this.skeleton=skeleton;}
}
class Action {
    constructor(clip){this.clip=clip;this.paused=false;this.time=0;}
    getClip(){return this.clip;}
    setLoop(){return this;}
    reset(){return this;}
    play(){return this;}
    stop(){return this;}
}
class Mixer {
    constructor(root){this.root=root;this.elapsed=0;}
    clipAction(clip){return new Action(clip);}
    update(dt){this.elapsed+=dt;}
    stopAllAction(){this.stopped=true;}
    uncacheRoot(){this.uncached=true;}
}
const context=vm.createContext({THREE:{Group,AnimationMixer:Mixer,LoopRepeat:1},Math,Map,Set,Number});
const Crowd=vm.runInContext(source+';DriverUploadedPedestrianCrowd',context);
function makeSource(id){
    const root=new Group(),bone=new Group(),skin=new Skinned();
    skin.skeleton.bones=[bone];root.add(bone);root.add(skin);
    return {config:{id},state:'ready',root,
        walkAction:new Action({name:'Walking',duration:1}),
        runAction:new Action({name:'Running',duration:1})};
}
function makeManager(){
    const sources=['female','male','mendigo','woman-2','woman-3'].map(makeSource);
    const manager={
        pedestrians:Array.from({length:28},()=>({mesh:new Group(),walkSpeed:2.6})),
        roadblockOfficers:[],
        femalePedestrian:sources[0],malePedestrian:sources[1],
        variantPedestrians:{models:sources.slice(2)}
    };
    return {manager,sources,crowd:new Crowd(manager)};
}
test('28 vagas reais: 5 GLBs originais e 23 clones sem geometria nova',()=>{
    const {manager,crowd,sources}=makeManager();
    for(let i=0;i<5;i++)manager.pedestrians[i][
        i===0?'glbFemale':i===1?'glbMale':'glbVariant']=true;
    crowd.fill();
    assert.equal(crowd.instances.size,23);
    assert.equal(crowd.status().filledSlots,28);
    assert.equal(crowd.status().proceduralCivilians,0);
    assert.equal(crowd.status().loadedModels,5);
    const ids=new Set([...crowd.instances.values()].map(r=>r.sourceId));
    assert.equal(ids.size,5);
    for(const [index,record] of crowd.instances){
        assert.equal(manager.pedestrians[index].glbCrowd,true);
        assert.equal(record.root.children[1].skeleton.bones[0],record.root.children[0]);
        assert.notEqual(record.root.children[0],record.source.root.children[0],
            'clone usa seus próprios ossos');
    }
    // Os dois cidadãos com o mesmo modelo não controlam o mesmo esqueleto.
    assert.notEqual(crowd.instances.get(5).root.children[0],
        crowd.instances.get(10).root.children[0]);
    const p=manager.pedestrians[5];p.mesh.visible=true;
    crowd.update(p,.016,true,false,10);
    assert(crowd.instances.get(5).mixer.elapsed>0);
    crowd.update(p,.016,true,true,10);
    assert.equal(crowd.instances.get(5).action.clip.name,'Running');
    crowd.release();
    assert.equal(crowd.instances.size,0);
    assert.equal(p.mesh.children.length,0);
    assert.equal(sources.length,5);
});
test('sem GLB disponível nunca fabrica pessoas de caixas',()=>{
    const {crowd,manager,sources}=makeManager();
    sources.forEach(m=>m.state='missing');
    crowd.fill();
    assert.equal(crowd.status().waitingSlots,28);
    assert(manager.pedestrians.every(p=>p.mesh.children.length===0));
    assert(!managerSource.includes('const torsoGeo='));
    assert(!managerSource.includes('const uniform = new THREE.MeshLambertMaterial'));
});
test('se um GLB falha, outras fontes reais ocupam sua vaga',()=>{
    const {crowd,manager,sources}=makeManager();
    sources[2].state='error';
    crowd.fill();
    assert.equal(crowd.status().filledSlots,28);
    assert(![...crowd.instances.values()].some(r=>r.sourceId==='mendigo'));
    assert.equal(crowd.status().loadedModels,4);
});
test('agentes de bloqueio e troca de mapa liberam clones antes da limpeza GPU',()=>{
    const {crowd,manager}=makeManager();
    const officer={mesh:new Group()};manager.roadblockOfficers=[officer];
    crowd.fill();
    assert.equal(crowd.officers.size,1);
    assert.equal(officer.mesh.children.length,1);
    crowd.releaseOfficer(officer);
    assert.equal(crowd.officers.size,0);
    assert.equal(officer.mesh.children.length,0);
    crowd.release();
    manager.pedestrians=Array.from({length:28},()=>({mesh:new Group(),walkSpeed:2.6}));
    crowd.fill();
    assert.equal(crowd.status().filledSlots,28);
});
test('scripts carregam antes do gerenciador e nunca carregam procedural de reserva',()=>{
    assert(html.indexOf('driver-uploaded-pedestrian-crowd.js')>
        html.indexOf('driver-pedestrian-variants.js'));
    assert(html.indexOf('driver-uploaded-pedestrian-crowd.js')<
        html.indexOf('entities/pedestrians-roadblocks.js'));
    assert(managerSource.includes('new DriverUploadedPedestrianCrowd(this)'));
    assert(managerSource.includes('this.uploadedCrowd?.release()'));
    assert(managerSource.includes('this.uploadedCrowd?.releaseOfficer(officer)'));
});
