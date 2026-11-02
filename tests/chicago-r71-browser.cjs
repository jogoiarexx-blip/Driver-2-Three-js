'use strict';
/** R71 E3: actual Chicago world, R22 feeder, river grade and PS1 inventory. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve('qa-artifacts');
fs.mkdirSync(out,{recursive:true});
const report={status:'STARTED',date:new Date().toISOString(),
  pageErrors:[],scope:'Undercover adapted R22 connector, not original PS1 topology'};
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const ctx=await browser.newContext({viewport:{width:1120,height:700}});
 const page=await ctx.newPage();page.setDefaultTimeout(120000);
 page.on('pageerror',e=>report.pageErrors.push(String(e)));
 try{
  await page.addInitScript(()=>localStorage.setItem(
   'driver2-menu-preferences-v1',
   JSON.stringify({models:false,scanlines:false,reducedMotion:true})));
  await page.goto(process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/',
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE,
    null,{timeout:60000});
  assert.equal(await page.evaluate(()=>window.DriverBoot.start('ride')),true);
  await page.waitForFunction(()=>window.DriverBoot?.sessionReady&&
   window.DriverGame?.city?.ready&&
   window.DriverGame?.currentCityKey==='chicago',
   null,{timeout:120000});
  const result=await page.evaluate(async()=>{
   const game=DriverGame,city=game.city;
   const report=city.chicagoPS1StreetNetwork;
   const grade=DriverChicagoPS1StreetNetwork;
   const graph=DriverChicagoMixedNavigationR49.compile(city);
   const inventory=await fetch('./chicago/sector-inventory-r71.json')
     .then(response=>{if(!response.ok)throw Error('sector manifest not served');
       return response.json()});
   const connectors=(report?.links||[]).map(link=>{
     const audited=grade.checkConnector(city,link);
     const mesh=link.mesh;
     const position=mesh?.geometry?.attributes?.position;
     let maxHeightError=0,minY=Infinity,maxY=-Infinity;
     if(position){
       for(let i=0;i<position.count;i++){
         const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
         maxHeightError=Math.max(maxHeightError,
          Math.abs(y-(city.getGroundHeightAt(x,z,null,true)+.039)));
         minY=Math.min(minY,y);maxY=Math.max(maxY,y);
       }
     }
     const route=link.valid?
       DriverChicagoMixedNavigationR49.plan(city,link.from,link.to):null;
     return {id:link.id,valid:link.valid,
       audited:audited.valid,reason:audited.reason||null,
       mesh:!!mesh,vertices:position?.count||0,
       maxHeightError,minY:isFinite(minY)?minY:null,
       maxY:isFinite(maxY)?maxY:null,
       path:route?.length||0,
       floorMatched:!!mesh?.userData?.drivingFloorMatched,
       originalCertified:!!mesh?.userData?.originalPlacementCertified};
   });
   game.isPaused=true;
   if(connectors[0]?.mesh){
     const link=report.links[0];
     const a=link.from,b=link.to;
     game.camera.position.set(a.x+40,43,a.z+100);
     game.camera.lookAt((a.x+b.x)/2,1,(a.z+b.z)/2);
     game.camera.updateProjectionMatrix();
     game.renderer.render(game.scene,game.camera);
   }
   return {city:game.currentCityKey,
     graphEdges:graph.edges,sourcePaths:report?.sourceCorridors,
     connectorsPlanned:report?.connectorsPlanned,
     connectorsAccepted:report?.connectorsAccepted,
     connectorsRejected:report?.connectorsRejected,
     connectors,inventory:{sourceTiles:inventory.sourceTiles,
      sourceTriangles:inventory.sourceTriangles,
      certified:inventory.sectorsCertifiedForGameplay,
      rows:inventory.sectors.length},
     vehicles:game.vehicles.length,
     secretCars:game.vehicles.filter(v=>v.isSecret).length,
     colliders:city.buildingBoxes.length};
  });
  report.result=result;
  console.log('CHICAGO_R71_BROWSER',JSON.stringify(result));
  assert.equal(result.city,'chicago');
  assert.equal(result.inventory.sourceTiles,54);
  assert.equal(result.inventory.rows,54);
  assert.equal(result.inventory.certified,0);
  assert.equal(result.inventory.sourceTriangles,1544872);
  assert(result.connectors.every(x=>x.valid===x.audited));
  assert(result.connectors.filter(x=>x.valid).every(x=>
   x.mesh&&x.floorMatched&&!x.originalCertified&&x.vertices>6&&
   x.maxHeightError<.0001),'graded connector mismatches wheel floor');
  assert.equal(result.connectorsPlanned,result.connectors.length);
  assert.equal(result.secretCars,1);
  assert.equal(result.colliders,369);
  assert.equal(report.pageErrors.length,0,JSON.stringify(report.pageErrors));
  await page.screenshot({path:path.join(out,'chicago-r71-source-feeder.png'),
    timeout:120000});
  report.status='PASS';
 }catch(e){report.status='FAIL';report.error=String(e);throw e}
 finally{
  fs.writeFileSync(path.join(out,'chicago-r71-browser.json'),
   JSON.stringify(report,null,2));
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
