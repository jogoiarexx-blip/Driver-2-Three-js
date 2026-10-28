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
    assert.equal(city.cityGroup.children.length,5);
    const crosswalk=city.cityGroup.children.find(mesh=>mesh.count===1600);
    assert.ok(crosswalk,'faixas ausentes');
    assert.equal(crosswalk.instanceMatrix.needsUpdate,true);
});
test('postes não criam fontes dinâmicas de luz',()=>{
    const city={preset:{id:'vegas'},cityGroup:new Element()};
    Street.build(city);
    assert.equal(city.cityGroup.children.filter(m=>m.count===162).length,2);
    assert.equal(city.cityGroup.children.filter(m=>m.count===41).length,2);
    assert.ok(city.cityGroup.children.every(m=>m.castShadow===false));
});
test('HTML carrega módulos antes dos consumidores',()=>{
    const html=read('index.html');
    const scripts=[...html.matchAll(/src="\.\/js\/([^"?]+\.js)(?:\?[^"]*)?"/g)].map(m=>m[1]);
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


test('para-choque só aparece depois de dano forte',()=>{
    const car={chassisTilt:new Element(),damage:71};
    Damage.attach(car);
    assert.equal(car.damageParts.bumper.visible,false);
    car.damage=72;Damage.update(car);
    assert.equal(car.damageParts.bumper.visible,true);
});
test('motor superaquecido só aparece em dano crítico',()=>{
    const car={chassisTilt:new Element(),damage:84};
    Damage.attach(car);
    assert.equal(car.damageParts.engineGlow.visible,false);
    car.damage=85;Damage.update(car);
    assert.equal(car.damageParts.engineGlow.visible,true);
});
test('pulsação visual do motor danificado respeita o tempo da animação',()=>{
    const car={chassisTilt:new Element(),damage:90,motionClock:0};
    Damage.attach(car);
    const original=car.damageParts.engineGlow.scale.x;
    car.motionClock=0.27;Damage.update(car);
    assert.ok(car.damageParts.engineGlow.scale.x>=0.78);
    assert.notEqual(car.damageParts.engineGlow.scale.x,original);
});
test('renderização de dano funciona mesmo com modelo GLB e não adiciona PointLight',()=>{
    const car={chassisTilt:new Element(),damage:100};
    Damage.attach(car);
    assert.equal(car.damageGroup.parent,car.chassisTilt);
    assert.equal(car.damageParts.heavy.visible,true);
    assert.equal(car.damageParts.bumper.visible,true);
    assert.equal(car.damageParts.engineGlow.visible,true);
    assert.ok(car.damageGroup.children.every(x=>x instanceof Element));
});


test('amassados laterais começam invisíveis em carro não batido',()=>{
    const car={chassisTilt:new Element(),damage:0,damageZones:{front:0,rear:0,left:0,right:0}};
    Damage.attach(car);
    assert.equal(car.damageParts.leftDamage.visible,false);
    assert.equal(car.damageParts.rightDamage.visible,false);
    assert.equal(car.damageParts.rearDamage.visible,false);
    assert.equal(car.damageParts.bumper.visible,false);
});
test('colisão só na lateral esquerda revela chapa esquerda',()=>{
    const car={chassisTilt:new Element(),damage:15,damageZones:{front:0,rear:0,left:24,right:0}};
    Damage.attach(car);
    assert.equal(car.damageParts.leftDamage.visible,true);
    assert.equal(car.damageParts.rightDamage.visible,false);
    assert.equal(car.damageParts.rearDamage.visible,false);
});
test('colisão traseira cria para-choque traseiro empenado sem amassar frente',()=>{
    const car={chassisTilt:new Element(),damage:16,damageZones:{front:0,rear:34,left:0,right:0}};
    Damage.attach(car);
    assert.equal(car.damageParts.rearDamage.visible,true);
    assert.equal(car.damageParts.bumper.visible,false);
});
test('colisão frontal pode mostrar para-choque antes de 72% de dano global',()=>{
    const car={chassisTilt:new Element(),damage:14,damageZones:{front:24,rear:0,left:0,right:0}};
    Damage.attach(car);
    assert.equal(car.damageParts.bumper.visible,true);
    assert.equal(car.damageParts.rearDamage.visible,false);
});
test('dano independente nos dois lados da lataria',()=>{
    const car={chassisTilt:new Element(),damage:25,damageZones:{front:0,rear:0,left:0,right:20}};
    Damage.attach(car);
    assert.equal(car.damageParts.rightDamage.visible,true);
    assert.equal(car.damageParts.leftDamage.visible,false);
    car.damageZones.left=19;
    Damage.update(car);
    assert.equal(car.damageParts.leftDamage.visible,true);
});
test('manobra policial exige campo de visão e nível de delito elevado',()=>{
    const cop={x:0,z:-22,speed:24,pursuitRole:1};
    const player={x:0,z:0,heading:0,speed:24};
    const city={isPointBlocked:()=>false};
    assert.equal(Tactics.maneuverFor(cop,player,90,city,false),null);
    assert.equal(Tactics.maneuverFor(cop,player,61,city,true),null);
    assert.ok(Tactics.maneuverFor(cop,player,90,city,true));
});
test('flanqueadores fazem aproximação por lados opostos',()=>{
    const player={x:0,z:0,heading:0,speed:24};
    const city={isPointBlocked:()=>false};
    const one=Tactics.maneuverFor({x:0,z:-22,speed:24,pursuitRole:1},player,90,city,true);
    const two=Tactics.maneuverFor({x:0,z:-22,speed:24,pursuitRole:2},player,90,city,true);
    assert.ok(one.x>0);
    assert.ok(two.x<0);
    assert.equal(one.mode,'flank');
    assert.equal(two.mode,'flank');
});
test('interceptor tenta fechar trajeto à frente, com frenagem controlada',()=>{
    const city={isPointBlocked:()=>false};
    const p={x:0,z:0,heading:0,speed:24};
    const cop={x:0,z:-19,speed:20,pursuitRole:3};
    const intercept=Tactics.maneuverFor(cop,p,95,city,true);
    assert.equal(intercept.mode,'intercept');
    assert.ok(intercept.z>12);
    assert.ok(intercept.speedLimit<=21);
});
test('manobras especiais são canceladas perto de prédios',()=>{
    const car={x:0,z:-25,speed:25,pursuitRole:3};
    const player={x:0,z:0,heading:0,speed:24};
    assert.equal(Tactics.maneuverFor(car,player,90,{isPointBlocked:()=>true},true),null);
});
test('interceptor não tenta cortar parado nem perseguir longe demais',()=>{
    const city={isPointBlocked:()=>false};
    const cop={x:0,z:-30,speed:20,pursuitRole:3};
    assert.equal(Tactics.maneuverFor(cop,{x:0,z:0,heading:0,speed:3},95,city,true),null);
    assert.equal(Tactics.maneuverFor({...cop,z:-100},{x:0,z:0,heading:0,speed:30},95,city,true),null);
});
