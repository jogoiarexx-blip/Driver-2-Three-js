'use strict';
/* R64 GAME-07/PERF-06: real browser transition regression.
 * Controlled scripted transitions: not a full human mission walkthrough.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const out=path.resolve(process.cwd(),'qa-artifacts');
fs.mkdirSync(out,{recursive:true});
const base=process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/';
const report={schema:'driver2-r64-city-transitions-v1',
 build:process.env.GITHUB_SHA||'local',status:'IN_PROGRESS',
 steps:[],screenshots:[],errors:[],
 limitations:['SwiftShader is software GL, not physical Android GPU',
 'controlled mission state/transition, not E4 keyboard campaign',
 'renderer memory numbers are observations, not certified leak threshold']};
let browser,page,last='boot';
async function capture(){
 return page.evaluate(()=>{
  const g=window.DriverGame,mem=g.renderer.info.memory;
  return {city:g.currentCityKey,ready:g.city.ready,
   mission:g.missionType,active:g.missionActive,
   target:!!g.targetCar,regional:g.regionalState?.type||null,
   vehicles:g.vehicles.length,allVehicleRootsAttached:g.vehicles.every(
     v=>v.root&&v.root.parent===g.scene),
   playerInFleet:g.vehicles.includes(g.playerCar),
   pendingVehicleRestore:g._pendingVehicleRestore?.length||0,
   pendingPlayerVehicleIndex:g._pendingPlayerVehicleIndex??null,
   markers:g.missionMarkers.length,
   bargeInScene:!!g.scene.getObjectByName('rio-barge-mission'),
   caineInScene:!!g.scene.getObjectByName('caine-depot-target-0'),
   helicopterInScene:!!g.scene.getObjectByName('lenny-helicopter'),
   sceneChildren:g.scene.children.length,
   buildingBoxes:g.city.buildingBoxes.length,
   geometries:mem.geometries,textures:mem.textures,
   chapterCompleted:g.chapterProgress?.hasCompletedRegional(
     'story_vegas_ambulance')||false};
 });
}
async function step(name,fn){
 last=name;const start=Date.now();
 const detail=await fn();
 const state=await capture();
 report.steps.push({name,elapsedMs:Date.now()-start,detail,state});
 console.log('R64_TRANSITION_STEP',name,JSON.stringify({detail,state}));
 return state;
}
async function shot(label){
 const name='r64-'+label+'.png';
 await page.screenshot({path:path.join(out,name),timeout:120000});
 report.screenshots.push(name);
}
(async()=>{
 try{
  browser=await chromium.launch({headless:true,args:[
   '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
   '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
  ]});
  const context=await browser.newContext({
   viewport:{width:960,height:600},deviceScaleFactor:1});
  page=await context.newPage();
  page.setDefaultTimeout(180000);
  page.on('pageerror',e=>report.errors.push(String(e)));
  await context.addInitScript(()=>localStorage.setItem(
   'driver2-menu-preferences-v1',JSON.stringify({
    models:false,scanlines:false,reducedMotion:true})));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE,
   null,{timeout:60000});
  assert.equal(await page.evaluate(()=>window.DriverBoot.start('ride')),true);
  await page.waitForFunction(()=>window.DriverBoot?.sessionReady&&
   window.DriverGame?.city?.ready&&window.DriverGame?.playerCar,
   null,{timeout:150000});
  const initial=await step('Chicago boot and real deferred Wrigley-car save',()=>page.evaluate(()=>{
   const g=window.DriverGame,s=g.homeSave.capture(g);
   s.vehicles.push({...s.vehicles[0],x:333,z:-238,damage:77});
   s.playerIndex=s.vehicles.length-1;
   if(!g.homeSave.restore(g,s))throw Error('restore refused');
   if(g._pendingVehicleRestore?.length!==1)
    throw Error('did not reproduce pending late vehicle save');
   g.chapterProgress.completeRegional('story_vegas_ambulance');
   g.completedMissions.add('story_vegas_ambulance');
   return {pending:g._pendingVehicleRestore.length,
    playerIndex:g._pendingPlayerVehicleIndex,vehicles:g.vehicles.length};
  }));
  assert.equal(initial.pendingVehicleRestore,1);
  await shot('01-chicago-pending');

  const havana=await step('Chicago to Havana clears stale deferred save',()=>page.evaluate(
   ()=>window.DriverGame.requestCityChange('havana')));
  assert.equal(havana.city,'havana');assert(havana.ready);
  assert.equal(havana.pendingVehicleRestore,0);
  assert.equal(havana.pendingPlayerVehicleIndex,null);
  assert.equal(havana.mission,'freeroam');
  assert(havana.playerInFleet&&havana.allVehicleRootsAttached);
  assert(havana.chapterCompleted);
  assert(!havana.regional&&!havana.target);
  await shot('02-havana-clean');

  const vegas=await step('Havana to Vegas, active C4 stage setup',async()=>{
   const ok=await page.evaluate(
    ()=>window.DriverGame.requestCityChange('vegas'));
   assert.equal(ok,true);
   return page.evaluate(()=>{
    const g=window.DriverGame;
    g.startMission('story_vegas_c4');
    g.isPaused=true;
    g.mode='on_foot';g.tanner.setVisible(true);
    g.tanner.setPosition(200,0,-160,0);
    const planted=DriverRegionalMissions.interact(g);
    return {planted,phase:g.regionalState?.phase,
      hasCaine:!!g.scene.getObjectByName('caine-depot-target-0')};
   });
  });
  assert.equal(vegas.city,'vegas');
  assert.equal(vegas.regional,'story_vegas_c4');
  assert(vegas.caineInScene&&vegas.active);
  await shot('03-vegas-active');

  const rio=await step('Vegas active mission to Rio removes all Vegas props',()=>page.evaluate(
   ()=>window.DriverGame.requestCityChange('rio')));
  assert.equal(rio.city,'rio');assert(rio.ready);
  assert.equal(rio.mission,'freeroam');
  assert(!rio.regional&&!rio.active&&!rio.caineInScene);
  assert(rio.playerInFleet&&rio.allVehicleRootsAttached);
  assert(rio.chapterCompleted);
  const rioBarge=await step('Rio barge mission spawns one prop',()=>page.evaluate(()=>{
   const g=window.DriverGame;
   g.startMission('story_rio_barge');
   return {began:g.regionalState?.type==='story_rio_barge'};
  }));
  assert(rioBarge.bargeInScene&&rioBarge.active);

  const chicago=await step('Rio back to Chicago removes barge and restores local fleet',()=>page.evaluate(
   ()=>window.DriverGame.requestCityChange('chicago')));
  assert.equal(chicago.city,'chicago');
  assert(chicago.ready&&chicago.playerInFleet&&chicago.allVehicleRootsAttached);
  assert.equal(chicago.pendingVehicleRestore,0);
  assert.equal(chicago.mission,'freeroam');
  assert(!chicago.regional&&!chicago.active);
  assert(!chicago.bargeInScene&&!chicago.caineInScene&&!chicago.helicopterInScene);
  assert(chicago.chapterCompleted);
  await shot('04-chicago-return');
  assert.deepEqual(report.errors,[]);
  report.status='PASS';
 }catch(error){
  report.status='FAIL';
  report.failure={step:last,message:String(error),stack:error?.stack};
  console.error('R64_TRANSITION_FAIL',JSON.stringify(report.failure));
  if(page)try{await shot('FAIL-'+last.replace(/[^a-z0-9]+/gi,'-').slice(0,28));}catch(_){}
  process.exitCode=1;
 }finally{
  report.finishedAt=new Date().toISOString();
  fs.writeFileSync(path.join(out,'r64-city-transition-evidence.json'),
   JSON.stringify(report,null,2)+'\n');
  console.log('R64_TRANSITION_VERDICT',report.status,report.steps.length);
  if(browser)await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
