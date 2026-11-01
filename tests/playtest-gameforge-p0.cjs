'use strict';
/**
 * Driver 2 R60 — Game Forge-style browser playtest with Claude-style evidence.
 * NO AI runtime, no direct game-state steering during the drive/walk stages.
 * A single documented starting fixture places Tanner's car on a safe street.
 * The test then uses real Playwright keyboard events (W/D/E) and verifies
 * displacement, rotation, dismount, real localStorage roundtrip and rail grade.
 *
 * This is scripted browser E3 + keyboard E4-like evidence, NOT proof of a
 * full human campaign playthrough or mobile/GPU performance certification.
 *
 * DRIVER_QA_URL=http://127.0.0.1:4173/ node tests/playtest-gameforge-p0.cjs
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const output=path.resolve(process.cwd(),'qa-artifacts');
fs.mkdirSync(output,{recursive:true});
const base=process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/';
const run={schema:'driver2-playtest-evidence-v1',build:process.env.GITHUB_SHA||'local',
  date:new Date().toISOString(),source:'adapted Game Forge / Claude Code Game Studios methodology',
  tool:'playwright Chromium SwiftShader',input:'keyboard W/D/E',mode:'ride',
  evidenceLevel:'E3 + scripted real controls (not human E4)',steps:[],
  screenshots:[],pageErrors:[],consoleErrors:[],status:'IN_PROGRESS',
  performance:'Software WebGL: not representative of GPU/Android FPS'};
let browser,context,page,last='initialization';
async function snapshot(){
  return page.evaluate(()=>{
    const g=window.DriverGame,c=g?.playerCar,t=g?.tanner?.group?.position;
    return {city:g?.currentCityKey,mode:g?.mode,mission:g?.missionType,
      ready:!!(g?.city?.ready&&window.DriverBoot?.sessionReady),
      paused:!!g?.isPaused,vehicleCount:g?.vehicles?.length,
      car:c?{x:c.x,y:c.y,z:c.z,heading:c.heading,speed:c.speed,
        damage:c.damage,submerged:!!c.isSubmerged}:null,
      tanner:t?{x:t.x,y:t.y,z:t.z,visible:!!g.tanner.group.visible}:null,
      water:c&&g.city?.isWaterAt?.(c.x,c.z),
      blocked:c&&g.city?.isPointBlocked?.(c.x,c.z,1.55,c.y),
      savePresent:!!g?.homeSave?.read?.()};
  });
}
async function shot(name){
  const file='gameforge-'+name+'.png';
  await page.screenshot({path:path.join(output,file),timeout:120000});
  run.screenshots.push(file);
}
async function step(name,fn){
  last=name;
  const started=Date.now();
  const data=await fn();
  const state=await snapshot();
  run.steps.push({name,elapsedMs:Date.now()-started,data,state});
  console.log('DRIVER_P0_STEP',name,JSON.stringify({data,state}));
  return {data,state};
}
async function ready(){
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE,null,{timeout:60000});
  const started=await page.evaluate(()=>window.DriverBoot.start('ride'));
  assert.equal(started,true,'cannot start ride from the game menu');
  await page.waitForFunction(()=>window.DriverBoot?.sessionReady&&
    window.DriverGame?.city?.ready&&window.DriverGame?.playerCar,
    null,{timeout:120000});
}
async function moveUntil(key,test,timeout=65000,arg=null){
  await page.keyboard.down(key);
  try{
    await page.waitForFunction(test,arg,{timeout,polling:200});
  }finally{
    await page.keyboard.up(key);
  }
}
(async()=>{
  try{
    browser=await chromium.launch({headless:true,args:[
      '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
      '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
    ]});
    context=await browser.newContext({viewport:{width:960,height:600},
      deviceScaleFactor:1});
    page=await context.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror',err=>run.pageErrors.push(String(err)));
    page.on('console',m=>{
      if(m.type()==='error'&&run.consoleErrors.length<35)
        run.consoleErrors.push(m.text().slice(0,500));
    });
    await context.addInitScript(()=>{
      localStorage.setItem('driver2-menu-preferences-v1',
        JSON.stringify({models:false,scanlines:false,reducedMotion:true}));
    });
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
    await ready();

    await step('street fixture validated once',async()=>{
      return page.evaluate(()=>{
        const g=window.DriverGame,p=g.playerCar;
        const start={x:0,z:-123,heading:0};
        assertSafe();
        function assertSafe(){
          if(g.city.isWaterAt(start.x,start.z)||
            g.city.isPointBlocked(start.x,start.z,1.55,0))
            throw Error('Road fixture is blocked or underwater');
        }
        g.isPaused=false;g.mode='driving';g.interiorPlace=null;
        g.tanner.setVisible(false);
        Object.assign(p,{x:start.x,y:g.city.getGroundHeightAt(
          start.x,start.z,0,true),z:start.z,heading:start.heading,
          speed:0,vy:0,lateralVelocity:0,damage:0,
          prevX:start.x,prevZ:start.z});
        p.updateTransform();
        g.input.up=g.input.down=g.input.left=g.input.right=false;
        return start;
      });
    });
    await shot('01-road-start');

    const drive=await step('keyboard W drives actual player car',async()=>{
      const from=await snapshot();
      await moveUntil('w',()=> {
        const c=window.DriverGame?.playerCar;
        return c&&Math.hypot(c.x, c.z+123)>=1.2;
      });
      const to=await snapshot();
      const distance=Math.hypot(to.car.x-from.car.x,to.car.z-from.car.z);
      assert(distance>=1.2,'no real W driving displacement');
      assert(!to.car.submerged&&!to.water,'car submerged on certified street');
      assert(to.car.damage<8,'unexpected damage while driving on road');
      return {distance,from:from.car,to:to.car};
    });
    await step('keyboard D steers vehicle instead of changing coordinates',async()=>{
      const previous=(await snapshot()).car.heading;
      await moveUntil('d',()=>{
        const c=window.DriverGame?.playerCar;
        return c&&Math.abs(Math.atan2(Math.sin(c.heading),
          Math.cos(c.heading)))>0.07;
      },65000);
      const current=(await snapshot()).car.heading;
      const change=Math.abs(Math.atan2(Math.sin(current-previous),
        Math.cos(current-previous)));
      assert(change>0.05,'D did not steer car');
      return {previous,current,turnRadians:change};
    });
    await shot('02-keyboard-driving');

    const saved=await step('real localStorage save with actual fleet',async()=>{
      const result=await page.evaluate(()=>{
        const g=window.DriverGame;
        // A real late-spawned Wrigley V8 must restore its non-default
        // damage, not only the number of vehicles in the fleet.
        if(g.wrigleyCar)g.wrigleyCar.damage=33;
        const snapshot=g.homeSave.capture(g);
        const stored=g.homeSave.write(snapshot);
        const read=g.homeSave.read();
        return {stored,valid:!!read,vehicleCount:snapshot.vehicles.length,
          savedVehicleCount:read?.vehicles?.length,
          playerIndex:snapshot.playerIndex,
          x:snapshot.vehicles[snapshot.playerIndex].x,
          z:snapshot.vehicles[snapshot.playerIndex].z,
          mission:snapshot.mission.type,
          lateVehicleDamage:read?.vehicles?.at(-1)?.damage};
      });
      assert(result.stored&&result.valid,'game rejected save from active scene');
      assert.equal(result.savedVehicleCount,result.vehicleCount,
        'save truncated a live vehicle fleet');
      assert(result.vehicleCount>32,
        'fixture should exercise historic 32-car save regression');
      assert.equal(result.lateVehicleDamage,33,
        'must have a distinctive late-spawned vehicle state');
      return result;
    });

    await step('keyboard E exits car without teleport',async()=>{
      await page.keyboard.press('e');
      await page.waitForFunction(()=>{
        const g=window.DriverGame;
        return g?.mode==='on_foot'&&!g.vehicleMountTransition&&
          !g.policeDoorTransition;
      },null,{timeout:60000,polling:200});
      const s=await snapshot();
      assert(s.tanner.visible,'Tanner mesh invisible after exit');
      assert(!s.water,'car unexpectedly fell in water');
      return {car:s.car,tanner:s.tanner};
    });
    await step('keyboard W moves Tanner on pavement',async()=>{
      const before=(await snapshot()).tanner;
      await moveUntil('w',origin=>{
        const p=window.DriverGame?.tanner?.group?.position;
        return p&&Math.hypot(p.x-origin.x,p.z-origin.z)>.35;
      },65000,{x:before.x,z:before.z});
      const after=(await snapshot()).tanner;
      const distance=Math.hypot(after.x-before.x,after.z-before.z);
      assert(distance>.35,'Tanner stayed still when W was pressed');
      return {distance,from:before,to:after};
    });
    await shot('03-tanner-on-foot');

    await step('reload and restore persisted save',async()=>{
      await page.reload({waitUntil:'domcontentloaded',timeout:60000});
      await ready();
      const rest=await page.evaluate(()=>{
        const g=window.DriverGame;
        const stored=g.homeSave.read();
        if(!stored)throw Error('save disappeared after reload');
        const ok=g.loadHomeGame();
        const car=g.playerCar;
        return {ok,x:car.x,z:car.z,city:g.currentCityKey,
          mission:g.missionType,mode:g.mode,vehicles:g.vehicles.length,
          storedVehicles:stored.vehicles.length,
          deferred:g._pendingVehicleRestore?.length||0};
      });
      assert(rest.ok,'loadHomeGame rejected persisted save');
      assert.equal(rest.city,'chicago');
      // The Wrigley car legitimately appears after the stadium LOD loads.
      // Verify its restoration AFTER it actually exists.
      await page.waitForFunction(count=>
        window.DriverGame?.vehicles?.length===count,
        saved.data.savedVehicleCount,{timeout:120000,polling:300});
      const last=await page.evaluate(()=>{
        const g=window.DriverGame;
        return {count:g.vehicles.length,damage:g.vehicles.at(-1).damage,
          pending:!!g._pendingVehicleRestore};
      });
      assert.equal(last.count,saved.data.savedVehicleCount);
      assert.equal(last.damage,33,
        'late Wrigley car did not receive saved damage');
      assert.equal(last.pending,false,'unapplied saved vehicles remain');
      assert.equal(rest.mode,'driving');
      assert(Math.hypot(rest.x-saved.data.x,rest.z-saved.data.z)<.15,
        'driver car position did not restore');
      return rest;
    });
    await shot('04-restored-save');

    await step('train ramp car grade stays on ground, no false damage',async()=>{
      return page.evaluate(()=>{
        const g=window.DriverGame,city=g.city,car=g.playerCar;
        const effects={addSkidMark(){},spawnTireSmoke(){},
          spawnImpactSparks(){},spawnCarBreakaway(){},
          spawnWaterSplash(){},ejectHubcap(){}};
        g.isPaused=true;
        Object.assign(car,{x:-14,z:-218,y:0,heading:Math.PI,
          speed:31,vy:0,lateralVelocity:0,damage:0,prevX:-14,prevZ:-218});
        car.updateTransform();
        let maxHeight=car.y,blocked=0,water=0,maxDamage=0;
        for(let i=0;i<23;i++){
          car.updatePhysics(1/30,{up:true,down:false,left:false,
            right:false,handbrake:false,sprint:false},city,effects,null,true);
          maxHeight=Math.max(maxHeight,car.y);
          blocked+=Number(city.isPointBlocked(car.x,car.z,1.55,car.y));
          water+=Number(city.isWaterAt(car.x,car.z));
          maxDamage=Math.max(maxDamage,car.damage);
        }
        const result={x:car.x,z:car.z,maxHeight,blocked,water,maxDamage};
        if(!(car.z<-237&&maxHeight<1.25&&blocked===0&&
             water===0&&maxDamage<8))
          throw Error('Rail underpass failed '+JSON.stringify(result));
        return result;
      });
    });
    await shot('05-rail-underpass');
    assert.deepEqual(run.pageErrors,[],'uncaught browser errors');
    run.status='PASS';
  }catch(error){
    run.status='FAIL';
    run.failure={step:last,message:String(error),stack:error?.stack};
    try{run.failure.lastState=await snapshot();}catch(err){
      run.failure.inspectError=String(err);
    }
    if(page)try{await shot('FAIL-'+last.replace(/[^a-z0-9]+/gi,'-').slice(0,28));}
    catch(err){run.failure.screenshotError=String(err);}
    console.error('DRIVER_P0_FAIL',JSON.stringify(run.failure));
    process.exitCode=1;
  }finally{
    run.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(output,'gameforge-driver2-evidence.json'),
      JSON.stringify(run,null,2)+'\n');
    console.log('DRIVER_P0_VERDICT',run.status,'steps',run.steps.length,
      'evidence',path.join(output,'gameforge-driver2-evidence.json'));
    if(browser)await browser.close();
  }
})();
