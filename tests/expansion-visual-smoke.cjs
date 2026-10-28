/** Playwright runtime certification for four classic modes and six missions.
 * Separate from city-frame benchmark so a failure identifies its mode. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const DIR=path.join(process.cwd(),'qa-artifacts');
fs.mkdirSync(DIR,{recursive:true});
const BASE=process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
    '--use-gl=angle','--use-angle=swiftshader',
    '--enable-webgl','--ignore-gpu-blocklist',
    '--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1152,height:720}});
 page.setDefaultTimeout(120000);
 const errors=[],scenarios=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.addInitScript(()=>{
   localStorage.setItem('driver2-menu-preferences-v1',JSON.stringify({
    models:false,scanlines:false,reducedMotion:true
   }));
  });
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
  assert(await page.evaluate(()=>window.DriverBoot.start('ride')));
  await page.waitForFunction(()=>window.DriverGame?.city.ready&&
    window.DriverGame.playerCar&&window.DriverBoot.sessionReady,
    null,{timeout:120000});
  const check=async type=>{
   const result=await page.evaluate(type=>{
    const g=window.DriverGame;
    g.startMission(type);
    return {type:g.missionType,active:g.missionActive,
       city:g.currentCityKey,time:g.missionTimeLeft,
       classic:!!g.classicState,regional:!!g.regionalState,
       markers:g.missionMarkers.length,
       title:document.getElementById('mission-title').textContent,
       intro:!!g.briefingDirector?.active,
       target:!!g.targetCar};
   },type);
   assert.equal(result.type,type);
   assert(result.active&&result.time>0,result.title);
   scenarios.push(result);return result;
  };
  for(const type of ['arcade_getaway','gate_racing','arcade_checkpoint',
      'arcade_quickchase']){
   const data=await check(type);
   assert(data.classic);
   if(type==='gate_racing')assert.equal(data.markers,8);
   if(type==='arcade_checkpoint')assert.equal(data.markers,5);
   if(type==='arcade_quickchase')assert(data.target);
   if(type==='gate_racing'){
      await sleep(500);
      await page.screenshot({path:path.join(DIR,
        'driving-games-gate-racing.png')});
   }
  }
  for(const [city,modes] of [
    ['vegas',['story_vegas_ambulance','story_vegas_c4','story_vegas_heist']],
    ['rio',['story_rio_barge','story_rio_jericho','story_rio_helicopter']]
  ]){
    // Start chapter directly from the previous city; this catches
    // recursive restart bugs that a manual city switch would mask.
    const first=await check(modes[0]);
    assert.equal(first.city,city);
    await page.waitForFunction(id=>window.DriverGame.currentCityKey===id&&
       window.DriverGame.city.ready,city,{timeout:120000});
    for(const type of modes){
        const data=type===modes[0]?first:await check(type);
        assert.equal(data.city,city);
        assert(data.regional&&data.intro,'Undercover intro or director absent');
        if(type==='story_vegas_c4'){
            assert.equal(data.markers,1);
            await sleep(450);
            await page.screenshot({path:path.join(DIR,
                'undercover-vegas-c4-intro.png')});
            // Reveal real generator/truck after the 5s introduction.
            await page.evaluate(()=>{
                const g=window.DriverGame,p=g.playerCar;
                p.x=160;p.z=-160;p.y=0;p.heading=Math.PI/2;p.speed=0;
                p.root.position.set(p.x,0,p.z);p.root.rotation.y=p.heading;
                g.cameraRig.lastMode=-1;g.cameraRig.focus=null;
            });
            await sleep(5550);
            await page.screenshot({path:path.join(DIR,
                'undercover-vegas-depot-gameplay.png')});
        }
        if(type==='story_rio_helicopter'){
            await sleep(450);
            await page.screenshot({path:path.join(DIR,
                'undercover-rio-helicopter-intro.png')});
            await page.evaluate(()=>{
                const g=window.DriverGame,p=g.playerCar;
                p.x=0;p.z=-160;p.y=0;p.heading=0;p.speed=0;
                p.root.position.set(0,0,-160);p.root.rotation.y=0;
                g.cameraRig.lastMode=-1;g.cameraRig.focus=null;
            });
            await sleep(5550);
            await page.screenshot({path:path.join(DIR,
                'undercover-rio-helicopter-gameplay.png')});
        }
    }
  }
  assert.equal(scenarios.length,10);
  assert.equal(errors.length,0,'Browser exceptions: '+errors.join(' | '));
  fs.writeFileSync(path.join(DIR,'expansion-report.json'),
    JSON.stringify({status:'PASS',scenarios,errors},null,2));
  console.log('EXPANSION_BROWSE_PASS 10 modes • arcade and Undercover');
 }catch(e){
   fs.writeFileSync(path.join(DIR,'expansion-report.json'),
       JSON.stringify({status:'FAIL',scenarios,errors,error:String(e?.stack||e)},null,2));
   await page.screenshot({path:path.join(DIR,'expansion-failure.png')}).catch(()=>{});
   console.error(e);process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
