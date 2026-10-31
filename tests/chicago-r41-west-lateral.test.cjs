'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Source=require('../chicago/reference-west-lateral-r41.json');
const Graph=require('../chicago/reference-network.json');
const Road=require('../js/world/chicago-west-lateral-r41.js');
const Parent=require('../js/world/chicago-southeast-r39.js');
const Net=require('../js/world/chicago-ps1-street-network-r22.js');

test('R41 guarda 25 arestas contíguas e inéditas da rede de origem',()=>{
 assert.equal(Source.sourceSHA256,Graph.sourceSHA256);
 assert.equal(Source.sourceJoinNodeId,601);
 assert.equal(Source.sourceEndNodeId,571);
 assert.equal(Source.sourceEdgeIds.length,25);
 assert.equal(Source.sourceNodeIds.length,26);
 assert.equal(Source.sourceNodeIds[0],601);
 assert.equal(Source.sourceNodeIds.at(-1),571);
 const roads=['reference-southeast-r39','reference-east-lateral-r40',
  'reference-east-return-r38','reference-north-branch-r37',
  'reference-north-link-r36','reference-north-link-r35'];
 const used=new Set(roads.flatMap(r=>require('../chicago/'+r+'.json').sourceEdgeIds));
 const seen=new Set(),points=[];
 for(let i=0;i<Source.sourceEdgeIds.length;i++){
  const id=Source.sourceEdgeIds[i],edge=Graph.edges[id],
   from=Source.sourceNodeIds[i],to=Source.sourceNodeIds[i+1];
  assert(!used.has(id),'R41 não pode duplicar uma via construída');
  assert(!seen.has(id),'R41 tem aresta duplicada');seen.add(id);
  assert(edge.from===from&&edge.to===to||edge.from===to&&edge.to===from);
  const p=edge.from===from?edge.pointsOBJ:[...edge.pointsOBJ].reverse();
  points.push(...p.slice(i?1:0));
 }
 assert.deepEqual(Source.pointsOBJ,points);
 assert.deepEqual(Source.pointsOBJ[0],Graph.nodes.find(n=>n.id===601).pointOBJ);
 assert.equal(Source.roadClassificationCertified,false);
 assert.equal(Source.gradedJunctionsCertified,false);
});

test('R41 conecta no segmento da R39 e amplia oeste aproximadamente 256 unidades',()=>{
 const parent=Parent.plan().points,path=Road.plan(),start=path.points[0];
 assert(path.predecessorJoinIndex>=0);
 assert(path.predecessorJoinT>0&&path.predecessorJoinT<1);
 assert(path.adaptedSeamLength>0&&path.adaptedSeamLength<3);
 const a=parent[path.predecessorJoinIndex],b=parent[path.predecessorJoinIndex+1];
 assert(Net.distancePointSegment(start,a,b)<1e-6);
 assert.equal(path.sourceJoinNodeId,601);
 assert.equal(path.width,8);
 assert.equal(path.junctionRadius,8);
 assert.deepEqual(path.points.at(-1),Road.fitPoint(Source.pointsOBJ.at(-1)));
 assert(path.points.length>30);
 const length=path.points.slice(1).reduce((total,p,i)=>{
  const d=Math.hypot(p.x-path.points[i].x,p.z-path.points[i].z);
  assert(d>1e-6,'segmento de comprimento zero');return total+d;
 },0);
 assert(length>240&&length<280,'comprimento R41 inesperado: '+length);
 assert(path.points.at(-1).x< -90 && path.points.at(-1).x> -110);
 assert(path.points.at(-1).z>880 && path.points.at(-1).z<910);
 assert.equal(path.originalPlacementCertified,false);
 assert.equal(path.wholeMapCertified,false);
 assert.equal(path.missionsMigrated,false);
});

test('R41 não altera outras cidades e o entroncamento bloqueia água e prédios',()=>{
 assert.equal(Road.prepare({preset:{id:'havana'}}),null);
 assert.throws(()=>Road.prepare({preset:{id:'chicago'},isWaterAt:()=>true,
  isPointBlocked:()=>false}),/Entroncamento R41 obstruído/);
 assert.throws(()=>Road.prepare({preset:{id:'chicago'},isWaterAt:()=>false,
  isPointBlocked:()=>true}),/Entroncamento R41 obstruído/);
});

test('R41 participa do mapa, render e radar na ordem correta',()=>{
 const html=fs.readFileSync('index.html','utf8'),builder=fs.readFileSync('js/world/city-builder.js','utf8');
 assert(html.includes('chicago/reference-west-lateral-r41.js'));
 assert(html.includes('js/world/chicago-west-lateral-r41.js'));
 assert(html.indexOf('chicago-west-lateral-r41.js')<html.indexOf('js/world/city-builder.js'));
 assert(builder.includes('this.chicagoReferenceWestLateralR41=null;'));
 assert(builder.includes('DriverChicagoWestLateralR41.prepare(this);'));
 const paths=Net.sourcePaths({chicagoReferenceWestLateralR41:Road.plan()});
 assert.equal(paths.length,1);assert.equal(paths[0].id,'west-lateral-r41');
 assert.equal(paths[0].width,8);
 assert.equal(Net.SOURCE_NAMES.length,17);
});
