'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const R15=require('../js/world/chicago-ps1-reference-curve.js');
const R20=require('../js/world/chicago-ps1-reference-arterial.js');
const R23=require('../js/world/chicago-ps1-north-candidate-r23.js');
const Network=require('../js/world/chicago-ps1-street-network-r22.js');
const original=require('../chicago/reference-network.json');
const reference=require('../chicago/reference-north-candidate-r23.json');
test('R23 conserva exatamente seis arestas conectadas no esqueleto de 54 setores do PS1',()=>{
 const id=reference.sourceEdgeIds;
 assert.deepEqual(id,[1822,1777,1762,1650,1557,1550]);
 assert.equal(reference.networkEdgesCount,original.edges.length);
 assert.equal(reference.sourceSHA256,original.sourceSHA256);
 let current=reference.sourceNodeIds[0],points=[];
 for(let i=0;i<id.length;i++){
  const edge=original.edges[id[i]],next=reference.sourceNodeIds[i+1];
  assert(new Set([edge.from,edge.to]).has(current));
  assert(new Set([edge.from,edge.to]).has(next));
  const p=edge.from===current?edge.pointsOBJ:[...edge.pointsOBJ].reverse();
  if(points.length)assert.deepEqual(points.at(-1),p[0]);
  points.push(...p.slice(i?1:0));
  current=next;
 }
 assert.deepEqual(points,reference.pointsOBJ);
 assert.equal(reference.roadClassificationCertified,false);
 assert.equal(reference.originalPlacementCertified,false);
 assert.equal(reference.missionsMigrated,false);
});
test('R23 mantém a escala uniforme da R15, termina ao norte e conecta à R20',()=>{
 const r=R23.plan(),p=R20.plan(),first=p.points.at(-1),
   mapped=R15.fitPoint(reference.pointsOBJ.at(-1));
 assert.deepEqual(r.points[0],first);
 assert.deepEqual(r.points.at(-1),mapped);
 assert(r.adaptedSeamLength>2&&r.adaptedSeamLength<8);
 assert(r.points.at(-1).z>720);
 assert(r.points.at(-1).z<800);
 assert(r.width===8&&r.lots.length===0);
 assert(r.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));
 assert.equal(r.wholeMapCertified,false);
 assert.equal(r.roadClassificationCertified,false);
 assert.equal(r.originalPlacementCertified,false);
});
test('R23 é geometria original candidata mas não migra missões nem cria prédios',()=>{
 const code=fs.readFileSync('js/world/city-builder.js','utf8');
 const html=fs.readFileSync('index.html','utf8');
 const i=code.indexOf('DriverChicagoPS1ReferenceArterial.prepare(this)'),
   j=code.indexOf('DriverChicagoPS1NorthCandidateR23.prepare(this)'),
   k=code.indexOf('DriverChicagoPS1StreetNetwork.build(this)');
 assert(i>0&&i<j&&j<k);
 const a=html.indexOf('reference-north-candidate-r23.js'),
   b=html.indexOf('chicago-ps1-north-candidate-r23.js'),
   c=html.indexOf('chicago-ps1-street-network-r22.js');
 assert(a>0&&a<b&&b<c);
 const city={preset:{id:'chicago'},chicagoReferenceArterial:R20.plan(),
  chicagoReferenceNorthCandidateR23:R23.plan(),
  chicagoReferenceNorthNetwork:{segments:{}},
  isPointBlocked:()=>false,isWaterAt:()=>false,cityGroup:{}};
 const paths=Network.sourcePaths(city);
 assert(paths.some(p=>p.id==='western-extension-r23'));
 const north=paths.find(p=>p.id==='western-extension-r23');
 assert.deepEqual(north.points.at(-1),R23.plan().points.at(-1));
 city.preset.id='rio';
 assert.equal(Network.build(city),null);
});
test('origem preservada é auditável sem declarar ruas homologadas',()=>{
 assert.equal(original.nodes.length,3230);
 assert.equal(original.edges.length,4279);
 assert.equal(reference.sourceNodeIds.length,7);
 assert.equal(reference.sourcePixels.length,0);
 assert(reference.limitation.includes('sidewalk'));
 const source=fs.readFileSync('chicago/reference-north-candidate-r23.json','utf8');
 assert(source.includes('roadClassificationCertified'));
});
