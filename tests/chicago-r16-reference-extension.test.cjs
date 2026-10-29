'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib');
const R15=require('../js/world/chicago-ps1-reference-curve.js');
let R16;try{R16=require('../js/world/chicago-ps1-reference-extension.js');}catch{}
test('R16 continua no mesmo alinhamento e liga à rua R15',()=>{
 assert(R16,'prolongamento PS1 ausente');
 const p=R16.plan(),old=R15.plan();assert.deepEqual(p.points[0],old.points[0]);
 assert(p.points.at(-1).z>15);assert(p.points.length>30);
 for(const s of R16.source.pointsOBJ)assert.deepEqual(R16.fitPoint(s),R15.fitPoint(s));
 assert.equal(p.wholeMapCertified,false);assert(R16.isCarvedBlock(-280,-40));
});
test('R16 usa pavimento observado e não invade água ou suas casas',()=>{
 assert(R16,'prolongamento PS1 ausente');
 const s=JSON.parse(fs.readFileSync('chicago/reference-street-survey.json'));
 const bytes=zlib.gunzipSync(Buffer.from(s.layers.markedPaving.gzipBitsetBase64,'base64'));
 const plain=zlib.gunzipSync(Buffer.from(s.layers.plainPaving.gzipBitsetBase64,'base64'));
 for(const [x,y] of R16.source.sourcePixels){const bit=y*s.width+x;assert((bytes[bit>>>3]|plain[bit>>>3])&(128>>>(bit&7)));}
 const river=require('../js/world/chicago-ps1-river-branches.js'),coast=require('../js/world/chicago-ps1-coastline.js'),p=R16.plan();
 for(let i=0;i<p.points.length;i++){
  const c=p.points[i],a=p.points[Math.max(0,i-1)],b=p.points[Math.min(p.points.length-1,i+1)],len=Math.hypot(b.x-a.x,b.z-a.z);
  for(const sign of [-1,0,1]){const x=c.x-sign*(b.z-a.z)/len*4,z=c.z+sign*(b.x-a.x)/len*4;assert(!river.waterAt(x,z)&&!coast.waterAt(x,z));}
  for(const l of p.lots)assert(Math.hypot(Math.max(Math.abs(c.x-l.x)-l.width/2,0),Math.max(Math.abs(c.z-l.z)-l.depth/2,0))>5.55);
 }
});
