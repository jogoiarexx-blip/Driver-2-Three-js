'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const point=(x=0,y=0,z=0)=>({x,y,z,set(a,b,c){this.x=a;this.y=b;this.z=c}});
class Node {
 constructor(){this.children=[];this.parent=null;this.position=point();this.rotation=point();this.scale=point(1,1,1);this.matrix={};this.userData={}}
 add(...items){for(const item of items){item.parent=this;this.children.push(item)}}
 updateMatrix(){}
}
class Geometry{constructor(...p){this.args=p;this.type=this.constructor.name}}
class BoxGeometry extends Geometry{} class TorusGeometry extends Geometry{}
class SphereGeometry extends Geometry{} class CircleGeometry extends Geometry{}
class Material{constructor(o={}){Object.assign(this,o);this.color={getHex:()=>o.color}}}
class Mesh extends Node{constructor(g,m){super();this.isMesh=true;this.geometry=g;this.material=m}}
class InstancedMesh extends Mesh{constructor(g,m,n){super(g,m);this.count=n;this.instanceMatrix={needsUpdate:false}}setMatrixAt(){}}
class Neighborhood{
 static build(city){
  if(city.chicagoNeighborhoods?.root?.parent===city.cityGroup)return city.chicagoNeighborhoods;
  const root=new Node(),wheel=new Node();root.add(wheel);city.cityGroup.add(root);
  for(let i=0;i<10;i++){const a=i*Math.PI/5,c=new Mesh(new BoxGeometry(2,1.7,1.6),new Material());
   c.position.set(Math.cos(a)*10.2,Math.sin(a)*10.2,0);wheel.add(c)}
  city.chicagoNeighborhoods={root,pier:{wheel},stadium:{}};
  return city.chicagoNeighborhoods;
 }
 static label(){return new Node()}
}
class Gameplay{static update(){}}
const THREE={Group:Node,Object3D:Node,Mesh,InstancedMesh,BoxGeometry,TorusGeometry,SphereGeometry,CircleGeometry,
 MeshLambertMaterial:Material,MeshBasicMaterial:Material,DoubleSide:2};
const water=(x,z)=>x>350&&!(x>=326&&x<=412&&Math.abs(z+40)<=8.25);
const context=vm.createContext({THREE,window:{},DriverChicagoNeighborhoods:Neighborhood,
 DriverChicagoGameplay:Gameplay,DriverChicagoPS1Coastline:{waterAt:water}});
const load=f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
load('js/world/chicago-pier-stadium-r53.js');load('js/world/city-builder.js');
const R54=vm.runInContext('DriverChicagoPierStadiumR53',context);
const Builder=vm.runInContext('CityBuilder',context);
function mockCity(){
 const c={preset:{id:'chicago'},cityGroup:new Node(),buildingBoxes:[],
  chicagoStadium:{x:-280,z:200,gate:{}},chicagoSoldierField:{x:280,z:-280},
  chicagoNightState:{level:0},_spatialCollisions:{boxes:[]}};
 Neighborhood.build(c);
 c.isPointBlocked=(x,z,r=0)=>c.buildingBoxes.some(b=>
  x+r>b.minX&&x-r<b.maxX&&z+r>b.minZ&&z-r<b.maxZ);
 return c;
}
function groundCity(id='chicago'){
 const c=Object.create(Builder.prototype);
 c.preset={id};c.interiors=[];c.bridgeAngle=0;
 c.getSidewalkHeightAt=()=>0;c.isWaterAt=water;return c;
}
test('physical ramp follows deck with no jump, other city unchanged',()=>{
 const city=groundCity();
 for(const [x,z,h] of [[320,-40,0],[323.5,-40,.27],[327,-40,.54],[379,-40,.54],
  [400,-40,.54],[379,-20,-4]]){
  assert.ok(Math.abs(city.getGroundHeightAt(x,z,0,true)-h)<1e-8,'ground at '+x+','+z);
 }
 assert.equal(groundCity('havana').getGroundHeightAt(379,-40,0,true),0);
});
test('guardrails, wheel bases and portal posts physically block, not mid deck',()=>{
 const c=mockCity();
 for(const [x,z] of [[333,-46.95],[356,-47.05],[373.8,-41],[-264.425,200]])
  assert.equal(c.isPointBlocked(x,z),true,'expected obstacle at '+x+','+z);
 for(const [x,z] of [[340,-40],[379,-40],[-280,200]])
  assert.equal(c.isPointBlocked(x,z),false,'unexpected obstacle '+x+','+z);
});
test('sweep prevents high speed wall tunneling and avoids other cities',()=>{
 const c=mockCity();
 assert.equal(c.isPointBlocked(356,-50,1.55),false);
 assert.equal(c.isPointBlocked(356,-44,1.55),false);
 assert.equal(R54.needsSweep(c,356,-50,356,-44),true);
 assert.equal(R54.pathBlocked(c,356,-50,356,-44,1.55,0),true);
 assert.equal(R54.pathBlocked(c,340,-40,348,-40,1.55,0),false);
 assert.equal(R54.needsSweep({preset:{id:'havana'}},356,-50,356,-44),false);
});
test('night wheel, cabin leveling, landmarks and no duplicate build',()=>{
 const c=mockCity(),a=R54.audit(c);
 assert.equal(a.bulbs,48);assert.equal(a.seats,84);
 assert.equal(a.visibleColliderCount,13);assert.equal(a.gatePreserved,true);
 assert.equal(a.pierDry,true);assert.equal(a.platformHeight,.54);
 assert.equal(a.entranceClear,true);
 const old=c._pierStadiumR53.wheel.rotation.z;
 c.chicagoNightState.level=.9;Gameplay.update(c,1/60);
 const wheel=c._pierStadiumR53.wheel;
 assert.ok(wheel.rotation.z>old);
 assert.ok(c._pierStadiumR53.night[0].opacity>.6);
 for(const cabin of c._pierStadiumR53.cabins)
  assert.ok(Math.abs(cabin.rotation.z+wheel.rotation.z)<1e-6);
 const n=c.buildingBoxes.length;Neighborhood.build(c);
 assert.equal(c.buildingBoxes.length,n);
});
test('production car source uses swept collision for all three axes',()=>{
 const code=fs.readFileSync(path.join(root,'js/vehicles/driver-vehicle.js'),'utf8');
 new vm.Script(code);
 assert.ok(code.includes('DriverChicagoPierStadiumR53.pathBlocked('));
 assert.ok(code.includes('wallBlocked(nextX,nextZ)'));
 assert.ok(code.includes('wallBlocked(nextX,this.z)'));
 assert.ok(code.includes('wallBlocked(this.x,nextZ)'));
});
