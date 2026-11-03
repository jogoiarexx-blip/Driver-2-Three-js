'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),
 fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(process.env.DRIVER_QA_URL||
   'http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
  await page.evaluate(()=>window.DriverBoot.start('ride'));
  await page.waitForFunction(()=>window.DriverBoot?.sessionReady&&
   window.DriverGame?.city?.ready&&
   window.DriverGame?.currentCityKey==='chicago',
   null,{timeout:120000});
  const report=await page.evaluate(()=>{
   const game=window.DriverGame,city=game.city,
    mod=window.DriverChicagoModularInteriorsR82,
    originalMode=game.mode,
    ids=['r78-loop-shop','r78-goose-warehouse',
         'r81-goose-yard-office'],
    observations=[];
   let maxLive=0,allEntered=true,allExited=true;
   for(const id of ids){
    const p=city.interiors.find(p=>p.id===id);
    if(!p){
      observations.push({id,missing:true});
      allEntered=false;allExited=false;
      continue;
    }
    const b=p.r82Blueprint,
      initiallyUnloaded=!p.r82Loaded&&
       !city.cityGroup.children.some(ch=>ch.name==='r82-modular-interior-'+id),
      spawnClear=!city.isPointBlocked(b.spawn.x,b.spawn.z,.55,0),
      exitClear=!city.isPointBlocked(b.exit.x,b.exit.z,.55,0),
      westWall=city.isPointBlocked(b.x-3.8,b.z+5.0,.5,0),
      eastWall=city.isPointBlocked(b.x+3.8,b.z-5.0,.5,0),
      westDoorOpen=!city.isPointBlocked(b.x-3.8,b.z,.55,0),
      eastDoorOpen=!city.isPointBlocked(b.x+3.8,b.z,.55,0),
      rightRoomOpen=!city.isPointBlocked(b.x+6,b.z,.55,0);
    game.mode='on_foot';
    const entered=game.enterInterior(p),
      loaded=!!p.r82Loaded,
      groupExists=city.cityGroup.children.includes(p.r82Group),
      partitionMeshes=p.r82Meshes?.length||0,
      insideMatch=game.interiorPlace?.id===id;
    maxLive=Math.max(maxLive,city.interiors.filter(i=>i.r82Loaded).length);
    const left=game.leaveInterior(),
      unloaded=!p.r82Loaded&&p.r82Group===null&&
        !city.cityGroup.children.some(ch=>
          ch.name==='r82-modular-interior-'+id),
      exitWorld=game.interiorPlace===null;
    observations.push({id,roomCount:b.rooms.length,
      physicalColliders:b.colliders.length,
      parts:b.parts.length,initiallyUnloaded,
      spawnClear,exitClear,westWall,eastWall,
      westDoorOpen,eastDoorOpen,rightRoomOpen,
      entered,loaded,groupExists,partitionMeshes,
      insideMatch,left,unloaded,exitWorld,
      multiStorey:b.multiStorey,status:b.status});
    allEntered=allEntered&&entered&&loaded&&insideMatch;
    allExited=allExited&&left&&unloaded&&exitWorld;
   }
   game.mode=originalMode;
   const p=city.interiors.find(p=>p.id==='r78-goose-warehouse');
   if(p&&game.playerCar){
     game.playerCar.x=p.door.x;
     game.playerCar.z=p.door.z+8;
     game.playerCar.speed=0;game.playerCar.updateTransform();
   }
   const stat=city.chicagoModularInteriorsR82||{};
   return {prepared:stat.prepared,loadCount:stat.loadCount,
     unloadCount:stat.unloadCount,
     liveRoomId:stat.liveRoomId,
     loadedAfter:city.interiors.filter(i=>i.r82Loaded).length,
     maxLive,allEntered,allExited,observations,
     hasOriginalHome:city.interiors.some(x=>x.id==='home'&&
       !x.r82Blueprint),savedHomeFurniture:
       (city.tannerHomeFurnitureBoxes||[]).length,
     r81Office:city.chicagoGooseIndustrialR81?.roomRegistered,
     r81Links:city.chicagoGooseIndustrialR81?.links?.length||0,
     r80Rails:city.chicagoRiverfrontR80?.railsCreated||0,
     r79Corridors:city.chicagoDowntownR79?.connectedCorridors||0,
     r79Roads:city.chicagoDowntownR79?.connectedSegments||0,
     r78Lots:city.districtBuildings.filter(b=>b.pilotR78).length,
     r78Interiors:city.interiors.filter(x=>x.id.startsWith('r78-')).length,
     r77Landmarks:city.chicagoPS1PlayableLandmarksR77?.sites.length||0,
     ps1Certified:stat.certifiedPS1};
  });
  fs.mkdirSync('qa-artifacts/chicago-r82',{recursive:true});
  fs.writeFileSync('qa-artifacts/chicago-r82/modular-game.json',
   JSON.stringify({report,errors},null,2));
  console.log('CHICAGO_R82_PLAYABLE',JSON.stringify(report));
  assert.equal(report.prepared,3);
  assert.equal(report.loadCount,3);
  assert.equal(report.unloadCount,3);
  assert.equal(report.loadedAfter,0);
  assert.equal(report.liveRoomId,null);
  assert.equal(report.maxLive,1);
  assert(report.allEntered&&report.allExited);
  assert(report.observations.every(p=>
    p.roomCount===3&&p.physicalColliders>=7&&p.parts>=16&&
    p.initiallyUnloaded&&p.spawnClear&&p.exitClear&&
    p.westWall&&p.eastWall&&p.westDoorOpen&&p.eastDoorOpen&&
    p.rightRoomOpen&&p.loaded&&p.groupExists&&
    p.partitionMeshes>=1&&p.unloaded&&!p.multiStorey));
  assert(report.hasOriginalHome&&report.savedHomeFurniture>4);
  assert(report.r81Office&&report.r81Links===4);
  assert.equal(report.r80Rails,66);
  assert.equal(report.r79Corridors,2);
  assert.equal(report.r79Roads,16);
  assert.equal(report.r78Lots,86);
  assert.equal(report.r78Interiors,2);
  assert.equal(report.r77Landmarks,4);
  assert.equal(report.ps1Certified,false);
  assert.deepEqual(errors,[]);
  // Photograph an actual newly-modelled room, not exterior streets.
  await page.evaluate(()=>{
    const game=window.DriverGame,
      p=game.city.interiors.find(x=>x.id==='r78-goose-warehouse');
    game.mode='on_foot';
    game.enterInterior(p);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({path:'qa-artifacts/chicago-r82/modular-warehouse-inside.png',
   timeout:30000});
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
