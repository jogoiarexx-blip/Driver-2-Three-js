/* Browser QA: the same uploaded GLB roster must populate Undercover, free roam
   and story mission resets. This test enters Undercover via the real boot flow. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const DIR=path.join(process.cwd(),'qa-artifacts');
fs.mkdirSync(DIR,{recursive:true});
const base=process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
    '--use-gl=angle','--use-angle=swiftshader',
    '--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1152,height:720}});
 page.setDefaultTimeout(180000);
 const errors=[],snapshots=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const takeSnapshot=()=>page.evaluate(()=>{
    const game=window.DriverGame,m=game.pedManager;
    const models=m.variantPedestrians.models.filter(model=>
       ['child','dog'].includes(model.config.species));
    return {
       city:game.currentCityKey,mode:game.missionType,
       storyCampaign:game.storyCampaign,loadedModels:m.uploadedCrowd.status().loadedModels,
       slots:m.pedestrians.length,filled:m.uploadedCrowd.status().filledSlots,
       procedural:m.uploadedCrowd.status().proceduralCivilians,
       models:models.map(model=>{
          const ped=model.current;
          const height=model.root?new THREE.Box3().setFromObject(model.root)
              .getSize(new THREE.Vector3()).y:0;
          return {id:model.config.id,state:model.state,
              species:model.config.species,expected:model.config.height,
              height,slot:m.pedestrians.indexOf(ped),attached:!!ped?.glbVariant,
              speciesOnPed:ped?.species,
              rootId:model.root?.uuid,error:model.error};
       })
    };
 });
 try{
   await page.addInitScript(()=>localStorage.setItem(
     'driver2-menu-preferences-v1',JSON.stringify({
       models:false,scanlines:false,reducedMotion:true
     })));
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
   assert(await page.evaluate(()=>window.DriverBoot.start('story')),
      'Falha ao abrir Undercover');
   await page.waitForFunction(()=>window.DriverBoot.sessionReady&&
      window.DriverGame?.city?.ready&&window.DriverGame?.playerCar,
      null,{timeout:150000});
   await page.waitForFunction(()=>{
      const models=window.DriverGame?.pedManager?.variantPedestrians?.models;
      return models?.filter(m=>['child','dog'].includes(m.config.species))
        .every(m=>['ready','error','missing','unsupported'].includes(m.state));
   },null,{timeout:180000});
   for(const stage of ['undercover-entry','undercover-mission']){
     if(stage==='undercover-mission'){
       await page.evaluate(()=>window.DriverGame.startMission('story_tipoff'));
       await page.waitForFunction(()=>window.DriverGame?.missionType==='story_tipoff');
     }
     const data=await takeSnapshot();
     data.stage=stage;snapshots.push(data);
     assert.equal(data.city,'chicago');
     assert.equal(data.storyCampaign,true);
     assert.equal(data.slots,28);
     assert.equal(data.filled,28,JSON.stringify(data));
     assert.equal(data.procedural,0);
     assert.equal(data.models.length,5);
     for(const model of data.models){
       assert.equal(model.state,'ready',JSON.stringify(model));
       assert(model.attached && model.slot>=5&&model.slot<=9,
         'Modelo não ativado em '+stage+': '+JSON.stringify(model));
       assert.equal(model.speciesOnPed,model.species);
       assert(Math.abs(model.height-model.expected)<0.15,
         'Altura fora do esperado em '+stage+': '+JSON.stringify(model));
     }
     const dogs=data.models.filter(model=>model.species==='dog');
     const shepherd=dogs.find(m=>m.id==='german-shepherd');
     assert(shepherd.height>Math.max(...dogs.filter(m=>m!==shepherd).map(m=>m.height)));
   }
   assert.equal(errors.length,0,'Erros de JS: '+errors.join(' | '));
   fs.writeFileSync(path.join(DIR,'undercover-pedestrians.json'),
      JSON.stringify({pass:true,snapshots,errors},null,2));
   console.log('UNDERCOVER_GLBS_PASS '+JSON.stringify(snapshots));
 }catch(e){
   fs.writeFileSync(path.join(DIR,'undercover-pedestrians.json'),
      JSON.stringify({pass:false,snapshots,errors,error:String(e.stack||e)},null,2));
   console.error(e);process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
