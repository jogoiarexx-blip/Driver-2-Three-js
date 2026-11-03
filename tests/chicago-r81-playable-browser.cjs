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
  await page.goto(process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/',
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
  await page.evaluate(()=>window.DriverBoot.start('ride'));
  await page.waitForFunction(()=>window.DriverBoot?.sessionReady&&
   window.DriverGame?.city?.ready&&
   window.DriverGame?.currentCityKey==='chicago',
   null,{timeout:120000});
  const report=await page.evaluate(()=>{
   const game=window.DriverGame,c=game.city,
    r=c.chicagoGooseIndustrialR81,
    nav=DriverChicagoMixedNavigationR49,
    graph=nav.compile(c),
    office=c.interiors.find(p=>p.id==='r81-goose-yard-office'),
    inside=office&&c.interiorFloorAt(office.inside.x,office.inside.z),
    door=office&&c.interiorAt(office.door.x,office.door.z)?.id===office.id,
    returnClear=office&&!c.isPointBlocked(office.door.x,office.door.z+4,.4,0),
    from={x:-218,z:250},to={x:-160,z:240},
    path=nav.plan(c,from,to),
    roadClear=path&&path.every((p,i)=>!i||nav.clear(c,path[i-1],p,false));
   let entered=false,left=false,enteredMatch=false;
   if(office&&inside&&door&&returnClear){
     const previousMode=game.mode;
     game.mode='on_foot';
     entered=game.enterInterior(office);
     enteredMatch=game.interiorPlace?.id===office.id;
     left=game.leaveInterior();
     game.mode=previousMode;
   }
   if(game.playerCar){
     game.playerCar.x=-200;game.playerCar.z=249;
     game.playerCar.heading=0;game.playerCar.speed=0;
     game.playerCar.updateTransform();
   }
   return {
    ready:!!r?.ready,roomRegistered:r?.roomRegistered,
    yards:r?.yards.map(p=>({id:p.id,x:p.x,z:p.z}))||[],
    rejected:r?.rejected||[],links:r?.links.length||0,
    connected:graph?.gooseYardR81Connected||0,
    graphLinks:graph?.gooseYardR81Segments||0,
    cargo:r?.storageBoxes.length||0,
    cargoSolid:(r?.storageBoxes||[]).every(b=>
     c.isPointBlocked((b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2,.1,0)),
    realWarehouses:r?.existingWarehouses.length||0,
    facades:r?.facadeParts||0,
    routePoints:path?.length||0,roadClear:!!roadClear,
    southWater:c.isWaterAt(-160,200),
    dryExistingFixedEastBridge:!c.isWaterAt(-160,240),
    office:office?{id:office.id,name:office.name,
      inside:office.inside,door:office.door,
      entryFound:door,floor:inside,exitClear:returnClear,
      interiorLevel:office.interiorLevel,
      furniture:office.r81FurnitureCount,
      modularParts:office.r82Blueprint?.parts.length||0}:null,
    entered,enteredMatch,left,
    r80Rails:c.chicagoRiverfrontR80?.railsCreated||0,
    r79Corridors:c.chicagoDowntownR79?.connectedCorridors||0,
    r79Roads:c.chicagoDowntownR79?.connectedSegments||0,
    r78Lots:c.districtBuildings.filter(b=>b.pilotR78).length,
    r78Interiors:c.interiors.filter(p=>p.id.startsWith('r78-')).length,
    r77Landmarks:c.chicagoPS1PlayableLandmarksR77?.sites.length||0,
    home:!!c.safeHouseZone,stadium:!!c.chicagoStadium,
    sourcePS1Certified:r?.originalPS1StreetCoordinatesCertified
   };
  });
  fs.mkdirSync('qa-artifacts/chicago-r81',{recursive:true});
  fs.writeFileSync('qa-artifacts/chicago-r81/goose-game.json',
   JSON.stringify({report,errors},null,2));
  console.log('CHICAGO_R81_PLAYABLE',JSON.stringify(report));
  assert.equal(report.ready,true,'R81 yards were not built');
  assert.equal(report.yards.length,2);
  assert.equal(report.rejected.length,0);
  assert.equal(report.links,4);
  assert.equal(report.graphLinks,4);
  assert.equal(report.connected,4);
  assert.equal(report.cargo,4);
  assert(report.cargoSolid);
  assert.equal(report.realWarehouses,4);
  assert(report.facades>=20);
  assert(report.routePoints>=4&&report.roadClear);
  assert(report.southWater&&report.dryExistingFixedEastBridge);
  assert(report.office?.entryFound&&report.office?.floor&&
   report.office?.exitClear);
  assert.equal(report.office?.interiorLevel,'partial');
  assert(report.office.furniture>=7||
    report.office.modularParts>=16);
  assert(report.entered&&report.enteredMatch&&report.left);
  assert.equal(report.r80Rails,66);
  assert.equal(report.r79Corridors,2);
  assert.equal(report.r79Roads,16);
  assert.equal(report.r78Lots,86);
  assert.equal(report.r78Interiors,2);
  assert.equal(report.r77Landmarks,4);
  assert(report.home&&report.stadium);
  assert.equal(report.sourcePS1Certified,false);
  assert.deepEqual(errors,[]);
  await page.waitForTimeout(1400);
  await page.screenshot({path:'qa-artifacts/chicago-r81/goose-island-game.png',
   timeout:30000});
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
