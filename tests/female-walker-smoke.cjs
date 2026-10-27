/* QA da pedestre feminina: modelo, animação, lifecycle, fallback e GLB. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
class Group {
    constructor(){this.children=[];this.position={y:0};}
    add(node){if(node.parent)node.parent.remove(node);this.children.push(node);node.parent=this;}
    remove(node){this.children=this.children.filter(n=>n!==node);node.parent=null;}
}
class Action {
    setLoop(){return this;}
    play(){this.played=true;return this;}
    reset(){return this;}
}
class Mixer {
    constructor(root){this.root=root;this.action=new Action();this.elapsed=0;}
    clipAction(clip){this.clip=clip;return this.action;}
    update(dt){this.elapsed+=dt;}
}
const createScene=()=>({parent:null,position:{set(){}},rotation:{y:0},
    scale:{value:1,multiplyScalar(s){this.value*=s}},
    updateMatrixWorld(){},traverse(fn){fn({isMesh:true})}});
const fakeGLTF={scene:createScene(),animations:[
    {name:'Walking_Woman',tracks:[{name:'mixamorig:Hips.position'}]}
]};
const THREE={
    GLTFLoader:class {load(url,ok){assert(url.endsWith('/mulher_walk.glb'));ok(fakeGLTF);}},
    Group,AnimationMixer:Mixer,LoopRepeat:2201,
    Box3:class {
        constructor(){this.min={x:-.53,y:0,z:-.2};this.max={x:.53,y:1.72,z:.2};}
        setFromObject(){return this;}
        getSize(v){v.y=1.72;return v;}
    },
    Vector3:class {}
};
const code=fs.readFileSync(path.join(__dirname,'../js/assets/driver-female-pedestrian.js'),'utf8');
const ctx=vm.createContext({THREE});
const C=vm.runInContext(code+';DriverFemalePedestrian;',ctx);
const ped=()=>({mesh:new Group(),walkSpeed:2.5});
(async()=>{
    const a=ped(),manager={pedestrians:[a]};
    a.mesh.add({visible:true,parent:null});
    const woman=new C(manager);
    assert(await woman.load(),'Falha ao carregar GLTF');
    assert.equal(woman.status().state,'ready');
    assert.equal(woman.status().active,true);
    assert.equal(a.glbFemale,true);
    assert(Math.abs(fakeGLTF.scene.scale.value-(2.05/1.72))<.00001,
        'Tamanho errado');
    assert.equal(fakeGLTF.scene.rotation.y,0,
        'Andando de costas: frente do GLB deve ser +Z');
    assert.equal(woman.container.position.y,0,
        'Pés atravessam a calçada');
    assert.equal(a.mesh.children[0].visible,false);
    a.mesh.visible=true;
    woman.update(a,1/60,true,false);
    assert(woman.mixer.elapsed>0,'Animação parou');
    woman.update(a,1/60,false,false);
    assert.equal(woman.action.paused,true);
    woman.release();
    assert.equal(woman.container.parent,null,'Modelo não foi destacado');
    const b=ped();manager.pedestrians=[b];
    assert(woman.attachToFirst(),'Falha ao reinstalar no mapa');
    assert.equal(b.glbFemale,true);
    assert.equal(woman.lastMoving,false,'Animação herdada indevidamente');
    b.mesh.visible=true;
    woman.update(b,1/60,true,false);
    assert.equal(woman.action.paused,false,'Caminhada travada após troca de cidade');
    assert.equal(woman.manager.pedestrians.length,1);
    const file=path.join(__dirname,'../assets/pedestrians/mulher_walk.glb');
    let asset='not-yet-uploaded';
    if(fs.existsSync(file)){
        const raw=fs.readFileSync(file);
        assert.equal(raw.toString('ascii',0,4),'glTF');
        const jsonLen=raw.readUInt32LE(12);
        const gltf=JSON.parse(raw.subarray(20,20+jsonLen).toString());
        assert(gltf.animations?.some(c=>c.name==='Walking_Woman'));
        assert(gltf.skins?.length&&gltf.meshes?.length);
        assert(gltf.meshes[0].primitives[0].attributes.JOINTS_0!==undefined);
        asset='validated';
    }
    console.log(JSON.stringify({status:'PASS',animation:woman.mixer.clip.name,
        cityChange:true,asset,filesize:fs.existsSync(file)?fs.statSync(file).size:null}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
