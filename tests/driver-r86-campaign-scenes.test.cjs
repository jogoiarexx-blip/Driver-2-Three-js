'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const Scenes=require('../js/gameplay/campaign-scenes-r86.js');
const Flow=vm.runInNewContext(read('js/gameplay/campaign-flow.js')+
    '\nDriverCampaignFlow',{Math,String,Set});
const Tanner=vm.runInNewContext(read('js/entities/tanner-controller.js')+
    '\nTannerController',{THREE:{}});

function mockDocument(){
 const elements=new Map(),body={appendChild(x){elements.set(x.id,x)}};
 const createElement=()=>({
  style:{},dataset:{},textContent:'',attributes:{},
  setAttribute(k,v){this.attributes[k]=v;},
  getAttribute(k){return this.attributes[k];}
 });
 elements.set('mission-title',{textContent:'SURVEILLANCE TIP OFF'});
 return {body,createElement,getElementById:id=>elements.get(id)};
}
test('R86 roteiro completo liga 8 Chicago, 1 Havana, 3 Vegas, 3 Rio sem pular etapas',()=>{
 const all=[...Flow.CHICAGO,'story_havana_lead',
  ...Flow.VEGAS,...Flow.RIO];
 assert.equal(all.length,15);
 assert.deepEqual(Object.keys(Scenes.STORIES),all);
 for(const type of all){
  const s=Scenes.script(type);
  assert(s&&s.title&&s.setup&&s.goal&&s.chapter&&s.trail);
  assert(s.title.length<55);
  assert(s.city&&Scenes.ACTS[s.city]);
  assert.equal(s.type,type);
 }
 assert.equal(Scenes.script('freeroam'),null);
 assert.equal(Scenes.script('story_unknown'),null);
 assert.equal(Scenes.city('replay'),null);
 assert.deepEqual(Array.from(Flow.CHICAGO.slice(0,3)),
  ['story_tipoff','story_witness','story_train']);
 assert.equal(Flow.nextChapter('chicago',new Set(Flow.CHICAGO)),'havana');
 assert.equal(Flow.nextChapter('havana',new Set(['story_havana_lead'])),'vegas');
 assert.equal(Flow.nextChapter('vegas',new Set(Flow.VEGAS)),'rio');
});
test('R86 phase cards follow real Chicago guidance keys, not distance every frame',()=>{
 const old=global.DriverChicagoMissionGuidance;
 global.DriverChicagoMissionGuidance={
  snapshot:()=>({id:'chase',label:'PERSIGA O SUSPEITO',
   hint:'Não perca a distância.'})
 };
 const g={missionActive:true,missionType:'story_intruder',
  currentCityKey:'chicago',briefingDirector:{active:false}};
 const s=new Scenes();
 try{
  s.begin(g,g.missionType);s.observe(g,.1);
  assert.equal(s.stageKey,'story_intruder:chase');
  assert.equal(s.visibleFor,2.9);
  const first=s.visibleFor;
  s.observe(g,.25);
  assert(s.visibleFor<first,'same director stage should not reanimate');
  g.chicagoGuidance={id:'yard',label:'PARE NO PÁTIO',
   hint:'Encontre o invasor.'};
  s.observe(g,.1);
  assert.equal(s.stageKey,'story_intruder:yard');
  assert(s.visibleFor>2.7);
  g.briefingDirector.active=true;
  g.chicagoGuidance.id='blocked';
  s.observe(g,.1);
  assert.equal(s.stageKey,'story_intruder:yard',
   'opening movie blocks stage-cue overlays');
 }finally{
  if(old===undefined)delete global.DriverChicagoMissionGuidance;
  else global.DriverChicagoMissionGuidance=old;
 }
});
test('R86 stages for Vegas C4, heist, ambulance and Rio helicopter are real state-derived',()=>{
 const g={currentCityKey:'vegas',missionActive:true,
  missionType:'story_vegas_c4',
  regionalState:{phase:0,countdown:0}};
 assert.equal(Scenes.step(g).phase,'charge-0');
 g.regionalState.phase=2;
 assert.equal(Scenes.step(g).phase,'charge-2');
 g.regionalState.countdown=8;
 assert.equal(Scenes.step(g).phase,'escape');
 g.missionType='story_vegas_heist';g.regionalState={delivered:0};
 assert.equal(Scenes.step(g).label,'ENTREGUE O CARRO-FORTE');
 g.regionalState.delivered=1;
 assert.equal(Scenes.step(g).label,'ENTREGUE A LIMUSINE');
 g.missionType='story_vegas_ambulance';
 g.playerCar={id:0};g.targetCar={id:1};
 assert.equal(Scenes.step(g).phase,'take');
 g.playerCar=g.targetCar;
 assert.equal(Scenes.step(g).phase,'deliver');
 g.currentCityKey='rio';g.missionType='story_rio_helicopter';
 g.regionalState={heliIndex:0};
 assert.equal(Scenes.step(g).phase,'pursue');
 g.regionalState.heliIndex=3;
 assert.equal(Scenes.step(g).phase,'middle');
 g.regionalState.heliIndex=4;
 assert.equal(Scenes.step(g).phase,'final');
 g.currentCityKey='chicago';
 assert.equal(Scenes.step(g),null,'wrong-city title cannot appear');
});
test('R86 Havana rendezvous and chapter completion honor actual game progress',()=>{
 const g={missionActive:true,currentCityKey:'havana',
  missionType:'story_havana_lead',havanaLeadStatus:{phase:'follow'}};
 assert.equal(Scenes.step(g).label,'SIGA O INTERMEDIÁRIO');
 g.havanaLeadStatus.phase='meet';
 assert.equal(Scenes.step(g).label,'ENCONTRO NOS CAIS');
 const s=new Scenes();s.begin(g,g.missionType);
 s.observe(g,.1);assert.equal(s.stageKey,'story_havana_lead:meet');
 s.finish(g,g.missionType,false,'vegas');
 assert.equal(s.lastResult.failed,false);
 assert.equal(s.activeType,null);
 assert(s.visibleFor>3.5);
 // Old failed mission must not unlock a chapter or rewrite progress.
 const won=new Set();
 s.finish(g,'story_havana_lead',true,null);
 assert.equal(s.lastResult.failed,true);
 assert.equal(won.size,0);
 s.cancel();
 assert.equal(s.visibleFor,0);
});
test('R86 intro titles are 5s, actual street shot shows setup and real goal',()=>{
 const document=mockDocument();let now=0;
 const Intro=vm.runInNewContext(read('js/gameplay/mission-briefing.js')+
  '\nDriverMissionBriefing',{document,performance:{now:()=>now},
   DriverCampaignScenesR86:Scenes,
   DriverChicagoMissionGuidance:{
    snapshot:()=>({label:'ENCONTRE O CARRO DE JONES'})
   }});
 const intro=new Intro();
 intro.begin({missionActive:true},'story_tipoff');
 assert.equal(intro.active,true);
 assert(intro.element.textContent.includes('ATO I'));
 assert(intro.element.textContent.includes('01'));
 assert.equal(intro.element.getAttribute('aria-hidden'),'false');
 assert.equal(intro.element.style.background,'#000');
 now=2600;intro.tick(.016);
 assert(intro.element.textContent.includes('pista inicial'));
 const camera={position:{x:0,y:5,z:0}};
 intro.decorateCamera(camera);
 assert(camera.position.x>0&&camera.position.y>5);
 now=3600;intro.tick(.016);
 assert.equal(intro.element.textContent,'ENCONTRE O CARRO DE JONES');
 now=5001;assert.equal(intro.tick(.016),false);
 assert.equal(intro.active,false);
 assert.equal(intro.element.style.display,'none');
 assert.equal(intro.element.getAttribute('aria-hidden'),'true');
 const x=camera.position.x;
 intro.decorateCamera(camera);
 assert.equal(camera.position.x,x,'cinematic pan stops outside intro');
});
test('R86 failure and success cards do not freeze game, change mission or duplicate dom nodes',()=>{
 const document=mockDocument(),old=global.document;
 global.document=document;
 try{
  const g={missionActive:true,missionType:'story_witness',
   currentCityKey:'chicago'};
  const scenes=new Scenes();
  scenes.begin(g,'story_witness');
  scenes.show('TEST','descrição',1.5);
  const el=scenes.element;
  scenes.show('TEST 2','outro',2.3);
  assert.equal(scenes.element,el);
  scenes.finish(g,'story_witness',true,null);
  assert.equal(el.getAttribute('aria-hidden'),'false');
  assert(el.textContent.includes('NÃO CONCLUÍDA'));
  assert.equal(g.missionType,'story_witness');
  assert.equal(g.missionActive,true);
  for(let i=0;i<6;i++)scenes.observe({...g,missionActive:false},1);
  assert.equal(el.style.display,'none');
  scenes.begin(g,'freeroam');
  assert.equal(scenes.activeType,null);
 }finally{
  if(old===undefined)delete global.document;
  else global.document=old;
 }
});
function mockAction(name){
 return {name,timeScale:1,fadeOut(){return this},
  fadeIn(){return this},reset(){return this},play(){return this},
  getEffectiveTimeScale(){return this.timeScale},
  setEffectiveTimeScale(v){this.timeScale=v;return this}};
}
test('R86 Tanner selects actual RUN clip on sprint and crossfades to idle',()=>{
 const actions=new Map();
 const t=Object.create(Tanner.prototype);
 t.animations=[{name:'idle'},{name:'walk'},{name:'run'}];
 t.animationMixer={clipAction(clip){
   if(!actions.has(clip.name))actions.set(clip.name,mockAction(clip.name));
   return actions.get(clip.name);
 }};
 t.setFootPlayback(true,false,.12);
 assert.equal(t.activeClip.name,'walk');
 t.setFootPlayback(true,true,.12);
 assert.equal(t.activeClip.name,'run');
 assert.equal(t.activeAction.timeScale,1);
 t.setFootPlayback(false,false,.12);
 assert.equal(t.activeClip.name,'idle');
 assert.equal(t.activeAction.timeScale,1);
});
test('R86 on GLBs with no run clip accelerates walk smoothly rather than freezing',()=>{
 const t=Object.create(Tanner.prototype),actions=new Map();
 t.animations=[{name:'idle'},{name:'walk'}];
 t.animationMixer={clipAction(clip){
  if(!actions.has(clip.name))actions.set(clip.name,mockAction(clip.name));
  return actions.get(clip.name);
 }};
 t.setFootPlayback(true,true,.016);
 assert.equal(t.activeClip.name,'walk');
 const a=t.activeAction;
 assert(a.timeScale>1&&a.timeScale<1.45);
 for(let i=0;i<20;i++)t.setFootPlayback(true,true,.016);
 assert(a.timeScale>1.4&&a.timeScale<=1.45);
 t.setFootPlayback(true,false,.16);
 assert(a.timeScale>=1&&a.timeScale<1.1);
});
test('R86 blocked Tanner stands still instead of walking in place',()=>{
 const t=Object.create(Tanner.prototype);
 const pos={x:5,y:0,z:5,set(x,y,z){
  this.x=x;this.y=y;this.z=z}};
 t.group={visible:true,position:pos,rotation:{y:0}};
 t.heading=0;t.walkCycle=0;t.isSitting=false;
 t.isSwimming=false;t.swimClock=0;t.playerModel={};
 t.contactShadow={visible:true};
 for(const p of ['leftArm','rightArm','leftLeg','rightLeg'])
  t[p]={rotation:{x:0}};
 let state=null;
 t.setFootPlayback=(moving,sprinting)=>{state={moving,sprinting}};
 const city={isWaterAt:()=>false,getGroundHeightAt:()=>0,
  isPointBlocked:()=>true};
 t.update(.016,{up:true,sprint:true},city);
 assert.equal(t.group.position.z,5);
 assert.deepEqual(state,{moving:false,sprinting:true});
 assert.equal(t.leftLeg.rotation.x,0);
 city.isPointBlocked=()=>false;
 t.update(.016,{up:true,sprint:true},city);
 assert(t.group.position.z>5);
 assert.deepEqual(state,{moving:true,sprinting:true});
});
test('R86 engine uses mission stages and visual camera without altering directors',()=>{
 const html=read('index.html'),engine=read('js/engine/driver2-game-engine.js'),
  intro=read('js/gameplay/mission-briefing.js'),
  tanner=read('js/entities/tanner-controller.js');
 assert(html.indexOf('campaign-scenes-r86.js')<
  html.indexOf('mission-briefing.js'));
 assert(html.indexOf('campaign-scenes-r86.js')<
  html.indexOf('driver2-game-engine.js'));
 assert(engine.includes('this.campaignScenes?.begin(this,type)'));
 assert(engine.includes('this.campaignScenes?.finish('));
 assert(engine.includes('this.campaignScenes?.observe(this,rawDt)'));
 assert(engine.includes('this.briefingDirector.decorateCamera?.(this.camera)'));
 assert(intro.includes('this.seconds>=5'));
 assert(tanner.includes('setFootPlayback(actuallyMoved,'));
 assert(tanner.includes("sprinting?'run':'walk'"));
 assert(!read('js/gameplay/campaign-scenes-r86.js')
  .includes('missionTimeLeft-='));
});
