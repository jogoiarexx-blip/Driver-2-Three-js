'use strict';
/**
 * Chicago R23: carregar a cidade e dirigir por trecho fonte-sem-Rom-certificado.
 * Colisão e condução são observadas no runtime, sem deslocar X/Z ou heading
 * entre quadros. A direção é dada pelo controle arcade normal.
 */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs');fs.mkdirSync('qa-artifacts',{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1152,height:720}});
 page.setDefaultTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.addInitScript(()=>localStorage.setItem('driver2-menu-preferences-v1',
   JSON.stringify({models:false,scanlines:false,reducedMotion:true})));
  await page.goto(process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/',
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
  assert(await page.evaluate(()=>window.DriverBoot.start('ride')));
  await page.waitForFunction(()=>window.DriverBoot?.sessionReady&&
   window.DriverGame?.city?.ready&&window.DriverGame?.city?.chicagoReferenceNorthCandidateR23,
   null,{timeout:120000});
  const report=await page.evaluate(()=>{
   const game=window.DriverGame,city=game.city,
    road=city.chicagoReferenceNorthCandidateR23,
    pts=road.points,graph=city.chicagoPS1StreetNetwork,
    first=pts[0],second=pts[1],last=pts.at(-1);
   game.isPaused=true;
   const pathDistance=(x,z)=>{
    let best=Infinity;
    for(let i=1;i<pts.length;i++)
     best=Math.min(best,DriverChicagoPS1StreetNetwork.distancePointSegment(
       {x,z},pts[i-1],pts[i]));
    return best;
   };
   const footprint={samples:0,water:0,blocked:0};
   for(let i=0;i<pts.length;i++){
    const prev=pts[Math.max(0,i-1)],next=pts[Math.min(pts.length-1,i+1)];
    const dx=next.x-prev.x,dz=next.z-prev.z,
      len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;
    for(const offset of [-2.3,0,2.3]){
     const x=pts[i].x+nx*offset,z=pts[i].z+nz*offset;
     footprint.samples++;
     if(city.isWaterAt(x,z))footprint.water++;
     if(city.isPointBlocked(x,z,1.55,0))footprint.blocked++;
    }
   }
   const car=new DriverVehicle(game.scene,{
    name:'R23 PS1 SOURCE DRIVE',bodyStyle:'sedan',
    x:first.x,z:first.z,
    heading:Math.atan2(second.x-first.x,second.z-first.z),
    maxSpeed:12,accel:10,color:0x536875
   });
   const effects={addSkidMark(){},spawnTireSmoke(){},
     spawnImpactSparks(){},spawnCarBreakaway(){},
     spawnWaterSplash(){},ejectHubcap(){}};
   let progress=0,offroadFrames=0,maxOffset=0,peakOffset=null,maxDamage=0,
       waterFrames=0,blockedFrames=0,frames=0,
       finalDistance=Infinity;
   const samples=[];
   try{
    for(let frame=0;frame<1500;frame++){
     // Progresso monotônico até o ponto próximo, alvo > 7m à frente.
     let closest=progress,nearest=Infinity;
     for(let i=progress;i<pts.length;i++){
      const d=Math.hypot(car.x-pts[i].x,car.z-pts[i].z);
      if(d<nearest){nearest=d;closest=i;}
     }
     progress=Math.max(progress,closest);
     let target=pts.at(-1),distance=0;
     for(let i=progress+1;i<pts.length;i++){
      distance+=Math.hypot(pts[i].x-pts[i-1].x,
        pts[i].z-pts[i-1].z);
      if(distance>4.5){target=pts[i];break;}
     }
     const desired=Math.atan2(target.x-car.x,target.z-car.z),
       delta=Math.atan2(Math.sin(desired-car.heading),
         Math.cos(desired-car.heading));
     const steering=delta>.035?1:delta<-.035?-1:0;
     const remaining=Math.hypot(car.x-last.x,car.z-last.z);
     // O piloto de QA desacelera antes da curva e do ponto final.
     const targetSpeed=remaining<12?3.2:remaining<24?4.2:5.8;
     const input={
      up:car.speed<targetSpeed-.15,
      down:car.speed>targetSpeed+.15,
      left:steering<0,right:steering>0,handbrake:false
     };
     car.updatePhysics(1/30,input,city,effects,null,false);
     const offset=pathDistance(car.x,car.z);
     if(offset>maxOffset){
       maxOffset=offset;
       peakOffset={frame,x:+car.x.toFixed(2),z:+car.z.toFixed(2),
         speed:+car.speed.toFixed(2),progress};
     }
     if(offset>4.2)offroadFrames++;
     if(city.isWaterAt(car.x,car.z))waterFrames++;
     if(city.isPointBlocked(car.x,car.z,1.55,car.y))
      blockedFrames++;
     maxDamage=Math.max(maxDamage,car.damage);
     finalDistance=Math.hypot(car.x-last.x,car.z-last.z);
     frames=frame+1;
     if(frame%120===0)samples.push({
       frame,x:+car.x.toFixed(2),z:+car.z.toFixed(2),
       speed:+car.speed.toFixed(2),offset:+offset.toFixed(2),
       toEnd:+finalDistance.toFixed(2)
     });
     if(finalDistance<3.7)break;
    }
   }finally{
    game.scene.remove(car.root);
    if(typeof GPUResourceUtils!=='undefined')
      GPUResourceUtils.disposeSubtree(car.root);
   }
   return {
    loaded:!!road.mesh&&road.mesh.parent===city.cityGroup,
    section:road.mode,sourceEdgeIds:road.sourceEdgeIds,
    sourceCorridors:graph.sourceCorridors,
    originalPlacementCertified:road.originalPlacementCertified,
    classificationCertified:road.roadClassificationCertified,
    footprint,frames,maxOffset,peakOffset,offroadFrames,
    maxDamage,waterFrames,blockedFrames,finalDistance,
    samples,mission:city.missionStart?.type,
    stillChicago:game.currentCityKey==='chicago'
   };
  });
  console.log('CHICAGO_R23_SOURCE_DRIVE',JSON.stringify(report));
  fs.writeFileSync('qa-artifacts/chicago-r23-drive.json',
   JSON.stringify({report,errors},null,2)+'\n');
  assert(report.loaded);
  assert.deepEqual(report.sourceEdgeIds,[1822,1777,1762,1650,1557,1550]);
  assert.equal(report.sourceCorridors,14);
  assert.equal(report.classificationCertified,false);
  assert.equal(report.originalPlacementCertified,false);
  assert(report.footprint.samples>100);
  assert.equal(report.footprint.water,0);
  assert.equal(report.footprint.blocked,0);
  assert.equal(report.waterFrames,0);
  assert.equal(report.blockedFrames,0);
  assert(report.maxDamage<8);
  assert(report.finalDistance<3.7,'Veículo não completou a via R23: '+
    JSON.stringify(report));
  assert(report.offroadFrames<12,'Trajetória saiu da faixa de 8m: '+
    JSON.stringify(report));
  assert.equal(report.mission,'story_tipoff');
  assert(report.stillChicago);
  assert.deepEqual(errors,[]);
 }finally{await page.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
