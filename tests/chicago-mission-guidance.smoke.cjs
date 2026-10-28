/**
 * Regressão do HUD de etapas, radar e classificação de falhas em Chicago.
 * Execução: node tests/chicago-mission-guidance.smoke.cjs
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx={};
vm.createContext(ctx);
function load(p,name){
    const f=path.join(__dirname,'..',p);
    vm.runInContext(fs.readFileSync(f,'utf8')+
        '\nthis.'+name+'='+name+';',ctx,{filename:f});
    return ctx[name];
}
const Flow=load('js/gameplay/campaign-flow.js','DriverCampaignFlow');
const Guidance=load('js/gameplay/chicago-mission-guidance.js',
    'DriverChicagoMissionGuidance');

const game={
    missionActive:true,currentCityKey:'chicago',
    missionType:'story_tipoff',mode:'on_foot',
    playerCar:{x:0,z:-20},targetCar:{x:244,z:-240},
    city:{safeHouseZone:{x:-120,z:-101}},
    missionTimeLeft:80,witnessCloseTime:14,
    getPlayerPosition(){return this.position;},
    position:{x:0,z:-19}
};
let observed=0;
for(const type of Flow.CHICAGO){
    game.missionType=type;game.mode='driving';
    const snapshot=Guidance.snapshot(game);
    assert(snapshot&&snapshot.label,'Falta orientação: '+type);
    assert.equal(snapshot.type,type);
    observed++;
}
assert.equal(observed,8);
game.missionType='story_tipoff';
game.mode='on_foot';
let stage=Guidance.snapshot(game);
assert.equal(stage.id,'enter');
game.position={x:244,z:-240};
stage=Guidance.snapshot(game);
assert.equal(stage.id,'jones');
game.position={x:0,z:-19};

game.missionType='story_train';
game.trainLine={arrived:false,position:{x:0,z:-190}};
assert.equal(Guidance.snapshot(game).id,'train');
assert.equal(Guidance.snapshot(game).destination.z,-190);
game.trainLine.arrived=true;
game.mode='on_foot';
assert.equal(Guidance.snapshot(game).id,'platform');

game.missionType='story_drop';
game.dropStatus={zone:'close',suspicion:72,lost:0};
assert(Guidance.snapshot(game).warning.includes('MUITO PERTO'));
game.dropStatus.zone='far';
assert(Guidance.snapshot(game).warning.includes('MUITO LONGE'));

game.missionType='story_safehouse';
game.safeHouseStatus={phase:'escape',policeWatching:true};
assert.equal(Guidance.snapshot(game).destination,null);
game.safeHouseStatus.phase='reach_home';
assert.equal(Guidance.snapshot(game).destination.x,-120);

game.missionType='story_intruder';
game.mode='on_foot';
game.intruderStatus={phase:'opening'};
assert.equal(Guidance.snapshot(game).id,'car');
game.intruderStatus.phase='yard';
assert.equal(Guidance.snapshot(game).destination.z,-160);

game.missionType='story_caine';
game.caineStatus={phase:'bridge',bridgeRemaining:11};
assert.equal(Guidance.snapshot(game).destination.z,100);
assert(Guidance.snapshot(game).warning.includes('PONTE'));

game.missionType='story_leaving';
game.leavingStatus={phase:'reunion'};
assert.equal(Guidance.snapshot(game).destination.z,-240);
assert.equal(Guidance.snapshot(game).id,'reunion');

game.missionActive=false;
assert.equal(Guidance.snapshot(game),null);
game.missionActive=true;
game.currentCityKey='havana';
assert.equal(Guidance.snapshot(game),null);

// Não registre como concluída uma missão perdida.
for(const title of ['O SUSPEITO VIU VOCÊ!','TREM PERDIDO',
    'ALVO DESTRUÍDO!','PONTE FECHOU!','TESTEMUNHA ESCAPOU!'])
    assert(Flow.isFailure(title),'Falha sem reconhecimento: '+title);
for(const title of ['TRAIN PURSUIT CONCLUÍDA!',
    'CHASE THE WITNESS CONCLUÍDA!'])
    assert.equal(Flow.isFailure(title),false);

console.log('PASS 8 etapas, mudanças de fase, destinos e derrotas');
