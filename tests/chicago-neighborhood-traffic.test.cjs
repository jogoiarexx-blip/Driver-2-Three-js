'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),vm=require('node:vm');
const Traffic=require('../js/traffic/chicago-neighborhood-traffic.js');
const R43=require('../js/world/chicago-r43-block-loop.js');
const R44=require('../js/world/chicago-r44-block-loop.js');
const R39=require('../js/world/chicago-southeast-r39.js');
const R41=require('../js/world/chicago-west-lateral-r41.js');
const R42=require('../js/world/chicago-south-stem-r42.js');
const R43Street=require('../js/world/chicago-cross-link-r43.js');
const R44Street=require('../js/world/chicago-parallel-west-r44.js');
const world=()=>({
 preset:{id:'chicago'},
 chicagoR43BlockLoop:R43.build({r39:R39.plan(),r41:R41.plan(),
  r42:R42.plan(),r43:R43Street.plan()}),
 chicagoR44BlockLoop:R44.build({r41:R41.plan(),r42:R42.plan(),r44:R44Street.plan()}),
 isWaterAt:()=>false,isPointBlocked:()=>false
});
test('tráfego civil usa dois ciclos fechados reais sem inventar conexão fora de Chicago',()=>{
 const city=world(),specs=Traffic.spawnSpecs(city);
 assert.equal(specs.length,2);
 assert.deepEqual(specs.map(s=>s.id),['r43','r44']);
 assert(specs.every(s=>s.bodyStyle==='sedan'&&s.maxSpeed===12));
 assert(Math.hypot(specs[0].x-specs[1].x,specs[0].z-specs[1].z)>18);
 for(const spec of specs){
  const road=Traffic.getLoop(city,spec.id);
  const pts=Traffic.points(road,spec.reverse),
   d=Traffic.measurements(pts),
   point=Traffic.sample(pts,d,spec.distance),
   p=Traffic.project(pts,d,spec.x,spec.z,spec.distance);
  assert(Math.hypot(spec.x-point.x,spec.z-point.z)<1e-8);
  assert(p&&p.distance<1e-6);
  assert(Math.abs(d.at(-1)-road.length)<1e-5);
 }
 assert.deepEqual(Traffic.spawnSpecs({...city,preset:{id:'vegas'}}),[]);
 assert.deepEqual(Traffic.spawnSpecs({...city,isWaterAt:()=>true}),[]);
 assert.deepEqual(Traffic.spawnSpecs({...city,isPointBlocked:()=>true}),[]);
});
test('rotas não teletransportam carros, persistem após várias voltas e cruzam a emenda do início',()=>{
 const city=world(),spec=Traffic.spawnSpecs(city)[0],
  car={x:spec.x,z:spec.z,speed:0,heading:spec.heading,
   chicagoNeighborhoodTrafficId:spec.id,
   chicagoNeighborhoodTrafficPhase:spec.distance,
   chicagoNeighborhoodTrafficReverse:spec.reverse};
 const input=Traffic.getInput(city,car,[]);
 assert(input&&typeof input.up==='boolean');
 assert(Traffic.routeFor(car,city));
 assert(car.chicagoNeighborhoodTrafficStatus.updates>=1);
 const route=car.chicagoNeighborhoodTrafficRoute;
 const total=route.measurements.at(-1);
 route.progress=total-2;
 const next=Traffic.sample(route.points,route.measurements,total+1);
 const projection=Traffic.project(route.points,route.measurements,
  next.x,next.z,total-2);
 assert(projection&&Math.abs(projection.progress-(total+1))<1e-5);
 car.x=next.x;car.z=next.z;car.speed=3;
 Traffic.getInput(city,car,[]);
 assert(route.progress>total);
 assert.equal(route.laps,1);
 assert.equal(car.chicagoNeighborhoodTrafficStatus.laps,1);
});
test('somente carros civis marcados entram nas rotas R43/R44; missão, polícia e outra cidade permanecem',()=>{
 const city=world();
 for(const car of [
  {chicagoNeighborhoodTrafficId:'r43',isPolice:true},
  {chicagoNeighborhoodTrafficId:'r43',isMafia:true},
  {chicagoNeighborhoodTrafficId:'r43',isTarget:true},
  {chicagoNeighborhoodTrafficId:'r43',scriptedDrive:{}},
  {chicagoNeighborhoodTrafficId:'r43',isSecret:true},
  {chicagoNeighborhoodTrafficId:'invalid'},
  {}
 ])assert.equal(Traffic.getInput(city,car,[]),null);
 assert.equal(Traffic.getInput({...city,preset:{id:'rio'}},
  {chicagoNeighborhoodTrafficId:'r43'},[]),null);
});
test('carro local freia atrás de outro carro sem sinal fictício e sem interferir na IA da grade',()=>{
 const city=world(),spec=Traffic.spawnSpecs(city)[0],
  car={x:spec.x,z:spec.z,speed:3,heading:spec.heading,
   chicagoNeighborhoodTrafficId:spec.id,
   chicagoNeighborhoodTrafficPhase:spec.distance,
   chicagoNeighborhoodTrafficReverse:spec.reverse};
 const ahead={x:car.x+Math.sin(car.heading)*4,
  z:car.z+Math.cos(car.heading)*4,y:0};
 const input=Traffic.getInput(city,car,[ahead]);
 assert(input.down&&!input.up);
 assert.equal(car.chicagoNeighborhoodTrafficStatus.limit,0);
 const root=fs.readFileSync('js/traffic/traffic-ai.js','utf8');
 const sandbox={Math,WeakMap,Map,Set,Number,
  THREE:{MathUtils:{clamp:(n,a,b)=>Math.max(a,Math.min(b,n))}},
  DriverChicagoNeighborhoodTraffic:Traffic};
 const AI=vm.runInNewContext(root+'\nDriverTrafficAI',sandbox);
 const ai=new AI({...city,roadExtent:320});
 assert(ai.getInput(car,.05,[ahead],null,0).down);
 const original={x:16,z:12,heading:0,speed:3,bodyStyle:'sedan'};
 const result=ai.getInput(original,.05,[],null,0);
 assert(result&&typeof result.up==='boolean');
 assert(!original.chicagoNeighborhoodTrafficStatus);
 const engine=fs.readFileSync('js/engine/driver2-game-engine.js','utf8');
 const html=fs.readFileSync('index.html','utf8');
 assert(engine.includes('DriverChicagoNeighborhoodTraffic.spawnSpecs('));
 assert(engine.includes('car.chicagoNeighborhoodTrafficId=spec.id'));
 assert(html.includes('js/traffic/chicago-neighborhood-traffic.js'));
 assert(html.indexOf('chicago-neighborhood-traffic.js')<html.indexOf('traffic-ai.js'));
});
