'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),
 fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/',
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
  await page.evaluate(()=>window.DriverBoot.start('ride'));
  await page.waitForFunction(()=>window.DriverBoot?.sessionReady&&
   window.DriverGame?.city?.ready&&
   window.DriverGame?.currentCityKey==='chicago',
   null,{timeout:120000});
  const result=await page.evaluate(()=>{
   const game=window.DriverGame,c=game.city;
   const lots=c.districtBuildings.filter(x=>x.pilotR78);
   const interiors=c.interiors.filter(x=>x.id.startsWith('r78-'));
   const pilots=window.DriverChicagoBlockGeneratorR78.PILOTS;
   const blocked=(x,z,r=.3)=>c.isPointBlocked(x,z,r,0);
   const liveRooms=interiors.map(p=>({
     id:p.id,door:p.door,inside:p.inside,exit:p.exit,
     found:c.interiorAt(p.door.x,p.door.z)?.id===p.id,
     room:c.interiorFloorAt(p.inside.x,p.inside.z),
     exitFree:!blocked(p.door.x,p.door.z+4),
     dryDoor:!c.isWaterAt(p.door.x,p.door.z)
   }));
   const sample=lots.find(b=>b.interiorId==='r78-loop-shop');
   const oldMode=game.mode;
   let entered=false,left=false,enteredMatch=false;
   if(liveRooms.every(r=>r.found&&r.exitFree)){
      game.mode='on_foot';
      const p=interiors[0];
      entered=game.enterInterior(p);
      enteredMatch=game.interiorPlace?.id===p.id;
      left=game.leaveInterior();
      game.mode=oldMode;
   }
   return {region:'chicago',blocks:c.chicagoCityPlan?.r78PilotBlocks,
     frontages:c.chicagoCityPlan?.r78Frontages,
     registeredRooms:c.chicagoCityPlan?.r78EnterableRooms,
     actualLots:lots.length,
     oldInteriors:c.interiors.filter(x=>!x.id.startsWith('r78-')).map(x=>x.id),
     rooms:liveRooms,entered,enteredMatch,left,
     sample:sample?{id:sample.id,tier:sample.interiorTier}:null,
     safeHouse:!!c.safeHouseZone,
     wrigley:!!c.chicagoStadium,
     meigs:!!c.chicagoAirfield,
     r77:!!c.chicagoPS1PlayableLandmarksR77,
     roadSafe:pilots.every(p=>!blocked(p.x+28,p.z,.25)),
     countryside:null,
     sourcePS1RoadsCertified:false
   };
  });
  fs.mkdirSync('qa-artifacts/chicago-r78',{recursive:true});
  fs.writeFileSync('qa-artifacts/chicago-r78/playable.json',
   JSON.stringify({result,errors},null,2));
  console.log('CHICAGO_R78_GAME',JSON.stringify(result));
  assert.equal(result.region,'chicago');
  assert.equal(result.blocks,9);
  assert.equal(result.frontages,86);
  assert.equal(result.actualLots,86);
  assert.equal(result.registeredRooms,2);
  assert.equal(result.rooms.length,2);
  assert(result.rooms.every(p=>p.found&&p.room&&p.exitFree&&p.dryDoor),
   'door, spawn and interior floor must be real');
  assert(result.entered&&result.enteredMatch&&result.left,
   'the same engine E/exit system must enter and leave a new room');
  assert(result.safeHouse&&result.wrigley&&result.r77);
  assert(result.roadSafe);
  assert(!result.sourcePS1RoadsCertified);
  assert.equal(errors.length,0,errors.join('\n'));
  await page.screenshot({path:'qa-artifacts/chicago-r78/playable.png',
   timeout:30000});
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
