'use strict';
/* Certifica Undercover no navegador após primeira mudança geográfica. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const base=process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/';
const dir=path.join(process.cwd(),'qa-artifacts');fs.mkdirSync(dir,{recursive:true});
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
    assert(await page.evaluate(()=>window.DriverBoot.start('story')));
    await page.waitForFunction(()=>window.DriverGame?.city?.ready &&
        window.DriverBoot.sessionReady && window.DriverGame.playerCar);
    const r=await page.evaluate(()=>{
        const g=window.DriverGame,c=g.city;
        return {preset:g.currentCityKey,
            geography:!!c.chicagoPS1Coastline,
            lake:c.isWaterAt(400,-140),lastAvenue:c.isWaterAt(320,-140),
            pier:c.isWaterAt(379,-40),river:c.isWaterAt(160,50),
            bridge:c.isWaterAt(0,50),
            missions:c.missionStart?.type,
            buildings:c.buildingBoxes.length,
            player:{x:g.playerCar.x,z:g.playerCar.z},
            carOnDryLand:!c.isWaterAt(g.playerCar.x,g.playerCar.z),
            cityPlan:c.chicagoCityPlan&&{
                blocks:c.chicagoCityPlan.blocks.length,lots:c.chicagoCityPlan.lots,
                links:c.chicagoCityPlan.courtyardLinks?.length,
                districts:DriverChicagoNeighborhoods.DISTRICTS.length,
                exactCollision:c.districtBuildings.filter(b=>b.planned).every(b=>
                    c.buildingBoxes.some(a=>a.chicagoPlanLot&&
                        Math.abs(a.minX-(b.x-b.width/2))<.001&&
                        Math.abs(a.maxX-(b.x+b.width/2))<.001&&
                        Math.abs(a.minZ-(b.z-b.depth/2))<.001&&
                        Math.abs(a.maxZ-(b.z+b.depth/2))<.001)),
                linksSafe:c.chicagoCityPlan.courtyardLinks?.every(l=>
                    DriverRoadGeometry.segmentDrivable(c,l.from.x,l.from.z,l.to.x,l.to.z,1.7)),
                lotCentersSolid:c.districtBuildings.filter(b=>b.planned).every(b=>
                    c.isPointBlocked(b.x,b.z,0,0)),
                airfield:!!c.chicagoAirfield,
                runwayDry:c.chicagoAirfield&&!c.isWaterAt(c.chicagoAirfield.x,c.chicagoAirfield.z)
            },
            lakeMesh:c.cityGroup.children.some(o=>o.name==='chicago-ps1-lake-michigan')};
    });
    assert(r.cityPlan,'Undercover sem plano integral');
    assert(r.cityPlan.blocks>35&&r.cityPlan.lots>80,JSON.stringify(r.cityPlan));
    assert.equal(r.cityPlan.districts,13);
    assert(r.cityPlan.exactCollision&&r.cityPlan.lotCentersSolid);
    assert(r.cityPlan.links>8&&r.cityPlan.linksSafe,JSON.stringify(r.cityPlan));
    assert(r.cityPlan.airfield&&r.cityPlan.runwayDry);
    assert.equal(r.preset,'chicago');assert(r.geography&&r.lakeMesh);
    assert(r.lake,'Lago não está posicionado a leste de Chicago');
    assert.equal(r.lastAvenue,false,'Lago submergiu a última avenida');
    assert.equal(r.pier,false,'Lago bloqueou o Navy Pier');
    assert.equal(r.river,true,'Canal central foi removido');
    assert.equal(r.bridge,false,'Ponte central está submersa');
    assert.equal(r.missions,'story_tipoff','Undercover perdeu marcador');
    assert(r.buildings>30,'Prédios e colisores procedurais desapareceram');
    assert.equal(r.carOnDryLand,true);
    assert.equal(errors.length,0,errors.join('\n'));
    await page.evaluate(()=>{
        const g=window.DriverGame;g.isPaused=true;
        g.camera.position.set(455,115,-120);
        g.camera.lookAt(325,0,-120);
        g.camera.updateProjectionMatrix();g.renderer.render(g.scene,g.camera);
    });
    await page.screenshot({path:path.join(dir,'chicago-ps1-undercover-lake-r1.png')});
    await page.evaluate(()=>{
        const g=window.DriverGame;g.camera.position.set(30,620,-90);
        g.camera.lookAt(0,0,-20);g.camera.updateProjectionMatrix();
        g.renderer.render(g.scene,g.camera);
    });
    await page.screenshot({path:path.join(dir,'chicago-r14-whole-city-plan.png')});
    console.log('PASS CHICAGO PS1 UNDERCOVER R14',JSON.stringify(r));
 } finally{await page.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
