'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const DIR='qa-artifacts';fs.mkdirSync(DIR,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1152,height:720}}),errors=[],requests=[],reports=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(/caminhonete|moto-otimizada|barco%20de%20pesca/.test(r.url()))requests.push(r.url());});
 page.setDefaultTimeout(120000);
 try{
  await page.addInitScript(()=>localStorage.setItem('driver2-menu-preferences-v1',JSON.stringify({models:false,scanlines:false,reducedMotion:true})));
  await page.goto(process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
  assert(await page.evaluate(()=>window.DriverBoot.start('ride')));
  await page.waitForFunction(()=>window.DriverGame?.city.ready&&window.DriverBoot.sessionReady);
  await page.evaluate(()=>{const g=window.DriverGame;g.isPaused=true;if(!g.freeVehicleAssets.enabled)g.freeVehicleAssets.toggle();});
  for(const city of ['chicago','havana','chicago']){
   if(reports.length){assert(await page.evaluate(c=>window.DriverGame.requestCityChange(c),city));await page.waitForFunction(c=>window.DriverGame.currentCityKey===c&&window.DriverGame.city.ready,city);}
   await page.evaluate(()=>{window.DriverGame.isPaused=true;window.DriverGame.freeVehicleAssets.decorateFleet();});
   await page.waitForFunction(()=>window.DriverGame.vehicles.filter(v=>v.uploadedModel).length===3&&window.DriverGame.vehicles.filter(v=>v.uploadedModel).every(v=>v._uploadedCustomModel===v.uploadedModel));
   if(city==='chicago')await page.waitForFunction(()=>window.DriverGame.freeVehicleAssets.uploaded.boat?.parent===window.DriverGame.city.cityGroup);
   const report=await page.evaluate(()=>{
    const g=window.DriverGame,roster=g.freeVehicleAssets.uploaded;
    return {city:g.currentCityKey,states:{...roster.states},boat:roster.boat?.parent===g.city.cityGroup,
     models:g.vehicles.filter(v=>v.uploadedModel).map(v=>{
      let maxTexture=0,meshes=0;v.chassisTilt.traverse(n=>{if(n.isMesh)meshes++;for(const m of (Array.isArray(n.material)?n.material:[n.material]).filter(Boolean))for(const t of Object.values(m))if(t?.isTexture&&t.image)maxTexture=Math.max(maxTexture,t.image.width||0,t.image.height||0);});
      return {id:v.uploadedModel,style:v.bodyStyle,meshes,maxTexture,blocked:g.city.isPointBlocked(v.x,v.z,1.55),water:g.city.isWaterAt(v.x,v.z),dimensions:DriverVehicleCollisions.dimensions(v)};
     })};
   });
   assert.equal(report.models.length,3);for(const m of report.models){assert(m.meshes>0);assert(m.maxTexture>0&&m.maxTexture<=1024);assert(!m.water&&!m.blocked,JSON.stringify(m));}
   assert.equal(report.boat,city==='chicago');reports.push(report);
   for(const id of ['pickup-new','pickup-old','motorcycle']){
    const drive=await page.evaluate(id=>{
     const g=window.DriverGame,v=g.vehicles.find(v=>v.uploadedModel===id);
     g.gameEnded=false;g.inReplayMode=false;g.mode='on_foot';g.tanner.setPosition(v.x-2,v.y,v.z,0);g.toggleVehicleEnterExit();
     const entered=g.playerCar===v&&g.mode==='driving';DriverUploadedVehicles.updateRiders(g);
     const riderOn=v.motorcycleRider?.visible;
     v.x=4;v.z=-110;v.heading=0;v.speed=0;v.damage=0;v.updateTransform();const before=v.z;
     for(let i=0;i<60;i++)v.updatePhysics(1/60,{up:true},g.city,g.effects,g.audio,true);
     const distance=v.z-before;v.speed=0;g.toggleVehicleEnterExit();DriverUploadedVehicles.updateRiders(g);
     return {entered,distance,damage:v.damage,submerged:v.isSubmerged,exited:g.mode==='on_foot',riderOn,riderOff:v.motorcycleRider?!v.motorcycleRider.visible:true};
    },id);
    assert(drive.entered&&drive.exited,JSON.stringify({id,drive}));assert(drive.distance>3&&!drive.submerged);if(id==='motorcycle')assert(drive.riderOn&&drive.riderOff);
    await page.evaluate(id=>{const g=window.DriverGame,v=g.vehicles.find(v=>v.uploadedModel===id);g.camera.position.set(v.x+8,4.5,v.z+9);g.camera.lookAt(v.x,1,v.z);g.renderer.render(g.scene,g.camera);},id);
    await page.screenshot({path:`${DIR}/uploaded-${id}-${city}-${reports.length}.png`});
   }
   await page.evaluate(()=>{const g=window.DriverGame;g.freeVehicleAssets.toggle();});
   assert(await page.evaluate(()=>window.DriverGame.vehicles.filter(v=>v.uploadedModel).every(v=>!v._uploadedCustomModel)));
   await page.evaluate(()=>window.DriverGame.freeVehicleAssets.toggle());
   await page.waitForFunction(()=>window.DriverGame.vehicles.filter(v=>v.uploadedModel).every(v=>v._uploadedCustomModel===v.uploadedModel));
  }
  assert.equal(requests.length,4,'Uploads must be downloaded once across toggles and city changes');assert.equal(new Set(requests).size,4);assert.equal(errors.length,0,errors.join('\n'));
  fs.writeFileSync(`${DIR}/uploaded-vehicles-report.json`,JSON.stringify({status:'PASS',reports,requests,errors},null,2));console.log(JSON.stringify({status:'PASS',reports,downloads:requests.length}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
