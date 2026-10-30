'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Net=require('../js/world/chicago-ps1-street-network-r22.js');
const Curve=require('../js/world/chicago-ps1-reference-curve.js');
const R16=require('../js/world/chicago-ps1-reference-extension.js');
const R17=require('../js/world/chicago-ps1-reference-loop.js');
const R18=require('../js/world/chicago-ps1-reference-bridge.js');
const R19=require('../js/world/chicago-ps1-reference-north-network.js');
const R20=require('../js/world/chicago-ps1-reference-arterial.js');
const R23=require('../js/world/chicago-ps1-north-candidate-r23.js');
const road=[
 ['chicagoReferenceCurve',Curve.plan()],
 ['chicagoReferenceExtension',R16.plan()],
 ['chicagoReferenceLoop',R17.plan()],
 ['chicagoReferenceBridge',R18.plan()],
 ['chicagoReferenceArterial',R20.plan()],
 ['chicagoReferenceNorthCandidateR23',R23.plan()]
];
function city(){
 const o={preset:{id:'chicago'},buildingBoxes:[],
  cityGroup:{children:[]},
  isWaterAt:()=>false,isPointBlocked:()=>false,
  chicagoReferenceNorthNetwork:{segments:R19.plans()}};
 for(const [key,plan] of road)o[key]=plan;
 return o;
}
test('R22 combines nine surveyed/source-candidate corridors and one proposed grid feeder',()=>{
 const c=city(),paths=Net.sourcePaths(c);
 assert.equal(paths.length,9);
 assert.deepEqual(paths.map(p=>p.id),[
  'curve','extension','loop','bridge','north-stem',
  'north-continuation','north-branch','west-arterial',
  'western-extension-r23'
 ]);
 assert(paths.every(p=>p.provenance==='PS1-surface-reference-adapted'));
 const [link]=Net.connectionPlan(c);
 const branch=R19.plans().branch.points.at(-1);
 assert.equal(link.from.x,branch.x);
 assert.equal(link.from.z,branch.z);
 assert.deepEqual(link.to,{x:-240,z:320});
 assert(link.width>=7&&link.width<=10);
});
test('connector checks entire lane width and refuses water and buildings',()=>{
 const c=city(),link=Net.connectionPlan(c)[0];
 const ok=Net.checkConnector(c,link);
 assert(ok.valid,JSON.stringify(ok));
 assert(ok.length>20&&ok.length<90);
 assert(ok.pointsTested>30);
 c.isWaterAt=(x,z)=>x>-254;
 assert.equal(Net.checkConnector(c,link).reason,'water');
 c.isWaterAt=()=>false;c.isPointBlocked=(x,z)=>x> -249;
 assert.equal(Net.checkConnector(c,link).reason,'collision');
});
test('building before the branch prevents adding decorative unsafe road',()=>{
 const c=city(),link=Net.connectionPlan(c)[0];
 c.isPointBlocked=(x,z)=>Math.hypot(x-link.from.x,z-link.from.z)<10;
 const r=Net.build(c);
 assert.equal(r.connectorsAccepted,0);
 assert.equal(r.connectorsRejected[0].reason,'collision');
 assert.equal(r.radarPaths.length,9);
 assert.equal(r.missionsMigrated,false);
 assert.equal(r.wholePS1MapCertified,false);
 assert.equal(Net.build(c),r,'multiple calls cannot duplicate connectors');
});
test('source paths remain unmodified when simplifying the minimap',()=>{
 const c=city();
 const original=JSON.stringify(R20.plan().points);
 const p=Net.build(c);
 assert.equal(p.sourceCorridors,9);
 assert.equal(p.connectorsAccepted,1);
 assert.equal(p.radarPaths.length,10);
 assert.equal(JSON.stringify(R20.plan().points),original);
 for(const path of p.radarPaths)assert(path.points.length>=2);
 const r=Net.simplify(R20.plan().points,1.15);
 assert.deepEqual(r[0],R20.plan().points[0]);
 assert.deepEqual(r.at(-1),R20.plan().points.at(-1));
 assert(r.length<R20.plan().points.length);
});
test('radar uses original source paths and distinguishes inferred connector',()=>{
 const c=city();Net.build(c);
 const render={saved:0,restored:0,strokes:[],color:'',
  save(){this.saved++},restore(){this.restored++},
  beginPath(){},moveTo(){},lineTo(){},
  stroke(){this.strokes.push(this.strokeStyle)}};
 const n=Net.drawRadar(render,c,{x:-300,z:310},.5,480,480);
 assert(n>2&&n<=10);
 assert.equal(render.saved,1);
 assert.equal(render.restored,1);
 assert(render.strokes.includes('#8fa1aa'));
 assert(render.strokes.includes('#c4bfab'));
 const none=Net.drawRadar(render,c,{x:0,z:-900},.5,240,240);
 assert.equal(none,0);
});
test('R22 loads before CityBuilder; route layers only apply to Chicago',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const engine=fs.readFileSync('js/engine/driver2-game-engine.js','utf8');
 const builder=fs.readFileSync('js/world/city-builder.js','utf8');
 assert(html.indexOf('chicago-ps1-street-network-r22.js')>0);
 assert(html.indexOf('chicago-ps1-street-network-r22.js')<
        html.indexOf('js/world/city-builder.js'));
 assert.match(builder,/DriverChicagoPS1StreetNetwork\.build\(this\)/);
 assert.match(engine,/DriverChicagoPS1StreetNetwork\.drawRadar\(ctx,this\.city,/);
 const c=city();c.preset.id='havana';
 assert.equal(Net.build(c),null);
 assert.equal(c.chicagoPS1StreetNetwork,undefined);
});
