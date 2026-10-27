'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const Loader=vm.runInNewContext(
    read('js/ui/driver-load-scheduler.js')+'\nDriverLoadScheduler',
    {Math,Promise,Error}
);
test('barra de loading começa no zero e só avança após tarefas reais',async()=>{
    const events=[];
    let completedFirst=false;
    await Loader.execute([
        {label:'ruas',weight:70,run:async report=>{
            report(.5,'ruas parcialmente construídas');
            await Promise.resolve();
            completedFirst=true;
        }},
        {label:'texturas',weight:30,run:async report=>{
            assert.equal(completedFirst,true);
            report(1,'texturas prontas');
        }}
    ],e=>events.push({...e}));
    assert.equal(events[0].fraction,0);
    assert.ok(events.some(e=>Math.abs(e.fraction-.35)<.00001));
    assert.ok(events.some(e=>Math.abs(e.fraction-.7)<.00001));
    assert.equal(events.at(-1).fraction,1);
    assert.ok(events.every((e,i)=>i===0 || e.fraction>=events[i-1].fraction));
});
test('falha aborta o carregamento; não publica 100%',async()=>{
    const events=[];
    await assert.rejects(()=>Loader.execute([
        {label:'mapa',weight:75,run:()=>{}},
        {label:'shader',weight:25,run:()=>{throw Error('WebGL indisponível')}}
    ],e=>events.push({...e})),/WebGL indisponível/);
    assert.ok(events.at(-1).fraction<1);
});
test('carregador não usa percentagem animada por temporizador',()=>{
    const src=read('js/ui/driver-load-scheduler.js');
    assert.doesNotMatch(src,/setInterval/);
    assert.match(src,/await task\.run\(/);
    assert.match(src,/await beforeTask\(/);
});
test('9 fileiras de quarteirões são construídas com yield de UI',()=>{
    const city=read('js/world/city-builder.js');
    assert.match(city,/\*buildEnvironmentStages\(\)/);
    assert.match(city,/for\(const \[rowIndex,bx\] of coords\.entries\(\)\)/);
    assert.match(city,/yield 'Quarteirões e edifícios '/);
    assert.match(city,/await new Promise\(resolve=>requestAnimationFrame\(resolve\)\)/);
    assert.match(city,/this\.ready=true/);
});
test('motor é criado após iniciar modo, não no carregamento da página',()=>{
    const boot=read('js/ui/driver-boot-flow.js');
    const engine=read('js/engine/driver2-game-engine.js');
    assert.match(boot,/new Driver2GameEngine\(\{deferCityBuild:true\}\)/);
    assert.match(engine,/window\.DriverBoot = new DriverBootFlow\(\)/);
    assert.doesNotMatch(engine,/window\.DriverGame = new Driver2GameEngine\(\);/);
});
test('mudança de cidade usa loader real e congela a simulação',()=>{
    const js=read('js/engine/driver2-game-engine.js');
    const boot=read('js/ui/driver-boot-flow.js');
    assert.match(js,/window\.DriverBoot\.switchCity\(this,cityKey\)/);
    assert.match(js,/if\(this\.loadingActive\)return/);
    assert.match(boot,/game\.city\.loadCityPresetProgressive\(cityKey,report\)/);
    assert.match(boot,/game\.loadingActive=true/);
});
test('menu expõe modos clássicos, opções e quatro cidades',()=>{
    const html=read('index.html');
    for(const id of ['driver-main-menu','d2-start-story','d2-start-ride',
        'd2-continue','d2-driving-games','d2-options-btn','d2-resume',
        'd2-city-list','btn-main-menu','driver-loading','d2-progress-track'])
        assert.match(html,new RegExp('id="'+id+'"'));
    for(const city of ['chicago','havana','vegas','rio'])
        assert.match(html,new RegExp('data-city="'+city+'"'));
});
test('scripts do boot são carregados antes da engine no GitHub Pages',()=>{
    const html=read('index.html');
    const scheduler=html.indexOf('js/ui/driver-load-scheduler.js');
    const boot=html.indexOf('js/ui/driver-boot-flow.js');
    const engine=html.indexOf('js/engine/driver2-game-engine.js');
    assert.ok(scheduler>0&&scheduler<boot&&boot<engine);
});
test('falha dos modelos externos não impede iniciar jogo procedural',()=>{
    const boot=read('js/ui/driver-boot-flow.js');
    assert.match(boot,/Promise\.race\(\[library\.getScene\(name\),fallback\]\)/);
    assert.match(boot,/using fallback|usando fallback|Usando malhas PS1/);
    assert.match(boot,/game\.renderer\.compile\(game\.scene,game\.camera\)/);
});
test('save antigo permanece local e pode ser aberto do menu',()=>{
    const boot=read('js/ui/driver-boot-flow.js');
    assert.match(boot,/new DriverHomeSave\(window\.localStorage\)\.read\(\)/);
    assert.match(boot,/game\.homeSave\.restore\(game,save\)/);
});
test('não simula física enquanto o menu principal está aberto',()=>{
    const js=read('js/engine/driver2-game-engine.js');
    const boot=read('js/ui/driver-boot-flow.js');
    assert.match(js,/if\(this\.isPaused\)\{/);
    assert.match(boot,/this\.game\.isPaused=true/);
    assert.match(js,/code==='Escape'/);
});
