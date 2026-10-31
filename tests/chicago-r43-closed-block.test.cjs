'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const r39=require('../chicago/reference-southeast-r39.json');
const r41=require('../chicago/reference-west-lateral-r41.json');
const r42=require('../chicago/reference-south-stem-r42.json');
const r43=require('../chicago/reference-cross-link-r43.json');
const net=require('../chicago/reference-network.json');
const Road=require('../js/world/chicago-cross-link-r43.js');
const Network=require('../js/world/chicago-ps1-street-network-r22.js');
const Lots=require('../js/world/chicago-north-roadside-r32.js');

function between(road,from,to){
 const a=road.sourceNodeIds.indexOf(from),b=road.sourceNodeIds.indexOf(to);
 assert(a>=0&&b>=0&&a!==b,road.format+' incomplete loop');
 const ids=road.sourceEdgeIds.slice(Math.min(a,b),Math.max(a,b));
 return a<b?ids:[...ids].reverse();
}
const loop=[
 {from:601,to:576,road:r41},
 {from:576,to:799,road:r42},
 {from:799,to:792,road:r43},
 {from:792,to:601,road:r39}
];
test('grafo da referência prova ciclo fechado R39→R41→R42→R43, sem reutilizar segmento',()=>{
 const seen=new Set(),cycle=[];
 for(const part of loop){
  const chain=between(part.road,part.from,part.to);
  assert(chain.length>=4,part.road.format);
  for(const id of chain){assert(!seen.has(id),'segmento repetido no ciclo de quadra');seen.add(id);}
  cycle.push(...chain);
 }
 assert(cycle.length>=30);
 assert.equal(loop[0].from,loop.at(-1).to);
 for(let i=0;i<loop.length;i++){
  const a=loop[i],b=loop[(i+1)%loop.length];
  assert.equal(a.to,b.from);
  const from=net.nodes.find(n=>n.id===a.from),
    to=net.nodes.find(n=>n.id===a.to);
  assert(from&&to);
 }
 assert.equal(r43.sourceJoinNodeId,799);
 assert.equal(r43.sourceEndNodeId,792);
});

test('nova quadra possui solo secável, vias protegidas e distância segura de lotes vizinhos',()=>{
 const p39={id:'southeast-r39',points:require('../js/world/chicago-southeast-r39.js').plan().points,width:8};
 const p41={id:'west-lateral-r41',points:require('../js/world/chicago-west-lateral-r41.js').plan().points,width:8};
 const p42={id:'south-stem-r42',points:require('../js/world/chicago-south-stem-r42.js').plan().points,width:8};
 const p43={id:'cross-link-r43',points:Road.plan().points,width:8};
 const paths=[p39,p41,p42,p43];
 const city={preset:{id:'chicago'},worldBounds:{minX:-560,maxX:432,minZ:-432,maxZ:1392},
  buildingBoxes:[],isPointBlocked:()=>false,isWaterAt:()=>false};
 const lots=Lots.plan(city,paths);
 assert(lots.length>=5,'quadra residencial sem construções geradas');
 for(const lot of lots){
  const center={x:lot.x,z:lot.z};
  for(const road of paths){
   const d=Math.min(...road.points.slice(1).map((b,i)=>Lots.pointSegment(center,road.points[i],b)));
   assert(d>=Math.SQRT2*5.5+road.width/2+1-1e-6,
    'lote invade pavimento do quarteirão '+road.id);
  }
 }
 const wet={...city,isWaterAt:()=>true};
 assert.equal(Lots.plan(wet,paths).length,0);
 const blocked={...city,isPointBlocked:()=>true};
 assert.equal(Lots.plan(blocked,paths).length,0);
 assert.equal(Network.SOURCE_NAMES.some(([id])=>id==='cross-link-r43'),true);
});
