'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Loop=require('../js/world/chicago-r44-block-loop.js');
const R41=require('../js/world/chicago-west-lateral-r41.js');
const R42=require('../js/world/chicago-south-stem-r42.js');
const R44=require('../js/world/chicago-parallel-west-r44.js');
const Net=require('../js/world/chicago-ps1-street-network-r22.js');
const roads=()=>({r41:R41.plan(),r42:R42.plan(),r44:R44.plan()});

test('quadra R41–R42–R44 é um circuito fechado no asfalto construído',()=>{
 const L=Loop.build(roads());
 assert.equal(L.legs.length,3);
 assert.deepEqual(L.legs.map(l=>l.id),[
  'west-lateral-r41','south-stem-r42','parallel-west-r44'
 ]);
 assert(L.length>220&&L.length<305,'comprimento inesperado '+L.length);
 assert(L.points.length>25);
 assert(L.closed<1e-5);
 assert.deepEqual(L.points[0],L.points.at(-1));
 assert.equal(L.sourceCorridorCount,3);
 assert.equal(L.originalPlacementCertified,false);
 assert.equal(L.missionsMigrated,false);
 for(let i=0;i<L.legs.length;i++){
  const leg=L.legs[i],next=L.legs[(i+1)%3];
  assert(leg.length>18);
  assert(Math.hypot(leg.points.at(-1).x-next.points[0].x,
    leg.points.at(-1).z-next.points[0].z)<1e-5,'entroncamento desconectado');
  const road=roads()[['r41','r42','r44'][i]];
  for(const point of leg.points){
   const dist=Math.min(...road.points.slice(1).map((b,j)=>
    Net.distancePointSegment(point,road.points[j],b)));
   assert(dist<1e-5,'circuito fora do pavimento '+leg.id);
  }
 }
});
test('a mesma quadra suporta geometria no sentido inverso sem criar outro corredor',()=>{
 const loop=Loop.build(roads()),points=[...loop.points].reverse();
 const length=points.slice(1).reduce((n,p,i)=>
  n+Math.hypot(p.x-points[i].x,p.z-points[i].z),0);
 assert(Math.abs(length-loop.length)<1e-5);
 assert.deepEqual(points[0],points.at(-1));
});
test('R44 rejeita falta de geometria e ligações fictícias entre ruas',()=>{
 assert.throws(()=>Loop.build({}),/requires/);
 const p=roads(),broken={...p,r44:{...p.r44,points:p.r44.points.map(q=>({x:q.x+20,z:q.z+20}))}};
 assert.throws(()=>Loop.build(broken),/outside connected asphalt|disconnected junction/);
});
test('as duas quadras continuam separadas de saves e da campanha',()=>{
 const html=fs.readFileSync('index.html','utf8'),
  builder=fs.readFileSync('js/world/city-builder.js','utf8');
 assert(html.includes('js/world/chicago-r44-block-loop.js'));
 assert(html.indexOf('js/world/chicago-r44-block-loop.js')<html.indexOf('js/world/city-builder.js'));
 assert(builder.includes('this.chicagoR44BlockLoop=null;'));
 assert(builder.includes('DriverChicagoR44BlockLoop.fromCity(this)'));
 assert(builder.includes('this.chicagoR43BlockLoop'));
});
