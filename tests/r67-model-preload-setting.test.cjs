'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/ui/driver-boot-flow.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const Type=vm.runInNewContext(source+';DriverBootFlow',{
    document:{
        body:{classList:{toggle(){}}},
        getElementById(){return {style:{}}}
    },
    window:{matchMedia:()=>({matches:false})}
});
const ctx=(models,enabled=true)=>{
    const calls={toggle:0,decorate:0,paint:0},library={
        enabled,toggle(){calls.toggle++},decorateFleet(){calls.decorate++}
    };
    const game={
        freeVehicleAssets:library,
        playerCar:{setPaintColor(){calls.paint++}}
    };
    const boot={
        settings:{models,shadows:true,scanlines:false,
            reducedMotion:false,playerColor:'#aabbcc'},game
    };
    return {boot,library,calls};
};
test('desmarcar pré-carregamento não pede para reativar modo de carros de caixas',()=>{
    const {boot,library,calls}=ctx(false,true);
    Type.prototype.applySettings.call(boot);
    assert.equal(library.enabled,true);
    assert.equal(calls.toggle,0);
    assert.equal(calls.decorate,0);
    assert.equal(calls.paint,1);
    Type.prototype.applySettings.call(boot);
    assert.equal(calls.toggle,0,'opening menu repeatedly must not reset GLB caches');
});
test('o menu reabilita biblioteca inativa sem reativar toggle legado',()=>{
    const {boot,library,calls}=ctx(false,false);
    Type.prototype.applySettings.call(boot);
    assert.equal(library.enabled,true);
    assert.equal(calls.decorate,1);
    assert.equal(calls.toggle,0);
});
test('importação GLB pendente funciona mesmo com pré-carregamento desmarcado',async()=>{
    const {boot,library,calls}=ctx(false,true);
    const file={name:'personal.glb',size:123456};
    boot.pendingUserCarFile=file;
    let received=null,notice='';
    boot.showCarStatus=s=>{notice=s;};
    library.importUserCar=async f=>{received=f;return true;};
    const events=[];
    await Type.prototype.preloadModels.call(boot,boot.game,(ratio,label)=>
        events.push({ratio,label}));
    assert.equal(received,file);
    assert.equal(boot.pendingUserCarFile,null);
    assert.match(notice,/Carro 3D personalizado/);
    assert.equal(calls.decorate,1);
    assert.equal(events.at(-1).ratio,1);
});

test('sem pré-carregamento o jogo continua decorando a frota com GLBs locais',async()=>{
    const {boot,calls}=ctx(false,true);
    const events=[];
    await Type.prototype.preloadModels.call(boot,boot.game,(ratio,label)=>
        events.push({ratio,label}));
    assert.equal(calls.decorate,1);
    assert.equal(events.at(-1).ratio,1);
    assert.match(events.at(-1).label,/GLBs locais/);
    assert.match(html,/Pré-carregar GLBs do repositório/);
    assert.match(html,/city-builder\.js\?v=r67-city-lifecycle/);
    assert.match(html,/driver2-game-engine\.js\?v=r67-import-resources/);
});
