'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage'
 ]});
 const page=await browser.newPage({viewport:{width:1120,height:850}});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto((process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/')+
   'chicago-seam-r75.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#progress')?.textContent==='1 / 67',
    null,{timeout:30000});
  const first=await page.locator('#coord0').textContent();
  const next=await page.locator('#coord1').textContent();
  assert(first.includes('RGB 96,96,88'),first);
  assert(next.includes('RGB 72,64,64'),next);
  await page.locator('#sectionSlider').fill('66');
  assert.equal(await page.locator('#progress').textContent(),'67 / 67');
  await page.locator('#prev').click();
  assert.equal(await page.locator('#progress').textContent(),'66 / 67');
  assert.equal(errors.length,0,errors.join('\n'));
  fs.mkdirSync('qa-artifacts/chicago-r75',{recursive:true});
  await page.screenshot({path:'qa-artifacts/chicago-r75/atlas-browser.png',
    fullPage:true,timeout:30000});
  console.log('CHICAGO_R75_BROWSER '+JSON.stringify({
   sourceAtlasVisible:true,firstRGB:'96,96,88',neighborRGB:'72,64,64',
   switchSections:true,returnedTo:66,jsErrors:0,wholeRoadCertified:false
  }));
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
