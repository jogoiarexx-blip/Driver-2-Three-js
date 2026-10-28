'use strict';
/**
 * R9: 60 segundos de tráfego simultâneo real (quatro carros).
 * Em R7/R8 cada carro dirigia sozinho. Aqui a IA recebe os 4 veículos,
 * incluindo detecção de fila e colisão física entre chassis OBB/SAT.
 * Sem modificar a posição, o motor ou os waypoints durante a simulação.
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
 const page=await browser.newPage({viewport:{width:1152,height:720}});
 page.setDefaultTimeout(120000);
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
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
    const result=await page.evaluate(()=>{
       const game=window.DriverGame,city=game.city;
       game.isPaused=true;
       const names=['FURGÃO GOOSE ISLAND','ENTREGAS GOOSE ISLAND',
          'CARGA NORTE GOOSE ISLAND','RETORNO SUL GOOSE ISLAND'];
       const fleet=names.map(name=>game.vehicles.find(v=>v.name===name));
       if(fleet.some(x=>!x))return {error:'missing vehicles',
          all:game.vehicles.map(x=>x.name)};
       const noop={
          addSkidMark(){},spawnTireSmoke(){},spawnImpactSparks(){},
          spawnCarBreakaway(){},spawnWaterSplash(){},ejectHubcap(){}
       };
       const trafficGreen=city.isTrafficGreen;
       // Primeira rodada compara com a base R7/R8: semáforos verdes.
       // O diferencial é a interação real entre quatro veículos.
       city.isTrafficGreen=()=>true;
       game.trafficAI.reset();
       game.collisionSystem.reset();
       const reports=fleet.map(car=>({
          name:car.name,start:{x:car.x,z:car.z},
          maxZ:car.z,minZ:car.z,maxX:car.x,minX:car.x,
          wet:0,blocked:0,submerged:0,impact:0,
          last:{x:car.x,z:car.z},maxStop:0,stale:0,
          samples:[],phases:[]
       }));
       const impacts=[];
       let contacts=0,frames=1200;
       try{
        for(let i=0;i<frames;i++){
          for(let j=0;j<fleet.length;j++){
            const car=fleet[j],v=reports[j];
            const input=game.trafficAI.getInput(car,.05,fleet,null,0);
            car.updatePhysics(.05,input,city,noop,null,false);
            const route=game.trafficAI.getRoute(car);
            v.maxZ=Math.max(v.maxZ,car.z);
            v.minZ=Math.min(v.minZ,car.z);
            v.maxX=Math.max(v.maxX,car.x);
            v.minX=Math.min(v.minX,car.x);
            if(city.isWaterAt(car.x,car.z))v.wet++;
            if(city.isPointBlocked(car.x,car.z,1.55,car.y))v.blocked++;
            if(car.isSubmerged)v.submerged++;
            if(Math.hypot(car.x-v.last.x,car.z-v.last.z)<.005&&
               Math.abs(car.speed)<1.5)v.stale++;
            else v.stale=0;
            v.maxStop=Math.max(v.maxStop,v.stale);
            v.last={x:car.x,z:car.z};
            if(i%50===0){
              const phase=route.isNorthYardSouth?'southbound':
                  route.isNorthYard?'northbound':
                  route.isIslandSpine?'island':
                  route.islandApproach?'visitor':
                  route.northYardCompleted?'north-exit':
                  route.southYardCompleted?'south-exit':
                  route.islandVisitComplete?'island-exit':'grid';
              v.samples.push({
                t:+(i*.05).toFixed(1),x:+car.x.toFixed(2),
                z:+car.z.toFixed(2),v:+car.speed.toFixed(1),
                heading:+car.heading.toFixed(2),phase
              });
              if(!v.phases.includes(phase))v.phases.push(phase);
            }
          }
          contacts+=game.collisionSystem.step(fleet,null,city,i*50,
             undefined,impact=>{
               if(impacts.length<30)impacts.push({
                 t:+(i*.05).toFixed(2),a:impact.a.name,
                 b:impact.b.name,speed:+impact.closingSpeed.toFixed(2)
               });
             });
        }
       } finally {city.isTrafficGreen=trafficGreen;}
       for(let j=0;j<fleet.length;j++){
         const car=fleet[j],r=reports[j];
         r.finish={x:car.x,z:car.z,damage:car.damage,
           speed:car.speed,heading:car.heading};
         delete r.stale;
         delete r.last;
       }
       return {city:game.currentCityKey,
          localNetwork:city.chicagoLocalRoadNetwork&&{
             flowsAvailable:city.chicagoLocalRoadNetwork.flowsAvailable,
             segmentsChecked:city.chicagoLocalRoadNetwork.segmentsChecked,
             all:city.chicagoLocalRoadNetwork.allFlowRoutesAvailable,
             originalCertified:city.chicagoLocalRoadNetwork.originalPS1RoadsCertified
          },
          missions:city.missionStart?.type,
          northAccess:city.chicagoGooseIslandNorthYard?.accessReady,
          southAccess:city.chicagoGooseIslandStreet?.accessReady,
          contacts,impacts,reports};
    });
    fs.writeFileSync(path.join(output,'chicago-r9-concurrent-traffic.json'),
      JSON.stringify(result,null,2)+'\n');
    console.log('CHICAGO R9 MULTICAR REPLAY '+JSON.stringify({
      city:result.city,missions:result.missions,
      contacts:result.contacts,impacts:result.impacts,
      reports:result.reports?.map(r=>({
       name:r.name,start:r.start,finish:r.finish,
       maxZ:r.maxZ,minZ:r.minZ,maxX:r.maxX,minX:r.minX,
       wet:r.wet,blocked:r.blocked,maxStop:r.maxStop,phases:r.phases
      }))
    }));
    assert.equal(result.error,undefined,JSON.stringify(result));
    assert.equal(result.city,'chicago');
    assert.equal(result.missions,'story_tipoff');
    assert(result.northAccess&&result.southAccess);
    assert.equal(result.localNetwork?.flowsAvailable,3);
    assert.equal(result.localNetwork?.segmentsChecked,10);
    assert.equal(result.localNetwork?.all,true);
    assert.equal(result.localNetwork?.originalCertified,false);
    for(const report of result.reports){
       assert.equal(report.wet,0,report.name+' entrou na água');
       assert.equal(report.blocked,0,report.name+' atravessou obstáculo');
       assert.equal(report.submerged,0,report.name+' afundou no rio');
       assert(report.maxStop<200,report.name+' parou mais de 10s');
       assert(report.finish.damage<35,report.name+' recebeu dano excessivo');
    }
    assert(result.reports[1].maxX>-215,'Entregador não entrou na ilha');
    assert(result.reports[2].maxZ>302,'Caminhão norte não alcançou o deck');
    assert(result.reports[3].minZ<255,'Caminhão de volta não retornou');
    assert(result.contacts<10,'Congestionamento gerou colisões repetidas');
    assert.equal(errors.length,0,errors.join('\n'));
    await page.screenshot({
      path:path.join(output,'chicago-r9-concurrent-traffic.png')
    });
 }finally{
   await page.close();await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
