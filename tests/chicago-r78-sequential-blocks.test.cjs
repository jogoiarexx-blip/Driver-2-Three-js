'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const Blocks=require('../js/world/chicago-block-generator-r78.js');
const Plan=require('../js/world/chicago-city-plan.js');
function mockCity(){
 return {preset:{id:'chicago',palettes:[{}, {},{},{}]},
  districtChunks:new Map(),districtBuildings:[],buildingBoxes:[],
  interiors:[],cityGroup:{},
  isWaterAt:()=>false,isPointBlocked(x,z,r=0){
   return this.buildingBoxes.some(b=>
    x+r>b.minX&&x-r<b.maxX&&z+r>b.minZ&&z-r<b.maxZ);
  }};
}
test('R78: 9 intentionally chosen blocks remain on old safe grid until original street survey passes',()=>{
 assert.equal(Blocks.PILOTS.length,9);
 const ids=new Set(Blocks.PILOTS.map(p=>p.x+','+p.z));
 assert.equal(ids.size,9);
 for(const p of Blocks.PILOTS){
  assert.equal((p.x+40)%80===0,true);
  assert.equal((p.z+40)%80===0,true);
  assert.equal(Plan.isProtected(p.x,p.z),false);
  assert.equal(Blocks.pilotAt(p.x,p.z),p);
  assert(!require('../js/world/chicago-ps1-coastline.js')
    .waterAt(p.x,p.z),'pilot not on water: '+p.x+','+p.z);
 }
 assert.equal(Blocks.pilotAt(-120,-120),null);
 assert.equal(Blocks.pilotAt(40,120),null,'R77 Marina City stays untouched');
});
test('R78: every pilot produces continuous house/shop frontages, a real center service gap and deterministic shapes',()=>{
 let n=0,full=0,shell=0;
 for(const p of Blocks.PILOTS){
  const arr=Blocks.lots(p.x,p.z,'tower');
  assert.deepEqual(arr,Blocks.lots(p.x,p.z,'tower'));
  assert.equal(arr.length,p.style==='industrial'?6:10);
  assert.equal(new Set(arr.map(b=>b.id)).size,arr.length);
  n+=arr.length;
  full+=arr.filter(b=>b.interiorTier==='full').length;
  shell+=arr.filter(b=>b.interiorTier==='shell-planned').length;
  for(const b of arr){
   assert(b.width>0&&b.depth>0&&b.height>0);
   assert.equal(b.planned,true);
   assert.equal(b.pilotR78,true);
   assert.equal(b.sourceGeometryCertified,false);
   assert(Math.abs(b.x-p.x)+b.width/2<=21.51);
   assert(Math.abs(b.z-p.z)+b.depth/2<=21.51);
   assert(Math.abs(b.z-p.z)-b.depth/2>=5.5,
    'central service space must be unobstructed');
   assert(['facade-only','shell-planned','full'].includes(b.interiorTier));
  }
  for(const side of [-1,1]){
   const seq=arr.filter(b=>b.frontageSide===side).sort((a,b)=>a.x-b.x);
   for(let i=1;i<seq.length;i++){
    const gap=(seq[i].x-seq[i].width/2)-
              (seq[i-1].x+seq[i-1].width/2);
    assert(gap>=.09&&gap<.5,'successive facades must be nearly touching');
   }
  }
 }
 assert.equal(n,86); // 8 blocks × 10 + 1 industrial × 6
 assert.equal(full,2);
 assert(shell>=8);
});
test('R78: generated lots replace R14 objects and use identical visual + AABB footprints',()=>{
 const city=mockCity();
 for(const site of Blocks.PILOTS)
  Plan.addBlock(city,site.x,site.z);
 assert.equal(city.chicagoCityPlan.r78PilotBlocks,9);
 assert.equal(city.chicagoCityPlan.r78Frontages,86);
 assert.equal(city.buildingBoxes.length,86);
 assert.equal(city.districtBuildings.length,86);
 for(let i=0;i<city.districtBuildings.length;i++){
  const lot=city.districtBuildings[i],b=city.buildingBoxes[i];
  assert.equal(b.maxX-b.minX,lot.width);
  assert.equal(b.maxZ-b.minZ,lot.depth);
  assert.equal(b.minX,lot.x-lot.width/2);
  assert.equal(b.maxZ,lot.z+lot.depth/2);
 }
 // The existing GTA/Driver-style grid and neighboring R69 alleys cannot
 // be killed by a building centered in the road or an invisible AABB.
 for(const p of Blocks.PILOTS){
  for(const direction of [-1,1]){
   assert.equal(city.isPointBlocked(p.x+direction*28,p.z,.5),false,
    'no collider extends into inherited street edge');
  }
 }
});
test('R78: two true playable interiors registered through the original door/exit system',()=>{
 const city=mockCity();
 for(const site of Blocks.PILOTS)
  Plan.addBlock(city,site.x,site.z);
 assert.equal(city.chicagoCityPlan.r78EnterableRooms,2);
 assert.deepEqual(city.interiors.map(i=>i.id),
  ['r78-loop-shop','r78-goose-warehouse']);
 for(const place of city.interiors){
  assert.equal(place.accessible,true);
  assert.equal(place.storyCritical,false);
  assert(!city.isPointBlocked(place.door.x,place.door.z+4,.3));
  assert(!city.isWaterAt(place.door.x,place.door.z+4));
  assert(Number.isFinite(place.inside.x));
 }
 const before=city.interiors.length;
 // Repeated registration must not create duplicate trigger/room ids.
 Blocks.registerInteriors(city,city.districtBuildings);
 assert.equal(city.interiors.length,before);
 const blocked=mockCity();
 blocked.isWaterAt=(x,z)=>z>=-15;
 Plan.addBlock(blocked,40,-40);
 assert.equal(blocked.interiors.length,0,'do not create a door into water');
});
test('R78: decorative frontage detail batches in one PS1-friendly call and never writes collision',()=>{
 const city=mockCity();
 Plan.addBlock(city,40,-40);
 const before=city.buildingBoxes.length,parts=[];
 global.DriverSpecialStructures={pack(parent,pieces,name){
  parts.push({pieces,name});return [];}};
 const stats=Blocks.decorateChunk(city,city.districtBuildings,{});
 assert.equal(parts.length,1);
 assert(parts[0].name.includes('r78-sequential-frontages'));
 assert(stats.facades===10&&stats.full===1);
 assert(parts[0].pieces.length>20);
 assert.equal(city.buildingBoxes.length,before);
 delete global.DriverSpecialStructures;
});
test('R78: protected areas, R77 skyline, other cities, and existing alleys keep their behavior',()=>{
 assert.equal(Plan.lots(-280,120).length,6,'original R69 alley house layout unchanged');
 assert.equal(Blocks.lots(-120,-120),null);
 for(const p of [[-120,-120],[120,120],[-280,200],[280,-280]])
  assert(Plan.isProtected(...p));
 const city=mockCity();city.preset.id='rio';
 assert.equal(Blocks.plan(city,40,-40,'tower'),null);
 const html=fs.readFileSync('index.html','utf8'),builder=fs.readFileSync('js/world/city-builder.js','utf8');
 assert(html.includes('js/world/chicago-block-generator-r78.js'));
 assert(html.indexOf('chicago-block-generator-r78.js')<html.indexOf('chicago-city-plan.js'));
 assert(builder.includes('DriverChicagoBlockGeneratorR78.decorateChunk'));
 assert(!/registerRoad\(|trafficGraph\.add|missionActive\s*=/.test(
  fs.readFileSync('js/world/chicago-block-generator-r78.js','utf8')));
});
