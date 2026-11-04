'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const Shots=require('../js/gameplay/mission-shots-r87.js');
const Scenes=require('../js/gameplay/campaign-scenes-r86.js');
const source=p=>fs.readFileSync(p,'utf8');
function mockGame(){
 const camera={fov:62,position:{x:3,y:4,z:13},lookCount:0,
  projectionCount:0,lookAt(x,y,z){
   this.lastLook={x,y,z};this.lookCount++;
  },updateProjectionMatrix(){this.projectionCount++;}};
 const group={position:{x:2,y:0,z:3},visible:true};
 return {camera,mode:'on_foot',tanner:{group},
  playerCar:{x:0,y:0,z:1},
  targetCar:{x:18,y:0,z:8},
  stationJones:null,missionType:'story_tipoff',
  missionTimeLeft:157,missionActive:true,
  currentCityKey:'chicago',completedMissions:new Set()};
}
function doc(){
 const map=new Map(),body={appendChild(el){map.set(el.id,el)}};
 map.set('mission-title',{textContent:'STORY TIPOFF'});
 return {body,getElementById:id=>map.get(id),createElement:()=>({
  style:{},dataset:{},textContent:'',attributes:{},
  setAttribute(k,v){this.attributes[k]=v;},
  getAttribute(k){return this.attributes[k];}
 })};
}
test('R87 shot plans correspond to exactly the 15 genuine R86 story missions',()=>{
 const ids=Object.keys(Scenes.STORIES);
 assert.equal(ids.length,15);
 assert.deepEqual(Object.keys(Shots.SHOTS),ids);
 for(const id of ids){
  const cfg=Shots.SHOTS[id];
  assert(['tanner','player','target','jones'].includes(cfg.focus));
  assert(cfg.zoom>=4&&cfg.zoom<=7);
  const game=mockGame();
  const director=new Shots(game,id);
  assert.equal(director.type,id);
  const shot=director.decorate(game.camera,3.2);
  assert.equal(shot.type,id);
  assert(game.camera.fov<62);
  director.release();
  assert.equal(game.camera.fov,62);
 }
 assert.equal(new Shots(mockGame(),'freeroam').type,null);
});
test('R87 aim selects live actor, distant target fallback prevents cross-city camera teleport',()=>{
 const g=mockGame();
 const original={...g.tanner.group.position},
  carBefore={...g.targetCar},timer=g.missionTimeLeft;
 let s=new Shots(g,'story_tipoff');
 let r=s.decorate(g.camera,3.4);
 assert.equal(r.actor,'tanner');
 assert.equal(r.framed,true);
 assert.equal(g.camera.lastLook.x,original.x);
 assert.equal(g.camera.lastLook.z,original.z);
 assert(g.camera.fov<60);
 s.release();assert.equal(g.camera.fov,62);
 s=new Shots(g,'story_witness');
 r=s.decorate(g.camera,3.4);
 assert.equal(r.actor,'targetCar');
 assert.equal(g.camera.lastLook.x,carBefore.x);
 s.release();
 g.targetCar.x=250;g.targetCar.z=-240;
 s=new Shots(g,'story_witness');
 r=s.decorate(g.camera,3.4);
 assert.equal(r.actor,'tanner');
 assert.equal(g.camera.lastLook.x,original.x);
 s.release();
 assert.deepEqual(g.tanner.group.position,original);
 assert.equal(g.missionTimeLeft,timer);
 assert.deepEqual(g.targetCar,{x:250,y:0,z:-240});
});
test('R87 poses the real Jones station actor without moving, cloning or changing mission success',()=>{
 const g=mockGame();
 const arms=[{rotation:{z:0}},{rotation:{z:0}}];
 g.stationJones={position:{x:4,y:0,z:4},
  userData:{r87JonesArms:arms},children:[]};
 const oldPos={...g.stationJones.position};
 const s=new Shots(g,'story_leaving');
 const shot=s.decorate(g.camera,3.5);
 assert.equal(shot.actor,'stationJones');
 assert.equal(shot.framed,true);
 assert.equal(shot.gestured,true);
 assert(arms[0].rotation.z<-.2);
 assert(arms[1].rotation.z>.18);
 assert.deepEqual(g.stationJones.position,oldPos);
 assert.equal(g.missionTimeLeft,157);
 assert.equal(g.completedMissions.size,0);
 s.release();
 assert.equal(g.camera.fov,62);
 assert.deepEqual(arms.map(a=>a.rotation.z),[0,0]);
 g.stationJones.position.x=500;
 assert.equal(Shots.resolve(g,'story_leaving').id,'tanner');
});
test('R87 integrates inside 5-second intro and restores camera on finish/cancel',()=>{
 const g=mockGame(),document=doc();
 const ScenesR86=Scenes,now={value:10000};
 const Briefing=vm.runInNewContext(
  source('js/gameplay/mission-briefing.js')+'\nDriverMissionBriefing',
  {DriverMissionShotsR87:Shots,DriverCampaignScenesR86:ScenesR86,
   DriverChicagoMissionGuidance:{snapshot:()=>null},
   document,Math,Number,String,
   performance:{now:()=>now.value}});
 const b=new Briefing();
 b.begin(g,'story_tipoff');
 assert(b.active);
 assert(b.shotsR87);
 now.value=12650;b.tick(.016);
 assert(b.seconds>2.5&&b.seconds<2.8);
 b.decorateCamera(g.camera);
 assert.equal(b.shotsR87.lastShot.actor,'tanner');
 assert(g.camera.fov<62);
 assert(b.element.textContent.length>0);
 now.value=15250;b.tick(.016);
 assert(!b.active);assert.equal(g.camera.fov,62);
 assert.equal(b.element.style.display,'none');
 b.begin(g,'story_leaving');
 now.value=18000;b.tick(.016);b.decorateCamera(g.camera);
 assert(g.camera.fov<62);
 b.cancel();
 assert.equal(g.camera.fov,62);
 assert.equal(b.active,false);
 assert.equal(b.shotsR87,null);
 assert.equal(g.missionTimeLeft,157);
});
test('R87 engine uses existing station NPC and R86 flow; zero new mission timers or actor spawns',()=>{
 const engine=source('js/engine/driver2-game-engine.js'),
  shots=source('js/gameplay/mission-shots-r87.js'),
  html=source('index.html'),
  briefing=source('js/gameplay/mission-briefing.js');
 assert(html.indexOf('mission-shots-r87.js')<
  html.indexOf('mission-briefing.js'));
 assert(engine.includes('this.spawnLeavingJones();'));
 assert(engine.includes('group.userData.r87JonesArms=[];'));
 assert(engine.includes('this.scene.add(group);this.stationJones=group;'));
 assert(engine.includes('this.briefingDirector.decorateCamera?.(this.camera)'));
 assert(briefing.includes('this.shotsR87?.release()'));
 assert(!shots.includes('setInterval('));
 assert(!shots.includes('setTimeout('));
 assert(!shots.includes('new THREE.Group'));
 assert(!shots.includes('triggerEndScreen('));
 assert(!shots.includes('game.startMission('));
});
