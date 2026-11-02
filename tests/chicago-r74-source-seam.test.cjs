'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const R74=require('../tools/chicago-r74-source-seam.cjs');
const plane=[
 [[-1,0,0],[1,0,0],[1,0,1]],
 [[-1,0,0],[1,0,1],[-1,0,1]]
];
const survey={xminOBJ:-2,zmaxOBJ:2,stepOBJ:.1,width:41,height:41};
const report={candidateEdgeId:3445,originalRoadCertified:false,
 sourceSHA256:'fixture',sourcePointsOBJ:[[0,0],[0,1]],
 tiles:[{id:'01_02'},{id:'01_03'}]};
function masks(){
 const n=Math.ceil(survey.width*survey.height/8);
 return {markedPaving:Buffer.alloc(n),plainPaving:Buffer.alloc(n,255),
  grass:Buffer.alloc(n),water:Buffer.alloc(n)};
}
function sets(which){
 return {all:which.includes('a')?plane:[],
  grade:which.includes('g')?plane:[],
  uv:which.includes('u')?plane:[],
  paving:which.includes('p')?plane:[]};
}
test('R74 original R26 UV bounds require all vertices inside paved atlas region',()=>{
 assert(R74.withinUV([[65,191],[67,200],[100,253]]));
 assert(R74.withinUV([[2,88],[3,89],[64,151]]));
 assert.equal(R74.withinUV([[65,191],[67,200],[100,255]]),false);
 assert.equal(R74.withinUV([[500,500],[501,501],[510,500]]),false);
});
test('R74 distinguishes no triangle from grade or UV source exclusions',()=>{
 assert.equal(R74.inspect(report,survey,masks(),sets('')).evidence.minusPointOneOBJ[0].reason,'no_original_triangle');
 assert.equal(R74.inspect(report,survey,masks(),sets('a')).evidence.minusPointOneOBJ[0].reason,'grade_filter_rejected');
 assert.equal(R74.inspect(report,survey,masks(),sets('ag')).evidence.minusPointOneOBJ[0].reason,'uv_paving_filter_rejected');
});
test('R74 detects a real material-match in continuous synthetic geometry without claiming driving',()=>{
 const result=R74.inspect(report,survey,masks(),sets('agup'));
 assert.equal(result.evidence.crossSections,5);
 assert.deepEqual(result.evidence.minusPointOneOBJ,[{reason:'paving_match_uncertified',count:5}]);
 assert.equal(result.originalRoadCertified,false);
 assert.equal(result.trafficEnabled,false);
 assert.equal(result.collidersCreated,0);
 assert.equal(result.sourceGeometryModified,false);
 assert.equal(result.undercoverPositionCalibrated,false);
 assert(result.sections[0].seamNeighborhood.length===5);
});
test('R74 differentiates grass from UV rejection',()=>{
 const m=masks();
 const col=Math.round((-.1-survey.xminOBJ)/survey.stepOBJ);
 for(let row=0;row<survey.height;row++){
  const k=row*survey.width+col;
  m.grass[k>>>3]|=(128>>>(k&7));
 }
 const result=R74.inspect(report,survey,m,sets('agup'));
 assert.deepEqual(result.evidence.minusPointOneOBJ,[{reason:'r24_grass',count:5}]);
});
test('R74 UV and height polygons from raw mock accessors are independently counted',()=>{
 const xyz=[[0,0,0],[1,0,0],[0,0,1],
  [0,.4,0],[1,.4,0],[0,.4,1],
  [0,0,0],[1,0,0],[0,0,1]];
 const uv=[[70,200],[80,210],[85,220],
  [70,200],[80,210],[85,220],
  [500,500],[510,510],[520,520]];
 const accessor=arr=>({count:arr.length,get:(i,j)=>arr[i][j]});
 const out=R74.extract({pos:accessor(xyz),
  uv:accessor(uv.map(x=>x.map(k=>k/2048))),
  indices:{count:9,get:i=>i}}, {minX:-1,maxX:2,minZ:-1,maxZ:2});
 assert.deepEqual(out.counts,{
  inRect:3,failedGrade:1,failedUV:1,nonFinite:0,pavementUVAndGrade:1});
 assert.equal(out.sets.all.length,3);
 assert.equal(out.sets.grade.length,2);
 assert.equal(out.sets.uv.length,2);
 assert.equal(out.sets.paving.length,1);
});
