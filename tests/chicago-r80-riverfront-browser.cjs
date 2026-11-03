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
    r=c.chicagoRiverfrontR80,
    graph=DriverChicagoMixedNavigationR49.compile(c),
    route=DriverChicagoMixedNavigationR49.plan(c,
       {x:-320,z:-80},{x:-160,z:-80});
   const raised=c.bridgeRaised,angle=c.bridgeAngle;
   const moving=[
     [{x:0,z:30},{x:0,z:70}],
     [{x:240,z:30},{x:240,z:70}]
   ];
   const lowered=moving.map(([a,b])=>
    DriverChicagoMixedNavigationR49.bridgeClosed(c,a,b));
   c.bridgeRaised=true;c.bridgeAngle=.38;
   const opened=moving.map(([a,b])=>
    DriverChicagoMixedNavigationR49.bridgeClosed(c,a,b));
   const fixedOpen=DriverChicagoMixedNavigationR49.bridgeClosed(c,
    {x:-280,z:-80},{x:-200,z:-80});
   const openGraph=DriverChicagoMixedNavigationR49.compile(c);
   c.bridgeRaised=raised;c.bridgeAngle=angle;
   const closedGraph=DriverChicagoMixedNavigationR49.compile(c);
   const pads=(r?.colliders||[]).map(b=>{
     const x=(b.minX+b.maxX)/2,z=(b.minZ+b.maxZ)/2;
     return {x,z,dry:!c.isWaterAt(x,z),blocked:c.isPointBlocked(x,z,.1,0)};
   });
   const first=window.DriverChicagoRiverfrontR80;
   const crossings=first?.fixedBridgeSites()||[];
   const roadSafe=crossings.every(p=>
    !c.isWaterAt(p.x,p.z)&&
    !c.isPointBlocked(p.x,p.z,1.5,0));
   if(game.playerCar){
     game.playerCar.x=-220;game.playerCar.z=-80;
     game.playerCar.heading=Math.PI/2;game.playerCar.speed=0;
     game.playerCar.updateTransform();
   }
   return {ready:!!r?.ready,bankRailCount:r?.railsCreated||0,
    quaySegments:r?.quaySegments||0,
    bankRejected:r?.bankRejected.length||0,
    bridgeDetailParts:r?.bridgeDetailParts||0,
    facades:r?.facades||0,
    r53Buildings:r?.r53Buildings||0,
    r78CanalBuildings:r?.r78CanalBuildings||0,
    r14CanalBuildings:r?.r14CanalBuildings||0,
    fixedBridges:r?.fixedBridgeCount||0,
    decorativeOnly:r?.drivableRoutesAdded===0,
    ps1Certified:r?.originalPS1PlacementCertified,
    riverPhysicsOriginal:c.chicagoPS1RiverBranches?.bridgeCount===10,
    bankPads:pads,allRailsDryAndSolid:pads.every(p=>p.dry&&p.blocked),
    bridgeApproachesClear:roadSafe,
    bridgeClosedWhenLowered:lowered,
    bridgeClosedWhenRaised:opened,
    fixedStaysOpen:!fixedOpen,
    bridgeGraphChanges:openGraph!==closedGraph,
    westFixedBridgeRoutePoints:route?.length||0,
    fixedRouteClear:!!route&&route.every((p,i)=>!i||
      DriverChicagoMixedNavigationR49.clear(c,route[i-1],p,false)),
    r79Corridors:c.chicagoDowntownR79?.connectedCorridors||0,
    r79Roads:c.chicagoDowntownR79?.connectedSegments||0,
    r78Lots:c.districtBuildings.filter(b=>b.pilotR78).length,
    r78Interiors:c.interiors.filter(p=>p.id.startsWith('r78-')).length,
    r77Landmarks:c.chicagoPS1PlayableLandmarksR77?.sites.length||0,
    home:!!c.safeHouseZone,wrigley:!!c.chicagoStadium,
    originalRoofPreserved:!!c.chicagoLowerWacker};
  });
  fs.mkdirSync('qa-artifacts/chicago-r80',{recursive:true});
  fs.writeFileSync('qa-artifacts/chicago-r80/riverfront-game.json',
   JSON.stringify({report,errors},null,2));
  console.log('CHICAGO_R80_PLAYABLE',JSON.stringify(report));
  assert(report.ready);
  assert(report.bankRailCount>8);
  assert(report.quaySegments>8);
  assert(report.bridgeDetailParts>40);
  assert.equal(report.fixedBridges,10);
  assert(report.facades>=8);
  assert.equal(report.ps1Certified,false);
  assert(report.riverPhysicsOriginal);
  assert(report.decorativeOnly);
  assert(report.allRailsDryAndSolid);
  assert(report.bridgeApproachesClear);
  assert.deepEqual(report.bridgeClosedWhenLowered,[false,false]);
  assert.deepEqual(report.bridgeClosedWhenRaised,[true,true]);
  assert(report.fixedStaysOpen&&report.bridgeGraphChanges);
  assert(report.westFixedBridgeRoutePoints>=3);
  assert(report.fixedRouteClear);
  assert.equal(report.r79Corridors,2);
  assert.equal(report.r79Roads,16);
  assert.equal(report.r78Lots,86);
  assert.equal(report.r78Interiors,2);
  assert.equal(report.r77Landmarks,4);
  assert(report.home&&report.wrigley&&report.originalRoofPreserved);
  assert.deepEqual(errors,[]);
  await page.waitForTimeout(1600);
  await page.screenshot({path:'qa-artifacts/chicago-r80/riverfront-game.png',
    timeout:30000});
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
