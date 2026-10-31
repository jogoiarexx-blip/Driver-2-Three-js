'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Road=require('../js/world/chicago-south-stem-r42.js');
const Lots=require('../js/world/chicago-north-roadside-r32.js');
const Markings=require('../js/world/chicago-north-markings-r33.js');
const Network=require('../js/world/chicago-ps1-street-network-r22.js');
const road={id:'south-stem-r42',points:Road.plan().points,width:8};
const city=()=>({preset:{id:'chicago'},
 worldBounds:{minX:-560,maxX:432,minZ:-432,maxZ:1392},
 buildingBoxes:[],isPointBlocked:()=>false,isWaterAt:()=>false,
 districtBuildings:[],districtChunks:new Map()});

test('R42 organiza imóveis residenciais e comércio de baixa altura fora da pista',()=>{
 const planned=Lots.plan(city(),[road]);
 assert(planned.length>=6,'R42 deveria possuir fachadas laterais');
 assert(planned.some(l=>l.kind==='commercial'),'R42 precisa de comércio misto');
 assert(planned.some(l=>l.kind==='residential'),'R42 precisa de residências');
 assert(planned.every(l=>l.sourceCorridorId===road.id&&l.approximateZoning));
 for(const lot of planned){
  const delta=Math.min(...road.points.slice(1).map((p,i)=>
   Lots.pointSegment({x:lot.x,z:lot.z},road.points[i],p)));
  assert(delta>=Math.SQRT2*5.5+road.width/2+1-1e-6,
   'lote invade via dirigível');
 }
});

test('R42 evita água, prédios existentes, outros mapas e vias adjacentes',()=>{
 const rio=city();rio.preset.id='rio';
 assert.equal(Lots.plan(rio,[road]).length,0);
 const wet=city();wet.isWaterAt=()=>true;
 assert.equal(Lots.plan(wet,[road]).length,0);
 const blocked=city();blocked.isPointBlocked=()=>true;
 assert.equal(Lots.plan(blocked,[road]).length,0);
 const full=city();full.buildingBoxes=[{minX:-500,maxX:500,minZ:400,maxZ:1200}];
 assert.equal(Lots.plan(full,[road]).length,0);
 const original=city(),same=Lots.plan(original,[road]);
 assert.equal(JSON.stringify(same),JSON.stringify(Lots.plan(original,[road])),
  'R42 deve gerar lotes determinísticos');
});

test('R42 preserva colisores idênticos às fachadas renderizadas e chunks LOD',()=>{
 const c=city(),lots=Lots.build(c,[road]);
 assert(lots.length>5);
 assert.equal(lots.length,c.districtBuildings.length);
 assert.equal(lots.length,c.buildingBoxes.length);
 for(let i=0;i<lots.length;i++){
  const b=lots[i],box=c.buildingBoxes[i];
  assert.equal(box.minX,b.x-b.width/2);
  assert.equal(box.maxZ,b.z+b.depth/2);
  assert.equal(box.adaptedR32,true);
 }
 assert(c.districtChunks.size>0);
});

test('R42 marca o centro do próprio traçado em um único lote de geometria',()=>{
 const marks=Markings.dashes(road.points);
 assert(marks.length>10);
 for(const d of marks)for(const point of [d.a,d.b]){
  const distance=Math.min(...road.points.slice(1).map((p,i)=>
   Network.distancePointSegment(point,road.points[i],p)));
  assert(distance<1e-5,'faixa pintada fora da via');
 }
});
