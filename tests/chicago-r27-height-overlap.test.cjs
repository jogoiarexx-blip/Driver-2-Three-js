'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
      fs=require('node:fs');
const Review=require('../js/world/chicago-grade-review-r27.js');
const Guard=require('../js/world/chicago-grade-guard-r26.js');
function raster(){
  const width=64,height=48,n=width*height;
  const r={xminOBJ:0,zmaxOBJ:8,stepOBJ:.25,width,height,
    count:new Uint16Array(n),minY:new Float32Array(n),
    maxY:new Float32Array(n)};
  r.minY.fill(Infinity);r.maxY.fill(-Infinity);
  return r;
}
function hit(r,x,z,y){
  const col=Math.round((x-r.xminOBJ)/r.stepOBJ),
    row=Math.round((r.zmaxOBJ-z)/r.stepOBJ),
    index=row*r.width+col;
  r.count[index]++;
  r.minY[index]=Math.min(r.minY[index],y);
  r.maxY[index]=Math.max(r.maxY[index],y);
}
const edge={pointsOBJ:[[1,4],[5,4]],from:0,to:1};
test('R27 flags sustained original-height separation when neighboring source cells repeat two levels',()=>{
  const r=raster();
  for(let x=1;x<=5;x+=.25){
    hit(r,x,4,0);
    if(x>=1.75&&x<=3.5)hit(r,x,4,.86);
  }
  const p=Review.inspectEdge(edge,r,Guard,'multi-level-conflict');
  assert.equal(p.kind,'sustained-separated-height-evidence');
  assert(p.sustainedHighGapCells>=2);
  assert(p.maxHeightDifferenceOBJ>.80);
  assert(p.overlapCells>=2);
  assert.equal(p.isBridgeCertified,false);
  assert.equal(p.canAutoJoinTraffic,false);
  assert.equal(p.canCrossAtGrade,false);
});
test('R27 treats isolated vertical height samples as uncertain, not proven overpass',()=>{
  const r=raster();
  for(let x=1;x<=5;x+=.25)hit(r,x,4,0);
  hit(r,2,4,.90);
  const p=Review.inspectEdge(edge,r,Guard,'multi-level-conflict');
  assert.equal(p.kind,'localized-or-ambiguous-overlap');
  assert.equal(p.sustainedHighGapCells,0);
  assert(p.overlapCells>0);
  assert.equal(p.canCrossAtGrade,false);
});
test('R27 separates node-only conflict from directly stacked street samples',()=>{
  const r=raster();
  for(let x=1;x<=5;x+=.25)hit(r,x,4,0);
  const p=Review.inspectEdge(edge,r,Guard,'multi-level-conflict');
  assert.equal(p.kind,'shared-node-conflict-without-edge-overlap');
  assert.equal(p.overlapCells,0);
  assert.equal(p.canAutoJoinTraffic,false);
});
test('R27 refuses gaps from incomplete geometry and flags absent samples',()=>{
  const p=Review.inspectEdge(edge,raster(),Guard,'incomplete-observation');
  assert.equal(p.kind,'height-observation-incomplete');
  assert(p.unknown>0);
  assert.equal(p.isBridgeCertified,false);
});
test('R27 original 55 conflicts are explicitly not certified as road junctions',()=>{
  const meta=require('../chicago/reference-grade-r26.json');
  const graph=require('../chicago/reference-network.json');
  assert.equal(meta.conflictEdgeIds.length,55);
  assert.equal(meta.stackedNodeIds.length,15);
  assert.equal(graph.edges.length,4279);
  assert(meta.conflictEdgeIds.includes(1650));
  assert(meta.conflictEdgeIds.includes(1557));
  const source=fs.readFileSync('js/world/chicago-grade-review-r27.js','utf8');
  assert.match(source,/certifiedOverpasses:0/);
  assert.match(source,/certifiedAtGradeJunctions:0/);
  assert.match(source,/gradeSeparatedRoutesCanAutoConnect:false/);
  const builder=fs.readFileSync('js/world/city-builder.js','utf8');
  assert(!builder.includes('DriverChicagoGradeReviewR27.prepare'));
  const tool=fs.readFileSync('tools/chicago-r27-review-conflicts.cjs','utf8');
  assert.match(tool,/conflictEdgeIds/);
  assert.match(tool,/includeRaster:true/);
});
