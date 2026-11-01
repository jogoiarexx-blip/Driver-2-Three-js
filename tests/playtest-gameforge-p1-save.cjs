'use strict';
/**
 * R62 P1 evidence: real browser-origin localStorage migration and Vegas
 * mission save/reload. This is a controlled scripted test, NOT a campaign win.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const dir=path.resolve(process.cwd(),'qa-artifacts');
fs.mkdirSync(dir,{recursive:true});
const base=process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/';
const record={schema:'driver2-p1-save-evidence-v1',build:process.env.GITHUB_SHA||'local',
  status:'IN_PROGRESS',steps:[],browserErrors:[],screenshots:[],limitations:[
    'scripted regional mission startup/reload; no human mission completion',
    'SwiftShader CPU GL is not representative of Android/GPU',
    'checkpoint progress inside active C4 mission is not certified'
  ]};
let browser,page,stepName='boot';
async function step(name,fn){
  stepName=name;const start=Date.now();const observed=await fn();
  record.steps.push({name,elapsedMs:Date.now()-start,observed});
  console.log('P1_SAVE_STEP',name,JSON.stringify(observed));
}
async function screenshot(label){
  const filename='p1-save-'+label+'.png';
  await page.screenshot({path:path.join(dir,filename),timeout:120000});
  record.screenshots.push(filename);
}
async function boot(){
  await page.waitForFunction(()=>window.DriverBoot&&window.DriverGame===undefined,
    null,{timeout:45000}).catch(()=>{});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE,
    null,{timeout:60000});
  assert.equal(await page.evaluate(()=>window.DriverBoot.start('ride')),true);
  await page.waitForFunction(()=>window.DriverGame?.city?.ready &&
    window.DriverBoot?.sessionReady&&window.DriverGame?.playerCar,
    null,{timeout:150000});
}
(async()=>{
  try{
    browser=await chromium.launch({headless:true,args:[
      '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
      '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
    ]});
    const context=await browser.newContext({viewport:{width:960,height:600},
      deviceScaleFactor:1});
    page=await context.newPage();
    page.setDefaultTimeout(150000);
    page.on('pageerror',err=>record.browserErrors.push(String(err)));
    await context.addInitScript(()=>localStorage.setItem(
      'driver2-menu-preferences-v1',JSON.stringify({
        models:false,scanlines:false,reducedMotion:true
      })));
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
    await boot();

    await step('v1 save auto-migrated on same origin',async()=>{
      const r=await page.evaluate(()=>{
        const g=window.DriverGame,s=g.homeSave,base=s.capture(g);
        const old={...base,version:1};
        localStorage.setItem(s.constructor.KEY,JSON.stringify(old));
        const migrated=s.read(),written=JSON.parse(
          localStorage.getItem(s.constructor.KEY));
        return {migratedVersion:migrated?.version,
          storedVersion:written.version,
          mission:migrated?.mission.type,
          carDamage:migrated?.vehicles?.[0]?.damage,
          sameKey:s.constructor.KEY==='driver2-three-save-v1'};
      });
      assert.equal(r.migratedVersion,2);assert.equal(r.storedVersion,2);
      assert.equal(r.mission,'freeroam');assert(r.sameKey);return r;
    });
    await step('corrupt/future data never overwritten',async()=>{
      const r=await page.evaluate(()=>{
        const g=window.DriverGame,s=g.homeSave,baseline=s.capture(g);
        const foreign=JSON.stringify({...baseline,version:99});
        localStorage.setItem(s.constructor.KEY,foreign);
        const result=s.read();
        const untouched=localStorage.getItem(s.constructor.KEY)===foreign;
        localStorage.removeItem(s.constructor.KEY);
        return {rejected:result===null,untouched};
      });
      assert(r.rejected&&r.untouched);return r;
    });

    await step('Vegas C4 real mission can be saved to browser storage',async()=>{
      const r=await page.evaluate(()=>{
        const g=window.DriverGame;
        g.startMission('story_vegas_c4');
        if(g.currentCityKey!=='vegas'||g.missionType!=='story_vegas_c4'||
           g.regionalState?.type!=='story_vegas_c4')
          throw Error('Vegas C4 did not start in live game');
        g.chapterProgress.completeRegional('story_vegas_ambulance');
        g.completedMissions.add('story_vegas_ambulance');
        const snap=g.homeSave.capture(g);
        const saved=g.homeSave.write(snap);
        return {saved,version:snap.version,city:snap.city,
          mission:snap.mission.type,fleet:snap.vehicles.length,
          completed:snap.completed,playerIndex:snap.playerIndex};
      });
      assert.equal(r.saved,true);
      assert.equal(r.version,2);assert.equal(r.city,'vegas');
      assert.equal(r.mission,'story_vegas_c4');
      assert(r.completed.includes('story_vegas_ambulance'));
      return r;
    });
    await screenshot('01-vegas-before-reload');

    await step('reload returns to Vegas mission and preserves regional victory',async()=>{
      await page.reload({waitUntil:'domcontentloaded',timeout:65000});
      await boot();
      const r=await page.evaluate(()=>{
        const g=window.DriverGame;
        const stored=g.homeSave.read();
        if(stored?.city!=='vegas')throw Error('saved city disappeared');
        const restored=g.loadHomeGame();
        return {restored,version:stored.version,city:g.currentCityKey,
          mission:g.missionType,regional:g.regionalState?.type,
          playerCar:!!g.playerCar,active:g.missionActive,
          savedFleet:stored.vehicles.length,
          completed:g.completedMissions.has('story_vegas_ambulance'),
          chapter:g.chapterProgress.hasCompletedRegional('story_vegas_ambulance')};
      });
      assert.equal(r.restored,true);assert.equal(r.version,2);
      assert.equal(r.city,'vegas');assert.equal(r.mission,'story_vegas_c4');
      assert.equal(r.regional,'story_vegas_c4');
      assert(r.playerCar&&r.active&&r.completed&&r.chapter);
      return r;
    });
    await screenshot('02-vegas-restored');
    assert.deepEqual(record.browserErrors,[]);
    record.status='PASS';
  }catch(error){
    record.status='FAIL';
    record.failure={step:stepName,message:String(error),stack:error?.stack};
    console.error('P1_SAVE_FAIL',JSON.stringify(record.failure));
    if(page)try{await screenshot('FAIL-'+stepName.replace(/[^a-z0-9]+/gi,'-').slice(0,25));}catch(e){}
    process.exitCode=1;
  }finally{
    record.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(dir,'p1-save-evidence.json'),
      JSON.stringify(record,null,2)+'\n');
    console.log('P1_SAVE_VERDICT',record.status,'steps',record.steps.length);
    if(browser)await browser.close();
  }
})();
