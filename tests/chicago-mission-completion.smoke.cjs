/**
 * Regressão de vitória/derrota da campanha Chicago.
 * Execução: node tests/chicago-mission-completion.smoke.cjs
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const elements=new Map();
for(const id of [
    'btn-continue-safehouse','btn-havana-free-roam',
    'btn-continue-havana','center-announcement',
    'mission-timer','objective-banner','driver-mission-toast'
]){
    elements.set(id,{
        textContent:'',
        classList:{add(){},remove(){},toggle(){}}
    });
}
const document={getElementById:id=>elements.get(id)||null};
const context={document,window:{}};
vm.createContext(context);
function load(file,name){
    const f=path.join(__dirname,'..',file);
    vm.runInContext(fs.readFileSync(f,'utf8')+
        '\nthis.'+name+'='+name+';',context,{filename:f});
    return context[name];
}
const Flow=load('js/gameplay/campaign-flow.js','DriverCampaignFlow');
const Engine=load('js/engine/driver2-game-engine.js','Driver2GameEngine');
const game={
    missionType:'story_drop',storyCampaign:true,
    currentCityKey:'chicago',missionActive:true,gameEnded:false,
    completedMissions:new Set(['story_tipoff','story_witness','story_train']),
    chapterProgress:{},
    clearMissionMarkers(){this.cleared=true;},
    nextStoryMission(){
        return Flow.next(this.currentCityKey,this.completedMissions);
    },
    updateChapterMenu(){}
};
const reason='A vigilância foi comprometida. Mantenha a barra verde.';
Engine.prototype.triggerEndScreen.call(game,'O SUSPEITO VIU VOCÊ!',reason);
assert.equal(game.completedMissions.has('story_drop'),false);
assert.equal(game.missionType,'freeroam');
assert(game.missionToastText.includes('MISSÃO FALHOU'));
assert(game.missionToastText.includes(reason));
assert(elements.get('objective-banner').textContent.includes(reason));
assert.equal(game.nextStoryMission(),'story_drop');

// Conclusão real, sem reclassificar fracasso como sucesso.
game.missionType='story_drop';
game.missionActive=true;
Engine.prototype.triggerEndScreen.call(game,'TAILING THE DROP CONCLUÍDA!',
    'O suspeito chegou ao depósito.');
assert.equal(game.completedMissions.has('story_drop'),true);
assert.equal(game.nextStoryMission(),'story_safehouse');
assert(game.missionToastText.includes('MISSÃO CONCLUÍDA'));
console.log('PASS: derrota não conclui capítulo, vitória libera próximo, motivo no HUD');
