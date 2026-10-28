'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Island=require('../js/world/chicago-goose-island-street.js');
const River=require('../js/world/chicago-ps1-river-branches.js');
const Road=vm.runInNewContext(read('js/world/road-geometry.js')+
    '\nDriverRoadGeometry',{Math,Number,Map,Set});
class Group {
    constructor(){this.children=[];this.userData={};}
    add(obj){this.children.push(obj);}
}
class Mesh {
    constructor(geometry,material){
        this.geometry=geometry;this.material=material;
        this.userData={};this.position={set(x,y,z){
            this.x=x;this.y=y;this.z=z;
        }};
    }
}
class Geometry {constructor(...args){this.args=args;}}
class Material {constructor(args){this.args=args;}}
const THREE={Group,Mesh,BoxGeometry:Geometry,
    MeshLambertMaterial:Material,MeshBasicMaterial:Material};
function fixture(preset='chicago'){
    return {
        preset:{id:preset},cityGroup:new Group(),roadExtent:320,
        buildingBoxes:[{minX:30,maxX:40,minZ:30,maxZ:40}],
        isWaterAt(x,z){return River.waterAt(x,z) ||
            (z>34.85&&z<65.15&&Math.abs(x)>12.25);},
        isPointBlocked(x,z,radius=1.55){
            return this.buildingBoxes.some(b=>
                x+radius>b.minX&&x-radius<b.maxX &&
                z+radius>b.minZ&&z-radius<b.maxZ);
        }
    };
}
test('ilha preserva duas pontes e cria UMA via off-grid',()=>{
    assert(Island.isCarvedBlock(-200,200));
    assert(!Island.isCarvedBlock(-200,120));
    assert(!Island.isCarvedBlock(-120,200));
    assert(!Island.isCarvedBlock(-200,-200));
    assert(Island.isOnSpine(-196,184));
    assert(Island.isOnSpine(-204,218));
    assert(!Island.isOnSpine(-160,200));
    assert(!Island.isOnSpine(-200,280));
    assert.equal(Island.lanePosition(1,240).x,-196);
    assert.equal(Island.lanePosition(-1,160).x,-204);
    for(const z of [160,200,240])
        assert.equal(River.waterAt(-200,z),false);
});
test('substitui somente parque livre por galpões físicos sem bloquear rua',()=>{
    const prior=global.THREE;
    global.THREE=THREE;
    try {
        const c=fixture();
        const baseline=c.buildingBoxes.length;
        const result=Island.build(c);
        assert.equal(result.length,80);
        assert.equal(result.collidersAdded,2);
        assert.equal(c.buildingBoxes.length,baseline+2);
        assert.equal(result.originalGeometryCertified,false);
        assert.equal(result.group.children.filter(o=>o.name==='goose-island-r4-asphalt').length,1);
        assert.equal(result.group.children.filter(o=>o.name.startsWith('goose-island-r4-warehouse')).length,2);
        assert.equal(Island.build(c),result,'não criar duas avenidas');
        assert.equal(Island.testCorridor(c),true,'via deve caber entre galpões');
        for(const z of [162,176,190,200,220,235,238])
            for(const x of [-204,-196])
                assert(!c.isPointBlocked(x,z,1.55) &&
                    !c.isWaterAt(x,z),'faixa bloqueada');
        const foreign=fixture('rio');
        assert.equal(Island.build(foreign),null);
        assert.equal(foreign.buildingBoxes.length,1);
    } finally {global.THREE=prior;}
});
test('a IA segue a nova avenida, depois sai por uma das pontes R2',()=>{
    const c=fixture(),prior=global.THREE;global.THREE=THREE;
    try{Island.build(c);}finally{global.THREE=prior;}
    const A=vm.runInNewContext(read('js/traffic/traffic-ai.js')+
        '\nDriverTrafficAI',{
            Math,Map,WeakMap,Set,Number,
            THREE:{MathUtils:{clamp:(v,min,max)=>Math.max(min,Math.min(max,v))}},
            DriverChicagoGooseIslandStreet:Island,
            DriverRoadGeometry:Road
        });
    const ai=new A(c);
    const van={x:-196,z:184,heading:0,speed:5};
    const route=ai.getRoute(van);
    assert.equal(route.isIslandSpine,true);
    assert.equal(route.road,-200);
    assert.deepEqual(JSON.parse(JSON.stringify(route.target)),
        {x:-196,z:240});
    van.z=235;
    ai.chooseNext(van,route,null,false);
    assert.equal(route.isIslandSpine,false);
    assert.equal(route.axis,'x');
    assert([1,-1].includes(route.sign));
    assert([-160,-240].includes(route.target.x));
    assert(Road.segmentDrivable(c,van.x,van.z,
        route.target.x,route.target.z));
    const foreign=fixture('rio');
    const aiRio=new A(foreign),car={x:-196,z:184,heading:0};
    assert.equal(aiRio.getRoute(car).isIslandSpine,undefined);
});
test('uma única entrada de tráfego industrial e nenhum deslocamento de missão',()=>{
    const world=read('js/world/city-builder.js');
    const engine=read('js/engine/driver2-game-engine.js');
    const html=read('index.html');
    assert.match(world,/DriverChicagoGooseIslandStreet\.isCarvedBlock\(blockX,blockZ\)/);
    assert.match(world,/DriverChicagoGooseIslandStreet\.build\(this\)/);
    assert.match(engine,/name:'FURGÃO GOOSE ISLAND'/);
    assert.match(engine,/DriverChicagoGooseIslandStreet\.testCorridor/);
    assert(html.indexOf('chicago-goose-island-street.js')<
        html.indexOf('city-builder.js'));
    assert(html.indexOf('chicago-goose-island-street.js')<
        html.indexOf('traffic-ai.js'));
    assert(!/missionStart\s*=|scriptedDrive\s*=|saveState\s*=/.test(
        read('js/world/chicago-goose-island-street.js')));
});
