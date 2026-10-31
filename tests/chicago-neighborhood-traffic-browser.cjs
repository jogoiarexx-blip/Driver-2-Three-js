'use strict';
/** Real civilian AI, not a scripted QA pilot, drives the two loop roads.
 * Both spawned NPCs call the same getInput/updatePhysics as the game.
 * No position/heading/speed is edited after spawning.
 */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
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
  await page.waitForFunction(()=>window.DriverBoot?.sessionReady &&
   window.DriverGame?.city?.ready &&
   window.DriverGame.vehicles.some(v=>v.chicagoNeighborhoodTrafficId==='r43') &&
   window.DriverGame.vehicles.some(v=>v.chicagoNeighborhoodTrafficId==='r44'),
   null,{timeout:120000});
  const report=await page.evaluate(()=>{
   const game=window.DriverGame,city=game.city,
    locals=game.vehicles.filter(v=>v.chicagoNeighborhoodTrafficId);
   game.isPaused=true;
   const snapshots=locals.map(car=>({id:car.chicagoNeighborhoodTrafficId,
    initial:{x:car.x,z:car.z,heading:car.heading},frames:0,
    blocked:0,water:0,offroad:0,damage:0,maxOffset:0,
    distance:0,starts:0,end:null,progress:0,laps:0,
    snapshots:[]}));
   const effects={addSkidMark(){},spawnTireSmoke(){},
    spawnImpactSparks(){},spawnCarBreakaway(){},
    spawnWaterSplash(){},ejectHubcap(){}};
   for(let frame=0;frame<4200;frame++){
    for(let n=0;n<locals.length;n++){
     const car=locals[n],snap=snapshots[n],
      bx=car.x,bz=car.z;
     const input=game.trafficAI.getInput(
      car,1/30,game.vehicles,null,0);
     if(!input)throw Error('TrafficAI did not select circuit AI');
     car.updatePhysics(1/30,input,city,effects,null,false);
     const status=car.chicagoNeighborhoodTrafficStatus,
      loop=car.chicagoNeighborhoodTrafficRoute;
     const offset=DriverChicagoNeighborhoodTraffic.project(
      loop.points,loop.measurements,car.x,car.z,loop.progress)?.distance??Infinity;
     snap.maxOffset=Math.max(snap.maxOffset,offset);
     snap.distance+=Math.hypot(car.x-bx,car.z-bz);
     snap.frames++;
     if(offset>4.3)snap.offroad++;
     if(city.isWaterAt(car.x,car.z))snap.water++;
     if(city.isPointBlocked(car.x,car.z,1.55,car.y))snap.blocked++;
     snap.damage=Math.max(snap.damage,car.damage);
     snap.progress=status.progress;
     snap.laps=status.laps;
     if(frame%350===0)snap.snapshots.push({
      f:frame,x:+car.x.toFixed(2),z:+car.z.toFixed(2),
      speed:+car.speed.toFixed(2),offset:+offset.toFixed(2),
      progress:status.progress,laps:status.laps});
    }
   }
   for(let n=0;n<locals.length;n++){
    const car=locals[n],snap=snapshots[n];
    snap.end={x:car.x,z:car.z,heading:car.heading};
    snap.loopLength=car.chicagoNeighborhoodTrafficRoute.measurements.at(-1);
    snap.routeStatus=car.chicagoNeighborhoodTrafficStatus;
   }
   return {city:game.currentCityKey,mission:city.missionStart?.type,
    loopRoads:[city.chicagoR43BlockLoop?.legs.length,
               city.chicagoR44BlockLoop?.legs.length],
    npcCount:locals.length,vehiclesTotal:game.vehicles.length,
    snapshots};
  });
  console.log('CHICAGO_CIVILIAN_BLOCK_TRAFFIC',JSON.stringify(report));
  fs.writeFileSync('qa-artifacts/chicago-neighborhood-traffic.json',
   JSON.stringify({report,errors},null,2)+'\n');
  assert.equal(report.city,'chicago');
  assert.equal(report.mission,'story_tipoff');
  assert.deepEqual(report.loopRoads,[4,3]);
  assert.equal(report.npcCount,2);
  assert.deepEqual(report.snapshots.map(s=>s.id),['r43','r44']);
  for(const npc of report.snapshots){
   assert.equal(npc.frames,4200);
   assert(npc.distance>115,JSON.stringify(npc));
   assert(npc.laps>=1,'No complete local traffic lap: '+JSON.stringify(npc));
   assert.equal(npc.water,0,JSON.stringify(npc));
   assert.equal(npc.blocked,0,JSON.stringify(npc));
   assert.equal(npc.offroad,0,JSON.stringify(npc));
   assert(npc.damage<8,JSON.stringify(npc));
   assert(npc.maxOffset<4.3,JSON.stringify(npc));
  }
  assert.deepEqual(errors,[]);
 }finally{await page.close();await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
