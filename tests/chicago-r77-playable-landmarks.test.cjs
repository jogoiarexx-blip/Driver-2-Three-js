'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs');
const Landmarks=require('../js/world/chicago-ps1-playable-landmarks-r77.js');
const CityPlan=require('../js/world/chicago-city-plan.js');
function fakeTHREE(){
 class Group {
  constructor(){this.children=[];this.parent=null;this.name='';}
  add(...items){for(const item of items){this.children.push(item);item.parent=this;}}
 }
 class Mesh{
  constructor(geometry,material){this.geometry=geometry;this.material=material;
   this.position={set:(...a)=>{this.xyz=a}};this.name='';this.parent=null;}
 }
 class InstancedMesh extends Mesh{
  constructor(geo,mat,count){super(geo,mat);this.count=count;
   this.instanceMatrix={needsUpdate:false};}
  setMatrixAt(i,m){assert(i>=0&&i<this.count);}
 }
 class Object3D{
  constructor(){this.position={set(){}};
   this.rotation={set(){}};this.scale={set(){}};
   this.matrix={};}
  updateMatrix(){}
 }
 return {Group,Mesh,InstancedMesh,Object3D,
  TorusGeometry:class{},CylinderGeometry:class{},
  MeshLambertMaterial:class{constructor(d){this.color=d.color;}},
  SpriteMaterial:class{},
  Sprite:class extends Mesh {constructor(mat){super(null,mat);this.scale={set(){}};}}
 };
}
function city(){
 const g=new global.THREE.Group();
 return {preset:{id:'chicago',palettes:[1,2,3,4]},
  cityGroup:g,buildingBoxes:[],districtBuildings:[],
  districtChunks:new Map(),_spatialCollisions:{boxes:['stale']}};
}
test('R77 four landmark blocks are uniquely anchored in playable Chicago map grid',()=>{
 assert.deepEqual(Landmarks.SITES.map(s=>[s.x,s.z]),
  [[-40,-120],[40,120],[-120,120],[200,120]]);
 assert.equal(new Set(Landmarks.SITES.map(s=>s.id)).size,4);
 for(const s of Landmarks.SITES){
  assert.equal(Landmarks.isReservedBlock(s.x,s.z),true);
  assert.equal((s.x+40)%80,0);
  assert.equal((s.z+40)%80,0);
 }
 assert.equal(Landmarks.isReservedBlock(-280,200),false);
 assert.equal(Landmarks.isReservedBlock(-120,-120),false);
 assert.equal(Landmarks.isReservedBlock(280,-280),false);
});
test('R77 replaces generic planned lots with PS1-era Sears/Marina/Mart/Water tower',()=>{
 global.THREE=fakeTHREE();
 global.DriverChicagoPS1PlayableLandmarksR77=Landmarks;
 const calls=[];
 global.DriverSpecialStructures={pack(parent,parts,name){
  calls.push({parent,parts,name});return [];}};
 const c=city();
 for(const s of Landmarks.SITES)CityPlan.addBlock(c,s.x,s.z);
 assert.equal(c.districtBuildings.length,0,'no generic overlapping buildings');
 assert.equal(c.chicagoCityPlan.blocks.length,4);
 assert.equal(c.chicagoPS1PlayableLandmarksR77.sites.length,4);
 assert.equal(c.chicagoPS1PlayableLandmarksR77.ids.size,4);
 assert.equal(c.cityGroup.children.length,1,'four custom parcels in one root');
 assert.deepEqual(c.chicagoPS1PlayableLandmarksR77.root.children.map(c=>c.name),
  ['r77-sears-tower','r77-marina-city','r77-merchandise-mart','r77-water-tower']);
 assert.equal(c._spatialCollisions.boxes,null,'invalidate old spatial collision snapshot');
 assert.equal(calls.length,4);
 assert(calls.some(c=>c.name.includes('sears')&&c.parts.length>120));
 assert(calls.some(c=>c.name.includes('mart')&&c.parts.length>12));
 assert(calls.some(c=>c.name.includes('water')&&c.parts.length>10));
 const all=c.buildingBoxes;
 assert.equal(all.length,6,'one AABB per base; two tower cylinders plus lobby');
 for(const s of Landmarks.SITES){
  const boxes=all.filter(b=>b.chicagoPS1LandmarkR77===s.id);
  assert(boxes.length>0,'missing physical base of '+s.id);
  for(const b of boxes){
   assert(b.minX>=s.x-24.5&&b.maxX<=s.x+24.5);
   assert(b.minZ>=s.z-24.5&&b.maxZ<=s.z+24.5);
  }
 }
 for(const s of Landmarks.SITES)
  assert.equal(CityPlan.addBlock(c,s.x,s.z),undefined,'CityPlan is creation-only');
 assert.equal(c.chicagoPS1PlayableLandmarksR77.sites.length,4,
  'no duplicated landmark meshes');
 delete global.DriverChicagoPS1PlayableLandmarksR77;
 delete global.DriverSpecialStructures;
 delete global.THREE;
});
test('R77 original route and mission protected blocks remain untouched',()=>{
 const protectedSites=[[-120,-120],[120,120],[200,-200],[-200,-200],
  [120,-280],[-280,200],[-40,-280],[280,-280],[-280,-280]];
 for(const [x,z]of protectedSites){
  assert.equal(CityPlan.isProtected(x,z),true);
  assert(!Landmarks.isReservedBlock(x,z),'no replacement of protected gameplay zones');
 }
 const a=Landmarks.SITES.map(s=>({x:s.x,z:s.z}));
 for(let i=0;i<a.length;i++)
  for(let j=i+1;j<a.length;j++)
   assert(Math.hypot(a[i].x-a[j].x,a[i].z-a[j].z)>60);
});
test('R77 addresses streets by actual compass-area landmarks without adding roadway',()=>{
 assert.equal(Landmarks.STREETS.length,6);
 assert(Landmarks.STREETS.some(s=>s.name==='WACKER DR'));
 assert(Landmarks.STREETS.some(s=>s.name==='MICHIGAN AVE'));
 assert(Landmarks.STREETS.some(s=>s.name==='LAKE SHORE DR'));
 const code=fs.readFileSync('js/world/chicago-ps1-playable-landmarks-r77.js','utf8');
 assert(!/createRoad\(|registerRoad\(|addTraffic\(|mission[A-Za-z]+\s*=/.test(code));
 const html=fs.readFileSync('index.html','utf8');
 const radar=fs.readFileSync('js/ui/chicago-landmark-navigation-r56.js','utf8');
 assert(radar.includes('DriverChicagoPS1PlayableLandmarksR77.SITES'));
 assert(radar.includes('landmarkState.ids.has(site.id)'));
 const build=fs.readFileSync('js/world/city-builder.js','utf8');
 const plan=fs.readFileSync('js/world/chicago-city-plan.js','utf8');
 assert(html.includes('./js/world/chicago-ps1-playable-landmarks-r77.js'));
 assert(html.indexOf('chicago-ps1-playable-landmarks-r77.js')<
        html.indexOf('chicago-city-plan.js'));
 assert(build.includes('DriverChicagoPS1PlayableLandmarksR77.buildWayfinding(this)'));
 assert(build.includes('this.chicagoPS1PlayableLandmarksR77=null;'));
 assert(plan.includes('DriverChicagoPS1PlayableLandmarksR77.buildBlock(city,x,z)'));
});
