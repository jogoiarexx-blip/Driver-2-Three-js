'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs');
const Arch=require('../js/world/chicago-vertical-interiors-r84.js');
const Nav=require('../js/world/chicago-indoor-navigation-r85.js');
global.DriverChicagoVerticalInteriorsR84=Arch;
global.DriverChicagoIndoorNavigationR85=Nav;
function fake(){
 const lots=[
  {id:'gr',pilotR78:true,blockX:-120,blockZ:-200,
   frontageSide:1,interiorTier:'shell-planned',
   x:-128,z:-185.8,depth:14},
  {id:'pr',pilotR78:true,blockX:40,blockZ:-200,
   frontageSide:1,interiorTier:'shell-planned',
   x:32,z:-185.8,depth:14}];
 const c={preset:{id:'chicago'},districtBuildings:lots,
  interiors:[{id:'home',inside:{x:1000,z:0}}],
  isWaterAt:()=>false};
 c.getGroundHeightAt=(x,z,y)=>Arch.heightAt(c,x,z,y);
 c.isPointBlocked=(x,z,r,y)=>Arch.blocked(c,x,z,r,y);
 assert.equal(Arch.register(c),2);
 assert.equal(Arch.prepare(c),2);
 return c;
}
test('R85 enhances existing two R84 interiors once, not streets or new lots',()=>{
 const c=fake(),b=c.interiors[1].r84Blueprint,
  office=c.interiors[2].r84Blueprint;
 assert.equal(c.interiors.length,3);
 assert.equal(b.parts.length,45);
 assert.equal(office.parts.length,15);
 assert.equal(b.doors.length,2);
 assert.equal(office.doors.length,2);
 assert(b.r85Enhanced&&office.r85Enhanced);
 assert.equal(Nav.enhance(Arch,c.interiors[1]),false);
 assert.equal(b.parts.length,45);
 assert.equal(b.colliders.filter(c=>c.label==='upstairs-light-case').length,1);
 assert.equal(b.doors[1].z,-3.2);
 assert.equal(office.doors[1].z,0);
 assert(office.colliders.some(c=>c.label==='r85-office-stool'));
 assert(office.colliders.some(c=>c.label==='r85-office-stool-back'));
 for(const blue of [b,office]){
  assert(blue.parts.length<=45);
  for(const item of blue.parts.filter(x=>x.solid))
   assert(blue.colliders.some(c=>
    Math.abs(c.minX-(item.x-item.w/2))<1e-8&&
    Math.abs(c.maxZ-(item.z+item.d/2))<1e-8),
    'R85 physics must have matching mesh '+item.label);
 }
});
test('R85 closed doors stop sprint-sized moves; opening E actually enables corridor-to-room crossing',()=>{
 const c=fake();
 for(const place of c.interiors.slice(1)){
  const b=place.r84Blueprint,d=b.doors[1];
  const from={x:b.x+1.3,y:0,z:b.z+d.z};
  // The loft's real guardrail begins at x+4.95 beyond the doorway.
  // Test the open doorway itself, not walking through the rail.
  const destination=b.tall?4.05:5.8;
  const to={x:b.x+destination,z:b.z+d.z};
  assert(c.isPointBlocked(b.x+d.x,b.z+d.z,.55,0));
  const before=Nav.move(c,from,to);
  assert(before.x<b.x+2.7,'closed door cannot be crossed by sprint');
  assert.equal(Arch.interact(c,place,from),'PORTA ABERTA');
  assert.equal(c.isPointBlocked(b.x+d.x,b.z+d.z,.55,0),false);
  const after=Nav.move(c,from,to);
  assert(after.x>b.x+destination-.1,
   'open door should be genuinely traversable');
  assert.equal(Arch.interact(c,place,{x:b.x+d.x,y:0,z:b.z+d.z}),
   'Afaste-se da passagem antes de fechar.');
  assert.equal(Arch.interact(c,place,from),'PORTA FECHADA');
  assert(c.isPointBlocked(b.x+d.x,b.z+d.z,.55,0));
 }
});
test('R85 swept collision blocks small office props instead of tunneling',()=>{
 const c=fake(),b=c.interiors[2].r84Blueprint;
 const start={x:b.x+8.7,y:0,z:b.z+.5};
 const end={x:b.x+8.7,z:b.z+4.5};
 const result=Nav.move(c,start,end,.55);
 assert(result.blocked);
 assert(result.z<b.z+1.6,'small stool must stop 4m single-frame teleport');
 const furniture=b.parts.find(p=>p.label==='r85-office-stool');
 assert(furniture&&furniture.solid&&furniture.w<1);
 assert(c.isPointBlocked(furniture.x,furniture.z,.55,0));
 // Even an unbounded delta cannot skip a wall; steps stay <=.22.
 const far=Nav.move(c,{x:b.x+1.3,y:0,z:0},
  {x:b.x+100,z:0},.55);
 assert(far.steps<=24);
 assert(far.x<b.x+2.7);
});
test('R85 physical walking route from spawn through door to all 24 steps works',()=>{
 const c=fake(),room=c.interiors[1],b=room.r84Blueprint;
 let p={x:b.x,y:0,z:-6};
 const walk=(x,z)=>{
  const next=Nav.move(c,p,{x,z});
  assert(!next.blocked,
   'blocked on route '+JSON.stringify({p,x,z,next}));
  p={x:next.x,y:next.y,z:next.z};
 };
 walk(b.x+1.3,-6);
 walk(b.x+1.3,-3.2);
 assert.equal(Arch.interact(c,room,p),'PORTA ABERTA');
 walk(b.x+4.05,-3.2);
 walk(b.x+4.05,-8.2);
 walk(b.x+6.5,-8.2);
 let stuck=0,maxY=0;
 for(let k=0;k<125;k++){
  const result=Nav.move(c,p,{x:p.x,z:p.z+.136});
  if(Math.abs(result.z-p.z)<.00001)stuck++;
  p={x:result.x,y:result.y,z:result.z};
  maxY=Math.max(maxY,p.y);
 }
 assert.equal(stuck,0);
 assert.equal(maxY,7.2);
 assert.equal(p.y,7.2);
 assert(p.z>8);
 assert.equal(c.getGroundHeightAt(b.x+9,b.z+8,0),0);
 assert.equal(c.getGroundHeightAt(b.x+9,b.z+8,7.2),7.2);
});
test('R85 wall slide never crosses physical barrier and preserves outdoor fast path',()=>{
 const c=fake(),b=c.interiors[2].r84Blueprint;
 assert.equal(Nav.move(c,{x:0,y:0,z:0},{x:5,z:0}),null);
 assert.equal(Nav.move({...c,preset:{id:'vegas'}},
  {x:720,y:0,z:0},{x:725,z:0}),null);
 const from={x:b.x+1.5,y:0,z:2.5};
 const target={x:b.x+5.5,z:5.0};
 const res=Nav.move(c,from,target);
 assert(res.x<b.x+2.6,'wall sliding may not cross the closed east partition');
 assert(res.z>from.z,'slide along wall still navigable');
 assert.equal(Nav.move(c,{x:NaN,z:0,y:0},{x:0,z:0}),null);
});
test('R85 adaptive mobile DPR falls only when needed and recovers on higher FPS',()=>{
 const oldWindow=global.window;
 global.window={matchMedia:()=>({matches:true}),
  devicePixelRatio:2};
 const changes=[];
 const game={renderer:{setPixelRatio(r){changes.push(r)}},
  mode:'on_foot',interiorPlace:{id:'r84-greektown-loft'},
  isPaused:false,loadingActive:false};
 try{
  for(let i=0;i<12;i++)Nav.adaptMobileRender(game,.4);
  assert.equal(game._r85MobileRender.mode,'reduced');
  assert.deepEqual(changes,[1]);
  assert.equal(game._r85MobileRender.changes,1);
  for(let i=0;i<420;i++)Nav.adaptMobileRender(game,.016);
  assert.equal(game._r85MobileRender.mode,'normal');
  assert.deepEqual(changes,[1,1.5]);
  // Returning outdoors must not apply a special low-resolution mode.
  game.interiorPlace=null;
  Nav.adaptMobileRender(game,.5);
  assert.equal(game._r85MobileRender.mode,'normal');
  assert.deepEqual(changes,[1,1.5]);
  global.window.matchMedia=()=>({matches:false});
  game.interiorPlace={id:'r84-greektown-loft'};
  for(let i=0;i<12;i++)Nav.adaptMobileRender(game,.4);
  assert.deepEqual(changes,[1,1.5]);
 }finally{
  if(oldWindow===undefined)delete global.window;
  else global.window=oldWindow;
 }
});
test('R85 changes only internal foot physics, R84 GPU, save and loading continue',()=>{
 const read=p=>fs.readFileSync(p,'utf8');
 const html=read('index.html'),arch=read('js/world/chicago-vertical-interiors-r84.js'),
  tanner=read('js/entities/tanner-controller.js'),
  engine=read('js/engine/driver2-game-engine.js'),
  save=read('js/gameplay/home-save.js');
 assert(html.indexOf('chicago-indoor-navigation-r85.js')<
  html.indexOf('city-builder.js'));
 assert(arch.includes('DriverChicagoIndoorNavigationR85.enhance(this,place)'));
 assert(tanner.includes('DriverChicagoIndoorNavigationR85.move('));
 assert(tanner.includes('this.group.position.x=indoor.x;'));
 assert(engine.includes('DriverChicagoIndoorNavigationR85.adaptMobileRender('));
 assert(engine.includes('this.fpsTimer += Math.max(0,Math.min(rawDt,1));'));
 assert(engine.includes('DriverChicagoVerticalInteriorsR84.interact('));
 assert(save.includes('(p.r83Blueprint||p.r84Blueprint).doors.map(d=>d.open)'));
 assert(!read('js/world/chicago-indoor-navigation-r85.js')
  .includes('buildingBoxes.push'));
});
