'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Loop=require('../js/world/chicago-r43-block-loop.js');
const Net=require('../js/world/chicago-ps1-street-network-r22.js');
const R39=require('../js/world/chicago-southeast-r39.js');
const R41=require('../js/world/chicago-west-lateral-r41.js');
const R42=require('../js/world/chicago-south-stem-r42.js');
const R43=require('../js/world/chicago-cross-link-r43.js');
const roads=()=>({r39:R39.plan(),r41:R41.plan(),r42:R42.plan(),r43:R43.plan()});
test('circuito R41 → R42 → R43 → R39 fecha quatro ruas sem emenda virtual',()=>{
 const L=Loop.build(roads());
 assert.equal(L.legs.length,4);
 assert.deepEqual(L.legs.map(x=>x.id),[
  'west-lateral-r41','south-stem-r42','cross-link-r43','southeast-r39'
 ]);
 assert(L.length>270&&L.length<370,'perímetro inesperado: '+L.length);
 assert(L.points.length>24);
 assert(L.closed<1e-5);
 assert.deepEqual(L.points[0],L.points.at(-1));
 assert.equal(L.originalPlacementCertified,false);
 assert.equal(L.gradedJunctionsCertified,false);
 assert.equal(L.missionsMigrated,false);
 for(const [i,leg] of L.legs.entries()){
  assert(leg.length>15&&leg.length<130);
  assert(leg.points.length>=2);
  const next=L.legs[(i+1)%4];
  assert(Math.hypot(leg.points.at(-1).x-next.points[0].x,
     leg.points.at(-1).z-next.points[0].z)<1e-5,
    'emenda desconectada '+leg.id);
  for(const p of leg.points){
   const road=roads()[['r41','r42','r43','r39'][i]];
   const min=Math.min(...road.points.slice(1).map((b,j)=>
     Net.distancePointSegment(p,road.points[j],b)));
   assert(min<1e-5,'percurso saiu do centro do pavimento '+leg.id);
  }
 }
 for(let i=1;i<L.points.length;i++)
  assert(Math.hypot(L.points[i].x-L.points[i-1].x,L.points[i].z-L.points[i-1].z)>1e-5,
   'vértice repetido ou divisão sem comprimento '+i);
});
test('direção reversa preserva a mesma geometria e todas as quatro junções',()=>{
 const L=Loop.build(roads()),rev=[...L.points].reverse();
 let len=0;for(let i=1;i<rev.length;i++)
  len+=Math.hypot(rev[i].x-rev[i-1].x,rev[i].z-rev[i-1].z);
 assert(Math.abs(len-L.length)<1e-5);
 assert.equal(rev.length,L.points.length);
 assert.deepEqual(rev[0],rev.at(-1));
});
test('não certifica circuito com ruas faltantes ou pontos de junção desconectados',()=>{
 assert.throws(()=>Loop.build({}),/required/);
 const r=roads();
 assert.throws(()=>Loop.build({...r,r43:{...r.r43,points:r.r43.points.map(p=>({x:p.x+10,z:p.z+10}))}}),/outside connected asphalt|disconnected intersection/);
});
test('circuito é carregado no Undercover, não em outras cidades e preserva missões',()=>{
 const html=fs.readFileSync('index.html','utf8'),builder=fs.readFileSync('js/world/city-builder.js','utf8');
 assert(html.includes('js/world/chicago-r43-block-loop.js'));
 assert(html.indexOf('js/world/chicago-r43-block-loop.js')<html.indexOf('js/world/city-builder.js'));
 assert(builder.includes('this.chicagoR43BlockLoop=null;'));
 assert(builder.includes('DriverChicagoR43BlockLoop.fromCity(this)'));
 const missing={};
 assert.throws(()=>Loop.fromCity(missing),/required/);
});
