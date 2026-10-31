'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Source=require('../chicago/reference-south-stem-r42.json');
const Graph=require('../chicago/reference-network.json');
const Road=require('../js/world/chicago-south-stem-r42.js');
const Parent=require('../js/world/chicago-west-lateral-r41.js');
const Network=require('../js/world/chicago-ps1-street-network-r22.js');

test('R42 usa 8 arestas inéditas, contíguas, com origem 576 e destino 1187',()=>{
 assert.equal(Source.sourceSHA256,Graph.sourceSHA256);
 assert.equal(Source.sourceJoinNodeId,576);
 assert.equal(Source.sourceEndNodeId,1187);
 assert.equal(Source.sourceEdgeIds.length,8);
 assert.equal(Source.sourceNodeIds.length,9);
 const used=new Set([
  'reference-west-lateral-r41','reference-southeast-r39',
  'reference-east-lateral-r40','reference-east-return-r38',
  'reference-north-branch-r37','reference-north-link-r36',
  'reference-north-link-r35'
 ].flatMap(f=>require('../chicago/'+f+'.json').sourceEdgeIds));
 const seen=new Set(),points=[];
 for(let i=0;i<Source.sourceEdgeIds.length;i++){
  const id=Source.sourceEdgeIds[i],e=Graph.edges[id],
    from=Source.sourceNodeIds[i],to=Source.sourceNodeIds[i+1];
  assert(!used.has(id)&&!seen.has(id),'R42 não pode reutilizar arestas');
  seen.add(id);
  assert(e.from===from&&e.to===to || e.from===to&&e.to===from);
  const segment=e.from===from?e.pointsOBJ:[...e.pointsOBJ].reverse();
  points.push(...segment.slice(i?1:0));
 }
 assert.deepEqual(points,Source.pointsOBJ);
 assert.equal(Source.originalPlacementCertified,false);
 assert.equal(Source.gradedJunctionsCertified,false);
});

test('R42 encaixa fisicamente na R41 e segue cerca de 200 unidades ao sul',()=>{
 const p=Road.plan(),prior=Parent.plan().points,idx=p.predecessorJoinIndex;
 const join=p.points[0],a=prior[idx],b=prior[idx+1];
 assert(p.adaptedSeamLength<2.5);
 assert(p.predecessorJoinT>0&&p.predecessorJoinT<1);
 assert(Network.distancePointSegment(join,a,b)<1e-6);
 assert.equal(p.width,8);assert.equal(p.junctionRadius,8);
 assert.deepEqual(p.points.at(-1),Road.fitPoint(Source.pointsOBJ.at(-1)));
 const length=p.points.slice(1).reduce((sum,q,i)=>{
  const d=Math.hypot(q.x-p.points[i].x,q.z-p.points[i].z);
  assert(d>1e-6,'R42 tem segmento nulo');return sum+d;
 },0);
 assert(length>185&&length<225,'comprimento R42 inesperado: '+length);
 assert(p.points.at(-1).x>80&&p.points.at(-1).x<100);
 assert(p.points.at(-1).z>695&&p.points.at(-1).z<715);
 assert.equal(p.originalPlacementCertified,false);
 assert.equal(p.wholeMapCertified,false);
 assert.equal(p.missionsMigrated,false);
});

test('R42 não se propaga aos outros mapas e recusa entrada alagada ou bloqueada',()=>{
 assert.equal(Road.prepare({preset:{id:'havana'}}),null);
 assert.throws(()=>Road.prepare({preset:{id:'chicago'},isWaterAt:()=>true,
  isPointBlocked:()=>false}),/Entroncamento R42 obstruído/);
 assert.throws(()=>Road.prepare({preset:{id:'chicago'},isWaterAt:()=>false,
  isPointBlocked:()=>true}),/Entroncamento R42 obstruído/);
});

test('carregamento, radar, pintura e inicialização física incluem R42',()=>{
 const html=fs.readFileSync('index.html','utf8'),builder=fs.readFileSync('js/world/city-builder.js','utf8');
 assert(html.includes('chicago/reference-south-stem-r42.js'));
 assert(html.includes('js/world/chicago-south-stem-r42.js'));
 assert(html.indexOf('chicago-south-stem-r42.js')<html.indexOf('js/world/city-builder.js'));
 assert(builder.includes('this.chicagoReferenceSouthStemR42=null;'));
 assert(builder.includes('DriverChicagoSouthStemR42.prepare(this);'));
 assert(builder.includes('this.chicagoReferenceSouthStemR42\n'));
 const paths=Network.sourcePaths({chicagoReferenceSouthStemR42:Road.plan()});
 assert.equal(paths.length,1);
 assert.equal(paths[0].id,'south-stem-r42');
 assert(Network.SOURCE_NAMES.some(([name])=>name==='south-stem-r42'));
 assert(Network.SOURCE_NAMES.some(([name])=>name==='south-stem-r42'));
 assert(Network.SOURCE_NAMES.length>=18);
});
