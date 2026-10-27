'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const Save=vm.runInNewContext(
  read('js/gameplay/checkpoint-route.js')+'\n'+
  read('js/gameplay/home-save.js')+'\nDriverHomeSave',
  {Math,Date,JSON,Set}
);
const City=vm.runInNewContext(read('js/world/city-builder.js')+'\nCityBuilder',{Math});
const Route=vm.runInNewContext(read('js/gameplay/checkpoint-route.js')+'\nDriverCheckpointRoute',{Math});
function storage(){
  const data=new Map();
  return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
}
function playerVehicle(){
  return {x:-10,y:0,z:50,heading:1.2,speed:0,damage:25,
      damageZones:{front:30,rear:0,left:11,right:0},
      updateTransform(){this.updated=true;}};
}
function mockGame(){
  const car=playerVehicle();
  const target={...playerVehicle(),x:244,z:-240,damage:10,updateTransform(){this.updated=true;}};
  const house={
    id:'home',name:'Casa de Tanner',kind:'home',
    door:{x:-120,z:-101},inside:{x:1000,z:0},
    savePoint:{x:1000,z:4},exit:{x:1000,z:-8.8}
  };
  const game={
    currentCityKey:'chicago',weatherMode:'night',felony:27,mode:'on_foot',
    missionType:'story_tipoff',missionActive:true,missionTimeLeft:88,
    survivalElapsed:0,tailOutOfRangeTimer:0,witnessCloseTime:0,evidencePhase:0,
    pursuitChapter:{phase:0,elapsed:8},
    completedMissions:new Set(['story_witness']),
    city:{secretGateOpen:true,interiors:[house],
          unlockSecretGate(){this.secretGateOpen=true;}},
    interiorPlace:house,
    vehicles:[car,target],playerCar:car,
    tanner:{group:{position:{x:1000,y:0,z:4}},heading:0,
        setPosition(x,y,z,heading){this.group.position={x,y,z};this.heading=heading;},
        setVisible(visible){this.visible=visible;}},
    missionMarkers:[{collected:true,mesh:{visible:false}},{collected:false,mesh:{visible:true}}],
    c4State:{active:false,planted:false,timer:15},
    cameraRig:{lastMode:0,focus:{}},
    changeCity(id){
      assert.equal(this.missionType,'freeroam');
      this.currentCityKey=id;
      this.city={secretGateOpen:false,interiors:[house],
          unlockSecretGate(){this.secretGateOpen=true;}};
    },
    startMission(type){
      this.missionType=type;
      this.vehicles=[playerVehicle(),{...playerVehicle(),updateTransform(){this.updated=true;}}];
      this.playerCar=this.vehicles[0];
      this.missionMarkers=[{collected:false,mesh:{visible:true}},{collected:false,mesh:{visible:true}}];
      this.pursuitChapter={phase:0,elapsed:0};
      this.mode='driving';this.tanner.setVisible(false);
      this.missionActive=type!=='freeroam';
    },
    setWeather(value){this.weatherMode=value;}
  };
  return game;
}
test('arquivo salva um registro versionado recuperável após recriar gerenciador',()=>{
  const disk=storage(),a=new Save(disk);
  assert.equal(a.write(a.capture(mockGame())),true);
  const b=new Save(disk),loaded=b.read();
  assert.equal(loaded.version,1);
  assert.equal(loaded.city,'chicago');
  assert.equal(loaded.interior,'home');
  assert.equal(loaded.mission.type,'story_tipoff');
});
test('o save preserva progresso de missão, zonas de dano e local da casa',()=>{
  const snapshot=new Save(storage()).capture(mockGame());
  assert.equal(snapshot.vehicles[0].damageZones.front,30);
  assert.equal(snapshot.vehicles[0].damageZones.left,11);
  assert.equal(snapshot.mission.markers[0],true);
  assert.equal(snapshot.mission.timeLeft,88);
  assert.equal(snapshot.completed[0],'story_witness');
  assert.equal(snapshot.tanner.x,1000);
});
test('restauração recupera posição, carro, dano, missão e interior',()=>{
  const game=mockGame();
  const save=new Save(storage());
  const snapshot=save.capture(game);
  game.city.secretGateOpen=false;
  assert.equal(save.restore(game,snapshot),true);
  assert.equal(game.mode,'on_foot');
  assert.equal(game.interiorPlace.id,'home');
  assert.equal(game.tanner.group.position.x,1000);
  assert.equal(game.vehicles[0].damage,25);
  assert.equal(game.missionMarkers[0].collected,true);
  assert.equal(game.completedMissions.has('story_witness'),true);
  assert.equal(game.city.secretGateOpen,true);
});
test('troca de cidade no load não dispara novamente uma missão de Chicago',()=>{
  const game=mockGame(),save=new Save(storage());
  const snapshot=save.capture(game);
  snapshot.city='rio';snapshot.mission.type='freeroam';
  assert.equal(save.restore(game,snapshot),true);
  assert.equal(game.currentCityKey,'rio');
  assert.equal(game.missionType,'freeroam');
});
test('cartucho salvo inválido é rejeitado sem sobrescrever partida',()=>{
  const disk=storage(),save=new Save(disk),snapshot=save.capture(mockGame());
  snapshot.version=100;
  assert.equal(save.write(snapshot),false);
  assert.equal(save.read(),null);
});
test('JSON quebrado é detectado, sem derrubar o aplicativo',()=>{
  const disk=storage(),save=new Save(disk);
  disk.setItem(Save.KEY,'{broken');
  assert.equal(save.read(),null);
});
test('navegador com armazenamento bloqueado não relata save concluído',()=>{
  const save=new Save({setItem(){throw Error('quota');},getItem(){throw Error('security');}});
  assert.equal(save.write(save.capture(mockGame())),false);
  assert.equal(save.read(),null);
});
test('posição e dano adulterados são limitados no load',()=>{
  const game=mockGame(),save=new Save(storage());
  const snapshot=save.capture(game);
  snapshot.vehicles[0].x=999999;
  snapshot.vehicles[0].damage=180;
  snapshot.felony=999;
  assert.equal(save.restore(game,snapshot),true);
  assert.equal(game.vehicles[0].x,1500);
  assert.equal(game.vehicles[0].damage,100);
  assert.equal(game.felony,100);
});
test('sem casa e sem veículo não é um arquivo de save válido',()=>{
  const save=new Save(storage()),data=save.capture(mockGame());
  data.vehicles=[];
  assert.equal(save.valid(data),false);
});
function cityHarness(){
  const home={id:'home',door:{x:-120,z:-101},inside:{x:1000,z:0}};
  const warehouse={id:'warehouse',door:{x:200,z:-179},inside:{x:1050,z:0}};
  return {interiors:[home,warehouse],worldLimit:410,buildingBoxes:[],
      interiorArea:City.prototype.interiorArea};
}
test('portas da casa e do depósito são duas entradas independentes',()=>{
  const c=cityHarness();
  assert.equal(City.prototype.interiorAt.call(c,-120,-101).id,'home');
  assert.equal(City.prototype.interiorAt.call(c,200,-179).id,'warehouse');
  assert.equal(City.prototype.interiorAt.call(c,300,300),null);
});
test('limites do novo mapa permitem andar até os quarteirões externos',()=>{
  const c=cityHarness();
  assert.equal(City.prototype.isPointBlocked.call(c,360,280),false);
  assert.equal(City.prototype.isPointBlocked.call(c,415,0),true);
});
test('área interna é caminhável e paredes impedem sair fora do cômodo',()=>{
  const c=cityHarness();
  assert.equal(City.prototype.isPointBlocked.call(c,1000,0),false);
  assert.equal(City.prototype.isPointBlocked.call(c,1012,0),true);
  assert.equal(City.prototype.isPointBlocked.call(c,1050,-6),false);
});
test('canal permite queda pela abertura e só bloqueia onde há muro',()=>{
  const c=cityHarness();
  c.canalWallSegments=[
    {minX:11.5,maxX:225,z:34},
    {minX:255,maxX:427,z:34}
  ];
  assert.equal(City.prototype.isPointBlocked.call(c,35,50),false);
  assert.equal(City.prototype.isPointBlocked.call(c,35,34),true);
  assert.equal(City.prototype.isPointBlocked.call(c,240,34),false);
  assert.equal(City.prototype.isPointBlocked.call(c,0,50),false);
});
test('mais quarteirões e interiores estão ligados ao construtor',()=>{
  const src=read('js/world/city-builder.js');
  assert.match(src,/for\(let p=-320;p<=320;p\+=80\)/);
  assert.match(src,/buildInteriorRooms\(\)/);
  assert.match(src,/buildRegionalLandmark\(/);
  assert.match(src,/buildSafeHouseBlock\(/);
});
test('primeiras missões de Chicago seguem os objetivos originais adaptados',()=>{
  const game=read('js/engine/driver2-game-engine.js');
  assert.match(game,/story_tipoff/);
  assert.match(game,/story_witness/);
  assert.match(game,/this\.playerCar===this\.targetCar/);
  assert.match(game,/witnessCloseTime>=48/);
});
test('HTML tem os botões de entrada, save e retorno',()=>{
  const html=read('index.html');
  for(const id of ['btn-save-home','btn-leave-interior','btn-load-home','interior-banner'])
      assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/src="\.\/js\/gameplay\/home-save\.js"/);
});
test('interação exige proximidade real à mesa e preserva o local',()=>{
  const source=read('js/engine/driver2-game-engine.js');
  assert.match(source,/nearSaveDesk\(\)/);
  assert.match(source,/this\.homeSave\.write\(this\.homeSave\.capture\(this\)\)/);
  assert.match(source,/this\.interiorPlace=place/);
  assert.match(source,/this\.interiorPlace=null/);
});


test('viaturas podem perseguir nas novas bordas da cidade',()=>{
  const Tactics=vm.runInNewContext(
    read('js/police/pursuit-tactics.js')+'\nPolicePursuitTactics',{Math});
  const city={worldLimit:410,isPointBlocked:()=>false};
  assert.equal(Tactics.targetIsSafe(city,{x:310,z:-300}),true);
  assert.equal(Tactics.targetIsSafe(city,{x:415,z:0}),false);
  // Mundos legados sem limite explícito mantêm a fronteira anterior.
  assert.equal(Tactics.targetIsSafe({isPointBlocked:()=>false},{x:290,z:0}),false);
});
test('mapa geral pode ser ativado por tecla G e botão na interface',()=>{
  const source=read('js/engine/driver2-game-engine.js');
  const html=read('index.html');
  assert.match(source,/code === 'KeyG'/);
  assert.match(source,/toggleRadarZoom\(\)/);
  assert.match(source,/this\.radarWide \? 0\.16 : 0\.52/);
  assert.match(html,/id="btn-radar-zoom"/);
});
test('motor de interfaces leva Tanner para sala e de volta à porta real',()=>{
  const badge={textContent:''};
  const globals={
    window:{},
    document:{getElementById:()=>badge}
  };
  const Engine=vm.runInNewContext(
    read('js/engine/driver2-game-engine.js')+'\nDriver2GameEngine',globals);
  const place={id:'home',inside:{x:1000,z:0},
    door:{x:-120,z:-101},exit:{x:1000,z:-8.8}};
  const data={
    mode:'on_foot',interiorPlace:null,cameraRig:{lastMode:0,focus:{}},
    tanner:{setPosition(x,y,z,heading){this.pos={x,y,z,heading};}}
  };
  assert.equal(Engine.prototype.enterInterior.call(data,place),true);
  assert.equal(data.tanner.pos.x,1000);
  assert.equal(data.interiorPlace.id,'home');
  assert.equal(Engine.prototype.leaveInterior.call(data),true);
  assert.equal(data.interiorPlace,null);
  assert.equal(data.tanner.pos.x,-120);
});
test('HUD orienta salvar perto da mesa, sair perto da porta',()=>{
  const elements={
    'interaction-prompt':{classList:{remove(){}},textContent:''},
    'interior-banner':{classList:{toggle(){}}}
  };
  const Engine=vm.runInNewContext(
    read('js/engine/driver2-game-engine.js')+'\nDriver2GameEngine',
    {window:{},document:{getElementById:id=>elements[id]}}
  );
  const data={mode:'on_foot',interiorPlace:{
    id:'home',exit:{x:1000,z:-8.8},
    savePoint:{x:1000,z:4}
  },tanner:{group:{position:{x:1000,z:4}}},
  nearSaveDesk(){return this.tanner.group.position.z>0;}};
  Engine.prototype.updateInteriorHUD.call(data);
  assert.match(elements['interaction-prompt'].textContent,/salvar/);
  data.tanner.group.position.z=-8;
  Engine.prototype.updateInteriorHUD.call(data);
  assert.match(elements['interaction-prompt'].textContent,/SAIR/);
});
