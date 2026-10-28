// Teste de regressão do Lower Wacker: node tests/chicago-lower-wacker.smoke.cjs
// Não exige npm, WebGL nem navegador. Testa geometria lógica e colisores.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const position=()=>({set(x,y,z){this.x=x;this.y=y;this.z=z;}});
class Mesh{
  constructor(geometry,material){
    this.geometry=geometry;this.material=material;this.position=position();
  }
}
class Instance extends Mesh{
  constructor(geometry,material,count){
    super(geometry,material);this.count=count;
    this.instanceMatrix={needsUpdate:false};
  }
  setMatrixAt(){}
}
class Matrix{
  makeTranslation(x,y,z){return {x,y,z};}
}
class Material{constructor(options){this.options=options;}}
class Texture{
  constructor(canvas){
    this.canvas=canvas;
    this.repeat={set(x,y){this.x=x;this.y=y;}};
  }
}
const THREE={
  Group:class{constructor(){this.children=[];}add(m){this.children.push(m);}},
  Mesh,InstancedMesh:Instance,Matrix4:Matrix,
  BoxGeometry:class{constructor(...dimensions){this.dimensions=dimensions;}},
  MeshLambertMaterial:Material,MeshBasicMaterial:Material,
  CanvasTexture:Texture,RepeatWrapping:1,NearestFilter:2,
  LinearMipmapLinearFilter:3,DoubleSide:2
};
const document={createElement:()=>({
  getContext:()=>({fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}})
})};
const filepath=path.join(__dirname,'../js/world/chicago-lower-wacker.js');
const context={THREE,document};
vm.createContext(context);
vm.runInContext(fs.readFileSync(filepath,'utf8')+
  '\nthis.LowerWacker=DriverChicagoLowerWacker;',context,{filename:filepath});
const Tunnel=context.LowerWacker;
const city={preset:{id:'chicago'},cityGroup:new THREE.Group(),
  buildingBoxes:[],_spatialCollisions:{boxes:[]}};
Tunnel.build(city);
assert.equal(city.chicagoLowerWacker.pillarCount,12);
assert.equal(city.chicagoLowerWacker.lampCount,10);
assert.equal(city.buildingBoxes.length,12);
assert.equal(city._spatialCollisions.boxes,null);
const inside={x:240,z:-150,y:0};
const outside={x:261,z:-150,y:0};
assert.equal(Tunnel.isCovered(city,inside),true);
assert.equal(Tunnel.isCovered(city,outside),false);
assert.equal(Tunnel.isCovered(city,{x:240,z:-150,y:12}),false);
assert.equal(Tunnel.blocksPoliceSight(city,outside,inside),true);
assert.equal(Tunnel.blocksPoliceSight(city,{x:242,z:-145,y:0},inside),false);
assert.equal(Tunnel.isPillarContact(city,230,-220,0.3),true);
assert.equal(Tunnel.isPillarContact(city,240,-220,1.55),false);
assert.equal(Tunnel.isCovered({preset:{id:'havana'}},inside),false);
console.log('PASS Lower Wacker: 12 AABBs, 10 lâmpadas, visão e pista livre');
