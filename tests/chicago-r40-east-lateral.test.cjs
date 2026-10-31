'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const Source=require('../chicago/reference-east-lateral-r40.json');
const Graph=require('../chicago/reference-network.json');
const R39=require('../chicago/reference-southeast-r39.json');
const Road=require('../js/world/chicago-east-lateral-r40.js');
const Parent=require('../js/world/chicago-southeast-r39.js');
const Network=require('../js/world/chicago-ps1-street-network-r22.js');

test('R40 nasce no nó 918 de R39, usa 32 arestas genuínas sem reuso',()=>{
 assert.equal(Source.sourceSHA256,Graph.sourceSHA256);
 assert.equal(Source.sourceJoinNodeId,918);
 assert.equal(Source.sourceEndNodeId,1006);
 assert.equal(Source.sourceEdgeIds.length,32);
 assert.equal(Source.sourceNodeIds.length,33);
 assert.equal(Source.sourceNodeIds[0],918);
 assert.equal(Source.sourceNodeIds.at(-1),1006);
 const occupied=new Set([
  ...require('../chicago/reference-east-return-r38.json').sourceEdgeIds,
  ...require('../chicago/reference-north-branch-r37.json').sourceEdgeIds,
  ...require('../chicago/reference-north-link-r36.json').sourceEdgeIds,
  ...require('../chicago/reference-north-link-r35.json').sourceEdgeIds,
  ...R39.sourceEdgeIds
 ]);
 const seen=new Set(),points=[];
 for(let i=0;i<Source.sourceEdgeIds.length;i++){
  const id=Source.sourceEdgeIds[i],edge=Graph.edges[id];
  assert(!occupied.has(id),'R40 não deve repetir as vias construídas');
  assert(!seen.has(id),'R40 possui aresta duplicada');
  seen.add(id);
  const from=Source.sourceNodeIds[i],to=Source.sourceNodeIds[i+1];
  assert(edge.from===from&&edge.to===to || edge.from===to&&edge.to===from);
  const p=edge.from===from?edge.pointsOBJ:[...edge.pointsOBJ].reverse();
  points.push(...p.slice(i?1:0));
 }
 assert.deepEqual(Source.pointsOBJ,points);
 assert.deepEqual(Source.pointsOBJ[0],Graph.nodes.find(n=>n.id===918).pointOBJ);
 assert.equal(Source.originalPlacementCertified,false);
 assert.equal(Source.roadClassificationCertified,false);
 assert.equal(Source.gradedJunctionsCertified,false);
});

test('R40 encontra o pavimento suavizado R39 e amplia cerca de 160 unidades para leste',()=>{
 const path=Road.plan(),parent=Parent.plan();
 assert.deepEqual(path.points[0],parent.points[path.predecessorJoinIndex]);
 assert(path.adaptedSeamLength>0 && path.adaptedSeamLength<3);
 assert.equal(path.sourceJoinNodeId,918);
 assert.equal(path.width,8);
 assert.equal(path.junctionRadius,8);
 assert(path.points.length>35);
 assert.deepEqual(path.points.at(-1),Road.fitPoint(Source.pointsOBJ.at(-1)));
 const length=path.points.slice(1).reduce((n,p,i)=>{
  const a=path.points[i],d=Math.hypot(p.x-a.x,p.z-a.z);
  assert(d>0.00001,'nenhum segmento pode ter comprimento zero');
  return n+d;
 },0);
 assert(length>150&&length<190,'corredor lateral de tamanho inesperado: '+length);
 assert(path.points.at(-1).x>305 && path.points.at(-1).x<320);
 assert(path.points.at(-1).z>760 && path.points.at(-1).z<790);
 assert.equal(path.originalPlacementCertified,false);
 assert.equal(path.wholeMapCertified,false);
 assert.equal(path.missionsMigrated,false);
});

test('R40 é exclusivo de Chicago e o entroncamento recusa áreas alagadas',()=>{
 assert.equal(Road.prepare({preset:{id:'havana'}}),null);
 assert.throws(()=>Road.prepare({preset:{id:'chicago'},isWaterAt:()=>true,
  isPointBlocked:()=>false}),/Entroncamento lateral R40 obstruído/);
 assert.throws(()=>Road.prepare({preset:{id:'chicago'},isWaterAt:()=>false,
  isPointBlocked:()=>true}),/Entroncamento lateral R40 obstruído/);
});

test('R40 é carregada antes do CityBuilder e participa do radar',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const builder=fs.readFileSync('js/world/city-builder.js','utf8');
 assert(html.includes('chicago/reference-east-lateral-r40.js'));
 assert(html.includes('js/world/chicago-east-lateral-r40.js'));
 assert(html.indexOf('chicago-east-lateral-r40.js')<html.indexOf('js/world/city-builder.js'));
 assert(builder.includes('this.chicagoReferenceEastLateralR40=null;'));
 assert(builder.includes('DriverChicagoEastLateralR40.prepare(this);'));
 const src=Network.sourcePaths({chicagoReferenceEastLateralR40:Road.plan()});
 assert.equal(src.length,1);
 assert.equal(src[0].id,'east-lateral-r40');
 assert.equal(src[0].width,8);
 assert(Network.SOURCE_NAMES.some(([id])=>id==='east-lateral-r40'));
 assert(Network.SOURCE_NAMES.length>=16);
});
