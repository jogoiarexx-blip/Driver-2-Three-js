'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),
 fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 const jsErrors=[];page.on('pageerror',e=>jsErrors.push(e.message));
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
    r=city.chicagoDowntownR79,
    graph=DriverChicagoMixedNavigationR49.compile(city);
   const roadBodies=(r?.links||[]).map(s=>{
    const mx=(s.from.x+s.to.x)/2,mz=(s.from.z+s.to.z)/2;
    return {id:s.id,
     physical:!city.isPointBlocked(mx,mz,1.3,0)&&
        !city.isWaterAt(mx,mz),
     floor:city.getGroundHeightAt(mx,mz,null,true)};
   });
   const routes=(r?.corridors||[]).map(c=>{
    const start=c.sourcePoints[0],end=c.sourcePoints.at(-1);
    const path=DriverChicagoMixedNavigationR49.plan(city,start,end);
    return {id:c.id,pathPoints:path?.length||0,drivable:
      !!path&&path.every((p,i)=>!i||
        DriverChicagoMixedNavigationR49.clear(city,path[i-1],p,false))};
   });
   // Load a camera view over a real R79 street rather than an empty,
   // unrelated area of Chicago.
   const car=game.playerCar;
   if(car){
    car.x=-118;car.z=-40;
    car.speed=0;car.heading=Math.PI/2;
    car.updateTransform();
   }
   return {ready:city.ready,
    corridors:r?.connectedCorridors||0,segments:r?.connectedSegments||0,
    rejected:r?.rejected||[],polygonSides:r?.polygonCells.length||0,
    matchedBuildings:r?.matchedBuildings||0,
    ps1Certified:r?.originalSourceCoordinatesCertified,
    roadMesh:r?.mesh?.name||null,markingMesh:r?.markings?.name||null,
    allSegmentsPhysicallyClear:roadBodies.every(p=>p.physical&&
     Number.isFinite(p.floor)),
    roadBodies,routeResults:routes,
    graphLinks:graph?.downtownR79Segments||0,
    graphConnected:graph?.downtownR79Connected||0,
    r78Lots:city.districtBuildings.filter(b=>b.pilotR78).length,
    r78Interiors:city.interiors.filter(p=>p.id.startsWith('r78-')).length,
    r77Landmarks:city.chicagoPS1PlayableLandmarksR77?.sites.length||0,
    oldInteriors:city.interiors.filter(p=>!p.id.startsWith('r78-')).map(p=>p.id),
    wrigley:!!city.chicagoStadium,home:!!city.safeHouseZone,
    bridge:typeof city.bridgeRaised==='boolean',
    sourceRoadCertified:city.chicagoPS1StreetNetwork?.wholePS1MapCertified||false};
  });
  fs.mkdirSync('qa-artifacts/chicago-r79',{recursive:true});
  fs.writeFileSync('qa-artifacts/chicago-r79/downtown-game.json',
   JSON.stringify({report,jsErrors},null,2));
  console.log('CHICAGO_R79_PLAYABLE',JSON.stringify(report));
  assert.equal(report.ready,true);
  assert.equal(report.corridors,2);
  assert.equal(report.segments,16);
  assert.equal(report.rejected.length,0);
  assert.equal(report.polygonSides,8);
  assert.equal(report.matchedBuildings,40);
  assert.equal(report.ps1Certified,false);
  assert.equal(report.roadMesh,'chicago-r79-downtown-live-pavement');
  assert.equal(report.markingMesh,'chicago-r79-downtown-lane-dashes');
  assert.equal(report.allSegmentsPhysicallyClear,true);
  assert.equal(report.graphLinks,16);
  assert.equal(report.graphConnected,16);
  assert(report.routeResults.every(r=>r.drivable&&r.pathPoints>2));
  assert.equal(report.r78Lots,86);
  assert.equal(report.r78Interiors,2);
  assert.equal(report.r77Landmarks,4);
  assert(report.wrigley&&report.home&&report.bridge);
  assert.equal(report.sourceRoadCertified,false);
  assert.deepEqual(jsErrors,[]);
  await page.waitForTimeout(1500);
  await page.screenshot({path:'qa-artifacts/chicago-r79/live-downtown.png',
   timeout:30000});
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
