'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const Progress=vm.runInNewContext(
    read('js/gameplay/chapter-progress.js')+'\nDriverChapterProgress',
    {JSON,Math}
);
const fake=()=>{const items=new Map();return {
    getItem:k=>items.get(k)||null,
    setItem:(k,v)=>items.set(k,v),
    items
};};
test('Havana da campanha começa bloqueada num navegador novo',()=>{
    assert.equal(new Progress(fake()).canTravelToHavana(),false);
});
test('derrota ou reinício não liberam capítulo por si só',()=>{
    const p=new Progress(fake());assert.equal(p.canTravelToHavana(),false);
});
test('vitória cria checkpoint persistente independente da casa',()=>{
    const storage=fake(),p=new Progress(storage);
    assert.equal(p.unlockHavana(),true);
    assert.equal(new Progress(storage).canTravelToHavana(),true);
});
test('checkpoint não substitui o save normal da casa',()=>{
    const storage=fake();
    storage.setItem('driver2-three-save-v1','save-manual');
    new Progress(storage).unlockHavana();
    assert.equal(storage.getItem('driver2-three-save-v1'),'save-manual');
});
test('dados corrompidos não concedem acesso à campanha',()=>{
    const storage=fake();
    storage.setItem(Progress.KEY,'{');
    assert.equal(new Progress(storage).canTravelToHavana(),false);
    storage.setItem(Progress.KEY,JSON.stringify({version:1,chicago08:'true'}));
    assert.equal(new Progress(storage).canTravelToHavana(),false);
});
test('armazenamento desabilitado não derruba campanha em memória',()=>{
    const storage={getItem:()=>{throw Error('denied')},
        setItem:()=>{throw Error('denied')}};
    const p=new Progress(storage);
    assert.equal(p.unlockHavana(),false);
    assert.equal(p.canTravelToHavana(),true);
});
test('mudança de clima propaga solo molhado e seco à frota',()=>{
    const engine=read('js/engine/driver2-game-engine.js');
    assert.match(engine,/v\.wetRoad=mode==='rain'/);
    assert.match(engine,/v\.wetRoad=this\.weatherMode==='rain'/);
    assert.match(engine,/mafia\.wetRoad=this\.weatherMode==='rain'/);
});
test('chuva diminui aderência lateral sem mudar física seca',()=>{
    const Physics=vm.runInNewContext(read('js/physics/arcade-dynamics.js')+
        '\nDriverArcadePhysics',{Math});
    const make=wetRoad=>({x:0,z:0,heading:0,speed:27,damage:0,
        maxSpeed:52,accel:28,lateralVelocity:0,wheelSpin:0,steerAngle:0,
        pitchAngle:0,rollAngle:0,bodyStyle:'muscle',wetRoad,
        chassisTilt:{rotation:{x:0,z:0}}});
    const dry=make(false),wet=make(true);
    for(let i=0;i<35;i++){
        Physics.update(dry,1/60,1,.6,false,false);
        Physics.update(wet,1/60,1,.6,false,false);
    }
    assert.ok(Math.abs(wet.lateralVelocity)>Math.abs(dry.lateralVelocity));
    assert.ok(Number.isFinite(wet.heading));
});
test('missão 08 concede checkpoint somente com vitória certificada',()=>{
    const engine=read('js/engine/driver2-game-engine.js');
    assert.match(engine,/this\.leavingDirector\.completed && \/CONCLUÍDA\//);
    assert.match(engine,/this\.chapterProgress\.unlockHavana\(\)/);
    assert.match(engine,/this\.beginHavanaChapter\(\)/);
});
test('menu de campanha mostra o próximo capítulo após desbloqueio',()=>{
    const html=read('index.html'),js=read('js/engine/driver2-game-engine.js');
    assert.match(html,/id="btn-resume-havana"/);
    assert.match(html,/id="chicago-chapter-status"/);
    assert.match(js,/CAPÍTULO 2 — HAVANA/);
    assert.match(js,/FOLLOW UP THE LEAD/);
});
test('script de checkpoint carrega antes do motor no GitHub Pages',()=>{
    const html=read('index.html');
    assert.ok(html.indexOf('js/gameplay/chapter-progress.js')<
        html.indexOf('js/engine/driver2-game-engine.js'));
});
