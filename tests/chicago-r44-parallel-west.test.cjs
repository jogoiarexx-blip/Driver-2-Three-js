'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=require('../chicago/reference-parallel-west-r44.json');
const graph=require('../chicago/reference-network.json');
const R44=require('../js/world/chicago-parallel-west-r44.js');
const R41=require('../js/world/chicago-west-lateral-r41.js');
const R42=require('../js/world/chicago-south-stem-r42.js');
const Net=require('../js/world/chicago-ps1-street-network-r22.js');
const owned=[
 'reference-west-lateral-r41','reference-south-stem-r42',
 'reference-cross-link-r43','reference-southeast-r39',
 'reference-east-lateral-r40','reference-east-return-r38',
 'reference-north-branch-r37','reference-north-link-r36',
 'reference-north-link-r35'
];
test('R44 utiliza dez arestas contíguas e não repetidas da rede original',()=>{
 assert.equal(src.sourceSHA256,graph.sourceSHA256);
 assert.deepEqual(src.sourceNodeIds,[574,605,676,699,721,737,784,819,820,845,846]);
 assert.deepEqual(src.sourceEdgeIds,[784,825,917,950,978,1000,1064,1122,1124,1161]);
 assert.equal(src.sourceJoinNodeId,574);
 assert.equal(src.sourceEndNodeId,846);
 const previous=new Set(owned.flatMap(name=>require('../chicago/'+name+'.json').sourceEdgeIds));
 const seen=new Set(),points=[];
 src.sourceEdgeIds.forEach((id,i)=>{
  const e=graph.edges[id],from=src.sourceNodeIds[i],to=src.sourceNodeIds[i+1];
  assert(!seen.has(id)&&!previous.has(id),'R44 não pode repetir aresta construída');
  seen.add(id);
  assert(e.from===from&&e.to===to||e.from===to&&e.to===from);
  const ps=e.from===from?e.pointsOBJ:[...e.pointsOBJ].reverse();
  points.push(...ps.slice(i?1:0));
 });
 assert.deepEqual(src.pointsOBJ,points);
 assert.equal(src.roadClassificationCertified,false);
 assert.equal(src.gradedJunctionsCertified,false);
 assert.equal(src.originalPlacementCertified,false);
});

test('R44 encaixa suas duas extremidades em segmentos reais de R41 e R42',()=>{
 const p=R44.plan(),parent1=R41.plan().points,parent2=R42.plan().points;
 const {predecessorJoinIndex:i,successorJoinIndex:j}=p;
 assert(p.adaptedSeamLength>0&&p.adaptedSeamLength<2.5);
 assert(p.adaptedEndSeamLength>0&&p.adaptedEndSeamLength<3.2);
 assert(p.predecessorJoinT>0&&p.predecessorJoinT<1);
 assert(p.successorJoinT>0&&p.successorJoinT<1);
 assert(Net.distancePointSegment(p.points[0],parent1[i],parent1[i+1])<1e-5);
 assert(Net.distancePointSegment(p.points.at(-1),parent2[j],parent2[j+1])<1e-5);
 assert.equal(p.width,8);assert.equal(p.junctionRadius,7);
 const length=p.points.slice(1).reduce((s,x,i)=>s+Math.hypot(x.x-p.points[i].x,x.z-p.points[i].z),0);
 assert(length>125&&length<160,'Comprimento R44 anormal: '+length);
 assert(p.points[0].x>40&&p.points[0].x<60);
 assert(p.points.at(-1).x>75&&p.points.at(-1).x<90);
 assert.equal(p.wholeMapCertified,false);
 assert.equal(p.missionsMigrated,false);
});
test('nova quadra fechada na topologia da referência R41→R42→R44',()=>{
 const r41=require('../chicago/reference-west-lateral-r41.json');
 const r42=require('../chicago/reference-south-stem-r42.json');
 const parts=[
  {road:r41,from:574,to:576},
  {road:r42,from:576,to:846},
  {road:src,from:846,to:574}
 ];
 const seen=new Set();
 let numEdges=0;
 for(let i=0;i<parts.length;i++){
  const p=parts[i],a=p.road.sourceNodeIds.indexOf(p.from),
    b=p.road.sourceNodeIds.indexOf(p.to);
  assert(a!==b&&a>=0&&b>=0);
  assert.equal(p.to,parts[(i+1)%3].from);
  const edges=p.road.sourceEdgeIds.slice(Math.min(a,b),Math.max(a,b));
  for(const edge of edges){assert(!seen.has(edge));seen.add(edge);numEdges++;}
 }
 assert(numEdges>=16);
});
test('protege os dois entroncamentos e limita a nova via a Chicago',()=>{
 assert.equal(R44.prepare({preset:{id:'havana'}}),null);
 assert.throws(()=>R44.prepare({preset:{id:'chicago'},isWaterAt:()=>true,isPointBlocked:()=>false}),/Entroncamentos R44 obstruídos/);
 assert.throws(()=>R44.prepare({preset:{id:'chicago'},isWaterAt:()=>false,isPointBlocked:()=>true}),/Entroncamentos R44 obstruídos/);
});
test('R44 aparece na construção, no radar e nas pinturas sem afetar missões',()=>{
 const html=fs.readFileSync('index.html','utf8'),world=fs.readFileSync('js/world/city-builder.js','utf8');
 assert(html.includes('chicago/reference-parallel-west-r44.js'));
 assert(html.includes('js/world/chicago-parallel-west-r44.js'));
 assert(html.indexOf('chicago-parallel-west-r44.js')<html.indexOf('js/world/city-builder.js'));
 assert(world.includes('this.chicagoReferenceParallelWestR44=null;'));
 assert(world.includes('DriverChicagoParallelWestR44.prepare(this);'));
 const painter=world.split('DriverChicagoNorthMarkingsR33.build(this,[')[1]?.split('].filter(Boolean)')[0];
 assert(painter&&painter.includes('this.chicagoReferenceParallelWestR44'));
 const routes=Net.sourcePaths({chicagoReferenceParallelWestR44:R44.plan()});
 assert.equal(routes.length,1);assert.equal(routes[0].id,'parallel-west-r44');
 assert(Net.SOURCE_NAMES.some(([id])=>id==='parallel-west-r44'));
 assert(Net.SOURCE_NAMES.length>=20);
});
