'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const Escape=vm.runInNewContext(
  read('js/gameplay/safehouse-escape.js')+'\nDriverSafeHouseEscape',{Math});
const KEY='story_safehouse';
function state(overrides={}){
 return {position:{x:165,z:-145},safeHouseZone:{x:-120,z:-101,radius:5.5},
   felony:90,policeWatching:true,mode:'driving',speed:20,interiorId:null,
   ...overrides};
}
function secure(mission,overrides={}){
 const clear=state({felony:18,policeWatching:false,...overrides});
 let result=null;
 for(let i=0;i<114;i++)result=mission.update(.05,clear);
 return result;
}
test('missão começa com cerco ativo e sem progresso de fuga',()=>{
 const m=new Escape(),result=m.update(.016,state());
 assert.equal(result.phase,'escape');
 assert.equal(result.completed,false);
 assert.equal(result.hiddenSeconds,0);
 assert.equal(result.policeWatching,true);
});
test('visão policial detecta aproximação apenas de viaturas',()=>{
 const player={x:0,z:0};
 const cars=[{x:12,z:12,isPolice:true},{x:1,z:1,isPolice:false}];
 assert.equal(Escape.policeHasSight(cars,player,()=>true),true);
 assert.equal(Escape.policeHasSight(cars,player,()=>false),false);
});
test('viaturas muito distantes não mantêm observação visual',()=>{
 const cars=[{x:160,z:0,isPolice:true}];
 assert.equal(Escape.policeHasSight(cars,{x:0,z:0},()=>true),false);
});
test('uma viatura que vê o jogador impede início da contagem',()=>{
 const m=new Escape();
 for(let i=0;i<200;i++)m.update(.05,state({felony:0,policeWatching:true}));
 assert.equal(m.hiddenSeconds,0);
 assert.equal(m.phase,'escape');
});
test('perder a visão ainda exige delito abaixo do limiar',()=>{
 const m=new Escape();
 const result=secure(m,{felony:70});
 assert.equal(result.phase,'escape');
 assert.equal(result.completed,false);
});
test('sem viaturas e com delito baixo exige 5,5 segundos',()=>{
 const m=new Escape(),s=state({felony:18,policeWatching:false});
 for(let i=0;i<109;i++)m.update(.05,s);
 assert.equal(m.phase,'escape');
 m.update(.05,s);
 assert.equal(m.phase,'reach_home');
 assert.equal(m.hiddenSeconds,5.5);
});
test('saltos grandes de delta não liberam fuga instantaneamente',()=>{
 const m=new Escape();
 m.update(10000,state({felony:0,policeWatching:false}));
 assert.ok(m.hiddenSeconds<=0.05);
 assert.equal(m.phase,'escape');
});
test('se a polícia reaparecer, a vigilância recomeça',()=>{
 const m=new Escape();secure(m);
 m.update(.05,state({felony:18,policeWatching:true}));
 assert.equal(m.phase,'escape');
 assert.equal(m.hiddenSeconds,0);
});
test('mesmo sem policiais, chegar com delito alto não conclui',()=>{
 const m=new Escape();
 const near=state({position:{x:-120,z:-101},speed:0,felony:80,policeWatching:false});
 for(let i=0;i<130;i++)m.update(.05,near);
 assert.equal(m.phase,'escape');
 assert.equal(m.update(.05,near).completed,false);
});
test('fuga completada, mas fora da casa, não dá vitória',()=>{
 const m=new Escape();
 const result=secure(m);
 assert.equal(result.phase,'reach_home');
 assert.equal(result.completed,false);
 assert.ok(result.distance>200);
});
test('não vence passando em frente à casa em alta velocidade',()=>{
 const m=new Escape();secure(m);
 const result=m.update(.05,state({position:{x:-120,z:-101},
   felony:8,policeWatching:false,speed:33}));
 assert.equal(result.atHome,true);
 assert.equal(result.completed,false);
});
test('parar o carro no marcador após despistar conclui',()=>{
 const m=new Escape();secure(m);
 const result=m.update(.05,state({position:{x:-120,z:-101},
   felony:8,policeWatching:false,speed:0}));
 assert.equal(result.completed,true);
});
test('porta da casa conta quando Tanner entra a pé após despistar',()=>{
 const m=new Escape();secure(m);
 const result=m.update(.05,state({position:{x:1000,z:-6},
   felony:8,policeWatching:false,mode:'on_foot',speed:0,interiorId:'home'}));
 assert.equal(result.completed,true);
});
test('entrar em outro edifício não encerra o objetivo da casa',()=>{
 const m=new Escape();secure(m);
 const result=m.update(.05,state({position:{x:1180,z:-6},
   felony:8,policeWatching:false,mode:'on_foot',interiorId:'garage'}));
 assert.equal(result.completed,false);
});
test('a saída lateral do jogador não pode atravessar o gatilho a 15m',()=>{
 const m=new Escape();secure(m);
 const result=m.update(.05,state({position:{x:-105,z:-101},
   felony:8,policeWatching:false,speed:0}));
 assert.equal(result.completed,false);
});
test('snapshot da fase tem tamanho pequeno e é restaurável',()=>{
 const m=new Escape();secure(m);
 const snapshot=m.export();
 const copy=new Escape();copy.restore(snapshot);
 assert.equal(copy.phase,'reach_home');
 assert.equal(copy.hiddenSeconds,5.5);
});
test('restaurar estado adulterado limita contagem e fase',()=>{
 const m=new Escape();
 m.restore({phase:'reach_home',hiddenSeconds:5000});
 assert.equal(m.hiddenSeconds,5.5);
 m.restore({phase:'hack',hiddenSeconds:-30});
 assert.equal(m.phase,'escape');
 assert.equal(m.hiddenSeconds,0);
});
test('o save admite missão 5 e persiste progresso da fuga',()=>{
 const source=read('js/gameplay/home-save.js');
 assert.match(source,/story_safehouse/);
 assert.match(source,/safeEscape:game\.missionType==='story_safehouse'/);
 assert.match(source,/game\.safeHouseEscape\.restore\(data\.safeEscape\)/);
});
test('a UI inicia missão em Chicago e aponta entrada da casa',()=>{
 const engine=read('js/engine/driver2-game-engine.js'),html=read('index.html');
 assert.match(engine,/type === 'story_safehouse'/);
 assert.match(engine,/ESCAPE TO THE SAFE HOUSE/);
 assert.match(engine,/this\.city\.safeHouseZone/);
 assert.match(engine,/this\.safeHouseEscape\.update/);
 assert.match(html,/id="d2-start-story"/);
    assert.match(read('js/gameplay/campaign-flow.js'), /'story_safehouse'/);
    assert.match(read('js/engine/driver2-game-engine.js'), /activateNearbyMission\(\)/);
});
test('módulo da missão está carregado antes da engine',()=>{
 const html=read('index.html');
 const scripts=[...html.matchAll(/src="\.\/(js\/[^"?]+\.js)(?:\?[^"]*)?"/g)].map(x=>x[1]);
 assert.ok(scripts.indexOf('js/gameplay/safehouse-escape.js')>=0);
 assert.ok(scripts.indexOf('js/gameplay/safehouse-escape.js')<
   scripts.indexOf('js/engine/driver2-game-engine.js'));
});
test('HUD da missão apresenta visão, delito e progresso da fuga',()=>{
 const html=read('index.html'),engine=read('js/engine/driver2-game-engine.js');
 for(const id of ['safehouse-escape-progress','safehouse-hidden-fill',
   'safehouse-phase','safehouse-distance'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(engine,/LOST_SIGHT_SECONDS/);
 assert.match(engine,/safeHouseStatus/);
});

test('ao vencer, botão permite ir diretamente à casa e manter conquista',()=>{
 const engine=read('js/engine/driver2-game-engine.js');
 const html=read('index.html');
 assert.match(html,/id="btn-continue-safehouse"/);
 assert.match(engine,/completedMissions\.has\('story_safehouse'\)/);
 assert.match(engine,/tanner\.setPosition\(house\.x,0,house\.z\+4/);
 assert.match(engine,/continueHome\.classList\.toggle\('hidden'/);
});
test('perder policiais atrás de prédio reduz delito mesmo perto',()=>{
 const code=read('js/engine/driver2-game-engine.js');
 assert.match(code,/if\(!watch && this\.felony>0\)/);
 assert.match(code,/this\.felony=Math\.max\(0,this\.felony-5\.2\*dt\)/);
});
test('casa segura tem varanda, marquise, pilares e caixa de correio',()=>{
 const city=read('js/world/city-builder.js');
 assert.match(city,/const walkway=new THREE\.Mesh/);
 assert.match(city,/const awning=new THREE\.Mesh/);
 assert.match(city,/const mailbox=new THREE\.Mesh/);
});
