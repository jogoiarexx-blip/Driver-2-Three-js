'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

const xyz=(x=0,y=0,z=0)=>({x,y,z,set(a,b,c){this.x=a;this.y=b;this.z=c}});
class Node{
    constructor(){
        this.children=[];this.parent=null;this.position=xyz();this.rotation=xyz();
        this.scale=xyz(1,1,1);this.matrix={};this.userData={};
    }
    add(...children){for(const c of children){c.parent=this;this.children.push(c)}}
    updateMatrix(){}
}
class Geometry{
    constructor(...args){this.args=args;this.type=this.constructor.name;this.attributes={}}
    rotateX(){return this}
    rotateZ(){return this}
    setAttribute(key,value){this.attributes[key]=value}
    computeVertexNormals(){}
}
class Material{
    constructor(p={}){Object.assign(this,p);this.color={getHex:()=>p.color}}
}
class Mesh extends Node{
    constructor(geometry,material){super();this.isMesh=true;
        this.geometry=geometry;this.material=material}
}
class InstancedMesh extends Mesh{
    constructor(geo,mat,count){
        super(geo,mat);this.count=count;this.instanceMatrix={needsUpdate:false};
    }
    setMatrixAt(){}
}
class BoxGeometry extends Geometry {}
class CylinderGeometry extends Geometry {}
class TorusGeometry extends Geometry {}
class SphereGeometry extends Geometry {}
class CircleGeometry extends Geometry {}
class PlaneGeometry extends Geometry {}
class BufferGeometry extends Geometry {}
class Float32BufferAttribute{
    constructor(array,itemSize){this.array=array;this.itemSize=itemSize}
}
const THREE={
    Group:Node,Object3D:Node,Mesh,InstancedMesh,
    BoxGeometry,CylinderGeometry,TorusGeometry,SphereGeometry,CircleGeometry,
    PlaneGeometry,BufferGeometry,Float32BufferAttribute,
    MeshLambertMaterial:Material,MeshBasicMaterial:Material,
    MeshPhongMaterial:Material,DoubleSide:2,
    MathUtils:{damp:(a,b,lambda,dt)=>b+(a-b)*Math.exp(-lambda*dt)}
};
const context=vm.createContext({
    THREE,window:{},DriverSpecialStructures:{pack:()=>[]}
});
const load=file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),
    context,{filename:file});
load('js/world/chicago-ps1-coastline.js');
load('js/world/chicago-gameplay.js');
load('js/world/chicago-neighborhoods.js');
load('js/world/chicago-pier-stadium-r53.js');
load('js/world/chicago-landmark-access-r55.js');
load('js/world/city-builder.js');
const read=expr=>vm.runInContext(expr,context);
const Coast=read('DriverChicagoPS1Coastline');
const Gameplay=read('DriverChicagoGameplay');
const Nhood=read('DriverChicagoNeighborhoods');
const Pier=read('DriverChicagoPierStadiumR53');
const Access=read('DriverChicagoLandmarkAccessR55');
const Builder=read('CityBuilder');

function createWorld(){
    const c=Object.create(Builder.prototype);
    Object.assign(c,{
        preset:{id:'chicago'},cityGroup:new THREE.Group(),
        buildingBoxes:[],canalWallSegments:[],worldLimit:410,
        chicagoNightState:{level:0},buildRegionalLandmarkDetails:()=>{},
        interiorFloorAt:()=>false,getSidewalkHeightAt:()=>.35
    });
    c.isWaterAt=(x,z)=>Coast.waterAt(x,z);
    c.isPointBlocked=(x,z,radius=0)=>c.buildingBoxes.some(b=>
        x+radius>b.minX&&x-radius<b.maxX&&
        z+radius>b.minZ&&z-radius<b.maxZ);
    Gameplay.buildStadium(c,-280,200);
    c.buildRegionalLandmark(280,-280);
    Nhood.build(c);
    return c;
}
function normalY(mesh){
    const v=mesh.geometry.attributes.position.array;
    const ax=v[3]-v[0],az=v[5]-v[2],
        bx=v[6]-v[0],bz=v[8]-v[2];
    return az*bx-ax*bz;
}
test('R55: all three access corridors are dry and clear, with one road each',()=>{
    const c=createWorld(),a=Access.audit(c);
    assert.equal(a.installed,true);
    assert.equal(a.routes.length,3);
    for(const route of a.routes){
        assert.equal(route.open,true,route.id+': '+route.reason);
        assert.equal(route.sign,true,route.id);
        assert.equal(route.markings,15,route.id);
        const road=c.chicagoAccessR55.root.children.find(m=>
            m.name==='r55-access-surface-'+route.id);
        assert.ok(road,route.id);
        assert.ok(normalY(road)>0,'road should face sunlight: '+route.id);
    }
    for(const w of a.waterChecks)
        assert.equal(w.startDry&&w.endDry,true,w.id);
});
test('R55: grass contact matches meshes, outside city unaffected',()=>{
    const c=createWorld();
    assert.equal(c.getGroundHeightAt(-280,200,0,true),.08);
    assert.equal(c.getGroundHeightAt(280,-280,0,true),.55);
    assert.equal(c.getGroundHeightAt(379,-40,0,true),.54);
    assert.equal(c.getGroundHeightAt(323.5,-40,0,true),.27);
    c.preset={id:'havana'};
    assert.equal(Access.stadiumGroundAt(c,-280,200),null);
});
test('R55: Wrigley gate retains interaction and stadium clear inside',()=>{
    const c=createWorld();
    assert.equal(c.isPointBlocked(-280,219,1.5),true);
    assert.equal(c.isPointBlocked(-280,200,1.5),false);
    assert.equal(c.isPointBlocked(280,-280,1.5),false);
    assert.equal(Gameplay.interact(c,{x:-250,z:223}),true);
    assert.equal(c.chicagoStadium.open,true);
    assert.equal(c.isPointBlocked(-280,219,1.5),false);
});
test('R55: street signs have thin physical posts, but do not close routes',()=>{
    const c=createWorld();
    const signs=c.buildingBoxes.filter(b=>b.chicagoR55Sign);
    assert.equal(signs.length,3);
    for(const sign of signs){
        assert.ok(Math.abs(sign.maxX-sign.minX-.26)<1e-8);
        assert.ok(Math.abs(sign.maxZ-sign.minZ-.26)<1e-8);
    }
    for(const route of Access.ROUTES)
        assert.equal(Access.sampleRoute(c,route).open,true,route.id);
});
test('R55: reuse one city layer, update nocturnal trim, retain R54 wheel',()=>{
    const c=createWorld(),count=c.buildingBoxes.length;
    Nhood.build(c);
    assert.equal(c.buildingBoxes.length,count);
    assert.equal(c.chicagoAccessR55.lights.length,3);
    c.chicagoNightState.level=1;
    Access.update(c);
    for(const mat of c.chicagoAccessR55.lights)
        assert.equal(mat.opacity,.78);
    const wheel=Pier.audit(c);
    assert.equal(wheel.visibleColliderCount,13);
    assert.equal(wheel.bulbs,48);
    assert.equal(wheel.gatePreserved,true);
});
