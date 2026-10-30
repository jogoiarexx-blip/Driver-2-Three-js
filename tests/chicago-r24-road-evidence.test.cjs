'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
      fs=require('node:fs'),zlib=require('node:zlib'),crypto=require('node:crypto');
const Evidence=require('../js/world/chicago-road-evidence-r24.js');
function fixture(radius,water=false){
 const survey={width:200,height:120,stepOBJ:.125,
     xminOBJ:0,zmaxOBJ:15,tilesRead:54};
 const bytes=Math.ceil(survey.width*survey.height/8);
 const masks=Object.fromEntries(Evidence.LAYERS.map(x=>[x,new Uint8Array(bytes)]));
 const set=(name,x,z)=>{
   const col=Math.round((x-survey.xminOBJ)/survey.stepOBJ),
     row=Math.round((survey.zmaxOBJ-z)/survey.stepOBJ),
     i=row*survey.width+col;
   masks[name][i>>>3]|=128>>>(i&7);
 };
 for(let row=0;row<survey.height;row++)for(let col=0;col<survey.width;col++){
  const x=survey.xminOBJ+col*survey.stepOBJ,
        z=survey.zmaxOBJ-row*survey.stepOBJ;
  if(x>4&&x<18&&Math.abs(z-7.5)<=radius)
   set(water?'water':'markedPaving',x,z);
 }
 return {survey,masks};
}
const edge={from:0,to:1,pointsOBJ:[[5,7.5],[15,7.5]]};
test('R24 recognizes wide paved centerline without ever certifying PS1 roads',()=>{
 const {survey,masks}=fixture(.9);
 const p=Evidence.profile(edge,survey,masks);
 assert.equal(p.confidence,'strong');
 assert(p.center>.95&&p.shoulders>.95&&p.laneEdges>.95);
 assert.equal(p.roadCertified,false);
 assert.equal(p.gradeCertified,false);
});
test('R24 distinguishes a narrower likely surface from broad street evidence',()=>{
 const {survey,masks}=fixture(.50);
 const p=Evidence.profile(edge,survey,masks);
 assert.equal(p.confidence,'medium');
 assert(p.center>.95&&p.laneEdges>.80&&p.outerEdges<.55);
});
test('thin sidewalk is not classified as strong or medium street',()=>{
 const {survey,masks}=fixture(.10);
 assert.equal(Evidence.profile(edge,survey,masks).confidence,'review');
});
test('water and missing source pixels reject a candidate road',()=>{
 const w=fixture(.9,true);
 assert.equal(Evidence.profile(edge,w.survey,w.masks).confidence,'reject');
 const p=fixture(.9);
 const outside={from:0,to:1,pointsOBJ:[[-5,7.5],[5,7.5]]};
 assert.equal(Evidence.profile(outside,p.survey,p.masks).outside,true);
 assert.equal(Evidence.profile(outside,p.survey,p.masks).confidence,'reject');
});
test('candidate components require shared graph nodes: overpass crossings are not assumed connected',()=>{
 const r=(id,from,to,lengthOBJ,confidence)=>({
   id,from,to,lengthOBJ,confidence});
 const groups=Evidence.connectedCandidates([
  r(0,0,1,2,'strong'),r(1,1,2,3,'medium'),
  r(2,3,4,8,'strong'),r(3,2,3,5,'reject')
 ]);
 assert.equal(groups.length,2);
 assert.deepEqual(groups.map(g=>g.edges),[1,2]);
 assert.deepEqual(groups.map(g=>g.lengthOBJ),[8,5]);
});
test('R24 classifies every one of the 4279 original candidate edges deterministically',()=>{
 const raw=fs.readFileSync('chicago/reference-street-survey.json');
 const survey=JSON.parse(raw);
 const graph=JSON.parse(fs.readFileSync('chicago/reference-network.json','utf8'));
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),
   graph.sourceSHA256);
 const masks=Object.fromEntries(Evidence.LAYERS.map(name=>[
  name,zlib.gunzipSync(Buffer.from(
   survey.layers[name].gzipBitsetBase64,'base64'))
 ]));
 const result=Evidence.classify(graph,survey,masks);
 assert.equal(result.graphEdges,4279);
 assert.equal(result.tilesRead,54);
 assert.equal(result.records.length,4279);
 assert.equal(Object.values(result.counts).reduce((a,b)=>a+b,0),4279);
 assert.equal(result.roadCertified,false);
 assert.equal(result.gradedCrossingsCertified,false);
 assert.equal(result.missionsMigrated,false);
 assert(result.records.some(x=>x.confidence==='strong'));
 assert(result.records.some(x=>x.confidence==='review'));
 assert(result.records.every((r,i)=>r.id===i&&
  r.gradeCertified===false&&r.roadCertified===false));
 assert(result.components.every(c=>c.edges>0&&c.nodes>=2));
});
