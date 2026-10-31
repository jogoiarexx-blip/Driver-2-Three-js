'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

const xyz=(x=0,y=0,z=0)=>({x,y,z,set(a,b,c){this.x=a;this.y=b;this.z=c}});
class Node{
 constructor(){this.children=[];this.parent=null;this.position=xyz();
  this.rotation=xyz();this.scale=xyz(1,1,1);this.matrix={};this.userData={}}
 add(...nodes){for(const n of nodes){n.parent=this;this.children.push(n)}}
 updateMatrix(){}
}
class Geo{
 constructor(...args){this.args=args;this.attributes={}}
 setAttribute(n,v){this.attributes[n]=v}
 computeVertexNormals(){}
 rotateX(){return this}
}
class Mat{constructor(opts={}){Object.assign(this,opts);this.color={getHex:()=>opts.color}}}
class Mesh extends Node{constructor(g,m){super();this.geometry=g;this.material=m;this.isMesh=true}}
class InstancedMesh extends Mesh{
 constructor(g,m,n){super(g,m);this.count=n;this.instanceMatrix={needsUpdate:false}}
 setMatrixAt(){}
}
class BoxGeometry extends Geo{}class SphereGeometry extends Geo{}
class TorusGeometry extends Geo{}class CircleGeometry extends Geo{}
class CylinderGeometry extends Geo{}class ConeGeometry extends Geo{}
class PlaneGeometry extends Geo{}class BufferGeometry extends Geo{}
class Float32BufferAttribute{
 constructor(a,n){this.array=a;this.itemSize=n}
}
const THREE={Group:Node,Object3D:Node,Mesh,InstancedMesh,BoxGeometry,
 SphereGeometry,TorusGeometry,CircleGeometry,CylinderGeometry,ConeGeometry,
 PlaneGeometry,BufferGeometry,Float32BufferAttribute,
 MeshLambertMaterial:Mat,MeshBasicMaterial:Mat,
 MeshPhongMaterial:Mat,DoubleSide:2};
const DriverRoadGeometry={
 localPavementHeight:()=>0,
 segmentDrivable(city,x,z,a,b,r=1.45){
  const n=Math.max(1,Math.ceil(Math.hypot(x-a,z-b)/3));
  for(let i=0;i<=n;i++){
   const t=i/n,px=x+(a-x)*t,pz=z+(b-z)*t;
   if(city.isWaterAt(px,pz)||city.isPointBlocked(px,pz,r))return false;
  }
  return true;
 }
};
const context=vm.createContext({THREE,window:{},DriverRoadGeometry,
 DriverSpecialStructures:{pack:()=>[]}});
for(const filename of [
 'js/world/chicago-ps1-coastline.js',
 'js/world/chicago-gameplay.js',
 'js/world/chicago-neighborhoods.js',
 'js/world/chicago-pier-stadium-r53.js',
 'js/world/chicago-landmark-access-r55.js',
 'js/world/chicago-landmark-district-r57.js',
 'js/world/city-builder.js',
 'js/traffic/chicago-mixed-navigation-r49.js'
]){
 const src=fs.readFileSync(path.join(root,filename),'utf8');
 vm.runInContext(src,context,{filename});
}
const get=name=>vm.runInContext(name,context);
const Coast=get('DriverChicagoPS1Coastline');
const Gameplay=get('DriverChicagoGameplay');
const Neighborhood=get('DriverChicagoNeighborhoods');
const Pier=get('DriverChicagoPierStadiumR53');
const R55=get('DriverChicagoLandmarkAccessR55');
const R57=get('DriverChicagoLandmarkDistrictR57');
const Builder=get('CityBuilder');
const Network=get('DriverChicagoMixedNavigationR49');
function createWorld(){
 const c=Object.create(Builder.prototype);
 Object.assign(c,{preset:{id:'chicago'},cityGroup:new Node(),
  buildingBoxes:[],canalWallSegments:[],worldLimit:410,
  chicagoNightState:{level:0},interiorFloorAt:()=>false,
  getSidewalkHeightAt:()=>0,roadExtent:320,
  buildRegionalLandmarkDetails:()=>{}});
 c.isWaterAt=(x,z)=>Coast.waterAt(x,z);
 c.isPointBlocked=(x,z,r=0)=>c.buildingBoxes.some(b=>
  x+r>b.minX&&x-r<b.maxX&&z+r>b.minZ&&z-r<b.maxZ);
 Gameplay.buildStadium(c,-280,200);
 c.buildRegionalLandmark(280,-280);
 Neighborhood.build(c);
 R57.build(c);
 return c;
}
test('R57: three dry secondary roads and six real parking surfaces',()=>{
 const c=createWorld(),stats=R57.audit(c);
 assert.equal(stats.installed,true);
 assert.equal(stats.approaches.length,3);
 for(const a of stats.approaches)assert.equal(a.ok,true,a.id+' '+a.reason);
 assert.equal(stats.parking.length,6);
 for(const p of stats.parking)assert.equal(p.ok,true,p.id+' '+p.reason);
 assert.equal(stats.totalSpaces,24);
 assert.equal(stats.graphEdges,14);
 assert.equal(stats.shore.rails,14);
 assert.equal(stats.colliders,14);
 assert.ok(stats.shore.promenadeMeters>90);
 for(const l of R57.APPROACHES)
  assert.equal(R57.verifyApproach(c,l).ok,true,l.id);
 for(const park of R57.PARKING)
  assert.equal(R57.verifyLot(c,park),true,park.id);
});
test('R57: rail AABBs correspond to visible mesh and avoid old avenues',()=>{
 const c=createWorld(),s=c.chicagoLandmarkDistrictR57;
 assert.equal(s.colliders.length,14);
 const visible=[];
 for(const mesh of s.sections['navy-pier'].base.children)
  if(mesh.name?.startsWith('r57-lakefront-rail-'))visible.push(mesh);
 assert.equal(visible.length,14);
 for(const box of s.colliders){
  const mesh=visible.find(m=>m.name===box.chicagoR57);
  assert.ok(mesh,'missing visible rail for '+box.chicagoR57);
  const g=mesh.geometry.args;
  assert.equal(g[0],box.maxX-box.minX);
  assert.equal(g[2],box.maxZ-box.minZ);
 }
 for(const [x,z]of [[320,-80],[320,-40],[-280,240],[280,-240]])
  assert.equal(c.isPointBlocked(x,z,1.55),false,
   'unexpected phantom wall at '+x+','+z);
 assert.equal(Pier.audit(c).gatePreserved,true);
 assert.equal(R55.audit(c).routes.every(r=>r.open),true);
});
test('R57: secondary street nodes reach the navigation graph',()=>{
 const c=createWorld(),graph=Network.compile(c);
 assert.ok(graph.nodes.size>50);
 for(const route of R57.APPROACHES){
  const first=route.points[0],last=route.points.at(-1);
  const endKey=Network.key({x:last[0],z:last[1]});
  assert.ok(graph.nodes.has(endKey),route.id+' not in graph');
  assert.ok((graph.adj.get(endKey)||[]).length>0,
   route.id+' missing connected traversable edges');
  const path=Network.plan(c,{x:first[0],z:first[1]},
   {x:last[0],z:last[1]});
  assert.ok(path?.length>=2,route.id+' cannot route');
 }
});
test('R57: LOD lazy-build with hysteresis and no duplicate or collision change',()=>{
 const c=createWorld(),state=c.chicagoLandmarkDistrictR57;
 const count=c.buildingBoxes.length;
 assert.equal(R57.build(c),state);
 assert.equal(c.buildingBoxes.length,count);
 assert.equal(R57.audit(c).lod.every(l=>l.level==='far'&&!l.nearBuilt),true);
 R57.update(c,{x:344,z:-40},.2);
 assert.equal(state.sections['navy-pier'].level,'near');
 assert.equal(state.sections['navy-pier'].nearBuilt,true);
 const root=state.sections['navy-pier'].near;
 R57.update(c,{x:520,z:-40},.2);
 assert.equal(state.sections['navy-pier'].level,'near');
 R57.update(c,{x:600,z:-40},.2);
 assert.equal(state.sections['navy-pier'].level,'far');
 R57.update(c,{x:344,z:-40},.2);
 assert.equal(state.sections['navy-pier'].near,root);
 assert.equal(c.buildingBoxes.length,count);
});
test('R57: distant original pier/stadium detail batches are culled but solid silhouettes remain',()=>{
 const c=createWorld(),count=c.buildingBoxes.length;
 R57.update(c,{x:700,z:-40},.2);
 const extras=c._pierStadiumR53.lodExtras;
 assert.ok(extras.pier.meshes.length>0);
 assert.ok(extras.wrigley.meshes.length>0);
 assert.equal(extras.pier.visible,false);
 assert.equal(extras.wrigley.visible,false);
 assert.equal(extras.pier.meshes.every(m=>m.visible===false),true);
 const rail=c._pierStadiumR53.root.children.find(m=>
  m.name==='pier-side-guard--1');
 assert.ok(rail);
 assert.notEqual(rail.visible,false);
 assert.equal(c.buildingBoxes.length,count);
 R57.update(c,{x:379,z:-40},.2);
 assert.equal(extras.pier.visible,true);
 assert.equal(extras.pier.meshes.every(m=>m.visible===true),true);
 assert.equal(c.buildingBoxes.length,count);
});
test('R57: does not build foreign-city content or unsafe routes',()=>{
 const c=createWorld();
 assert.equal(R57.verifyLine(c,[320,-40],[500,-40],1.55).ok,false);
 assert.equal(R57.verifyLot(c,{x:370,z:-80,w:18,d:9}),false);
 c.preset={id:'havana'};
 assert.equal(R57.verifyApproach(c,R57.APPROACHES[0]).ok,false);
 assert.equal(R57.build(c),null);
});
