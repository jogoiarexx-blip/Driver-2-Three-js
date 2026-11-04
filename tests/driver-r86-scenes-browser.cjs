'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),
 fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const path='qa-artifacts/r86-campaign-scenes';
 fs.mkdirSync(path,{recursive:true});
 try{
  await page.goto(process.env.DRIVER_QA_URL||
   'http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
  await page.evaluate(()=>window.DriverBoot.start('ride'));
  await page.waitForFunction(()=>window.DriverBoot?.sessionReady&&
   window.DriverGame?.city?.ready&&
   window.DriverGame?.currentCityKey==='chicago',null,{timeout:120000});
  const setup=await page.evaluate(()=>{
   const g=window.DriverGame,S=window.DriverCampaignScenesR86,
    scripts=Object.keys(S.STORIES);
   g.startMission('story_tipoff');
   const intro=g.briefingDirector;
   return {scripts:scripts.length,activeIntro:intro.active,
    missionActive:g.missionActive,city:g.currentCityKey,
    cameraMode:g.cameraMode,
    title:intro.element.textContent,
    stage:g.campaignScenes.activeType,
    startMissionType:g.missionType};
  });
  assert.equal(setup.scripts,15);
  assert.equal(setup.startMissionType,'story_tipoff');
  assert(setup.title.includes('ATO I')&&setup.title.includes('01'));
  assert(setup.activeIntro);
  assert(setup.missionActive);
  const establishing=await page.evaluate(()=>{
   const g=window.DriverGame,b=g.briefingDirector,
    before={x:g.camera.position.x,y:g.camera.position.y,
     z:g.camera.position.z};
   b.startedAt=performance.now()-2600;
   b.tick(.016);
   g.updateCamera(.016);
   const origin={...before,x:g.camera.position.x,
    y:g.camera.position.y,z:g.camera.position.z};
   b.decorateCamera(g.camera);
   return {scene:b.element.textContent,opacity:b.element.style.opacity,
    panDx:g.camera.position.x-origin.x,
    panDy:g.camera.position.y-origin.y};
  });
  assert(establishing.scene.includes('pista inicial'));
  assert(establishing.panDx>.1 && establishing.panDx<.6);
  assert(establishing.panDy>0&&establishing.panDy<.2);
  await page.screenshot({path:path+'/intro-live-street.png',
   timeout:30000});
  const phase=await page.evaluate(()=>{
   const g=window.DriverGame,b=g.briefingDirector;
   b.startedAt=performance.now()-3700;
   b.tick(.016);
   const realGoal=b.element.textContent;
   b.startedAt=performance.now()-5200;
   b.tick(.016);
   g.campaignScenes.observe(g,.016);
   const el=g.campaignScenes.element;
   return {realGoal,introEnded:!b.active,
    stageKey:g.campaignScenes.stageKey,
    currentStage:el?.textContent,
    visible:el?.style.display,
    time:g.missionTimeLeft};
  });
  assert(phase.introEnded);
  assert(phase.stageKey?.startsWith('story_tipoff:'));
  assert(phase.currentStage&&phase.visible==='block');
  assert(phase.time>0);
  await page.screenshot({path:path+'/mission-stage.png',
   timeout:30000});
  const failure=await page.evaluate(()=>{
   const g=window.DriverGame;
   const prev=g.completedMissions.has('story_tipoff');
   g.triggerEndScreen('MISSÃO FALHOU!',
    'Jones não foi localizado. Retorne ao marcador.');
   return {beforeComplete:prev,
    afterComplete:g.completedMissions.has('story_tipoff'),
    missionActive:g.missionActive,missionType:g.missionType,
    gameEnded:g.gameEnded,next:g.nextStoryMission(),
    panel:g.campaignScenes.element?.textContent,
    modalHidden:document.getElementById('center-announcement')?.
     classList.contains('hidden')};
  });
  assert.equal(failure.beforeComplete,false);
  assert.equal(failure.afterComplete,false);
  assert.equal(failure.missionType,'freeroam');
  assert.equal(failure.missionActive,false);
  assert.equal(failure.gameEnded,false);
  assert.equal(failure.next,'story_tipoff');
  assert(failure.panel.includes('NÃO CONCLUÍDA'));
  assert(failure.modalHidden);
  const next=await page.evaluate(()=>{
   const g=window.DriverGame;
   g.startMission('story_tipoff');
   const restarted=g.campaignScenes.activeType==='story_tipoff'&&
     g.briefingDirector.active;
   g.briefingDirector.cancel();
   // The QA verifies integration of the existing mission-completion
   // endpoint; it does not claim to play the whole mission by hand.
   g.triggerEndScreen('SURVEILLANCE TIP OFF CONCLUÍDA!',
    'Jones foi encontrado. A próxima pista é a testemunha.');
   return {restarted,next:g.nextStoryMission(),
    completed:g.completedMissions.has('story_tipoff'),
    stillDriving:g.mode==='driving',
    scene:g.campaignScenes.element?.textContent,
    active:g.missionActive};
  });
  assert(next.restarted);
  assert(next.completed);
  assert.equal(next.next,'story_witness');
  assert.equal(next.active,false);
  assert(next.scene.includes('ETAPA CONCLUÍDA'));
  await page.screenshot({path:path+'/mission-complete.png',
   timeout:30000});
  assert.deepEqual(errors,[]);
  const report={setup,establishing,phase,failure,next,errors,
    visualFormat:'Real game / Chromium software renderer; no 3D GLB cutscene claimed'};
  fs.writeFileSync(path+'/r86-browser-report.json',
   JSON.stringify(report,null,2));
  console.log('DRIVER_R86_REAL_GAME',JSON.stringify(report));
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1});
