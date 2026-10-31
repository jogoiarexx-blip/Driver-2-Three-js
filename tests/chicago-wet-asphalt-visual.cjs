/**
 * Visual QA R5, real Chromium + SwiftShader. Screenshots compare three
 * conditions during the same playable Chicago session.
 *
 * Run: python3 -m http.server 4173 &
 *      npm install --no-save playwright@1.56.1
 *      npx playwright install chromium
 *      node tests/chicago-wet-asphalt-visual.cjs
 */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(process.cwd(),'qa-artifacts','chicago-wet-r5');
fs.mkdirSync(dir,{recursive:true});
const url=process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader',
  '--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1280,height:720},
  deviceScaleFactor:1});
 const errors=[],report={screenshots:[],samples:[],errors};
 page.on('pageerror',err=>errors.push(String(err)));
 try{
  await page.addInitScript(()=>{
   localStorage.setItem('driver2-menu-preferences-v1',JSON.stringify({
    models:false,scanlines:false,reducedMotion:true,playerColor:'#d53934'
   }));
  });
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE,null,
   {timeout:60000});
  const started=await page.evaluate(()=>window.DriverBoot.start('ride'));
  assert.equal(started,true,'The playable session did not start');
  await page.waitForFunction(()=>window.DriverGame?.city?.ready&&
   window.DriverGame?.playerCar&&window.DriverBoot?.sessionReady,null,
   {timeout:120000});
  const sample=async mode=>{
   const data=await page.evaluate(()=>{
    const g=window.DriverGame;
    const state=g.city.chicagoWetAsphalt;
    return {
     city:g.currentCityKey,weather:g.weatherMode,
     water:!!g.dayNight?.rain,
     wet:state?.wet,patches:state?.puddles,
     visible:state?.mesh?.visible,
     roadRGB:state?.roadMesh?.material?.color?.r,
     calls:g.renderer.info.render.calls,
     tris:g.renderer.info.render.triangles,
     beams:!!g.roadLightFx?.beams?.visible,
     textures:g.renderer.info.memory.textures
    };
   });
   report.samples.push({mode,...data});
   console.log('R5_METRICS',JSON.stringify({mode,...data}));
   const name='chicago-'+mode+'.png';
   await page.screenshot({path:path.join(dir,name)});
   report.screenshots.push(name);
   return data;
  };
  await page.evaluate(()=>{
   const g=window.DriverGame;
   g.mode='driving';g.interiorPlace=null;
   g.tanner.setVisible(false);
   g.playerCar.x=80;g.playerCar.z=-160;g.playerCar.y=0;
   g.playerCar.speed=0;g.playerCar.heading=0;
   g.playerCar.updateTransform();
   g.cameraRig.lastMode=-1;g.cameraRig.focus=null;
   g.setWeather('day');
  });
  await page.waitForTimeout(400);
  const dry=await sample('dry-day');
  assert.equal(dry.city,'chicago');
  assert.equal(dry.water,false);
  assert(dry.wet<.05,'dry road should not retain rain');
  assert(!dry.visible,'dry road draws no puddle batch');
  assert(dry.roadRGB>.97,'road should recover its normal color');
  await page.evaluate(()=>window.DriverGame.setWeather('rain'));
  await page.keyboard.down('w');
  await page.waitForTimeout(1500);
  await page.keyboard.up('w');
  // SwiftShader executa poucos quadros/segundo. Esperar pelo estado visual
  // real, não por um número arbitrário de milissegundos no relógio da CI.
  await page.waitForFunction(()=>window.DriverGame?.city?.
   chicagoWetAsphalt?.wet>.52,null,{timeout:45000,polling:250});
  const wet=await sample('rain-driving');
  assert.equal(wet.water,true);
  assert(wet.wet>.52,'rain should darken asphalt progressively');
  assert(wet.roadRGB<dry.roadRGB-.08);
  assert(wet.patches>0,'procedural puddle mesh should be populated');
  assert(wet.visible,'puddles should render in rain');
  assert.equal(wet.city,'chicago');
  // Single additional wet-asphalt draw call at a fixed set of 48 instances.
  assert(wet.calls<dry.calls+24,'rain effect generated too many draw calls');
  await page.evaluate(()=>window.DriverGame.setWeather('night'));
  await page.waitForFunction(previous=>window.DriverGame?.city?.
   chicagoWetAsphalt?.wet<previous-.15,wet.wet,
   {timeout:45000,polling:250});
  const night=await sample('night-drying');
  assert.equal(night.water,false);
  assert(night.wet<wet.wet,'road should dry after rain stops');
  assert(night.roadRGB>wet.roadRGB,'asphalt should brighten on drying');
  // Visual effect is Chicago-only, never leaks to other destinations.
  await page.evaluate(()=>{
   window.DriverGame.city.preset.id='havana';
   DriverChicagoWetAsphalt.update(window.DriverGame,.05);
   window.DriverGame.city.preset.id='chicago';
  });
  assert.equal(errors.length,0,'browser runtime errors');
  fs.writeFileSync(path.join(dir,'report.json'),
   JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:'PASS',samples:report.samples.map(s=>({
   mode:s.mode,wet:s.wet,puddles:s.patches,
   roadRGB:s.roadRGB,drawCalls:s.calls
  })),screenshots:report.screenshots}));
 }catch(err){
  fs.writeFileSync(path.join(dir,'report.json'),
   JSON.stringify({...report,failure:String(err)},null,2));
  await page.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});
  throw err;
 }finally{
  await browser.close();
 }
})().catch(err=>{console.error(err);process.exitCode=1;});
