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
          regionalBridge:g.city.regionalInfrastructureStats,
          secretVariant:g.secretCar?.secretVariant||null,
          secretLivery:!!g.secretCar?.secretCityStyle,
          geometries:g.renderer.info.memory.geometries,
          textures:g.renderer.info.memory.textures
        };
      });
      assert.equal(initial.city,city);
      assert(initial.buildings>30,'Sem colisores de prédios em '+city);
      assert(initial.bridgeLeaves,'Ponte não criada em '+city);
      assert(initial.garageGate,'Garagem secreta ausente em '+city);
      assert(initial.structureMeshes>8,'Estruturas especiais ausentes em '+city);
      assert(initial.regionalBridge?.movingLeaves===2,
        'Ponte regional não associada às duas folhas móveis em '+city);
      assert(initial.regionalBridge?.collidersAdded===0,
        'A ponte regional alterou os colisores em '+city);
      assert(initial.secretLivery && initial.secretVariant,
        'Carro secreto regional ausente em '+city);
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
      // Damage test in the real browser. Deform the mesh without adding
      // physics colliders; then restore the car before navigation tests.
      const visualDamage=await page.evaluate(()=>{
        const car=window.DriverGame.playerCar;
        if(!car.hoodPivot)return {supported:false};
        car.damage=78;car.damageZones.front=82;
        VehicleDamageFX.update(car);
        const hood=car.hoodPivot.children[0];
        const record={supported:true,scaleZ:hood.scale.z,
          hingeX:car.hoodPivot.rotation.x,
          hubcaps:car.hubcaps};
        car.damage=0;car.damageZones.front=0;
        VehicleDamageFX.update(car);
        return record;
      });
      if(visualDamage.supported){
        assert(visualDamage.scaleZ<.9,'Capô não amassou em '+city);
        assert(visualDamage.hingeX<-.1,'Capô não dobrou em '+city);
      }
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
      // QA visual extra de Copacabana e do Corcovado: cenas realmente
      // exploradas no navegador, não apenas geometria estática em Node.
      let rioVisual=null;
      if(city==='rio'){
        const detail=await page.evaluate(()=>{
          const g=window.DriverGame;
          const objs=g.city.cityGroup.children;
          const names=objs.map(o=>o.name||'');
          const stat=g.city.rioOverhaulStats;
          return {present:!!stat,version:stat?.version||0,
            water:names.includes('rio-ocean-backdrop'),
            corcovado:names.some(n=>n.startsWith('rio-corcovado')),
            beach:names.some(n=>n.startsWith('rio-copacabana')),
            mountains:names.filter(n=>n.startsWith('rio-mountains')).length,
            parkCount:stat?.parkCount||0,
            collisions:stat?.addedColliders};
        });
        assert(detail.present&&detail.version===2&&detail.water&&
          detail.corcovado&&detail.beach&&detail.mountains>=2&&
          detail.collisions===0,'Rio 2.0 sem todos os detalhes');
        // Vista dirigindo junto ao calçadão. O código não teleporta o
        // mundo, somente reposiciona o veículo do teste.
        await page.evaluate(()=>{
          const g=window.DriverGame,p=g.playerCar;
          g.mode='driving';g.tanner.setVisible(false);
          p.x=387;p.y=0;p.z=-180;p.heading=0;p.speed=0;
          p.prevX=p.x;p.prevZ=p.z;p.root.position.set(p.x,p.y,p.z);
          p.root.rotation.y=p.heading;
          g.cameraRig.lastMode=-1;g.cameraRig.focus=null;
        });
        await sleep(950);
        await page.screenshot({path:path.join(DIR,'rio-copacabana-driving.png')});
        // Caminhada sobre a orla; não pode sair do limite do mundo.
        // WebGL software renderer can stall while shader assets compile.
        // Let the camera/LOD settle before measuring foot movement.
        await sleep(850);
        const starting=await page.evaluate(()=>{
          const g=window.DriverGame;
          g.mode='on_foot';
          g.tanner.setPosition(389,0,-179,0);
          g.tanner.setVisible(true);g.input.up=true;
          g.cameraRig.lastMode=-1;g.cameraRig.focus=null;
          return {x:g.tanner.group.position.x,z:g.tanner.group.position.z};
        });
        await sleep(1150);
        const walking=await page.evaluate(()=>{
          const g=window.DriverGame;
          g.input.up=false;
          return {x:g.tanner.group.position.x,z:g.tanner.group.position.z};
        });
        assert(Math.hypot(walking.x-starting.x,walking.z-starting.z)>.05,
          'Tanner não caminhou na orla do Rio');
        await page.screenshot({path:path.join(DIR,'rio-copacabana-on-foot.png')});
        // Mirante do Corcovado visto a partir do eixo sul/norte.
        await page.evaluate(()=>{
          const g=window.DriverGame,p=g.playerCar;
          g.mode='driving';g.tanner.setVisible(false);
          p.x=0;p.y=0;p.z=-305;p.heading=Math.PI;p.speed=0;
          p.prevX=p.x;p.prevZ=p.z;p.root.position.set(p.x,p.y,p.z);
          p.root.rotation.y=p.heading;
          g.cameraRig.lastMode=-1;g.cameraRig.focus=null;
        });
        await sleep(950);
        await page.screenshot({path:path.join(DIR,'rio-corcovado-driving.png')});
        rioVisual={...detail,beachWalkingDistance:Number(
          Math.hypot(walking.x-starting.x,walking.z-starting.z).toFixed(3))};
      }
      let havanaVisual=null;
      if(city==='havana'){
        const detail=await page.evaluate(()=>{
          const g=window.DriverGame,c=g.city;
          const names=c.cityGroup.children.map(o=>o.name||'');
          const s=c.havanaOverhaulStats;
          return {present:!!s,version:s?.version||0,
            malecon:names.some(n=>n.startsWith('havana-malecon')),
            harbor:names.some(n=>n.startsWith('havana-harbor')),
            sea:names.includes('havana-sea-backdrop'),
            parks:names.some(n=>n.startsWith('havana-park')),
            capitolio:names.some(n=>n.startsWith('havana-capitolio')),
            revolucion:names.some(n=>n.startsWith('havana-revolucion')),
            addedColliders:s?.addedColliders};
        });
        assert(detail.present&&detail.version===2&&detail.malecon&&
          detail.harbor&&detail.sea&&detail.parks&&
          detail.capitolio&&detail.revolucion&&
          detail.addedColliders===0,
          'Havana 2.0 sem todos os detalhes');
        // Dirigindo na margem do canal, que representa a orla no jogo.
        await page.evaluate(()=>{
          const g=window.DriverGame,p=g.playerCar;
          g.mode='driving';g.tanner.setVisible(false);
          p.x=-200;p.y=0;p.z=16;p.heading=0;p.speed=0;
          p.prevX=p.x;p.prevZ=p.z;p.root.position.set(p.x,p.y,p.z);
          p.root.rotation.y=p.heading;
          g.cameraRig.lastMode=-1;g.cameraRig.focus=null;
        });
        await sleep(850);
        await page.screenshot({path:path.join(DIR,'havana-malecon-driving.png')});
        const first=await page.evaluate(()=>{
          const g=window.DriverGame;
          g.mode='on_foot';g.tanner.setPosition(-200,0,17,0);
          g.tanner.setVisible(true);g.input.up=true;
          g.cameraRig.lastMode=-1;g.cameraRig.focus=null;
          return {x:g.tanner.group.position.x,z:g.tanner.group.position.z};
        });
        await sleep(850);
        const next=await page.evaluate(()=>{
          const g=window.DriverGame;g.input.up=false;
          return {x:g.tanner.group.position.x,z:g.tanner.group.position.z};
        });
        const distance=Math.hypot(next.x-first.x,next.z-first.z);
        assert(distance>.05,'Tanner não caminhou no Malecón de Havana');
        await page.screenshot({path:path.join(DIR,'havana-malecon-on-foot.png')});
        await page.evaluate(()=>{
          const g=window.DriverGame,p=g.playerCar;
          g.mode='driving';g.tanner.setVisible(false);
          p.x=-280;p.y=0;p.z=-247;p.heading=Math.PI;p.speed=0;
          p.prevX=p.x;p.prevZ=p.z;p.root.position.set(p.x,p.y,p.z);
          p.root.rotation.y=p.heading;
          g.cameraRig.lastMode=-1;g.cameraRig.focus=null;
        });
        await sleep(850);
        await page.screenshot({path:path.join(DIR,'havana-capitolio-driving.png')});
        havanaVisual={...detail,walked:Number(distance.toFixed(3))};
      }
      let vegasVisual=null;
      if(city==='vegas'){
        const sceneInfo=await page.evaluate(()=>{
          const g=window.DriverGame,c=g.city;
          const names=c.cityGroup.children.map(o=>o.name||'');
          const stats=c.vegasOverhaulStats;
          return {
            active:!!stats,version:stats?.version||0,
            strip:names.some(n=>n.startsWith('vegas-strip-')),
            palms:names.some(n=>n.startsWith('vegas-strip-streets')),
            desert:names.filter(n=>n.startsWith('vegas-desert')).length,
            gardens:names.some(n=>n.startsWith('vegas-resort-gardens')),
            casino:names.some(n=>n.startsWith('vegas-casino-landmark')),
            hotel:names.some(n=>n.startsWith('vegas-hotel-landmark')),
            colliderDelta:stats?.addedColliders,
            pointLights:stats?.pointLights
          };
        });
        assert(sceneInfo.active&&sceneInfo.version===2&&
          sceneInfo.strip&&sceneInfo.palms&&
          sceneInfo.desert>=2&&sceneInfo.gardens&&
          sceneInfo.casino&&sceneInfo.hotel&&
          sceneInfo.colliderDelta===0&&sceneInfo.pointLights===0,
          'Las Vegas 2.0 sem as estruturas completas');
        // Vista a partir do asfalto da Strip, entre os hotéis.
        await page.evaluate(()=>{
          const g=window.DriverGame,p=g.playerCar;
          g.mode='driving';g.tanner.setVisible(false);
          p.x=0;p.z=-176;p.y=0;p.heading=0;p.speed=0;
          p.prevX=p.x;p.prevZ=p.z;
          p.root.position.set(p.x,p.y,p.z);
          p.root.rotation.y=p.heading;
          g.cameraRig.lastMode=-1;g.cameraRig.focus=null;
        });
        await sleep(950);
        await page.screenshot({path:path.join(DIR,'vegas-strip-driving.png')});
        // Testar a pé junto aos cassinos, sem sair do mapa.
        const begin=await page.evaluate(()=>{
          const g=window.DriverGame;
          g.mode='on_foot';
          g.tanner.setPosition(-17,0,-184,0);
          g.tanner.setVisible(true);g.input.up=true;
          g.cameraRig.lastMode=-1;g.cameraRig.focus=null;
          return {x:g.tanner.group.position.x,z:g.tanner.group.position.z};
        });
        await sleep(850);
        const end=await page.evaluate(()=>{
          const g=window.DriverGame;g.input.up=false;
          return {x:g.tanner.group.position.x,z:g.tanner.group.position.z};
        });
        const walkDistance=Math.hypot(end.x-begin.x,end.z-begin.z);
        assert(walkDistance>.05,'Jogador não caminhou na Strip');
        await page.screenshot({path:path.join(DIR,'vegas-strip-on-foot.png')});
        // Aproximação do cassino principal; conservar a física original.
        await page.evaluate(()=>{
          const g=window.DriverGame,p=g.playerCar;
          g.mode='driving';g.tanner.setVisible(false);
          p.x=-280;p.z=-242;p.y=0;
          p.heading=Math.PI;p.speed=0;p.prevX=p.x;p.prevZ=p.z;
          p.root.position.set(p.x,p.y,p.z);
          p.root.rotation.y=p.heading;
          g.cameraRig.lastMode=-1;g.cameraRig.focus=null;
        });
        await sleep(900);
        await page.screenshot({path:path.join(DIR,'vegas-casino-driving.png')});
        vegasVisual={...sceneInfo,walkingDistance:Number(walkDistance.toFixed(3))};
      }
      // Comparação visual de pavimento: abrir o cruzamento central
      // dirigindo nos quatro mapas e certificar a geometria de ruas.
      const roadVisual=await page.evaluate(()=>{
        const g=window.DriverGame,c=g.city,s=c.roadSurfaceStats;
        return {regions:s?.regions||0,
          intersections:s?.intersectionCount||0,
          paintedInsideIntersections:s?.paintedInsideIntersections,
          collidersAdded:s?.collidersAdded,
          roadMesh:c.cityGroup.children.some(o=>
            o.name==='driver2-road-asphalt-'+c.preset.id),
          curbs:c.cityGroup.children.some(o=>
            o.name==='driver2-stone-curbs-'+c.preset.id),
          zebra:c.cityGroup.children.some(o=>o.count===1600)};
      });
      assert.equal(roadVisual.regions,261,'Ruas incompletas em '+city);
      assert.equal(roadVisual.intersections,81);
      assert.equal(roadVisual.collidersAdded,0);
      assert.equal(roadVisual.paintedInsideIntersections,0);
      assert(roadVisual.roadMesh&&roadVisual.curbs&&roadVisual.zebra,
        'Asfalto, meios-fios ou faixas ausentes em '+city);
      await page.evaluate(()=>{
        const g=window.DriverGame,p=g.playerCar;
        g.mode='driving';g.interiorPlace=null;
        g.tanner.setVisible(false);
        p.x=0;p.y=0;p.z=-123;p.heading=0;p.speed=0;
        p.prevX=p.x;p.prevZ=p.z;
        p.root.position.set(p.x,p.y,p.z);
        p.root.rotation.y=p.heading;
        g.cameraRig.lastMode=-1;g.cameraRig.focus=null;
      });
      await sleep(1000);
      await page.screenshot({path:path.join(DIR,city+'-road-intersection.png')});
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
        interior:inner,gate,perf,rioVisual,havanaVisual,vegasVisual,
        roadVisual,visualDamage});
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
