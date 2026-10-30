'use strict';
const assert=require('node:assert/strict'),
      {chromium}=require('playwright'),
      fs=require('node:fs'),path=require('node:path');
const dir=path.join(process.cwd(),'qa-artifacts/chicago-r24');
fs.mkdirSync(dir,{recursive:true});
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
  if(/reference-network\.json|reference-street-survey\.json/.test(r.url()))
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
  await page.locator('#roads').click();
  await page.waitForFunction(()=>{
    const text=document.querySelector('#road-audit')?.textContent||'';
    return text.includes('Evidência de pavimento')||
      text.includes('Não foi possível analisar');
  },null,{timeout:120000});
  const audit=await page.locator('#road-audit').textContent();
  assert.match(audit,/Evidência de pavimento em 4\.279 conexões/);
  const match=audit.match(/forte (\d+) • intermediária (\d+) • revisar (\d+) • descartar (\d+)/);
  assert(match,'Números das classes R24 ausentes: '+audit);
  const counts=match.slice(1).map(Number);
  assert.equal(counts.reduce((a,b)=>a+b,0),4279);
  assert(counts[0]>0,'Nenhum candidato de pavimento forte');
  assert(counts[2]>0,'Nenhuma superfície incerta para revisão');
  assert.match(audit,/NÃO certifica rua/);
  assert(requests.some(p=>p.endsWith('/chicago/reference-network.json')));
  assert(requests.some(p=>p.endsWith('/chicago/reference-street-survey.json')));
  await page.screenshot({path:path.join(dir,'ps1-road-evidence-overlay.png')});
  assert.match(await page.locator('#roads').textContent(),/Ocultar vias/);
  await page.locator('#roads').click();
  assert.match(await page.locator('#roads').textContent(),/Mostrar vias/);
  assert.deepEqual(errors,[]);
  const report={counts,edges:4279,showHide:true,
    sourceGraph:true,sourceMasks:true,errors};
  fs.writeFileSync(path.join(dir,'browser-overlay.json'),
    JSON.stringify(report,null,2)+'\n');
  console.log('CHICAGO_R24_OVERLAY_BROWSER '+JSON.stringify(report));
 }finally{await page.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
