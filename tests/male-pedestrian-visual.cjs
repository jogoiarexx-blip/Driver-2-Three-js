/* Browser smoke: the exact uploaded GLB is skinned and active as one male
 * pedestrian, with the female and the other 26 NPCs untouched. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const DIR=path.join(process.cwd(),'qa-artifacts');
fs.mkdirSync(DIR,{recursive:true});
const BASE=process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
    '--use-gl=angle','--use-angle=swiftshader',
    '--enable-webgl','--ignore-gpu-blocklist',
    '--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1152,height:720}});
 page.setDefaultTimeout(120000);
 const errors=[],results=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
   await page.addInitScript(()=>localStorage.setItem(
      'driver2-menu-preferences-v1',JSON.stringify({
         models:false,scanlines:false,reducedMotion:true
      })));
   await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
   assert(await page.evaluate(()=>window.DriverBoot.start('ride')));
   await page.waitForFunction(()=>window.DriverGame?.city?.ready&&
      window.DriverGame.playerCar&&window.DriverBoot.sessionReady,
      null,{timeout:120000});
   for(const city of ['chicago','havana']){
      if(city!=='chicago'){
         const ok=await page.evaluate(name=>
           window.DriverGame.requestCityChange(name),city);
         assert(ok,'City change refused');
         await page.waitForFunction(name=>
           window.DriverGame.currentCityKey===name &&
           window.DriverGame.city.ready,city);
      }
      await page.waitForFunction(()=>{
         const male=window.DriverGame?.pedManager?.malePedestrian;
         return male&&['ready','error','missing','unsupported'].includes(male.state);
      },null,{timeout:120000});
      const data=await page.evaluate(()=>{
         const g=window.DriverGame;
         const m=g.pedManager,peds=g.pedManager.pedestrians;
         const male=m.malePedestrian,female=m.femalePedestrian;
         const matches=peds.filter(x=>x.glbMale);
         const skinned=[];
         male.root?.traverse(o=>{if(o.isSkinnedMesh)skinned.push(o.name);});
         return {city:g.currentCityKey,status:male.status(),
            total:peds.length,matched:matches.length,
            maleSlot:peds.indexOf(male.current),
            femaleSlot:peds.indexOf(female?.current),
            femaleActive:!!female?.current,
            skinnedMeshes:skinned.length,
            hasWalking:!!male.walkAction,
            hasRunning:!!male.runAction};
      });
      assert.equal(data.status.state,'ready',JSON.stringify(data));
      assert.equal(data.total,28);
      assert.equal(data.matched,1,'Must replace only one male');
      assert.equal(data.maleSlot,1);
      assert.equal(data.femaleSlot,0);
      assert(data.femaleActive,'Female pedestrian disappeared');
      assert(data.skinnedMeshes>=1,'GLB body is not skinned');
      assert(data.hasWalking&&data.hasRunning);
      results.push(data);

      // Pause gameplay so the camera can photograph the actual skinned
      // character on a sidewalk rather than a procedural substitute.
      await page.evaluate(()=>{
         const g=window.DriverGame,p=g.pedManager.malePedestrian.current;
         g.isPaused=true;
         p.mesh.visible=true;
         p.x=17;p.z=-40;
         p.mesh.position.set(17,g.city.getSidewalkHeightAt(17,-40),-40);
         p.mesh.rotation.set(0,0,0);
         g.pedManager.malePedestrian.update(p,.016,true,false);
         g.camera.position.set(22,3.2,-32);
         g.camera.lookAt(17,1.35,-40);
         g.camera.updateProjectionMatrix();
         g.renderer.render(g.scene,g.camera);
      });
      await sleep(850);
      await page.screenshot({path:path.join(DIR,
         'male-pedestrian-'+city+'-glb.png')});
      await page.evaluate(()=>{window.DriverGame.isPaused=false;});
   }
   assert.equal(errors.length,0,'Browser errors: '+errors.join(' | '));
   fs.writeFileSync(path.join(DIR,'male-pedestrian-report.json'),
      JSON.stringify({status:'PASS',results,errors},null,2));
   console.log('MALE_PEDESTRIAN_BROWSER_PASS '+JSON.stringify(results));
 }catch(e){
   fs.writeFileSync(path.join(DIR,'male-pedestrian-report.json'),
      JSON.stringify({status:'FAIL',results,errors,error:String(e.stack||e)},null,2));
   await page.screenshot({path:path.join(DIR,'male-pedestrian-failed.png')})
      .catch(()=>{});
   console.error(e);process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
