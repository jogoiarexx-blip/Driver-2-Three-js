'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
    fs=require('node:fs'),zlib=require('node:zlib');
const Path=require('../js/world/chicago-ps1-eastern-fork-r25.js');
const R23=require('../js/world/chicago-ps1-north-candidate-r23.js');
const Net=require('../js/world/chicago-ps1-street-network-r22.js');
const Evidence=require('../js/world/chicago-road-evidence-r24.js');
const ref=require('../chicago/reference-eastern-fork-r25.json');
const graph=require('../chicago/reference-network.json');
test('R25 exactly follows 3 connected source graph edges starting where R23 ended',()=>{
 assert.deepEqual(ref.sourceEdgeIds,[1520,1437,1017]);
 assert.deepEqual(ref.sourceNodeIds,[1125,1100,1043,752]);
 assert.equal(ref.sourceToR23Node,1125);
 let points=[];
 ref.sourceEdgeIds.forEach((id,index)=>{
  const edge=graph.edges[id],from=ref.sourceNodeIds[index],
    to=ref.sourceNodeIds[index+1];
  assert(edge.from===from&&edge.to===to||
      edge.from===to&&edge.to===from,
      'source edge '+id+' does not connect required nodes');
  const step=edge.from===from?edge.pointsOBJ:[...edge.pointsOBJ].reverse();
  if(index)assert.deepEqual(points.at(-1),step[0]);
  points.push(...step.slice(index?1:0));
 });
 assert.deepEqual(points,ref.pointsOBJ);
 assert.deepEqual(points[0],require('../chicago/reference-north-candidate-r23.json').pointsOBJ.at(-1));
 assert.equal(ref.sourceSHA256,graph.sourceSHA256);
});
test('R25 follows the exact R15 similarity fit, connects R23 and preserves source geometry',()=>{
 const road=Path.plan(),previous=R23.plan();
 const end=road.points.at(-1),expected=Path.fitPoint(ref.pointsOBJ.at(-1));
 assert.deepEqual(road.points[0],previous.points.at(-1));
 assert.deepEqual(end,expected);
 assert(road.points.length>20);
 assert(road.points.at(-1).z>previous.points.at(-1).z);
 assert(road.points.at(-1).x>previous.points.at(-1).x);
 assert.equal(road.width,8);
 assert.deepEqual(road.lots,[]);
 assert.equal(road.roadClassificationCertified,false);
 assert.equal(road.gradedJunctionsCertified,false);
 assert.equal(road.originalPlacementCertified,false);
 assert.equal(road.missionsMigrated,false);
 assert.equal(road.wholeMapCertified,false);
});
test('R25 requires physically safe pavement before building its mesh',()=>{
 const path=Path.plan();
 const point=path.points[Math.floor(path.points.length/2)];
 const fixture={preset:{id:'chicago'},cityGroup:{children:[]},
  buildingBoxes:[],isPointBlocked:(x,z)=>Math.hypot(x-point.x,z-point.z)<6,
  isWaterAt:()=>false};
 assert.throws(()=>Path.prepare(fixture),/não cabe no corredor/);
 assert.equal(fixture.chicagoReferenceEasternForkR25,undefined);
});
test('R25 is correctly wired into Chicago builder, after R23 and before source radar',()=>{
 const code=fs.readFileSync('js/world/city-builder.js','utf8');
 const html=fs.readFileSync('index.html','utf8');
 const a=code.indexOf('DriverChicagoPS1NorthCandidateR23.prepare(this)');
 const b=code.indexOf('DriverChicagoPS1EasternForkR25.prepare(this)');
 const c=code.indexOf('DriverChicagoPS1StreetNetwork.build(this)');
 assert(a>0&&b>a&&c>b);
 const x=html.indexOf('reference-eastern-fork-r25.js');
 const y=html.indexOf('chicago-ps1-eastern-fork-r25.js');
 const z=html.indexOf('chicago-ps1-street-network-r22.js');
 assert(x>0&&y>x&&z>y);
 const unmodified=ref.pointsOBJ.at(-1);
 assert.deepEqual(unmodified,[-78.725,157.132]);
 const city={preset:{id:'havana'}};
 assert.equal(Path.prepare(city),null);
 assert.equal(Net.build(city),null);
});
test('R25 surfaces get independently ranked using actual PS1 material masks, no artificial certification',()=>{
 const survey=require('../chicago/reference-street-survey.json');
 const masks=Object.fromEntries(Evidence.LAYERS.map(k=>[
  k,zlib.gunzipSync(Buffer.from(survey.layers[k].gzipBitsetBase64,'base64'))
 ]));
 const records=ref.sourceEdgeIds.map(id=>({
  id,...Evidence.profile(graph.edges[id],survey,masks)
 }));
 assert(records.every(e=>e.center>=0&&e.center<=1));
 assert(records.every(e=>!e.roadCertified&&!e.gradeCertified));
 assert(records.every(e=>e.water<.09&&e.confidence!=='reject'),
  JSON.stringify(records));
 console.log('CHICAGO_R25_SOURCE_MATERIAL',JSON.stringify(records.map(e=>({
  id:e.id,class:e.confidence,lengthOBJ:e.lengthOBJ,
  marked:e.marked,shoulders:e.shoulders,outer:e.outerEdges
 }))));
});
