'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const {Physics,Collisions}=vm.runInNewContext(
    read('js/physics/arcade-dynamics.js')+'\n'+
    read('js/physics/vehicle-collisions.js')+
    '\n({Physics:DriverArcadePhysics,Collisions:DriverVehicleCollisions})',
    {Math,Number,WeakMap,Infinity});
const street={isPointBlocked:()=>false};
function car({x=0,z=0,prevX=x,prevZ=z,heading=0,speed=55}={}){
    return {x,z,prevX,prevZ,heading,speed,maxSpeed:65,
        bodyStyle:'muscle',damage:0,lateralVelocity:0,
        y:0,damageZones:{front:0,rear:0,left:0,right:0},
        updateTransform(){this.transforms=(this.transforms||0)+1}};
}
test('colisão varrida impede atravessamento de carros que trocaram de lado',()=>{
    const a=car({x:5,prevX:-5,heading:Math.PI/2});
    const b=car({x:-5,prevX:5,heading:-Math.PI/2});
    const events=[];
    const count=new Collisions().step([a,b],a,street,500,
        hit=>events.push(hit),hit=>events.push(hit));
    assert.equal(count,1);
    assert.equal(events.length,2);
    assert.equal(events[0].swept,true);
    assert.ok(events[0].closingSpeed>20);
    assert.ok(a.x<b.x);
    assert.ok(a.damage>0&&b.damage>0);
    assert.equal(a.lastImpactZone,'front');
});
test('duas trajetórias paralelas sem aproximação não geram colisão',()=>{
    const a=car({x:4,prevX:-4,z:0,prevZ:0,heading:Math.PI/2});
    const b=car({x:4,prevX:-4,z:15,prevZ:15,heading:Math.PI/2});
    assert.equal(new Collisions().step([a,b],a,street,300),0);
    assert.equal(a.damage,0);
});
test('carros que cruzam o mesmo espaço em tempos diferentes não colidem',()=>{
    const a=car({x:5,prevX:-5,z:0,prevZ:0,heading:Math.PI/2});
    // O antigo prevZ=3 causa contato real entre os cantos das novas OBBs.
    // Separação >=4.4 mantém os corpos afastados em todos os instantes.
    const b=car({x:0,prevX:0,z:9.4,prevZ:4.4,heading:Math.PI});
    assert.equal(new Collisions().step([a,b],a,street,300),0);
});
test('teleporte entre cidades não é confundido com batida',()=>{
    const a=car({x:100,prevX:-100,z:0,heading:Math.PI/2});
    const b=car({x:0,prevX:0,z:0,speed:0});
    assert.equal(new Collisions().step([a,b],a,street,400),0);
});
test('carros em alturas diferentes não se chocam na ponte',()=>{
    const a=car({x:0,z:0});
    const b=car({x:0,z:0,speed:0});b.y=6;
    assert.equal(new Collisions().step([a,b],a,street,400),0);
});
test('contato contínuo não recua carros para dentro de paredes',()=>{
    const a=car({x:5,prevX:-5,heading:Math.PI/2});
    const b=car({x:-5,prevX:5,heading:-Math.PI/2});
    const wall={isPointBlocked:()=>true};
    assert.equal(new Collisions().step([a,b],a,wall,400),0);
    assert.equal(a.x,5);
});
test('dano usa cooldown para não multiplicar colisão em frames seguidos',()=>{
    const a=car({x:5,prevX:-5,heading:Math.PI/2});
    const b=car({x:-5,prevX:5,heading:-Math.PI/2});
    const sys=new Collisions();
    const calls=[];
    sys.step([a,b],a,street,100,null,e=>calls.push(e));
    assert.equal(calls.length,1);
    const dmg=a.damage;
    a.x=5;a.prevX=-5;a.speed=55;
    b.x=-5;b.prevX=5;b.speed=55;
    sys.step([a,b],a,street,250,null,e=>calls.push(e));
    assert.equal(calls.length,1);
    assert.equal(a.damage,dmg);
});
const v=(x,y,z)=>({x,y,z,set(xv,yv,zv){this.x=xv;this.y=yv;this.z=zv}});
class Material {
    constructor(options){this.options=options||{};this.disposed=false}
    dispose(){this.disposed=true}
}
class Mesh{
    constructor(geo,mat){this.geometry=geo;this.material=mat;
        this.position=v(0,0,0);this.rotation=v(0,0,0);
        this.scale=v(1,1,1)}
}
const THREE={Mesh,BoxGeometry:class{},MeshLambertMaterial:Material};
const Effects=vm.runInNewContext(
    read('js/render/effects-manager.js')+'\nEffectsManager',
    {THREE,Math,Number});
const makeFX=()=>{
    const fx=Object.create(Effects.prototype);
    fx.breakawayPieces=[];
    fx.maxBreakawayPieces=40;
    fx.breakawayGeometry={};
    fx.impactSparks=[];fx.smokeParticles=[];fx.flyingHubcaps=[];
    fx.explosions=[];
    fx.scene={added:[],add(mesh){this.added.push(mesh)},
        remove(mesh){this.added=this.added.filter(x=>x!==mesh)}};
    return fx;
};
const damaged=()=>({
    x:0,z:0,y:0,heading:0,speed:30,color:0xd53934,
    damageZones:{front:50,rear:60,left:40,right:40},
    breakawayFlags:{front:false,rear:false,left:false,right:false},
    frontBumperMesh:{visible:true},rearBumperMesh:{visible:true}
});
test('batida forte destaca para-choque dianteiro apenas uma vez',()=>{
    const fx=makeFX(),c=damaged();
    assert.equal(fx.spawnCarBreakaway(c,'front',33),true);
    assert.equal(c.frontBumperMesh.visible,false);
    assert.equal(c.breakawayFlags.front,true);
    assert.equal(fx.spawnCarBreakaway(c,'front',40),false);
    assert.equal(fx.breakawayPieces.length,1);
});
test('batida fraca não arranca peças e GLB não exige malha original separada',()=>{
    const fx=makeFX(),c=damaged();
    c.frontBumperMesh=null;
    assert.equal(fx.spawnCarBreakaway(c,'front',15),false);
    assert.equal(fx.spawnCarBreakaway(c,'front',35),true);
    assert.equal(fx.breakawayPieces[0].mesh.material.options.color,0x949aa5);
    assert.equal(fx.spawnCarBreakaway(c,'left',31),true);
    assert.equal(fx.breakawayPieces[1].mesh.material.options.color,c.color);
});
test('fragmentos são temporários e materiais liberados da GPU',()=>{
    const fx=makeFX(),c=damaged();
    fx.spawnCarBreakaway(c,'rear',38);
    const material=fx.breakawayPieces[0].mesh.material;
    fx.update(5);
    assert.equal(fx.breakawayPieces.length,0);
    assert.equal(fx.scene.added.length,0);
    assert.equal(material.disposed,true);
});
test('orçamento de fragmentos é limitado mesmo com colisões múltiplas',()=>{
    const fx=makeFX();
    for(let i=0;i<70;i++){
        const c=damaged();c.x=i*2;
        fx.spawnCarBreakaway(c,'left',37);
    }
    assert.equal(fx.breakawayPieces.length,40);
    assert.equal(fx.scene.added.length,40);
});
test('representação de danos oculta sobreposição de para-choque destacado',()=>{
    const FX=vm.runInNewContext(
        read('js/render/vehicle-damage-fx.js')+'\nVehicleDamageFX',
        {Math,Number});
    const part=()=>({visible:true,position:v(0,0,0),
        rotation:v(0,0,0),scale:v(1,1,1)});
    const pieces={};
    for(const key of ['scratches','dents','cracks','heavy','bumper',
        'rearDamage','leftDamage','rightDamage','engineGlow'])
        pieces[key]=part();
    const c={damage:86,damageZones:{front:60,rear:50,left:0,right:0},
        breakawayFlags:{front:true,rear:true},damageParts:pieces,
        frontBumperMesh:part(),rearBumperMesh:part()};
    FX.update(c);
    assert.equal(c.damageParts.bumper.visible,false);
    assert.equal(c.damageParts.rearDamage.visible,false);
    assert.equal(c.frontBumperMesh.visible,false);
    assert.equal(c.rearBumperMesh.visible,false);
});
test('save manual preserva estado das peças faltantes sem perder compatibilidade',()=>{
    const Save=vm.runInNewContext(read('js/gameplay/home-save.js')+
        '\nDriverHomeSave',{Math,Number,Date,JSON});
    const state=Save.position(damaged());
    state.breakawayFlags.front=true;
    assert.equal(state.breakawayFlags.front,true);
    assert.equal(Save.position({x:0,z:0,heading:0,speed:0,
        damage:0}).breakawayFlags.front,false);
});
test('efeitos são conectados a colisões, paredes e frota sem substituir GLB',()=>{
    const engine=read('js/engine/driver2-game-engine.js');
    const vehicle=read('js/vehicles/driver-vehicle.js');
    assert.match(engine,/event=>\{/);
    assert.match(engine,/spawnCarBreakaway\(event\.a,event\.zoneA/);
    assert.match(vehicle,/effects\.spawnCarBreakaway\(this,zone,impactSpeed\)/);
    assert.match(vehicle,/this\.frontBumperMesh=null/);
    assert.match(vehicle,/preserved = \[this\.sirenAssembly, this\.targetMarker, this\.lightsGroup, this\.damageGroup\]/);
});
