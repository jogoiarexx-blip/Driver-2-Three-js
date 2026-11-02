'use strict';
/** R69: real Chicago street link audit in Three.js/Chromium. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const out=path.resolve('qa-artifacts');
fs.mkdirSync(out,{recursive:true});
const base=process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/';
const report={date:new Date().toISOString(),status:'STARTED',
    pageErrors:[],notes:'E3 real Chromium, Undercover adapted grid; E4/E5 not certified'};
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
  '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const ctx=await browser.newContext({viewport:{width:1120,height:700}});
 const page=await ctx.newPage();page.setDefaultTimeout(120000);
 page.on('pageerror',error=>report.pageErrors.push(String(error)));
 try{
  await page.addInitScript(()=>localStorage.setItem(
   'driver2-menu-preferences-v1',
   JSON.stringify({models:false,scanlines:false,reducedMotion:true})));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.DriverBoot&&window.THREE,
   null,{timeout:60000});
  assert.equal(await page.evaluate(()=>window.DriverBoot.start('ride')),true);
  await page.waitForFunction(()=>window.DriverBoot?.sessionReady&&
   window.DriverGame?.city?.ready&&
   window.DriverGame?.currentCityKey==='chicago',
   null,{timeout:120000});
  const result=await page.evaluate(()=>{
   const game=window.DriverGame,city=game.city;
   const network=DriverChicagoMixedNavigationR49;
   const graph=network.compile(city);
   const links=city.chicagoCityPlan?.courtyardLinks||[];
   const buildCount=city.chicagoCityPlan?.courtyardStreetSegments||0;
   const buildMeters=city.chicagoCityPlan?.courtyardStreetMeters||0;
   const surfaces=[];
   city.cityGroup.traverse(o=>{
    if(o.name==='chicago-r69-drivable-residential-service-lanes')
     surfaces.push({vertices:o.geometry?.attributes?.position?.count||0,
      visible:o.visible!==false,visualOnly:!!o.userData?.chicagoVisualOnly});
   });
   const examined=links.map(link=>{
    const a=link.from,b=link.to;
    const from=network.key(a),to=network.key(b);
    const adjacent=(graph.adj.get(from)||[]).some(n=>n.key===to);
    const reverse=(graph.adj.get(to)||[]).some(n=>n.key===from);
    const dryBothEnds=!city.isWaterAt(a.x,a.z)&&!city.isWaterAt(b.x,b.z);
    const physical=DriverChicagoCityPlan.verifyCourtyard(city,link);
    const route=network.plan(city,a,b);
    const routeOK=!!route&&route.length>=2;
    const southEdge=[a,b].find(p=>p.z< -320&&
       Math.abs(p.x/80-Math.round(p.x/80))<1e-6);
    // A faixa sul deve alcançar a avenida já asfaltada em z=-320,
    // não apenas ligar as duas pontas de uma ilha isolada no grafo.
    const cityRoute=southEdge?network.plan(city,a,
        {x:southEdge.x,z:-320}):null;
    const reachesMain=southEdge?!!cityRoute&&cityRoute.length>=3:null;
    return {id:link.id,from,to,adjacent,reverse,dryBothEnds,
        physical,routeOK,steps:route?.length||0,reachesMain};
   });
   // User assets and campaign vehicles are not changed in this sprint.
   const oldCount=game.vehicles.length;
   const savedSecret=game.vehicles.filter(v=>v.isSecret).length;
   game.isPaused=true;
   if(links.length){
    const a=links[0].from;
    game.camera.position.set(a.x-18,43,a.z+72);
    game.camera.lookAt(a.x,2,a.z);
    game.camera.updateProjectionMatrix();
    game.renderer.render(game.scene,game.camera);
   }
   return {city:game.currentCityKey,buildCount,buildMeters,
    surfaceCount:surfaces.length,surfaces,courtyardLinks:links.length,
    connected:graph.courtyardConnected,
    boundaryFeeders:graph.courtyardBoundaryFeeders,
    examined,carCount:oldCount,
    secretCount:savedSecret,colliders:city.buildingBoxes.length,
    sourceCorridors:graph.sourceCorridors};
  });
  report.result=result;
  console.log('CHICAGO_R69_BROWSER',JSON.stringify(result));
  assert.equal(result.city,'chicago');
  assert(result.courtyardLinks>=2,'no live alleys: '+JSON.stringify(result));
  assert.equal(result.buildCount,result.courtyardLinks);
  assert.equal(result.connected,result.courtyardLinks,
   'physical street not connected to traffic graph');
  assert.equal(result.surfaceCount,1,'streets must use one mesh');
  assert(result.surfaces[0].vertices>=result.courtyardLinks*120,
   'no pavement geometry for connected roads');
  assert(result.examined.every(l=>l.physical&&l.dryBothEnds&&
   l.adjacent&&l.reverse&&l.routeOK),
   'undrivable street in registered network');
  assert(result.boundaryFeeders>=2,
   'southern roads reach no city avenues: '+JSON.stringify(result));
  assert(result.examined.filter(l=>l.reachesMain!==null).every(l=>l.reachesMain),
   'southside alley is an isolated traffic graph island');
  assert.equal(result.secretCount,1);
  assert.equal(report.pageErrors.length,0,JSON.stringify(report.pageErrors));
  await page.screenshot({path:path.join(out,'chicago-r69-residential-lanes.png'),
   timeout:120000});
  report.status='PASS';
 }catch(error){report.status='FAIL';report.error=String(error);throw error;}
 finally{
  fs.writeFileSync(path.join(out,'chicago-r69-browser.json'),
   JSON.stringify(report,null,2));
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
