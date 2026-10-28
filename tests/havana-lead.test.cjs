'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const Director=vm.runInNewContext(
    read('js/gameplay/havana-lead.js')+'\nDriverHavanaLead',
    {Math,Number,Infinity,Error}
);
const Progress=vm.runInNewContext(
    read('js/gameplay/chapter-progress.js')+'\nDriverChapterProgress',
    {JSON,Math}
);
const fake=()=>{const items=new Map();return {
    getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,v),items
};};
const target=()=>{const car={x:Director.SUSPECT.x,
    z:Director.SUSPECT.z,damage:0,heading:0};
    Director.attachRoute(car);return car;};
const frame=(m,car,player,seconds,extra={})=>{
    let state;for(let i=0;i<Math.ceil(seconds/.05);i++)
        state=m.update(.05,{player,target:car,mode:'driving',timeLeft:120,...extra});
    return state;
};
test('Havana 09 inicia em pista e cria percurso independente do original PS1',()=>{
    const car=target();
    assert.equal(car.scriptedDrive.waypoints.length,12);
    assert.equal(car.scriptedDrive.index,0);
    assert.equal(car.scriptedDrive.waitSeconds,3);
    assert.ok(Director.LIMIT>=180);
    assert.equal(Director.START.x,4);
    assert.equal(Director.RENDEZVOUS.x,164);
});
test('uma distância de 50 m preserva a vigilância',()=>{
    const m=new Director(),car=target();
    const s=frame(m,car,{x:car.x,z:car.z-50},20);
    assert.equal(s.failed,null);
    assert.equal(s.complete,false);
    assert.equal(s.zone,'safe');
    assert.ok(s.tailSeconds>=19.9);
});
test('Tanner perde o suspeito se ficar muito longe',()=>{
    const m=new Director(),car=target();
    const s=frame(m,car,{x:300,z:-300},6);
    assert.equal(s.failed,'lost');
});
test('colar na traseira faz o suspeito notar Tanner',()=>{
    const m=new Director(),car=target();
    const s=frame(m,car,{x:car.x,z:car.z-5},4);
    assert.equal(s.failed,'detected');
});
test('tolerância breve evita derrota imediata num cruzamento',()=>{
    const m=new Director(),car=target();
    frame(m,car,{x:car.x,z:car.z-6},.9);
    const s=frame(m,car,{x:car.x,z:car.z-50},4);
    assert.equal(s.failed,null);
    assert.equal(s.alertSeconds,0);
});
test('somente chegar ao destino não concede vitória sem acompanhamento',()=>{
    const m=new Director(),car=target();
    car.x=Director.RENDEZVOUS.x;
    car.z=Director.RENDEZVOUS.z;
    car.scriptedDrive.done=true;
    const s=frame(m,car,{x:car.x-60,z:car.z},3);
    assert.equal(s.complete,false);
});
test('diretor certifica vitória ao seguir até o destino',()=>{
    const m=new Director(),car=target();
    frame(m,car,{x:car.x,z:car.z-45},13);
    car.x=Director.RENDEZVOUS.x;
    car.z=Director.RENDEZVOUS.z;
    car.scriptedDrive.done=true;
    const s=frame(m,car,{x:car.x,z:car.z-46},.05);
    assert.equal(s.complete,true);
    assert.equal(s.phase,'meet');
    assert.equal(s.progress,1);
});
test('tempo e alvo destruído também causam derrota',()=>{
    const car=target();car.damage=98;
    assert.equal(new Director().update(.05,{player:{x:4,z:-200},
        target:car}).failed,'destroyed');
    car.damage=0;
    assert.equal(new Director().update(.05,{player:{x:4,z:-200},
        target:car,timeLeft:0}).failed,'timeout');
});
test('save restaura progresso, índice de rota e contadores limitados',()=>{
    const director=new Director(),car=target();
    frame(director,car,{x:4,z:-200},8);
    car.scriptedDrive.index=6;
    const saved=director.export(car);
    const loaded=new Director(),newCar=target();
    loaded.restore(saved,newCar);
    assert.equal(newCar.scriptedDrive.index,6);
    assert.equal(loaded.tailSeconds,director.tailSeconds);
    loaded.restore({routeIndex:9999,alertSeconds:Infinity,
        lostSeconds:-22,tailSeconds:Infinity},newCar);
    assert.equal(newCar.scriptedDrive.index,Director.ROUTE.length);
    assert.equal(loaded.lostSeconds,0);
    assert.equal(loaded.tailSeconds,0);
});
test('rotas guiadas da IA reutilizam os waypoints da missão 09',()=>{
    const ai=read('js/traffic/traffic-ai.js');
    assert.match(ai,/DriverTailingDropMission\.advanceRoute\(car\)/);
    assert.match(ai,/scripted\.done\|\|missionRoute\?\.blocked\?0:/);
    const Drop=vm.runInNewContext(
        read('js/gameplay/tailing-drop.js')+'\nDriverTailingDropMission',
        {Math,Number,Infinity}
    );
    const car=target();
    for(const waypoint of Director.ROUTE){
        car.x=waypoint.x;car.z=waypoint.z;
        Drop.advanceRoute(car);
    }
    assert.equal(car.scriptedDrive.done,true);
});
test('checkpoint Havana 09 exige Chicago 08 e preserva save da casa',()=>{
    const store=fake(),checkpoint=new Progress(store);
    store.setItem('driver2-three-save-v1','save-anterior');
    assert.equal(checkpoint.completeHavanaLead(),false);
    assert.equal(checkpoint.hasCompletedHavanaLead(),false);
    checkpoint.unlockHavana();
    assert.equal(checkpoint.completeHavanaLead(),true);
    assert.equal(new Progress(store).hasCompletedHavanaLead(),true);
    assert.equal(store.getItem('driver2-three-save-v1'),'save-anterior');
});
test('saves de revisão anterior são compatíveis',()=>{
    const store=fake();
    store.setItem(Progress.KEY,JSON.stringify({version:1,chicago08:true}));
    const checkpoint=new Progress(store);
    assert.equal(checkpoint.canTravelToHavana(),true);
    assert.equal(checkpoint.hasCompletedHavanaLead(),false);
});
test('engine só registra conclusão após resultado confirmado',()=>{
    const engine=read('js/engine/driver2-game-engine.js');
    assert.match(engine,/this\.havanaLeadDirector\.complete && \/CONCLUÍDA\//);
    assert.match(engine,/this\.chapterProgress\.completeHavanaLead\(\)/);
    assert.match(engine,/this\.havanaLeadDirector\.update\(dt/);
    assert.match(engine,/this\.startMission\('story_havana_lead'\)/);
    assert.match(engine,/return this\.startHavanaLead\(\)/);
});
test('Havana 09 aparece no menu somente quando desbloqueada',()=>{
    const html=read('index.html');
    const engine=read('js/engine/driver2-game-engine.js');
    assert.match(html,/id="btn-story-havana-lead"/);
    assert.match(html,/id="havana-lead-progress"/);
    assert.match(html,/id="btn-havana-free-roam"/);
    assert.match(engine,/missionButton\.classList\.toggle\('hidden',!unlocked\)/);
    assert.ok(html.indexOf('js/gameplay/havana-lead.js')<
        html.indexOf('js/engine/driver2-game-engine.js'));
});
test('save manual aceita o novo tipo e preserva o índice do alvo',()=>{
    const save=read('js/gameplay/home-save.js');
    assert.match(save,/story_havana_lead/);
    assert.match(save,/game\.havanaLeadDirector\.export\(game\.targetCar\)/);
    assert.match(save,/game\.havanaLeadDirector\.restore\(data\.havanaLead,game\.targetCar\)/);
});
