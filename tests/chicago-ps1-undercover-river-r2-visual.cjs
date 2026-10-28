'use strict';
/* Certifica Undercover R2 com Goose Island e travessias físicas. */
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
            lakeMesh:c.cityGroup.children.some(o=>o.name==='chicago-ps1-lake-michigan'),
            branches:c.chicagoPS1RiverBranches?.bridgeCount,
            riverBranchesRendered:c.cityGroup.children.some(o=>o.name==='chicago-ps1-branches-r2-water'),
            northBranchWater:c.isWaterAt(-240,120),
            southBranchWater:c.isWaterAt(-240,-120),
            islandEastWater:c.isWaterAt(-160,190),
            islandLandDry:!c.isWaterAt(-200,190),
            westBridgeDry:!c.isWaterAt(-240,160),
            eastBridgeDry:!c.isWaterAt(-160,160),
            crossRoad:DriverRoadGeometry.segmentDrivable(c,-270,164,-210,164),
            forbiddenRiverRoad:DriverRoadGeometry.segmentDrivable(c,-240,110,-240,145),
            roadAudit:c.roadAudit};

    });
    assert.equal(r.preset,'chicago');assert(r.geography&&r.lakeMesh);
    assert.equal(r.branches,10,'Não construiu as dez travessias');
    assert(r.riverBranchesRendered,'Água dos braços não desenhada');
    assert(r.northBranchWater&&r.southBranchWater&&r.islandEastWater);
    assert(r.islandLandDry,'Goose Island ficou submersa');
    assert(r.westBridgeDry&&r.eastBridgeDry,'Ponte PS1 está submersa');
    assert(r.crossRoad,'IA perdeu a ponte do canal oeste');
    assert.equal(r.forbiddenRiverRoad,false,'IA dirige sobre o canal');
    assert(r.roadAudit?.largestComponent>=55,'Malha viária desconectada');

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
        g.camera.position.set(-70,165,260);
        g.camera.lookAt(-200,0,150);
        g.camera.updateProjectionMatrix();g.renderer.render(g.scene,g.camera);
    });
    await page.screenshot({path:path.join(dir,'chicago-ps1-undercover-river-r2.png')});
    console.log('PASS CHICAGO PS1 UNDERCOVER R2',JSON.stringify(r));
 } finally{await page.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
