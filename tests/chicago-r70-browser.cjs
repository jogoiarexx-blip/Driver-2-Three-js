'use strict';
/** R70: real WebGL Chicago bridge grade and movable-deck navigation. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve('qa-artifacts');
fs.mkdirSync(out,{recursive:true});
const base=process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/';
const report={date:new Date().toISOString(),status:'STARTED',pageErrors:[],
    evidence:'Chromium E3 with real Chicago world geometry, not Android E5'};
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const context=await browser.newContext({viewport:{width:1120,height:700}});
 const page=await context.newPage();page.setDefaultTimeout(120000);
 page.on('pageerror',e=>report.pageErrors.push(String(e)));
 try{
  await page.addInitScript(()=>localStorage.setItem(
   'driver2-menu-preferences-v1',
   JSON.stringify({models:false,scanlines:false,reducedMotion:true})));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE,
   null,{timeout:60000});
  assert.equal(await page.evaluate(()=>window.DriverBoot.start('ride')),true);
  await page.waitForFunction(()=>window.DriverBoot?.sessionReady&&
   window.DriverGame?.city?.ready&&
   window.DriverGame?.currentCityKey==='chicago',
   null,{timeout:120000});
  const checked=await page.evaluate(()=>{
   const game=window.DriverGame,city=game.city;
   const nav=window.DriverChicagoMixedNavigationR49;
   game.isPaused=true;
   const originallyRaised=city.bridgeRaised;
   const originalAngle=city.bridgeAngle;
   city.bridgeRaised=false;city.bridgeAngle=.08;
   const crossings=[0,240].map(x=>{
    const from={x,z:0},to={x,z:80};
    const baseline=nav.clear(city,from,to,true,4);
    const grade=nav.gradeClear(city,from,to,true,4);
    const heightSamples=[0,20,34,42,50,58,66,80].map(z=>({
       z,height:city.getGroundHeightAt(x,z,null,true)
    }));
    return {x,from,to,baseline,grade,heightSamples};
   });
   const open=nav.compile(city);
   const eastOpen=!!open.adj.get('240,0')?.some(e=>e.key==='240,80');
   const centralOpen=!!open.adj.get('0,0')?.some(e=>e.key==='0,80');
   const fixed={from:{x:-280,z:-80},to:{x:-200,z:-80}};
   fixed.passable=nav.clear(city,fixed.from,fixed.to,true,4);
   fixed.dryAtDeck=!city.isWaterAt(-240,-80);
   const carCount=game.vehicles.length,
         secretCount=game.vehicles.filter(v=>v.isSecret).length,
         colliderCount=city.buildingBoxes.length;
   city.bridgeRaised=true;city.bridgeAngle=38*Math.PI/180;
   const raised=nav.compile(city);
   const eastClosed=!raised.adj.get('240,0')?.some(e=>e.key==='240,80');
   const centralClosed=!raised.adj.get('0,0')?.some(e=>e.key==='0,80');
   const fixedRaised=nav.clear(city,fixed.from,fixed.to,true,4);
   const mask=[0,240].map(x=>nav.bridgeClosed(city,
       {x,z:0},{x,z:80}));
   const partial=[0,240].map(x=>nav.bridgeClosed(city,
       {x,z:40},{x,z:80}));
   city.bridgeRaised=false;city.bridgeAngle=.08;
   const reopened=nav.compile(city);
   const eastReopened=!!reopened.adj.get('240,0')?.some(
       e=>e.key==='240,80');
   const centralReopened=!!reopened.adj.get('0,0')?.some(
       e=>e.key==='0,80');
   city.bridgeRaised=originallyRaised;city.bridgeAngle=originalAngle;
   game.camera.position.set(205,51,125);
   game.camera.lookAt(240,1,50);
   game.camera.updateProjectionMatrix();
   game.renderer.render(game.scene,game.camera);
   return {crossings,eastOpen,centralOpen,eastClosed,centralClosed,
       eastReopened,centralReopened,fixed,fixedRaised,mask,partial,
       graphChanged:raised!==open&&reopened!==raised,
       carCount,secretCount,colliderCount,
       sourceCorridors:open.sourceCorridors,graphEdges:open.edges};
  });
  report.result=checked;
  console.log('CHICAGO_R70_BROWSER',JSON.stringify(checked));
  assert(checked.crossings.every(p=>p.baseline&&p.grade),
   'not driveable when lowered: '+JSON.stringify(checked.crossings));
  assert(checked.eastOpen&&checked.centralOpen,'lowered deck missing from graph');
  assert(checked.eastClosed&&checked.centralClosed,'raised deck still connected');
  assert(checked.eastReopened&&checked.centralReopened,'bridge not reconnected');
  assert(checked.fixed.passable&&checked.fixed.dryAtDeck&&checked.fixedRaised,
   'fixed west river bridge incorrectly closed or flooded');
  assert(checked.mask.every(Boolean)&&checked.partial.every(Boolean));
  assert(checked.graphChanged);
  assert.equal(checked.secretCount,1);
  assert.equal(checked.colliderCount,369,'must not add invisible building colliders');
  assert.equal(report.pageErrors.length,0,JSON.stringify(report.pageErrors));
  await page.screenshot({
   path:path.join(out,'chicago-r70-east-bascule.png'),timeout:120000});
  report.status='PASS';
 }catch(err){report.status='FAIL';report.error=String(err);throw err;}
 finally{
  fs.writeFileSync(path.join(out,'chicago-r70-bridges.json'),
   JSON.stringify(report,null,2));
  await browser.close();
 }
})().catch(err=>{console.error(err);process.exitCode=1;});
