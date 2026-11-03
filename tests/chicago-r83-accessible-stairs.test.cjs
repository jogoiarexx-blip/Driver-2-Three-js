'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs');
const R83=require('../js/world/chicago-accessible-interiors-r83.js');

function mockCity(){
 const lots=[
  {id:'r78--40--200-1-1',pilotR78:true,blockX:-40,blockZ:-200,
   frontageSide:1,interiorTier:'shell-planned',x:-48,z:-185.8,
   width:8,depth:14},
  {id:'r78--280--200-1-1',pilotR78:true,blockX:-280,blockZ:-200,
   frontageSide:1,interiorTier:'shell-planned',x:-288,z:-185.8,
   width:8,depth:14}
 ];
 const city={preset:{id:'chicago'},districtBuildings:lots,interiors:[
  {id:'home',inside:{x:1000,z:0}}
 ],isWaterAt:()=>false,isPointBlocked:()=>false,
 cityGroup:{children:[],
  add(g){this.children.push(g)},
  remove(g){this.children=this.children.filter(v=>v!==g)}}
 };
 return city;
}
test('R83 registers exactly two existing R78 shell-planned lots, no new street geometry',()=>{
 const c=mockCity();
 assert.equal(R83.register(c),2);
 assert.equal(R83.register(c),0);
 assert.equal(c.interiors.length,3);
 assert.equal(c.districtBuildings.filter(b=>b.interiorTier==='partial').length,2);
 assert.equal(R83.prepare(c),2);
 assert.equal(R83.prepare(c),0);
 assert.equal(c.chicagoAccessibleInteriorsR83.prepared,2);
 assert(!R83.manages(c.interiors[0]));
 assert(R83.manages(c.interiors[1]));
 assert.equal(c.interiors[1].r83Blueprint.mezzanine,true);
 assert.equal(c.interiors[2].r83Blueprint.multiStorey,false);
 assert.equal(c.interiors[1].r83Blueprint.stairs.length,12);
 assert.equal(c.interiors[2].r83Blueprint.stairs.length,0);
 for(const place of c.interiors.slice(1)){
  const b=place.r83Blueprint;
  assert.equal(b.doors.length,2);
  assert.equal(b.doors.every(d=>d.open===false),true);
  assert(!R83.blocked(c,b.x,b.z-6,.55,0),'spawn clear');
  assert(!R83.blocked(c,b.x,b.z-8.8,.55,0),'exit clear');
  assert(R83.blocked(c,b.x+3.8,b.z+(b.mezzanine?-5.5:0),.55,0),
   'closed door must have physical collision');
  assert(R83.blocked(c,b.x-3.8,b.z+5,.55,0),'wall physical');
  assert(R83.blocked(c,b.x+11.2,b.z,.55,0),'outer wall');
  for(const part of b.parts.filter(p=>p.solid)){
   const match=b.colliders.find(c=>
    Math.abs((c.maxX+c.minX)/2-part.x)<1e-8&&
    Math.abs((c.maxZ+c.minZ)/2-part.z)<1e-8&&
    Math.abs(c.maxY-c.minY-part.h)<1e-8);
   assert(match,'solid visual geometry missing matching AABB: '+part.label);
  }
 }
});
test('R83 interactive doors: E toggles mesh AND actual collision; cannot shut on Tanner',()=>{
 const c=mockCity();R83.register(c);R83.prepare(c);
 const p=c.interiors[2],b=p.r83Blueprint,d=b.doors[0];
 const near={x:b.x+d.x+1.3,y:0,z:b.z+d.z};
 assert.equal(R83.nearbyDoor(p,near),d);
 assert.equal(R83.interact(c,p,near),'PORTA ABERTA');
 assert.equal(d.open,true);
 assert.equal(R83.blocked(c,b.x+d.x,b.z+d.z,.55,0),false);
 assert.equal(R83.interact(c,p,{x:b.x+d.x,y:0,z:b.z+d.z}),
  'Afaste-se da passagem antes de fechar.');
 assert.equal(d.open,true);
 assert.equal(R83.interact(c,p,near),'PORTA FECHADA');
 assert.equal(d.open,false);
 assert.equal(R83.blocked(c,b.x+d.x,b.z+d.z,.55,0),true);
 assert.equal(R83.nearbyDoor(p,{x:b.x+d.x,y:3.6,z:b.z}),null,
  'upstairs cannot operate ground-floor door through slab');
});
test('R83 stair mesh matches step-top height and blocks impossible jumps to upper floor',()=>{
 const c=mockCity();R83.register(c);R83.prepare(c);
 const b=c.interiors[1].r83Blueprint;
 assert.equal(R83.heightAt(c,b.x+7.2,b.z-6.5),0);
 assert(Math.abs(R83.heightAt(c,b.x+7.2,b.z-5.8)-.3)<1e-8);
 assert(Math.abs(R83.heightAt(c,b.x+7.2,b.z-5.1)-.6)<1e-8);
 assert(Math.abs(R83.heightAt(c,b.x+7.2,b.z+1.35)-3.6)<1e-8);
 assert.equal(R83.heightAt(c,b.x+7.2,b.z+2.5),3.6);
 assert.equal(R83.heightAt(c,b.x+7.2,b.z+6),3.6);
 assert.equal(R83.heightAt(c,b.x+7.2,b.z+6,0),0,
  'ground floor must be walkable beneath the mezzanine');
 assert.equal(R83.heightAt(c,b.x+7.2,b.z+6,3.6),3.6,
  'mezzanine floor must remain at the upper height');
 assert.equal(R83.heightAt(c,b.x,b.z+6),0);
 assert(R83.safeStep(c,b.x+7.2,b.z-6.5,0,b.x+7.2,b.z-5.8,.3));
 assert.equal(R83.safeStep(c,b.x+4.8,b.z+4,0,b.x+4.9,b.z+4,3.6),false);
 assert.equal(R83.safeStep(c,b.x+7.2,b.z+5,3.6,b.x,b.z+5,0),false);
 const steps=b.parts.filter(p=>p.label.startsWith('step-'));
 assert.equal(steps.length,12);
 steps.forEach((p,i)=>{
  assert(Math.abs(p.y+p.h/2-(i+1)*.3)<1e-9);
  assert.equal(p.solid,false,'steps are walkable ground, not AABB walls');
 });
});
test('R83 rejects entry in other cities or blocked/wet exterior and keeps old home',()=>{
 const c=mockCity();
 c.preset.id='rio';
 assert.equal(R83.register(c),0);
 assert.equal(R83.prepare(c),null);
 assert.equal(R83.nearRoom(c,830,0),null);
 c.preset.id='chicago';
 c.isWaterAt=()=>true;
 assert.equal(R83.register(c),0);
 c.isWaterAt=()=>false;
 assert.equal(R83.register(c),2);
 assert.equal(c.interiors[0].id,'home');
});
test('R83 only one live room: door visual slides, geometry disposed and not duplicated',()=>{
 const c=mockCity();R83.register(c);R83.prepare(c);
 let allocations=0,disposals=0;
 class Group {
  constructor(){this.children=[]}
  add(m){this.children.push(m)}
  traverse(fn){for(const child of this.children)fn(child)}
 }
 class Geometry{dispose(){disposals++}}
 class Material{dispose(){disposals++}}
 class Mesh{
  constructor(geometry,material){
   this.geometry=geometry;this.material=material;
   this.position={set:(x,y,z)=>{this.position.x=x;this.position.y=y;this.position.z=z}};
  }
 }
 global.THREE={Group,BoxGeometry:Geometry,MeshLambertMaterial:Material,Mesh};
 global.DriverSpecialStructures={pack(g,parts){
  allocations++;assert(parts.length>15);
  g.add(new Mesh(new Geometry(),new Material()));
 }};
 try{
  const mezz=c.interiors[1],house=c.interiors[2];
  assert(R83.enter(c,mezz));
  assert.equal(c.cityGroup.children.length,1);
  assert.equal(allocations,1);
  assert(R83.enter(c,mezz));assert.equal(allocations,1);
  const d=mezz.r83Blueprint.doors[0];
  const closedZ=d.mesh.position.z;
  const p={x:mezz.inside.x+d.x+1.2,y:0,z:mezz.inside.z+d.z};
  assert.equal(R83.interact(c,mezz,p),'PORTA ABERTA');
  assert(d.mesh.position.z>closedZ+3.9);
  assert(R83.enter(c,house));
  assert.equal(mezz.r83Loaded,false);
  assert.equal(house.r83Loaded,true);
  assert.equal(c.cityGroup.children.length,1);
  assert(disposals>=4,'shared resources disposed on exit');
  assert(R83.leave(c,house));
  assert.equal(c.cityGroup.children.length,0);
  assert.equal(R83.leave(c,house),false);
  assert.equal(c.chicagoAccessibleInteriorsR83.loadCount,2);
  assert.equal(c.chicagoAccessibleInteriorsR83.unloadCount,2);
  assert.equal(c.chicagoAccessibleInteriorsR83.liveRoomId,null);
  assert.equal(d.mesh,null);
 }finally{delete global.THREE;delete global.DriverSpecialStructures}
});
test('R83 hooked into city/player/E/HUD/save and leaves R82 untouched',()=>{
 const files={
  'index.html':'chicago-accessible-interiors-r83.js',
  'js/world/city-builder.js':'DriverChicagoAccessibleInteriorsR83.prepare(this)',
  'js/entities/tanner-controller.js':'DriverChicagoAccessibleInteriorsR83.safeStep(',
  'js/engine/driver2-game-engine.js':'DriverChicagoAccessibleInteriorsR83.interact(',
  'js/gameplay/home-save.js':"'r83-loop-mezzanine','r83-ukrainian-house'"
 };
 for(const [f,token] of Object.entries(files))
  assert(fs.readFileSync(f,'utf8').includes(token),f);
 const html=fs.readFileSync('index.html','utf8');
 assert(html.indexOf('chicago-accessible-interiors-r83.js')<
   html.indexOf('city-builder.js'));
 const src=fs.readFileSync('js/world/chicago-accessible-interiors-r83.js','utf8');
 assert(!src.includes('buildingBoxes.push'));
 assert(!src.includes('missionActive='));
});
