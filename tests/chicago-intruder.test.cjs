'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const sources=[
  'js/physics/arcade-dynamics.js',
  'js/police/pursuit-tactics.js',
  'js/gameplay/tailing-drop.js',
  'js/gameplay/chicago-intruder.js',
  'js/traffic/traffic-ai.js'
].map(read).join('\n');
const {Physics,Intruder,Traffic}=vm.runInNewContext(sources+
  '\n({Physics:DriverArcadePhysics,Intruder:DriverIntruderPursuit,Traffic:DriverTrafficAI})',{
  Math,THREE:{MathUtils:{clamp:(v,min,max)=>Math.max(min,Math.min(max,v))}}
});
const city={
  roadExtent:320,worldLimit:410,isTrafficGreen:()=>true,
  isPointBlocked(x,z,r=2){
    if(Math.abs(x)>410||Math.abs(z)>410)return true;
    if(z>33.5&&z<66.5&&Math.abs(x)>=11)return true;
    for(let bx=-320;bx<=320;bx+=80)
      for(let bz=-320;bz<=320;bz+=80){
        const cx=bx+40,cz=bz-40;
        if(Math.abs(cz-50)<28 || (cx===200&&cz===-200))continue;
        if(x+r>cx-19.2&&x-r<cx+19.2&&
           z+r>cz-19.2&&z-r<cz+19.2)return true;
      }
    return false;
  }
};
function car(){
  return {x:-80,z:-36,heading:0,speed:0,maxSpeed:51,accel:29,
    damage:0,lateralVelocity:0,wheelSpin:0,steerAngle:0,pitchAngle:0,
    rollAngle:0,bodyStyle:'muscle',isTarget:true,
    chassisTilt:{rotation:{x:0,z:0}}};
}
function player(x=-84,z=-100,speed=18){return{x,z,speed,heading:0};}
function run(m,target,p,dt,n,mode='driving'){
  let last;
  for(let i=0;i<n;i++)last=m.update(dt,p,target,mode);
  return last;
}
test('intruso aguarda 7 segundos na cena de abertura',()=>{
 const target=car();Intruder.attach(target);
 assert.equal(target.scriptedDrive.waitSeconds,7);
 assert.equal(target.scriptedDrive.done,false);
 assert.equal(target.scriptedDrive.index,0);
});
test('o roteiro do invasor termina no pátio industrial existente',()=>{
 const target=car();Intruder.attach(target);
 const points=target.scriptedDrive.waypoints;
 assert.equal(points.length,8);
 assert.equal(points[points.length-1].x,200);
 assert.equal(points[points.length-1].z,-160);
});
test('a IA mantém o carro parado antes de iniciar perseguição',()=>{
 const target=car();Intruder.attach(target);
 const ai=new Traffic(city);
 const old=target.scriptedDrive.index;
 const input=ai.getInput(target,.05,[target],player(),0);
 assert.equal(input.up,false);
 assert.equal(target.scriptedDrive.index,old);
 assert.ok(target.scriptedDrive.waitSeconds<7);
});
test('espera respeita delta máximo do motor e não pula imediatamente',()=>{
 const target=car();Intruder.attach(target);
 const ai=new Traffic(city);
 ai.getInput(target,10,[target],player(),0);
 assert.ok(target.scriptedDrive.waitSeconds>=6.94);
});
test('a espera não afeta carros civis sem rota roteirizada',()=>{
 const code=read('js/traffic/traffic-ai.js');
 assert.match(code,/if\(scripted && scripted\.waitSeconds>0\)/);
 assert.match(code,/return \{\s*up:false,down:car\.speed>1/);
});
test('o diretor só começa a perseguição quando o carro parte',()=>{
 const m=new Intruder(),target=car();Intruder.attach(target);
 assert.equal(m.update(.05,player(),target).phase,'opening');
 target.scriptedDrive.waitSeconds=0;
 assert.equal(m.update(.05,player(),target).phase,'chase');
});
test('seguir o carro perto mantém a perda de contato zerada',()=>{
 const m=new Intruder(),target=car();Intruder.attach(target);
 target.scriptedDrive.waitSeconds=0;
 const info=run(m,target,player(-80,-92),.05,110);
 assert.equal(info.phase,'chase');
 assert.equal(info.lostSeconds,0);
 assert.equal(info.failed,null);
});
test('se Tanner ficar mais de seis segundos longe o invasor foge',()=>{
 const m=new Intruder(),target=car();Intruder.attach(target);
 target.scriptedDrive.waitSeconds=0;
 const info=run(m,target,player(-290,-290),.05,130);
 assert.equal(info.failed,'lost');
 assert.equal(info.complete,false);
});
test('voltar a se aproximar reduz o risco de perda',()=>{
 const m=new Intruder(),target=car();Intruder.attach(target);
 target.scriptedDrive.waitSeconds=0;
 run(m,target,player(-290,-290),.05,30);
 const old=m.lostSeconds;
 run(m,target,player(-80,-50),.05,16);
 assert.ok(m.lostSeconds<old);
});
test('danificar totalmente o carro do invasor não completa a missão',()=>{
 const m=new Intruder(),target=car();Intruder.attach(target);
 target.damage=100;target.scriptedDrive.waitSeconds=0;
 const r=m.update(.05,player(),target);
 assert.equal(r.failed,'wrecked');
 assert.equal(r.complete,false);
});
test('chegada ao pátio é identificada somente após cumprir a rota',()=>{
 const m=new Intruder(),target=car();Intruder.attach(target);
 target.scriptedDrive.done=true;
 const r=m.update(.05,player(),target);
 assert.equal(r.phase,'yard');
 assert.equal(r.complete,false);
});
test('chegar de carro com velocidade elevada não desencadeia vitória',()=>{
 const m=new Intruder(),target=car();Intruder.attach(target);
 target.scriptedDrive.done=true;
 const r=m.update(.05,player(200,-160,35),target);
 assert.equal(r.phase,'yard');
 assert.equal(r.blockadeShown,false);
});
test('Tanner parado perto do depósito ativa emboscada da van',()=>{
 const m=new Intruder(),target=car();Intruder.attach(target);
 target.scriptedDrive.done=true;
 const r=m.update(.05,player(200,-160,0),target);
 assert.equal(r.phase,'blocked');
 assert.equal(r.blockadeShown,true);
 assert.equal(r.complete,false);
});
test('van amarela surge antes de completar a cena final',()=>{
 const m=new Intruder(),target=car();Intruder.attach(target);
 target.scriptedDrive.done=true;
 let r=m.update(.05,player(200,-160,0),target);
 for(let i=0;i<36;i++)r=m.update(.05,player(200,-160,0),target);
 assert.equal(r.complete,true);
 assert.equal(r.phase,'blocked');
});
test('ficar sem seguir o invasor ao pátio provoca fracasso após 20s',()=>{
 const m=new Intruder(),target=car();Intruder.attach(target);
 target.scriptedDrive.done=true;
 const r=run(m,target,player(),.05,410);
 assert.equal(r.failed,'left_behind');
 assert.equal(r.complete,false);
});
test('o intervalo do relógio é limitado em frames atrasados',()=>{
 const m=new Intruder(),target=car();Intruder.attach(target);
 target.scriptedDrive.waitSeconds=0;
 const r=m.update(500,player(),target);
 assert.equal(r.phase,'chase');
 assert.equal(r.lostSeconds,0);
});
test('salvar e restaurar conserva fase, rota e contadores',()=>{
 const m=new Intruder(),target=car();Intruder.attach(target);
 target.scriptedDrive.index=4;
 target.scriptedDrive.waitSeconds=1.8;
 m.phase='chase';m.lostSeconds=2.5;
 const snap=m.export(target);
 const restore=new Intruder(),fresh=car();Intruder.attach(fresh);
 restore.restore(snap,fresh);
 assert.equal(restore.phase,'chase');
 assert.equal(restore.lostSeconds,2.5);
 assert.equal(fresh.scriptedDrive.index,4);
 assert.equal(fresh.scriptedDrive.waitSeconds,1.8);
});
test('estado malformado do save não injeta NaN nos controles',()=>{
 const m=new Intruder(),target=car();Intruder.attach(target);
 m.restore({phase:'invalid',lostSeconds:999,
   yardSeconds:NaN,captureSeconds:-20,routeIndex:999,waitSeconds:NaN},target);
 assert.equal(m.phase,'opening');
 assert.equal(m.lostSeconds,6);
 assert.equal(m.yardSeconds,0);
 assert.equal(m.captureSeconds,0);
 assert.equal(target.scriptedDrive.index,target.scriptedDrive.waypoints.length);
 assert.equal(target.scriptedDrive.waitSeconds,0);
});
test('o modelo do carro deixa a pintura preta controlável',()=>{
 const vehicle=read('js/vehicles/driver-vehicle.js');
 const engine=read('js/engine/driver2-game-engine.js');
 assert.match(vehicle,/setPaintColor\(hex\)/);
 assert.match(engine,/this\.playerCar\.setPaintColor\(0x111827\)/);
 assert.match(engine,/VAN AMARELA/);
});
test('UI e motor apresentam a sexta missão após a quinta',()=>{
 const html=read('index.html'),engine=read('js/engine/driver2-game-engine.js');
 assert.ok(html.indexOf('CHICAGO 06')>html.indexOf('CHICAGO 05'));
 assert.match(html,/id="d2-start-story"/);
    assert.match(read('js/gameplay/campaign-flow.js'), /'story_intruder'/);
    assert.match(read('js/engine/driver2-game-engine.js'), /activateNearbyMission\(\)/);
 assert.match(engine,/this\.intruderDirector\.update\(/);
 assert.match(engine,/this\.spawnIntruderBlocker\(\)/);
});
test('scripts do perseguidor carregam antes da IA e da engine',()=>{
 const html=read('index.html');
 const scripts=[...html.matchAll(/src="\.\/(js\/[^"?]+\.js)(?:\?[^"]*)?"/g)].map(x=>x[1]);
 assert.ok(scripts.indexOf('js/gameplay/chicago-intruder.js')>0);
 assert.ok(scripts.indexOf('js/gameplay/chicago-intruder.js')<
   scripts.indexOf('js/traffic/traffic-ai.js'));
 assert.ok(scripts.indexOf('js/traffic/traffic-ai.js')<
   scripts.indexOf('js/engine/driver2-game-engine.js'));
});
test('save doméstico suporta rota e emboscada da missão 06',()=>{
 const src=read('js/gameplay/home-save.js');
 assert.match(src,/story_intruder/);
 assert.match(src,/intruderDirector\.export\(game\.targetCar\)/);
 assert.match(src,/intruderDirector\.restore\(data\.intruder,game\.targetCar\)/);
});
test('IA atravessa a rota corrigida em menos de 60 segundos sem colisões',()=>{
 const target=car();Intruder.attach(target);
 const ai=new Traffic(city);
 let collisions=0,elapsed=0;
 for(let i=0;i<5000&&!target.scriptedDrive.done;i++){
   const dt=1/60;
   const input=ai.getInput(target,dt,[target],null,0);
   const steering=input.left?-1:input.right?1:0;
   Physics.update(target,dt,input.up?1:input.down?-1:0,
     steering,input.handbrake,input.sprint);
   const vv=Physics.velocity(target);
   const nextX=target.x+vv.x*dt,nextZ=target.z+vv.z*dt;
   if(city.isPointBlocked(nextX,nextZ,1.7)){collisions++;target.speed=0;}
   else{target.x=nextX;target.z=nextZ;}
   elapsed+=dt;
 }
 assert.equal(target.scriptedDrive.done,true);
 assert.equal(collisions,0);
 assert.ok(elapsed<60);
 assert.ok(Intruder.isAtYard(target,23));
});
