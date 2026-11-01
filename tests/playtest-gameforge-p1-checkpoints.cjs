'use strict';
// R63 GAME-09: E3 browser-origin end-to-end checkpoint resume.
// Controlled scripted game logic, not human keyboard mission completion.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const dir=path.resolve(process.cwd(),'qa-artifacts');
fs.mkdirSync(dir,{recursive:true});
const base=process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/';
const report={schema:'driver2-r63-checkpoints-v1',build:process.env.GITHUB_SHA||'local',
  status:'IN_PROGRESS',steps:[],errors:[],screenshots:[],
  limitations:['controlled gameplay states, not a human playthrough',
    'does not certify Android/GPU FPS or every route via physical driving']};
let browser,page,last='boot';
async function stage(name,fn){
  last=name;
  const started=Date.now(),value=await fn();
  report.steps.push({name,elapsedMs:Date.now()-started,value});
  console.log('R63_STAGE',name,JSON.stringify(value));
  return value;
}
async function shot(name){
  const filename='r63-'+name+'.png';
  await page.screenshot({path:path.join(dir,filename),timeout:120000});
  report.screenshots.push(filename);
}
async function boot(){
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE,
    null,{timeout:60000});
  assert.equal(await page.evaluate(()=>window.DriverBoot.start('ride')),true);
  await page.waitForFunction(()=>window.DriverBoot?.sessionReady&&
    window.DriverGame?.city?.ready&&window.DriverGame?.playerCar,
    null,{timeout:150000});
}
async function reload(){
  await page.reload({waitUntil:'domcontentloaded',timeout:65000});
  await boot();
}
async function evaluateGame(fn){
  return page.evaluate(fn);
}
(async()=>{
 try{
  browser=await chromium.launch({headless:true,args:[
    '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
    '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
  ]});
  const context=await browser.newContext({viewport:{width:960,height:600},
    deviceScaleFactor:1});
  page=await context.newPage();page.setDefaultTimeout(150000);
  page.on('pageerror',e=>report.errors.push(String(e)));
  await context.addInitScript(()=>localStorage.setItem(
    'driver2-menu-preferences-v1',JSON.stringify({
      models:false,scanlines:false,reducedMotion:true
    })));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:65000});
  await boot();

  const c4start=await stage('Vegas C4: first generator planted and saved',()=>evaluateGame(()=>{
    const g=window.DriverGame;g.isPaused=true;
    g.startMission('story_vegas_c4');
    g.mode='on_foot';g.tanner.setVisible(true);
    g.tanner.setPosition(200,0,-160,0);
    if(!DriverRegionalMissions.interact(g))throw Error('C4 first interaction failed');
    const checkpoint=g.homeSave.capture(g);
    return {saved:g.homeSave.write(checkpoint),
      city:checkpoint.city,type:checkpoint.mission.type,
      phase:checkpoint.regional?.phase,
      planted:checkpoint.regional?.planted,
      nextMarker:g.missionMarkers[0]?.x,
      saveBytes:JSON.stringify(checkpoint).length};
  }));
  assert(c4start.saved&&c4start.phase===1&&c4start.planted===1);
  assert.equal(c4start.nextMarker,-200);
  await shot('01-c4-first-planted');
  await reload();
  const c4restored=await stage('Vegas C4: reload resumes at second generator',()=>evaluateGame(()=>{
    const g=window.DriverGame;g.isPaused=true;
    const ok=g.loadHomeGame();
    const before={ok,city:g.currentCityKey,type:g.missionType,
      phase:g.regionalState?.phase,planted:g.regionalState?.planted,
      marker:g.missionMarkers[0]?.x};
    g.mode='on_foot';g.tanner.setVisible(true);
    g.tanner.setPosition(-200,0,-160,0);
    before.secondInteraction=DriverRegionalMissions.interact(g);
    before.afterPlanted=g.regionalState?.planted;
    return before;
  }));
  assert(c4restored.ok&&c4restored.phase===1&&c4restored.planted===1);
  assert.equal(c4restored.marker,-200);
  assert(c4restored.secondInteraction&&c4restored.afterPlanted===2);

  const heistStart=await stage('Vegas heist: deliver armored truck, save second vehicle',()=>evaluateGame(()=>{
    const g=window.DriverGame;g.startMission('story_vegas_heist');
    g.isPaused=true;
    g.playerCar=g.targetCar;
    g.mode='driving';
    const zone=g.city.safeHouseZone;
    g.playerCar.x=zone.x;g.playerCar.z=zone.z;
    const first=DriverRegionalMissions.update(g,.016);
    const checkpoint=g.homeSave.capture(g);
    return {firstVictory:first?.success||false,
      delivered:g.regionalState.delivered,
      target:g.targetCar?.name,fleet:checkpoint.vehicles.length,
      saved:g.homeSave.write(checkpoint),regional:checkpoint.regional};
  }));
  assert.equal(heistStart.firstVictory,false);
  assert.equal(heistStart.delivered,1);
  assert.equal(heistStart.target,'LIMUSINE DE LUXO');
  assert(heistStart.saved);
  await reload();
  const heistRestored=await stage('Vegas heist: reload reconstructs limousine and finishes stage 2',()=>evaluateGame(()=>{
    const g=window.DriverGame;g.isPaused=true;
    const ok=g.loadHomeGame();
    const r={ok,city:g.currentCityKey,delivered:g.regionalState?.delivered,
      target:g.targetCar?.name,fleet:g.vehicles.length,
      savedFleet:g.homeSave.read()?.vehicles.length};
    g.mode='driving';g.playerCar=g.targetCar;
    g.playerCar.x=g.city.safeHouseZone.x;
    g.playerCar.z=g.city.safeHouseZone.z;
    r.secondResult=DriverRegionalMissions.update(g,.016)?.success===true;
    r.afterDelivered=g.regionalState?.delivered;
    return r;
  }));
  assert(heistRestored.ok&&heistRestored.delivered===1);
  assert.equal(heistRestored.target,'LIMUSINE DE LUXO');
  assert.equal(heistRestored.fleet,heistRestored.savedFleet);
  assert(heistRestored.secondResult&&heistRestored.afterDelivered===2);
  await shot('02-heist-second-complete');

  const heliStart=await stage('Rio helicopter: checkpoint after two route segments',()=>evaluateGame(()=>{
    const g=window.DriverGame;
    g.startMission('story_rio_helicopter');g.isPaused=true;
    const s=g.regionalState;
    s.heliIndex=2;s.heliAt={x:152,z:-247};
    s.seconds=32.5;s.lost=3;
    s.heli.position.set(s.heliAt.x,23+Math.sin(s.seconds*2),s.heliAt.z);
    const checkpoint=g.homeSave.capture(g);
    return {saved:g.homeSave.write(checkpoint),
      city:checkpoint.city,phase:checkpoint.regional.heliIndex,
      at:checkpoint.regional.heliAt,seconds:checkpoint.regional.seconds,
      lost:checkpoint.regional.lost};
  }));
  assert(heliStart.saved&&heliStart.city==='rio'&&heliStart.phase===2);
  await reload();
  const heliRestored=await stage('Rio helicopter: reload resumes position and continues pursuit',()=>evaluateGame(()=>{
    const g=window.DriverGame;g.isPaused=true;
    const ok=g.loadHomeGame(),s=g.regionalState;
    const r={ok,city:g.currentCityKey,phase:s?.heliIndex,
      at:s?{...s.heliAt}:null,seconds:s?.seconds,lost:s?.lost,
      meshPosition:s?.heli?.position.z};
    g.mode='driving';g.playerCar.x=s.heliAt.x;g.playerCar.z=s.heliAt.z;
    DriverRegionalMissions.update(g,.25);
    r.afterSeconds=s.seconds;r.afterAt={...s.heliAt};
    return r;
  }));
  assert(heliRestored.ok&&heliRestored.city==='rio');
  assert.equal(heliRestored.phase,2);
  assert.equal(heliRestored.at.x,152);assert.equal(heliRestored.at.z,-247);
  assert.equal(heliRestored.seconds,32.5);assert.equal(heliRestored.lost,3);
  assert.equal(heliRestored.meshPosition,-247);
  assert(heliRestored.afterSeconds>32.5);
  assert.notDeepEqual(heliRestored.afterAt,heliRestored.at);
  await shot('03-helicopter-resumed');

  const bargeStart=await stage('Rio barge: charge planted, countdown saved',()=>evaluateGame(()=>{
    const g=window.DriverGame;g.startMission('story_rio_barge');
    g.isPaused=true;g.mode='on_foot';g.tanner.setVisible(true);
    g.tanner.setPosition(240,0,26,0);
    if(!DriverRegionalMissions.interact(g))throw Error('barge C4 failed');
    g.regionalState.countdown=8;
    const snap=g.homeSave.capture(g);
    return {saved:g.homeSave.write(snap),regional:snap.regional};
  }));
  assert(bargeStart.saved&&bargeStart.regional.countdown===8);
  await reload();
  const bargeRestored=await stage('Rio barge: recharge countdown after reload',()=>evaluateGame(()=>{
    const g=window.DriverGame;g.isPaused=true;
    const ok=g.loadHomeGame();
    return {ok,type:g.missionType,phase:g.regionalState?.phase,
      countdown:g.regionalState?.countdown,markers:g.missionMarkers.length};
  }));
  assert(bargeRestored.ok&&bargeRestored.type==='story_rio_barge');
  assert.equal(bargeRestored.phase,1);
  assert.equal(bargeRestored.countdown,8);
  assert.equal(bargeRestored.markers,0);
  assert.deepEqual(report.errors,[]);
  report.status='PASS';
 }catch(e){
   report.status='FAIL';
   report.failure={step:last,error:String(e),stack:e?.stack};
   console.error('R63_CHECKPOINT_FAIL',JSON.stringify(report.failure));
   if(page)try{await shot('FAIL-'+last.replace(/[^a-z0-9]+/gi,'-').slice(0,30));}catch(e){}
   process.exitCode=1;
 }finally{
   report.finishedAt=new Date().toISOString();
   fs.writeFileSync(path.join(dir,'r63-checkpoints-evidence.json'),
     JSON.stringify(report,null,2)+'\n');
   console.log('R63_CHECKPOINT_VERDICT',report.status,'steps',report.steps.length);
   if(browser)await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
