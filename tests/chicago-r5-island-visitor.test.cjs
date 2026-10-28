'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Island=require('../js/world/chicago-goose-island-street.js');
const River=require('../js/world/chicago-ps1-river-branches.js');
const Road=vm.runInNewContext(read('js/world/road-geometry.js')+
    '\nDriverRoadGeometry',{Math,Number,Map,Set});
class Group{constructor(){this.children=[];this.userData={};}add(m){this.children.push(m);}}
class Mesh{constructor(){this.position={set(){}};this.userData={};}}
class Geo{constructor(...args){this.args=args;}}
class Material{constructor(o){this.args=o;}}
const THREE={Group,Mesh,BoxGeometry:Geo,
    MeshLambertMaterial:Material,MeshBasicMaterial:Material,
    MathUtils:{clamp:(n,min,max)=>Math.min(max,Math.max(min,n))}};
function make(id='chicago'){
    const c={preset:{id},cityGroup:new Group(),roadExtent:320,
        buildingBoxes:[],isTrafficGreen:()=>true,
        isWaterAt(x,z){return id==='chicago'&&River.waterAt(x,z);},
        isPointBlocked(x,z,r=1.55){return this.buildingBoxes.some(b=>
            x+r>b.minX&&x-r<b.maxX&&z+r>b.minZ&&z-r<b.maxZ);}
    };
    return c;
}
const context={Math,Number,Set,Map,WeakMap,THREE,
    DriverChicagoGooseIslandStreet:Island,
    DriverRoadGeometry:Road};
const AI=vm.runInNewContext(read('js/traffic/traffic-ai.js')+
    '\nDriverTrafficAI',context);
test('as quatro conexões de ilha são percursos físicos secos',()=>{
    const before=global.THREE,prior=global.DriverRoadGeometry;
    global.THREE=THREE;global.DriverRoadGeometry=Road;
    try{
        const city=make();const road=Island.build(city);
        assert.equal(road.accessReady,true,JSON.stringify(road.access.unsafe));
        assert.equal(road.access.links.length,4);
        assert(road.access.links.every(l=>l.safe));
        assert.equal(road.access.unsafe.length,0);
        assert.equal(road.collidersAdded,2);
        const last=road.access.links.at(-1);
        assert.equal(last.to.x,-160);
        assert.equal(last.to.z,236);
        for(const line of road.access.links)
            assert(Road.segmentDrivable(city,
                line.from.x,line.from.z,line.to.x,line.to.z,1.55));
    }finally{global.THREE=before;global.DriverRoadGeometry=prior;}
});
test('entregador vem de fora, entra, percorre rua e sai pela ponte',()=>{
    const before=global.THREE,prior=global.DriverRoadGeometry;
    global.THREE=THREE;global.DriverRoadGeometry=Road;
    try{
        const c=make();Island.build(c);
        const ai=new AI(c);
        const car={name:'ENTREGAS GOOSE ISLAND',gooseIslandVisitor:true,
            bodyStyle:'truck',x:-284,z:156,heading:Math.PI/2,
            speed:12};
        const route=ai.getRoute(car);
        assert.equal(route.target.x,-240);
        assert.equal(route.target.z,156);
        car.x=-247;
        ai.getInput(car,.016,[],null,0);
        assert.equal(route.islandApproach,true);
        assert.equal(route.target.x,-160);
        car.x=-200;car.z=156;
        ai.getInput(car,.016,[],null,0);
        assert.equal(route.isIslandSpine,true);
        assert.equal(route.islandPhase,'entry');
        assert.equal(route.target.z,185);
        car.x=-196;car.z=180;car.heading=0;car.speed=8;
        ai.getInput(car,.016,[],null,0);
        assert.equal(route.islandPhase,'traverse');
        assert.equal(route.target.z,240);
        car.z=234;
        ai.getInput(car,.016,[],null,0);
        assert.equal(route.islandVisitComplete,true);
        assert.equal(route.isIslandSpine,false);
        assert.equal(route.axis,'x');
        assert([-160,-240].includes(route.target.x));
        assert(Road.segmentDrivable(c,-196,234,
            route.target.x,route.target.z,1.55));
    }finally{global.THREE=before;global.DriverRoadGeometry=prior;}
});
test('não permitir conversão sem água segura ou para carros de missão',()=>{
    const before=global.THREE,prior=global.DriverRoadGeometry;
    global.THREE=THREE;global.DriverRoadGeometry=Road;
    try{
        const c=make();Island.build(c);
        const car={gooseIslandVisitor:true,x:-200,z:156,heading:Math.PI/2};
        assert(Island.planVisitorEntry(c,car));
        assert.equal(Island.planVisitorEntry(c,{...car,scriptedDrive:{}}),null);
        assert.equal(Island.planVisitorEntry(c,{...car,heading:Math.PI}),null);
        assert.equal(Island.planVisitorEntry(c,{...car,x:-220}),null);
        assert.equal(Island.planVisitorEntry(make('havana'),car),null);
        c.isWaterAt=(x,z)=>Math.abs(x+199)<7&&z>162&&z<180;
        assert.equal(Island.planVisitorEntry(c,car),null);
        assert.equal(Island.auditAccess(c).ready,false);
    }finally{global.THREE=before;global.DriverRoadGeometry=prior;}
});
test('R5 preserva grupo PS1 visual, cidade procedural, campanha e isolação',()=>{
    const eng=read('js/engine/driver2-game-engine.js');
    const ai=read('js/traffic/traffic-ai.js');
    const road=read('js/world/chicago-goose-island-street.js');
    assert(eng.includes("name:'ENTREGAS GOOSE ISLAND'"));
    assert(eng.includes("this.city.chicagoGooseIslandStreet.accessReady"));
    assert(ai.includes('DriverChicagoGooseIslandStreet.planVisitorEntry'));
    assert(ai.includes("route.islandPhase='traverse'"));
    assert(road.includes('accessSegments()'));
    assert(!/missionStart\s*=|saveState\s*=|scriptedDrive\s*=/.test(road));
});
