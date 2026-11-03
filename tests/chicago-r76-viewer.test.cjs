'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const R76=require('../tools/chicago-r76-surface-orientation.cjs');
const report=require('../chicago/corridor-orientation-r76.json');
const source=require('../chicago/corridor-review-r72.json');
test('R76 published compact 67-section inspector must match the immutable PS1 GLBs exactly',()=>{
 const full=R76.build();
 assert.equal(report.format,'DriverChicagoR76SurfaceOrientationViewerPackedV1');
 assert.equal(report.sourceSHA256,full.sourceSHA256);
 assert.deepEqual(report.sourceSectors,full.sourceSectors);
 assert.deepEqual(report.sourcePointsOBJ,source.sourcePointsOBJ);
 assert.deepEqual(report.offsetsOBJ,[-.12,-.1,-.08]);
 assert.equal(report.packedRows.length,full.sections.length);
 for(let i=0;i<full.sections.length;i++){
  const original=full.sections[i];
  assert.equal(report.packedRows[i].length,3,'three exact offsets');
  for(let j=0;j<3;j++){
   const expected=original.cuts.find(c=>Math.abs(c.offset-report.offsetsOBJ[j])<1e-8);
   const packed=report.packedRows[i][j];
   assert.equal(packed.length,expected.hits.length,'no hidden source triangles at '+i+':'+j);
   for(let k=0;k<packed.length;k++){
    const hit=expected.hits[k],got=packed[k];
    assert.deepEqual(got,[
     hit.tile==='01_02'?2:3,hit.triangleIndex,
     hit.sourceYOBJ,hit.normalTiltDeg,
     hit.uvMaterial==='r26_paving_uv_heuristic'?1:0
    ],'PS1 GLB source identity mismatch at '+i+':'+j+':'+k);
   }
  }
 }
 for(const k of Object.keys(report.summary))
  assert.deepEqual(report.summary[k],full.evidence[k],'summary provenance '+k);
 assert.equal(report.certifiedRoad,false);
 assert.equal(report.runtimeRoadEnabled,false);
 assert.equal(report.collidersCreated,0);
});
test('R76 inspector remains isolated from gameplay and uses original marked evidence',()=>{
 const game=fs.readFileSync('index.html','utf8');
 const viewer=fs.readFileSync('chicago-geometry-r76.html','utf8');
 assert(!game.includes('chicago/corridor-orientation-r76.json'));
 assert(!game.includes('chicago-geometry-r76.html'));
 assert(viewer.includes("fetch('./chicago/corridor-orientation-r76.json'"));
 assert(viewer.includes('decodePacked(packed)'));
 assert(viewer.includes('runtimeRoadEnabled!==false'));
 assert(!/registerRoad\(|createCollider\(|addTraffic\(|DriverVehicle\(/.test(viewer));
});
