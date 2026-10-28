'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const physics=vm.runInNewContext(
    read('js/physics/arcade-dynamics.js')+'\n'+
    read('js/physics/vehicle-collisions.js')+
    '\n({DriverArcadePhysics,DriverVehicleCollisions})',{Math});
const Chapter=vm.runInNewContext(
    read('js/gameplay/pursuit-chapter.js')+'\nDriverPursuitChapter',{Math});
const Route=vm.runInNewContext(
    read('js/gameplay/checkpoint-route.js')+'\nDriverCheckpointRoute',{Math});

function car(x=0,z=0,heading=0,speed=20,bodyStyle='muscle') {
    return {x,z,heading,speed,bodyStyle,damage:0,lateralVelocity:0,maxSpeed:55,
        updates:0,updateTransform(){this.updates++;}};
}
const street={isPointBlocked:()=>false};
const missionState={
    markersCollected:0,felony:90,policeNear:true,mode:'driving',
    position:{x:0,z:0},safeHouseZone:{x:0,z:0,radius:9}
};

test('colisão frontal separa carros e aplica dano uma vez',()=>{
    const a=car(0,0,0,20),b=car(0,2,Math.PI,20),sys=new physics.DriverVehicleCollisions();
    const events=[];
    assert.equal(sys.step([a,b],a,street,100,e=>events.push(e)),1);
    assert.ok(a.damage>0 && b.damage>0);
    assert.ok(a.z<0 && b.z>2);
    assert.equal(events.length,1);
    assert.ok(events[0].closingSpeed>39);
    assert.ok(a.updates>0 && b.updates>0);
});
test('colisão policial iniciada pela polícia não acusa Tanner',()=>{
    const a=car(0,0,0,0),b=car(0,2,Math.PI,21),sys=new physics.DriverVehicleCollisions();
    b.isPolice=true;
    let event=null;
    sys.step([a,b],a,street,150,e=>{event=e;});
    assert.ok(event);
    assert.ok(event.playerApproach<1);
    assert.equal(event.other,b);
});
test('colisão iniciada pelo jogador informa aproximação real',()=>{
    const a=car(0,0,0,22),b=car(0,2,0,0),sys=new physics.DriverVehicleCollisions();
    let event=null;
    sys.step([a,b],a,street,200,e=>event=e);
    assert.ok(event.playerApproach>20);
});
test('cooldown de dano é independente para cada par',()=>{
    const a=car(0,0,0,20),b=car(0,2,Math.PI,20),sys=new physics.DriverVehicleCollisions();
    let hit=0;
    const callback=()=>hit++;
    sys.step([a,b],a,street,100,callback);
    a.x=0;a.z=0;a.speed=20;a.heading=0;
    b.x=0;b.z=2;b.speed=20;b.heading=Math.PI;
    sys.step([a,b],a,street,300,callback);
    assert.equal(hit,1);
    a.x=0;a.z=0;a.speed=20;a.heading=0;
    b.x=0;b.z=2;b.speed=20;b.heading=Math.PI;
    sys.step([a,b],a,street,700,callback);
    assert.equal(hit,2);
});
test('reset da missão limpa histórico de impacto',()=>{
    const a=car(0,0,0,20),b=car(0,2,Math.PI,20),sys=new physics.DriverVehicleCollisions();
    let hit=0;
    sys.step([a,b],a,street,100,()=>hit++);
    a.z=0;a.speed=20;b.z=2;b.speed=20;
    sys.reset();
    sys.step([a,b],a,street,180,()=>hit++);
    assert.equal(hit,2);
});
test('carro encostado em prédio não é empurrado para dentro',()=>{
    const city={isPointBlocked:(x,z)=>z<0};
    const a=car(0,0,0,20),b=car(0,2,Math.PI,20);
    const sys=new physics.DriverVehicleCollisions();
    sys.step([a,b],a,city,100,()=>{});
    assert.ok(a.z>=0);
    assert.ok(b.z>2);
});
test('colisão de centros sobrepostos produz coordenadas finitas',()=>{
    const a=car(0,0,0,20),b=car(0,0,Math.PI,20);
    const sys=new physics.DriverVehicleCollisions();
    assert.equal(sys.step([a,b],a,street,200,()=>{}),1);
    assert.ok([a.x,a.z,b.x,b.z,a.speed,b.speed].every(Number.isFinite));
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>0);
});
test('carro pesado sofre proporcionalmente menos dano',()=>{
    const a=car(0,0,0,20,'muscle');
    const b=car(0,2,Math.PI,20,'bus');
    new physics.DriverVehicleCollisions().step([a,b],a,street,100,()=>{});
    assert.ok(a.damage>b.damage);
});
test('veículos separados não recebem impulso nem dano',()=>{
    const a=car(0,0,0,10),b=car(0,15,0,10);
    const contacts=new physics.DriverVehicleCollisions().step([a,b],a,street,100,()=>{});
    assert.equal(contacts,0);
    assert.equal(a.damage,0);
    assert.equal(b.damage,0);
});
test('primeiro ato dura 24 segundos e aciona o segundo ato',()=>{
    const chapter=new Chapter();
    let result;
    for(let i=0;i<481;i++)result=chapter.update(0.05,missionState);
    assert.equal(result.phase,1);
    assert.equal(result.complete,false);
});
test('controle de delta limita saltos de tempo grandes',()=>{
    const chapter=new Chapter();
    const state=chapter.update(12,missionState);
    assert.equal(state.phase,0);
    assert.ok(chapter.elapsed<=0.05);
});
test('após três portões começa o ato final',()=>{
    const chapter=new Chapter();
    chapter.phase=1;
    const result=chapter.update(1/60,{...missionState,markersCollected:3});
    assert.equal(result.phase,2);
    assert.equal(result.changed,true);
});
test('ato final exige esconderijo a pé e polícia despistada',()=>{
    const chapter=new Chapter();chapter.phase=2;
    const state={...missionState,markersCollected:3,felony:22,policeNear:false,
        mode:'on_foot'};
    assert.equal(chapter.update(1/60,{...state,mode:'driving'}).complete,false);
    assert.equal(chapter.update(1/60,{...state,policeNear:true}).complete,false);
    assert.equal(chapter.update(1/60,{...state,felony:43}).complete,false);
    assert.equal(chapter.update(1/60,{...state,position:{x:25,z:30}}).complete,false);
    assert.equal(chapter.update(1/60,state).complete,true);
});
test('portões da missão cinematográfica obedecem ordem',()=>{
    const markers=[{x:0,z:85,collected:false,mesh:{visible:true}},
        {x:-80,z:0,collected:false,mesh:{visible:true}},
        {x:-80,z:-80,collected:false,mesh:{visible:true}}];
    Route.refresh('pursuit',markers);
    assert.equal(markers[1].mesh.visible,false);
    assert.equal(Route.findReached('pursuit',markers,-80,0),null);
    assert.equal(Route.findReached('pursuit',markers,0,85),markers[0]);
});
test('nova missão e colisões têm referências carregadas corretamente',()=>{
    const html=read('index.html'),engine=read('js/engine/driver2-game-engine.js');
    const scripts=[...html.matchAll(/src="\.\/js\/([^"?]+\.js)(?:\?[^"]*)?"/g)].map(m=>m[1]);
    assert.ok(scripts.indexOf('physics/vehicle-collisions.js')<
        scripts.indexOf('engine/driver2-game-engine.js'));
    assert.ok(scripts.indexOf('gameplay/pursuit-chapter.js')<
        scripts.indexOf('engine/driver2-game-engine.js'));
    assert.match(engine,/this\.collisionSystem\.step/);
    assert.match(html,/startMission\('pursuit'\)/);
});


test('vetor de contato detecta frente e traseira mesmo após virar',()=>{
    const v=car(0,0,0,20);
    assert.equal(physics.DriverVehicleCollisions.impactZone(v,0,1),'front');
    assert.equal(physics.DriverVehicleCollisions.impactZone(v,0,-1),'rear');
    v.heading=Math.PI;
    assert.equal(physics.DriverVehicleCollisions.impactZone(v,0,1),'rear');
    assert.equal(physics.DriverVehicleCollisions.impactZone(v,0,-1),'front');
});
test('vetor de contato distingue laterais esquerda e direita',()=>{
    const v=car(0,0,0,20);
    assert.equal(physics.DriverVehicleCollisions.impactZone(v,1,0),'right');
    assert.equal(physics.DriverVehicleCollisions.impactZone(v,-1,0),'left');
    v.heading=Math.PI/2;
    assert.equal(physics.DriverVehicleCollisions.impactZone(v,0,-1),'right');
});
test('registro acumula danos em cada lado sem exceder 100',()=>{
    const v=car();
    const cls=physics.DriverVehicleCollisions;
    cls.recordZone(v,1,0,15);
    assert.ok(v.damageZones.right>0);
    assert.equal(v.damageZones.left,0);
    cls.recordZone(v,-1,0,200);
    cls.recordZone(v,-1,0,200);
    cls.recordZone(v,-1,0,200);
    assert.equal(v.damageZones.left,100);
    assert.equal(v.lastImpactZone,'left');
});
test('choque frontal registra o local para cada carro e no callback',()=>{
    const a=car(0,0,0,20),b=car(0,2,Math.PI,20);
    let hit=null;
    new physics.DriverVehicleCollisions().step([a,b],a,street,150,e=>hit=e);
    assert.equal(a.damageZones.front>0,true);
    assert.equal(b.damageZones.front>0,true);
    assert.equal(hit.impactZone,'front');
});
test('choque traseiro é classificado corretamente com ré',()=>{
    const a=car(0,0,0,-20),b=car(0,-2,0,0);
    let hit=null;
    new physics.DriverVehicleCollisions().step([a,b],a,street,200,e=>hit=e);
    assert.equal(hit.impactZone,'rear');
    assert.ok(a.damageZones.rear>0);
});
test('colisão lateral não atribui dano dianteiro automaticamente',()=>{
    const a=car(0,0,0,0),b=car(-2,0,0,0);
    a.lateralVelocity=-19;
    new physics.DriverVehicleCollisions().step([a,b],a,street,100,()=>{});
    assert.ok(a.damageZones.left>0);
    assert.equal(a.damageZones.front,0);
});
test('paredes da cidade ligam registro de danos por direção',()=>{
    const source=read('js/vehicles/driver-vehicle.js');
    assert.match(source,/DriverVehicleCollisions\.recordZone\(this,/);
    assert.match(source,/this\.damageZones = \{ front: 0, rear: 0, left: 0, right: 0 \}/);
});
