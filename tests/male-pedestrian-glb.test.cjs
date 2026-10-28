/* Male pedestrian GLB: exact upload, rig, walk/run, lifecycle, fallback. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.join(__dirname,'..');
const ASSET='assets/pedestrians/Pedestre_Masculino_Driver2_Atirar_Com_Pistola.glb';
const MODEL=path.join(ROOT,ASSET);
const SCRIPT=fs.readFileSync(path.join(ROOT,'js/assets/driver-male-pedestrian.js'),'utf8');
const MANAGER=fs.readFileSync(path.join(ROOT,'js/entities/pedestrians-roadblocks.js'),'utf8');
const INDEX=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

function readGlb(){
    const bytes=fs.readFileSync(MODEL);
    assert.equal(bytes.toString('ascii',0,4),'glTF');
    assert.equal(bytes.readUInt32LE(4),2);
    assert.equal(bytes.readUInt32LE(8),bytes.length);
    const jsonLength=bytes.readUInt32LE(12);
    const j=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
    return {bytes,j};
}
test('uploaded asset is the exact original GLB, with skeleton and 5 animations',()=>{
    const {bytes,j}=readGlb();
    assert.equal(bytes.length,5890592);
    const blobSha=crypto.createHash('sha1')
       .update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
    assert.equal(blobSha,'3e276bea03edc23489a6419f3e98700a9f1dd23c');
    assert.equal(j.skins.length,1);
    assert(j.meshes.length>=2);
    assert.equal(j.animations.length,5);
    for(const name of ['Walking','Running','Aim_Pistol',
        'Shoot_Pistol','Shoot_From_Idle'])
        assert(j.animations.some(a=>a.name===name),name);
    assert(j.nodes.some(n=>n.name==='headfront'&&n.translation?.[2]>0),
        'Model head-facing +Z must match pedestrian heading');
    assert(j.meshes[0].primitives[0].attributes.JOINTS_0!==undefined);
});

class Group{
    constructor(){this.children=[];this.parent=null;this.visible=true;
        this.position={x:0,y:0,z:0,
            set(x,y,z){this.x=x;this.y=y;this.z=z;}};
        this.rotation={x:0,y:0,z:0};
        this.scale={value:1,multiplyScalar(n){this.value*=n}};
    }
    add(o){if(o.parent)o.parent.remove(o);this.children.push(o);o.parent=this;}
    remove(o){this.children=this.children.filter(x=>x!==o);o.parent=null;}
    updateMatrixWorld(){}
    traverse(fn){fn({isMesh:true,isSkinnedMesh:true});}
}
class Action{
    constructor(clip){this.clip=clip;this.paused=false;}
    setLoop(){return this;}
    reset(){return this;}
    play(){this.played=true;return this;}
    stop(){this.stopped=true;return this;}
}
class Mixer{
    constructor(scene){this.scene=scene;this.actions={};this.elapsed=0;}
    clipAction(clip){return this.actions[clip.name]||(
        this.actions[clip.name]=new Action(clip));}
    update(dt){this.elapsed+=dt;}
}
const maleScene=new Group();
const fakeGltf={scene:maleScene,animations:[
    {name:'Running',tracks:[1]},{name:'Walking',tracks:[1]},
    {name:'Aim_Pistol',tracks:[1]},
    {name:'Shoot_Pistol',tracks:[1]},
    {name:'Shoot_From_Idle',tracks:[1]}
]};
const THREE={
    Group,AnimationMixer:Mixer,LoopRepeat:2201,
    GLTFLoader:class {
        load(url,onLoad){
            assert.equal(url,'./'+ASSET);
            onLoad(fakeGltf);
        }
    },
    Box3:class {
        constructor(){
            this.min={x:-.59,y:0,z:-.184};
            this.max={x:.417,y:1.87,z:.184};
        }
        setFromObject(){return this;}
        getSize(out){out.x=1.007;out.y=1.87;out.z=.368;return out;}
    },
    Vector3:class {}
};
const ctx=vm.createContext({THREE,Math,Number,Promise});
const Male=vm.runInContext(SCRIPT+';DriverMalePedestrian',ctx);
const ped=()=>({mesh:new Group(),walkSpeed:2.64});
test('one male uses index 1, woman retains index 0; walk and running are animated',async()=>{
    const manager={pedestrians:[ped(),ped(),ped()]};
    for(const p of manager.pedestrians)p.mesh.add(new Group());
    const male=new Male(manager);
    assert.equal(await male.load(),true);
    assert.equal(male.status().state,'ready');
    assert.equal(manager.pedestrians[0].glbMale,undefined);
    assert.equal(manager.pedestrians[1].glbMale,true);
    assert.equal(manager.pedestrians[2].glbMale,undefined);
    assert.equal(male.root.rotation.y,0);
    assert(Math.abs(male.root.scale.value-2.08/1.87)<1e-5);
    assert.equal(male.container.position.y,0);
    assert.equal(manager.pedestrians[1].mesh.children[0].visible,false);
    assert.equal(male.status().animations.length,5);
    manager.pedestrians[1].mesh.visible=true;
    male.update(manager.pedestrians[1],.016,true,false);
    assert.equal(male.action.clip.name,'Walking');
    assert(male.mixer.elapsed>0);
    male.update(manager.pedestrians[1],.016,true,true);
    assert.equal(male.action.clip.name,'Running');
    male.update(manager.pedestrians[1],.016,false,false);
    assert.equal(male.action.paused,true);
    assert.equal(male.status().active,true);
    male.release();
    assert.equal(manager.pedestrians[1].glbMale,false);
    assert.equal(manager.pedestrians[1].mesh.children[0].visible,true);
    assert.equal(male.container.parent,null);
    const old=manager.pedestrians[1];
    manager.pedestrians=[ped(),ped()];
    manager.pedestrians[1].mesh.add(new Group());
    assert.equal(male.attachToPedestrian(),true);
    assert.notEqual(male.current,old);
    assert.equal(male.lastMoving,false);
    manager.pedestrians[1].mesh.visible=true;
    male.update(manager.pedestrians[1],.016,true,false);
    assert.equal(male.action.paused,false);
});
test('game wires the model without replacing all pedestrians',()=>{
    assert(INDEX.includes('src="./js/assets/driver-male-pedestrian.js"'));
    assert(INDEX.indexOf('driver-male-pedestrian.js')<
        INDEX.indexOf('pedestrians-roadblocks.js'));
    assert(MANAGER.includes('new DriverMalePedestrian(this)'));
    assert(MANAGER.includes('this.malePedestrian?.release()'));
    assert(MANAGER.includes('this.malePedestrian?.load()'));
    assert(MANAGER.includes('this.malePedestrian?.update(p,dt,moving,crossing)'));
    assert(MANAGER.includes('!p.glbFemale&&!p.glbMale'));
    assert(MANAGER.includes('(p.glbFemale||p.glbMale)?0'));
    assert(MANAGER.includes('for(let i=0;i<28;i++)'));
});
test('missing GLTF loader preserves default procedural male',async()=>{
    const broken=new Function('THREE',SCRIPT+';return DriverMalePedestrian')({
        Group:class{}
    });
    const a=new broken({pedestrians:[ped(),ped()]});
    assert.equal(await a.load(),false);
    assert.equal(a.state,'unsupported');
    assert.equal(a.current,null);
});
