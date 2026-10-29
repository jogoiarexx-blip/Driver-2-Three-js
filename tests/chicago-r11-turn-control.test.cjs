'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const Turn=require('../js/traffic/chicago-local-turn-control.js');
const source=fs.readFileSync(path.join(root,'js/traffic/traffic-ai.js'),'utf8');
const AI=vm.runInNewContext(source+'\nDriverTrafficAI',{
    Math,Map,Set,WeakMap,Number,
    DriverChicagoLocalTurnControl:Turn,
    THREE:{MathUtils:{clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}}
});
const city=id=>({preset:{id},roadExtent:320,
    isWaterAt:()=>false,isPointBlocked:()=>false,
    isTrafficGreen:()=>true,buildingBoxes:[]});
function route(to,phase={}){
    return {axis:'x',road:160,sign:1,target:to,
        previousX:-225,previousZ:156,reverseTimer:0,stuckSeconds:0,...phase};
}
test('R11 antecipa curva oeste-para-norte antes de mudar o waypoint',()=>{
    const c=city('chicago'),car={
        gooseIslandVisitor:true,x:-225,z:156,
        heading:Math.PI/2,speed:16.5,bodyStyle:'truck'};
    const r=route({x:-160,z:156},{islandApproach:true});
    assert.equal(Turn.pendingTurn(c,car,r).distance,25);
    assert.equal(Turn.speedLimit(c,car,r).reason,'visitor-west-to-north');
    const ai=new AI(c);ai.routes.set(car,r);
    const input=ai.getInput(car,.05,[],null,0);
    assert.equal(input.down,true,'caminhão deve frear 25u antes da curva');
    assert.equal(input.up,false);
    assert.equal(r.localTurnAssist,'visitor-west-to-north');
    assert(r.localTurnSpeed<16.5);
});
test('R11 não freia sem necessidade a 35u da esquina ou outras cidades',()=>{
    const r=route({x:-160,z:156},{islandApproach:true});
    const sample={gooseIslandVisitor:true,x:-235,z:156,
        heading:Math.PI/2,speed:16,bodyStyle:'truck'};
    assert.equal(Turn.speedLimit(city('chicago'),sample,r),null);
    assert.equal(Turn.speedLimit(city('rio'),{...sample,x:-210},r),null);
    assert.equal(Turn.speedLimit(city('chicago'),{...sample,x:-210,scriptedDrive:{}},r),null);
    const c=city('chicago'),ai=new AI(c);
    const outsider={x:-225,z:156,heading:Math.PI/2,speed:16.5,bodyStyle:'truck'};
    ai.routes.set(outsider,route({x:-160,z:156},{islandApproach:true}));
    const controls=ai.getInput(outsider,.05,[],null,0);
    assert.equal(controls.up,true);
    assert.equal(controls.down,false);
});
test('limite progressivo nos dois sentidos da ponte e na via industrial',()=>{
    const c=city('chicago');
    const scenarios=[
        [{gooseIslandRoute:true,x:-196,z:225,heading:0},
         {isIslandSpine:true,axis:'z',sign:1},'island-north-exit'],
        [{gooseIslandVisitor:true,x:-196,z:176,heading:0},
         {isIslandSpine:true,islandPhase:'entry',sign:1},'visitor-entry-bend'],
        [{gooseIslandNorthYard:true,x:-196,z:305,heading:0},
         {isNorthYard:true,sign:1},'north-deck-exit'],
        [{gooseIslandSouthbound:true,x:-204,z:254,heading:Math.PI},
         {isNorthYardSouth:true,sign:-1},'south-deck-exit']
    ];
    for(const [vehicle,phase,name] of scenarios){
        assert.equal(Turn.speedLimit(c,vehicle,phase).reason,name);
        const near=Turn.speedLimit(c,vehicle,phase).speed;
        const further={...vehicle};
        if(name==='south-deck-exit')further.z+=12;else further.z-=12;
        const far=Turn.speedLimit(c,further,phase);
        if(far)assert(far.speed>=near);
    }
});
test('R11 preserva pontos de missão e controles de condução do jogador',()=>{
    const script=fs.readFileSync(path.join(root,'js/traffic/chicago-local-turn-control.js'),'utf8');
    const ai=source;
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    assert(html.indexOf('chicago-local-turn-control.js')<
        html.indexOf('traffic-ai.js'));
    assert.match(ai,/DriverChicagoLocalTurnControl.speedLimit/);
    assert.doesNotMatch(script,/missionStart\s*=|scriptedDrive\s*=|updatePhysics\(|car\.x\s*=|car\.z\s*=/);
    assert.equal(Turn.speedLimit(city('chicago'),{gooseIslandVisitor:true,x:NaN,z:0},
        {islandApproach:true}),null);
});
