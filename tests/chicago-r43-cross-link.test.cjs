'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=require('../chicago/reference-cross-link-r43.json');
const graph=require('../chicago/reference-network.json');
const road=require('../js/world/chicago-cross-link-r43.js');
const r42=require('../js/world/chicago-south-stem-r42.js');
const r39=require('../js/world/chicago-southeast-r39.js');
const network=require('../js/world/chicago-ps1-street-network-r22.js');

test('R43 encerra uma malha R42–R39 somente com 7 arestas da referência ainda não usadas',()=>{
 assert.equal(source.sourceSHA256,graph.sourceSHA256);
 assert.equal(source.sourceJoinNodeId,799);assert.equal(source.sourceEndNodeId,792);
 assert.deepEqual(source.sourceNodeIds,[799,847,848,821,827,797,798,792]);
 assert.deepEqual(source.sourceEdgeIds,[1087,1163,1126,1125,1083,1084,1076]);
 const occupied=new Set(['reference-south-stem-r42','reference-west-lateral-r41',
  'reference-southeast-r39','reference-east-lateral-r40','reference-east-return-r38',
  'reference-north-branch-r37','reference-north-link-r36','reference-north-link-r35']
  .flatMap(name=>require('../chicago/'+name+'.json').sourceEdgeIds));
 const reconstructed=[];
 for(let i=0;i<source.sourceEdgeIds.length;i++){
  const id=source.sourceEdgeIds[i],e=graph.edges[id],
    from=source.sourceNodeIds[i],to=source.sourceNodeIds[i+1];
  assert(!occupied.has(id));
  assert(e.from===from&&e.to===to || e.from===to&&e.to===from);
  const points=e.from===from?e.pointsOBJ:[...e.pointsOBJ].reverse();
  reconstructed.push(...points.slice(i?1:0));
 }
 assert.deepEqual(source.pointsOBJ,reconstructed);
 assert.equal(source.gradedJunctionsCertified,false);
 assert.equal(source.originalPlacementCertified,false);
 assert.equal(source.missionsMigrated,false);
});

test('R43 encaixa em dois segmentos reais de asfalto e não em vértices artificiais',()=>{
 const path=road.plan(),startRoad=r42.plan().points,endRoad=r39.plan().points;
 const {predecessorJoinIndex:s,successorJoinIndex:e}=path;
 assert.equal(path.sourceJoinNodeId,799);assert.equal(path.sourceEndNodeId,792);
 assert.equal(path.width,8);assert.equal(path.junctionRadius,7);
 assert(path.predecessorJoinT>0&&path.predecessorJoinT<1);
 assert(path.successorJoinT>0&&path.successorJoinT<1);
 assert(path.adaptedSeamLength>0&&path.adaptedSeamLength<2.5);
 assert(path.adaptedEndSeamLength>0&&path.adaptedEndSeamLength<3.2);
 assert(network.distancePointSegment(path.points[0],startRoad[s],startRoad[s+1])<1e-6);
 assert(network.distancePointSegment(path.points.at(-1),endRoad[e],endRoad[e+1])<1e-6);
 const length=path.points.slice(1).reduce((sum,p,i)=>{
  const q=path.points[i],dist=Math.hypot(p.x-q.x,p.z-q.z);
  assert(dist>1e-6);return sum+dist;
 },0);
 assert(length>54&&length<95,'R43 deveria ser uma transversal curta: '+length);
 assert(path.points[0].x<90&&path.points.at(-1).x>140);
 assert.equal(path.wholeMapCertified,false);
 assert.equal(path.missionsMigrated,false);
});

test('R43 protege os dois entroncamentos de água/colisores e não invade Havana',()=>{
 assert.equal(road.prepare({preset:{id:'havana'}}),null);
 assert.throws(()=>road.prepare({preset:{id:'chicago'},isWaterAt:()=>true,
  isPointBlocked:()=>false}),/Entroncamentos R43 obstruídos/);
 assert.throws(()=>road.prepare({preset:{id:'chicago'},isWaterAt:()=>false,
  isPointBlocked:()=>true}),/Entroncamentos R43 obstruídos/);
});

test('R43 é carregada antes da construção de Chicago e registrada para pintura, radar e lotes',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const builder=fs.readFileSync('js/world/city-builder.js','utf8');
 assert(html.includes('chicago/reference-cross-link-r43.js'));
 assert(html.includes('js/world/chicago-cross-link-r43.js'));
 assert(html.indexOf('chicago-cross-link-r43.js')<html.indexOf('js/world/city-builder.js'));
 assert(builder.includes('this.chicagoReferenceCrossLinkR43=null;'));
 assert(builder.includes('DriverChicagoCrossLinkR43.prepare(this);'));
 const paintList=builder.split('DriverChicagoNorthMarkingsR33.build(this,[')[1]?.split('].filter(Boolean)')[0];
 assert(paintList&&paintList.includes('this.chicagoReferenceCrossLinkR43'));
 const list=network.sourcePaths({chicagoReferenceCrossLinkR43:road.plan()});
 assert.equal(list.length,1);assert.equal(list[0].id,'cross-link-r43');
 assert(network.SOURCE_NAMES.some(([id])=>id==='cross-link-r43'));
 assert(network.SOURCE_NAMES.length>=19);
});
