'use strict';
/**
 * R8: retorno de carga real cruzando a ponte ao sul de Goose Island.
 * Usa DriverVehicle.updatePhysics + DriverTrafficAI reais do Undercover,
 * com pedestres e veículos externos congelados para identificar se
 * o erro vem da geometria/volante e não de colisões aleatórias.
 * Não reposiciona nenhum carro durante o replay.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(process.cwd(),'qa-artifacts');
fs.mkdirSync(dir,{recursive:true});
const base=(process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/').replace(/\/?$/,'/');
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
        'driver2-menu-preferences-v1',JSON.stringify({
            models:false,scanlines:false,reducedMotion:true
        })));
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
    assert(await page.evaluate(()=>window.DriverBoot.start('ride')));
    await page.waitForFunction(
        ()=>window.DriverGame?.city?.ready&&window.DriverBoot?.sessionReady);
    const report=await page.evaluate(()=>{
        const game=window.DriverGame,city=game.city;
        game.isPaused=true;
        const effects={
            addSkidMark(){},spawnTireSmoke(){},spawnWaterSplash(){},
            spawnImpactSparks(){},spawnCarBreakaway(){},ejectHubcap(){}
        };
        city.isTrafficGreen=()=>true;
        const names=['RETORNO SUL GOOSE ISLAND'];
        const result={roads:{
            south:city.chicagoGooseIslandStreet?.accessReady,
            north:city.chicagoGooseIslandNorthYard?.accessReady,
            bridgeCount:city.chicagoPS1RiverBranches?.bridgeCount
        },vehicles:{}};
        for(const name of names){
            const car=game.vehicles.find(x=>x.name===name);
            if(!car){result.vehicles[name]={error:'veículo não encontrado'};continue;}
            const ai=game.trafficAI;
            ai.reset();
            const start={x:car.x,z:car.z,heading:car.heading};
            const samples=[],history=[];
            let maxZ=car.z,maxX=car.x,minZ=car.z,minX=car.x,
                wetFrames=0,blockedFrames=0;
            let reverseFrames=0,collisionFrames=0,lastPosition={x:car.x,z:car.z};
            let stale=0,maxStale=0;
            let phase=[];
            for(let i=0;i<1200;i++){
                const input=ai.getInput(car,0.05,[],null,0);
                const route=ai.getRoute(car);
                if(input.down)reverseFrames++;
                const before={x:car.x,z:car.z};
                const damage=car.damage;
                car.updatePhysics(0.05,input,city,effects,null,false);
                if(city.isWaterAt(car.x,car.z))wetFrames++;
                if(city.isPointBlocked(car.x,car.z,1.55))blockedFrames++;
                if(car.damage>damage)collisionFrames++;
                const distance=Math.hypot(car.x-before.x,car.z-before.z);
                if(distance<.005)stale++;else stale=0;
                maxStale=Math.max(maxStale,stale);
                maxZ=Math.max(maxZ,car.z);maxX=Math.max(maxX,car.x);
                minZ=Math.min(minZ,car.z);minX=Math.min(minX,car.x);
                if(i%30===0){
                    samples.push({
                        second:Math.round(i*.05*10)/10,
                        x:+car.x.toFixed(2),z:+car.z.toFixed(2),
                        speed:+car.speed.toFixed(2),heading:+car.heading.toFixed(3),
                        route:route.isIslandSpine?'island':
                            route.isNorthYard?'north':
                            route.islandApproach?'approach':
                            route.islandVisitComplete?'visited':'grid',
                        target:{...route.target},damage:+car.damage.toFixed(1),
                        submerged:!!car.isSubmerged
                    });
                }
                if(i%200===0)phase.push({x:car.x,z:car.z});
            }
            result.vehicles[name]={
                start,end:{x:car.x,z:car.z,heading:car.heading,speed:car.speed},
                maxZ,maxX,minZ,minX,wetFrames,blockedFrames,reverseFrames,
                collisionFrames,maxStale,damage:car.damage,
                samples
            };
        }
        return result;
    });
    fs.writeFileSync(path.join(dir,'chicago-r8-southbound-physical-replay.json'),
        JSON.stringify(report,null,2));
    console.log('CHICAGO R8 PHYSICS REPLAY '+JSON.stringify({
        roads:report.roads,
        vehicles:Object.fromEntries(Object.entries(report.vehicles).map(([k,v])=>
            [k,{start:v.start,end:v.end,maxZ:v.maxZ,maxX:v.maxX,minZ:v.minZ,minX:v.minX,
            wetFrames:v.wetFrames,blockedFrames:v.blockedFrames,
            reverseFrames:v.reverseFrames,collisionFrames:v.collisionFrames,
            maxStale:v.maxStale,damage:v.damage,
            samples:v.samples?.filter((x,i)=>i%4===0)}]))
    }));
    assert.equal(errors.length,0,errors.join('\n'));
    assert(report.roads.north && report.roads.south);
    for(const [name,v] of Object.entries(report.vehicles)){
        assert.equal(v.error,undefined,name+' '+v.error);
        assert.equal(v.blockedFrames,0,name+' collided with permanent AABB');
        assert.equal(v.wetFrames,0,name+' drove on water');
        assert.equal(v.collisionFrames,0,name+' sustained wall impact');
        assert(v.maxStale<150,name+' stopped >7.5s continuously');
        assert(v.damage<35,name+' gained too much damage');
    }
    assert(report.vehicles['RETORNO SUL GOOSE ISLAND'].minZ<255,
        'R8 southbound truck never crossed northern bridge');
    assert(report.vehicles['RETORNO SUL GOOSE ISLAND'].minX<-235,
        'R8 southbound truck never exited by the western bridge');
    await page.screenshot({
        path:path.join(dir,'chicago-r8-southbound-physical-replay.png')
    });
 }finally{await page.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
