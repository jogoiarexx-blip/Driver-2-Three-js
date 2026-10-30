'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
      fs=require('node:fs');
const R29=require('../js/world/chicago-height-recovery-r29.js');
const Guard=require('../js/world/chicago-grade-guard-r26.js');
function raster(){
 const width=61,height=21,n=width*height;
 const r={width,height,stepOBJ:.25,xminOBJ:0,zmaxOBJ:6,
    count:new Uint16Array(n),minY:new Float32Array(n),
    maxY:new Float32Array(n)};
 r.minY.fill(Infinity);r.maxY.fill(-Infinity);return r;
}
function put(r,x,z,y){
 const col=Math.round((x-r.xminOBJ)/r.stepOBJ),
       row=Math.round((r.zmaxOBJ-z)/r.stepOBJ),idx=row*r.width+col;
 r.minY[idx]=Math.min(r.minY[idx],y);
 r.maxY[idx]=Math.max(r.maxY[idx],y);
 r.count[idx]++;
}
const edge={from:0,to:1,pointsOBJ:[[1,4],[5,4]]};
function prepared(r){
 return {
  graph:{nodes:[{pointOBJ:[1,4]},{pointOBJ:[5,4]}],edges:[edge]},
  grade:{edges:[{status:'incomplete-observation'}]},
  paving:[{confidence:'medium'}],raster:r
 };
}
test('R29 accepts only adjacent cells whose exact observed GLB heights agree',()=>{
 const r=raster();
 for(let i=0;i<=8;i++){
  const x=1+i*.5;
  if(i%2)put(r,x+.25,4,0);
  else put(r,x,4,0);
 }
 const report=R29.probeEdge(edge,r,Guard.edgeProbes.bind(Guard));
 assert.equal(report.probes,9);
 assert.equal(report.direct,5);
 assert.equal(report.recovered,4);
 assert.equal(report.missingOrConflicted,0);
 const {graph,grade,paving}=prepared(r);
 const result=R29.classify(graph,grade,paving,r,
   Guard.edgeProbes.bind(Guard),[]);
 assert.deepEqual(result.additionalEdgeIds,[0]);
 assert.equal(result.recoveredEdges,1);
 assert.equal(result.newTrafficLinks,0);
 assert.equal(result.additions[0].certifiedRoad,false);
});
test('R29 refuses stacked direct cells and also stacked neighboring cells',()=>{
 const r=raster();
 put(r,2,4,0);put(r,2,4,.9);
 assert.equal(R29.sample(r,2,4).kind,'stacked');
 assert.equal(R29.sample(r,2.25,4).kind,'near-stacked');
 const {graph,grade,paving}=prepared(r);
 const out=R29.classify(graph,grade,paving,r,
   Guard.edgeProbes.bind(Guard),[]);
 assert.equal(out.recoveredEdges,0);
});
test('R29 refuses nearby height conflicts and does not interpolate across a gap',()=>{
 const r=raster();
 put(r,2,4,0);put(r,2.5,4,.25);
 assert.equal(R29.sample(r,2.25,4).kind,'near-ambiguous');
 assert.equal(R29.sample(r,4,4).kind,'missing');
 const {graph,grade,paving}=prepared(r);
 assert.equal(R29.classify(graph,grade,paving,r,
     Guard.edgeProbes.bind(Guard),[]).recoveredEdges,0);
});
test('R29 preserves the R28 candidates, rejects all original stacked edge statuses',()=>{
 const r=raster();
 for(let i=0;i<=8;i++)put(r,1+i*.5,4,0);
 const {graph,grade,paving}=prepared(r);
 grade.edges[0].status='multi-level-conflict';
 const out=R29.classify(graph,grade,paving,r,
  Guard.edgeProbes.bind(Guard),[]);
 assert.equal(out.recoveredEdges,0);
 assert.equal(out.rejections.originalLevelConflict,1);
 grade.edges[0].status='incomplete-observation';
 const baseline=R29.classify(graph,grade,paving,r,
  Guard.edgeProbes.bind(Guard),[0]);
 assert.equal(baseline.recoveredEdges,0);
 assert.equal(baseline.rejections.directBaseline,1);
});
test('R29 refuses sharp source-floor discontinuities even when each sample is present',()=>{
 const r=raster();
 for(let i=0;i<=8;i++)put(r,1+i*.5,4,i<4?0:.16);
 const {graph,grade,paving}=prepared(r);
 const report=R29.classify(graph,grade,paving,r,
   Guard.edgeProbes.bind(Guard),[]);
 assert.equal(report.recoveredEdges,0);
 assert(report.rejections.gradeSlope>0);
});
test('R29 uses only real source JSON and never overwrites live-game traffic or missions',()=>{
 const source=fs.readFileSync('js/world/chicago-height-recovery-r29.js','utf8');
 const task=fs.readFileSync('tools/chicago-r29-height-recovery.cjs','utf8');
 const builder=fs.readFileSync('js/world/city-builder.js','utf8');
 assert.match(source,/newInferredNodes:0/);
 assert.match(source,/newTrafficLinks:0/);
 assert.match(task,/includeRaster:true/);
 assert.match(task,/chicago\/reference-layered-r28.json/);
 assert(!builder.includes('DriverChicagoR29HeightRecovery.prepare'));
});
