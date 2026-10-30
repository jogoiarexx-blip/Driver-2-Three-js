'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs');fs.mkdirSync('qa-artifacts',{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
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
   window.DriverGame?.city?.ready&&
   window.DriverGame?.city?.chicagoPS1StreetNetwork,
   null,{timeout:120000});
  const report=await page.evaluate(()=>{
   const g=window.DriverGame,city=g.city,
    r=city.chicagoPS1StreetNetwork,
    link=r.links[0],
    source=city.chicagoReferenceNorthNetwork.segments.branch.points.at(-1);
   g.isPaused=true;g.mode='driving';
   g.playerCar.speed=0;g.playerCar.x=source.x;
   g.playerCar.z=source.z;g.playerCar.y=0;
   g.playerCar.heading=Math.PI/2;g.playerCar.updateTransform();
   g.radarWide=true;g.drawRadar();
   const width=link.width,dx=link.to.x-link.from.x,
     dz=link.to.z-link.from.z,len=Math.hypot(dx,dz),
     nx=-dz/len,nz=dx/len;
   const points=[];
   for(let i=0;i<=16;i++){
    const t=i/16,x=link.from.x+dx*t,z=link.from.z+dz*t;
    for(const offset of [-width/2+.65,0,width/2-.65])
     points.push({x:x+nx*offset,z:z+nz*offset,
      water:city.isWaterAt(x+nx*offset,z+nz*offset),
      blocked:city.isPointBlocked(x+nx*offset,z+nz*offset,.6,0)});
   }
   const radar=DriverChicagoPS1StreetNetwork.drawRadar(
    g.radarCtx,city,{x:source.x,z:source.z,heading:0},
    .5,g.radarCanvas.width,g.radarCanvas.height);
   // Física real do veículo, não reposicionamento quadro a quadro.
   const car=new DriverVehicle(g.scene,{
     name:'R22 TEST CAR',bodyStyle:'muscle',color:0x576879,
     x:link.from.x,z:link.from.z,
     heading:Math.atan2(dx,dz),maxSpeed:19,accel:15
   });
   const effects={addSkidMark(){},spawnTireSmoke(){},
     spawnImpactSparks(){},spawnCarBreakaway(){},
     spawnWaterSplash(){},ejectHubcap(){}};
   const drive={frames:0,fromDistance:len,toDistance:Infinity,
     wetFrames:0,blockedFrames:0,maxDamage:0,samples:[]};
   try{
     for(let frame=0;frame<320;frame++){
       car.updatePhysics(1/30,{
         up:true,down:false,left:false,right:false,handbrake:false
       },city,effects,null,false);
       drive.frames=frame+1;
       const dist=Math.hypot(car.x-link.to.x,car.z-link.to.z);
       drive.toDistance=dist;
       if(city.isWaterAt(car.x,car.z))drive.wetFrames++;
       if(city.isPointBlocked(car.x,car.z,1.55,car.y))
         drive.blockedFrames++;
       drive.maxDamage=Math.max(drive.maxDamage,car.damage);
       if(frame%30===0)drive.samples.push({
         x:+car.x.toFixed(2),z:+car.z.toFixed(2),
         speed:+car.speed.toFixed(2),distance:+dist.toFixed(2)
       });
       if(dist<3.4)break;
     }
   }finally{
     g.scene.remove(car.root);
     if(typeof GPUResourceUtils!=='undefined')
       GPUResourceUtils.disposeSubtree(car.root);
   }
   return {
    sourceCorridors:r.sourceCorridors,connectorsPlanned:r.connectorsPlanned,
    connectorsAccepted:r.connectorsAccepted,
    meshParent:link.mesh?.parent===city.cityGroup,
    meshName:link.mesh?.name||null,
    startToSurveyEnd:Math.hypot(link.from.x-source.x,link.from.z-source.z),
    safeSamples:points.length,
    blocked:points.filter(p=>p.blocked).length,
    submerged:points.filter(p=>p.water).length,
    radarPaths:r.radarPaths.length,radarDrawn:radar,
    physicalDrive:drive,
    stillAtChicago:g.currentCityKey==='chicago',
    wholePS1MapCertified:r.wholePS1MapCertified,
    missionsMigrated:r.missionsMigrated
   };
  });
  console.log('CHICAGO_R22_ROAD_BROWSER',JSON.stringify(report));
  fs.writeFileSync('qa-artifacts/chicago-r22-street-network.json',
   JSON.stringify({report,errors},null,2));
  assert.equal(report.sourceCorridors,8);
  assert.equal(report.connectorsAccepted,1);
  assert(report.meshParent);
  assert.equal(report.startToSurveyEnd,0);
  assert.equal(report.blocked,0);
  assert.equal(report.submerged,0);
  assert(report.safeSamples>=45);
  assert.equal(report.radarPaths,9);
  assert(report.radarDrawn>1);
  assert(report.physicalDrive.toDistance<3.4,
    'real car could not reach the north grid via the new street: '+
    JSON.stringify(report.physicalDrive));
  assert.equal(report.physicalDrive.wetFrames,0);
  assert.equal(report.physicalDrive.blockedFrames,0);
  assert(report.physicalDrive.maxDamage<8);
  assert(report.stillAtChicago);
  assert.equal(report.wholePS1MapCertified,false);
  assert.equal(report.missionsMigrated,false);
  assert.equal(errors.length,0,errors.join('\n'));
  const canvas=await page.evaluate(()=>document.getElementById(
   window.DriverGame.radarCanvas.id)?.id||null);
  if(canvas)await page.locator('#'+canvas).screenshot({
   path:'qa-artifacts/chicago-r22-radar.png'});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
