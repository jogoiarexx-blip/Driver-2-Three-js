'use strict';
/**
 * Chicago R44: carregar a cidade e dirigir por trecho fonte-sem-Rom-certificado.
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
   window.DriverGame?.city?.ready&&window.DriverGame?.city?.chicagoReferenceParallelWestR44,
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
    road=city.chicagoReferenceParallelWestR44,
    combined=[...road.points],
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
   // 3m pitch checks long straight stretches as well as polyline vertices.
   // Vertex-only probes were too sparse for the simplified R44 pavement.
   for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i],dx=b.x-a.x,dz=b.z-a.z,
      len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;
    const steps=Math.max(1,Math.ceil(len/3));
    for(let j=0;j<=steps;j++){
     const t=j/steps,cx=a.x+dx*t,cz=a.z+dz*t;
     for(const offset of [-2.3,0,2.3]){
      const x=cx+nx*offset,z=cz+nz*offset;
      footprint.samples++;
      if(city.isWaterAt(x,z))footprint.water++;
      if(city.isPointBlocked(x,z,1.55,0))footprint.blocked++;
     }
    }
   }
   const car=new DriverVehicle(game.scene,{
    name:'R44 PS1 PARALLEL WEST',bodyStyle:'sedan',
    x:first.x,z:first.z,
    heading:Math.atan2(second.x-first.x,second.z-first.z),
    maxSpeed:12,accel:10,color:0x536875
   });
   const effects={addSkidMark(){},spawnTireSmoke(){},
     spawnImpactSparks(){},spawnCarBreakaway(){},
     spawnWaterSplash(){},ejectHubcap(){}};
   const cum=[0];
    for(let i=1;i<pts.length;i++)
     cum.push(cum.at(-1)+Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z));
    const length=cum.at(-1);
    const sample=(dist)=>{
     const at=Math.max(0,Math.min(length,dist));
     for(let i=1;i<pts.length;i++)if(cum[i]>=at-1e-6){
      const t=(at-cum[i-1])/(cum[i]-cum[i-1]||1);
      return {x:pts[i-1].x+(pts[i].x-pts[i-1].x)*t,
              z:pts[i-1].z+(pts[i].z-pts[i-1].z)*t};
     }
     return pts.at(-1);
    };
    const project=(x,z,progress)=>{
     let best={dist:Infinity,progress};
     for(let i=1;i<pts.length;i++){
      if(cum[i]<progress-7||cum[i-1]>progress+15)continue;
      const a=pts[i-1],b=pts[i],dx=b.x-a.x,dz=b.z-a.z;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
      const dist=Math.hypot(x-a.x-dx*t,z-a.z-dz*t);
      const pos=cum[i-1]+t*(cum[i]-cum[i-1]);
      if(dist<best.dist)best={dist,progress:pos};
     }
     return best;
    };
    let progress=0,offroadFrames=0,maxOffset=0,peakOffset=null,maxDamage=0,
       waterFrames=0,blockedFrames=0,frames=0,
       finalDistance=Infinity;
   const samples=[];
   try{
    for(let frame=0;frame<7200;frame++){
      // Project onto the road centerline, then anticipate both broad
      // and tight bends using a lookahead adapted to local curvature.
      const nearest=project(car.x,car.z,progress);
      progress=Math.max(progress,Math.min(progress+3,nearest.progress));
      const before=sample(progress-6),here=sample(progress+3),
        ahead=sample(progress+15);
      const headingA=Math.atan2(here.x-before.x,here.z-before.z),
        headingB=Math.atan2(ahead.x-here.x,ahead.z-here.z),
        turn=Math.abs(Math.atan2(Math.sin(headingB-headingA),
             Math.cos(headingB-headingA)));
      const remaining=length-progress;
      const lookAhead=turn>.18?11.5:6.2;
      const target=sample(progress+lookAhead);
      const desired=Math.atan2(target.x-car.x,target.z-car.z),
        delta=Math.atan2(Math.sin(desired-car.heading),
          Math.cos(desired-car.heading));
      const steering=delta>.035?1:delta<-.035?-1:0;
      const targetSpeed=(turn>.18||Math.abs(delta)>.2)?2.7:
        remaining<19?3.0:4.3;
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
     if(progress>=length-3.5&&finalDistance<3.7)break;
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
    junctionMounted:Array.isArray(road.junctionMeshes)&&road.junctionMeshes.length===2&&road.junctionMeshes.every(m=>m.parent===city.cityGroup),
    originalPlacementCertified:road.originalPlacementCertified,
    classificationCertified:road.roadClassificationCertified,
    footprint,frames,maxOffset,peakOffset,offroadFrames,
    maxDamage,waterFrames,blockedFrames,finalDistance,
    samples,mission:city.missionStart?.type,
    stillChicago:game.currentCityKey==='chicago'
   };
  },reverse);
  console.log('CHICAGO_R44_PARALLEL_WEST_DRIVE',JSON.stringify(report));
  fs.writeFileSync('qa-artifacts/chicago-r44-drive-'+reverse+'.json',
   JSON.stringify({report,errors},null,2)+'\n');
  assert(report.loaded);
  assert(report.junctionMounted);
  assert.deepEqual(report.sourceEdgeIds,require('../chicago/reference-parallel-west-r44.json').sourceEdgeIds);
  assert.equal(report.sourceCorridors,require('../js/world/chicago-ps1-street-network-r22.js').SOURCE_NAMES.length);
  assert.equal(report.classificationCertified,false);
  assert.equal(report.originalPlacementCertified,false);
  assert(report.footprint.samples>100);
  assert.equal(report.footprint.water,0);
  assert.equal(report.footprint.blocked,0);
  assert.equal(report.waterFrames,0);
  assert.equal(report.blockedFrames,0);
  assert(report.maxDamage<8);
  assert(report.finalDistance<3.7,'Veículo não completou a via R44: '+
    JSON.stringify(report));
  assert(report.maxOffset<3.9,'Veículo excedeu a largura útil da faixa de 8m');
  assert(report.offroadFrames<20,'Trajetória saiu da faixa de 8m: '+
    JSON.stringify(report));
  assert.equal(report.mission,'story_tipoff');
  assert(report.stillChicago);
  assert.deepEqual(errors,[]);
  }
 }finally{await page.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
