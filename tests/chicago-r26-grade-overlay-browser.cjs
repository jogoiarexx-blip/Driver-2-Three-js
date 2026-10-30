'use strict';
const {chromium}=require('playwright'),
    fs=require('node:fs'),path=require('node:path'),
    assert=require('node:assert/strict');
const out=path.resolve('qa-artifacts/chicago-r26');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1280,height:760}});
 page.setDefaultTimeout(120000);
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',r=>{
   if(/reference-grade-r26\.json|reference-network\.json/.test(r.url()))
     requests.push(new URL(r.url()).pathname);
 });
 try{
  const base=(process.env.DRIVER_QA_URL||
    'http://127.0.0.1:4173/').replace(/\/?$/,'/');
  await page.goto(base+'chicago-original-preview.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>/Setores carregados:\s*[1-9]/.test(
    document.querySelector('#status')?.textContent||''),null,
    {timeout:120000});
  await page.locator('#top').click();
  await page.locator('#grades').click();
  await page.waitForFunction(()=>{
    const label=document.querySelector('#grade-audit')?.textContent||'';
    return /conexões em vermelho/.test(label)||
      /Não foi possível consultar/.test(label);
  },null,{timeout:120000});
  const grade=await page.locator('#grade-audit').textContent();
  assert.match(grade,/55 conexões em vermelho e 15 nós em laranja/);
  assert.match(grade,/218 conexões atendem simultaneamente/);
  assert.match(grade,/não certifica viadutos nem cruzamentos/);
  assert.match(await page.locator('#grades').textContent(),/Ocultar conflitos/);
  assert(requests.some(p=>p.endsWith('/chicago/reference-grade-r26.json')));
  assert(requests.some(p=>p.endsWith('/chicago/reference-network.json')));
  await page.screenshot({
    path:path.join(out,'chicago-r26-original-crossing-conflicts.png')
  });
  await page.locator('#grades').click();
  assert.match(await page.locator('#grades').textContent(),/Mostrar conflitos/);
  await page.locator('#grades').click();
  assert.match(await page.locator('#grades').textContent(),/Ocultar conflitos/);
  assert.deepEqual(errors,[]);
  const result={glbLoaded:true,conflictEdges:55,stackedNodes:15,
    gradeAndPavingCandidates:218,toggleWorking:true,errors};
  fs.writeFileSync(path.join(out,'browser-grade-overlay.json'),
    JSON.stringify(result,null,2)+'\n');
  console.log('CHICAGO_R26_GRADE_OVERLAY_BROWSER '+JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
