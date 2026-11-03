'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs');
const R81=require('../js/world/chicago-goose-industrial-r81.js');
const River=require('../js/world/chicago-ps1-river-branches.js');
const R78=require('../js/world/chicago-block-generator-r78.js');
const Nav=require('../js/traffic/chicago-mixed-navigation-r49.js');
global.DriverChicagoPS1RiverBranches=River;
function fakeThree(){
 class Group{constructor(){this.children=[];this.userData={};}add(c){this.children.push(c);}}
 class Geo{setAttribute(k,v){this[k]=v;}computeVertexNormals(){}}
 class Mesh extends Group{
  constructor(g,m){super();this.geometry=g;this.material=m;}
 }
 return {Group,Mesh,BufferGeometry:Geo,
  Float32BufferAttribute:class{constructor(values,size){this.values=values;this.size=size}},
  MeshLambertMaterial:class{constructor(v){this.v=v}},DoubleSide:2};
}
function fixture(){
 const r4=[
  {minX:-225,maxX:-212,minZ:180,maxZ:220},
  {minX:-188,maxX:-175,minZ:180,maxZ:220}
 ],r6=[
  {minX:-225,maxX:-212,minZ:266,maxZ:289},
  {minX:-188,maxX:-175,minZ:266,maxZ:289}
 ];
 const lots=R78.lots(-200,120),boxes=[
  ...r4,...r6,
  ...lots.map(b=>({minX:b.x-b.width/2,maxX:b.x+b.width/2,
   minZ:b.z-b.depth/2,maxZ:b.z+b.depth/2})),
  {minX:-227.73,maxX:-227.47,minZ:253,maxZ:263},
  {minX:-172.53,maxX:-172.27,minZ:253,maxZ:263}
 ];
 return {
  preset:{id:'chicago'},roadExtent:320,buildSequence:1,
  bridgeRaised:false,bridgeAngle:.08,
  buildingBoxes:boxes,districtBuildings:lots,
  interiors:[],cityGroup:new (fakeThree().Group)(),
  chicagoPS1RiverBranches:{bridgeCount:10},
  chicagoGooseIslandStreet:{buildings:r4},
  chicagoGooseIslandNorthYard:{buildings:r6},
  _spatialCollisions:{boxes:['stale']},
  isWaterAt(x,z){return River.waterAt(x,z);},
  getGroundHeightAt(){return 0;},
  isPointBlocked(x,z,r=.2){return this.buildingBoxes.some(b=>
    x+r>b.minX&&x-r<b.maxX&&z+r>b.minZ&&z-r<b.maxZ);}
 };
}
function withThree(cb){
 global.THREE=fakeThree();const packed=[];
 global.DriverSpecialStructures={pack(parent,parts,name){
  packed.push({name,parts});return [];}};
 try{return cb(packed);}finally{
  delete global.THREE;delete global.DriverSpecialStructures;
 }
}
test('R81: two safe yards, four connected lanes; no bridge or PS1-coordinate fiction',()=>{
 const c=fixture(),p=R81.plan(c);
 assert.equal(p.ready,true,JSON.stringify(p.rejected));
 assert.equal(p.padPlan.length,2);
 assert.equal(p.routePlan.length,4);
 assert.equal(p.rejected.length,0);
 assert(p.dryFloorSamples>=200);
 assert.equal(p.originalPS1StreetCoordinatesCertified,false);
 assert.equal(p.existingWaterAndBridgesUnchanged,true);
 assert(R81.ROUTES.some(r=>r.b[0]===-160&&r.b[1]===240));
 assert.equal(River.waterAt(-160,240),false);
 assert.equal(River.waterAt(-160,200),true);
});
test('R81: add a *new* actual accessible OFFICE in a real R78 warehouse',()=>{
 const c=fixture();
 const original=R78.lots(-200,120).filter(b=>b.interiorId).length;
 assert.equal(original,1);
 const p=R81.registerOffice(c);
 assert(p);
 assert.equal(p.id,'r81-goose-yard-office');
 assert.equal(p.kind,'r81-office');
 assert.equal(p.interiorLevel,'partial');
 assert.equal(p.accessible,true);
 assert.equal(c.interiors.length,1);
 assert.equal(c.districtBuildings.find(b=>b.id===p.r81SourceLot).interiorTier,'partial');
 assert(!c.isWaterAt(p.door.x,p.door.z));
 assert(!c.isPointBlocked(p.door.x,p.door.z+4,.4));
 assert.equal(R81.registerOffice(c),p,'do not duplicate room trigger');
 withThree(pack=>{
  const n=R81.decorateOffice(c);
  assert(n>=7);
  assert(pack.some(x=>x.name.includes('warehouse-office-furniture')));
  assert.equal(p.r81FurnitureCount,n);
 });
});
test('R81: real cargo stacks have 1:1 visible geometry/AABB, not obstacles in truck route',()=>withThree(pack=>{
 const c=fixture(),old=c.buildingBoxes.length;R81.registerOffice(c);
 const report=R81.build(c);
 assert(report.ready,JSON.stringify(report.rejected));
 assert.equal(report.yards.length,2);
 assert.equal(report.links.length,4);
 assert.equal(report.existingWarehouses.length,4);
 assert.equal(report.facadeParts>25,true);
 assert.equal(report.roomRegistered,true);
 assert.equal(report.storageBoxes.length,4);
 assert.equal(c.buildingBoxes.length-old,4);
 assert.equal(c._spatialCollisions.boxes,null);
 assert(pack.some(x=>x.name==='r81-yard-real-cargo-AABB'));
 assert(pack.some(x=>x.name==='r81-sequential-warehouse-fronts'));
 for(const b of report.storageBoxes){
  const x=(b.maxX+b.minX)/2,z=(b.maxZ+b.minZ)/2;
  assert(!c.isWaterAt(x,z));
  assert.equal(c.isPointBlocked(x,z,.1),true);
 }
 assert.equal(R81.build(c),report);
 for(const link of report.links){
  assert(Nav.clear(c,link.from,link.to,false),
    'approved route became blocked after adding crates: '+link.id);
 }
}));
test('R81: failure-safe — no roads, collision or phantom yard if canal or warehouse obstructs one pad',()=>withThree(()=>{
 const c=fixture(),old=c.buildingBoxes.length;
 c.isWaterAt=(x,z)=>River.waterAt(x,z)||
    (x<-216&&x>-220&&z>246&&z<253);
 const a=R81.build(c);
 assert.equal(a.ready,false);
 assert.equal(a.links.length,0);
 assert.equal(a.yards.length,0);
 assert.equal(a.storageBoxes.length,0);
 assert.equal(c.buildingBoxes.length,old);
 assert(a.rejected.some(r=>r.id==='west-loading-yard'));
 const e=fixture();e.buildingBoxes.push({minX:-203,maxX:-197,minZ:246,maxZ:253});
 const result=R81.plan(e);
 assert(!result.ready);
 assert(result.rejected.some(r=>r.reason==='obstacle'));
}));
test('R81: R49 navigation uses exact verified yard road endpoints and drops routes if graph changes',()=>withThree(()=>{
 const c=fixture();R81.registerOffice(c);R81.build(c);
 const g=Nav.compile(c);
 assert.equal(g.gooseYardR81Segments,4);
 assert.equal(g.gooseYardR81Connected,4);
 const route=Nav.plan(c,{x:-218,z:250},{x:-160,z:240});
 assert(route&&route.length>=4);
 for(let i=1;i<route.length;i++)
  assert(Nav.clear(c,route[i-1],route[i],false));
 const prev=g;
 c.chicagoGooseIndustrialR81.links=c.chicagoGooseIndustrialR81.links.slice(0,2);
 assert.notEqual(Nav.compile(c),prev,'R81 graph source stamp invalidates cache');
}));
test('R81: only Chicago, no mission edits, preserve R77-R80 modules and load order',()=>{
 const c=fixture();c.preset.id='rio';
 assert.equal(R81.plan(c),null);
 assert.equal(R81.build(c),null);
 assert.equal(R81.registerOffice(c),null);
 const js=fs.readFileSync('js/world/chicago-goose-industrial-r81.js','utf8'),
  html=fs.readFileSync('index.html','utf8'),
  builder=fs.readFileSync('js/world/city-builder.js','utf8'),
  nav=fs.readFileSync('js/traffic/chicago-mixed-navigation-r49.js','utf8');
 assert(html.indexOf('chicago-goose-industrial-r81.js')<
        html.indexOf('city-builder.js'));
 assert(builder.includes('DriverChicagoGooseIndustrialR81.registerOffice(this)'));
 assert(builder.includes('DriverChicagoGooseIndustrialR81.decorateOffice(this)'));
 assert(builder.includes('DriverChicagoGooseIndustrialR81.build(this)'));
 assert(nav.includes('gooseYardR81Connected'));
 assert(!/missionActive\s*=|garageExit\s*=|bridgeRaised\s*=/.test(js));
});
