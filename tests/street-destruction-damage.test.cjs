'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

class Vector {
    constructor(){this.x=0;this.y=0;this.z=0}
    set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
}
class Object3D {
    constructor(){
        this.position=new Vector();
        this.rotation=new Vector();
        this.scale=new Vector().set(1,1,1);
        this.matrix=null;
        this.children=[];
        this.visible=true;
    }
    updateMatrix(){this.matrix={
        position:{x:this.position.x,y:this.position.y,z:this.position.z},
        scale:{x:this.scale.x,y:this.scale.y,z:this.scale.z}
    }}
    add(...obj){this.children.push(...obj)}
}
class InstancedMesh extends Object3D {
    constructor(g,m,n){super();this.count=n;this.matrices=new Map();
        this.instanceMatrix={needsUpdate:false}}
    setMatrixAt(i,m){this.matrices.set(i,{
        position:{...m.position},scale:{...m.scale}
    })}
}
class Mesh extends Object3D {constructor(g,m){super();this.geometry=g;this.material=m}}
class Material {constructor(config){this.config=config}}
const THREE={
    Object3D,InstancedMesh,Mesh,Group:Object3D,
    PlaneGeometry:class{rotateX(){}},
    BoxGeometry:class{},CylinderGeometry:class{},
    MeshLambertMaterial:Material,MeshBasicMaterial:Material,
    MathUtils:{lerp:(a,b,t)=>a+(b-a)*t},DoubleSide:2
};
const Street=vm.runInNewContext(
    read('js/world/street-furniture.js')+'\nDriverStreetFurniture',
    {THREE,Math}
);
const Collisions={recordZone(car,x,z,speed){
    car.recordedImpact={x,z,speed};
}};
const City=vm.runInNewContext(
    read('js/world/city-builder.js')+'\nCityBuilder',
    {THREE,Math,DriverStreetFurniture:Street,
        DriverVehicleCollisions:Collisions}
);
const Damage=vm.runInNewContext(
    read('js/render/vehicle-damage-fx.js')+'\nVehicleDamageFX',
    {THREE,Math,Number}
);
function fixtureCity(){
    const city=Object.create(City.prototype);
    city.signalClock=0;city.bridgeAngle=.08;city.bridgeRaised=false;
    city.caineBridgeGate=null;city.secretGateOpen=false;
    city.destructibleProps=[];city.debrisPieces=[];
    city.debrisGeometry=null;city.debrisMaterialCache=null;
    city.poleDebrisGeometry=null;
    city.cityGroup={objects:[],add(o){this.objects.push(o)},
        remove(o){this.objects=this.objects.filter(x=>x!==o)}};
    city.refreshTrafficLights=()=>{};
    return city;
}
function pole(x,z,index=0){
    const mesh=new InstancedMesh(null,null,3);
    const lamp=new InstancedMesh(null,null,3);
    for(let i=0;i<3;i++){
        const p={position:{x:i*4,y:2.9,z:0},
            scale:{x:1,y:1,z:1}};
        mesh.setMatrixAt(i,p);lamp.setMatrixAt(i,p);
    }
    return {type:'pole',x,z,hit:false,shattered:false,
        instanceIndex:index,poleMesh:mesh,lampMesh:lamp,mesh:null};
}
function vehicle(x=0,z=0,speed=30,prevX=-9,prevZ=0){
    return {x,z,speed,prevX,prevZ,heading:0,damage:0};
}
function damagePart(){
    return {visible:false,rotation:new Vector(),
        position:new Vector(),scale:new Vector().set(1,1,1)}
}
function damagedCar(zones,total=78){
    const damageParts={};
    for(const key of ['scratches','dents','cracks','heavy','bumper',
        'rearDamage','leftDamage','rightDamage','engineGlow'])
        damageParts[key]=damagePart();
    return {damage:total,damageZones:zones,damageParts,motionClock:2,
        hoodPivot:damagePart(),trunkPivot:damagePart()};
}
test('postes continuam instanciados e registrados individualmente',()=>{
    const city=fixtureCity();city.preset={id:'chicago'};
    Street.build(city);
    const poles=city.destructibleProps.filter(p=>p.type==='pole');
    assert.equal(poles.length,2*9*9);
    assert.equal(poles[0].poleMesh,poles[1].poleMesh);
    assert.equal(city.cityGroup.objects.length,5);
});
test('acidente remove somente o poste atingido, preserva os vizinhos',()=>{
    const p=pole(0,0,1),other=p.poleMesh.matrices.get(2);
    assert.equal(Street.hidePole(p),true);
    assert.equal(Street.hidePole(p),false);
    assert.equal(p.hidden,true);
    assert.equal(p.poleMesh.matrices.get(1).scale.x,0);
    assert.equal(p.lampMesh.matrices.get(1).scale.x,0);
    assert.deepEqual(p.poleMesh.matrices.get(2),other);
    assert.equal(p.poleMesh.instanceMatrix.needsUpdate,true);
});
test('colisão rápida derruba poste e reduz velocidade do carro',()=>{
    const city=fixtureCity();
    const p=pole(0,0,1);city.destructibleProps.push(p);
    const car=vehicle();
    let hitCount=0;
    city.update(.016,[car],(target,prop,speed)=>{
        hitCount++;assert.equal(target,car);assert.equal(prop,p);
        assert.ok(speed>=30);
    });
    assert.equal(hitCount,1);
    assert.equal(p.shattered,true);
    assert.equal(p.poleMesh.matrices.get(1).scale.x,0);
    assert.equal(p.poleMesh.matrices.get(2).scale.x,1);
    assert.ok(car.speed<30);
    assert.ok(car.damage>0);
    assert.ok(car.recordedImpact);
    assert.ok(city.debrisPieces.length>0);
});
test('carro lento não derruba poste nem sofre dano',()=>{
    const city=fixtureCity(),p=pole(0,0);
    city.destructibleProps=[p];
    const car=vehicle(0,0,2,-.1,0);
    city.update(.016,[car]);
    assert.equal(p.hit,false);
    assert.equal(car.damage,0);
    assert.equal(city.debrisPieces.length,0);
});
test('cercas podem quebrar, com geometria e posições reais',()=>{
    const city=fixtureCity();
    city.spawnDestructibleProp(100,100,'fence');
    const fence=city.destructibleProps[0];
    assert.equal(fence.type,'fence');
    assert.equal(fence.mesh.children.length,4);
    assert.equal(fence.mesh.position.x,100);
    assert.equal(fence.mesh.position.z,100);
    assert.equal(city.shatterProp(fence,22),true);
    assert.equal(fence.mesh.visible,false);
    assert.equal(city.shatterProp(fence,22),false);
});
test('destruição tem limite de partículas e remove detritos expirados',()=>{
    const city=fixtureCity();
    for(let i=0;i<90;i++){
        const prop={type:'crate',x:i*5,z:0,mesh:{visible:true}};
        city.shatterProp(prop,25);
    }
    assert.ok(city.debrisPieces.length<=140);
    for(let i=0;i<200;i++)city.update(.05,[]);
    assert.equal(city.debrisPieces.length,0);
    assert.equal(city.cityGroup.objects.length,0);
});
test('ao resetar cidade não há reuse de postes/detritos destruídos',()=>{
    const city=read('js/world/city-builder.js');
    assert.match(city,/this\.debrisPieces=\[\]/);
    assert.match(city,/this\.poleDebrisGeometry=null/);
    assert.match(city,/this\.destructibleProps = \[\]/);
    assert.match(city,/DriverStreetFurniture\.build\(this\)/);
});
test('danos frontais e traseiros dobram peças opostas',()=>{
    const front=damagedCar({front:80,rear:0,left:0,right:0});
    const rear=damagedCar({front:0,rear:82,left:0,right:0});
    Damage.update(front);Damage.update(rear);
    assert.ok(front.damageParts.bumper.visible);
    assert.ok(front.damageParts.bumper.rotation.z<-.2);
    assert.ok(front.damageParts.bumper.position.z<0);
    assert.equal(front.damageParts.rearDamage.visible,false);
    assert.ok(rear.damageParts.rearDamage.visible);
    assert.ok(rear.damageParts.rearDamage.position.z>0);
    assert.equal(rear.damageParts.bumper.rotation.z<0,true);
    assert.ok(front.hoodPivot.rotation.x<0);
    assert.ok(rear.trunkPivot.rotation.x>0);
});
test('impactos laterais provocam deformação localizada',()=>{
    const left=damagedCar({front:0,rear:0,left:70,right:0},40);
    const right=damagedCar({front:0,rear:0,left:0,right:70},40);
    Damage.update(left);Damage.update(right);
    assert.ok(left.damageParts.leftDamage.visible);
    assert.equal(left.damageParts.rightDamage.visible,false);
    assert.ok(right.damageParts.rightDamage.visible);
    assert.equal(right.damageParts.leftDamage.visible,false);
    assert.ok(left.damageParts.leftDamage.position.x>0);
    assert.ok(right.damageParts.rightDamage.position.x<0);
});
test('valores inválidos de dano não injetam NaN na deformação',()=>{
    const result=Damage.zoneState({damage:Infinity,
        damageZones:{front:NaN,left:-4,right:200,rear:'abc'}});
    for(const value of Object.values(result)) assert.ok(Number.isFinite(value));
    assert.equal(result.front,0);
    assert.equal(result.right,1);
    assert.equal(result.left,0);
});
test('colisões de NPC quebram objetos sem áudio/delito de Tanner',()=>{
    const src=read('js/engine/driver2-game-engine.js');
    assert.match(src,/car!==this\.playerCar\)return/);
    assert.match(src,/this\.effects\.spawnImpactSparks/);
    assert.match(read('js/world/city-builder.js'),/onPropHitCallback\(car,p,impact\)/);
});
test('colisões continuam usando os mesmos colliders físicos',()=>{
    const c=read('js/world/city-builder.js');
    assert.match(c,/isPointBlocked\(x, z, radius = 1\.2, y = 0\)/);
    assert.match(c,/this\.buildingBoxes/);
    const v=read('js/render/vehicle-damage-fx.js');
    assert.match(v,/sem deformar a caixa física/);
});
