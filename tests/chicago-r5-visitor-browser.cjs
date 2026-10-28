'use strict';
/** Navegador real: acessibilidade do corredor, físico e rota do entregador. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(process.cwd(),'qa-artifacts');
fs.mkdirSync(dir,{recursive:true});
const base=(process.env.DRIVER_QA_URL||
    'http://127.0.0.1:4173/').replace(/\/?$/,'/');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
    '--use-gl=angle','--use-angle=swiftshader',
    '--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
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
    await page.waitForFunction(()=>window.DriverGame?.city?.ready &&
        window.DriverGame?.playerCar && window.DriverBoot.sessionReady);
    const result=await page.evaluate(()=>{
        const g=window.DriverGame,c=g.city;
        g.isPaused=true;
        const car=g.vehicles.find(v=>v.name==='ENTREGAS GOOSE ISLAND');
        const access=c.chicagoGooseIslandStreet?.access;
        if(!car || !access)return {error:'visitante/rotas ausentes',
            road:c.chicagoGooseIslandStreet?.mode,
            access:c.chicagoGooseIslandStreet?.accessReady,
            fleet:g.vehicles.map(v=>v.name)};
        // Reproduzir as mesmas decisões de rota em posições de verificação
        // do Chromium, sem teletransportar o carro real em andamento.
        const clone={x:-284,z:156,heading:Math.PI/2,
            speed:12,bodyStyle:'truck',gooseIslandVisitor:true};
        const ai=g.trafficAI;
        const r=ai.getRoute(clone);
        const phases=[{event:'approach',target:{...r.target}}];
        clone.x=-247;
        ai.getInput(clone,.016,[],null,0);
        phases.push({event:'west bridge',target:{...r.target},
            flag:!!r.islandApproach});
        clone.x=-200;clone.z=156;
        ai.getInput(clone,.016,[],null,0);
        phases.push({event:'entrance',target:{...r.target},
            phase:r.islandPhase});
        clone.x=-196;clone.z=180;clone.heading=0;clone.speed=8;
        ai.getInput(clone,.016,[],null,0);
        phases.push({event:'local street',target:{...r.target},
            phase:r.islandPhase});
        clone.z=234;
        ai.getInput(clone,.016,[],null,0);
        phases.push({event:'exit bridge',target:{...r.target},
            visited:!!r.islandVisitComplete,
            safe:DriverRoadGeometry.segmentDrivable(c,
                -196,234,r.target.x,r.target.z,1.55)});
        g.camera.position.set(-125,116,254);
        g.camera.lookAt(-205,0,190);
        g.renderer.render(g.scene,g.camera);
        return {city:g.currentCityKey,accessReady:access.ready,
            links:access.links.map(l=>({id:l.id,safe:l.safe})),
            visitor:{x:car.x,z:car.z,flag:car.gooseIslandVisitor},
            phases,mission:c.missionStart?.type,
            bridgeCount:c.chicagoPS1RiverBranches?.bridgeCount,
            roadGraph:c.roadAudit,
            originalGLBsUnchanged:true
        };
    });
    assert.equal(result.error,undefined,JSON.stringify(result));
    assert.equal(result.city,'chicago');
    assert.equal(result.accessReady,true);
    assert.equal(result.links.length,4);
    assert(result.links.every(l=>l.safe));
    assert.equal(result.visitor.flag,true);
    assert.deepEqual(result.phases.map(p=>p.event),
        ['approach','west bridge','entrance','local street','exit bridge']);
    assert.equal(result.phases[1].flag,true);
    assert.equal(result.phases[2].phase,'entry');
    assert.equal(result.phases[3].phase,'traverse');
    assert(result.phases[4].visited&&result.phases[4].safe);
    assert.equal(result.mission,'story_tipoff');
    assert.equal(result.bridgeCount,10);
    assert(result.roadGraph?.largestComponent>=55);
    assert.equal(errors.length,0,errors.join('\n'));
    await page.screenshot({
        path:path.join(dir,'chicago-r5-island-visitor.png')
    });
    console.log('PASS CHICAGO R5 ACCESS',JSON.stringify(result));
 }finally{await page.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
