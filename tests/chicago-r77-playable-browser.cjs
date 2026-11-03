'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),
 fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.addInitScript(()=>localStorage.setItem('driver2-menu-preferences-v1',
   JSON.stringify({models:false,scanlines:false,reducedMotion:true})));
  await page.goto(process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/',
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
  assert(await page.evaluate(()=>window.DriverBoot.start('ride')));
  await page.waitForFunction(()=>window.DriverBoot?.sessionReady&&
   window.DriverGame?.city?.ready&&window.DriverGame?.currentCityKey==='chicago',
   null,{timeout:120000});
  const report=await page.evaluate(()=>{
   const g=window.DriverGame,c=g.city,s=c.chicagoPS1PlayableLandmarksR77;
   return {city:g.currentCityKey,root:s?.root?.parent===c.cityGroup,
    landmarkIds:s?.sites?.map(p=>p.id)||[],signs:s?.signs||0,
    sourceCertified:s?.originalPS1CoordinatesCertified,
    collisionBoxes:s?.colliders?.length||0,
    parcelSafety:s?.sites?.map(site=>({
     id:site.id,dry:!c.isWaterAt(site.x,site.z),
     blocked:c.isPointBlocked(site.x,site.z,.25,0),
     adjacentClear:!c.isPointBlocked(site.x+28,site.z,.25,0)
    }))||[],
    safeHouseAlive:!!c.safeHouseZone,
    stadiumAlive:!!c.chicagoStadium,
    solver:{ground:typeof c.getGroundHeightAt==='function',
     water:typeof c.isWaterAt==='function'},
    collisionCount:c.buildingBoxes.length,
    sourceRoadCertified:c.chicagoPS1StreetNetwork?.wholePS1MapCertified
   };
  });
  fs.mkdirSync('qa-artifacts/chicago-r77',{recursive:true});
  fs.writeFileSync('qa-artifacts/chicago-r77/gameplay.json',
   JSON.stringify({report,errors},null,2));
  console.log('CHICAGO_R77_GAMEPLAY',JSON.stringify(report));
  assert.equal(report.city,'chicago');
  assert(report.root,'landmarks missing from actual city Group');
  assert.deepEqual(report.landmarkIds,
   ['sears-tower','marina-city','merchandise-mart','water-tower']);
  assert.equal(report.signs,6);
  assert.equal(report.collisionBoxes,6);
  assert.equal(report.sourceCertified,false);
  assert(report.parcelSafety.every(p=>p.dry&&p.blocked),
   'all visible ground-level structures need actual colliders on dry land');
  assert(report.parcelSafety.every(p=>p.adjacentClear),
   'landmark structure must not block adjacent street');
  assert(report.safeHouseAlive&&report.stadiumAlive);
  assert(report.solver.ground&&report.solver.water);
  assert.equal(report.sourceRoadCertified,false);
  assert.equal(errors.length,0,errors.join('\n'));
  await page.screenshot({path:'qa-artifacts/chicago-r77/gameplay.png',
   timeout:30000});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
