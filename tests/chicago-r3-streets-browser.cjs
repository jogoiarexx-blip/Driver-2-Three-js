'use strict';
/** Browser real: R3 para não mostrar rua, faixa ou zebra sobre água. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=(process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/').replace(/\/?$/,'/');
const out=path.join(process.cwd(),'qa-artifacts');
fs.mkdirSync(out,{recursive:true});
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
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
    assert(await page.evaluate(()=>window.DriverBoot.start('story')));
    await page.waitForFunction(
        ()=>window.DriverGame?.city?.ready&&window.DriverBoot?.sessionReady);
    const result=await page.evaluate(()=>{
        const g=window.DriverGame,c=g.city;
        const matrix=new THREE.Matrix4();
        const inspect=(pattern)=>{
            const meshes=[];
            c.cityGroup.traverse(o=>{
                if(o.isInstancedMesh&&pattern.test(o.name||''))meshes.push(o);
            });
            const data={meshes:meshes.length,instances:0,wet:0,examples:[]};
            for(const mesh of meshes)for(let i=0;i<mesh.count;i++){
                mesh.getMatrixAt(i,matrix);
                const x=matrix.elements[12],z=matrix.elements[14];
                data.instances++;
                if(c.isWaterAt(x,z)){
                    data.wet++;
                    if(data.examples.length<8)
                        data.examples.push({name:mesh.name,x,z});
                }
            }
            return data;
        };
        return {
            city:g.currentCityKey,
            riverBranches:c.chicagoPS1RiverBranches?.bridgeCount,
            streetStats:c.roadSurfaceStats,
            asphalt:inspect(/^driver2-road-asphalt-/),
            markings:inspect(/^driver2-road-(yellow|white)$/),
            crosswalks:inspect(/^road-crosswalk-zebra$/),
            northCanalWater:c.isWaterAt(-240,125),
            bridgeDry:!c.isWaterAt(-240,160),
            safeMissionStart:!c.isWaterAt(-64,-144),
            roadNetwork:c.roadAudit
        };
    });
    assert.equal(result.city,'chicago');
    assert.equal(result.riverBranches,10);
    assert(result.northCanalWater&&result.bridgeDry&&result.safeMissionStart);
    assert(result.streetStats.removedWetTiles>=10,
        'A R3 não apagou nenhum asfalto submerso');
    for(const kind of ['asphalt','markings','crosswalks']){
        assert(result[kind].instances>20,'Sem geometria '+kind);
        assert.equal(result[kind].wet,0,JSON.stringify(result[kind].examples));
    }
    assert(result.roadNetwork?.largestComponent>=55);
    assert.deepEqual(errors,[]);
    await page.evaluate(()=>{
        const game=window.DriverGame;
        game.isPaused=true;
        game.camera.position.set(-65,145,240);
        game.camera.lookAt(-195,0,155);
        game.camera.updateProjectionMatrix();
        game.renderer.render(game.scene,game.camera);
    });
    await page.screenshot({
        path:path.join(out,'chicago-r3-goose-island-dry-roads.png')
    });
    console.log('CHICAGO R3 PASS',JSON.stringify(result));
 }finally{await page.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
