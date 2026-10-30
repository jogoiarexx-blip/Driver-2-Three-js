'use strict';
/** R27 Chromium: show source-height alert categories over actual original GLBs. */
const {chromium}=require('playwright'),
  assert=require('node:assert/strict'),
  fs=require('node:fs'),path=require('node:path');
const output=path.resolve('qa-artifacts/chicago-r27');
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
  if(/reference-grade-r27\.json|reference-network\.json/.test(r.url()))
   requests.push(new URL(r.url()).pathname);
 });
 try{
  const url=(process.env.DRIVER_QA_URL||
    'http://127.0.0.1:4173/').replace(/\/?$/,'/')+
    'chicago-original-preview.html';
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>/Setores carregados:\s*[1-9]/.test(
    document.querySelector('#status')?.textContent||''),null,
    {timeout:120000});
  await page.locator('#top').click();
  await page.locator('#review27').click();
  await page.waitForFunction(()=>{
    const txt=document.querySelector('#review27-audit')?.textContent||'';
    return txt.includes('sobreposições locais')||
      txt.includes('Falha ao abrir análise R27');
  },null,{timeout:120000});
  const content=await page.locator('#review27-audit').textContent();
  assert.match(content,/50 sobreposições locais/);
  assert.match(content,/5 alertas somente no nó/);
  assert.match(content,/0 separações persistentes/);
  assert.match(content,/Nenhum viaduto ou cruzamento certificado/);
  const lines=await page.evaluate(()=>{
    const root=document.querySelector('canvas');
    if(!root)return {present:false};
    const status=document.querySelector('#review27').textContent;
    return {present:!!root,status};
  });
  assert(lines.present);
  assert.match(lines.status,/Ocultar revisão R27/);
  assert(requests.some(p=>p.endsWith('chicago/reference-grade-r27.json')));
  assert(requests.some(p=>p.endsWith('chicago/reference-network.json')));
  await page.screenshot({path:path.join(output,
    'chicago-r27-original-height-cases.png')});
  await page.locator('#review27').click();
  assert.match(await page.locator('#review27').textContent(),
    /Revisar alertas R27/);
  await page.locator('#review27').click();
  assert.match(await page.locator('#review27').textContent(),
    /Ocultar revisão R27/);
  assert.deepEqual(errors,[]);
  const report={loadedOriginalGlbs:true,localOverlap:50,
    nodeOnly:5,sustained:0,overpassesCertified:0,
    showHide:true,errors};
  fs.writeFileSync(path.join(output,'browser-r27-overlay.json'),
    JSON.stringify(report,null,2)+'\n');
  console.log('CHICAGO_R27_BROWSER '+JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
