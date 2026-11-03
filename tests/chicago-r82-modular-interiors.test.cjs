'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs');
const R82=require('../js/world/chicago-modular-interiors-r82.js');
function fakeCity(){
 let adds=0,removes=0;
 const city={preset:{id:'chicago'},interiors:[
  {id:'home',inside:{x:1000,z:0},door:{x:0,z:0}},
  {id:'r78-loop-shop',inside:{x:1300,z:0},door:{x:-40,z:-20}},
  {id:'r78-goose-warehouse',inside:{x:1360,z:0},
    door:{x:-200,z:145}},
  {id:'r81-goose-yard-office',inside:{x:1440,z:0},
    door:{x:-214.2467,z:143.9},interiorLevel:'partial'}
 ],cityGroup:{children:[],
   add(g){this.children.push(g);adds++;},
   remove(g){this.children=this.children.filter(x=>x!==g);removes++}},
 };
 city.metrics=()=>({adds,removes});
 return city;
}
test('R82: exactly 3 managed modular interiors, 3 genuinely connected rooms each',()=>{
 const c=fakeCity(),prepared=R82.prepare(c);
 assert.equal(prepared,3);
 assert.equal(c.chicagoModularInteriorsR82.prepared,3);
 for(const p of c.interiors.slice(1)){
  const b=p.r82Blueprint;
  assert.equal(b.rooms.length,3);
  assert.equal(b.doors.length,2);
  assert(b.parts.length>=16);
  assert(b.colliders.length>=7);
  assert(b.parts.some(e=>e.solid&&e.label==='partition-upper'));
  assert.equal(b.originalPS1InteriorCertified,false);
  assert.equal(b.multiStorey,false);
  assert.equal(p.r82Loaded,false);
  assert.equal(p.r82Group,undefined);
  assert.equal(R82.blocked(c,b.x+3.8,b.z+5.3,.4),true);
  assert.equal(R82.blocked(c,b.x-3.8,b.z-5.1,.4),true);
  assert.equal(R82.blocked(c,b.x+3.8,b.z,.55),false,
   'true east doorway cannot be blocked');
  assert.equal(R82.blocked(c,b.x-3.8,b.z,.55),false,
   'true west doorway cannot be blocked');
  assert.equal(R82.blocked(c,b.x,b.z-6,.55),false,'spawn must be free');
  assert.equal(R82.blocked(c,b.x,b.z-8.8,.55),false,'exit must be free');
  assert.equal(R82.blocked(c,b.x+6,b.z,.55),false,
   'walkable into the right hand side room');
  assert.equal(R82.blocked(c,b.x-5,b.z,.55),false,
   'walkable through left hand door');
  for(const part of b.parts.filter(p=>p.solid)){
   const match=b.colliders.find(box=>
    Math.abs((box.minX+box.maxX)/2-part.x)<1e-8&&
    Math.abs((box.minZ+box.maxZ)/2-part.z)<1e-8&&
    Math.abs(box.maxX-box.minX-part.w)<1e-8&&
    Math.abs(box.maxZ-box.minZ-part.d)<1e-8);
   assert(match,'solid mesh without matching AABB: '+part.label);
  }
 }
 assert.equal(R82.prepare(c),0,'rebuild must be idempotent');
 assert.equal(R82.manages(c.interiors[0]),false);
 assert.equal(R82.managesPoint(c,1000,0),false);
 assert.equal(R82.blocked(c,1000,0),false);
 assert.equal(R82.managesPoint(c,1440,0),true);
});
test('R82: actual on-foot walk path from spawn via both OPEN doorways to both rooms',()=>{
 const city=fakeCity();R82.prepare(city);
 function reachable(src,target,r=.55){
  const grid=0.6,p=src.r82Blueprint;
  const start=[Math.round(p.x/grid),Math.round((p.z-6)/grid)],
    goal=[Math.round((p.x+target[0])/grid),
          Math.round((p.z+target[1])/grid)];
  const key=(a,b)=>a+':'+b,queue=[start],visited=new Set([key(...start)]);
  for(let i=0;i<queue.length;i++){
   if(i>3000)break;
   const [x,z]=queue[i];
   if(Math.hypot(x-goal[0],z-goal[1])<=1)return true;
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=x+dx,nz=z+dz,
      px=nx*grid,pz=nz*grid;
    const k=key(nx,nz);
    if(visited.has(k)||Math.abs(px-p.x)>10.6||
       Math.abs(pz-p.z)>9.5||R82.blocked(city,px,pz,r))continue;
    visited.add(k);queue.push([nx,nz]);
   }
  }
  return false;
 }
 for(const place of city.interiors.slice(1)){
  assert(reachable(place,[-5,0]),'west room unreachable '+place.id);
  assert(reachable(place,[6,0]),'east room unreachable '+place.id);
  assert(reachable(place,[0,-8.4]),'cannot reach exit '+place.id);
 }
});
test('R82: visual parts allocated ONLY when entering and disposed on exit (no GPU leaks)',()=>{
 const city=fakeCity();R82.prepare(city);
 let disposes=0,packs=0;
 class Group{constructor(){this.children=[];this.userData={};}add(v){this.children.push(v)}}
 global.THREE={Group};
 global.DriverSpecialStructures={pack(group,parts,name){
  packs++;assert(parts.length>=16);
  const geo={dispose(){disposes++}},
   mat={dispose(){disposes++}},
   mesh={geometry:geo,material:mat};
  group.add(mesh);
  return [mesh];
 }};
 try{
  const shop=city.interiors[1],warehouse=city.interiors[2];
  assert.equal(city.cityGroup.children.length,0);
  assert(R82.enter(city,shop));
  assert.equal(shop.r82Loaded,true);
  assert.equal(city.chicagoModularInteriorsR82.liveRoomId,shop.id);
  assert.equal(city.cityGroup.children.length,1);
  assert(R82.enter(city,shop));assert.equal(packs,1);
  // Switching to a new room immediately releases the previous one.
  assert(R82.enter(city,warehouse));
  assert.equal(shop.r82Loaded,false);
  assert.equal(warehouse.r82Loaded,true);
  assert.equal(city.cityGroup.children.length,1);
  assert.equal(disposes,2);
  assert(R82.leave(city,warehouse));
  assert.equal(disposes,4);
  assert.equal(city.cityGroup.children.length,0);
  assert.equal(R82.leave(city,warehouse),false);
  assert.equal(city.chicagoModularInteriorsR82.loadCount,2);
  assert.equal(city.chicagoModularInteriorsR82.unloadCount,2);
  assert.equal(city.chicagoModularInteriorsR82.liveRoomId,null);
  // Collision persists after disposing visuals: no door to nowhere.
  assert.equal(R82.blocked(city,shop.inside.x+3.8,5.3,.4),true);
  assert.equal(R82.enter(city,shop),true);
  assert.equal(packs,3);
  assert(R82.leave(city,shop));
 }finally{
  delete global.THREE;delete global.DriverSpecialStructures;
 }
});
test('R82: one-floor distinction, legacy home and city boundaries remain intact',()=>{
 const c=fakeCity();
 c.preset.id='rio';
 assert.equal(R82.prepare(c),null);
 assert.equal(R82.enter(c,c.interiors[1]),false);
 assert.equal(R82.managesPoint(c,1300,0),false);
 c.preset.id='chicago';R82.prepare(c);
 assert.equal(c.interiors[1].r82Status,'complete-single-floor');
 assert.equal(c.interiors[2].r82Status,'complete-single-floor');
 assert.equal(c.interiors[3].r82Status,'partial-single-floor');
 assert.equal(c.interiors[0].r82Blueprint,undefined);
 assert.equal(R82.manages({id:'diner'}),false);
});
test('R82: integrated into real game, no mission edits and no off-world colliders in traffic graph',()=>{
 const html=fs.readFileSync('index.html','utf8'),
 city=fs.readFileSync('js/world/city-builder.js','utf8'),
 engine=fs.readFileSync('js/engine/driver2-game-engine.js','utf8'),
 r81=fs.readFileSync('js/world/chicago-goose-industrial-r81.js','utf8'),
 mod=fs.readFileSync('js/world/chicago-modular-interiors-r82.js','utf8');
 assert(html.indexOf('chicago-modular-interiors-r82.js')<
        html.indexOf('city-builder.js'));
 assert(city.includes('DriverChicagoModularInteriorsR82.prepare(this)'));
 assert(city.includes('DriverChicagoModularInteriorsR82.blocked('));
 assert(engine.includes('DriverChicagoModularInteriorsR82.enter(this.city,place)'));
 assert(engine.includes('DriverChicagoModularInteriorsR82.leave(this.city,place)'));
 assert(r81.includes('DriverChicagoModularInteriorsR82.manages(place)'));
 assert(!mod.includes('city.buildingBoxes.push'));
 assert(!/bridgeRaised\s*=|missionActive\s*=|garageExit\s*=/.test(mod));
});
