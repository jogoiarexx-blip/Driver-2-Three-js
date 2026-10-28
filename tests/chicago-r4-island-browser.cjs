'use strict';
/** Smoke real em Chromium para o primeiro corredor fora da grade. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=(process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/').replace(/\/?$/,'/');
const dir=path.join(process.cwd(),'qa-artifacts');
fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
    '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
    '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.setDefaultTimeout(120000);
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
   await page.addInitScript(()=>localStorage.setItem(
     'driver2-menu-preferences-v1',JSON.stringify({
       models:false,scanlines:false,reducedMotion:true
     })));
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
   assert(await page.evaluate(()=>window.DriverBoot.start('ride')));
   await page.waitForFunction(()=>window.DriverGame?.city?.ready&&
     window.DriverGame?.playerCar&&window.DriverBoot.sessionReady);
   const inspection=await page.evaluate(()=>{
     const g=window.DriverGame,c=g.city;
     const van=g.vehicles.find(v=>v.name==='FURGÃO GOOSE ISLAND');
     const road=c.chicagoGooseIslandStreet;
     const drivable=DriverRoadGeometry.segmentDrivable(
       c,-196,165,-196,235);
     const buildings=road?.buildings||[];
     const route=van?g.trafficAI.getRoute(van):null;
     return {
       city:g.currentCityKey,
       originalRoad:!!road,mode:road?.mode,
       nodeCarved:!c.sidewalkGrid.has('-200:200'),
       parkCarved:!c.chicagoParks.some(p=>p.x===-200&&p.z===200),
       buildings,collidersAdded:road?.collidersAdded,
       drivable,westCanal:c.isWaterAt(-240,185),
       eastCanal:c.isWaterAt(-160,185),
       roadDry:!c.isWaterAt(-196,200),
       vehicle:van?{x:van.x,z:van.z,name:van.name}:null,
       route:route?{axis:route.axis,road:route.road,
         target:route.target,isIslandSpine:route.isIslandSpine}:null,
       missions:c.missionStart?.type,streetGraph:c.roadAudit
     };
   });
   assert.equal(inspection.city,'chicago');
   assert(inspection.originalRoad);
   assert.equal(inspection.mode,'procedural-r4-island-street');
   assert(inspection.nodeCarved&&inspection.parkCarved);
   assert.equal(inspection.collidersAdded,2);
   assert(inspection.drivable&&inspection.roadDry);
   assert(inspection.westCanal&&inspection.eastCanal);
   assert.equal(inspection.missions,'story_tipoff');
   assert.equal(inspection.vehicle?.name,'FURGÃO GOOSE ISLAND');
   assert.equal(inspection.route?.axis,'z');
   assert.equal(inspection.route?.road,-200);
   assert.equal(inspection.route?.isIslandSpine,true);
   assert.equal(inspection.route?.target.z,240);
   assert(inspection.streetGraph?.largestComponent>=55);
   const maneuver=await page.evaluate(()=>{
     const g=window.DriverGame;
     const van=g.vehicles.find(v=>v.name==='FURGÃO GOOSE ISLAND');
     const route=g.trafficAI.getRoute(van);
     const z=van.z;van.z=235;
     g.trafficAI.chooseNext(van,route,null,false);
     const result={axis:route.axis,sign:route.sign,target:route.target,
       isIslandSpine:route.isIslandSpine,
       dry:!g.city.isWaterAt(route.target.x,route.target.z),
       clear:DriverRoadGeometry.segmentDrivable(g.city,
          van.x,van.z,route.target.x,route.target.z)};
     van.z=z;g.trafficAI.reset();
     return result;
   });
   assert.equal(maneuver.axis,'x');
   assert.equal(maneuver.isIslandSpine,false);
   assert(maneuver.dry&&maneuver.clear);
   assert([-240,-160].includes(maneuver.target.x));
   assert.equal(errors.length,0,errors.join('\n'));
   await page.evaluate(()=>{
     const g=window.DriverGame;
     g.isPaused=true;
     g.camera.position.set(-132,110,255);
     g.camera.lookAt(-200,0,200);
     g.renderer.render(g.scene,g.camera);
   });
   await page.screenshot({
     path:path.join(dir,'chicago-r4-goose-island-spine.png')
   });
   console.log('PASS CHICAGO R4 OFFGRID',JSON.stringify({inspection,maneuver}));
 }finally{
   await page.close();await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
