'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib');
const R18=require('../js/world/chicago-ps1-reference-bridge.js'),R15=require('../js/world/chicago-ps1-reference-curve.js');
let Net;try{Net=require('../js/world/chicago-ps1-reference-north-network.js');}catch{}
test('três ruas formam entroncamento ligado à ponte com cabeceira única da referência',()=>{
 assert(Net,'rede norte ausente');const p=Net.plans();assert.deepEqual(Object.keys(p),['stem','continuation','branch']);
 assert.deepEqual(p.stem.points[0],R18.plan().points.at(-1));
 assert.deepEqual(p.stem.points.at(-1),p.continuation.points[0]);assert.deepEqual(p.branch.points[0],p.continuation.points[0]);
 assert(p.continuation.points.at(-1).z>320);assert(Math.abs(p.branch.points.at(-1).z-320)<5);
 for(const edge of Object.values(Net.source.edges))for(const v of edge.pointsOBJ)assert.deepEqual(Net.fitPoint(v),R15.fitPoint(v));
 assert(Net.isCarvedBlock(-280,280));assert(!Net.isCarvedBlock(-280,200),'não retirar estádio');
});
test('rede tem proveniência reproduzível e largura seca longe das fachadas',()=>{
 assert(Net,'rede norte ausente');const raw=fs.readFileSync('chicago/reference-street-survey.json'),s=JSON.parse(raw);
 assert.equal(Net.source.sourceSHA256,crypto.createHash('sha256').update(raw).digest('hex'));
 const masks=['markedPaving','plainPaving'].map(k=>zlib.gunzipSync(Buffer.from(s.layers[k].gzipBitsetBase64,'base64')));
 for(const edge of Object.values(Net.source.edges))for(const [x,y] of edge.sourcePixels){const bit=y*s.width+x;assert(masks.some(b=>b[bit>>>3]&(128>>>(bit&7))));}
 const river=require('../js/world/chicago-ps1-river-branches.js'),coast=require('../js/world/chicago-ps1-coastline.js'),plans=Net.plans(),lots=Object.values(plans).flatMap(p=>p.lots);assert.equal(lots.length,3);
 for(const p of Object.values(plans)){
  assert.equal(p.wholeMapCertified,false);
  for(let i=0;i<p.points.length;i++){
   const c=p.points[i],a=p.points[Math.max(0,i-1)],b=p.points[Math.min(p.points.length-1,i+1)],len=Math.hypot(b.x-a.x,b.z-a.z);
   for(const sign of [-1,0,1]){const x=c.x-sign*(b.z-a.z)/len*4,z=c.z+sign*(b.x-a.x)/len*4;assert(!river.waterAt(x,z)&&!coast.waterAt(x,z));}
   for(const l of lots)assert(Math.hypot(Math.max(Math.abs(c.x-l.x)-l.width/2,0),Math.max(Math.abs(c.z-l.z)-l.depth/2,0))>5.55);
  }
 }
});
test('entroncamento tem piso real suficiente para a carroceria fazer a curva',()=>{
 assert(Net);const junction=Net.plans().stem.points.at(-1);
 assert.equal(typeof Net.junction,'function','entroncamento precisa de piso construído');
 const apron=Net.junction();assert.deepEqual({x:apron.x,z:apron.z},junction);
 assert(apron.radius-Math.hypot(3,4)>=1.55,'a curva precisa de alargamento físico');
 assert(apron.radius<Math.hypot(20,20),'não autorizar terreno fora das ruas');
});
