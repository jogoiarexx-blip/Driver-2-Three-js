'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs');
const Plan=require('../js/world/chicago-city-plan.js');
const Blocks=require('../js/world/chicago-block-generator-r78.js');
const R79=require('../js/world/chicago-downtown-corridors-r79.js');
const Nav=require('../js/traffic/chicago-mixed-navigation-r49.js');
function city(){
 return {preset:{id:'chicago',palettes:[{},{},{},{}]},
   districtChunks:new Map(),districtBuildings:[],buildingBoxes:[],interiors:[],
   roadExtent:320,buildSequence:2,
   isWaterAt:()=>false,
   getGroundHeightAt:()=>0,
   isPointBlocked(x,z,r=.3){
    return this.buildingBoxes.some(b=>x+r>b.minX&&x-r<b.maxX&&
      z+r>b.minZ&&z-r<b.maxZ);
   },
   cityGroup:{children:[],add(m){this.children.push(m);m.parent=this}}
 };
}
function make(){
 const c=city();
 for(const s of R79.CORRIDORS)
  for(const [x,z] of s.buildingCells)Plan.addBlock(c,x,z);
 return c;
}
test('R79: two connected non-grid downtown corridors and no false source certification',()=>{
 assert.equal(R79.CORRIDORS.length,2);
 assert.equal(R79.classify().originalSourceCoordinatesCertified,false);
 assert.equal(R79.classify().originalMapReplacementComplete,false);
 const c=make(),p=R79.makePlan(c);
 assert.equal(p.connectedCorridors,2);
 assert.equal(p.connectedSegments,16);
 assert.equal(p.rejected.length,0);
 assert.equal(p.links.length,16);
 assert(p.links.every(s=>s.width===5.6&&s.drivable));
 assert(p.links.every(s=>s.source==='R79-graded-connected-pavement'));
 assert(p.links.every(s=>s.from.z%80!==0&&s.to.z%80!==0),
  'new corridors must genuinely leave the 80m grid');
 assert(p.corridors.every(s=>s.contiguous));
});
test('R79: deterministic corridor-derived quadrilateral polygons contain EXACTLY the legacy real lot footprints',()=>{
 const c=make(),p=R79.makePlan(c);
 R79.linkParcels(c,p);
 assert.equal(p.polygonCells.length,8);
 assert.equal(p.matchedBuildings,40);
 assert(p.polygonCells.every(p=>p.area>450&&p.area<900));
 const ids=new Set();
 for(const b of c.districtBuildings){
  if(!b.r79ParcelPolygon)continue;
  ids.add(b.r79ParcelPolygon);
  const poly=p.polygonCells.find(q=>q.id===b.r79ParcelPolygon);
  assert(poly,'orphan parcel');
  assert.equal(b.streetFrontageR79.includes('loop-'),true);
  for(const x of [b.x-b.width/2,b.x+b.width/2])
   for(const z of [b.z-b.depth/2,b.z+b.depth/2])
    assert.equal(R79.inPolygon([x,z],poly.vertices),true);
  // No fake road collision or redundant new city structures.
  assert(!c.isPointBlocked(b.x,b.blockZ,.1));
 }
 assert.equal(ids.size,8);
 assert.equal(c.buildingBoxes.length,40);
});
test('R79: rain/water, collisions and disconnected grades kill the entire respective corridor',()=>{
 let c=make();
 c.isWaterAt=(x,z)=>x>-50&&x<-40&&z>-42&&z<-38;
 let p=R79.makePlan(c);
 assert.equal(p.connectedCorridors,1);
 assert.equal(p.connectedSegments,8);
 assert(p.rejected.some(x=>x.reason==='water'));
 c=make();
 const fakeBlocked=c.isPointBlocked.bind(c);
 c.isPointBlocked=(x,z,r)=>x>-45&&x<-35&&z<-195&&z>-205||
     fakeBlocked(x,z,r);
 p=R79.makePlan(c);
 assert.equal(p.connectedCorridors,1);
 assert(p.rejected.some(x=>x.reason==='collision'));
 c=make();
 c.getGroundHeightAt=(x,z)=>x>=-110&&x<-108?3:0;
 p=R79.makePlan(c);
 assert.equal(p.connectedCorridors,1);
 assert(p.rejected.some(x=>x.reason==='unsafe-grade'));
});
test('R79: no crash outside Chicago and idempotent build',()=>{
 assert.equal(R79.makePlan({preset:{id:'rio'}}),null);
 assert.equal(R79.build({preset:{id:'vegas'}}),null);
 const c=make();
 const p=R79.build(c);
 assert.equal(p.connectedSegments,16);
 assert.equal(p.polygonCells.length,8);
 assert.equal(R79.build(c),p);
 assert.equal(c.chicagoCityPlan.r79RoadSegments,16);
 assert.equal(c.chicagoCityPlan.r79PolygonSides,8);
 assert.equal(c.districtBuildings.length,40);
 assert.equal(c.buildingBoxes.length,40);
});
test('R79: the SAME approved pavement network must be usable by R49 AI graph at real gateways',()=>{
 const c=make();R79.build(c);
 const g=Nav.compile(c);
 assert.equal(g.downtownR79Segments,16);
 assert.equal(g.downtownR79Connected,16);
 for(const source of R79.CORRIDORS){
  const start={x:source.points[0][0],z:source.points[0][1]},
   end={x:source.points.at(-1)[0],z:source.points.at(-1)[1]};
  const route=Nav.plan(c,start,end);
  assert(route&&route.length>2,'no route on '+source.id);
  for(let i=1;i<route.length;i++)
    assert(Nav.clear(c,route[i-1],route[i],false),
     'graph crosses illegal geometry');
 }
 const old=g;
 c.chicagoDowntownR79.links=c.chicagoDowntownR79.links.slice(0,8);
 assert.notEqual(Nav.compile(c),old,'R49 must invalidate when R79 changes');
});
test('R79: no gameplay missions/moves, no GLB misrepresentation, no blank road promises',()=>{
 const js=fs.readFileSync('js/world/chicago-downtown-corridors-r79.js','utf8');
 const game=fs.readFileSync('index.html','utf8');
 const builder=fs.readFileSync('js/world/city-builder.js','utf8');
 assert(game.includes('chicago-downtown-corridors-r79.js'));
 assert(builder.includes('DriverChicagoDowntownCorridorsR79.build(this)'));
 assert(!/missionActive\s*=|secretGate\s*=|tanner\.setPosition/.test(js));
 assert(js.includes('originalSourceCoordinatesCertified:false'));
 assert(js.includes('sourcePS1SegmentCertified:false')===false);
 assert(js.includes('originalPS1SegmentCertified:false'));
 assert(!js.includes('DriverChicagoPS1StreetNetwork.makeMesh'));
});
