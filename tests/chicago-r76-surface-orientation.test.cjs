'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const R76=require('../tools/chicago-r76-surface-orientation.cjs');
const triangle=[[-1,0,0],[1,0,0],[1,0,1]];
const flat={tile:'01_02',triangleIndex:0,tri:triangle,
 uvs:[[70,200],[71,201],[72,202]],
 orientation:R76.orientation(triangle)};
const report={candidateEdgeId:3445,originalRoadCertified:false,
 sourceSHA256:'fixture',sourcePointsOBJ:[[0,0],[0,1]],
 tiles:[{id:'01_02'},{id:'01_03'}]};
test('R76 orientation is winding-independent; reject vertical and classify inclined',()=>{
 const horizontal=R76.orientation(triangle);
 assert.equal(horizontal.kind,'near_horizontal');
 assert.equal(R76.orientation(triangle.slice().reverse()).kind,'near_horizontal');
 assert.equal(horizontal.angle,0);
 const wall=R76.orientation([[0,0,0],[0,1,0],[0,0,1]]);
 assert.equal(wall.kind,'vertical_or_edge_on');
 assert.equal(wall.projectedAreaOBJ2,0);
 assert.equal(R76.orientation([[0,0,0],[1,1,0],[1,1,1]]).kind,'steep_wall_like');
 assert.equal(R76.orientation([[0,0,0],[2,1,0],[2,1,1]]).kind,'inclined');
 assert.equal(R76.orientation([[0,0,0],[0,0,0],[0,0,0]]).kind,'degenerate_triangle');
});
test('R76 indexed exact barycentrics retain tile, triangle IDs, UVs and height',()=>{
 const index=R76.indexRows([flat]);
 const a=R76.sample(index,0,.5);
 assert.equal(a.count,1);
 assert.equal(a.hits[0].tile,'01_02');
 assert.equal(a.hits[0].triangleIndex,0);
 assert.equal(a.hits[0].sourceYOBJ,0);
 assert.equal(a.hits[0].geometryClass,'near_horizontal');
 assert.equal(a.hits[0].uvMaterial,'r26_paving_uv_heuristic');
 assert.equal(R76.sample(index,-1.1,.5).count,0);
});
test('R76 preserves overlapping same-height triangles and mixed materials',()=>{
 const other={...flat,tile:'01_03',triangleIndex:14,
  uvs:[[500,500],[501,501],[502,502]]};
 const idx=R76.indexRows([flat,other]);
 const a=R76.sample(idx,0,.5);
 assert.equal(a.count,2);
 assert.equal(a.mixedAtlasUV,true);
 assert.equal(a.overlappingHeights,false);
 assert.deepEqual(a.hits.map(h=>h.tile),['01_02','01_03']);
});
test('R76 flags multilevel overlap without inventing road',()=>{
 const upper={...flat,tri:triangle.map(v=>[v[0],v[1]+.2,v[2]])};
 const s=R76.sample(R76.indexRows([flat,upper]),0,.5);
 assert.equal(s.count,2);
 assert(s.heightSpreadOBJ>=.2);
 assert.equal(s.overlappingHeights,true);
});
test('R76 synthetic full profile preserves driveability block and 3D material provenance',()=>{
 const result=R76.inspect(report,[flat]);
 assert.equal(result.evidence.sections,5);
 assert.equal(result.evidence.pointSamples,75);
 assert.equal(result.certifiedRoad,false);
 assert.equal(result.runtimeRoadEnabled,false);
 assert.equal(result.collidersCreated,0);
 assert.equal(result.geometryChanged,false);
 assert.equal(result.missionsChanged,false);
 assert.equal(result.evidence.focalOffsets['-0.1'].sections,5);
 const small=R76.compact(result);
 assert.equal(small.crossSections.length,5);
 assert.equal(small.crossSections[0].cuts.length,3);
 assert.equal(small.certifiedRoad,false);
});
test('R76 tall triangle is not made driveable just because atlas UV resembles paving',()=>{
 const tall={...flat,tri:[[0,0,0],[1,1,0],[1,1,1]],
  orientation:R76.orientation([[0,0,0],[1,1,0],[1,1,1]])};
 const s=R76.sample(R76.indexRows([tall]),.75,.5);
 assert.equal(s.count,1);
 assert.equal(s.hits[0].geometryClass,'steep_wall_like');
 assert.equal(s.hits[0].uvMaterial,'r26_paving_uv_heuristic');
});
