'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const Director=vm.runInNewContext(read('js/gameplay/leaving-chicago.js')+
  '\nDriverLeavingChicago',{Math});
const base={position:{x:0,z:-240},mode:'driving',speed:0,timeLeft:100,damage:0};
const args=(extra={})=>({...base,...extra});
const input=(m,obj={},n=1)=>{let r;for(let i=0;i<n;i++)r=m.update(.05,args(obj));return r;};
test('oito missões de Chicago são exibidas na campanha',()=>{
 const html=read('index.html');
 for(let i=1;i<=8;i++)assert.match(html,new RegExp('CHICAGO 0'+i));
});
test('Leaving Chicago começa em Wicker Park e termina na estação',()=>{
 assert.equal(Director.START.x,-240);
 assert.equal(Director.START.z,160);
 assert.equal(Director.STATION.x,0);
 assert.equal(Director.STATION.z,-240);
});
test('limite de 3 minutos e 30 segundos reproduz tempo original',()=>{
 assert.equal(Director.LIMIT,210);
 const engine=read('js/engine/driver2-game-engine.js');
 assert.match(engine,/this\.missionTimeLeft=DriverLeavingChicago\.LIMIT/);
});
test('a estação detecta chegada pela distância real',()=>{
 assert.equal(Director.insideStation({x:0,z:-240}),true);
 assert.equal(Director.insideStation({x:0,z:-223}),true);
 assert.equal(Director.insideStation({x:30,z:-240}),false);
});
test('chegada em alta velocidade não completa o encontro',()=>{
 const d=new Director();
 const v=input(d,{speed:26},20);
 assert.equal(v.completed,false);
 assert.equal(d.arrivalSeconds,0);
});
test('Tanner a pé não completa objetivo que exige conduzir',()=>{
 const d=new Director();
 const v=input(d,{mode:'on_foot'},20);
 assert.equal(v.completed,false);
});
test('parar no marcador inicia a reunião com Tobias Jones',()=>{
 const d=new Director();
 const s=d.update(.05,args());
 assert.equal(s.phase,'reunion');
 assert.equal(s.completed,false);
 assert.ok(s.arrivalSeconds>0);
});
test('encontro com Jones conclui após 0.65 segundos parado',()=>{
 const d=new Director();const s=input(d,{},14);
 assert.equal(s.completed,true);
 assert.equal(s.phase,'done');
 assert.equal(s.progress,1);
 assert.equal(s.arrivalSeconds,.65);
});
test('afastar-se reinicia espera da reunião',()=>{
 const d=new Director();
 input(d,{},7);
 assert.ok(d.arrivalSeconds>.25);
 input(d,{position:{x:25,z:-240}},1);
 assert.equal(d.arrivalSeconds,0);
 assert.equal(d.phase,'drive');
});
test('relógio zerado é derrota, não vitória',()=>{
 const d=new Director(),s=input(d,{timeLeft:0});
 assert.equal(s.failed,'timeout');
 assert.equal(s.completed,false);
});
test('carro com 100 de dano falha mesmo dentro da estação',()=>{
 const d=new Director(),s=input(d,{damage:100});
 assert.equal(s.failed,'destroyed');
 assert.equal(s.completed,false);
});
test('uma derrota não vira vitória em quadros seguintes',()=>{
 const d=new Director();input(d,{damage:100});
 const s=input(d,{},40);
 assert.equal(s.completed,false);
 assert.equal(s.failed,'destroyed');
});
test('delta-time muito grande não causa vitória imediata',()=>{
 const d=new Director();d.update(250,args());
 assert.equal(d.completed,false);
 assert.ok(d.arrivalSeconds<=.05);
});
test('save e load recuperam progresso parcialmente acumulado',()=>{
 const d=new Director();input(d,{},5);
 const r=new Director();r.restore(d.export());
 assert.equal(r.arrivalSeconds,d.arrivalSeconds);
 assert.equal(r.phase,'reunion');
});
test('save adulterado não injeta NaN nem altera estado inesperado',()=>{
 const d=new Director();
 d.restore({phase:'bad',arrivalSeconds:Infinity});
 assert.equal(d.arrivalSeconds,0);
 assert.equal(d.phase,'drive');
 d.restore({phase:'reunion',arrivalSeconds:99});
 assert.equal(d.arrivalSeconds,.65);
 assert.equal(d.completed,false);
});
test('vitória persistida mantém progresso máximo',()=>{
 const d=new Director();
 d.restore({phase:'done',completed:true,arrivalSeconds:-3});
 assert.equal(d.completed,true);
 assert.equal(d.arrivalSeconds,.65);
});
test('reiniciar zera estado da missão',()=>{
 const d=new Director();input(d,{},16);d.reset();
 assert.equal(d.completed,false);
 assert.equal(d.arrivalSeconds,0);
 assert.equal(d.failed,null);
});
test('Carros da máfia não exigem delito para perseguir Tanner',()=>{
 const all=['js/police/pursuit-tactics.js','js/gameplay/tailing-drop.js',
  'js/traffic/traffic-ai.js'].map(read).join('\n');
 const AI=vm.runInNewContext(all+'\nDriverTrafficAI',{
  Math,THREE:{MathUtils:{clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}}
 });
 const city={roadExtent:320,isPointBlocked:()=>false,isTrafficGreen:()=>true};
 const ai=new AI(city);
 const car={x:-240,z:224,speed:0,heading:Math.PI,isMafia:true,isPolice:false,
    bodyStyle:'muscle'};
 const ctl=ai.getInput(car,.016,[car],{x:-240,z:160},0);
 assert.equal(ctl.up,true);
 assert.equal(car.sirenActive,false);
});
test('Trânsito normal não recebe sinalizador de máfia',()=>{
 const source=read('js/traffic/traffic-ai.js');
 assert.match(source,/const hostile = !!car\.isMafia/);
 assert.match(source,/const pursuing = wanted \|\| hostile/);
 assert.match(source,/car\.sirenActive = wanted && !hostile/);
});
test('a rota do jogador até a estação é transitável sem atravessar prédios',()=>{
 const modules=['js/physics/arcade-dynamics.js',
 'js/police/pursuit-tactics.js','js/gameplay/tailing-drop.js',
 'js/traffic/traffic-ai.js'].map(read).join('\n');
 const ctx={Math,THREE:{MathUtils:{clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}}};
 const {Physics,AI}=vm.runInNewContext(modules+
  '\n({Physics:DriverArcadePhysics,AI:DriverTrafficAI})',ctx);
 const city={
  roadExtent:320,worldLimit:410,isTrafficGreen:()=>true,
  isPointBlocked(x,z,r=1.7){
   if(Math.abs(x)>410||Math.abs(z)>410)return true;
   if(z>33.5&&z<66.5&&Math.abs(x)>=11)return true;
   for(let bx=-320;bx<=320;bx+=80)
    for(let bz=-320;bz<=320;bz+=80){
     const cx=bx+40,cz=bz-40;
     if(Math.abs(cz-50)<28||(cx===200&&cz===-200))continue;
     if(x+r>cx-19.2&&x-r<cx+19.2&&z+r>cz-19.2&&z-r<cz+19.2)return true;
    }
   return false;
  }
 };
 const car={x:-240,z:160,heading:Math.PI,speed:0,damage:0,
  maxSpeed:55,accel:31,lateralVelocity:0,wheelSpin:0,steerAngle:0,
  pitchAngle:0,rollAngle:0,chassisTilt:{rotation:{x:0,z:0}},
  bodyStyle:'muscle',isTarget:true,
  scriptedDrive:{waypoints:[
   {x:-160,z:160},{x:-80,z:160},{x:0,z:160},
   {x:0,z:80},{x:0,z:0},{x:0,z:-80},
   {x:0,z:-160},{x:0,z:-240}
  ],index:0,done:false,maxSpeed:33}};
 const ai=new AI(city),director=new Director();
 let collisions=0,finish=false,sec=0;
 for(let i=0;i<12600;i++){
  const dt=1/60,ctl=ai.getInput(car,dt,[car],null,0);
  Physics.update(car,dt,ctl.up?1:ctl.down?-1:0,
   ctl.left?-1:ctl.right?1:0,ctl.handbrake,ctl.sprint);
  const v=Physics.velocity(car),x=car.x+v.x*dt,z=car.z+v.z*dt;
  if(city.isPointBlocked(x,z,1.7)){collisions++;car.speed=0;}
  else{car.x=x;car.z=z;}
  const r=director.update(dt,{position:{x:car.x,z:car.z},
   mode:'driving',speed:car.scriptedDrive.done?0:car.speed,
   damage:0,timeLeft:210-i*dt});
  if(r.completed){finish=true;sec=i*dt;break;}
  // IA solta acelerador após último waypoint, e Tanner freia na estação.
  if(car.scriptedDrive.done)car.speed=0;
 }
 assert.equal(collisions,0);
 assert.equal(finish,true);
 assert.ok(sec<Director.LIMIT);
});
test('o novo modo permite continuar para Havana apenas após vitória',()=>{
 const js=read('js/engine/driver2-game-engine.js');
 const html=read('index.html');
 assert.match(js,/completedMissions\.has\('story_leaving'\)/);
 assert.match(js,/this\.requestCityChange\('havana'\)/);
 assert.match(js,/this\.startMission\('story_havana_lead'\)/);
 assert.match(html,/id="btn-continue-havana"/);
});
test('o save da casa reconhece a oitava missão',()=>{
 const js=read('js/gameplay/home-save.js');
 assert.match(js,/story_leaving/);
 assert.match(js,/game\.leavingDirector\.export\(\)/);
 assert.match(js,/game\.leavingDirector\.restore\(data\.leaving\)/);
});
test('o marcador da estação permanece até o encontro',()=>{
 const js=read('js/engine/driver2-game-engine.js');
 assert.match(js,/this\.missionType==='story_leaving'/);
});
test('o título de derrota por tempo não registra vitória falsa',()=>{
 const js=read('js/engine/driver2-game-engine.js');
 assert.match(js,/'TEMPO ESGOTADO!'/);
 assert.match(js,/!\/FALH\\|ESGOTAD\\|DESTRUÍDO/);
});
test('motor inclui chuva e alvo verde na oitava missão',()=>{
 const js=read('js/engine/driver2-game-engine.js');
 assert.match(js,/type==='story_leaving'/);
 assert.match(js,/this\.setWeather\('rain'\)/);
 assert.match(js,/this\.spawnLeavingJones\(\)/);
 assert.match(js,/this\.spawnChicagoMafia\(\)/);
});
test('script e tela do capítulo final carregam corretamente',()=>{
 const html=read('index.html');
 const deps=[...html.matchAll(/src="\.\/(js\/[^"?]+\.js)(?:\?[^"]*)?"/g)].map(m=>m[1]);
 assert.ok(deps.indexOf('js/gameplay/leaving-chicago.js')<
  deps.indexOf('js/engine/driver2-game-engine.js'));
 for(const id of ['leaving-chicago-progress','leaving-chicago-title',
  'leaving-chicago-fill','leaving-chicago-distance'])
  assert.match(html,new RegExp('id="'+id+'"'));
});
