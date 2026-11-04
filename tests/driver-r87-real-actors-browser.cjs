'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const dest='qa-artifacts/r87-live-cinematics';
 fs.mkdirSync(dest,{recursive:true});
 try{
  await page.goto(process.env.DRIVER_QA_URL||
   'http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',
    timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
  await page.evaluate(()=>window.DriverBoot.start('ride'));
  await page.waitForFunction(()=>window.DriverBoot?.sessionReady&&
   window.DriverGame?.city?.ready&&
   window.DriverGame?.currentCityKey==='chicago',
   null,{timeout:120000});
  const first=await page.evaluate(()=>{
   const g=window.DriverGame,Shots=window.DriverMissionShotsR87,
    Scenes=window.DriverCampaignScenesR86;
   g.startMission('story_tipoff');
   const b=g.briefingDirector,playerBefore={
    ...g.tanner.group.position},seconds=g.missionTimeLeft,
    baseFov=g.camera.fov;
   b.startedAt=performance.now()-2700;b.tick(.016);
   g.updateCamera(.016);b.decorateCamera(g.camera);
   return {plans:Object.keys(Shots.SHOTS).length,
    missionScripts:Object.keys(Scenes.STORIES).length,
    title:b.element.textContent,actor:b.shotsR87?.lastShot?.actor,
    framed:b.shotsR87?.lastShot?.framed,
    fov:g.camera.fov,baseFov,
    playerUnmoved:Math.hypot(
      playerBefore.x-g.tanner.group.position.x,
      playerBefore.z-g.tanner.group.position.z)<1e-6,
    timerUnchanged:g.missionTimeLeft===seconds,
    liveMission:g.missionActive&&!g.gameEnded,
    hasRealTanner:g.tanner.group.visible};
  });
  assert.equal(first.plans,15);
  assert.equal(first.missionScripts,15);
  assert.equal(first.actor,'tanner');
  assert(first.framed&&first.fov<first.baseFov);
  assert(first.liveMission&&first.playerUnmoved&&
   first.timerUnchanged&&first.hasRealTanner);
  await page.screenshot({path:dest+'/chicago-tipoff-real-tanner.png',
   timeout:30000});
  const finished=await page.evaluate(()=>{
   const g=window.DriverGame,b=g.briefingDirector;
   b.startedAt=performance.now()-5200;b.tick(.016);
   return {active:b.active,fov:g.camera.fov,
    original:b.shotsR87?.originalFov,
    visible:b.element.style.display};
  });
  assert(!finished.active&&finished.visible==='none');
  assert.equal(finished.fov,finished.original);
  const jones=await page.evaluate(()=>{
   const g=window.DriverGame;
   g.startMission('story_leaving');
   const b=g.briefingDirector,
    actor=g.stationJones,arms=actor?.userData?.r87JonesArms,
    p={x:actor.position.x,y:actor.position.y,
     z:actor.position.z},duration=g.missionTimeLeft;
   b.startedAt=performance.now()-3500;b.tick(.016);
   g.updateCamera(.016);b.decorateCamera(g.camera);
   const shot=b.shotsR87?.lastShot;
   return {actorVisible:!!actor&&g.scene.children.includes(actor),
    arms:arms?.length,gesture:[arms?.[0]?.rotation.z,
     arms?.[1]?.rotation.z],worldPos:{x:actor.position.x,
      y:actor.position.y,z:actor.position.z},
    initialPos:p,previewActor:shot?.actor,
    gestureActive:shot?.gestured,
    realSceneCamera:g.camera.fov,
    baseFov:b.shotsR87?.originalFov,
    timerUnchanged:g.missionTimeLeft===duration,
    missionActive:g.missionActive,
    city:g.currentCityKey};
  });
  assert(jones.actorVisible&&jones.missionActive);
  assert.equal(jones.city,'chicago');
  assert.equal(jones.arms,2);
  assert(jones.gestureActive);
  assert(jones.gesture[0]<0&&jones.gesture[1]>.18);
  assert.deepEqual(jones.worldPos,jones.initialPos);
  assert(jones.realSceneCamera<jones.baseFov);
  assert(jones.timerUnchanged);
  await page.screenshot({path:dest+'/chicago-leaving-real-mission.png',
   timeout:30000});
  // QA close-up of the REAL existing Jones mesh, not an in-game
  // automatic camera teleport. Camera is moved ONLY by this test.
  const station=await page.evaluate(()=>{
   const g=window.DriverGame;
   const j=g.stationJones;
   g.camera.position.set(j.position.x-9,4.5,j.position.z+12);
   g.camera.lookAt(j.position.x,1.9,j.position.z);
   g.camera.updateProjectionMatrix();
   return {position:{x:j.position.x,y:j.position.y,z:j.position.z},
    meshes:j.children.length,
    arms:j.userData.r87JonesArms.map(x=>x.name),
    ownerIsScene:g.scene.children.includes(j)};
  });
  assert.equal(station.ownerIsScene,true);
  assert.deepEqual(station.arms,
   ['r87-jones-arm-left','r87-jones-arm-right']);
  await page.screenshot({path:dest+'/station-jones-qa-camera.png',
   timeout:30000});
  const cancelled=await page.evaluate(()=>{
   const g=window.DriverGame,b=g.briefingDirector;
   b.cancel();
   return {fov:g.camera.fov,original:b.shotsR87?.originalFov,
    arms:g.stationJones.userData.r87JonesArms.map(x=>x.rotation.z),
    missionActive:g.missionActive};
  });
  assert.deepEqual(cancelled.arms,[0,0]);
  assert(cancelled.missionActive);
  assert.deepEqual(errors,[]);
  const report={first,finished,jones,station,cancelled,errors,
   coverage:'15 plans + actual Chicago tipoff and leaving actors',
   screenshots:'tipoff from regular game camera; station Jones QA close-up manually positions camera only',
   limits:'Not a recorded video or proof of naturally completing all 15 story missions'};
  fs.writeFileSync(dest+'/r87-real-game.json',JSON.stringify(report,null,2));
  console.log('DRIVER_R87_REAL_ACTOR_CINEMATICS',JSON.stringify(report));
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
