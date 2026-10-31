'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const Source=require('../chicago/reference-southeast-r39.json');
const Graph=require('../chicago/reference-network.json');
const R38=require('../chicago/reference-east-return-r38.json');
const Road=require('../js/world/chicago-southeast-r39.js');
const Parent=require('../js/world/chicago-east-return-r38.js');
const Net=require('../js/world/chicago-ps1-street-network-r22.js');

test('R39 preserva 32 arestas inéditas, contíguas e pontos originais sem adivinhar ruas',()=>{
 a.equal(Source.sourceSHA256,Graph.sourceSHA256);
 a.equal(Source.sourceEdgeIds.length,32);
 a.equal(Source.sourceNodeIds.length,33);
 a.equal(Source.sourceNodeIds[0],501);
 a.equal(Source.sourceNodeIds.at(-1),1323);
 const already=new Set(R38.sourceEdgeIds);
 const R37=require('../chicago/reference-north-branch-r37.json');
 for(const id of R37.sourceEdgeIds)already.add(id);
 const newEdges=new Set();
 const pts=[];
 Source.sourceEdgeIds.forEach((edgeId,i)=>{
  a(!already.has(edgeId),'reutilizou trecho do corredor anterior');
  a(!newEdges.has(edgeId),'duplicou aresta na R39');
  newEdges.add(edgeId);
  const edge=Graph.edges[edgeId];
  const from=Source.sourceNodeIds[i],to=Source.sourceNodeIds[i+1];
  a(edge.from===from&&edge.to===to||edge.from===to&&edge.to===from);
  const points=edge.from===from?edge.pointsOBJ:[...edge.pointsOBJ].reverse();
  pts.push(...points.slice(i?1:0));
 });
 a.deepEqual(pts,Source.pointsOBJ);
 a.deepEqual(Source.pointsOBJ[0],R38.pointsOBJ.at(-1));
 a.equal(Source.roadClassificationCertified,false);
 a.equal(Source.gradedJunctionsCertified,false);
});

test('R39 acrescenta via dirigível adaptada com encaixe R38 e mantém missões intactas',()=>{
 const p=Road.plan(),r=Parent.plan();
 a.deepEqual(p.points[0],r.points.at(-1));
 a.deepEqual(p.points.at(-1),Road.fitPoint(Source.pointsOBJ.at(-1)));
 a.equal(p.width,8);
 a(p.points.length>30);
 a(p.points.at(-1).z<680&&p.points.at(-1).z>600);
 a(p.points.at(-1).x>150&&p.points.at(-1).x<200);
 a.equal(p.originalPlacementCertified,false);
 a.equal(p.roadClassificationCertified,false);
 a.equal(p.wholeMapCertified,false);
 a.equal(p.missionsMigrated,false);
 let length=0;
 for(let i=1;i<p.points.length;i++){
  const a0=p.points[i-1],b0=p.points[i];
  const segment=Math.hypot(a0.x-b0.x,a0.z-b0.z);
  a(segment>1e-5,'malha contém segmentos de comprimento zero');
  length+=segment;
 }
 a(length>290&&length<320,'extensão geométrica esperada ~300 unidades');
});

test('R39 participa do radar, do build físico e não é fabricada em Havana',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const builder=fs.readFileSync('js/world/city-builder.js','utf8');
 const source=fs.readFileSync('js/world/chicago-ps1-street-network-r22.js','utf8');
 a(html.includes('./chicago/reference-southeast-r39.js'));
 a(html.includes('./js/world/chicago-southeast-r39.js'));
 a(html.indexOf('chicago-southeast-r39.js')<html.indexOf('js/world/city-builder.js'));
 a(builder.includes('DriverChicagoSouthEastR39.prepare(this)'));
 a(builder.includes('this.chicagoReferenceSouthEastR39=null'));
 a(source.includes("['southeast-r39','chicagoReferenceSouthEastR39']"));
 const list=Net.sourcePaths({chicagoReferenceSouthEastR39:Road.plan()});
 a.equal(list.length,1);a.equal(list[0].id,'southeast-r39');
 a.equal(Road.prepare({preset:{id:'havana'}}),null);
 a.throws(()=>Road.prepare({preset:{id:'chicago'},isWaterAt:()=>true,
  isPointBlocked:()=>false}),/A curva PS1 R15 não cabe no corredor liberado/);
});
