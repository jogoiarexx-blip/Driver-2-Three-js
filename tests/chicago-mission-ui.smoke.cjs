/**
 * Prova de início de campanha através de marcador/botão/J e replay manual.
 * node tests/chicago-mission-ui.smoke.cjs
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const elements={};
for(const id of [
    'driver-mission-start-status','btn-start-nearby-mission',
    'missions-modal','mission-direct-start-mode'
]){
    elements[id]={
        textContent:'',disabled:true,checked:false,
        classList:{
            hidden:true,
            toggle(name,flag){if(name==='hidden')this.hidden=!!flag;},
            add(name){if(name==='hidden')this.hidden=true;}
        }
    };
}
const document={getElementById:id=>elements[id]||null};
const ctx={document,window:{}};
vm.createContext(ctx);
function load(file,name){
    const filename=path.join(__dirname,'..',file);
    vm.runInContext(fs.readFileSync(filename,'utf8')+
        '\nthis.'+name+'='+name+';',ctx,{filename});
    return ctx[name];
}
const Hubs=load('js/gameplay/chicago-mission-hubs.js',
    'DriverChicagoMissionHubs');
const Flow=load('js/gameplay/campaign-flow.js','DriverCampaignFlow');
const Engine=load('js/engine/driver2-game-engine.js','Driver2GameEngine');
const vector=(x,z)=>({x,z,set(a,b,c){this.x=a;this.z=c;}});
const ring={position:vector(-64,-144),rotation:{y:0},
    material:{color:{setHex(){}}}};
const arrow={position:vector(-64,-144),rotation:{y:0},
    material:{color:{setHex(){}}}};
const game={
    city:{preset:{id:'chicago'},
        missionStart:{type:'story_tipoff',x:-64,z:-144,ring,arrow}},
    currentCityKey:'chicago',completedMissions:new Set(),
    storyCampaign:false,missionActive:false,gameEnded:false,
    chapterProgress:{canTravelToHavana(){return true;}},
    position:{x:-64,z:-144},
    getPlayerPosition(){return this.position;},
    startMission(type){this.started=type;}
};
for(const name of [
    'nextStoryMission','getNearbyMissionStart','activateNearbyMission',
    'updateCityNavigation','showStoryMissionOnMap'
])game[name]=Engine.prototype[name].bind(game);

game.updateCityNavigation();
assert.equal(elements['btn-start-nearby-mission'].classList.hidden,false);
assert.equal(game.getNearbyMissionStart().type,'story_tipoff');
assert.equal(game.activateNearbyMission(),true);
assert.equal(game.started,'story_tipoff');
game.completedMissions.add('story_tipoff');
game.storyCampaign=true;
game.updateCityNavigation();
assert.equal(game.city.missionStart.type,'story_witness');
assert.equal(game.city.missionStart.x,12);
assert.equal(elements['btn-start-nearby-mission'].classList.hidden,true);
game.position={x:12,z:-112};
game.updateCityNavigation();
assert.equal(elements['btn-start-nearby-mission'].classList.hidden,false);
assert.equal(game.activateNearbyMission(),true);
assert.equal(game.started,'story_witness');
game.missionActive=true;
game.updateCityNavigation();
assert.equal(elements['btn-start-nearby-mission'].classList.hidden,true);
game.missionActive=false;
game.completedMissions.add('story_witness');
assert.equal(game.showStoryMissionOnMap('story_train'),true);
assert.equal(game.city.missionStart.type,'story_train');
assert.equal(game.showStoryMissionOnMap('story_leaving'),false);
assert.equal(game.city.missionStart.type,'story_train');
elements['mission-direct-start-mode'].checked=true;
assert.equal(game.showStoryMissionOnMap('story_leaving'),true);
assert.equal(game.started,'story_leaving');
console.log('PASS: botão, J, sequência, progresso e replay manual');
