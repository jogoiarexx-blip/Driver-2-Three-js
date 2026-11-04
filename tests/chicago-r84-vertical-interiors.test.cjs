'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs');
const M=require('../js/world/chicago-vertical-interiors-r84.js');
function fake(){
 const lots=[
 {id:'gr',pilotR78:true,blockX:-120,blockZ:-200,frontageSide:1,
  interiorTier:'shell-planned',x:-128,z:-185.8,depth:14},
 {id:'pr',pilotR78:true,blockX:40,blockZ:-200,frontageSide:1,
  interiorTier:'shell-planned',x:32,z:-185.8,depth:14}
 ];
 const city={preset:{id:'chicago'},districtBuildings:lots,
 interiors:[{id:'home',inside:{x:1000,z:0}}],
 isWaterAt:()=>false,isPointBlocked:()=>false,
 cityGroup:{children:[],
  add(g){this.children.push(g)},
  remove(g){this.children=this.children.filter(x=>x!==g)}}};
 return city;
}
test('R84: register two existing R78 shell slots, not fake extra buildings',()=>{
 const c=fake();
 assert.equal(M.register(c),2);
 assert.equal(M.register(c),0);
 assert.equal(c.interiors.length,3);
 assert.equal(c.districtBuildings.filter(b=>b.interiorTier==='partial').length,2);
 assert.equal(M.prepare(c),2);
 assert.equal(M.prepare(c),0);
 assert.equal(c.chicagoVerticalInteriorsR84.prepared,2);
 assert.deepEqual(c.interiors.slice(1).map(p=>p.id),
  ['r84-greektown-loft','r84-prairie-office']);
 assert.equal(c.interiors[1].r84Blueprint.stairs.length,24);
 assert.equal(c.interiors[2].r84Blueprint.stairs.length,0);
 assert.deepEqual(c.interiors[1].r84Blueprint.floorLevels,[0,3.6,7.2]);
 assert.deepEqual(c.interiors[2].r84Blueprint.floorLevels,[0]);
 assert(M.nearRoom(c,660,0));
 assert.equal(M.nearRoom(c,1000,0),null);
 assert.equal(M.nearRoom({...c,preset:{id:'havana'}},660,0),null);
});
test('R84: physical boxes and door collision use the exact visual blueprint',()=>{
 const c=fake();M.register(c);M.prepare(c);
 for(const room of c.interiors.slice(1)){
  const b=room.r84Blueprint;
  assert.equal(b.doors.length,1);
  assert(M.blocked(c,b.x-4,b.z,.55,0),'closed door physically blocked');
  assert(!M.blocked(c,b.x,b.z-6,.55,0),'spawn free');
  assert(!M.blocked(c,b.x,b.z-8.8,.55,0),'exit free');
  assert(M.blocked(c,b.x-4,b.z+5,.55,0),'real partition wall');
  assert(M.blocked(c,b.x+11.4,b.z,.55,0),'physical shell');
  for(const p of b.parts.filter(p=>p.solid)){
   assert(b.colliders.some(box=>
    Math.abs((box.minX+box.maxX)/2-p.x)<1e-8&&
    Math.abs((box.minZ+box.maxZ)/2-p.z)<1e-8&&
    Math.abs(box.maxY-box.minY-p.h)<1e-8),
    'invisible collision or missing visual '+p.label);
  }
  const near={x:b.x-2.8,y:0,z:b.z};
  assert.equal(M.interact(c,room,near),'PORTA ABERTA');
  assert.equal(M.blocked(c,b.x-4,b.z,.55,0),false);
  assert.equal(M.interact(c,room,{x:b.x-4,y:0,z:b.z}),
   'Afaste-se da passagem antes de fechar.');
  assert.equal(M.interact(c,room,near),'PORTA FECHADA');
  assert.equal(M.blocked(c,b.x-4,b.z,.55,0),true);
 }
});
test('R84: Tanner really climbs all 24 steps without teleport, blocked side access',()=>{
 const c=fake();M.register(c);M.prepare(c);
 const b=c.interiors[1].r84Blueprint;
 const steps=b.parts.filter(p=>p.label.startsWith('stair-'));
 assert.equal(steps.length,24);
 steps.forEach((p,i)=>{
  assert.equal(p.solid,false);
  assert(Math.abs(p.y+p.h/2-b.stairs[i].top)<1e-9);
 });
 assert.equal(M.heightAt(c,b.x+6.5,b.z-8.0,0),0);
 assert.equal(M.heightAt(c,b.x+6.5,b.z-7.3,0),.3);
 assert.equal(M.heightAt(c,b.x+6.5,b.z+8.5,7.2),7.2);
 assert.equal(M.heightAt(c,b.x+9,b.z-.7,3.6),3.6);
 assert.equal(M.heightAt(c,b.x+9,b.z-.7,0),0);
 assert.equal(M.heightAt(c,b.x+9,b.z+8.5,0),0,
  'no invisible platform when walking on the lower floor');
 assert.equal(M.heightAt(c,b.x+9,b.z+8.5,7.2),7.2);
 assert.equal(M.safeStep(c,b.x+9,b.z+8.5,0,
  b.x+9,b.z+8.4,7.2),false);
 let y=0,z=b.z-8.2,moves=0,stuck=0;
 for(let i=0;i<120;i++){
  const nz=z+.136,ny=M.heightAt(c,b.x+6.5,nz,y);
  if(M.safeStep(c,b.x+6.5,z,y,b.x+6.5,nz,ny)&&
     !M.blocked(c,b.x+6.5,nz,.55,ny)){
   y=ny;z=nz;moves++;
  }else stuck++;
 }
 assert.equal(moves,120);
 assert.equal(stuck,0);
 assert.equal(y,7.2);
 assert(z>b.z+7.4);
 assert(M.blocked(c,b.x+4.95,b.z,.55,3.6),'rails stop side access');
});
test('R84: refuse underwater and obstructed entrances, no foreign-city changes',()=>{
 const c=fake();c.preset.id='vegas';
 assert.equal(M.register(c),0);
 c.preset.id='chicago';
 c.isWaterAt=()=>true;
 assert.equal(M.register(c),0);
 c.isWaterAt=()=>false;
 c.isPointBlocked=()=>true;
 assert.equal(M.register(c),0);
 c.isPointBlocked=()=>false;
 assert.equal(M.register(c),2);
});
test('R84: only one instance group active; no redundant GPU allocations on reentry',()=>{
 const c=fake();M.register(c);M.prepare(c);
 let allocations=0,disposes=0;
 class Group{
  constructor(){this.children=[]}
  add(m){this.children.push(m)}
  traverse(fn){this.children.forEach(fn)}
 }
 class Geo{dispose(){disposes++}}
 class Mat{dispose(){disposes++}}
 class Mesh{
  constructor(geometry,material){
   this.geometry=geometry;this.material=material;
   this.position={set:(x,y,z)=>{
    this.position.x=x;this.position.y=y;this.position.z=z}};
  }
 }
 global.THREE={Group,BoxGeometry:Geo,MeshLambertMaterial:Mat,Mesh};
 global.DriverSpecialStructures={pack(g,parts){
  allocations++;assert(parts.length>=10);
  g.add(new Mesh(new Geo(),new Mat()));
 }};
 try{
  const loft=c.interiors[1],office=c.interiors[2];
  assert(M.enter(c,loft));
  assert(M.enter(c,loft));
  assert.equal(allocations,1);
  const d=loft.r84Blueprint.doors[0],z=d.mesh.position.z;
  assert.equal(M.interact(c,loft,{x:loft.inside.x-2.8,y:0,z:0}),
   'PORTA ABERTA');
  assert(d.mesh.position.z>z+3.9);
  assert(M.enter(c,office));
  assert.equal(allocations,2);
  assert.equal(loft.r84Loaded,false);
  assert.equal(office.r84Loaded,true);
  assert.equal(c.cityGroup.children.length,1);
  assert(disposes>=4);
  assert(M.leave(c,office));
  assert.equal(c.cityGroup.children.length,0);
  assert.equal(c.chicagoVerticalInteriorsR84.loadCount,2);
  assert.equal(c.chicagoVerticalInteriorsR84.unloadCount,2);
  assert.equal(M.leave(c,office),false);
 }finally{delete global.THREE;delete global.DriverSpecialStructures}
});
test('R84: connected to city/player/UI/save without touching non-Chicago roads',()=>{
 const code=fn=>fs.readFileSync(fn,'utf8');
 const html=code('index.html'),city=code('js/world/city-builder.js'),
  engine=code('js/engine/driver2-game-engine.js'),
  tanner=code('js/entities/tanner-controller.js'),
  save=code('js/gameplay/home-save.js');
 assert(html.indexOf('chicago-vertical-interiors-r84.js')<
  html.indexOf('city-builder.js'));
 assert(city.includes('DriverChicagoVerticalInteriorsR84.register(this)'));
 assert(city.includes('DriverChicagoVerticalInteriorsR84.heightAt('));
 assert(city.includes('DriverChicagoVerticalInteriorsR84.blocked('));
 assert(tanner.includes('DriverChicagoVerticalInteriorsR84.safeStep('));
 assert(engine.includes('DriverChicagoVerticalInteriorsR84.interact('));
 assert(engine.includes('DriverChicagoVerticalInteriorsR84.enter('));
 assert(engine.includes('DriverChicagoVerticalInteriorsR84.leave('));
 assert(save.includes("'r84-greektown-loft','r84-prairie-office'"));
 const mod=code('js/world/chicago-vertical-interiors-r84.js');
 assert(!mod.includes('buildingBoxes.push'));
 assert(!mod.includes('missionActive='));
 assert(!mod.includes('bridgeRaised='));
});
