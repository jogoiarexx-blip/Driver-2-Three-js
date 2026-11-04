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
   const game=window.DriverGame,c=game.city,
     mod=window.DriverChicagoVerticalInteriorsR84,
     ids=['r84-greektown-loft','r84-prairie-office'],
     observations=[];
   game.mode='on_foot';game.tanner.setVisible(true);
   let maxLive=0;
   for(const id of ids){
    const p=c.interiors.find(p=>p.id===id);
    if(!p){observations.push({id,missing:true});continue;}
    const b=p.r84Blueprint;
    const original=c.districtBuildings.find(x=>x.id===p.r84SourceLot);
    const before=!p.r84Loaded&&!c.cityGroup.children.some(g=>
      g.name==='r84-live-interior-'+id);
    const safeReturn=!c.isWaterAt(p.door.x,p.door.z+4)&&
      !c.isPointBlocked(p.door.x,p.door.z+4,.4,0);
    game.tanner.setPosition(p.door.x,0,p.door.z,0);
    game.toggleVehicleEnterExit();
    const entered=game.interiorPlace===p&&p.r84Loaded&&
      c.cityGroup.children.includes(p.r84Group);
    maxLive=Math.max(maxLive,c.interiors.filter(r=>
      r.r84Loaded||r.r83Loaded||r.r82Loaded).length);
    const door=b.doors[0],
      doorPos={x:b.x+door.x+1.2,z:b.z+door.z};
    const closed=c.isPointBlocked(b.x+door.x,b.z+door.z,.55,0);
    game.tanner.setPosition(doorPos.x,0,doorPos.z,0);
    game.toggleVehicleEnterExit(); // Use actual E handler.
    const opened=!c.isPointBlocked(b.x+door.x,b.z+door.z,.55,0)&&
      door.open&&door.mesh?.position.z>b.z+door.z+3.9;
    game.toggleVehicleEnterExit();
    const closedAgain=!door.open&&c.isPointBlocked(
      b.x+door.x,b.z+door.z,.55,0);
    let climb=null;
    if(b.tall){
      game.tanner.setPosition(b.x+6.5,0,b.z-8.2,0);
      const input={up:true,down:false,left:false,right:false,sprint:false};
      let stalled=0,maxY=0,previousZ=game.tanner.group.position.z;
      for(let i=0;i<120;i++){
       game.tanner.update(.016,input,c);
       const point=game.tanner.group.position;
       if(Math.abs(previousZ-point.z)<.00001)stalled++;
       maxY=Math.max(maxY,point.y);
       previousZ=point.z;
      }
      const point=game.tanner.group.position;
      climb={maxY,finalY:point.y,finalZ:point.z-b.z,
       stalled,upperHeight:c.getGroundHeightAt(
        b.x+6.5,b.z+8,7.2),
       lowerHeight:c.getGroundHeightAt(b.x+9,b.z+8,0),
       middleHeight:c.getGroundHeightAt(b.x+9,b.z-.7,3.6),
       noSideJump:!mod.safeStep(c,b.x+9,b.z+8,0,
        b.x+9,b.z+8.1,7.2)};
    }
    game.tanner.setPosition(p.exit.x,0,p.exit.z,0);
    game.toggleVehicleEnterExit();
    const unloaded=game.interiorPlace===null&&!p.r84Loaded&&
      !c.cityGroup.children.some(g=>g.name==='r84-live-interior-'+id);
    observations.push({id,before,source:original?.id,
      lotTier:original?.interiorTier,safeReturn,entered,
      closed,opened,closedAgain,unloaded,
      parts:b.parts.length,colliders:b.colliders.length,
      levels:b.floorLevels,stairs:b.stairs.length,climb});
   }
   const stat=c.chicagoVerticalInteriorsR84;
   return {prepared:stat.prepared,loads:stat.loadCount,
    unloads:stat.unloadCount,liveRoomId:stat.liveRoomId,
    maxLive,observations,
    r83Prepared:c.chicagoAccessibleInteriorsR83?.prepared,
    r82Prepared:c.chicagoModularInteriorsR82?.prepared,
    r81Links:c.chicagoGooseIndustrialR81?.links?.length,
    r80Rails:c.chicagoRiverfrontR80?.railsCreated,
    r79Roads:c.chicagoDowntownR79?.connectedSegments,
    r78Lots:c.districtBuildings.filter(x=>x.pilotR78).length,
    preservedHome:c.interiors.some(p=>p.id==='home'),
    noOffWorldRoads:!c.chicagoVerticalInteriorsR84?.streetGeometryCertified};
  });
  fs.mkdirSync('qa-artifacts/chicago-r84',{recursive:true});
  fs.writeFileSync('qa-artifacts/chicago-r84/vertical-game.json',
    JSON.stringify({report,errors},null,2));
  console.log('CHICAGO_R84_REAL_GAME',JSON.stringify(report));
  assert.equal(report.prepared,2);
  assert.equal(report.loads,2);
  assert.equal(report.unloads,2);
  assert.equal(report.liveRoomId,null);
  assert.equal(report.maxLive,1);
  assert.equal(report.r83Prepared,2);
  assert.equal(report.r82Prepared,3);
  assert.equal(report.r81Links,4);
  assert.equal(report.r80Rails,66);
  assert.equal(report.r79Roads,16);
  assert.equal(report.r78Lots,86);
  assert(report.preservedHome);
  assert(report.observations.every(o=>
    !o.missing&&o.before&&o.source&&o.lotTier==='partial'&&
    o.safeReturn&&o.entered&&o.closed&&o.opened&&
    o.closedAgain&&o.unloaded&&o.colliders>4));
  assert(report.observations[0].stairs===24);
  assert(report.observations[1].stairs===0);
  assert(report.observations[0].parts<=45,
    'multi-floor meshes must remain lean for mobile');
  const v=report.observations[0].climb;
  assert(v&&v.maxY===7.2&&v.finalY===7.2&&v.finalZ>7.4,
    'Tanner failed to climb 24 physical steps');
  assert.equal(v.stalled,0);
  assert.equal(v.upperHeight,7.2);
  assert.equal(v.lowerHeight,0);
  assert.equal(v.middleHeight,3.6);
  assert.equal(v.noSideJump,true);
  assert.deepEqual(errors,[]);
  // Capture the actual upper 7.2-level floor inside the game.
  await page.evaluate(()=>{
   const game=window.DriverGame,p=game.city.interiors.find(
     p=>p.id==='r84-greektown-loft');
   game.mode='on_foot';game.tanner.setVisible(true);
   game.enterInterior(p);
   game.tanner.setPosition(p.inside.x+6.5,7.2,
     p.inside.z+8.2,Math.PI);
  });
  await page.waitForTimeout(700);
  await page.screenshot({path:
   'qa-artifacts/chicago-r84/high-landing-live.png',timeout:30000});
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
