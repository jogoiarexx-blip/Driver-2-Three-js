'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/render/chicago-wet-asphalt.js'),'utf8');
class Obj {
 constructor(){
  this.position={set:(...args)=>{this.p=args;}};
  this.rotation={set:(...args)=>{this.r=args;}};
  this.scale={set:(...args)=>{this.s=args;}};
 }
 updateMatrix(){this.matrix={p:this.p.slice(),r:this.r.slice(),s:this.s.slice()};}
}
class Geometry {
 constructor(w,h){this.width=w;this.height=h;}
 rotateX(a){this.rotX=a;}
}
class Color{
 constructor(hex=0){this.hex=hex;this.rgb=null;}
 setRGB(r,g,b){this.rgb=[r,g,b];}
 setHex(hex){this.hex=hex;}
}
class Material {
 constructor(props){Object.assign(this,props);this.color=new Color(props.color);}
}
class InstancedMesh {
 constructor(geometry,material,count){
  this.geometry=geometry;this.material=material;this.count=count;
  this.matrices=[];this.instanceMatrix={};this.userData={};
 }
 setMatrixAt(i,m){this.matrices[i]=JSON.parse(JSON.stringify(m));}
}
const THREE={PlaneGeometry:Geometry,MeshBasicMaterial:Material,
 InstancedMesh,Object3D:Obj,CanvasTexture:class {constructor(canvas){this.image=canvas;}},
 DoubleSide:1,LinearFilter:2,LinearMipmapLinearFilter:3};
const canvases=[];
const document={createElement(type){
 assert.equal(type,'canvas');
 const canvas={
  width:0,height:0,operations:[],
  getContext(){
   const ops=canvas.operations;
   const ctx={save(){},restore(){},translate(){},scale(){},fillRect(...p){ops.push(p);},
    createRadialGradient(){
     return {stops:[],addColorStop(n,color){this.stops.push([n,color]);}};
    }};
   return ctx;
  }
 };
 canvases.push(canvas);return canvas;
}};
const R5=vm.runInNewContext(source+'\nDriverChicagoWetAsphalt',{THREE,document,Math,Number});
function make(cityId='chicago'){
 const objects=[],asphalt={material:{color:new Color(0xffffff)}};
 const city={
  preset:{id:cityId},cityGroup:{children:objects,add(o){objects.push(o);}},
  ready:true,buildingBoxes:[{id:1}],streetLampPositions:[[16,16]],
  destructibleProps:[{type:'pole',x:16,z:16}],
  isWaterAt(x,z){return x<0;},
  isOnSidewalk(x,z){return z>200;},
  getGroundHeightAt(){return 0;}
 };
 const game={
  city,dayNight:{rain:false,time:.95},effects:{rainEnabled:false},
  getPlayerPosition(){return {x:24,z:0};}
 };
 return {game,city,asphalt};
}
function tick(game,n=60,dt=.05){
 let ret;for(let i=0;i<n;i++)ret=R5.update(game,dt);return ret;
}
test('one instanced batch only in Chicago, texture created once',()=>{
 const {city,asphalt}=make();
 const state=R5.install(city,asphalt);
 assert(state&&state.mesh);
 assert.equal(R5.install(city,asphalt),state);
 assert.equal(city.cityGroup.children.length,1);
 assert.equal(state.mesh.count,48);
 assert.equal(state.mesh.castShadow,false);
 assert.equal(state.mesh.receiveShadow,false);
 assert.equal(state.mesh.userData.visualOnly,true);
 assert.equal(canvases.at(-1).width,128);
 assert.equal(canvases.at(-1).height,128);
 assert.equal(R5.install(make('vegas').city,asphalt),null);
});
test('rain darkens road gradually; dry recovers without changing textures',()=>{
 const {game,city,asphalt}=make();
 const state=R5.install(city,asphalt);
 tick(game,12);
 assert.equal(state.wet,0);
 assert.equal(state.mesh.visible,false);
 game.dayNight.rain=true;game.effects.rainEnabled=true;
 const first=R5.update(game,.05);
 assert(first.wet>0&&first.wet<1,'no abrupt jump to full rain');
 const full=tick(game,120);
 assert(full.wet>.90);
 assert(full.patches>0);
 assert(state.mesh.visible);
 assert(asphalt.material.color.rgb[0]<.75);
 assert(state.material.opacity>0&&state.material.opacity<=.35);
 game.dayNight.rain=false;game.effects.rainEnabled=false;
 const end=tick(game,300);
 assert(end.wet<.01);
 assert(state.mesh.visible===false);
 assert(asphalt.material.color.rgb[0]>.99);
});
test('patches never appear on canals, sidewalks or elevated terrain',()=>{
 const {game,city,asphalt}=make();
 const state=R5.install(city,asphalt);
 city.getGroundHeightAt=()=>7;
 game.dayNight.rain=true;tick(game);
 assert.equal(state.puddles,0);
 city.getGroundHeightAt=()=>0;
 state.lastX=Infinity;
 tick(game,1);
 assert(state.puddles>0);
 for(let i=0;i<state.puddles;i++){
  const {p}=state.mesh.matrices[i];
  assert(p[0]>=0,'not on river/water');
  assert(p[1]<.20,'not suspended in air');
  assert(p[2]<=200,'not on sidewalk');
 }
});
test('moving player triggers rebuild but standing still does not',()=>{
 const {game,city,asphalt}=make(),state=R5.install(city,asphalt);
 game.dayNight.rain=true;
 tick(game,60);
 const count=state.rebuilds;
 tick(game,60);
 assert.equal(state.rebuilds,count);
 game.getPlayerPosition=()=>({x:75,z:0});
 tick(game,1);
 assert.equal(state.rebuilds,count+1);
 assert(state.puddles<=R5.MAX_PATCHES);
});
test('patch placement deterministic, MAX bound and unused slots hidden',()=>{
 const makeState=()=>{
  const {game,city,asphalt}=make();
  R5.install(city,asphalt);
  game.dayNight.rain=true;tick(game);
  return city.chicagoWetAsphalt;
 };
 const a=makeState(),b=makeState();
 assert.equal(a.puddles,b.puddles);
 assert(a.puddles>0&&a.puddles<=48);
 const first=a.mesh.matrices.map(m=>m.p.join('|'));
 const second=b.mesh.matrices.map(m=>m.p.join('|'));
 assert.deepEqual(first,second);
 for(let i=a.puddles;i<48;i++)
  assert.equal(a.mesh.matrices[i].p[1],-1000);
});
test('night reflects warmer than daytime, no local lights created',()=>{
 const {game,city,asphalt}=make();
 R5.install(city,asphalt);
 game.dayNight.rain=true;
 tick(game,100);
 assert.equal(city.chicagoWetAsphalt.material.color.hex,0xb2ad9d);
 const nightOpacity=city.chicagoWetAsphalt.material.opacity;
 game.dayNight.time=.50;
 tick(game,10);
 assert.equal(city.chicagoWetAsphalt.material.color.hex,0xa0b8c6);
 assert(city.chicagoWetAsphalt.material.opacity<nightOpacity);
 assert(!city.cityGroup.children.some(o=>o.isLight));
});
test('other cities not touched; partial load safely pauses reflections',()=>{
 const {game,city,asphalt}=make();
 const state=R5.install(city,asphalt);
 game.dayNight.rain=true;tick(game,30);
 const before=state.wet;
 city.ready=false;
 tick(game,1);
 assert.equal(state.mesh.visible,false);
 assert(state.wet>=before);
 city.preset.id='havana';
 const val=R5.update(game,.05);
 assert.equal(val.wet,0);
 assert.equal(val.patches,0);
 assert.equal(city.chicagoWetAsphalt.roadMesh,asphalt);
});
test('R5 integration leaves road marking positions / traffic untouched',()=>{
 const read=name=>fs.readFileSync(path.join(root,name),'utf8');
 const road=read('js/world/road-surface.js'),game=read('js/engine/driver2-game-engine.js');
 const city=read('js/world/city-builder.js'),html=read('index.html');
 assert(road.includes('DriverChicagoWetAsphalt.install(city,mesh)'));
 assert(game.includes('DriverChicagoWetAsphalt.update(this,dt)'));
 assert(game.includes('DriverChicagoWetAsphalt.update(this,0)'));
 assert(game.indexOf('this.dayNight.update(dt)')<
        game.indexOf('DriverChicagoWetAsphalt.update(this,dt)'));
 assert(city.includes('this.chicagoWetAsphalt=null'));
 assert(html.includes('chicago-wet-asphalt.js?v=chicago-wet-r5'));
 assert(html.indexOf('chicago-wet-asphalt.js')<html.indexOf('road-surface.js'));
 assert(road.includes('paintedInsideIntersections:0,collidersAdded:0'));
 assert(road.includes('const geometry=new THREE.PlaneGeometry(1,1)'));
});
