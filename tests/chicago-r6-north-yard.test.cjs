'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const North=require('../js/world/chicago-goose-island-north-yard.js');
const R4=require('../js/world/chicago-goose-island-street.js');
const River=require('../js/world/chicago-ps1-river-branches.js');
const Road=vm.runInNewContext(read('js/world/road-geometry.js')+
    '\nDriverRoadGeometry',{Math,Number,Map,Set});
class Group {
    constructor(){this.children=[];this.userData={};}
    add(child){this.children.push(child);}
}
class Mesh {
    constructor(geometry,material){
        this.geometry=geometry;this.material=material;
        this.userData={};
        this.position={set(x,y,z){this.x=x;this.y=y;this.z=z;}};
    }
}
class Geometry{constructor(...x){this.args=x;}}
class Material{constructor(opts){this.opts=opts;}}
const THREE={Group,Mesh,BoxGeometry:Geometry,
    MeshBasicMaterial:Material,MeshLambertMaterial:Material,
    MathUtils:{clamp:(x,a,b)=>Math.min(b,Math.max(a,x))}};
function fixture(name='chicago'){
    const city={preset:{id:name},cityGroup:new Group(),roadExtent:320,
        buildingBoxes:[],isTrafficGreen:()=>true,
        isWaterAt(x,z){
            if(name==='chicago'&&North.isBridgeDeck(x,z))return false;
            return name==='chicago'&&River.waterAt(x,z);
        },
        isPointBlocked(x,z,radius=1.55){
            return this.buildingBoxes.some(b=>
                x+radius>b.minX&&x-radius<b.maxX &&
                z+radius>b.minZ&&z-radius<b.maxZ);
        }
    };
    return city;
}
function built(name='chicago'){
    const previous=global.THREE,oldRoad=global.DriverRoadGeometry;
    global.THREE=THREE;global.DriverRoadGeometry=Road;
    const city=fixture(name);
    try{
        R4.build(city);
        North.build(city);
    }finally{
        global.THREE=previous;
        global.DriverRoadGeometry=oldRoad;
    }
    return city;
}
test('extensão R6 adiciona uma rua, um deck e dois galpões com AABB',()=>{
    const c=built(),result=c.chicagoGooseIslandNorthYard;
    assert(result);
    assert.equal(result.mode,'procedural-r6-north-yard');
    assert.equal(result.streetLength,80);
    assert.equal(result.bridgeCount,1);
    assert.equal(result.collidersAdded,2);
    assert.equal(result.geometryCertified,false);
    assert.equal(result.missionCoordsChanged,false);
    assert.equal(c.buildingBoxes.length,4);
    assert.equal(result.group.children.filter(x=>x.name==='goose-island-r6-north-bridge').length,1);
    assert.equal(result.group.children.filter(x=>/goose-island-r6-industrial/.test(x.name)).length,2);
    assert(North.isCarvedBlock(-200,280));
    assert(!North.isCarvedBlock(-200,200));
    assert(North.onNorthernSpine(-196,260));
    assert(!North.onNorthernSpine(-160,260));
    assert.equal(North.build(c),result,'não duplicar galpões ao reconstruir');
    assert.equal(built('rio').chicagoGooseIslandNorthYard,undefined);
});
test('a ponte R6 torna seco apenas o leito sobre o deck em z=306.3',()=>{
    const c=built();
    assert(River.waterAt(-200,306.3),'R2 tinha canal neste ponto');
    assert.equal(c.isWaterAt(-200,306.3),false);
    assert.equal(c.isWaterAt(-196,306.3),false);
    assert.equal(c.isWaterAt(-220,306.3),true);
    assert.equal(c.isWaterAt(-200,294.5),false);
    assert.equal(c.isWaterAt(-240,300),true);
    assert.equal(c.isWaterAt(-160,300),true);
    assert.equal(c.isWaterAt(400,-100),false);
    assert.equal(c.isWaterAt(-200,306.3),false);
});
test('quatro segmentos verificados: rua R4, extensão, deck, saída norte',()=>{
    const c=built(),audit=c.chicagoGooseIslandNorthYard.access;
    assert.equal(c.chicagoGooseIslandNorthYard.accessReady,true,
        JSON.stringify(audit.unsafe));
    assert.equal(audit.segments.length,4);
    assert(audit.segments.every(s=>s.safe));
    for(const s of audit.segments)
        assert(Road.segmentDrivable(c,
            s.a.x,s.a.z,s.b.x,s.b.z,1.65));
    assert.equal(North.testCorridor(c),true);
    assert.equal(North.onDrivableCorridor(c,-196,306.3),true);
    c.isWaterAt=(x,z)=>Math.abs(x+196)<4&&Math.abs(z-306.3)<2;
    assert.equal(North.audit(c).ready,false,'água invade a ponte');
    assert.equal(North.testCorridor(c),false,'não gerar veículos sem deck seco');
});
test('caminhão do pátio chega à avenida z=320 sem usar a grade intermediária',()=>{
    const c=built();
    const AI=vm.runInNewContext(read('js/traffic/traffic-ai.js')+
        '\nDriverTrafficAI',{
            Math,Map,Set,WeakMap,Number,THREE,
            DriverChicagoGooseIslandStreet:R4,
            DriverChicagoGooseIslandNorthYard:North,
            DriverRoadGeometry:Road
        });
    const ai=new AI(c);
    const car={name:'CARGA NORTE GOOSE ISLAND',
        gooseIslandNorthYard:true,x:-196,z:260,
        heading:0,speed:9,bodyStyle:'truck'};
    const r=ai.getRoute(car);
    assert.equal(r.isNorthYard,true);
    assert.equal(r.axis,'z');
    assert.equal(r.target.z,320);
    car.z=312;
    ai.chooseNext(car,r,null,false);
    assert.equal(r.isNorthYard,false);
    assert.equal(r.northYardCompleted,true);
    assert.equal(r.axis,'x');
    assert.equal(r.road,320);
    assert.equal(r.target.z,316);
    assert([-160,-240].includes(r.target.x));
    assert(Road.segmentDrivable(c,car.x,car.z,
        r.target.x,r.target.z));
    assert.equal(ai.getRoute({
        x:-196,z:260,heading:0,speed:2,
        scriptedDrive:{done:false},
        gooseIslandNorthYard:true
    }).isNorthYard,undefined);
});
test('integração só adiciona lote industrial norte, sem reposicionar missões',()=>{
    const city=read('js/world/city-builder.js');
    const engine=read('js/engine/driver2-game-engine.js');
    const index=read('index.html');
    assert(city.includes('DriverChicagoGooseIslandNorthYard.isCarvedBlock(blockX,blockZ)'));
    assert(city.includes('DriverChicagoGooseIslandNorthYard.build(this)'));
    assert(city.includes('DriverChicagoGooseIslandNorthYard.isBridgeDeck(x,z)'));
    assert(engine.includes("name:'CARGA NORTE GOOSE ISLAND'"));
    assert(index.indexOf('chicago-goose-island-north-yard.js')<
           index.indexOf('city-builder.js'));
    assert(index.indexOf('chicago-goose-island-north-yard.js')<
           index.indexOf('traffic-ai.js'));
    assert(!/missionStart\s*=|saveState\s*=|scriptedDrive\s*=/.test(
        read('js/world/chicago-goose-island-north-yard.js')));
});
