'use strict';
/**
 * Chicago R37: carregar a cidade e dirigir por trecho fonte-sem-Rom-certificado.
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
   window.DriverGame?.city?.ready&&window.DriverGame?.city?.chicagoReferenceNorthBranchR37,
   null,{timeout:120000});
  const blocks=await page.evaluate(()=>{const c=window.DriverGame.city;return {lots:c.chicagoNorthRoadsideR32?.length||0,boxes:c.buildingBoxes.filter(b=>b.adaptedR32).length,chunks:[...c.districtChunks.values()].filter(x=>x.buildings.some(b=>b.adaptedR32)).length};});
  assert(blocks.lots>0&&blocks.boxes===blocks.lots&&blocks.chunks>0,JSON.stringify(blocks));
  console.log("CHICAGO_R32_BLOCKS",JSON.stringify(blocks));
  const marking=await page.evaluate(()=>{const c=window.DriverGame.city,m=c.cityGroup.getObjectByName('chicago-r33-north-road-markings');return {exists:!!m,vertices:m?.geometry?.attributes?.position?.count||0};});
  assert(marking.exists&&marking.vertices>0,JSON.stringify(marking));
  console.log('CHICAGO_R33_MARKINGS',JSON.stringify(marking));
  for(const reverse of [false,true]){
  const report=await page.evaluate(reverse=>{
   const game=window.DriverGame,city=game.city,
    road=city.chicagoReferenceNorthBranchR37,
    combined=[...city.chicagoReferenceNorthLinkR36.points.slice(Math.max(0,city.chicagoReferenceNorthLinkR36.points.findIndex(p=>p.x===road.points[0].x&&p.z===road.points[0].z)-12),city.chicagoReferenceNorthLinkR36.points.findIndex(p=>p.x===road.points[0].x&&p.z===road.points[0].z)+1),...road.points.slice(1)],
    pts=reverse?[...combined].reverse():combined,graph=city.chicagoPS1StreetNetwork,
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
    name:'R37 PS1 EAST FORK',bodyStyle:'sedan',
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
    for(let frame=0;frame<7200;frame++){
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
      if(distance>3.8){target=pts[i];break;}
     }
     const desired=Math.atan2(target.x-car.x,target.z-car.z),
       delta=Math.atan2(Math.sin(desired-car.heading),
         Math.cos(desired-car.heading));
     const steering=delta>.035?1:delta<-.035?-1:0;
     const remaining=Math.hypot(car.x-last.x,car.z-last.z);
     // O piloto de QA desacelera antes da curva e do ponto final.
     const targetSpeed=remaining<14?2.8:remaining<30?3.4:4.5;
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
     const join=road.points[0],onJunction=Math.hypot(car.x-join.x,car.z-join.z)+1.55<=road.junctionRadius*Math.cos(Math.PI/24);
     if(offset>4.2&&!onJunction)offroadFrames++;
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
  },reverse);
  console.log('CHICAGO_R37_SOURCE_DRIVE',JSON.stringify(report));
  fs.writeFileSync('qa-artifacts/chicago-r37-drive-'+reverse+'.json',
   JSON.stringify({report,errors},null,2)+'\n');
  assert(report.loaded);
  assert.deepEqual(report.sourceEdgeIds,require('../chicago/reference-north-branch-r37.json').sourceEdgeIds);
  assert.equal(report.sourceCorridors,14);
  assert.equal(report.classificationCertified,false);
  assert.equal(report.originalPlacementCertified,false);
  assert(report.footprint.samples>100);
  assert.equal(report.footprint.water,0);
  assert.equal(report.footprint.blocked,0);
  assert.equal(report.waterFrames,0);
  assert.equal(report.blockedFrames,0);
  assert(report.maxDamage<8);
  assert(report.finalDistance<3.7,'Veículo não completou a via R37: '+
    JSON.stringify(report));
  assert(report.maxOffset<2.45,'Carro excedeu margem lateral do corredor');
  assert(report.offroadFrames<15,'Trajetória saiu da faixa de 8m: '+
    JSON.stringify(report));
  assert.equal(report.mission,'story_tipoff');
  assert(report.stillChicago);
  assert.deepEqual(errors,[]);
  }
 }finally{await page.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
