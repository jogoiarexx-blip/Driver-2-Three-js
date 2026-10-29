'use strict';
/**
 * R11: 60 s, quatro caminhões simultâneos, sinalização e colisão reais.
 * Não teletransporta, não troca waypoints, não altera a física do player.
 * Verifica se a desaceleração antecipada atua nas curvas de Goose Island.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const output=path.join(process.cwd(),'qa-artifacts');
fs.mkdirSync(output,{recursive:true});
const base=(process.env.DRIVER_QA_URL||
    'http://127.0.0.1:4173/').replace(/\/?$/,'/');
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
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
    assert(await page.evaluate(()=>window.DriverBoot.start('ride')));
    await page.waitForFunction(()=>window.DriverGame?.city?.ready&&
        window.DriverGame?.playerCar&&window.DriverBoot.sessionReady);
    const result=await page.evaluate(()=>{
        const g=window.DriverGame,c=g.city;
        g.isPaused=true;
        const names=['FURGÃO GOOSE ISLAND','ENTREGAS GOOSE ISLAND',
            'CARGA NORTE GOOSE ISLAND','RETORNO SUL GOOSE ISLAND'];
        const cars=names.map(name=>g.vehicles.find(v=>v.name===name));
        if(cars.some(x=>!x))return {
            error:'Caminhões ausentes',available:g.vehicles.map(v=>v.name)};
        const effects={addSkidMark(){},spawnTireSmoke(){},
            spawnWaterSplash(){},spawnCarBreakaway(){},
            spawnImpactSparks(){},ejectHubcap(){}};
        const clock=c.signalClock;
        c.signalClock=0;
        g.trafficAI.reset();
        g.collisionSystem.reset();
        const records=cars.map(car=>({
            name:car.name,start:{x:car.x,z:car.z},
            minZ:car.z,maxZ:car.z,maxX:car.x,
            wet:0,blocked:0,submerged:0,maxStale:0,stale:0,
            turnFrames:0,turnReasons:{},maxDamage:0,
            minLimit:Infinity
        }));
        let contacts=0;
        try{
            for(let i=0;i<1200;i++){
                c.signalClock=i*.05;
                for(let j=0;j<cars.length;j++){
                    const car=cars[j],rec=records[j];
                    const x=car.x,z=car.z;
                    const control=g.trafficAI.getInput(
                        car,.05,cars,null,0);
                    const route=g.trafficAI.getRoute(car);
                    if(route.localTurnAssist){
                        rec.turnFrames++;
                        rec.turnReasons[route.localTurnAssist]=
                            (rec.turnReasons[route.localTurnAssist]||0)+1;
                        rec.minLimit=Math.min(rec.minLimit,
                            route.localTurnSpeed);
                    }
                    car.updatePhysics(.05,control,c,effects,null,false);
                    rec.minZ=Math.min(rec.minZ,car.z);
                    rec.maxZ=Math.max(rec.maxZ,car.z);
                    rec.maxX=Math.max(rec.maxX,car.x);
                    if(c.isWaterAt(car.x,car.z))rec.wet++;
                    if(c.isPointBlocked(car.x,car.z,1.55,car.y))
                        rec.blocked++;
                    if(car.isSubmerged)rec.submerged++;
                    const moved=Math.hypot(car.x-x,car.z-z);
                    if(moved<.005&&Math.abs(car.speed)<1.5)rec.stale++;
                    else rec.stale=0;
                    rec.maxStale=Math.max(rec.maxStale,rec.stale);
                    rec.maxDamage=Math.max(rec.maxDamage,car.damage);
                }
                contacts+=g.collisionSystem.step(
                    cars,null,c,i*50,undefined);
            }
        }finally{c.signalClock=clock;}
        const report={city:g.currentCityKey,
            mission:c.missionStart?.type,
            signalsReal:true,contacts,
            roadGraph:c.roadAudit?.largestComponent,
            records:records.map(r=>({
                ...r,stale:undefined,minLimit:
                    Number.isFinite(r.minLimit)?r.minLimit:null
            }))
        };
        g.camera.position.set(-95,140,310);
        g.camera.lookAt(-200,0,235);
        g.renderer.render(g.scene,g.camera);
        return report;
    });
    fs.writeFileSync(path.join(output,'chicago-r11-turn-replay.json'),
        JSON.stringify(result,null,2)+'\n');
    console.log('CHICAGO R11 PHYSICS '+JSON.stringify(result));
    assert.equal(result.error,undefined,JSON.stringify(result));
    assert.equal(result.city,'chicago');
    assert.equal(result.mission,'story_tipoff');
    assert(result.roadGraph>=55);
    assert.equal(result.records.length,4);
    assert(result.records.reduce((sum,r)=>sum+r.turnFrames,0)>12,
        'O controlador R11 não atuou nas curvas');
    for(const r of result.records){
        assert.equal(r.wet,0,r.name+' entrou na água');
        assert.equal(r.blocked,0,r.name+' atravessou prédio');
        assert.equal(r.submerged,0,r.name+' afundou');
        assert(r.maxDamage<35,r.name+' recebeu dano excessivo');
        assert(r.maxStale<400,r.name+' ficou parado mais de 20 segundos');
    }
    assert(result.records[1].maxX>-215,'Entregas não chegou à ilha');
    assert(result.records[2].maxZ>302,'Carga norte não atravessou ponte');
    assert(result.records[3].minZ<255,'Retorno sul não completou descida');
    assert(result.contacts<10,'Colisões repetidas entre caminhões');
    assert.deepEqual(errors,[]);
    await page.screenshot({
        path:path.join(output,'chicago-r11-turn-replay.png')
    });
 }finally{await page.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
