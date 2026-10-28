/**
 * Smoke no Chromium real: visualizador da Chicago PS1 usa a pasta chicago/
 * da raiz e realmente carrega ao menos uma malha GLB sem alterar o jogo.
 */
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(process.cwd(),'qa-artifacts');
fs.mkdirSync(dir,{recursive:true});
const url=(process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/').replace(/\/?$/,'/')+
    'chicago-original-preview.html';
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
    '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
    '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1280,height:760}});
 const paths=[],errors=[];
 page.on('request',r=>{
    if(r.url().includes('/chicago/'))paths.push(new URL(r.url()).pathname);
 });
 page.on('pageerror',e=>errors.push(String(e)));
 try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>{
        const s=document.querySelector('#status')?.textContent||'';
        return /Setores carregados:\s*[1-9]/.test(s)||
            /Falha|Não foi possível|Three.js não carregou/.test(s);
    },null,{timeout:120000});
    const status=await page.locator('#status').textContent();
    assert.match(status,/Setores carregados:\s*[1-9]/,
        'Nenhum GLB original carregado: '+status);
    assert(paths.some(p=>p.endsWith('/chicago/manifest.json')),
        'Manifest foi buscado fora da pasta /chicago/');
    assert(paths.some(p=>p.endsWith('/chicago/chicago_atlas.webp')),
        'Atlas não foi requisitado da raiz');
    assert(paths.some(p=>/\/chicago\/chunks\/\d+_\d+\.glb$/.test(p)),
        'Nenhum GLB foi requisitado da raiz');
    assert(paths.every(p=>!p.includes('/assets/chicago/')));
    assert.equal(errors.length,0,'Erros JS: '+errors.join('\n'));
    await page.screenshot({
        path:path.join(dir,'chicago-original-root-preview.png'),fullPage:true
    });
    console.log(JSON.stringify({status,manifest:true,atlas:true,
        chunks:paths.filter(x=>x.endsWith('.glb')).length,
        errors:errors.length},null,2));
 } finally {
    await page.close();await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
