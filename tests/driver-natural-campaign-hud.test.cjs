'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const flow=vm.runInNewContext(read('js/gameplay/campaign-flow.js')+
    '\nDriverCampaignFlow',{Math,Set,String});
test('UNDERCOVER passa pelo mapa e só ativa a primeira missão no marcador',()=>{
    const boot=read('js/ui/driver-boot-flow.js');
    const game=read('js/engine/driver2-game-engine.js');
    assert.match(boot,/game\.storyCampaign=mode==='story'/);
    assert.match(boot,/game\.missionType='freeroam'/);
    assert.doesNotMatch(boot,/game\.missionType=mode==='story'\?'story_tipoff'/);
    assert.match(game,/activateNearbyMission\(\)/);
    assert.match(game,/nextStoryMission\(\)/);
    assert.match(game,/this\.missionActive\s*\|\|/);
});
test('campanha percorre as oito missões Chicago em ordem, sem pular capítulos',()=>{
    const completed=new Set();
    for(const type of flow.CHICAGO){
        assert.equal(flow.next('chicago',completed),type);
        completed.add(type);
    }
    assert.equal(flow.next('chicago',completed),null);
    assert.equal(flow.next('havana',new Set()),'story_havana_lead');
    assert.equal(flow.next('havana',new Set(['story_havana_lead'])),null);
});
test('falha não conta missão como completada e permite repetir',()=>{
    for(const title of ['MISSÃO FALHOU!','TEMPO ESGOTADO!',
        'CARRO DESTRUÍDO!','TESTEMUNHA ESCAPOU!','PONTE FECHOU!'])
        assert.equal(flow.isFailure(title),true,title);
    assert.equal(flow.isFailure('SURVEILLANCE TIP OFF CONCLUÍDA!'),false);
    const note=flow.summarize('TEMPO ESGOTADO','Tempo',true,'story_tipoff');
    assert.match(note.next,/tentar novamente/);
});
test('missão terminada não para a simulação ou exibe caixa central',()=>{
    const engine=read('js/engine/driver2-game-engine.js');
    const start=engine.indexOf('            triggerEndScreen(title, desc) {');
    const end=engine.indexOf('            updateCamera(dt) {',start);
    assert.ok(start>0&&end>start);
    const block=engine.slice(start,end);
    assert.match(block,/this\.gameEnded=false/);
    assert.match(block,/this\.missionActive=false/);
    assert.match(block,/this\.missionType='freeroam'/);
    assert.match(block,/DriverCampaignFlow\.isFailure/);
    assert.match(block,/driver-mission-toast/);
    assert.doesNotMatch(block,/center-announcement'\)\.classList\.remove\('hidden'/);
    assert.doesNotMatch(block,/this\.spawnAllVehicles\(\)/);
});
test('somente MENU permanece no topo; ações acessíveis no menu inicial',()=>{
    const boot=read('js/ui/driver-boot-flow.js');
    const css=read('css/styles.css');
    const html=read('index.html');
    assert.match(boot,/moveInGameControlsToMenu\(\)/);
    assert.match(boot,/holder\.appendChild\(element\)/);
    for(const id of ['btn-missions','btn-architecture','btn-director',
        'btn-audio','btn-free-assets','btn-headlights','btn-camera',
        'btn-radar-zoom','btn-route-home'])
        assert.ok(boot.includes("'"+id+"'"),id);
    assert.match(html,/id="d2-game-controls"/);
    assert.match(html,/id="driver-mission-toast"/);
    assert.match(html,/id="driver-mission-context"/);
    assert.match(html,/id="btn-main-menu"/);
    assert.match(css,/#hud-player-panel,/);
    assert.match(css,/#mission-center > :not\(#interaction-prompt\)/);
    assert.match(css,/#center-announcement \{display:none!important;\}/);
});
test('porta abre também no carro GLB do jogador mantendo física original',()=>{
    const assets=read('js/assets/free-vehicle-library.js');
    const rig=read('js/vehicles/police-door-rig.js');
    const engine=read('js/engine/driver2-game-engine.js');
    assert.match(assets,/DriverPoliceDoorRig\.mount\(vehicle,wrapped\)/);
    assert.match(rig,/vehicle\.isPolice\|\|vehicle\._userCustomModel/);
    assert.match(engine,/if\(this\.playerCar\.policeDoorRig\)/);
    assert.match(engine,/if\(closestCar\.policeDoorRig\)/);
    assert.match(engine,/updateVehicleDoorApproach\(\)/);
    assert.match(engine,/this\.tanner\.setPosition\(/);
});
test('GLB carro_driver2_otimizado original tem uma malha e região de porta detectável',()=>{
    const bytes=fs.readFileSync(path.join(__dirname,
        '../assets/vehicles/carro_driver2_otimizado.glb'));
    assert.equal(bytes.subarray(0,4).toString('ascii'),'glTF');
    const jsonLen=bytes.readUInt32LE(12);
    const gltf=JSON.parse(bytes.subarray(20,20+jsonLen).toString('utf8'));
    assert.equal(gltf.meshes.length,1);
    assert.equal(gltf.nodes.length,1);
    assert.ok(gltf.accessors[0].count>25000);
    const [minX,minY,minZ]=gltf.accessors[0].min;
    const [maxX,maxY,maxZ]=gltf.accessors[0].max;
    assert.ok(minX<-.50 && maxX>.16);
    assert.ok(minY<-.185 && maxY>.175);
    assert.ok(minZ<-.245 && maxZ>.245);
    const rig=read('js/vehicles/police-door-rig.js');
    assert.match(rig,/x>=-\.50 && x<=\.16/);
});
test('GLB deve desligar suas dobradiças ao retornar ao PS1',()=>{
    const vehicle=read('js/vehicles/driver-vehicle.js');
    assert.match(vehicle,/DriverPoliceDoorRig\.cancel\(this\)/);
    assert.match(vehicle,/this\.policeDoorRig=null/);
});
