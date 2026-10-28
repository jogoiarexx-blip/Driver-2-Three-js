'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const context = {
  Math,
  THREE: { MathUtils: { clamp: (x,min,max) => Math.max(min,Math.min(max,x)) } }
};
const Visual = vm.runInNewContext(
  read('js/render/vehicle-damage-fx.js') + '\n' +
  read('js/render/vehicle-visuals.js') + '\nVehicleVisuals;', context);
const Traffic = vm.runInNewContext(
  read('js/police/pursuit-tactics.js') + '\n' +
  read('js/traffic/traffic-ai.js') + '\nDriverTrafficAI;', context);
const Route = vm.runInNewContext(
  read('js/gameplay/checkpoint-route.js') + '\nDriverCheckpointRoute;', context);

function vehicle(speed = 22) {
  const v = {
    speed, headlightsOn:false, motionClock:0,
    _suspensionBaseY:0, brakeLightsOn:false,
    headlightBeams:{visible:false},
    chassisTilt:{position:{y:0}},
    wheels:Array.from({length:4},()=>({position:{y:0.44}})),
    headlightMaterial:{color:{setHex(n){v.frontColor=n;}}},
    tailMaterial:{color:{setHex(n){v.rearColor=n;}}}
  };
  return v;
}
function car(x=0,z=0,heading=0,speed=20) {
  return {x,z,heading,speed,maxSpeed:55,accel:31,lateralVelocity:0,
    bodyStyle:'muscle',isPolice:false,isTarget:false};
}
function world() {
  return {isPointBlocked:()=>false,isTrafficGreen:()=>true};
}

test('faróis ligam e desligam por comando sem recriar o carro',()=>{
  const v=vehicle();
  Visual.setHeadlights(v,true);
  assert.equal(v.headlightsOn,true);
  assert.equal(v.headlightBeams.visible,true);
  assert.equal(v.frontColor,0xfff6bf);
  Visual.setHeadlights(v,false);
  assert.equal(v.frontColor,0x605735);
  assert.equal(v.headlightBeams.visible,false);
});
test('frear acende luzes de freio de modo dinâmico',()=>{
  const v=vehicle(24);
  Visual.update(v,1/60,{down:true,handbrake:false});
  assert.equal(v.brakeLightsOn,true);
  assert.equal(v.rearColor,0xff293c);
  Visual.update(v,1/60,{down:false,handbrake:false});
  assert.equal(v.brakeLightsOn,false);
  assert.equal(v.rearColor,0x52151a);
});
test('freio de mão em movimento acende as lanternas',()=>{
  const v=vehicle(25);
  Visual.update(v,1/60,{down:false,handbrake:true});
  assert.equal(v.brakeLightsOn,true);
});
test('suspensão permanece em amplitude pequena a 60 fps',()=>{
  const v=vehicle(40);
  for(let i=0;i<600;i++)Visual.update(v,1/60,{down:false,handbrake:false});
  assert.ok(Math.abs(v.chassisTilt.position.y)<0.10);
  assert.ok(v.wheels.every(w=>Math.abs(w.position.y-0.44)<0.035));
});
test('suspensão retorna ao centro quando o carro para',()=>{
  const v=vehicle(45);
  for(let i=0;i<40;i++)Visual.update(v,1/60,{down:false,handbrake:false});
  v.speed=0;
  for(let i=0;i<50;i++)Visual.update(v,1/60,{down:false,handbrake:false});
  assert.ok(Math.abs(v.chassisTilt.position.y)<0.001);
});
test('viatura reduz velocidade diante de curva fechada',()=>{
  const v=car(0,0,0,30);v.isPolice=true;
  const controls=new Traffic(world()).getInput(
    v,1/60,[v],{x:55,z:0,heading:0,speed:0},90);
  assert.equal(controls.down,true);
  assert.equal(controls.right,true);
  assert.equal(v.sirenActive,true);
});
test('tráfego comum continua acelerando em linha reta',()=>{
  const v=car(4,-114,0,10);
  const input=new Traffic(world()).getInput(v,1/60,[v],null,0);
  assert.equal(input.up,true);
});
test('dossiês são coletados estritamente na ordem',()=>{
  const markers=[
    {x:0,z:0,collected:false,mesh:{visible:true}},
    {x:80,z:-80,collected:false,mesh:{visible:true}},
    {x:80,z:0,collected:false,mesh:{visible:true}}
  ];
  Route.refresh('evidence',markers);
  assert.equal(markers[0].mesh.visible,true);
  assert.equal(markers[1].mesh.visible,false);
  assert.equal(Route.findReached('evidence',markers,80,-80),null);
  markers[0].collected=true;
  Route.refresh('evidence',markers);
  assert.equal(Route.findReached('evidence',markers,80,-80),markers[1]);
});
test('modelo 3D personalizado pode ser substituído sem perder proteção do cache',()=>{
  const code=read('js/vehicles/driver-vehicle.js');
  assert.match(code,/\(this\._userCustomModel && shared\)/);
  assert.match(code,/preserved = \[this\.sirenAssembly, this\.targetMarker, this\.lightsGroup, this\.damageGroup\]/);
  assert.match(code,/obj\.userData\.cc0SharedAsset = shared/);
});
test('missão 7 e botão de faróis estão vinculados ao jogo',()=>{
  const engine=read('js/engine/driver2-game-engine.js');
  const html=read('index.html');
  assert.match(engine,/this\.missionType === 'evidence'/);
  assert.match(engine,/togglePlayerHeadlights\(\)/);
  assert.match(html,/startMission\('evidence'\)/);
  assert.match(html,/id="btn-headlights"/);
});
