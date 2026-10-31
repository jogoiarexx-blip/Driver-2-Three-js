'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const modelSource=fs.readFileSync('js/assets/driver-male-pedestrian.js','utf8');
const rosterSource=fs.readFileSync('js/assets/driver-pedestrian-variants.js','utf8');
const Model=vm.runInNewContext(modelSource+'\nDriverMalePedestrian',{});
const Roster=vm.runInNewContext(rosterSource+'\nDriverPedestrianVariants',{});

test('three dogs lock animated scale while children and humans retain their clips',()=>{
    const dogs=Roster.DEFINITIONS.filter(x=>x.species==='dog');
    assert.equal(dogs.length,3);
    assert(dogs.every(x=>x.suppressAnimatedScale===true));
    assert(Roster.DEFINITIONS.filter(x=>x.species==='child').every(x=>!x.suppressAnimatedScale));
    for(const cfg of dogs){
        const source=new Model(null,cfg);
        const clips=[{name:'Armature|Unreal Take|baselayer',tracks:[
            {name:'Armature.scale',values:new Float32Array([1,1,1,100,100,100])},
            {name:'Spine.scale',values:new Float32Array([1,1,1])},
            {name:'Spine.quaternion',values:new Float32Array([0,0,0,1])},
            {name:'Armature.position',values:new Float32Array([0,0,0])}
        ]}];
        const root={traverse(){throw Error('do not repair weights of canine rigs')}};
        source.repairRigAndAnimations(root,clips);
        assert.equal(source.visualRepairs.scaleTracksRemoved,2,cfg.id);
        assert.equal(clips[0].tracks.length,2,cfg.id);
        assert.equal(clips[0].tracks[0].name,'Spine.quaternion');
        assert.equal(clips[0].tracks[1].name,'Armature.position');
    }
});

test('canine uploads use 0.01-scale Armature; preserve reference pose',()=>{
    for(const cfg of Roster.DEFINITIONS.filter(x=>x.species==='dog')){
        const name=decodeURIComponent(cfg.url.replace(/^\.\//,''));
        const file=fs.readFileSync(name);
        const data=JSON.parse(file.subarray(20,20+file.readUInt32LE(12)).toString());
        assert(data.skins?.length>0,cfg.id);
        assert(data.animations?.length>0,cfg.id);
        const sceneNodes=data.scenes?.[data.scene||0]?.nodes||[];
        const armature=sceneNodes.map(i=>data.nodes[i]).find(n=>
            n.name?.toLowerCase().includes('armature'));
        assert(armature?.scale?.[0]<=.02&&armature.scale[0]>.001,
            'cão não usa o scale de origem esperado: '+cfg.id);
    }
});
