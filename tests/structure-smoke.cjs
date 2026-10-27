/** Testes determinísticos das estruturas, portas, portões e interiores. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Vec {
  constructor(){this.x=this.y=this.z=0;}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
  clone(){const x=new Vec();return x.set(this.x,this.y,this.z);}
}
class Group {
  constructor(){this.children=[];this.position=new Vec();this.rotation=new Vec();
    this.scale=new Vec();this.userData={};this.visible=true;}
  add(...objects){this.children.push(...objects)}
}
class Mesh extends Group {
  constructor(geometry,material){super();this.geometry=geometry;this.material=material;}
  clone(){const mesh=new Mesh(this.geometry,this.material);
    mesh.position=this.position.clone();return mesh;}
}
class InstancedMesh extends Mesh {
  constructor(g,m,count){super(g,m);this.count=count;this.matrices=[];
    this.colors=[];this.instanceMatrix={};this.instanceColor={};}
  setMatrixAt(i,m){this.matrices[i]=m;}
  setColorAt(i,c){this.colors[i]=c;}
}
class Object3D extends Group {
  updateMatrix(){this.matrix={position:{...this.position},scale:{...this.scale}};}
}
class Material {constructor(args={}){this.color={
  value:args.color,setHex(v){this.value=v;}};}}
class Geometry {rotateX(){}}
class Vector3 {constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
class Sphere {constructor(center,radius){this.center=center;this.radius=radius;}}
const THREE={Group,Mesh,InstancedMesh,Object3D,
  BoxGeometry:Geometry,PlaneGeometry:Geometry,CylinderGeometry:Geometry,
  ConeGeometry:Geometry,MeshLambertMaterial:Material,
  MeshBasicMaterial:Material,DoubleSide:2,
  Color:class {constructor(hex){this.hex=hex}},Vector3,Sphere};
const ctx={THREE,DriverChicagoTrain:{PLATFORM:{height:11.3,x:-14,z:-250,
  minX:-20,maxX:-8,minZ:-260,maxZ:-230}},CITY_PRESETS:{}};
vm.createContext(ctx);
for(const file of ['js/world/special-structures.js','js/world/city-builder.js'])
  vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
const Structures=vm.runInContext('DriverSpecialStructures',ctx);
const Builder=vm.runInContext('CityBuilder',ctx);
const cases=[];
for(const id of ['chicago','havana','vegas','rio']){
  const city=Object.create(Builder.prototype);
  Object.assign(city,{preset:{id},cityGroup:new Group(),buildingBoxes:[],
    interiors:[],bridgeSouthLeaf:new Group(),bridgeNorthLeaf:new Group(),
    secretGateOpen:false,secretGateBoxIndex:-1});
  Structures.bridge(city);
  city.buildSecretGarageCompound(120,120);
  city.buildSafeHouseBlock(-120,-120);
  city.buildEnterableWarehouse(200,-200);
  city.buildEnterableStore(-200,-200,'diner');
  city.buildEnterableStore(120,-280,'garage');
  city.buildInteriorRooms();
  if(id==='chicago')city.buildCaineCompoundDetails();
  assert.equal(city.interiors.length,4,id+' interiors');
  for(const place of city.interiors){
    assert.equal(city.interiorAt(place.door.x,place.door.z).id,place.id);
    assert.equal(city.interiorArea(place.inside.x,place.inside.z),true);
    assert(place.exit&&Number.isFinite(place.exit.z));
  }
  assert(city.secretGateMesh.children.some(m=>m.name.startsWith('secret-moving-gate')));
  assert.notEqual(city.buildingBoxes[city.secretGateBoxIndex].minX,9999);
  const boxes=city.buildingBoxes.length;
  assert.equal(city.unlockSecretGate(),true);
  assert.equal(city.buildingBoxes[city.secretGateBoxIndex].minX,9999);
  assert.equal(city.buildingBoxes.length,boxes);
  let instances=0,drawCalls=0;
  for(const mesh of city.cityGroup.children){
    if(!(mesh instanceof InstancedMesh))continue;
    drawCalls++;
    assert.equal(mesh.frustumCulled,true,'Culling desabilitado em '+mesh.name);
    assert(mesh.geometry.boundingSphere&&mesh.geometry.boundingSphere.radius>0);
    assert.equal(mesh.matrices.length,mesh.count);
    assert.equal(mesh.colors.length,mesh.count);
    for(const m of mesh.matrices){
      assert(m&&Object.values(m.position).every(Number.isFinite));
      assert(Object.values(m.scale).every(v=>Number.isFinite(v)&&v>0));
    }
    instances+=mesh.count;
  }
  cases.push({city:id,drawCalls,instances,interiors:city.interiors.length,
    gateChildren:city.secretGateMesh.children.length});
}
console.log(JSON.stringify({pass:true,cases},null,2));
