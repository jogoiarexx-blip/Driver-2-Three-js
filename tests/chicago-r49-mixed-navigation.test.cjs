'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const Road=require('../js/world/road-geometry.js');
const R48=require('../js/world/chicago-connectors-r48.js');
global.DriverRoadGeometry=Road;
global.DriverChicagoConnectorsR48=R48;
const Nav=require('../js/traffic/chicago-mixed-navigation-r49.js');
global.DriverChicagoMixedNavigationR49=Nav;
const Traffic=require('../js/traffic/chicago-mixed-traffic-r49.js');

function city(){
    return {
        preset:{id:'chicago'},roadExtent:320,buildSequence:1,
        bridgeRaised:false,buildingBoxes:[],
        chicagoConnectorsR48:{ready:true},
        isWaterAt(x,z){return z>34.85&&z<65.15&&Math.abs(x)>12.25},
        isPointBlocked(x,z,radius=0){
            return this.buildingBoxes.some(b=>
                x+radius>b.minX&&x-radius<b.maxX&&
                z+radius>b.minZ&&z-radius<b.maxZ);
        },
        isTrafficGreen(){return true}
    };
}
test('R49: graph joins secondary R48 intersections to the original 80-unit grid',()=>{
    const c=city(),g=Nav.compile(c);
    assert.equal(g.secondaryNodes,6);
    assert.equal(g.gateways,10);
    assert(g.nodes.size>=95);
    assert(g.edges>=150);
    assert(g.adj.get('120,-120').some(n=>n.key==='120,-160'));
    assert(g.adj.get('120,-160').some(n=>n.key==='80,-160'));
    assert(g.adj.get('0,-120').some(n=>n.key==='0,-160'));
    assert.equal(Nav.compile(c),g);
});
test('R49: A* travels from a neighborhood to legacy streets without crossing water or walls',()=>{
    const c=city();
    for(const [from,goal] of [
        [{x:120,z:-120},{x:0,z:-240}],
        [{x:0,z:-160},{x:200,z:-40}],
        [{x:240,z:-160},{x:40,z:-120}],
        [{x:200,z:-40},{x:0,z:-160}]
    ]){
        const p=Nav.plan(c,from,goal);
        assert(p&&p.length>2,'missing route '+JSON.stringify([from,goal]));
        assert(p.some(n=>n.x===40||n.x===120||n.x===200));
        for(let i=1;i<p.length;i++)
            assert(Nav.clear(c,p[i-1],p[i]),
                'unsafe road segment '+JSON.stringify([p[i-1],p[i]]));
    }
});
test('R49: dynamic bridge status invalidates cached graph and blocks unsafe crossing',()=>{
    const c=city(),g=Nav.compile(c);
    assert(Nav.plan(c,{x:0,z:0},{x:0,z:80}));
    c.bridgeRaised=true;
    const raised=Nav.compile(c);
    assert.notEqual(raised,g);
    assert.equal(Nav.plan(c,{x:0,z:0},{x:0,z:80}),null);
    c.bridgeRaised=false;
    assert(Nav.plan(c,{x:0,z:0},{x:0,z:80}));
});
test('R49: roadblock in neighborhood detours rather than crossing new building collision',()=>{
    const c=city();
    c.buildingBoxes.push({minX:78,maxX:83,minZ:-127,maxZ:-113});
    const graph=Nav.compile(c);
    assert(!graph.adj.get('40,-120').some(x=>x.key==='120,-120'));
    const p=Nav.plan(c,{x:40,z:-120},{x:120,z:-120});
    assert(p&&p.length>2);
    for(let i=1;i<p.length;i++)assert(Nav.clear(c,p[i-1],p[i]));
    c.buildingBoxes.push({minX:195,maxX:205,minZ:-125,maxZ:-115});
    assert.notEqual(Nav.compile(c),graph);
});
test('R49: civilian NPCs use new district-to-district plans and stop behind traffic',()=>{
    const c=city(),cars=Traffic.spawnSpecs(c);
    assert.equal(cars.length,4);
    assert(cars.every(x=>x.bodyStyle==='sedan'));
    for(const spec of cars){
        const car={...spec,speed:0,chicagoMixedTrafficR49:true,
            chicagoMixedTrafficGoalIndex:spec.goalIndex};
        const first=Traffic.getInput(c,car,[car],.05,[]);
        assert(first&&typeof first.up==='boolean');
        assert(car.chicagoMixedTrafficStatusR49?.target);
        assert(!Traffic.getInput(c,{...car,scriptedDrive:{}},[],.05,[]));
        assert(!Traffic.getInput(c,{...car,isPolice:true},[],.05,[]));
    }
    const spec=cars[0];
    const car={...spec,speed:4,chicagoMixedTrafficR49:true,
        chicagoMixedTrafficGoalIndex:spec.goalIndex};
    const nearby={x:car.x+Math.sin(car.heading)*4,
        z:car.z+Math.cos(car.heading)*4,y:0};
    const input=Traffic.getInput(c,car,[car,nearby],.05,[]);
    assert(input.down&&!input.up);
    assert.equal(car.chicagoMixedTrafficStatusR49.speedLimit,0);
    assert.deepEqual(Traffic.spawnSpecs({...c,preset:{id:'rio'}}),[]);
});
test('R49: integration keeps scripted missions on original navigation and boots in both Chicago modes',()=>{
    const html=fs.readFileSync('index.html','utf8'),
        ai=fs.readFileSync('js/traffic/traffic-ai.js','utf8'),
        engine=fs.readFileSync('js/engine/driver2-game-engine.js','utf8');
    const ix=s=>html.indexOf(s);
    assert(ix('chicago-mixed-navigation-r49.js')>=0);
    assert(ix('chicago-mixed-traffic-r49.js')>=0);
    assert(ix('chicago-mixed-navigation-r49.js')<ix('city-builder.js'));
    assert(ix('chicago-mixed-traffic-r49.js')<ix('traffic-ai.js'));
    assert(ai.includes('DriverChicagoMixedNavigationR49.follow('));
    assert(ai.includes('DriverChicagoMixedTrafficR49.getInput('));
    assert(ai.includes('DriverPursuitNavigation.follow('));
    assert(ai.includes('DriverTailingDropMission.advanceRoute('));
    assert(engine.includes('DriverChicagoMixedTrafficR49.spawnSpecs('));
    assert(engine.includes('civ.chicagoMixedTrafficR49=true'));
    assert(engine.includes('this.spawnAllVehicles();'));
    assert(engine.includes("this.startMission('freeroam')"));
});
