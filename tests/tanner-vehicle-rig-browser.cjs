'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
fs.mkdirSync('qa-artifacts',{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1280,height:760}});
 const errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 page.setDefaultTimeout(120000);
 try{
  await page.addInitScript(()=>localStorage.setItem(
   'driver2-menu-preferences-v1',
   JSON.stringify({models:false,scanlines:false,reducedMotion:true})));
  await page.goto(process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/',
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
  assert(await page.evaluate(()=>window.DriverBoot.start('ride')));
  await page.waitForFunction(()=>window.DriverGame?.city?.ready &&
   window.DriverBoot?.sessionReady, null,{timeout:120000});
  await page.waitForFunction(()=>window.DriverGame?.tanner?.vehicleBoneRig &&
   window.DriverGame?.vehicles?.some(v=>v.bodyStyle==='motorcycle'),
   null,{timeout:120000});
  const result=await page.evaluate(()=>{
   const g=window.DriverGame,v=g.vehicles.find(v=>v.bodyStyle==='motorcycle');
   g.isPaused=true;g.mode='on_foot';g.gameEnded=false;g.inReplayMode=false;
   g.policeDoorTransition=null;g.vehicleMountTransition=null;
   g.tanner.detachFromMotorcycle?.();
   g.tanner.setPosition(v.x-1.65,v.y,v.z-.18,v.heading);
   g.tanner.setVisible(true);
   const originalGroup=g.tanner.group,originalRig=g.tanner.vehicleBoneRig;
   const begin=DriverVehicleMount.start(g,v,'enter');
   if(!begin)return {ok:false,reason:'cannot mount at this world coordinate',x:v.x,z:v.z};
   for(let i=0;i<55;i++){
    DriverVehicleMount.update(g,1/60);
    DriverUploadedVehicles.updateRiders(g);
   }
   const halfway={visible:g.tanner.group.visible,
      parent:g.tanner.group.parent===g.scene,
      rigApplied:originalRig.applied,
      phase:g.vehicleMountTransition?.progress};
   for(let i=0;i<70;i++){
    DriverVehicleMount.update(g,1/60);
    DriverUploadedVehicles.updateRiders(g);
   }
   const high=originalRig.found.rightUpLeg;
   const delta=Math.abs(high.node.quaternion.x-high.rotation.x)+
       Math.abs(high.node.quaternion.z-high.rotation.z);
   const mounted={
      mode:g.mode,attached:g.tanner.motorcycleVehicle===v,
      riderHidden:!v.motorcycleRider.visible,
      TannerVisible:g.tanner.group.visible,
      owner:g.tanner.group.parent===v.chassisTilt,
      rigDelta:delta
   };
   const hip=originalRig.found.hips;
   const hipBefore=hip.node.position.y;
   for(let i=0;i<180;i++){
    g._riderDelta=1/60;DriverUploadedVehicles.updateRiders(g);
   }
   mounted.drift=Math.abs(hip.node.position.y-hipBefore);
   const contacts=g.tanner.motorcycleContactReport||{};
   mounted.contactReport=contacts;
   mounted.contactsImproved=Object.values(contacts).filter(c=>
       c&&!c.skipped&&Number.isFinite(c.before)&&Number.isFinite(c.after)&&
       c.after<c.before-.001).length;
   // Testar a reação ao guidão e à aceleração na pose montada.
   v.steerAngle=.45;v.rollAngle=.10;v.lateralVelocity=2;v.speed=19;
   for(let i=0;i<65;i++){
       g._riderDelta=1/60;DriverUploadedVehicles.updateRiders(g);
   }
   mounted.steeringLean=g.tanner.motorcycleDynamics?.lean;
   v.speed=0;
   g._riderDelta=1/60;DriverUploadedVehicles.updateRiders(g);
   mounted.braking=g.tanner.motorcycleDynamics?.brake;
   // Teste de regressão: reconstruir malha ou aplicar GLB novo não pode
   // descartar o próprio Tanner junto com os antigos meshes do chassi.
   v.buildCarMesh();
   mounted.survivedRebuild=g.tanner.group.parent===v.chassisTilt;
   const replacement=new THREE.Group();
   replacement.add(new THREE.Mesh(new THREE.BoxGeometry(.7,1.2,2.0),
       new THREE.MeshLambertMaterial({color:0x64748b})));
   mounted.replacementAccepted=v.applyCC0Model(replacement,true);
   mounted.survivedGLBSwap=g.tanner.group.parent===v.chassisTilt;
   const exit=DriverVehicleMount.start(g,v,'exit');
   const attachedAtStart=g.tanner.group.parent===v.chassisTilt;
   for(let i=0;i<17;i++){
    DriverVehicleMount.update(g,1/60);
    DriverUploadedVehicles.updateRiders(g);
   }
   const detachedDuringSwing=g.tanner.group.parent===g.scene;
   for(let i=0;i<110;i++){
    DriverVehicleMount.update(g,1/60);
    DriverUploadedVehicles.updateRiders(g);
   }
   const dismounted={exit,attachedAtStart,detachedDuringSwing,mode:g.mode,
      parent:g.tanner.group.parent===g.scene,visible:g.tanner.group.visible,
      noRider:!v.motorcycleRider.visible&&g.tanner.motorcycleVehicle===null,
      restored:Math.abs(hip.node.position.y-hip.position.y)<1e-5};
   return {ok:true,halfway,mounted,dismounted,
       bones:Object.keys(originalRig.found),sameObject:g.tanner.group===originalGroup};
  });
  console.log('TANNER_SKELETAL_MOTORCYCLE',JSON.stringify(result));
  assert(result.ok,JSON.stringify(result));
  assert(result.halfway.parent&&result.halfway.visible);
  assert(result.halfway.rigApplied>.1,'bone pose must be applied while mounting');
  assert.equal(result.mounted.mode,'driving');
  assert(result.mounted.attached&&result.mounted.owner&&result.mounted.TannerVisible);
  assert(result.mounted.riderHidden,'must not draw a second procedural Tanner');
  assert(result.mounted.rigDelta>.05,'right leg needs real skeletal rotation');
  assert(result.mounted.drift<1e-4,'repeated ride poses accumulated deformation');
  assert(result.mounted.contactsImproved>=2,
    'IK must measurably move hands/feet closer to controls: '+JSON.stringify(result.mounted.contactReport));
  assert(result.mounted.steeringLean<-.02,'torso must lean as bike steers');
  assert(result.mounted.braking>.01,'rider must react to braking');
  assert(result.mounted.survivedRebuild&&result.mounted.replacementAccepted&&
    result.mounted.survivedGLBSwap,'rider must survive vehicle mesh replacement');
  assert(result.dismounted.exit&&result.dismounted.attachedAtStart&&result.dismounted.detachedDuringSwing);
  assert.equal(result.dismounted.mode,'on_foot');
  assert(result.dismounted.parent&&result.dismounted.visible&&result.dismounted.noRider);
  assert(result.dismounted.restored&&result.sameObject);
  assert.equal(errors.length,0,errors.join('\n'));
  fs.writeFileSync('qa-artifacts/tanner-skeletal-motorcycle.json',
    JSON.stringify({result,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
