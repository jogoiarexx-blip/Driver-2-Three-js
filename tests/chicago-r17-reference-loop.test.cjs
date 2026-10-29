'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib');
const R16=require('../js/world/chicago-ps1-reference-extension.js');
const R15=require('../js/world/chicago-ps1-reference-curve.js');
let Loop;try{Loop=require('../js/world/chicago-ps1-reference-loop.js');}catch{}
test('braço oeste fecha circuito com as duas cabeceiras exatas da R16',()=>{
 assert(Loop,'braço oeste PS1 ausente');const p=Loop.plan(),east=R16.plan();
 assert.deepEqual(p.points[0],east.points[0]);assert.deepEqual(p.points.at(-1),east.points.at(-1));
 assert(p.points.some(v=>v.x<-335));assert(east.points.some(v=>v.x>-310));
 for(const s of Loop.source.pointsOBJ)assert.deepEqual(Loop.fitPoint(s),R15.fitPoint(s));
 assert.equal(p.wholeMapCertified,false);assert.equal(p.originalPlacementCertified,false);
});
test('volta oeste usa pixels observados e mantém toda largura fora da água e das casas existentes',()=>{
 assert(Loop,'braço oeste PS1 ausente');
 const survey=JSON.parse(fs.readFileSync('chicago/reference-street-survey.json'));
 const bitsets=['markedPaving','plainPaving'].map(k=>zlib.gunzipSync(Buffer.from(survey.layers[k].gzipBitsetBase64,'base64')));
 for(const [x,y] of Loop.source.sourcePixels){const bit=y*survey.width+x;assert(bitsets.some(b=>b[bit>>>3]&(128>>>(bit&7))));}
 const p=Loop.plan(),river=require('../js/world/chicago-ps1-river-branches.js'),coast=require('../js/world/chicago-ps1-coastline.js');
 for(let i=0;i<p.points.length;i++){
  const c=p.points[i],a=p.points[Math.max(0,i-1)],b=p.points[Math.min(p.points.length-1,i+1)],len=Math.hypot(b.x-a.x,b.z-a.z);
  for(const sign of [-1,0,1]){const x=c.x-sign*(b.z-a.z)/len*4,z=c.z+sign*(b.x-a.x)/len*4;assert(!river.waterAt(x,z)&&!coast.waterAt(x,z));}
  for(const l of [...R15.plan().lots,...R16.plan().lots])assert(Math.hypot(Math.max(Math.abs(c.x-l.x)-l.width/2,0),Math.max(Math.abs(c.z-l.z)-l.depth/2,0))>5.55);
 }
});
