'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),
    fs=require('node:fs'),path=require('node:path');
const out=path.resolve('qa-artifacts/chicago-r29');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1280,height:760}});
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',r=>{
  if(/reference-recovery-r29\.json|reference-network\.json/.test(r.url()))
   requests.push(new URL(r.url()).pathname);
 });
 try{
  const root=(process.env.DRIVER_QA_URL||
    'http://127.0.0.1:4173/').replace(/\/?$/,'/');
  await page.goto(root+'chicago-original-preview.html',
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>/Setores carregados:\s*[1-9]/.test(
   document.querySelector('#status')?.textContent||''),null,{timeout:120000});
  await page.locator('#top').click();
  await page.locator('#recover29').click();
  await page.waitForFunction(()=>{
   const txt=document.querySelector('#recover29-audit')?.textContent||'';
   return txt.includes('candidatas no total')||
     txt.includes('Falha na auditoria R29');
  },null,{timeout:120000});
  const report=await page.locator('#recover29-audit').textContent();
  assert.match(report,/216 arestas anteriores/);
  assert.match(report,/47 recuperadas com altura local/);
  assert.match(report,/263 candidatas no total/);
  assert.match(report,/Nenhuma rua ou ponte certificada/);
  assert(requests.some(p=>p.endsWith('/chicago/reference-recovery-r29.json')));
  assert(requests.some(p=>p.endsWith('/chicago/reference-network.json')));
  assert.match(await page.locator('#recover29').textContent(),
    /Ocultar recuperação R29/);
  await page.screenshot({path:path.join(out,'ps1-r29-recovered-pavement.png')});
  await page.locator('#recover29').click();
  assert.match(await page.locator('#recover29').textContent(),
    /Ver recuperação R29/);
  await page.locator('#recover29').click();
  assert.match(await page.locator('#recover29').textContent(),
    /Ocultar recuperação R29/);
  assert.deepEqual(errors,[]);
  const result={originalLoaded:true,baseline:216,added:47,candidates:263,
    toggle:true,noTrafficChanges:true,errors};
  fs.writeFileSync(path.join(out,'browser-r29.json'),
    JSON.stringify(result,null,2)+'\n');
  console.log('CHICAGO_R29_BROWSER '+JSON.stringify(result));
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
