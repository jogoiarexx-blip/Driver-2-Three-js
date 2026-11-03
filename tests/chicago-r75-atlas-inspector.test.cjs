'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const R74=require('../tools/chicago-r74-source-seam.cjs');
const compact=require('../chicago/corridor-seam-r75.json');
const original=require('../chicago/corridor-review-r72.json');
const survey=require('../chicago/reference-street-survey.json');

test('R75 all 67 published UV atlas coordinates reproduce exact R74 original GLBs',()=>{
 const full=R74.build();
 assert.equal(compact.format,'DriverChicagoPS1R75AtlasInspector');
 assert.equal(compact.edgeId,3445);
 assert.equal(compact.sourceSHA256,full.sourceSHA256);
 assert.equal(compact.atlasSHA256,survey.atlasSHA256);
 assert.deepEqual(compact.sourceGLBs,full.sourceTiles.map(t=>t.id));
 assert.equal(compact.atlasV.length,full.pointUV.sections.length);
 assert.deepEqual(compact.offsetsOBJ,[-.12,-.1,-.08]);
 for(let n=0;n<compact.atlasV.length;n++){
  const entry=full.pointUV.sections[n],row=compact.atlasV[n];
  assert.equal(row.length,3);
  for(let i=0;i<3;i++){
   const p=entry.offsets[i].examples[0].atlasPixel;
   assert(Math.abs(p[0]-compact.uvX[i])<.0006);
   assert(Math.abs(p[1]-row[i])<.0006);
  }
 }
 assert.deepEqual(compact.firstXZ,original.sourcePointsOBJ[0]);
 assert.deepEqual(compact.lastXZ,original.sourcePointsOBJ.at(-1));
 assert.equal(compact.certifiedRoad,false);
 assert.equal(compact.trafficEnabled,false);
 assert.equal(compact.collisionCreated,false);
});

test('R75 preview uses only existing original atlas and no gameplay integration',()=>{
 const index=fs.readFileSync('index.html','utf8');
 const preview=fs.readFileSync('chicago-original-preview.html','utf8');
 const view=fs.readFileSync('chicago-seam-r75.html','utf8');
 assert(!index.includes('chicago-seam-r75.html'));
 assert(!index.includes('corridor-seam-r75.json'));
 assert(preview.includes('href="./chicago-seam-r75.html"'));
 assert(view.includes('./chicago/chicago_atlas.webp'));
 assert(view.includes('./chicago/corridor-seam-r75.json'));
 assert(view.includes("atlas.height-1-Math.floor(uv[1])"));
 assert(!/DriverVehicle|registerRoad|createCollider|addTraffic/.test(view));
});
