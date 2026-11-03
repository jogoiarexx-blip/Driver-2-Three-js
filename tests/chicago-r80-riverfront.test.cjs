'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs');
const River=require('../js/world/chicago-ps1-river-branches.js');
const R80=require('../js/world/chicago-riverfront-r80.js');
const Nav=require('../js/traffic/chicago-mixed-navigation-r49.js');
global.DriverChicagoPS1RiverBranches=River;
class Group{
 constructor(){this.children=[];this.parent=null;this.userData={};this.name='';}
 add(child){this.children.push(child);child.parent=this;}
}
function mock(){
 const existing=[
  {minX:-304.5,maxX:-295.5,minZ:-125,maxZ:-115,chicagoR53Lot:true},
  {minX:-184.5,maxX:-175.5,minZ:-45,maxZ:-35,chicagoR53Lot:true}
 ];
 const buildings=[
  {pilotR78:true,blockX:-200,blockZ:120,
   x:-185,z:134,width:10,depth:14,height:12.8},
  {pilotR78:true,blockX:-200,blockZ:120,
   x:-185,z:106,width:10,depth:14,height:12.6}
 ];
 return {
  preset:{id:'chicago'},buildingBoxes:existing,
  districtBuildings:buildings,cityGroup:new Group(),
  chicagoPS1RiverBranches:{bridgeCount:10},
  _spatialCollisions:{boxes:['stale']},
  bridgeRaised:false,bridgeAngle:.08,buildSequence:1,roadExtent:320,
  isWaterAt(x,z){return River.waterAt(x,z);},
  getGroundHeightAt(x,z){return this.isWaterAt(x,z)?-4:0;},
  isPointBlocked(x,z,r=.2){return this.buildingBoxes.some(b=>
   x+r>b.minX&&x-r<b.maxX&&
   z+r>b.minZ&&z-r<b.maxZ);}
 };
}
function enable(){
 global.THREE={Group};
 const packed=[];
 global.DriverSpecialStructures={pack(parent,parts,name){
  packed.push({name,parts});return [];}};
 return packed;
}
test('R80: enumerate 10 already-existing fixed river decks, never invent a bridge',()=>{
 const sites=R80.fixedBridgeSites();
 assert.equal(sites.length,10);
 for(const p of sites){
  assert(River.isBridge(p.x,p.z));
  assert(!River.waterAt(p.x,p.z));
 }
 assert.equal(R80.classify().originalPS1PlacementCertified,false);
 assert.equal(R80.classify().drivableRoutesAdded,0);
 assert.equal(R80.classify().waterPhysicsChanged,false);
});
test('R80: river-bank walls and matching physical AABB colliders never seal fixed bridge approaches',()=>{
 const packed=enable(),c=mock(),count=c.buildingBoxes.length,
  report=R80.build(c);
 assert(report.ready);
 assert(report.railsCreated>8);
 assert(report.quaySegments>8);
 assert.equal(report.colliders.length,report.railsCreated);
 assert.equal(c.buildingBoxes.length,count+report.railsCreated);
 assert.equal(c._spatialCollisions.boxes,null);
 assert.equal(R80.build(c),report,'never duplicate geometry on rebuild');
 assert.equal(packed.length,4,'banks, quays, fixed bridge details, facades');
 assert(packed.some(p=>p.name==='r80-physical-bank-caps'));
 assert(packed.some(p=>p.name==='r80-dry-quays'));
 assert(packed.some(p=>p.name==='r80-bridge-caps-and-rivets'));
 assert(packed.some(p=>p.name==='r80-river-facing-existing-facades'));
 const coords=new Set();
 for(const box of report.colliders){
  assert.equal(box.chicagoRiverfrontR80,true);
  assert(Math.abs(box.maxX-box.minX-.26)<1e-9);
  assert(Math.abs(box.maxZ-box.minZ-10)<1e-9);
  const x=(box.maxX+box.minX)/2,z=(box.maxZ+box.minZ)/2;
  assert.equal(c.isWaterAt(x,z),false);
  assert.equal(c.isPointBlocked(x,z,.04),true);
  assert(!River.isBridge(x,z));
  const key=x+':'+z;assert(!coords.has(key));coords.add(key);
 }
 for(const bank of R80.BANKS)for(const z of bank.bridges){
  assert.equal(c.isWaterAt(bank.x,z),false);
  for(const x of [bank.x-9,bank.x,bank.x+9])
    assert.equal(c.isPointBlocked(x,z,1.2),false,
     'no R80 rail seals the drivable bridge deck');
 }
 delete global.THREE;delete global.DriverSpecialStructures;
});
test('R80: river-facing details are attached to existing R53/R78 buildings, not fake new parcels',()=>{
 enable();const c=mock(),boxes=c.buildingBoxes.length;
 const before=JSON.stringify(c.districtBuildings),report=R80.build(c);
 assert.equal(report.r53Buildings,2);
 assert.equal(report.r78CanalBuildings,2);
 assert.equal(report.facades,4);
 assert(report.facadeParts>=24);
 assert.equal(c.buildingBoxes.length,boxes+report.railsCreated);
 assert.equal(JSON.stringify(c.districtBuildings),before);
 assert.equal(report.fixedBridgeCount,10);
 assert.equal(report.dynamicBridgePivotsTouched,false);
 delete global.THREE;delete global.DriverSpecialStructures;
});
test('R80: incomplete / flooded / obstructed banks are rejected; do not make phantom AABB over water',()=>{
 enable();const c=mock();
 c.isWaterAt=(x,z)=>River.waterAt(x,z) ||
  (z>-28&&z<-17&&x>-253&&x<-251);
 const before=c.buildingBoxes.length,report=R80.build(c);
 assert(report.bankRejected.length>0);
 assert(report.railsCreated>0);
 for(const b of report.colliders){
  const x=(b.minX+b.maxX)/2,z=(b.minZ+b.maxZ)/2;
  assert.equal(c.isWaterAt(x,z),false);
 }
 assert(report.railsCreated<c.buildingBoxes.length-before+1);
 delete global.THREE;delete global.DriverSpecialStructures;
});
test('R80: physics & AI reject raised drawbridges at x=0 and x=240, keep R2 fixed bridge valid',()=>{
 enable();const c=mock();R80.build(c);
 const draws=[
  [{x:0,z:30},{x:0,z:70}],
  [{x:240,z:30},{x:240,z:70}]
 ];
 for(const [a,b] of draws)assert.equal(Nav.bridgeClosed(c,a,b),false);
 c.bridgeRaised=true;c.bridgeAngle=.38;
 for(const [a,b] of draws)assert.equal(Nav.bridgeClosed(c,a,b),true);
 const fixed=[{x:-280,z:-80},{x:-200,z:-80}];
 assert.equal(Nav.bridgeClosed(c,...fixed),false);
 assert.equal(Nav.clear(c,...fixed),true,
  'existing west fixed bridge must remain physically traversable');
 c.bridgeRaised=false;c.bridgeAngle=.04;
 for(const [a,b]of draws)assert.equal(Nav.bridgeClosed(c,a,b),false);
 delete global.THREE;delete global.DriverSpecialStructures;
});
test('R80: no mission changes, correct load order and no effects on non-Chicago cities',()=>{
 const c=mock();c.preset.id='havana';
 assert.equal(R80.build(c),null);
 const file=fs.readFileSync('js/world/chicago-riverfront-r80.js','utf8');
 const html=fs.readFileSync('index.html','utf8');
 const builder=fs.readFileSync('js/world/city-builder.js','utf8');
 assert(html.includes('chicago-riverfront-r80.js'));
 assert(html.indexOf('chicago-riverfront-r80.js')<
        html.indexOf('city-builder.js'));
 assert(builder.includes('DriverChicagoRiverfrontR80.build(this)'));
 assert(builder.includes('this.chicagoRiverfrontR80=null'));
 assert(!/missionActive\s*=|playerCar\.x\s*=|tanner\.setPosition/.test(file));
});
