'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let Roster;try{Roster=vm.runInNewContext(fs.readFileSync('js/assets/driver-pedestrian-variants.js','utf8')+'\nDriverPedestrianVariants',{});}catch{}
test('três modelos enviados têm rig e caminhada/corrida e vagas exclusivas',()=>{
 assert(Roster,'cadastro de novos pedestres ausente');const definitions=Roster.DEFINITIONS;
 assert.equal(definitions.length,3);assert.equal(new Set(definitions.map(d=>d.pedestrianIndex)).size,3);
 for(const d of definitions){assert(d.pedestrianIndex>=2&&d.pedestrianIndex<28);assert.equal(d.textureMaxSize,1024);
  const path=decodeURIComponent(d.url.replace(/^\.\//,'')),bytes=fs.readFileSync(path);assert.equal(bytes.toString('ascii',0,4),'glTF');
  const data=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());assert(data.skins.length>0);
  assert(data.animations.some(a=>a.name===d.walkName));assert(data.animations.some(a=>a.name==='Running'));
 }
});
