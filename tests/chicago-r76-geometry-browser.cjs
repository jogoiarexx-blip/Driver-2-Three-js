'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),
 fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1240,height:940}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto((process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/')+
   'chicago-geometry-r76.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('counter')?.textContent==='1 / 67',
   null,{timeout:30000});
  assert((await page.locator('#detail0').textContent()).includes('triângulo 26276'));
  assert((await page.locator('#detail1').textContent()).includes('triângulo 26271'));
  assert((await page.locator('#detail2').textContent()).includes('triângulo 26270'));
  await page.locator('#section').focus();
  await page.keyboard.press('End');
  assert.equal(await page.locator('#counter').textContent(),'67 / 67');
  await page.locator('#back').click();
  assert.equal(await page.locator('#counter').textContent(),'66 / 67');
  assert.equal(errors.length,0,errors.join('\n'));
  fs.mkdirSync('qa-artifacts/chicago-r76',{recursive:true});
  await page.screenshot({path:'qa-artifacts/chicago-r76/geometry-viewer.png',fullPage:true,
   timeout:30000});
  console.log('CHICAGO_R76_BROWSER '+JSON.stringify({
   originalTrianglesVisible:true,firstTriangleIDs:[26276,26271,26270],
   sections:67,reverseNavigation:true,jsErrors:0,certifiedRoad:false
  }));
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
