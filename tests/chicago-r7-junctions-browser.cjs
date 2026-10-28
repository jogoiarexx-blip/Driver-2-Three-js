'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(process.cwd(),'qa-artifacts');fs.mkdirSync(dir,{recursive:true});
const base=(process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/').replace(/\/?$/,'/');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
    '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
    '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1152,height:720}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.addInitScript(()=>localStorage.setItem('driver2-menu-preferences-v1',
      JSON.stringify({models:false,scanlines:false,reducedMotion:true})));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
  assert(await page.evaluate(()=>window.DriverBoot.start('ride')));
  await page.waitForFunction(()=>window.DriverGame?.city?.ready&&window.DriverBoot.sessionReady);
  const data=await page.evaluate(()=>{
    const g=window.DriverGame,c=g.city;
    g.isPaused=true;
    const result=c.chicagoGooseIslandJunctions;
    const sample=(x,z)=>({
      x,z,wet:c.isWaterAt(x,z),
      blocked:c.isPointBlocked(x,z,1.55,0),
      home:!c.isWaterAt(-64,-144)
    });
    const points=[sample(-200,160),sample(-200,240),sample(-200,320)];
    g.camera.position.set(-85,145,286);
    g.camera.lookAt(-200,0,240);
    g.renderer.render(g.scene,g.camera);
    return {city:g.currentCityKey,
      ready:result?.ready,junctionCount:result?.junctionCount,
      patches:result?.patches?.map(p=>({id:p.id,vertices:p.borderVertices})),
      collidersAdded:result?.collidersAdded,
      mission:c.missionStart?.type,points,
      graph:c.roadAudit,
      northTruck:g.vehicles.some(v=>v.name==='CARGA NORTE GOOSE ISLAND'),
      westVisitor:g.vehicles.some(v=>v.name==='ENTREGAS GOOSE ISLAND')
    };
  });
  assert.equal(data.city,'chicago');
  assert.equal(data.ready,true);
  assert.equal(data.junctionCount,3);
  assert.equal(data.collidersAdded,0);
  assert.deepEqual(data.patches.map(p=>p.id),
    ['south-west','industrial','north-exit']);
  assert(data.points.every(x=>!x.wet&&!x.blocked));
  assert.equal(data.mission,'story_tipoff');
  assert(data.graph?.largestComponent>=55);
  assert(data.northTruck&&data.westVisitor);
  assert.equal(errors.length,0,errors.join('\n'));
  await page.screenshot({path:path.join(dir,'chicago-r7-rounded-junctions.png')});
  console.log('CHICAGO R7 ROUNDED JUNCTIONS '+JSON.stringify(data));
 }finally{await page.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
