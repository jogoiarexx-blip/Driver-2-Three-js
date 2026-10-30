'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const captured=[];
const Plan=vm.runInNewContext(
 fs.readFileSync('js/world/chicago-city-plan.js','utf8')+
 '\nDriverChicagoCityPlan',
 {Math,Number,DriverSpecialStructures:{pack(parent,parts,name){
     captured.push({parts,name});
     return [];
 }}});
const examples=[
 ['wicker-park',-280,120,'residential'],
 ['goose-island',-200,200,'industrial'],
 ['greektown',-120,-40,'commercial'],
 ['gold-coast',200,120,'apartment'],
 ['downtown',60,-70,'tower']
];
function reportFor(type,x,z){
 const parcel=Plan.lots(x,z).find(l=>l.kind===type);
 assert(parcel,'no parcel of type '+type);
 const colliders=[{minX:-1,maxX:1,minZ:-1,maxZ:1}];
 const c={buildingBoxes:colliders,districtBuildings:[parcel]};
 const original=JSON.stringify(colliders);
 captured.length=0;
 const stats=Plan.detailDistrict(c,[parcel],{});
 assert.equal(JSON.stringify(colliders),original,'visual detail modified collision');
 assert.equal(stats.lots,1);
 assert(stats.windows>=4,type+' must have real windows');
 assert.equal(captured.length,1);
 assert.equal(captured[0].name,'chicago-r21-ps1-lot-facades');
 return {parcel,parts:captured[0].parts,stats};
}
test('PS1-style facades exist independently in five Chicago district styles',()=>{
 for(const [id,x,z,kind] of examples){
  const d=Plan.districtAt(x,z);
  assert.equal(d.id,id);
  const {parts,stats}=reportFor(kind,x,z);
  assert(parts.length>12,kind+' missing facade');
  assert(stats.windows>=4);
  for(const p of parts)assert(p.slice(0,6).every(Number.isFinite));
 }
});
test('every storefront, window and roof element is bound to its own narrow lot',()=>{
 for(const [id,x,z,kind] of examples){
  const {parcel:b,parts}=reportFor(kind,x,z);
  for(const p of parts){
   const [x,,z,w,,depth]=p;
   const overX=Math.max(0,Math.abs(x-b.x)+w/2-b.width/2);
   const overZ=Math.max(0,Math.abs(z-b.z)+depth/2-b.depth/2);
   assert(overX<=1.12,`${kind} window protrudes ${overX.toFixed(2)}m sideways`);
   assert(overZ<=1.12,`${kind} detail protrudes ${overZ.toFixed(2)}m from lot`);
  }
 }
});
test('red-brick dwellings have iron fire-escape elements, industrial has loading bays',()=>{
 const res=reportFor('residential',-280,120);
 const ind=reportFor('industrial',-200,200);
 assert(res.stats.fireEscapes>0,'residential missing fire escapes');
 assert.equal(res.stats.industrialDoors,0);
 assert(ind.stats.industrialDoors>0);
 assert.equal(ind.stats.fireEscapes,0);
});
test('no random layout changes between renders and never rewrites story locations',()=>{
 const c={buildingBoxes:[{minX:7,maxX:9,minZ:1,maxZ:2}]};
 const p=Plan.lots(-280,120)[0];
 const run=()=>{
  captured.length=0;
  Plan.detailDistrict(c,[p],{});
  return JSON.stringify(captured[0].parts);
 };
 assert.equal(run(),run());
 assert.deepEqual(c.buildingBoxes,[{minX:7,maxX:9,minZ:1,maxZ:2}]);
});
test('full Chicago parcel facades are built only in LOD chunks, not in every frame',()=>{
 const builder=fs.readFileSync('js/world/city-builder.js','utf8');
 const code=fs.readFileSync('js/world/chicago-city-plan.js','utf8');
 assert.match(builder,/DriverChicagoCityPlan\.detailDistrict\(this,chunk\.buildings,group\)/);
 assert.match(builder,/const legacyBuildings=chunk\.buildings\.filter\(b=>!b\.planned\)/);
 assert.match(code,/chicago-r21-ps1-lot-facades/);
});

test('brick districts cannot accidentally receive blue glass tower palette',()=>{
 const west=Plan.lots(-280,120);
 const industry=Plan.lots(-200,200);
 const loop=Plan.lots(60,-70);
 assert(west.every(b=>[1,2].includes(b.palette)));
 assert(industry.every(b=>[1,2].includes(b.palette)));
 assert(loop.every(b=>[0,1,3].includes(b.palette)));
 assert.equal(JSON.stringify(west),JSON.stringify(Plan.lots(-280,120)));
});
