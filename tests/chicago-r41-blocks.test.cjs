'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Road=require('../js/world/chicago-west-lateral-r41.js');
const Lots=require('../js/world/chicago-north-roadside-r32.js');
const Markings=require('../js/world/chicago-north-markings-r33.js');
const Network=require('../js/world/chicago-ps1-street-network-r22.js');
const path={id:'west-lateral-r41',points:Road.plan().points,width:8};
const city=()=>({preset:{id:'chicago'},worldBounds:{minX:-560,maxX:432,minZ:-432,maxZ:1392},
 buildingBoxes:[],isPointBlocked:()=>false,isWaterAt:()=>false,
 districtBuildings:[],districtChunks:new Map()});

test('R41 cria quadras comerciais e residenciais com recuo de via',()=>{
 const lots=Lots.plan(city(),[path]);
 assert(lots.length>=8,'quadras insuficientes ao redor da R41');
 assert(lots.some(l=>l.kind==='commercial'),'faltam lojas de bairro');
 assert(lots.some(l=>l.kind==='residential'),'faltam casas baixas');
 assert(lots.every(l=>l.approximateZoning===true&&l.sourceCorridorId===path.id));
 for(const lot of lots){
  const center={x:lot.x,z:lot.z};
  const d=Math.min(...path.points.slice(1).map((b,i)=>Lots.pointSegment(center,path.points[i],b)));
  assert(d>=Math.SQRT2*5.5+path.width/2+1-1e-6,'lote invade corredor');
 }
});

test('R41 mantém água, bloqueios e cidades alheias fora de lotes novos',()=>{
 const other=city();other.preset.id='rio';
 assert.equal(Lots.plan(other,[path]).length,0);
 const wet=city();wet.isWaterAt=()=>true;
 assert.equal(Lots.plan(wet,[path]).length,0);
 const blocked=city();blocked.isPointBlocked=()=>true;
 assert.equal(Lots.plan(blocked,[path]).length,0);
 const crowded=city();crowded.buildingBoxes=[{minX:-500,maxX:500,minZ:800,maxZ:980}];
 assert.equal(Lots.plan(crowded,[path]).length,0);
});

test('lotes e fachadas compartilham os mesmos AABBs de colisão',()=>{
 const c=city(),planned=Lots.plan(c,[path]),created=Lots.build(c,[path]);
 assert.equal(created.length,planned.length);
 assert.equal(c.districtBuildings.length,created.length);
 assert.equal(c.buildingBoxes.length,created.length);
 for(let i=0;i<created.length;i++){
  const lot=created[i],box=c.buildingBoxes[i];
  assert.equal(box.minX,lot.x-lot.width/2);
  assert.equal(box.maxZ,lot.z+lot.depth/2);
 }
 assert(c.districtChunks.size>0);
});

test('faixas centrais da R41 ficam sobre asfalto e são desenhadas em lote',()=>{
 const dashes=Markings.dashes(path.points);
 assert(dashes.length>6);
 for(const dash of dashes){
  for(const p of [dash.a,dash.b]){
   const d=Math.min(...path.points.slice(1).map((b,i)=>Network.distancePointSegment(p,path.points[i],b)));
   assert(d<1e-5,'marcação saiu do pavimento');
  }
 }
 const builder=fs.readFileSync('js/world/city-builder.js','utf8');
 assert(builder.includes('this.chicagoReferenceWestLateralR41'));
 assert(builder.includes('this.chicagoReferenceEastLateralR40'));
 assert(builder.includes('DriverChicagoNorthMarkingsR33.build(this,['));
});
