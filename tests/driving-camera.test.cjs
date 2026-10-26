'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const code=[
  read('js/physics/arcade-dynamics.js'),
  read('js/render/driver-camera-rig.js'),
  read('js/gameplay/checkpoint-route.js')
].join('\n');
const modules=vm.runInNewContext(code+
  '\n({DriverArcadePhysics,DriverCameraRig,DriverCheckpointRoute})',
  {Math,THREE:{MathUtils:{clamp:(v,l,h)=>Math.max(l,Math.min(h,v))}}});
const {DriverArcadePhysics:Physics,DriverCameraRig:Camera,DriverCheckpointRoute:Route}=modules;

function car(style='muscle',heading=0,speed=10) {
  return {
    bodyStyle:style,heading,speed,lateralVelocity:0,maxSpeed:55,
    accel:30,damage:0,steerAngle:0,wheelSpin:0,
    pitchAngle:0,rollAngle:0,chassisTilt:{rotation:{x:0,z:0}}
  };
}
test('direção para esquerda e direita tem sinais corretos',()=>{
  const a=car(),b=car();
  Physics.update(a,1/60,1,-1,false,false);
  Physics.update(b,1/60,1,1,false,false);
  assert.ok(a.heading<0);
  assert.ok(b.heading>0);
});
test('sem aceleração o carro perde velocidade suavemente',()=>{
  const a=car();
  Physics.update(a,1/60,0,0,false,false);
  assert.ok(a.speed<10 && a.speed>0);
});
test('freio reduz velocidade; ré inverte depois de parar',()=>{
  const a=car('muscle',0,9);
  for(let i=0;i<70;i++)Physics.update(a,1/60,-1,0,false,false);
  assert.ok(a.speed<0);
});
test('derrapagem com freio de mão recebe velocidade lateral',()=>{
  const a=car('muscle',0,26);
  Physics.update(a,1/60,0,1,true,false);
  assert.ok(Math.abs(a.lateralVelocity)>0.01);
  assert.equal(a.isDrifting,true);
});
test('colisão frontal usa velocidade relativa e resposta de massa',()=>{
  const sedan=car('muscle',0,20),bus=car('bus',Math.PI,20);
  const impact=Physics.resolveImpact(sedan,bus,0,1);
  assert.ok(impact>39);
  assert.ok(Math.abs(sedan.speed-20)>Math.abs(bus.speed-20));
});
test('carros na mesma direção e velocidade não recebem impulso',()=>{
  const a=car('muscle',0,20),b=car('truck',0,20);
  assert.equal(Physics.resolveImpact(a,b,0,1),0);
  assert.equal(a.speed,20);
});
test('parâmetros permanecem finitos em passo dt zero',()=>{
  const a=car();
  Physics.update(a,0,0,0,false,false);
  assert.ok(Number.isFinite(a.heading)&&Number.isFinite(a.speed));
});
test('câmera aumenta FOV progressivamente com velocidade',()=>{
  const pos={x:0,y:0,z:0,heading:0};
  const slow=Camera.targetPosition(pos,car('muscle',0,0),'driving',0,false);
  const fast=Camera.targetPosition(pos,car('muscle',0,55),'driving',0,false);
  assert.ok(fast.fov>slow.fov);
  assert.ok(fast.location.z<slow.location.z);
});
test('câmera recua menos quando há prédio no caminho',()=>{
  const ratio=Camera.visibleDistance({isPointBlocked:(x,z)=>z < -6},
    {x:0,y:1,z:0},{x:0,y:4,z:-12});
  assert.ok(ratio>0 && ratio<1);
});
test('vista pelo capô continua à frente do veículo',()=>{
  const view=Camera.targetPosition({x:0,y:0,z:0,heading:0},
    car('muscle',0,24),'driving',1,false);
  assert.ok(view.location.z>0 && view.focus.z>view.location.z);
  assert.equal(view.instant,true);
});
test('checkpoints só deixam visível o próximo portão',()=>{
  const markers=[
    {x:0,z:0,collected:false,mesh:{visible:true}},
    {x:20,z:0,collected:false,mesh:{visible:true}}
  ];
  Route.refresh('checkpoints',markers);
  assert.equal(markers[0].mesh.visible,true);
  assert.equal(markers[1].mesh.visible,false);
  assert.equal(Route.findReached('checkpoints',markers,20,0),null);
  markers[0].collected=true;
  Route.refresh('checkpoints',markers);
  assert.equal(markers[1].mesh.visible,true);
  assert.equal(Route.findReached('checkpoints',markers,20,0),markers[1]);
});
test('missão livre não força ordem dos marcadores',()=>{
  const markers=[{x:0,z:0,collected:false},{x:20,z:0,collected:false}];
  assert.equal(Route.findReached('freeroam',markers,20,0),markers[1]);
});
