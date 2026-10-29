'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/traffic/traffic-ai.js'),'utf8');
const AI=vm.runInNewContext(source+'\nDriverTrafficAI',
    {Math,Map,Set,WeakMap,Number,THREE:{
        MathUtils:{clamp:(v,lo,hi)=>Math.min(hi,Math.max(lo,v))}
    }});
function city(id='chicago') {
    let checks=0;
    return {preset:{id},roadExtent:320,
        isPointBlocked:()=>false,isWaterAt:()=>false,
        isTrafficGreen(){checks++;return false;},
        get checks(){return checks;}
    };
}
const route=(target,axis='z')=>({
    axis,road:-200,sign:1,target,
    previousX:-196,previousZ:166,
    stuckSeconds:0,reverseTimer:0
});
test('semáforos só estão nos cruzamentos REAIS da grade para carros locais',()=>{
    const c=city(),ai=new AI(c);
    const delivery={gooseIslandVisitor:true};
    for(const car of [
        delivery,{gooseIslandNorthYard:true},
        {gooseIslandSouthbound:true},
        {gooseIslandRoute:true}
    ]) {
        assert.equal(ai.signalApplies(car,route({x:-196,z:185})),false);
        assert.equal(ai.signalApplies(car,route({x:-196,z:320})),false);
        assert.equal(ai.signalApplies(car,route({x:-160,z:236})),false);
        assert.equal(ai.signalApplies(car,route({x:-156,z:316})),true);
        assert.equal(ai.signalApplies(car,route({x:-160,z:156})),true);
    }
    assert.equal(ai.signalApplies({},route({x:-196,z:185})),true);
    assert.equal(ai.signalApplies(delivery,route({x:-196,z:185}),true),true);
    assert.equal(ai.signalApplies(delivery,{target:{x:Infinity,z:185}}),false);
    assert.equal(new AI(city('rio')).signalApplies(delivery,
        route({x:-196,z:185})),true);
});
test('caminhão não freia por sinal fictício no meio da rua industrial',()=>{
    const c=city(),ai=new AI(c);
    const truck={name:'ENTREGAS GOOSE ISLAND',gooseIslandVisitor:true,
        x:-196,z:166,heading:0,speed:0,bodyStyle:'truck'};
    const path=route({x:-196,z:185});
    ai.routes.set(truck,path);
    const input=ai.getInput(truck,.05,[],null,0);
    assert.equal(input.up,true);
    assert.equal(input.down,false);
    assert.equal(c.checks,0,'Semáforo inexistente não deve ser consultado');
});
test('caminhão respeita vermelho próximo de cruzamento sinalizado',()=>{
    const c=city(),ai=new AI(c);
    const truck={gooseIslandVisitor:true,
        x:-175,z:156,heading:Math.PI/2,speed:4,bodyStyle:'truck'};
    const path=route({x:-160,z:156},'x');
    path.previousX=truck.x;path.previousZ=truck.z;
    ai.routes.set(truck,path);
    const input=ai.getInput(truck,.05,[],null,0);
    assert.equal(input.up,false);
    assert.equal(input.down,true);
    assert.equal(c.checks,1);
});
test('carro comum e outra cidade mantêm suas regras de semáforos',()=>{
    for(const id of ['chicago','havana','rio','vegas']){
        const c=city(id),ai=new AI(c);
        const car={x:-196,z:166,heading:0,speed:5,bodyStyle:'muscle'};
        ai.routes.set(car,route({x:-196,z:185}));
        const input=ai.getInput(car,.05,[],null,0);
        assert.equal(input.up,false,id);
        assert.equal(input.down,true,id);
        assert.equal(c.checks,1,id);
    }
});
