'use strict';
/** Chicago R68: test actual browser geometry, road graph and low-cost roofs. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve('qa-artifacts');
fs.mkdirSync(out,{recursive:true});
const base=process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/';
const evidence={status:'STARTED',date:new Date().toISOString(),
    errors:[],note:'Chromium software WebGL E3; NOT PS1 1:1 or Android E5'};
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const ctx=await browser.newContext({viewport:{width:1120,height:700}});
 const page=await ctx.newPage();
 page.setDefaultTimeout(120000);
 page.on('pageerror',e=>evidence.errors.push(String(e)));
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
  const result=await page.evaluate(()=>{
   const g=window.DriverGame,c=g.city;
   const access=window.DriverChicagoLandmarkDistrictR57.audit(c);
   const boxesBefore=c.buildingBoxes.length;
   const all=c.districtLOD?.entries||[];
   const residential=all.find(entry=>{
    const chunk=c.districtChunks?.get(entry.id);
    return chunk?.buildings?.some(b=>b.planned&&
     b.kind==='residential');
   });
   if(!residential)throw Error('No Chicago residential chunk found');
   // Force only the selected district to near level; keep existing
   // collisions and street network completely unchanged.
   const chunk=c.districtChunks.get(residential.id);
   if(!residential.near){
    residential.near=c.buildNearDistrict(chunk);
    residential.buildCount++;
    residential.level='near';
    residential.near.visible=true;
    residential.far.visible=false;
   }
   const roofs=[];
   residential.near.traverse(node=>{
    if(node.name==='chicago-r68-rooflines')
     roofs.push({instances:node.count,vertices:
       node.geometry?.attributes?.position?.count||0,
       visualOnly:!!node.userData?.chicagoVisualOnly,
       isInstanced:!!node.isInstancedMesh});
   });
   const routes=window.DriverChicagoLandmarkDistrictR57.APPROACHES.map(r=>{
    const first=r.points[0],last=r.points.at(-1);
    const plan=DriverChicagoMixedNavigationR49.plan(c,
     {x:first[0],z:first[1]},{x:last[0],z:last[1]});
    return {id:r.id,connected:!!(plan?.length>=2),
     nodes:plan?.length||0};
   });
   g.isPaused=true;
   // Image evidence from the actual Chicago mesh and sun/sky renderer.
   g.camera.position.set(chunk.x-23,58,chunk.z+91);
   g.camera.lookAt(chunk.x,15,chunk.z);
   g.camera.updateProjectionMatrix();
   g.renderer.render(g.scene,g.camera);
   return {city:g.currentCityKey,access,boxesBefore,
    boxesAfter:c.buildingBoxes.length,
    chunk:residential.id,chunkCenter:{x:chunk.x,z:chunk.z},
    roofs,routeChecks:routes,geometry:{
     geometries:g.renderer.info.memory.geometries,
     textures:g.renderer.info.memory.textures,
     drawCalls:g.renderer.info.render.calls}};
  });
  evidence.result=result;
  assert.equal(result.city,'chicago');
  assert.equal(result.access.installed,true);
  assert.equal(result.access.approaches.length,3);
  assert(result.access.approaches.every(r=>r.ok),
   'blocked road approach: '+JSON.stringify(result.access.approaches));
  assert.equal(result.access.graphEdges,14);
  assert(result.routeChecks.every(r=>r.connected),
   'disconnected road: '+JSON.stringify(result.routeChecks));
  assert(result.roofs.length>0&&result.roofs.every(r=>
   r.isInstanced&&r.visualOnly&&r.vertices===18&&r.instances>0),
   'roofs missing or not instanced: '+JSON.stringify(result.roofs));
  assert.equal(result.boxesAfter,result.boxesBefore,
   'visual roof change must not create invisible colliders');
  assert.equal(evidence.errors.length,0,JSON.stringify(evidence.errors));
  await page.screenshot({path:path.join(out,'chicago-r68-rooflines.png'),
   timeout:120000});
  evidence.status='PASS';
  console.log('CHICAGO_R68_BROWSER',JSON.stringify(result));
 }catch(err){
  evidence.status='FAIL';evidence.error=String(err);
  throw err;
 }finally{
  fs.writeFileSync(path.join(out,'chicago-r68-browser.json'),
   JSON.stringify(evidence,null,2));
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
