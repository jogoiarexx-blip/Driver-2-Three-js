'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),zlib=require('node:zlib'),crypto=require('node:crypto');
const source=JSON.parse(fs.readFileSync('chicago/reference-street-survey.json'));
const curve=JSON.parse(fs.readFileSync('chicago/reference-curve-r15.json'));
const network=JSON.parse(fs.readFileSync('chicago/reference-network.json'));
let Road;try{Road=require('../js/world/chicago-ps1-reference-curve.js');}catch{}
test('cada pixel da curva foi realmente observado no pavimento marcado do PS1',()=>{
 const bytes=zlib.gunzipSync(Buffer.from(source.layers.markedPaving.gzipBitsetBase64,'base64'));
 for(const [x,y] of curve.sourcePixels){const bit=y*source.width+x;assert(bytes[bit>>>3]&(128>>>(bit&7)));}
 const hash=crypto.createHash('sha256').update(fs.readFileSync('chicago/reference-street-survey.json')).digest('hex');
 assert.equal(curve.sourceSHA256,hash);assert.equal(network.sourceSHA256,hash);
 assert.equal(network.tilesRead,54);assert.equal(network.trafficRoutesCertified,false);
 assert(network.nodes.length>1000&&network.edges.length>1000);
 for(const e of network.edges){assert(network.nodes[e.from]);assert(network.nodes[e.to]);assert(e.pointsOBJ.length>=2);}
});
test('transplante usa escala uniforme e rotação, sem inventar nova curva',()=>{
 assert(Road,'módulo de rua derivada da fonte');
 const a=Road.fitPoint(curve.pointsOBJ[0]),b=Road.fitPoint(curve.pointsOBJ.at(-1));
 assert(Math.hypot(a.x+320,a.z+80)<1e-6);assert(Math.hypot(b.x+260,b.z+160)<1e-6);
 const factor=Math.hypot(b.x-a.x,b.z-a.z)/Math.hypot(...curve.pointsOBJ.at(-1).map((v,i)=>v-curve.pointsOBJ[0][i]));
 const p=curve.pointsOBJ[3],q=curve.pointsOBJ[7],u=Road.fitPoint(p),v=Road.fitPoint(q);
 assert(Math.abs(Math.hypot(v.x-u.x,v.z-u.z)/Math.hypot(q[0]-p[0],q[1]-p[1])-factor)<1e-8);
});
test('curva substitui só um quarteirão comum, com casas fora de toda a faixa',()=>{
 assert(Road);assert(Road.isCarvedBlock(-280,-120));
 assert(!Road.isCarvedBlock(-120,-120));assert(!Road.isCarvedBlock(-280,200));
 const plan=Road.plan();assert(plan.points.length>20);assert.equal(plan.lots.length,3);
 assert(plan.points.some(p=>p.x>-305&&p.x<-255&&p.z>-140&&p.z<-100), 'a rua precisa atravessar o antigo lote, não apenas pintar uma avenida existente');
 for(const p of plan.points)for(const lot of plan.lots){
  const dx=Math.max(Math.abs(p.x-lot.x)-lot.width/2,0);
  const dz=Math.max(Math.abs(p.z-lot.z)-lot.depth/2,0);
  assert(Math.hypot(dx,dz)>plan.width/2+1.55,'fachada invade a rua nova');
 }
 assert.equal(plan.originalPlacementCertified,false);
});
test('as duas cabeceiras e toda a largura evitam o canal físico já existente',()=>{
 assert(Road);
 const River=require('../js/world/chicago-ps1-river-branches.js');
 const Coast=require('../js/world/chicago-ps1-coastline.js');
 const plan=Road.plan();
 for(let i=0;i<plan.points.length;i++){
  const p=plan.points[i],a=plan.points[Math.max(0,i-1)],b=plan.points[Math.min(plan.points.length-1,i+1)];
  const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
  for(const sign of [-1,0,1]){
   const x=p.x-sign*dz/len*plan.width/2,z=p.z+sign*dx/len*plan.width/2;
   assert(!River.waterAt(x,z)&&!Coast.waterAt(x,z),JSON.stringify({i,x,z}));
  }
 }
});
