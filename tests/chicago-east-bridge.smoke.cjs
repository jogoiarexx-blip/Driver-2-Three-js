/**
 * Regressão da segunda ponte de Chicago.
 * Execução: node tests/chicago-east-bridge.smoke.cjs
 * Sem dependências WebGL/npm; isola a geometria lógica e as funções do CityBuilder.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const vec=()=>({x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}});
class Group {
    constructor(){this.position=vec();this.rotation=vec();this.children=[];}
    add(mesh){this.children.push(mesh);}
}
class Mesh {
    constructor(geometry,material){
        this.geometry=geometry;this.material=material;
        this.position=vec();this.rotation=vec();
    }
}
class Material {
    constructor(){this.color={setHex(v){this.value=v;}};}
    clone(){return new Material();}
}
const THREE={
    Group,Mesh,MeshLambertMaterial:Material,MeshBasicMaterial:Material,
    BoxGeometry:class{constructor(w,h,d){this.size=[w,h,d];}}
};
const ctx={THREE,CITY_PRESETS:{chicago:{id:'chicago'}}};
vm.createContext(ctx);
const run=(relative,exportName,globalName)=>{
    const file=path.join(__dirname,'..',relative);
    vm.runInContext(fs.readFileSync(file,'utf8')+
        '\nthis.'+globalName+'='+exportName+';',ctx,{filename:file});
};
run('js/world/chicago-east-bridge.js','DriverChicagoEastBridge','Bridge');
run('js/world/city-builder.js','CityBuilder','City');
const Bridge=ctx.Bridge,City=ctx.City;
const angle=20*Math.PI/180;
const city={preset:{id:'chicago'},bridgeAngle:angle,signalClock:1.2,
    cityGroup:new Group(),trainStation:null,worldLimit:410,
    caineBridgeClosed:false,canalWallSegments:[],buildingBoxes:[],
    interiorArea(){return false;},
    getSidewalkHeightAt(){return 0;}};
city.isWaterAt=(x,z)=>City.prototype.isWaterAt.call(city,x,z);
Bridge.build(city);
Bridge.update(city,.016);
assert.equal(city.cityGroup.children.length,8);
assert.equal(city.chicagoEastBridge.beacons.length,4);
assert.equal(city.chicagoEastBridge.south.rotation.x,-angle);
assert.equal(city.chicagoEastBridge.north.rotation.x,angle);
const getHeight=(x,z)=>City.prototype.getGroundHeightAt.call(city,x,z);
assert(Math.abs(getHeight(240,50)-getHeight(0,50))<1e-7);
assert(getHeight(240,50)>getHeight(240,42));
assert.equal(city.isWaterAt(240,50),false);
assert.equal(city.isWaterAt(269,50),true);
assert.equal(City.prototype.isPointBlocked.call(city,240,42,1.55,3),false);
assert.equal(City.prototype.isPointBlocked.call(
    city,249.5,42,1.55,getHeight(240,42)),true);
const jump=Bridge.jumpVelocity(
    city,240,49.9,240,50.2,30,getHeight(240,49.9));
assert(jump>5 && jump<11);
assert.equal(Bridge.jumpVelocity(
    city,270,49.9,270,50.2,30,0),0);
assert.equal(Bridge.jumpVelocity(
    {...city,bridgeAngle:38*Math.PI/180},
    240,49.9,240,50.2,30,getHeight(240,49.9)),0);
assert.equal(Bridge.deckHeight({preset:{id:'havana'}},240,50),null);
console.log('PASS Chicago: 2 folhas, 4 sinais, rampas físicas, água, colisões e salto');
