'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
class Element {
    constructor(){this.children=[];this.parent=null;this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};
    this.rotation={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};
    this.scale={x:1,y:1,z:1,set(x,y,z){this.x=x;this.y=y;this.z=z;}};
    this.matrix={};}
    add(...children){children.forEach(c=>{this.children.push(c);c.parent=this;});}
    remove(child){this.children=this.children.filter(c=>c!==child);child.parent=null;}
    updateMatrix(){}
}
class Mesh extends Element {
    constructor(geometry,material){super();this.geometry=geometry;this.material=material;this.userData={};this.visible=true;}
}
class InstancedMesh extends Mesh {
    constructor(geo,mat,count){super(geo,mat);this.count=count;this.indices=[];this.instanceMatrix={needsUpdate:false};}
    setMatrixAt(index){this.indices.push(index);}
}
class Material{constructor(options){this.options=options||{};}}
class Geometry{constructor(...args){this.args=args;}}
const THREE={
    Group:Element,Object3D:Element,Mesh,InstancedMesh,
    MeshBasicMaterial:Material,MeshLambertMaterial:Material,
    BoxGeometry:Geometry,PlaneGeometry:Geometry,CylinderGeometry:Geometry,
    DoubleSide:2,
    MathUtils:{clamp:(v,min,max)=>Math.max(min,Math.min(max,v))}
};
const Damage=vm.runInNewContext(read('js/render/vehicle-damage-fx.js')+'\nVehicleDamageFX;', {THREE,Math,GPUResourceUtils:{disposeSubtree(){}}});
const Tactics=vm.runInNewContext(read('js/police/pursuit-tactics.js')+'\nPolicePursuitTactics;', {Math});
const Street=vm.runInNewContext(read('js/world/street-furniture.js')+'\nDriverStreetFurniture;', {THREE,Math});

test('estágios de dano têm limiares progressivos',()=>{
    assert.equal(Damage.severity(19).scratches,false);
    assert.equal(Damage.severity(20).scratches,true);
    assert.equal(Damage.severity(37).dents,false);
    assert.equal(Damage.severity(38).dents,true);
    assert.equal(Damage.severity(63).glass,false);
    assert.equal(Damage.severity(64).glass,true);
    assert.equal(Damage.severity(85).critical,true);
});
test('dano inválido é normalizado',()=>{
    assert.equal(Damage.severity(-9).intensity,0);
    assert.equal(Damage.severity(150).intensity,1);
    assert.equal(Damage.severity(NaN).intensity,0);
});
test('modelos 3D mantêm apenas um kit de dano e o atualizam',()=>{
    const car={chassisTilt:new Element(),damage:0};
    Damage.attach(car);
    assert.ok(car.damageGroup.parent===car.chassisTilt);
    assert.equal(car.damageParts.scratches.visible,false);
    car.damage=72;Damage.update(car);
    assert.equal(car.damageParts.scratches.visible,true);
    assert.equal(car.damageParts.dents.visible,true);
    assert.equal(car.damageParts.cracks.visible,true);
    assert.equal(car.damageParts.heavy.visible,false);
});
test('danos críticos ativam a peça danificada do capô',()=>{
    const car={chassisTilt:new Element(),damage:91};
    Damage.attach(car);
    assert.equal(car.damageParts.heavy.visible,true);
});
test('quatro viaturas têm objetivos diferentes',()=>{
    const player={x:0,z:0,heading:0,speed:36};
    const roles=[0,1,2,3].map(pursuitRole=>
        Tactics.targetFor({x:0,z:-40,pursuitRole},player,90));
    assert.equal(roles.length,4);
    assert.ok(roles[1].x>0);
    assert.ok(roles[2].x<0);
    assert.ok(roles[3].z>roles[0].z);
});
test('alvo fora da cidade não é válido para interceptação direta',()=>{
    assert.equal(Tactics.targetIsSafe({isPointBlocked:()=>false},{x:290,z:0}),false);
    assert.equal(Tactics.targetIsSafe({isPointBlocked:()=>true},{x:8,z:8}),false);
    assert.equal(Tactics.targetIsSafe({isPointBlocked:()=>false},{x:8,z:8}),true);
});
test('flanqueadores não criam previsão infinita',()=>{
    const cop={x:-10,z:5,pursuitRole:3};
    const target=Tactics.targetFor(cop,{x:2,z:5,heading:1.2,speed:1e7},100);
    assert.ok(Number.isFinite(target.x));
    assert.ok(Math.hypot(target.x-2,target.z-5)<100);
});
test('faixas de pedestres são instanciadas em um lote',()=>{
    const city={preset:{id:'chicago'},cityGroup:new Element()};
    Street.build(city);
    assert.equal(city.cityGroup.children.length,3);
    assert.equal(city.cityGroup.children[0].count,500);
    assert.equal(city.cityGroup.children[0].instanceMatrix.needsUpdate,true);
});
test('postes não criam fontes dinâmicas de luz',()=>{
    const city={preset:{id:'vegas'},cityGroup:new Element()};
    Street.build(city);
    assert.equal(city.cityGroup.children[1].count,50);
    assert.equal(city.cityGroup.children[2].count,50);
    assert.ok(city.cityGroup.children.every(m=>m.castShadow===false));
});
test('HTML carrega módulos antes dos consumidores',()=>{
    const html=read('index.html');
    const scripts=[...html.matchAll(/src="\.\/js\/([^"]+\.js)"/g)].map(m=>m[1]);
    function ordered(a,b) {
        assert.ok(scripts.indexOf(a)!==-1);
        assert.ok(scripts.indexOf(b)!==-1);
        assert.ok(scripts.indexOf(a)<scripts.indexOf(b));
    }
    ordered('render/vehicle-damage-fx.js','render/vehicle-visuals.js');
    ordered('render/vehicle-damage-fx.js','vehicles/driver-vehicle.js');
    ordered('police/pursuit-tactics.js','traffic/traffic-ai.js');
    ordered('world/street-furniture.js','world/city-builder.js');
});
