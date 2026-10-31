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
    const focus=game.getPlayerPosition();
    const models=m.variantPedestrians.models.filter(model=>
       ['child','dog'].includes(model.config.species));
    return {
       city:game.currentCityKey,mode:game.missionType,
       storyCampaign:game.storyCampaign,loadedModels:m.uploadedCrowd.status().loadedModels,
       slots:m.pedestrians.length,filled:m.uploadedCrowd.status().filledSlots,
       procedural:m.uploadedCrowd.status().proceduralCivilians,
       models:models.map(model=>{
          const ped=model.current;
          // Exercitar a animação antes da medição: alguns GLBs só
          // ficam gigantes quando o primeiro mixer.update é executado.
          if(model.config.species==='dog'&&ped){
            ped.mesh.visible=true;
            model.update(ped,.06,true,false);
            model.update(ped,.06,true,false);
          }
          const bounds=model.root?new THREE.Box3().setFromObject(model.root):null;
          const dimensions=bounds?.getSize(new THREE.Vector3());
          const height=dimensions?.y||0;
          const skinnedBounds=new THREE.Box3().makeEmpty();
          let sampledVertices=0;
          model.root?.updateMatrixWorld(true);
          model.root?.traverse(mesh=>{
            if(!mesh.isSkinnedMesh||!mesh.geometry?.attributes?.position)return;
            mesh.skeleton?.update();
            const position=mesh.geometry.attributes.position;
            const v=new THREE.Vector3();
            const stride=Math.max(1,Math.floor(position.count/1024));
            for(let i=0;i<position.count;i+=stride){
              v.fromBufferAttribute(position,i);
              if(typeof mesh.boneTransform==='function'){
                mesh.boneTransform(i,v);
                mesh.localToWorld(v);
                if(Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z)){
                  skinnedBounds.expandByPoint(v);sampledVertices++;
                }
              }
            }
          });
          const skinnedSize=sampledVertices?skinnedBounds.getSize(new THREE.Vector3()):null;
          return {id:model.config.id,state:model.state,
              species:model.config.species,expected:model.config.height,
              height,width:dimensions?.x||0,depth:dimensions?.z||0,
              skinnedHeight:skinnedSize?.y||0,skinnedWidth:skinnedSize?.x||0,
              skinnedDepth:skinnedSize?.z||0,sampledVertices,
              skinnedScale:model.skinnedScaleReport,
              feetY:bounds?.min.y??0,skinnedFeetY:sampledVertices?skinnedBounds.min.y:0,
              scaleTracksRemoved:model.visualRepairs.scaleTracksRemoved,
              slot:m.pedestrians.indexOf(ped),attached:!!ped?.glbVariant,
              distance:ped?Math.hypot(ped.x-focus.x,ped.z-focus.z):Infinity,
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
       if(model.species==='dog'){
         assert(model.distance>=20&&model.distance<=115,
            'Cão fora do alcance visual do jogador: '+JSON.stringify(model));
         console.log('DOG_TRUE_SKINNING '+JSON.stringify({stage,id:model.id,
           skinnedHeight:model.skinnedHeight,skinnedWidth:model.skinnedWidth,
           skinnedDepth:model.skinnedDepth,boxHeight:model.height,
           sampledVertices:model.sampledVertices}));
         assert(model.sampledVertices>100,'Skin CPU não foi medida: '+JSON.stringify(model));
         assert(model.skinnedScale?.framesChecked===6,
            'GLB canino não passou pela calibração de seis poses: '+JSON.stringify(model));
         assert(model.skinnedHeight>0&&model.skinnedHeight<1.5&&
                model.skinnedWidth>0&&model.skinnedWidth<2.8&&
                model.skinnedDepth>0&&model.skinnedDepth<2.8,
            'Cão gigante na malha deformada em movimento: '+JSON.stringify(model));
         assert(model.width>0&&model.width<2.7&&model.depth>0&&model.depth<2.7,
            'Cão gigante na geometria não deformada: '+JSON.stringify(model));
         assert(model.skinnedFeetY>-0.2&&model.skinnedFeetY<1.5,
            'Cão flutuando na malha animada: '+JSON.stringify(model));
       }
       const visibleHeight=model.species==='dog'?model.skinnedHeight:model.height;
       assert(Math.abs(visibleHeight-model.expected)<0.18,
         'Altura REAL fora do esperado em '+stage+': '+JSON.stringify(model));
     }
     const dogs=data.models.filter(model=>model.species==='dog');
     const shepherd=dogs.find(m=>m.id==='german-shepherd');
     assert(shepherd.skinnedHeight>
        Math.max(...dogs.filter(m=>m!==shepherd).map(m=>m.skinnedHeight)));
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
