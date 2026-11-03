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
   window.DriverGame?.currentCityKey==='chicago',null,{timeout:120000});
  const report=await page.evaluate(()=>{
   const game=window.DriverGame,c=game.city,
    mod=window.DriverChicagoAccessibleInteriorsR83,
    ids=['r83-loop-mezzanine','r83-ukrainian-house'],
    observation=[];
   game.mode='on_foot';
   let maxLoaded=0;
   for(const id of ids){
    const p=c.interiors.find(p=>p.id===id);
    if(!p){observation.push({id,missing:true});continue}
    const b=p.r83Blueprint,door=b.doors[0];
    const spawnClear=!c.isPointBlocked(b.x,b.z-6,.55,0),
     exteriorClear=!c.isWaterAt(p.door.x,p.door.z+4),
     beforeLoaded=p.r83Loaded;
    // Use the actual E action for exterior -> interior, not a direct
    // internal engine call that could mask broken gameplay controls.
    game.tanner.setPosition(p.door.x,0,p.door.z,0);
    game.toggleVehicleEnterExit();
    const entered=game.interiorPlace===p&&p.r83Loaded;
    maxLoaded=Math.max(maxLoaded,c.interiors.filter(i=>i.r83Loaded).length);
    const pos={x:b.x+door.x+1.2,z:b.z+door.z,y:0};
    const closed=c.isPointBlocked(b.x+door.x,b.z+door.z,.55,0);
    game.tanner.setPosition(pos.x,0,pos.z,0);
    game.toggleVehicleEnterExit(); // Actual E interaction
    const message=document.getElementById('home-save-status')?.textContent;
    const opened=!c.isPointBlocked(b.x+door.x,b.z+door.z,.55,0);
    const moved=door.mesh?.position.z>b.z+door.z+3.9;
    game.toggleVehicleEnterExit(); // Close with E again
    const closedAgain=!door.open;
    const reblocked=c.isPointBlocked(b.x+door.x,b.z+door.z,.55,0);
    let stairResult=null;
    if(b.mezzanine){
      game.tanner.setPosition(b.x+7.2,0,b.z-6.5,0);
      const input={up:true,down:false,left:false,right:false,sprint:false};
      let maxY=0,stalled=0,previousZ=game.tanner.group.position.z;
      for(let i=0;i<85;i++){
       game.tanner.update(.016,input,c);
       const at=game.tanner.group.position;
       maxY=Math.max(maxY,at.y);
       if(at.z===previousZ)stalled++;
       previousZ=at.z;
      }
      const climbed=game.tanner.group.position.y;
      const reached=game.tanner.group.position.z-b.z;
      stairResult={maxY,climbed,reached,stalled,
       deckAt:c.getGroundHeightAt(b.x+7.2,b.z+5,3.6),
       teleportForbidden:!mod.safeStep(c,b.x+4.8,b.z+5,0,
        b.x+4.9,b.z+5,3.6)};
    }
    game.tanner.setPosition(p.exit.x,0,p.exit.z,0);
    game.toggleVehicleEnterExit(); // Exit with E at the internal door
    const unloaded=game.interiorPlace===null&&!p.r83Loaded&&
      !c.cityGroup.children.some(ch=>
       ch.name==='r83-accessible-interior-'+id);
    observation.push({id,source:p.r83SourceLot,
      spawnClear,exteriorClear,beforeLoaded,entered,closed,
      message,opened,moved,closedAgain,reblocked,unloaded,
      parts:b.parts.length,colliders:b.colliders.length,
      stairs:b.stairs.length,stairResult});
   }
   const stat=c.chicagoAccessibleInteriorsR83;
   return {ready:c.ready,prepared:stat.prepared,
    loadCount:stat.loadCount,unloadCount:stat.unloadCount,
    liveAfter:stat.liveRoomId,maxLoaded,observation,
    r82Prepared:c.chicagoModularInteriorsR82?.prepared,
    r81Links:c.chicagoGooseIndustrialR81?.links?.length,
    r80Rails:c.chicagoRiverfrontR80?.railsCreated,
    r79Roads:c.chicagoDowntownR79?.connectedSegments,
    r78Lots:c.districtBuildings.filter(b=>b.pilotR78).length,
    homePreserved:c.interiors.some(p=>p.id==='home')};
  });
  fs.mkdirSync('qa-artifacts/chicago-r83',{recursive:true});
  fs.writeFileSync('qa-artifacts/chicago-r83/doors-stairs.json',
   JSON.stringify({report,errors},null,2));
  console.log('CHICAGO_R83_REAL_GAME',JSON.stringify(report));
  assert.equal(report.prepared,2);
  assert.equal(report.maxLoaded,1);
  assert.equal(report.liveAfter,null);
  assert.equal(report.loadCount,2);
  assert.equal(report.unloadCount,2);
  assert.equal(report.r82Prepared,3);
  assert.equal(report.r81Links,4);
  assert.equal(report.r80Rails,66);
  assert.equal(report.r79Roads,16);
  assert.equal(report.r78Lots,86);
  assert.equal(report.homePreserved,true);
  assert(report.observation.every(o=>
   !o.missing&&o.source&&o.spawnClear&&o.exteriorClear&&
   !o.beforeLoaded&&o.entered&&o.closed&&
   o.message==='PORTA ABERTA'&&o.opened&&o.moved&&
   o.closedAgain&&o.reblocked&&o.unloaded));
  const stairs=report.observation[0].stairResult;
  assert(stairs&&stairs.maxY>=3.59&&stairs.climbed>=3.59,
   'Tanner never actually climbed the 12 steps');
  assert(stairs.reached>1.4,'upper platform not reached');
  assert(stairs.stalled<10,'collisions blocked the stairs');
  assert.equal(stairs.deckAt,3.6);
  assert.equal(stairs.teleportForbidden,true);
  assert.deepEqual(errors,[]);
  // Screen capture of the REAL in-game upper platform.
  await page.evaluate(()=>{
   const game=window.DriverGame,p=game.city.interiors.find(
    p=>p.id==='r83-loop-mezzanine');
   game.mode='on_foot';game.enterInterior(p);
   game.tanner.setPosition(p.inside.x+7.2,3.6,p.inside.z+5,Math.PI);
  });
  await page.waitForTimeout(700);
  await page.screenshot({
   path:'qa-artifacts/chicago-r83/upper-mezzanine-real-game.png',
   timeout:30000});
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
