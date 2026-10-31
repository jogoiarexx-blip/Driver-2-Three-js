'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
  fs=require('node:fs');
const Road=require('../js/world/road-geometry.js');
const R48=require('../js/world/chicago-connectors-r48.js');
const R50=require('../js/world/chicago-connectors-r50.js');
global.DriverRoadGeometry=Road;
global.DriverChicagoConnectorsR48=R48;
global.DriverChicagoConnectorsR50=R50;
const Nav=require('../js/traffic/chicago-mixed-navigation-r49.js');
global.DriverChicagoMixedNavigationR49=Nav;
const Mixed=require('../js/traffic/chicago-mixed-traffic-r49.js');
const Source=require('../js/traffic/chicago-source-traffic-r51.js');

const r43=[
 {x:320,z:-160},{x:480,z:-160},{x:480,z:-40},
 {x:320,z:-40},{x:320,z:-160}
];
const r44=[
 {x:360,z:-100},{x:520,z:-100},{x:520,z:20},
 {x:360,z:20},{x:360,z:-100}
];
const length=p=>p.slice(1).reduce((n,q,i)=>
 n+Math.hypot(q.x-p[i].x,q.z-p[i].z),0);
function city(){
 return {preset:{id:'chicago'},roadExtent:320,bridgeRaised:false,
  buildSequence:1,buildingBoxes:[],
  chicagoPS1StreetNetwork:{
   sourceCorridors:2,
   radarPaths:[
    {id:'r43',width:8,provenance:'PS1-surface-reference-adapted',points:r43},
    {id:'r44',width:8,provenance:'PS1-surface-reference-adapted',points:r44},
    {id:'fake-decoration',width:8,provenance:'visual-only',
      points:[{x:1200,z:100},{x:1320,z:100}]}
   ]},
  chicagoR43BlockLoop:{points:r43,length:length(r43),closed:0},
  chicagoR44BlockLoop:{points:r44,length:length(r44),closed:0},
  isWaterAt:()=>false,isPointBlocked:()=>false,
  isTrafficGreen:()=>true};
}
test('R51 incorporates built PS1-adapted pavement outside legacy 320-unit grid',()=>{
 const c=city(),g=Nav.compile(c);
 assert.equal(g.sourceCorridors,2);
 assert(g.sourceEdges>40);
 assert(g.nodes.has('480,-160'));
 assert(g.nodes.has('520,-100'));
 assert(!g.nodes.has('1200,100'));
 assert(g.buckets instanceof Map);
 assert(g.buckets.size>0);
 const route=Nav.plan(c,{x:240,z:-160},{x:480,z:-40});
 assert(route&&route.length>10);
 assert(route.some(p=>p.x>400));
 assert.equal(route.at(-1).x,480);
 assert.equal(route.at(-1).z,-40);
 for(let i=1;i<route.length;i++)
  assert(Nav.clear(c,route[i-1],route[i],true,1.7));
});
test('R51 does not fabricate a highway across disconnected districts',()=>{
 const c=city();
 c.chicagoPS1StreetNetwork.radarPaths.push({
  id:'island',provenance:'PS1-surface-reference-adapted',
  width:8,points:[{x:920,z:700},{x:1000,z:710}]});
 const g=Nav.compile(c);
 assert(g.nodes.has('920,700'));
 assert.equal(Nav.plan(c,{x:240,z:-160},{x:920,z:700}),null);
 const next=[...c.chicagoPS1StreetNetwork.radarPaths];
 c.chicagoPS1StreetNetwork.radarPaths=next.slice(0,3);
 assert.notEqual(Nav.compile(c),g);
});
test('R51 source graph rejects blocked, submerged and excessively long fake edges',()=>{
 const c=city();
 c.isWaterAt=(x,z)=>x>=400&&x<=410&&Math.abs(z+160)<8;
 const g=Nav.compile(c);
 assert(!g.adj.get('400,-160')?.some(e=>e.key==='416,-160'));
 assert.equal(Nav.plan(c,{x:320,z:-160},{x:480,z:-160})?.at(-1).x,480);
 const bad=city();
 bad.chicagoPS1StreetNetwork.radarPaths=[{
  provenance:'PS1-surface-reference-adapted',width:8,
  points:[{x:800,z:100},{x:1200,z:100}]
 }];
 assert.equal(Nav.compile(bad).sourceEdges,0);
});
test('R51 source commuters navigate between sampled district destinations',()=>{
 const c=city(),cars=Source.spawnSpecs(c,[]);
 assert.equal(cars.length,4);
 assert(cars.every(s=>s.goals.length===4));
 assert(cars.every(s=>s.sourceLoop==='r43'||s.sourceLoop==='r44'));
 for(const spec of cars){
  const car={...spec,speed:0,chicagoMixedTrafficR49:true,
   chicagoMixedTrafficGoalsR51:spec.goals,
   chicagoMixedTrafficGoalIndex:spec.goalIndex};
  const input=Mixed.getInput(c,car,[car],.033,[]);
  assert(input&&typeof input.up==='boolean');
  assert(car.chicagoMixedTrafficStatusR49?.target);
  assert(Number.isFinite(car.chicagoMixedTrafficStatusR49.speedLimit));
 }
 assert.deepEqual(Source.spawnSpecs({...c,preset:{id:'vegas'}},[]),[]);
 assert.deepEqual(Source.spawnSpecs({...c,chicagoPS1StreetNetwork:null},[]),[]);
});
test('R51 changed script and engine load only source traffic in Chicago',()=>{
 const html=fs.readFileSync('index.html','utf8'),
  engine=fs.readFileSync('js/engine/driver2-game-engine.js','utf8');
 assert(html.includes('chicago-source-traffic-r51.js'));
 assert(html.indexOf('chicago-source-traffic-r51.js')<
  html.indexOf('traffic-ai.js'));
 assert(engine.includes('DriverChicagoSourceTrafficR51.spawnSpecs('));
 assert(engine.includes('car.chicagoMixedTrafficGoalsR51=spec.goals'));
 assert(engine.includes('this.spawnAllVehicles();'));
});
