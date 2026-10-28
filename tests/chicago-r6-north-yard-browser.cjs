'use strict';
/** Chromium: validar a nova rua, o deck norte, o tráfego e as missões. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(process.cwd(),'qa-artifacts');
fs.mkdirSync(root,{recursive:true});
const url=(process.env.DRIVER_QA_URL||
    'http://127.0.0.1:4173/').replace(/\/?$/,'/');
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
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
   assert(await page.evaluate(()=>window.DriverBoot.start('ride')));
   await page.waitForFunction(()=>window.DriverGame?.city?.ready&&
       window.DriverGame?.playerCar&&window.DriverBoot.sessionReady);
   const data=await page.evaluate(()=>{
      const g=window.DriverGame,c=g.city;
      g.isPaused=true;
      const bridge=c.chicagoGooseIslandNorthYard;
      const car=g.vehicles.find(v=>v.name==='CARGA NORTE GOOSE ISLAND');
      if(!bridge||!car)return {error:'Sem pátio R6 ou furgão',
          available:g.vehicles.map(v=>v.name)};
      const ai=g.trafficAI;
      const route=ai.getRoute(car);
      const start={x:car.x,z:car.z,target:{...route.target},
          north:!!route.isNorthYard};
      // Isolar as decisões de rota de uma cópia de posição e manter o
      // veículo real/estado da sessão sem teletransporte.
      const startZ=car.z;
      car.z=312;
      ai.chooseNext(car,route,null,false);
      const exit={target:{...route.target},completed:!!route.northYardCompleted,
          road:route.road,axis:route.axis,
          drivable:DriverRoadGeometry.segmentDrivable(c,
              car.x,car.z,route.target.x,route.target.z,1.55)};
      car.z=startZ;ai.reset();
      g.camera.position.set(-100,145,350);
      g.camera.lookAt(-200,0,280);
      g.renderer.render(g.scene,g.camera);
      return {
          city:g.currentCityKey,
          mode:bridge.mode,
          bridgeCount:bridge.bridgeCount,
          collidersAdded:bridge.collidersAdded,
          accessReady:bridge.accessReady,
          access:bridge.access.segments.map(s=>({name:s.name,safe:s.safe})),
          dryDeck:!c.isWaterAt(-196,306.3),
          wetElsewhere:c.isWaterAt(-220,306.3),
          dryAvenue:!c.isWaterAt(-160,316),
          originalCanalStillWet:DriverChicagoPS1RiverBranches.waterAt(-200,306.3),
          onRoad:DriverRoadGeometry.segmentDrivable(c,-196,244,-196,316),
          warehouses:c.buildingBoxes.filter(b=>b.minZ===266&&b.maxZ===289).length,
          oldVisitor:g.vehicles.some(v=>v.name==='ENTREGAS GOOSE ISLAND'),
          oldRoad:!!c.chicagoGooseIslandStreet,
          originalBridgeCount:c.chicagoPS1RiverBranches?.bridgeCount,
          mission:c.missionStart?.type,
          graph:c.roadAudit,
          start,exit
      };
   });
   assert.equal(data.error,undefined,JSON.stringify(data));
   assert.equal(data.city,'chicago');
   assert.equal(data.mode,'procedural-r6-north-yard');
   assert.equal(data.bridgeCount,1);
   assert.equal(data.collidersAdded,2);
   assert.equal(data.warehouses,2);
   assert.equal(data.accessReady,true);
   assert.equal(data.access.length,4);
   assert(data.access.every(l=>l.safe));
   assert(data.dryDeck&&data.wetElsewhere&&data.dryAvenue);
   assert(data.originalCanalStillWet);
   assert(data.onRoad&&data.oldRoad&&data.oldVisitor);
   assert.equal(data.originalBridgeCount,10);
   assert.equal(data.mission,'story_tipoff');
   assert.equal(data.start.north,true);
   assert.equal(data.start.target.z,320);
   assert.equal(data.exit.completed,true);
   assert.equal(data.exit.axis,'x');
   assert.equal(data.exit.road,320);
   assert([-160,-240].includes(data.exit.target.x));
   assert.equal(data.exit.drivable,true);
   assert(data.graph?.largestComponent>=55);
   assert.deepEqual(errors,[]);
   await page.screenshot({
      path:path.join(root,'chicago-r6-north-yard-bridge.png')
   });
   console.log('PASS CHICAGO R6',JSON.stringify(data));
 }finally{await page.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
