'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const THREE = {
  MathUtils: { clamp: (v,min,max) => Math.max(min, Math.min(max,v)) }
};
function load(relative, symbol) {
  const code = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
  return vm.runInNewContext(code + '\n' + symbol + ';', { THREE, Math });
}
const Urban = load('js/world/urban-districts.js','UrbanDistricts');
const Roadblocks = load('js/police/roadblock-director.js','PoliceRoadblockDirector');
const Traffic = load('js/traffic/traffic-ai.js','DriverTrafficAI');

const city = {
  preset:{id:'chicago'},
  isPointBlocked(x,z){return Math.abs(x)>245 || Math.abs(z)>245;},
  isTrafficGreen(){return true;}
};
function player(x=4,z=-20,heading=0) {
  return { x,z,heading,speed:15,lateralVelocity:0,bodyStyle:'muscle',isPolice:false,isTarget:false };
}
function harness({felony=85,missionType='freeroam'}={}) {
  const events=[];
  const car=player();
  const ped={
    roadblocks:[],
    spawnPoliceRoadblocks(preset,options) {
      events.push('spawn');
      this.roadblocks.push(...options.locations.map(point=>({...point,dynamic:true,smashed:false})));
    },
    clearDynamicRoadblocks() {
      events.push('clear');
      this.roadblocks=[];
    }
  };
  const game={
    city,pedManager:ped,playerCar:car,missionType,mode:'driving',felony,
    getPlayerPosition() {return car;}
  };
  return {director:new Roadblocks(),game,events};
}
test('cada cidade produz variações estáveis de altura',()=>{
  const a=Urban.height('chicago',-120,120);
  assert.equal(a,Urban.height('chicago',-120,120));
  assert.ok(a>Urban.height('havana',-120,120));
});
test('faixa de trânsito norte mantém margem direita',()=>{
  const route=new Traffic(city).getRoute(player(4,-114,0));
  assert.equal(route.target.x,4);
  assert.equal(route.target.z,-80);
});
test('o motorista para no vermelho sem atravessar semáforo',()=>{
  const car=player(4,-95,0);car.speed=9;
  const ai=new Traffic({...city,isTrafficGreen:()=>false});
  const control=ai.getInput(car,1/60,[car],null,0);
  assert.equal(control.up,false);
  assert.equal(control.down,true);
});
test('bloqueio aparece em avenida adiante, nunca sobre o jogador',()=>{
  const {director,game}=harness();
  const point=director.candidate(game.playerCar,city);
  assert.ok(point);
  assert.ok(Math.hypot(point.x-game.playerCar.x,point.z-game.playerCar.z)>=65);
  assert.equal(point.axis,'z');
});
test('diretor ignora lugares obstruídos',()=>{
  const {director,game}=harness();
  const result=director.candidate(game.playerCar,{isPointBlocked:()=>true});
  assert.equal(result,null);
});
test('nível de delito baixo não cria bloqueios',()=>{
  const {director,game,events}=harness({felony:20});
  director.cooldown=0;director.update(0.016,game);
  assert.equal(events.length,0);
});
test('perseguição ativa apenas uma onda durante cooldown',()=>{
  const {director,game,events}=harness();
  director.cooldown=0;
  for(let i=0;i<60;i++)director.update(0.016,game);
  assert.equal(events.filter(x=>x==='spawn').length,1);
});
test('bloqueio desaparece depois de escapar da polícia',()=>{
  const {director,game,events}=harness();
  director.cooldown=0;director.update(0.016,game);
  game.felony=0;director.update(0.016,game);
  assert.equal(events.includes('clear'),true);
});
test('Fura-Bloqueios conserva os cavaletes próprios da missão',()=>{
  const {director,game,events}=harness({missionType:'gauntlet'});
  director.cooldown=0;
  director.update(0.016,game);
  assert.equal(events.length,0);
});
