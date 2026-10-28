/**
 * Regressão de garagem, estádio, navegação e indicadores do Driver 2.
 * Execute: node tests/driver2-garage-wrigley-radar.smoke.cjs
 * Usa os arquivos reais do jogo com THREE simulado, sem WebGL.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const vector=()=>({x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}});
class Group {
    constructor(){this.children=[];this.position=vector();this.rotation=vector();}
    add(...items){this.children.push(...items);}
}
class Mesh extends Group{
    constructor(geometry,material){super();this.geometry=geometry;this.material=material;}
}
class Material {
    constructor(){this.color={setHex(hex){this.value=hex;}};}
}
const THREE={
    Group,Mesh,MeshLambertMaterial:Material,
    MeshBasicMaterial:Material,MeshPhongMaterial:Material,
    BoxGeometry:class{constructor(...size){this.size=size;}},
    CylinderGeometry:class{},
    MathUtils:{damp(a,b,lambda,dt){return b+(a-b)*Math.exp(-lambda*dt);}}
};
class Vehicle{
    constructor(scene,data){
        Object.assign(this,data);
        this.isSecret=!!data.isSecret;
        this.chassisTilt=new Group();
        this.hoodPivot=new Group();
        this.trunkPivot=new Group();
        this.root=new Group();
    }
}
const ctx={THREE,DriverVehicle:Vehicle};
vm.createContext(ctx);
function load(file,name){
    const full=path.join(__dirname,'..',file);
    vm.runInContext(fs.readFileSync(full,'utf8')+
        '\nthis.'+name+'='+name+';',ctx,{filename:full});
    return ctx[name];
}
const Grid=load('js/world/spatial-collision-grid.js','DriverSpatialCollisionGrid');
const City=load('js/world/city-builder.js','CityBuilder');
const Gameplay=load('js/world/chicago-gameplay.js','DriverChicagoGameplay');

const city={
    preset:{id:'chicago'},cityGroup:new Group(),buildingBoxes:[],
    interiors:[],worldLimit:410,canalWallSegments:[],
    interiorArea:()=>false,_spatialCollisions:null
};
City.prototype.buildSafeHouseBlock.call(city,-120,-120);
const blocked=(x,z,radius=1.55)=>
    City.prototype.isPointBlocked.call(city,x,z,radius,0);
const doorZ=-104.8;
assert.equal(blocked(-129,doorZ),true,'Portão fechado precisa bloquear');
city.toggleHomeGarageDoor=City.prototype.toggleHomeGarageDoor;
assert.equal(city.toggleHomeGarageDoor(),true);
for(let z=-103;z>=-116;z-=.5)
    assert.equal(blocked(-129,z),false,
        'Garagem aberta tem colisão invisível em z='+z);
assert.equal(city.toggleHomeGarageDoor(),false);
assert.equal(blocked(-129,doorZ),true,'Fechamento restaura colisor');

const stadium={
    preset:{id:'chicago'},cityGroup:new Group(),
    buildingBoxes:[],_spatialCollisions:{boxes:[]}
};
Gameplay.buildStadium(stadium,-280,200);
const game={city:stadium,currentCityKey:'chicago',scene:new Group(),vehicles:[]};
const car=Gameplay.ensureWrigleyCar(game);
assert.equal(Gameplay.ensureWrigleyCar(game),car,'Não duplicar veículo');
assert.equal(game.vehicles.length,1);
assert.equal(car.maxSpeed,72);
assert.equal(car.driftMultiplier,1.28);
assert.equal(car.chassisTilt.children.length,2);
assert.equal(car.hoodPivot.children.length,2);
assert.equal(car.trunkPivot.children.length,2);
assert.equal(Gameplay.interact(stadium,{x:0,z:0}),false);
assert.equal(stadium.buildingBoxes.includes(stadium.chicagoStadium.box),true);
assert.equal(Gameplay.interact(stadium,{x:-250,z:223}),true);
assert.equal(stadium.buildingBoxes.includes(stadium.chicagoStadium.box),false);
assert.equal(stadium._spatialCollisions.boxes,null);

const worldToRadar=(dx,dz,heading)=>{
    // Espelhamento X da câmera de perseguição + rotação do heading.
    const x=-dx,z=-dz,a=heading;
    return {x:x*Math.cos(a)-z*Math.sin(a),
        y:x*Math.sin(a)+z*Math.cos(a)};
};
for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const fx=Math.sin(heading)*10,fz=Math.cos(heading)*10;
    const front=worldToRadar(fx,fz,heading);
    assert(Math.abs(front.x)<1e-8 && front.y<0,
        'Frente deve ficar para cima no minimapa');
    // A câmera vê a direita de Tanner na direção (-cos h, +sin h).
    const right=worldToRadar(-Math.cos(heading)*10,
        Math.sin(heading)*10,heading);
    assert(right.x>0 && Math.abs(right.y)<1e-8,
        'Direita deve ficar para a direita no minimapa');
}
console.log('PASS: garagem aberta/fechada, Wrigley real, 4 rumos de minimapa');
