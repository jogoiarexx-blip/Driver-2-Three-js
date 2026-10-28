'use strict';
/** Browser real: dirigir sobre Chicago extraída do PS1 com física do clone. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=(process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/').replace(/\/?$/,'/');
const dir=path.join(process.cwd(),'qa-artifacts');
fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
    '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
    '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1152,height:720}});
 page.setDefaultTimeout(120000);
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',r=>{
    if(r.url().includes('/chicago/'))requests.push(r.url());
 });
 try{
    await page.goto(base+'chicago-original-drive.html',{
        waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>{
        const state=window.DriverChicagoOriginalRide;
        const status=document.querySelector('#chicago-ride-status')?.textContent||'';
        return state?.started || status.includes('Falha');
    },null,{timeout:120000});
    const starting=await page.evaluate(()=>{
        const g=window.DriverChicagoOriginalRide;
        return g?{started:g.started,x:g.car.x,z:g.car.z,
            permitted:g.world.permitted(g.car.x,g.car.z),
            tiles:g.stream.manifest.tiles.length}:
            {error:document.querySelector('#chicago-ride-status')?.textContent};
    });
    assert.equal(starting.started,true,JSON.stringify(starting));
    assert.equal(starting.permitted,true);
    assert.equal(starting.tiles,54);
    await page.waitForFunction(
        ()=>window.DriverChicagoOriginalRide?.stats?.tilesLoaded>=1,
        null,{timeout:120000});
    await page.keyboard.down('w');
    await page.waitForTimeout(1200);
    await page.keyboard.up('w');
    const after=await page.evaluate(()=>{
        const g=window.DriverChicagoOriginalRide;
        return {x:g.car.x,z:g.car.z,worldBlocked:g.world.isPointBlocked(g.car.x,g.car.z),
            speed:g.car.speed,tiles:g.stats?.tilesLoaded||0,
            physicsCalled:!!g.car.surfaceSlope};
    });
    assert(Math.hypot(after.x-starting.x,after.z-starting.z)>0.6,
        'Carro não andou sobre a geometria original: '+JSON.stringify(after));
    assert.equal(after.worldBlocked,false,
        'Carro entrou em área sem piso certificado pela máscara');
    assert(after.tiles>=1,'Setores GLB não renderizaram');
    await page.keyboard.press('r');
    await page.waitForTimeout(90);
    const reset=await page.evaluate(()=>{
        const g=window.DriverChicagoOriginalRide;
        return {x:g.car.x,z:g.car.z,speed:g.car.speed};
    });
    assert(Math.hypot(reset.x-starting.x,reset.z-starting.z)<0.02,
        'Reset não devolveu o carro ao spawn seguro');
    assert(Math.abs(reset.speed)<0.1);
    assert(requests.some(x=>x.endsWith('/chicago/drive-mask.json')));
    assert(requests.some(x=>x.endsWith('/chicago/manifest.json')));
    assert(requests.some(x=>/\/chicago\/chunks\/\d+_\d+\.glb$/.test(x)));
    assert.equal(errors.length,0,errors.join('\n'));
    await page.screenshot({path:path.join(dir,'chicago-original-free-ride.png')});
    console.log('CHICAGO PS1 PASSEIO DIRIGÍVEL',JSON.stringify({
        start:starting,end:after,reset:reset,jsErrors:errors.length},null,2));
 }finally{
    await page.close();await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
