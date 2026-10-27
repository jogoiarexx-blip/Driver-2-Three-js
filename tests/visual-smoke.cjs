/**
 * QA visual Driver 2: Chromium real, quatro mapas, condução, a pé,
 * passagem pela porta de interior, garagem e métricas de renderização.
 * Executar: npm install --no-save playwright && npx playwright install chromium
 *           node tests/visual-smoke.cjs
 */
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const DIR=path.join(process.cwd(),'qa-artifacts');
fs.mkdirSync(DIR,{recursive:true});
const BASE=process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/';
const CITIES=['chicago','havana','vegas','rio'];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const browser=await chromium.launch({headless:true,args:[
    '--use-gl=angle','--use-angle=swiftshader',
    '--enable-webgl','--ignore-gpu-blocklist',
    '--enable-unsafe-swiftshader'
  ]});
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  page.setDefaultTimeout(120000);
  const report={date:new Date().toISOString(),browser:'Chromium',
    viewport:'1280x720',maps:[],consoleErrors:[],runtimeErrors:[]};
  page.on('pageerror',error=>report.runtimeErrors.push(String(error)));
  page.on('console',msg=>{
    if(msg.type()==='error'&&report.consoleErrors.length<40)
      report.consoleErrors.push(msg.text().slice(0,420));
  });
  try{
    await page.addInitScript(()=>{
      localStorage.setItem('driver2-menu-preferences-v1',JSON.stringify({
        models:false,scanlines:false,reducedMotion:true,playerColor:'#d53934'
      }));
    });
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>window.DriverBoot&&window.THREE,null,{timeout:60000});
    const started=await page.evaluate(()=>window.DriverBoot.start('ride'));
    assert(started,'Não foi possível iniciar o jogo pelo menu');
    await page.waitForFunction(()=>window.DriverGame&&window.DriverGame.city.ready&&
      window.DriverGame.playerCar&&window.DriverBoot.sessionReady,null,{timeout:120000});
    for(const city of CITIES){
      if(city!=='chicago') {
        const ok=await page.evaluate(id=>window.DriverGame.requestCityChange(id),city);
        assert(ok,'Falha ao carregar '+city);
      }
      await page.waitForFunction(id=>window.DriverGame.currentCityKey===id&&
        window.DriverGame.city.ready,city,{timeout:120000});
      const initial=await page.evaluate(()=>{
        const g=window.DriverGame;
        return {city:g.currentCityKey,buildings:g.city.buildingBoxes.length,
          interiors:g.city.interiors.map(p=>p.id),
          bridgeLeaves:!!g.city.bridgeSouthLeaf&&!!g.city.bridgeNorthLeaf,
          garageGate:!!g.city.secretGateMesh,
          landmarks:g.city.cityGroup.children.filter(o=>o.name&&
            o.name.startsWith('landmark-detail')).length,
          structureMeshes:g.city.cityGroup.children.filter(o=>o.name&&
            (/special|bridge-|home-garage|warehouse-exterior|secret-garage|store-|interior-|chicago-station|caine-compound/
              .test(o.name))).length,
          lod:g.city.lodStats,
          geometries:g.renderer.info.memory.geometries,
          textures:g.renderer.info.memory.textures
        };
      });
      assert.equal(initial.city,city);
      assert(initial.buildings>30,'Sem colisores de prédios em '+city);
      assert(initial.bridgeLeaves,'Ponte não criada em '+city);
      assert(initial.garageGate,'Garagem secreta ausente em '+city);
      assert(initial.structureMeshes>8,'Estruturas especiais ausentes em '+city);
      await page.evaluate(()=>{
        const g=window.DriverGame,p=g.playerCar;
        g.mode='driving';g.interiorPlace=null;
        g.tanner.setVisible(false);
        p.x=205;p.z=-150;p.y=0;p.prevX=p.x;p.prevZ=p.z;
        p.heading=Math.PI;p.speed=0;
        p.root.position.set(p.x,0,p.z);
        g.cameraRig.lastMode=-1;g.cameraRig.focus=null;
      });
      await sleep(1100);
      await page.screenshot({path:path.join(DIR,city+'-driving.png')});
      const driving=await page.evaluate(()=>{
        const g=window.DriverGame;
        return {mode:g.mode,x:g.playerCar.x,z:g.playerCar.z,
          drawCalls:g.renderer.info.render.calls,
          triangles:g.renderer.info.render.triangles};
      });
      assert.equal(driving.mode,'driving');
      await page.evaluate(()=>{
        const g=window.DriverGame;
        g.playerCar.speed=0;
        g.toggleVehicleEnterExit();
      });
      await page.evaluate(()=>{
        const g=window.DriverGame;
        if(g.mode!=='on_foot' && g.playerCar.policeDoorRig)
          throw Error('Saída do veículo policial não concluída');
        if(g.mode!=='on_foot')g.toggleVehicleEnterExit();
        g.tanner.setPosition(200,0,-170,Math.PI);
        g.tanner.setVisible(true);
        g.cameraRig.lastMode=-1;g.cameraRig.focus=null;
      });
      await sleep(600);
      const beforeWalk=await page.evaluate(()=>{
        const p=window.DriverGame.tanner.group.position;
        return {x:p.x,z:p.z,mode:window.DriverGame.mode};
      });
      assert.equal(beforeWalk.mode,'on_foot','Falha ao sair do carro em '+city);
      await page.evaluate(()=>{window.DriverGame.input.up=true});
      await sleep(400);
      await page.evaluate(()=>{window.DriverGame.input.up=false});
      const afterWalk=await page.evaluate(()=>{
        const p=window.DriverGame.tanner.group.position;
        return {x:p.x,z:p.z};
      });
      assert(Math.hypot(afterWalk.x-beforeWalk.x,afterWalk.z-beforeWalk.z)>.05,
        'Tanner não caminhou em '+city);
      await page.screenshot({path:path.join(DIR,city+'-on-foot.png')});
      const inner=await page.evaluate(()=>{
        const g=window.DriverGame;
        const place=g.city.interiors.find(p=>p.id==='warehouse');
        if(!place)throw Error('Depósito sem interior');
        if(!g.city.interiorAt(place.door.x,place.door.z))
          throw Error('Gatilho do depósito indisponível');
        if(!g.enterInterior(place))throw Error('Não entrou no depósito');
        return {id:place.id,x:place.inside.x,exit:place.exit};
      });
      await sleep(500);
      await page.screenshot({path:path.join(DIR,city+'-warehouse-interior.png')});
      const exited=await page.evaluate(()=>{
        const g=window.DriverGame;
        const p=g.interiorPlace;
        if(!p||!p.exit)return false;
        return g.leaveInterior();
      });
      assert(exited,'Não saiu do depósito em '+city);
      // Sanidade do interruptor: barragem física removida só após destravar.
      const gate=await page.evaluate(()=>{
        const c=window.DriverGame.city;
        const idx=c.secretGateBoxIndex;
        const before=c.buildingBoxes[idx];
        const unlocked=c.unlockSecretGate();
        const after=c.buildingBoxes[idx];
        return {unlocked,before:before.minX,after:after.minX,
          position:c.secretGateMesh.position.y};
      });
      assert(gate.unlocked&&gate.after===9999,'Portão não desbloqueou em '+city);
      // Amostra de frames do navegador headless: não representa FPS do usuário.
      const perf=await page.evaluate(async()=>{
        const frames=[];
        let prev=performance.now();
        for(let i=0;i<90;i++){
          await new Promise(resolve=>requestAnimationFrame(t=>{
            frames.push(t-prev);prev=t;resolve();
          }));
        }
        const samples=frames.slice(5).filter(x=>x>0);
        const avg=samples.reduce((a,b)=>a+b,0)/samples.length;
        const g=window.DriverGame;
        return {meanFrameMs:Number(avg.toFixed(2)),
          sampleFPS:Number((1000/avg).toFixed(1)),
          renderCalls:g.renderer.info.render.calls,
          triangles:g.renderer.info.render.triangles};
      });
      report.maps.push({...initial,driving,walking:{
        from:beforeWalk,to:afterWalk,distance:Math.hypot(
          afterWalk.x-beforeWalk.x,afterWalk.z-beforeWalk.z)},
        interior:inner,gate,perf});
      fs.writeFileSync(path.join(DIR,'report.json'),JSON.stringify(report,null,2));
    }
    assert.equal(report.runtimeErrors.length,0,'Exceções no navegador');
    console.log(JSON.stringify({status:'PASS',maps:report.maps.map(x=>({
      city:x.city,walkingDistance:x.walking.distance,
      sampleFPS:x.perf.sampleFPS,renderCalls:x.perf.renderCalls,
      structureMeshes:x.structureMeshes})),errors:report.consoleErrors.slice(0,10)},null,2));
  }catch(err){
    report.failure=String(err?.stack||err);
    await page.screenshot({path:path.join(DIR,'failure.png')}).catch(()=>{});
    console.error(report.failure);
    process.exitCode=1;
  }finally{
    fs.writeFileSync(path.join(DIR,'report.json'),JSON.stringify(report,null,2));
    await browser.close();
  }
})().catch(err=>{console.error(err);process.exitCode=1});
