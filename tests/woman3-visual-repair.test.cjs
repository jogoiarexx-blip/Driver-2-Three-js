'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const adapterSource=fs.readFileSync('js/assets/driver-male-pedestrian.js','utf8');
const rosterSource=fs.readFileSync('js/assets/driver-pedestrian-variants.js','utf8');
const Adapter=vm.runInNewContext(adapterSource+'\nDriverMalePedestrian',{});
const Roster=vm.runInNewContext(rosterSource+'\nDriverPedestrianVariants',{});

test('only woman 3 opts into skeletal deformation repair',()=>{
 const cfg=Roster.DEFINITIONS;
 assert.equal(cfg.length,3);
 assert.equal(cfg.find(x=>x.id==='woman-3').repairSkinDeformation,true);
 assert.equal(cfg.find(x=>x.id==='woman-2').repairSkinDeformation,undefined);
 assert.equal(cfg.find(x=>x.id==='mendigo').repairSkinDeformation,undefined);
 assert.equal(cfg.find(x=>x.id==='woman-3').pedestrianIndex,4);
});

test('woman 3 normalizes skin weights and drops unsafe animated scales',()=>{
 let normalized=0;
 const root={traverse(fn){
  fn({isSkinnedMesh:true,normalizeSkinWeights(){normalized++;}});
  fn({isSkinnedMesh:false,normalizeSkinWeights(){throw Error('non-skinned mesh');}});
 }};
 const clips=[
  {name:'Walking_Woman',tracks:[
   {name:'Armature.bones[Spine].scale',values:new Float32Array([1,1,1])},
   {name:'Armature.bones[Spine].rotation',values:new Float32Array([0,0,0,1])},
   {name:'Armature.bones[Head].position',values:new Float32Array([0,NaN,0])}
  ]},
  {name:'Running',tracks:[{name:'Armature.bones[Leg].rotation',values:new Float32Array([0,0,0,1])}]}
 ];
 const model=new Adapter(null,{id:'woman-3',repairSkinDeformation:true});
 model.repairRigAndAnimations(root,clips);
 assert.equal(normalized,1);
 assert.equal(clips[0].tracks.length,1);
 assert.equal(clips[0].tracks[0].name,'Armature.bones[Spine].rotation');
 assert.equal(clips[1].tracks.length,1);
 assert.equal(model.visualRepairs.normalizedSkins,1);
 assert.equal(model.visualRepairs.scaleTracksRemoved,1);
 assert.equal(model.visualRepairs.invalidTracksRemoved,1);
});

test('male pedestrian and woman 2 retain original rig and clips',()=>{
 let normalized=0;
 const root={traverse(){normalized++;}};
 const clips=[{tracks:[{name:'Bone.scale',values:new Float32Array([2,2,2])}]}];
 new Adapter(null,{id:'male'}).repairRigAndAnimations(root,clips);
 assert.equal(normalized,0);
 assert.equal(clips[0].tracks.length,1);
});

test('published woman 3 contains a real skinned, animated GLB',()=>{
 const path='assets/pedestrians/mulher 3.glb';
 const file=fs.readFileSync(path);
 assert.equal(file.toString('ascii',0,4),'glTF');
 assert.equal(file.readUInt32LE(4),2);
 assert.equal(file.readUInt32LE(8),file.length);
 const len=file.readUInt32LE(12);
 const gltf=JSON.parse(file.subarray(20,20+len).toString('utf8'));
 assert(gltf.skins?.length>0,'Missing skeleton');
 assert(gltf.animations?.some(a=>a.name==='Walking_Woman'));
 assert(gltf.meshes?.some(mesh=>mesh.primitives?.some(p=>
  p.attributes?.JOINTS_0!==undefined&&p.attributes?.WEIGHTS_0!==undefined)));
 const channels=gltf.animations.flatMap(a=>a.channels||[]);
 const scaleChannels=channels.filter(c=>c.target?.path==='scale');
 const posChannels=channels.filter(c=>c.target?.path==='translation');
 const skinnedMeshes=gltf.meshes.filter(mesh=>mesh.primitives?.some(p=>p.attributes?.JOINTS_0!==undefined));
 console.log('Mulher 3 / GLB diagnostic:',JSON.stringify({bytes:file.length,skins:gltf.skins.length,skinnedMeshes:skinnedMeshes.length,animations:gltf.animations.map(a=>a.name),scaleChannels:scaleChannels.length,positionChannels:posChannels.length,images:gltf.images?.length||0}));
});
