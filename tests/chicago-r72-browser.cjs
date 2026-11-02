'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),
    fs=require('node:fs'),path=require('node:path');
const folder=path.resolve('qa-artifacts');
fs.mkdirSync(folder,{recursive:true});
const base=process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/';
const report={date:new Date().toISOString(),status:'STARTED',errors:[],
    disclaimer:'R72 source corridor is ORIGINAL VISUAL INSPECTION, not a certified new driveable Undercover road'};
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
    '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
    '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await context.newPage();
 page.setDefaultTimeout(120000);
 page.on('pageerror',e=>report.errors.push(String(e)));
 try{
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
   assert(await page.locator('a[href="./chicago-original-preview.html"]').count());
   await page.goto(new URL('chicago-original-preview.html',base).href,
    {waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>document.querySelector('#corridor72')&&
       document.querySelector('canvas'),null,{timeout:90000});
   await page.locator('#corridor72').click();
   await page.waitForFunction(()=>
     window.__chicagoR72?.overlay?.visible===true,
      null,{timeout:120000});
   const inspect=await page.evaluate(()=>{
     const current=window.__chicagoR72;
     const report=current.report,material=current.materialEvidence,
         overlay=current.overlay;
     const controls=document.querySelector('#corridor72');
     return {
       edgeId:report.candidateEdgeId,sourceNodeIds:report.nodeIds,
       lengthOBJ:report.lengthPolylineOBJ,sourceGLBs:report.tiles.map(t=>t.id),
       shaderGeometry:overlay.children.map(x=>({name:x.name,
          vertices:x.geometry?.attributes?.position?.count||0})),
       material:{confidence:material.confidence,center:material.center,
         shoulders:material.shoulders,laneEdges:material.laneEdges,
         outerEdges:material.outerEdges,grass:material.grass,
         outside:material.outside,water:material.water},
       projected:report.projectedUndercoverR15.bounds,
       outsideGrid:!report.projectedUndercoverR15.withinLegacyGrid320,
       certified:report.originalRoadCertified,
       traffic:report.gameTrafficEnabled,
       createdColliders:overlay.userData.collidersCreated,
       visualOnly:overlay.userData.visualOnly,
       text:document.querySelector('#corridor72-audit').textContent,
       label:controls.textContent
     };
   });
   report.inspection=inspect;
   assert.equal(inspect.edgeId,3445);
   assert.deepEqual(inspect.sourceGLBs,['01_02','01_03']);
   assert.equal(inspect.lengthOBJ,16.375);
   assert(inspect.outsideGrid,'uncalibrated source must not be auto-inserted');
   assert.equal(inspect.certified,false);
   assert.equal(inspect.traffic,false);
   assert.equal(inspect.createdColliders,0);
   assert(inspect.visualOnly);
   assert(inspect.shaderGeometry.every(x=>x.vertices>0));
   assert(inspect.text.includes('GLBs 01_02, 01_03'));
   assert(inspect.text.includes('intermediária'));
   assert(inspect.text.includes('margem externa 0%'));
   assert(inspect.material.grass>.9);
   assert(inspect.text.includes('NENHUMA rua'));
   await page.locator('#corridor72').click();
   assert.equal(await page.evaluate(()=>window.__chicagoR72.overlay.visible),false);
   await page.locator('#corridor72').click();
   assert.equal(await page.evaluate(()=>window.__chicagoR72.overlay.visible),true);
   await page.waitForTimeout(2000); // allow GLB streamer to follow focused corridor
   await page.screenshot({path:path.join(folder,'chicago-r72-original-corridor.png'),
       timeout:120000});
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.DriverBoot&&window.THREE,null,
      {timeout:60000});
   assert.equal(await page.evaluate(()=>window.DriverBoot.start('ride')),true);
   await page.waitForFunction(()=>window.DriverBoot?.sessionReady&&
        window.DriverGame?.city?.ready&&
        window.DriverGame?.currentCityKey==='chicago',
        null,{timeout:120000});
   report.undercover=await page.evaluate(()=>{
     const game=window.DriverGame,city=game.city;
     return {city:game.currentCityKey,
       vehicles:game.vehicles.length,
       secretCars:game.vehicles.filter(v=>v.isSecret).length,
       colliders:city.buildingBoxes.length,
       sourceConnectors:city.chicagoPS1StreetNetwork?.connectorsAccepted,
       noR72TrafficNodes:!city.chicagoCorridorR72};
   });
   assert.equal(report.undercover.city,'chicago');
   assert.equal(report.undercover.secretCars,1);
   assert.equal(report.undercover.colliders,369);
   assert(report.undercover.noR72TrafficNodes);
   assert.equal(report.errors.length,0,JSON.stringify(report.errors));
   report.status='PASS';
   console.log('CHICAGO_R72_BROWSER',JSON.stringify({
     original:inspect,undercover:report.undercover
   }));
 }catch(err){report.status='FAIL';report.error=String(err);throw err;}
 finally{
   fs.writeFileSync(path.join(folder,'chicago-r72-browser.json'),
     JSON.stringify(report,null,2));
   await browser.close();
 }
})().catch(err=>{console.error(err);process.exitCode=1;});
