'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const file=fs.readFileSync('assets/player/Tanner.glb');
const len=file.readUInt32LE(12);
const gltf=JSON.parse(file.subarray(20,20+len).toString('utf8'));
test('Tanner rig inspection: skeleton and animation channels',()=>{
 assert.equal(file.toString('ascii',0,4),'glTF');
 assert.equal(gltf.asset.version,'2.0');
 const skins=gltf.skins||[];
 const nodes=gltf.nodes||[];
 const bones=[...new Set(skins.flatMap(s=>s.joints||[]))];
 const names=bones.map(i=>nodes[i]?.name||('node_'+i));
 const animations=(gltf.animations||[]).map(a=>({
   name:a.name,channels:a.channels?.length,
   tracks:(a.channels||[]).slice(0,5).map(c=>
      (nodes[c.target.node]?.name||c.target.node)+'.'+c.target.path)
 }));
 console.log('TANNER_RIG_AUDIT',JSON.stringify({
   fileBytes:file.length,skins:skins.length,meshCount:gltf.meshes?.length||0,
   bones:names,animations,
   rotationOrder:gltf.asset.generator||'unknown'
 }));
 assert(skins.length>0,'Tanner needs original skeletal rig');
 assert(bones.length>8,'Tanner has insufficient bones');
});
