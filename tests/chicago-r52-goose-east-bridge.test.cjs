'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Road=require('../js/world/road-geometry.js');
const River=require('../js/world/chicago-ps1-river-branches.js');
const North=require('../js/world/chicago-goose-island-north-yard.js');
const R48=require('../js/world/chicago-connectors-r48.js');
const R50=require('../js/world/chicago-connectors-r50.js');
const R52=require('../js/world/chicago-goose-east-r52.js');
global.DriverRoadGeometry=Road;
global.DriverChicagoConnectorsR48=R48;
global.DriverChicagoConnectorsR50=R50;
global.DriverChicagoGooseEastR52=R52;
const Nav=require('../js/traffic/chicago-mixed-navigation-r49.js');
global.DriverChicagoMixedNavigationR49=Nav;
const Traffic=require('../js/traffic/chicago-mixed-traffic-r49.js');
const Telemetry=require('../js/engine/driver-traffic-telemetry-r50.js');
function three(){
    class Obj{
        constructor(){this.children=[];this.userData={};
            this.position={set(x,y,z){Object.assign(this,{x,y,z})}};
            this.rotation={set(){}};
            this.scale={set(){}};}
        add(x){this.children.push(x)}
        updateMatrix(){this.matrix={}}
    }
    class Mesh extends Obj{constructor(g,m){super();this.geometry=g;this.material=m}}
    class Instances extends Mesh{
        constructor(g,m,count){super(g,m);this.count=count;
            this.instanceMatrix={needsUpdate:false};}
        setMatrixAt(i){assert(i>=0&&i<this.count);}
    }
    return {Group:Obj,Object3D:Obj,Mesh,InstancedMesh:Instances,
        BoxGeometry:class{},MeshLambertMaterial:class{},
        MeshBasicMaterial:class{}};
}
function city(){
    const c={preset:{id:'chicago'},roadExtent:320,buildSequence:1,
        bridgeRaised:false,buildingBoxes:[],
        cityGroup:{children:[],add(x){this.children.push(x)}},
        chicagoPS1StreetNetwork:{radarPaths:[]},
        isWaterAt(x,z){
            if(North.isBridgeDeck(x,z))return false;
            return River.waterAt(x,z);
        },
        isPointBlocked(x,z,r=0){
            return this.buildingBoxes.some(b=>
                x+r>b.minX&&x-r<b.maxX&&z+r>b.minZ&&z-r<b.maxZ);
        },
        isTrafficGreen:()=>true
    };
    return c;
}
function build(){
    const c=city();
    R48.build(c);R50.build(c);R52.build(c);
    return c;
}
test('R52 carves four new blocks while keeping Goose Island and protected landmarks',()=>{
    assert.deepEqual(R52.X,[-120,-40]);
    assert.deepEqual(R52.Z,[200,280]);
    assert.equal(R52.isCarvedBlock(-120,200),true);
    assert.equal(R52.isCarvedBlock(-40,280),true);
    assert.equal(R52.isCarvedBlock(-200,200),false);
    assert.equal(R52.isCarvedBlock(-120,-120),false);
    assert.equal(R52.topology().edges.length,18);
    assert.equal(R52.topology().gridExits,10);
    assert.equal(R52.streets().length,5);
    const c=city();
    assert.deepEqual(R52.audit(c).blocked,[]);
    assert.equal(R52.audit({...c,preset:{id:'vegas'}}),null);
});
test('R52 builds visible roads, six crossings and real collision lots without a phantom wall',()=>{
    global.THREE=three();
    try{
        const c=build(),r=c.chicagoGooseEastR52;
        assert.equal(r.ready,true,JSON.stringify(r.blocked));
        assert.equal(r.corridorsBuilt,5);
        assert.equal(r.crossingsBuilt,6);
        assert.equal(r.buildingsBuilt,8);
        assert.equal(r.sidewalksBuilt,16);
        assert.equal(r.pedestrianStripes,96);
        assert.equal(c.cityGroup.children.length,3);
        assert.equal(c.buildingBoxes.filter(b=>b.chicagoR52Lot).length,8);
        assert.equal(c.chicagoPS1StreetNetwork.radarPaths.length,15);
        assert.equal(R52.build(c),r);
        assert.equal(c.buildingBoxes.filter(b=>b.chicagoR52Lot).length,8);
        assert(R52.audit(c).ready);
    }finally{delete global.THREE}
});
test('R52 fixed east Goose Island bridge is drivable; the water to either side is not',()=>{
    global.THREE=three();
    try{
        const c=build(),graph=Nav.compile(c);
        assert.equal(graph.gooseEastLinks,18);
        assert.equal(graph.secondaryNodes,18);
        assert.equal(graph.gateways,30);
        assert.equal(c.isWaterAt(-160,240),false);
        assert.equal(c.isWaterAt(-160,200),true);
        const path=Nav.plan(c,{x:-200,z:240},{x:120,z:200});
        assert(path&&path.length>=7);
        assert(path.some(p=>p.x===-160&&p.z===240));
        assert(path.some(p=>p.x===-120&&p.z===240));
        for(let i=1;i<path.length;i++)
            assert(Nav.clear(c,path[i-1],path[i]),
                'bridge path crosses water or building');
        const crossing=Nav.plan(c,{x:-200,z:200},{x:-40,z:200});
        assert(crossing);
        // The A* may choose the older fixed z=160 bridge instead of z=240.
        // Both are valid; never require a longer route just to use R52.
        assert(crossing.some(p=>p.x===-160&&[160,240].includes(p.z)));
        for(let i=1;i<crossing.length;i++)
            assert(Nav.clear(c,crossing[i-1],crossing[i]));
    }finally{delete global.THREE}
});
test('R52 audit rejects a blocked fixed bridge instead of putting AI on a wall',()=>{
    const c=city();
    c.buildingBoxes.push({minX:-167,maxX:-154,minZ:236,maxZ:244});
    const a=R52.audit(c);
    assert.equal(a.ready,false);
    assert(a.blocked.includes('existing-bridge-east')||
        a.blocked.includes('existing-bridge-westbank'));
});
test('R52 commute generation uses all three connected districts and preserves other cities',()=>{
    global.THREE=three();
    try{
        const c=build(),specs=Traffic.spawnSpecs(c,[]);
        assert.equal(specs.length,12);
        assert.equal(specs.filter(s=>s.goalIndex>=14).length,4);
        for(const spec of specs.filter(s=>s.goalIndex>=14)){
            assert(!c.isWaterAt(spec.x,spec.z));
            assert(!c.isPointBlocked(spec.x,spec.z,1.55));
            assert(Nav.plan(c,spec,Traffic.GOALS[spec.goalIndex]));
        }
        assert.deepEqual(Traffic.spawnSpecs({...c,preset:{id:'rio'}},[]),[]);
    }finally{delete global.THREE}
});
test('R52 physical sidewalks equal instanced slabs while road intersections stay flat',()=>{
    global.THREE=three();
    try{
        const c=build();
        assert(Math.abs(Road.localPavementHeight(c,-96,224)-.273)<.001);
        assert(Math.abs(Road.localPavementHeight(c,63,-97)-.28)<.001);
        assert(Math.abs(Road.localPavementHeight(c,63,223)-.28)<.001);
        assert.equal(Road.localPavementHeight(c,-120,240),0);
        assert.equal(Road.localPavementHeight(c,-160,240),0);
        const City=vm.runInNewContext(
            fs.readFileSync('js/world/city-builder.js','utf8')+'\nCityBuilder',
            {DriverRoadGeometry:Road});
        const ground=City.prototype.getGroundHeightAt;
        const context={...c,interiorFloorAt:()=>false,
            getSidewalkHeightAt:()=>0,bridgeAngle:0};
        assert(Math.abs(ground.call(context,-96,224,0)-.273)<.001);
        assert.equal(ground.call(context,-120,240,0),0);
    }finally{delete global.THREE}
});
test('R52 telemetry counts traffic and stalls at the existing fixed bridge',()=>{
    global.THREE=three();
    try{
        const c=build(),telemetry=new Telemetry();
        const car={x:-170,z:240,y:0,speed:0,damage:0,
            chicagoMixedTrafficR49:true,chicagoMixedTrafficGoalIndex:16,
            chicagoMixedTrafficStatusR49:{speedLimit:9}};
        const game={currentCityKey:'chicago',city:c,vehicles:[car],
            playerCar:null,missionType:'freeroam'};
        assert.equal(telemetry.sample(game,.5,.06),null);
        const report=telemetry.sample(game,.55,.018);
        assert.equal(report.streetsR52,5);
        assert.equal(report.r52Cars,1);
        assert.equal(report.eastBridgeVehicles,1);
        assert.equal(report.gooseEastStalls,0);
        assert(report.graphNodes>100);
    }finally{delete global.THREE}
});
test('R52 boots before CityBuilder and uses shared Undercover/Take A Ride spawn',()=>{
    const html=fs.readFileSync('index.html','utf8'),
        city=fs.readFileSync('js/world/city-builder.js','utf8'),
        engine=fs.readFileSync('js/engine/driver2-game-engine.js','utf8');
    assert(html.includes('chicago-goose-east-r52.js'));
    assert(html.indexOf('chicago-goose-east-r52.js')<
        html.indexOf('city-builder.js'));
    assert(city.includes('DriverChicagoGooseEastR52.isCarvedBlock('));
    assert(city.includes('DriverChicagoGooseEastR52.build(this)'));
    assert(engine.includes('DriverChicagoMixedTrafficR49.spawnSpecs('));
    assert(engine.includes('this.spawnAllVehicles();'));
    assert(engine.includes("this.startMission('freeroam')"));
});
