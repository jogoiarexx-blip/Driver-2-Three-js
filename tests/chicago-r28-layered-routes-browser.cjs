'use strict';
/** R28 live Chromium test: inspect PS1 original-model candidate routes; never traffic. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),
    fs=require('node:fs'),path=require('node:path');
const output=path.resolve('qa-artifacts/chicago-r28');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1280,height:760}});
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',r=>{
  if(/reference-layered-r28\.json|reference-network\.json/.test(r.url()))
    requests.push(new URL(r.url()).pathname);
 });
 try{
  const root=(process.env.DRIVER_QA_URL||
    'http://127.0.0.1:4173/').replace(/\/?$/,'/');
  await page.goto(root+'chicago-original-preview.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>/Setores carregados:\s*[1-9]/.test(
    document.querySelector('#status')?.textContent||''),null,
    {timeout:120000});
  await page.locator('#top').click();
  await page.locator('#routes28').click();
  await page.waitForFunction(()=>{
    const s=document.querySelector('#routes28-audit')?.textContent||'';
    return s.includes('216 segmentos')||
      s.includes('Falha ao abrir rotas R28');
  },null,{timeout:120000});
  const status=await page.locator('#routes28-audit').textContent();
  assert.match(status,/216 segmentos com evidência de pavimento e nível/);
  assert.match(status,/exemplo amarelo conecta 2 arestas/);
  assert.match(status,/sem trânsito ou faixas certificadas/);
  const button=await page.locator('#routes28').textContent();
  assert.match(button,/Ocultar rotas R28/);
  assert(requests.some(p=>p.endsWith('/chicago/reference-layered-r28.json')));
  assert(requests.some(p=>p.endsWith('/chicago/reference-network.json')));
  await page.screenshot({
    path:path.join(output,'chicago-r28-candidate-routes.png')
  });
  await page.locator('#routes28').click();
  assert.match(await page.locator('#routes28').textContent(),
    /Ver rotas por nível R28/);
  await page.locator('#routes28').click();
  assert.match(await page.locator('#routes28').textContent(),
    /Ocultar rotas R28/);
  assert.deepEqual(errors,[]);
  const report={loadedGLBs:true,candidateEdges:216,
    samplePathEdges:2,liveTrafficModified:false,
    uiToggle:true,pageErrors:errors};
  fs.writeFileSync(path.join(output,'browser-r28.json'),
    JSON.stringify(report,null,2)+'\n');
  console.log('CHICAGO_R28_BROWSER '+JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
