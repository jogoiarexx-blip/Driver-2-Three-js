'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Probe=require('../tools/chicago-r73-triangle-width.cjs');
const {sample}=require('../js/world/chicago-road-evidence-r24.js');
const plane=[
 [[-1,0,0],[1,0,0],[1,0,1]],
 [[-1,0,0],[1,0,1],[-1,0,1]]
];
const survey={xminOBJ:-2,zmaxOBJ:2,stepOBJ:.1,width:41,height:41};
function filled(value=0){
 const b=Buffer.alloc(Math.ceil(survey.width*survey.height/8),value);
 return {markedPaving:Buffer.alloc(b.length),plainPaving:b,
  grass:Buffer.alloc(b.length),water:Buffer.alloc(b.length)};
}
const report={candidateEdgeId:3445,originalRoadCertified:false,
 sourceSHA256:'fixture',sourcePointsOBJ:[[0,0],[0,1]],
 tiles:[{id:'01_02'},{id:'01_03'}]};
test('R73 probes exact XZ triangles, not just bounding boxes',()=>{
 const index=Probe.indexTriangles(plane);
 assert.equal(Probe.footprint(index,0,.5).present,true);
 assert.equal(Probe.footprint(index,0,.5).y,0);
 assert.equal(Probe.footprint(index,1.01,.5).present,false);
 assert.equal(Probe.footprint(index,0,1.01).present,false);
 assert.equal(Probe.heightAt([[-1,0,0],[1,0,0],[1,0,1]],0,.75),null);
});
test('R73 full synthetic pavement is still explicitly uncertified',()=>{
 const result=Probe.inspect(report,survey,filled(255),plane);
 assert.equal(result.evidence.totalCrossSections,5);
 assert.equal(result.evidence.crossSectionsFullyCovered,5);
 assert.equal(result.evidence.minimumSymmetricWidthOBJ,1.6);
 assert.equal(result.certifiedForDriving,false);
 assert.equal(result.calibratedToUndercover,false);
 assert.equal(result.trafficEnabled,false);
 assert.equal(result.collidersCreated,0);
 assert.equal(result.missionsChanged,false);
});
test('R73 rejects uncovered surface even when R24 mask says paved',()=>{
 const strip=[ [[-.2,0,0],[.2,0,0],[.2,0,1]],
  [[-.2,0,0],[.2,0,1],[-.2,0,1]] ];
 const result=Probe.inspect(report,survey,filled(255),strip);
 assert(result.evidence.maximumSymmetricWidthOBJ<.8);
 assert(result.evidence.rejectedSampleReasons.geometryMissing>0);
});
test('R73 blocks overlapping pavement at different heights',()=>{
 const layered=plane.concat(plane.map(tri=>tri.map(p=>[p[0],p[1]+.15,p[2]])));
 const result=Probe.inspect(report,survey,filled(255),layered);
 assert.equal(result.evidence.minimumSymmetricWidthOBJ,0);
 assert(result.evidence.rejectedSampleReasons.stacked>0);
});
test('R73 R24 raster flags grass/unknown and hard-stops lateral width',()=>{
 const masks=filled(255);
 const c=Math.round((.2-survey.xminOBJ)/survey.stepOBJ);
 for(let row=0;row<survey.height;row++){
  const i=row*survey.width+c;
  masks.grass[i>>>3]|=128>>>(i&7);
 }
 assert(sample.call(require('../js/world/chicago-road-evidence-r24.js'),survey,masks,.2,.5).grass);
 const result=Probe.inspect(report,survey,masks,plane);
 assert(result.evidence.maximumSymmetricWidthOBJ<=.2);
 assert(result.evidence.rejectedSampleReasons.grass>0);
});
test('R73 triangles from old GLB accessors obey paving-UV and height filters',()=>{
 const xyz=[[0,0,0],[1,0,0],[0,0,1],[2,0,0],[3,0,0],[2,0,1]];
 const tex=[[70,200],[80,210],[85,220],[500,500],[510,510],[520,520]];
 const get=(pts)=>({count:pts.length,get:(i,j)=>pts[i][j]});
 const accessors={pos:get(xyz),uv:get(tex.map(p=>p.map(v=>v/2048))),
  indices:{count:6,get:i=>i}};
 assert.equal(Probe.fixtureTriangles(accessors,{minX:-1,maxX:4,minZ:-1,maxZ:2}).length,1);
});
