'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const Junctions=require('../js/world/chicago-goose-island-junctions.js');
const River=require('../js/world/chicago-ps1-river-branches.js');
const North=require('../js/world/chicago-goose-island-north-yard.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
class Group{constructor(){this.children=[];this.userData={};}
    add(obj){this.children.push(obj);}}
class Geometry{constructor(){this.attributes={};}setAttribute(k,v){this.attributes[k]=v;}
    computeVertexNormals(){this.normals=true;}}
class Attr{constructor(array,size){this.array=array;this.size=size;}}
class Mesh{constructor(geom,mat){this.geometry=geom;this.material=mat;
    this.userData={};this.position={set(x,y,z){this.x=x;this.y=y;this.z=z;}};}
class Material{constructor(cfg){this.config=cfg;}}
const THREE={Group,BufferGeometry:Geometry,Float32BufferAttribute:Attr,
    Mesh,BoxGeometry:Geometry,MeshLambertMaterial:Material,
    MeshBasicMaterial:Material,DoubleSide:2};
function fixture(id='chicago'){
 return {preset:{id},cityGroup:new Group(),
    buildingBoxes:[{minX:10,maxX:20,minZ:10,maxZ:20}],
    missionStart:{type:'story_tipoff',x:-64,z:-144},
    isWaterAt(x,z){return id==='chicago'&&
        !North.isBridgeDeck(x,z)&&River.waterAt(x,z);}};
}
test('as três curvas R7 permanecem integralmente em chão seco',()=>{
 const c=fixture();
 for(const center of Junctions.CENTERS){
  assert.equal(Junctions.dryPatch(c,center.x,center.z),true,
    center.id+' cruzamento sobre água');
  const pts=Junctions.perimeter(center.x,center.z);
  assert.equal(pts.length,20);
  for(const p of pts){
    assert(!c.isWaterAt(p.x,p.z));
    assert(Math.abs(p.x-center.x)<=Junctions.HALF+.00001);
    assert(Math.abs(p.z-center.z)<=Junctions.HALF+.00001);
  }
 }
});
test('R7 adiciona asfalto e sinalização sem colisores, água nem missão alterados',()=>{
 const previous=global.THREE;global.THREE=THREE;
 try{
  const c=fixture(),baseline=JSON.stringify({
    boxes:c.buildingBoxes,mission:c.missionStart
  });
  const result=Junctions.build(c);
  assert.equal(result.ready,true);
  assert.equal(result.junctionCount,3);
  assert.equal(result.collidersAdded,0);
  assert.equal(result.roadCoordinatesCertified,false);
  assert.equal(result.visualOnly,true);
  assert.equal(c.cityGroup.children.length,1);
  assert.equal(result.group.children.filter(x=>x.userData?.chicagoOffGridJunction).length,3);
  for(const patch of result.patches){
    assert.equal(patch.borderVertices,20);
    assert.equal(patch.road.geometry.attributes.position.array.length,180);
    assert(patch.markings>=2);
  }
  assert.equal(JSON.stringify({boxes:c.buildingBoxes,mission:c.missionStart}),baseline);
  assert.equal(Junctions.build(c),result,'sem criar entroncamentos duplicados');
  const other=fixture('havana');
  assert.equal(Junctions.build(other),null);
  assert.equal(other.cityGroup.children.length,0);
 }finally{global.THREE=previous;}
});
test('se uma curva ficar inundada, não publicar uma interseção parcial',()=>{
 const previous=global.THREE;global.THREE=THREE;
 try{
  const c=fixture();
  const water=c.isWaterAt.bind(c);
  c.isWaterAt=(x,z)=>water(x,z)||
    (Math.abs(x+200)<14&&Math.abs(z-240)<14);
  const r=Junctions.build(c);
  assert.equal(r.ready,false);
  assert.deepEqual(r.missing,['industrial']);
  assert.equal(c.cityGroup.children.length,0);
 }finally{global.THREE=previous;}
});
test('integração R7 exclusivamente após ruas R4 e ponte R6',()=>{
 const code=read('js/world/city-builder.js');
 const html=read('index.html');
 assert(code.includes('DriverChicagoGooseIslandJunctions.build(this)'));
 assert(code.indexOf('DriverChicagoGooseIslandNorthYard.build(this)')<
        code.indexOf('DriverChicagoGooseIslandJunctions.build(this)'));
 assert(html.indexOf('chicago-goose-island-north-yard.js')<
        html.indexOf('chicago-goose-island-junctions.js'));
 assert(html.indexOf('chicago-goose-island-junctions.js')<
        html.indexOf('city-builder.js'));
});
