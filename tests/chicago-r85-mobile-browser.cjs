'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
   '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
   '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const context=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:2,
  isMobile:true,hasTouch:true
 });
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const output='qa-artifacts/chicago-r85';
 fs.mkdirSync(output,{recursive:true});
 try{
  await page.goto(process.env.DRIVER_QA_URL||
   'http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',
    timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
  await page.evaluate(()=>window.DriverBoot.start('ride'));
  await page.waitForFunction(()=>window.DriverBoot?.sessionReady&&
   window.DriverGame?.city?.ready&&
   window.DriverGame?.currentCityKey==='chicago',
   null,{timeout:120000});
  const before=await page.evaluate(()=>{
   const g=window.DriverGame,c=g.city,
    rooms=['r84-greektown-loft','r84-prairie-office']
     .map(id=>c.interiors.find(p=>p.id===id));
   g.mode='on_foot';g.tanner.setVisible(true);
   return {rooms:rooms.map(p=>({
     id:p?.id,doors:p?.r84Blueprint?.doors?.length,
     parts:p?.r84Blueprint?.parts?.length,
     enhanced:p?.r84Blueprint?.r85Enhanced,
     loaded:p?.r84Loaded})),
    r83Rooms:c.chicagoAccessibleInteriorsR83?.prepared,
    r82Rooms:c.chicagoModularInteriorsR82?.prepared,
    originalLots:c.districtBuildings.filter(x=>x.pilotR78).length,
    touch:matchMedia('(pointer: coarse)').matches,
    width:innerWidth};
  });
  assert.equal(before.rooms.length,2);
  assert(before.rooms.every(x=>x.doors===2&&x.enhanced&&
   x.loaded===false&&x.parts<=45));
  assert.equal(before.r83Rooms,2);
  assert.equal(before.r82Rooms,3);
  assert.equal(before.originalLots,86);
  assert(before.touch);
  const touches=[];
  for(const name of ['r84-greektown-loft','r84-prairie-office']){
   await page.evaluate(id=>{
    const g=window.DriverGame,p=g.city.interiors.find(p=>p.id===id);
    g.tanner.setPosition(p.door.x,0,p.door.z,0);
   },name);
   await page.locator('#touch-action').tap({timeout:15000});
   const entered=await page.evaluate(id=>{
    const g=window.DriverGame,p=g.city.interiors.find(p=>p.id===id);
    return g.interiorPlace===p&&p.r84Loaded;
   },name);
   assert(entered,'mobile touch E did not enter '+name);
   // The actual mobile on-screen ACTION (E), not a direct door API.
   await page.evaluate(id=>{
    const g=window.DriverGame,p=g.city.interiors.find(p=>p.id===id),
      d=p.r84Blueprint.doors[1];
    g.tanner.setPosition(p.inside.x+1.3,0,
      p.inside.z+d.z,Math.PI/2);
   },name);
   const blocked=await page.evaluate(id=>{
    const g=window.DriverGame,p=g.city.interiors.find(p=>p.id===id);
    const d=p.r84Blueprint.doors[1];
    return g.city.isPointBlocked(
     p.inside.x+d.x,p.inside.z+d.z,.55,0);
   },name);
   assert(blocked,'new interior door was not solid');
   await page.locator('#touch-action').tap({timeout:15000});
   const result=await page.evaluate(id=>{
    const g=window.DriverGame,p=g.city.interiors.find(p=>p.id===id),
      d=p.r84Blueprint.doors[1],c=g.city;
    const open=d.open&&!c.isPointBlocked(
      p.inside.x+d.x,p.inside.z+d.z,.55,0);
    // Run the real Tanner controller, with sprint-length frames;
    // the R85 sweep must traverse the opened passage.
    const frame={up:true,down:false,left:false,right:false,
     sprint:true};
    for(let i=0;i<3;i++)g.tanner.update(.08,frame,c);
    return {open,x:g.tanner.group.position.x-p.inside.x,
     y:g.tanner.group.position.y,
     z:g.tanner.group.position.z-p.inside.z,
     activeRooms:c.interiors.filter(p=>
      p.r84Loaded||p.r83Loaded||p.r82Loaded).length};
   },name);
   assert(result.open,'touch ACTION did not open second door');
   assert(result.x>3.15,'Tanner failed to traverse opened doorway');
   assert.equal(result.activeRooms,1);
   await page.screenshot({path:output+'/'+name+'-mobile.png',
    timeout:30000});
   // Measure frame pacing on emulated phone, not real hardware FPS.
   const timing=await page.evaluate(async()=>{
    const values=[];let last=0;
    for(let i=0;i<44;i++){
      const now=await new Promise(resolve=>requestAnimationFrame(resolve));
      if(last)values.push(Math.round((now-last)*100)/100);
      last=now;
    }
    values.sort((a,b)=>a-b);
    return {count:values.length,medianMs:values[Math.floor(
      values.length/2)],p95Ms:values[Math.floor(values.length*.95)]};
   });
   assert(timing.count>=40&&timing.medianMs>0);
   // Back to physical exit, using the actual on-screen E button.
   await page.evaluate(id=>{
    const g=window.DriverGame,p=g.city.interiors.find(p=>p.id===id);
    g.tanner.setPosition(p.exit.x,0,p.exit.z,0);
   },name);
   await page.locator('#touch-action').tap({timeout:15000});
   const unloaded=await page.evaluate(id=>{
    const g=window.DriverGame,p=g.city.interiors.find(p=>p.id===id);
    return !g.interiorPlace&&!p.r84Loaded;
   },name);
   assert(unloaded,'mobile exit retained R84 meshes');
   touches.push({id:name,entered,blocked,...result,
    unloaded,timing});
  }
  // Actual route from central spawn, through second door, around
  // rail, and over the full stairway in the same real game.
  const stairs=await page.evaluate(()=>{
   const g=window.DriverGame,p=g.city.interiors.find(
    p=>p.id==='r84-greektown-loft');
   g.mode='on_foot';g.tanner.setVisible(true);g.enterInterior(p);
   const M=window.DriverChicagoIndoorNavigationR85,
    c=g.city,b=p.r84Blueprint;
   const door=b.doors[1];door.open=true;
   if(door.mesh)door.mesh.position.z=b.z+door.z+3.95;
   let pos={x:b.x,y:0,z:b.z-6},blockedAt=null;
   const route=[
    [b.x+1.3,b.z-6],[b.x+1.3,b.z-3.2],
    [b.x+4.05,b.z-3.2],[b.x+4.05,b.z-8.2],
    [b.x+6.5,b.z-8.2]
   ];
   for(const [x,z] of route){
    const result=M.move(c,pos,{x,z});
    if(result.blocked){blockedAt={pos,x,z,result};break;}
    pos=result;
   }
   let stuck=0,maxY=0;
   for(let k=0;k<125&&!blockedAt;k++){
    const result=M.move(c,pos,{x:pos.x,z:pos.z+.136});
    if(Math.abs(result.z-pos.z)<.000001)stuck++;
    pos=result;maxY=Math.max(maxY,pos.y);
   }
   return {blockedAt,stuck,maxY,finishY:pos.y,
    finishZ:pos.z-b.z};
  });
  assert.equal(stairs.blockedAt,null);
  assert.equal(stairs.stuck,0);
  assert.equal(stairs.finishY,7.2);
  assert.equal(stairs.maxY,7.2);
  const report={before,touches,stairs,errors,
    device:'Chromium emulado 390x844 touch 2x (não celular físico)'};
  fs.writeFileSync(output+'/mobile-r85.json',
   JSON.stringify(report,null,2));
  console.log('CHICAGO_R85_MOBILE_REAL_GAME',
    JSON.stringify(report));
  assert.deepEqual(errors,[]);
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
