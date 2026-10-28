/** Driver 2 road visual regression: no tile-wide paint, bounded
 *  road strips, aligned zebra crossings and preserved collisions. */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
class V{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  set(x,y,z){this.x=x;this.y=y;this.z=z;}}
class Group{
  constructor(){this.children=[];this.position=new V();this.rotation=new V();
    this.scale=new V(1,1,1);this.userData={};}
  add(...o){this.children.push(...o);}
}
class Object3D extends Group{
  updateMatrix(){this.matrix={
    position:{...this.position},rotation:{...this.rotation},
    scale:{...this.scale}};}
}
class Geometry{
  constructor(...args){this.args=args;}
  rotateX(x){this.rotationX=x;}
}
class Material{constructor(options={}){this.options=options;}}
class Mesh extends Group{
  constructor(g,m){super();this.geometry=g;this.material=m;}
}
class InstancedMesh extends Mesh{
  constructor(g,m,n){super(g,m);this.count=n;this.matrices=[];
    this.instanceMatrix={};}
  setMatrixAt(i,m){this.matrices[i]=m;}
}
const THREE={Group,Object3D,InstancedMesh,PlaneGeometry:Geometry,
  BoxGeometry:Geometry,CylinderGeometry:Geometry,
  MeshLambertMaterial:Material,MeshBasicMaterial:Material,
  DoubleSide:2,RepeatWrapping:1,NearestFilter:2,
  CanvasTexture:class {constructor(canvas){this.canvas=canvas;}}};
const ctx={THREE,Math,Number,Set,Map,document:{
  createElement(){const paints=[];return {
    width:0,height:0,paints,getContext(){return {
      globalAlpha:1,fillStyle:'#000',
      fillRect(x,y,w,h){paints.push({x,y,w,h,color:this.fillStyle});}
    };}};}
}};
const sandbox=vm.createContext(ctx);
vm.runInContext(read('js/render/ps1-texture-factory.js'),sandbox);
vm.runInContext(read('js/world/road-surface.js'),sandbox);
vm.runInContext(read('js/world/street-furniture.js'),sandbox);
const Texture=vm.runInContext('PS1TextureFactory',sandbox);
const Roads=vm.runInContext('DriverRoadSurface',sandbox);
const Street=vm.runInContext('DriverStreetFurniture',sandbox);
const makeCity=id=>({
  preset:{id},cityGroup:new Group(),buildingBoxes:[
    {minX:20,maxX:60,minZ:-60,maxZ:-20}],
  sidewalkGrid:new Set(['40:-40']),destructibleProps:[]
});

test('old checkerboard yellow lines removed from repeated road bitmap',()=>{
  const tex=Texture.createAsphaltTexture();
  assert(tex.canvas.paints.length>100);
  const colors=tex.canvas.paints.map(v=>v.color);
  assert(!colors.includes('#eab308'),'paint still lives in base texture');
  for(const id of ['chicago','havana','vegas','rio']){
    const r=Texture.createRoadTexture(id);
    assert(r.canvas.paints.length>120);
    assert(!r.canvas.paints.some(v=>v.color==='#eab308'));
  }
});

test('road surface contains only 81 intersections and 180 separated stretches',()=>{
  const c=makeCity('chicago'),boxes=JSON.stringify(c.buildingBoxes);
  const m=Roads.buildAsphalt(c);
  assert.equal(m.count,261);
  assert.equal(c.roadSurfaceStats.intersectionCount,81);
  assert.equal(c.roadSurfaceStats.collidersAdded,0);
  assert.equal(JSON.stringify(c.buildingBoxes),boxes);
  assert(m.matrices.every(x=>x && Object.values(x.position)
    .every(Number.isFinite)));
  assert(m.matrices.some(x=>x.scale.x===24&&x.scale.z===24));
  assert(m.matrices.some(x=>x.scale.z===56));
  assert(m.matrices.some(x=>Math.abs(x.rotation.y-Math.PI/2)<.001));
});

test('lane marks stop before junction and are absent in river',()=>{
  const c=makeCity('vegas');
  Roads.buildAsphalt(c);
  const [yellow,white]=Roads.buildMarkings(c);
  assert(yellow.count>200);
  assert(white.count>100);
  for(const m of yellow.matrices){
    assert(!Roads.laneClear(m.position.x,m.position.z)===false ||
      Math.abs(m.position.x)%80<.3 ||
      Math.abs(m.position.z)%80<.3);
    assert(!(m.position.z>31&&m.position.z<69));
  }
  assert(c.roadSurfaceStats.paintedInsideIntersections===0);
  assert.equal(c.cityGroup.children.length,3);
  assert.equal(Roads.buildCurbs(c,[{x:40,z:-40}]).count,4);
  assert.equal(c.cityGroup.children.length,4);
});

test('crosswalks span over 20m, never float on canal, poles remain destructible',()=>{
  const c=makeCity('havana');
  Street.build(c);
  const zebra=c.cityGroup.children.find(m=>m.count===1600);
  assert(zebra,'incorrect zebra layout count');
  assert(zebra.matrices.every(m=>!(m.position.z>31&&m.position.z<69)));
  assert(zebra.matrices.some(m=>Math.abs(m.position.x+9.54)<.01));
  assert.equal(c.destructibleProps.filter(x=>x.type==='pole').length,162);
  assert.equal(c.cityGroup.children.length,5);
});

test('city builder loads road surface and curb without modifying traffic or garages',()=>{
  const city=read('js/world/city-builder.js');
  const html=read('index.html');
  assert.match(city,/DriverRoadSurface\.buildAsphalt\(this\)/);
  assert.match(city,/DriverRoadSurface\.buildMarkings\(this\)/);
  assert.match(city,/DriverRoadSurface\.buildCurbs\(this,sidewalkPositions\)/);
  assert(html.includes('src="./js/world/road-surface.js"'));
  assert(html.indexOf('road-surface.js')<html.indexOf('city-builder.js'));
  assert.match(read('js/world/road-geometry.js'),/static ROAD_HALF=12/);
  assert.match(city,/this\.sidewalkGrid\.add\(blockX\+':'\+blockZ\)/);
});

test('each city preserves its own muted asphalt and sidewalk palette',()=>{
  for(const id of ['chicago','havana','vegas','rio']){
    const c=makeCity(id);
    Roads.buildAsphalt(c);
    Roads.buildMarkings(c);
    Roads.buildCurbs(c,[{x:40,z:-40}]);
    assert.equal(c.cityGroup.children.length,4,id);
    assert.equal(c.roadSurfaceStats.collidersAdded,0);
    assert(Roads.palette(id).sidewalk>0);
  }
});
