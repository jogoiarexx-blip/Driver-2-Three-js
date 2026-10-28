'use strict';
/**
 * Replay com física REAL dos carros/IA (sem teletransporte):
 * 1. Visitante R5 vem do oeste, entra na ilha e segue pela via local.
 * 2. Caminhão R6 atravessa o canal norte e alcança a avenida superior.
 * Usa o mesmo updatePhysics() de DriverVehicle do jogo.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const output=path.join(process.cwd(),'qa-artifacts');
fs.mkdirSync(output,{recursive:true});
const url=(process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/').replace(/\/?$/,'/');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
   '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
   '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.setDefaultTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
   await page.addInitScript(()=>localStorage.setItem(
     'driver2-menu-preferences-v1',JSON.stringify({
       models:false,scanlines:false,reducedMotion:true
     })));
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
   assert(await page.evaluate(()=>window.DriverBoot.start('ride')));
   await page.waitForFunction(()=>window.DriverGame?.city?.ready&&
     window.DriverGame?.playerCar&&window.DriverBoot.sessionReady);
   const data=await page.evaluate(()=>{
      const g=window.DriverGame,c=g.city;
      g.isPaused=true;
      const reports=[];
      for(const name of ['ENTREGAS GOOSE ISLAND','CARGA NORTE GOOSE ISLAND']){
        const car=g.vehicles.find(v=>v.name===name);
        if(!car){reports.push({name,error:'missing vehicle'});continue;}
        g.trafficAI.reset();
        let maxZ=car.z,minZ=car.z,maxX=car.x,minX=car.x;
        let wet=0,blocked=0,nearWater=0,nonfinite=0,collisions=0;
        let maxDamage=car.damage;
        let passedIsland=false,exitReached=false,entryReached=false;
        let northRoute=false;
        const samples=[],routeChanges=[];
        let lastPhase='';
        // 50s de simulação a 60fps, desacoplada do tempo do GPU.
        for(let i=0;i<3000;i++){
          const input=g.trafficAI.getInput(car,1/60,[car],null,0);
          const route=g.trafficAI.getRoute(car);
          if(!input||!route){nonfinite++;break;}
          const phase=route.isIslandSpine?
            (route.islandPhase||'spine') :
            route.isNorthYard?'north':
            route.northYardCompleted?'north-exit':
            route.islandVisitComplete?'island-exit':
            route.islandApproach?'approach':'road';
          if(phase!==lastPhase) {
            if(routeChanges.length<30)routeChanges.push({
              t:Number((i/60).toFixed(2)),phase,
              x:Number(car.x.toFixed(2)),z:Number(car.z.toFixed(2)),
              goal:{x:route.target.x,z:route.target.z}
            });
            lastPhase=phase;
          }
          const previousDamage=car.damage;
          car.updatePhysics(1/60,input,c,g.effects,null,false);
          if(car.damage>previousDamage+.01)collisions++;
          maxDamage=Math.max(maxDamage,car.damage);
          maxZ=Math.max(maxZ,car.z);minZ=Math.min(minZ,car.z);
          maxX=Math.max(maxX,car.x);minX=Math.min(minX,car.x);
          if(![car.x,car.z,car.heading,car.speed].every(Number.isFinite)){
             nonfinite++;break;
          }
          if(c.isWaterAt(car.x,car.z))wet++;
          if(c.isPointBlocked(car.x,car.z,1.55,car.y))blocked++;
          if(route.isIslandSpine&&car.z>188)passedIsland=true;
          if(car.gooseIslandVisitor&&car.x>-240)entryReached=true;
          if(route.northYardCompleted)exitReached=true;
          if(route.islandVisitComplete)exitReached=true;
          if(route.isNorthYard)northRoute=true;
          if(i%120===0) {
            const sample={t:Number((i/60).toFixed(1)),
              x:Number(car.x.toFixed(1)),z:Number(car.z.toFixed(1)),
              v:Number(car.speed.toFixed(1)),
              heading:Number(car.heading.toFixed(2)),phase};
            samples.push(sample);
          }
        }
        reports.push({name,start:samples[0],end:samples.at(-1),
          maxZ,minZ,maxX,minX,wet,blocked,nearWater,
          nonfinite,collisions,maxDamage,
          passedIsland,entryReached,exitReached,northRoute,
          samples,routeChanges});
      }
      return {reports,city:g.currentCityKey,
        mission:c.missionStart?.type,
        northBridgeDry:!c.isWaterAt(-196,306.3),
        island:c.chicagoGooseIslandStreet?.accessReady,
        north:c.chicagoGooseIslandNorthYard?.accessReady};
   });
   console.log('CHICAGO R7 REPLAY',JSON.stringify(data));
   assert.equal(data.city,'chicago');
   assert.equal(data.mission,'story_tipoff');
   assert(data.northBridgeDry&&data.island&&data.north);
   for(const report of data.reports){
     assert.equal(report.error,undefined,JSON.stringify(report));
     assert.equal(report.nonfinite,0,JSON.stringify(report));
     assert.equal(report.wet,0,'Carro na água: '+JSON.stringify(report));
     assert.equal(report.blocked,0,'Carro dentro de prédio: '+JSON.stringify(report));
     assert(report.maxDamage<20,'Carro danificado na rota: '+JSON.stringify(report));
     assert(report.exitReached,'Rota não concluída: '+JSON.stringify(report));
   }
   const visitor=data.reports.find(r=>r.name==='ENTREGAS GOOSE ISLAND');
   const north=data.reports.find(r=>r.name==='CARGA NORTE GOOSE ISLAND');
   assert(visitor.entryReached&&visitor.passedIsland,
     'Visitante não entrou de verdade em Goose Island');
   assert(north.northRoute&&north.maxZ>311,
     'Caminhão não alcançou a ponte ao norte');
   assert.equal(errors.length,0,errors.join('\n'));
   await page.screenshot({
     path:path.join(output,'chicago-r7-live-replay.png')
   });
 }finally{
   await page.close();await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
