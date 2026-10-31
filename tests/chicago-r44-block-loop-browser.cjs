'use strict';
/** Real vehicle physics through R41 → R42 → R44 in a single lap.
 * No coordinate, heading or speed changes after creating the test vehicle.
 * Both directions repeat the same closed circuit, with sustained collision,
 * water and off-pavement checks and corner progress measurements.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
fs.mkdirSync('qa-artifacts',{recursive:true});
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
   window.DriverGame?.city?.ready&&window.DriverGame?.city?.chicagoR44BlockLoop,
   null,{timeout:120000});
  for(const reverse of [false,true]){
   const report=await page.evaluate(reverse=>{
    const game=window.DriverGame,city=game.city,
     block=city.chicagoR44BlockLoop,
     pts=reverse?[...block.points].reverse():[...block.points],
     total=block.length;
    game.isPaused=true;
    const cum=[0];
    for(let i=1;i<pts.length;i++)
     cum.push(cum.at(-1)+Math.hypot(pts[i].x-pts[i-1].x,
                                  pts[i].z-pts[i-1].z));
    const length=cum.at(-1);
    const junctions=(reverse?[...block.legs].reverse():block.legs)
     .slice(0,2).reduce((a,leg)=>{
      a.push((a.at(-1)||0)+leg.length);return a;
     },[]);
    const sample=(d)=>{
     const at=Math.max(0,Math.min(length,d));
     for(let i=1;i<pts.length;i++){
      if(cum[i]>=at-1e-6){
       const t=(at-cum[i-1])/(cum[i]-cum[i-1]||1);
       return {x:pts[i-1].x+(pts[i].x-pts[i-1].x)*t,
               z:pts[i-1].z+(pts[i].z-pts[i-1].z)*t};
      }
     }
     return pts.at(-1);
    };
    const project=(x,z,progress)=>{
     const lower=progress-7,upper=progress+14;
     let best={dist:Infinity,progress};
     for(let i=1;i<pts.length;i++){
      if(cum[i]<lower||cum[i-1]>upper)continue;
      const a=pts[i-1],b=pts[i],dx=b.x-a.x,dz=b.z-a.z,
       len2=dx*dx+dz*dz;
      const t=Math.max(0,Math.min(1,
       ((x-a.x)*dx+(z-a.z)*dz)/(len2||1)));
      const distance=Math.hypot(x-(a.x+t*dx),z-(a.z+t*dz));
      const s=cum[i-1]+t*(cum[i]-cum[i-1]);
      if(distance<best.dist)
       best={dist:distance,progress:s};
     }
     return best;
    };
    const a=pts[0],b=pts[1];
    const car=new DriverVehicle(game.scene,{
     name:'R44 FULL NEIGHBORHOOD LAP',bodyStyle:'sedan',
     x:a.x,z:a.z,heading:Math.atan2(b.x-a.x,b.z-a.z),
     maxSpeed:12,accel:10,color:0x6c7990
    });
    const effects={addSkidMark(){},spawnTireSmoke(){},
     spawnImpactSparks(){},spawnCarBreakaway(){},
     spawnWaterSplash(){},ejectHubcap(){}};
    let progress=0,frames=0,waterFrames=0,blockedFrames=0,
      offroadFrames=0,maxDamage=0,maxOffset=0,peakOffset=null,
      lastProgress=0,stalls=0;
    const checkpoints=new Set(),samples=[];
    try{
     for(let frame=0;frame<7800;frame++){
      const nearest=project(car.x,car.z,progress);
      progress=Math.max(progress,Math.min(progress+3,nearest.progress));
      const nextJunction=junctions.find(d=>d>=progress-1)??length;
      const cornerDistance=nextJunction-progress;
      // Keep slowing *after* a 90-degree junction too: the rear axle
      // must finish the turn before the pilot accelerates on the next leg.
      const previousJunction=[...junctions].reverse()
       .find(d=>d<=progress)??0;
      const exitDistance=progress-previousJunction;
      const approaching=cornerDistance<15;
      const completingTurn=exitDistance<12;
      // The physics steering rate depends on vehicle speed. Slowing to
      // almost zero made turns wider, not tighter; pre-steer with a
      // longer lookahead while holding enough momentum for yaw response.
      const speedTarget=approaching||completingTurn?2.7:
                         cornerDistance<23?3.5:4.3;
      const lookAhead=approaching?12:
                       completingTurn?7:6.2;
      const target=sample(progress+lookAhead);
      const desired=Math.atan2(target.x-car.x,target.z-car.z);
      const delta=Math.atan2(Math.sin(desired-car.heading),
                             Math.cos(desired-car.heading));
      const input={up:car.speed<speedTarget-.12,
       down:car.speed>speedTarget+.12,
       left:delta<-.035,right:delta>.035,handbrake:false};
      car.updatePhysics(1/30,input,city,effects,null,false);
      frames=frame+1;
      const offset=project(car.x,car.z,progress).dist;
      if(offset>maxOffset){
       maxOffset=offset;peakOffset={frame,x:car.x,z:car.z,speed:car.speed,progress};
      }
      if(offset>4.4)offroadFrames++;
      if(city.isWaterAt(car.x,car.z))waterFrames++;
      if(city.isPointBlocked(car.x,car.z,1.55,car.y))blockedFrames++;
      maxDamage=Math.max(maxDamage,car.damage);
      junctions.forEach((s,i)=>{
       if(progress>=s+1.0)checkpoints.add(i);
      });
      if(frame%180===0)samples.push({frame,progress:+progress.toFixed(2),
       x:+car.x.toFixed(2),z:+car.z.toFixed(2),
       speed:+car.speed.toFixed(2),offset:+offset.toFixed(2),
       upcoming:+cornerDistance.toFixed(2)});
      if(progress>lastProgress+1) {lastProgress=progress;stalls=0;}
      else stalls++;
      if(progress>=length-3.5 && Math.hypot(car.x-pts.at(-1).x,car.z-pts.at(-1).z)<5.2)
       break;
      if(stalls>950)break;
     }
     const finishDistance=Math.hypot(car.x-pts.at(-1).x,car.z-pts.at(-1).z);
     return {reverse,frames,loaded:!!city.chicagoR44BlockLoop,
      sourceRoads:block.legs.map(x=>x.id),routeLength:length,
      routePoints:pts.length,loopClosed:block.closed,
      progress,progressFraction:progress/length,
      junctions,junctionsCrossed:checkpoints.size,
      finishDistance,waterFrames,blockedFrames,
      offroadFrames,maxDamage,maxOffset,peakOffset,
      originalPlacementCertified:block.originalPlacementCertified,
      mission:city.missionStart?.type,
      stillChicago:game.currentCityKey==='chicago',
      samples};
    }finally{
     game.scene.remove(car.root);
     if(typeof GPUResourceUtils!=='undefined')GPUResourceUtils.disposeSubtree(car.root);
    }
   },reverse);
   console.log('CHICAGO_R44_COMPLETE_LOOP',JSON.stringify(report));
   fs.writeFileSync('qa-artifacts/chicago-r44-full-lap-'+reverse+'.json',
    JSON.stringify({report,errors},null,2)+'\n');
   assert(report.loaded);
   assert.deepEqual(report.sourceRoads,[
    'west-lateral-r41','south-stem-r42','parallel-west-r44']);
   assert.equal(report.originalPlacementCertified,false);
   assert(report.routeLength>220&&report.routeLength<305);
   assert(report.loopClosed<1e-4);
   assert.equal(report.junctionsCrossed,2,'Carro não passou por todas as junções: '+JSON.stringify(report));
   assert(report.progressFraction>.985,'Volta incompleta: '+JSON.stringify(report));
   assert(report.finishDistance<5.2,'Carro não voltou ao início: '+JSON.stringify(report));
   assert.equal(report.waterFrames,0,'Entrou na água');
   assert.equal(report.blockedFrames,0,'Bateu em obstáculo durante volta');
   assert(report.maxDamage<8);
   assert(report.offroadFrames<60,'Cortou caminho fora da pista: '+JSON.stringify(report));
   assert(report.maxOffset<6.8,'Ultrapassou os limites dos entroncamentos: '+JSON.stringify(report));
   assert.equal(report.mission,'story_tipoff');
   assert(report.stillChicago);
   assert.deepEqual(errors,[]);
  }
 }finally{await page.close();await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
