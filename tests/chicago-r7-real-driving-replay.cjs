'use strict';
/**
 * R7: 35-80s of simulated driving with DriverVehicle.updatePhysics +
 * DriverTrafficAI.getInput. NO coordinate teleports, fixed 1/30s steps.
 * Makes JSON QA artifact to review path and blockers.
 */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(process.cwd(),'qa-artifacts');
fs.mkdirSync(dir,{recursive:true});
const root=(process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/').replace(/\/?$/,'/');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1152,height:720}});
 page.setDefaultTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.addInitScript(()=>localStorage.setItem(
    'driver2-menu-preferences-v1',JSON.stringify({models:false,scanlines:false,reducedMotion:true})));
  await page.goto(root,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
  assert(await page.evaluate(()=>window.DriverBoot.start('ride')));
  await page.waitForFunction(()=>window.DriverGame?.city?.ready&&
    window.DriverGame?.playerCar&&window.DriverBoot.sessionReady);
  const report=await page.evaluate(()=>{
    const game=window.DriverGame,city=game.city;
    game.isPaused=true;
    const effects={addSkidMark(){},spawnTireSmoke(){},spawnImpactSparks(){},
      spawnCarBreakaway(){},spawnWaterSplash(){},ejectHubcap(){}};
    function replay(name,params,frames){
      const truck=new DriverVehicle(game.scene,{name,bodyStyle:'truck',
        color:0x64839a,accel:17,maxSpeed:32,...params});
      for(const key of ['gooseIslandNorthYard','gooseIslandVisitor']){
        if(params[key])truck[key]=true;
      }
      const ai=new DriverTrafficAI(city);
      const originalIsTrafficGreen=city.isTrafficGreen;
      city.isTrafficGreen=()=>true;
      const samples=[],flags=new Set();
      let minZ=truck.z,maxZ=truck.z,maxX=truck.x,minX=truck.x;
      let wet=0,blocked=0,maxDamage=0,submerged=0;
      let previous={x:truck.x,z:truck.z};
      let longestStop=0,stopFrames=0,firstExitAt=null;
      try{
        for(let frame=0;frame<frames;frame++){
          const input=ai.getInput(truck,1/30,[],null,0);
          truck.updatePhysics(1/30,input,city,effects,null,false);
          const route=ai.getRoute(truck);
          if(route.islandPhase)flags.add(route.islandPhase);
          if(route.northYardCompleted||route.islandVisitComplete){
            flags.add('completed');
            if(firstExitAt===null)firstExitAt=frame/30;
          }
          if(city.isWaterAt(truck.x,truck.z))wet++;
          if(city.isPointBlocked(truck.x,truck.z,1.55,truck.y))blocked++;
          if(truck.isSubmerged)submerged++;
          maxDamage=Math.max(maxDamage,truck.damage);
          minZ=Math.min(minZ,truck.z);maxZ=Math.max(maxZ,truck.z);
          minX=Math.min(minX,truck.x);maxX=Math.max(maxX,truck.x);
          if(Math.hypot(truck.x-previous.x,truck.z-previous.z)<0.003 &&
             Math.abs(truck.speed)<2)stopFrames++;
          else stopFrames=0;
          longestStop=Math.max(longestStop,stopFrames);
          previous={x:truck.x,z:truck.z};
          if(frame%120===0||frame===frames-1)samples.push({
            t:Math.round(frame/30),x:+truck.x.toFixed(1),z:+truck.z.toFixed(1),
            h:+truck.heading.toFixed(2),s:+truck.speed.toFixed(1),
            destination:route.target&&[
              +route.target.x.toFixed(1),+route.target.z.toFixed(1)],
            phase:route.islandPhase||null,north:!!route.isNorthYard,
            completed:!!(route.northYardCompleted||route.islandVisitComplete)
          });
          if(firstExitAt!==null&&frame/30>firstExitAt+6)break;
        }
        return {name,frames,firstExitAt,minZ,maxZ,minX,maxX,
          maxDamage,blocked,wet,submerged,longestStopSeconds:+(longestStop/30).toFixed(2),
          flags:[...flags],last:{x:truck.x,z:truck.z,speed:truck.speed,
            heading:truck.heading},samples};
      }finally{
        city.isTrafficGreen=originalIsTrafficGreen;
        game.scene.remove(truck.root);
        GPUResourceUtils.disposeSubtree(truck.root);
      }
    }
    return {results:[
      replay('carga-norte-r7',{x:-196,z:260,heading:0,
        gooseIslandNorthYard:true},1050),
      replay('entregas-ilha-r7',{x:-284,z:156,heading:Math.PI/2,
        gooseIslandVisitor:true},2400),
      replay('r4-galpao-r7',{x:-196,z:184,heading:0},1500)
    ],mission:city.missionStart?.type,
      bridges:city.chicagoPS1RiverBranches?.bridgeCount,
      northAccess:city.chicagoGooseIslandNorthYard?.accessReady,
      visitorAccess:city.chicagoGooseIslandStreet?.accessReady};
  });
  fs.writeFileSync(path.join(dir,'chicago-r7-physical-traffic-replay.json'),
    JSON.stringify(report,null,2)+'\n');
  console.log('R7 PHYSICS REPLAY '+JSON.stringify(report));
  assert.equal(report.mission,'story_tipoff');
  assert.equal(report.bridges,10);
  assert(report.northAccess&&report.visitorAccess);
  const [north,visitor,r4]=report.results;
  for(const r of report.results){
    assert.equal(r.submerged,0,r.name+' caiu no rio');
    assert.equal(r.blocked,0,r.name+' atravessou predio');
    assert(r.maxDamage<35,r.name+' sofreu danos anormais');
  }
  assert(north.maxZ>=310,'Caminhao norte nao atingiu ponte: '+north.maxZ);
  assert(north.flags.includes('completed'),'Caminhao norte nao saiu da ponte');
  assert(visitor.maxX>=-200,'Entregador nao chegou na ilha: '+visitor.maxX);
  assert(visitor.flags.includes('traverse'),'Entregador nao entrou na rua');
  assert(visitor.flags.includes('completed'),'Entregador nao saiu da ilha');
  assert(r4.maxZ>=228,'Furgao R4 nao alcancou cruzamento');
  assert.deepEqual(errors,[],errors.join('\n'));
 }finally{await page.close();await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
