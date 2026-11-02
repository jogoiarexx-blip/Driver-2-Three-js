'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/engine/driver2-game-engine.js','utf8');
function harness({loadThrows=false}={}){
    const created=[],revoked=[],calls=[];
    const status={textContent:''};
    const URL={
        createObjectURL(file){created.push(file.name);return 'blob:driver-test-'+created.length;},
        revokeObjectURL(url){revoked.push(url);}
    };
    const THREE={GLTFLoader:class{
        load(url,onSuccess,_progress,onError){
            if(loadThrows)throw Error('decoder unavailable');
            calls.push({url,onSuccess,onError});
        }
    }};
    const Type=vm.runInNewContext(source+';Driver2GameEngine',{
        THREE,document:{getElementById(){return status}},URL
    });
    const game=Object.create(Type.prototype);
    game.playerCar={name:'ANTES',_userCustomModel:false,
        _cc0ModelApplied:false,applyCC0Model:()=>true};
    return {game,status,calls,created,revoked};
}
function input(name){return {target:{files:[{name}],value:'selected'}};}

test('import local .glb libera URL mesmo depois de sucesso e permite escolher o mesmo arquivo',()=>{
    const h=harness(),event=input('van.glb');
    h.game.loadLocalGLB(event);
    assert.equal(event.target.value,'');
    assert.equal(h.created.length,1);
    h.calls[0].onSuccess({scene:{valid:true}});
    assert.equal(h.revoked.length,1);
    assert.match(h.status.textContent,/pronto para dirigir/);
    assert.equal(h.game.playerCar._userCustomModel,true);
    assert.equal(h.game.playerCar.name,'VAN');
    h.game.loadLocalGLB(input('van.glb'));
    h.calls[1].onError(Error('bad gltf'));
    assert.equal(h.revoked.length,2,'invalid reimport also revokes URL');
    assert.match(h.status.textContent,/Falha ao carregar o GLB/);
});

test('arquivo inválido, GLB sem geometria e decoder com exceção não deixam blob pendurado',()=>{
    const h=harness(),invalid=input('bad.gltf');
    h.game.loadLocalGLB(invalid);
    assert.equal(h.created.length,0);
    assert.match(h.status.textContent,/Escolha um arquivo .glb/);
    h.game.playerCar.applyCC0Model=()=>false;
    h.game.loadLocalGLB(input('empty.glb'));
    h.calls[0].onSuccess({scene:{}});
    assert.equal(h.revoked.length,1);
    assert.equal(h.game.playerCar._userCustomModel,false);
    assert.equal(h.game.playerCar.name,'ANTES');
    assert.match(h.status.textContent,/geometria válida/);
    const failure=harness({loadThrows:true});
    failure.game.loadLocalGLB(input('broken.glb'));
    assert.equal(failure.created.length,1);
    assert.equal(failure.revoked.length,1);
    assert.match(failure.status.textContent,/Falha ao iniciar/);
});

test('exception while applying imported GLB does not leak blob URL',()=>{
    const h=harness();
    h.game.playerCar.applyCC0Model=()=>{throw Error('WebGL exception')};
    h.game.loadLocalGLB(input('bad.glb'));
    h.calls[0].onSuccess({scene:{}});
    assert.equal(h.revoked.length,1);
    assert.match(h.status.textContent,/Erro ao aplicar/);
});

test('external loader only claims success when model applies',()=>{
    const h=harness();
    h.game.playerCar.applyCC0Model=()=>false;
    h.game.loadExternalGLB('https://cdn.example/car.glb','CARRO');
    h.calls[0].onSuccess({scene:{}});
    assert.match(h.status.textContent,/não tem geometria utilizável/);
    assert.equal(h.game.playerCar.name,'ANTES');
    assert.equal(h.game.playerCar._userCustomModel,false);
});
