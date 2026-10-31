'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Road=require('../js/world/road-geometry.js');
const River=require('../js/world/chicago-ps1-river-branches.js');
const North=require('../js/world/chicago-goose-island-north-yard.js');
const R48=require('../js/world/chicago-connectors-r48.js');
const R50=require('../js/world/chicago-connectors-r50.js');
const R52=require('../js/world/chicago-goose-east-r52.js');
const R53=require('../js/world/chicago-west-canal-r53.js');
global.DriverRoadGeometry=Road;
global.DriverChicagoConnectorsR48=R48;
global.DriverChicagoConnectorsR50=R50;
global.DriverChicagoGooseEastR52=R52;
global.DriverChicagoWestCanalR53=R53;
const Nav=require('../js/traffic/chicago-mixed-navigation-r49.js');
global.DriverChicagoMixedNavigationR49=Nav;
const Traffic=require('../js/traffic/chicago-mixed-traffic-r49.js');
const Telemetry=require('../js/engine/driver-traffic-telemetry-r50.js');

function three(){
    class Obj {
        constructor(){
            this.children=[];this.userData={};
            this.position={set(x,y,z){Object.assign(this,{x,y,z})}};
            this.rotation={set(){}};this.scale={set(){}};
        }
        add(o){this.children.push(o)}
        updateMatrix(){this.matrix={}}
    }
    class Mesh extends Obj{
        constructor(g,m){super();this.geometry=g;this.material=m}
    }
    class Inst extends Mesh{
        constructor(g,m,n){super(g,m);this.count=n;
            this.instanceMatrix={needsUpdate:false};}
        setMatrixAt(i){assert(i>=0&&i<this.count)}
    }
    return {Group:Obj,Object3D:Obj,Mesh,InstancedMesh:Inst,
        BoxGeometry:class{},CylinderGeometry:class{},
        MeshLambertMaterial:class{},MeshBasicMaterial:class{}};
}
function city(){
    return {
        preset:{id:'chicago'},roadExtent:320,bridgeRaised:false,
        buildSequence:1,buildingBoxes:[],
        chicagoPS1RiverBranches:{bridgeCount:10},
        chicagoPS1StreetNetwork:{radarPaths:[]},
        cityGroup:{children:[],add(x){this.children.push(x)}},
        isWaterAt(x,z){
            return North.isBridgeDeck(x,z)?false:River.waterAt(x,z);
        },
        isPointBlocked(x,z,r=0){
            return this.buildingBoxes.some(b=>
                x+r>b.minX&&x-r<b.maxX&&z+r>b.minZ&&z-r<b.maxZ);
        },
        isTrafficGreen:()=>true
    };
}
function build(){
    const c=city();
    R48.build(c);R50.build(c);R52.build(c);R53.build(c);
    return c;
}
test('R53 uses only existing western bridge and dry eastern outlet',()=>{
    const c=city(),topo=R53.topology();
    assert.equal(R53.streets().length,5);
    assert.equal(topo.edges.length,14);
    assert.equal(topo.nodes.length,6);
    assert.equal(topo.gridExits,8);
    assert.equal(c.isWaterAt(-240,-80),false);
    assert.equal(c.isWaterAt(-240,-120),true);
    assert.equal(c.isWaterAt(-160,-80),false);
    assert.equal(c.isWaterAt(-160,200),true);
    assert(R53.audit(c).ready);
    assert.equal(R53.audit({...c,preset:{id:'rio'}}),null);
    assert(!R53.isCarvedBlock(-200,-200));
    assert(!R53.isCarvedBlock(-280,200));
});
test('R53 constructs five roads, six junctions, eight dry parcels, landward sidewalks and zebra crossings',()=>{
    global.THREE=three();
    try{
        const c=build(),r=c.chicagoWestCanalR53;
        assert(r.ready,JSON.stringify(r.blocked));
        assert(r.visualReady);
        assert.equal(r.corridorsBuilt,5);
        assert.equal(r.crossingsBuilt,6);
        assert.equal(r.buildingsBuilt,8);
        assert.equal(r.sidewalksBuilt,8);
        assert.equal(r.crosswalkStripes,96);
        assert.equal(c.buildingBoxes.filter(b=>b.chicagoR53Lot).length,8);
        assert.equal(c.chicagoPS1StreetNetwork.radarPaths.length,20);
        assert.equal(R53.build(c),r);
        for(const b of c.buildingBoxes.filter(b=>b.chicagoR53Lot))
            for(const x of [b.minX,b.maxX])
                for(const z of [b.minZ,b.maxZ])
                    assert(!c.isWaterAt(x,z),
                        'new parcel hangs over the river');
        assert(R53.audit(c).ready);
    }finally{delete global.THREE}
});
test('R53 adds real shortest route over west fixed bridge; never through unbridged water',()=>{
    global.THREE=three();
    try{
        const c=build(),g=Nav.compile(c);
        assert.equal(g.westCanalLinks,14);
        assert.equal(g.secondaryNodes,24);
        assert.equal(g.gateways,38);
        const p=Nav.plan(c,{x:-320,z:-80},{x:-160,z:-80});
        assert(p&&p.length>=5);
        assert(p.some(n=>n.x===-240&&n.z===-80));
        assert.equal(p.at(-1).x,-160);
        for(let i=1;i<p.length;i++)
            assert(Nav.clear(c,p[i-1],p[i]));
        const fromCanal=Nav.plan(c,{x:-280,z:-120},{x:-40,z:240});
        assert(fromCanal&&fromCanal.length>5);
        for(let i=1;i<fromCanal.length;i++)
            assert(Nav.clear(c,fromCanal[i-1],fromCanal[i]));
    }finally{delete global.THREE}
});
test('R53 rejects nonexistent bridge and never enables unsafe commuter spawn',()=>{
    const c=city();
    c.chicagoPS1RiverBranches=null;
    assert(!R53.audit(c).ready);
    c.chicagoPS1RiverBranches={};
    c.buildingBoxes.push({minX:-245,maxX:-235,minZ:-84,maxZ:-76});
    const a=R53.audit(c);
    assert(!a.ready);
    assert(a.blocked.some(k=>k.startsWith('west-bridge-')));
    assert.equal(R53.build(c).visualReady,undefined);
    assert(!c.chicagoWestCanalR53.ready);
});
test('R53 generates four new mixed commuters, all with safe goals',()=>{
    global.THREE=three();
    try{
        const c=build(),cars=Traffic.spawnSpecs(c);
        assert.equal(cars.length,16);
        const west=cars.filter(s=>s.goalIndex>=19);
        assert.equal(west.length,4);
        assert(west.every(s=>s.goalIndex<24));
        for(const spec of west){
            assert(!c.isWaterAt(spec.x,spec.z));
            assert(!c.isPointBlocked(spec.x,spec.z,1.8,0));
            assert(Nav.plan(c,spec,Traffic.GOALS[spec.goalIndex]));
        }
        assert.deepEqual(Traffic.spawnSpecs({...c,preset:{id:'vegas'}}),[]);
    }finally{delete global.THREE}
});
test('R53 traffic yields to a leading car without falsely re-planning its destination',()=>{
    global.THREE=three();
    try{
        const c=build(),s=Traffic.spawnSpecs(c).find(v=>v.goalIndex>=19);
        const car={...s,heading:Math.PI/2,speed:0,
            chicagoMixedTrafficR49:true,
            chicagoMixedTrafficGoalIndex:s.goalIndex};
        const leader={x:car.x+4,z:car.z,heading:car.heading,y:0,speed:0};
        Traffic.getInput(c,car,[car,leader],.05,[]);
        const startIndex=car.chicagoMixedTrafficStateR49.index;
        for(let i=0;i<95;i++){
            const input=Traffic.getInput(c,car,[car,leader],.05,[]);
            assert.equal(input.up,false);
            assert.equal(car.chicagoMixedTrafficStatusR49.waiting,'traffic');
        }
        assert.equal(car.chicagoMixedTrafficStateR49.index,startIndex);
        assert.equal(car.chicagoMixedTrafficStatusR49.replans,0);
        assert.equal(car.chicagoMixedTrafficStateR49.stuck,0);
    }finally{delete global.THREE}
});
test('R53 blocked A-star route stops NPC safely instead of switching to old grid and teleporting',()=>{
    const original=Nav.follow;
    const c=city(),car={x:-280,z:-80,speed:0,heading:0,
        chicagoMixedTrafficR49:true,chicagoMixedTrafficGoalIndex:19};
    Nav.follow=()=>({blocked:true,target:null});
    try{
        for(let i=0;i<3;i++){
            const input=Traffic.getInput(c,car,[car],1,[]);
            assert(input);
            assert.equal(input.up,false);
            assert.equal(input.left,false);
            assert.equal(input.right,false);
            assert.equal(car.chicagoMixedTrafficStatusR49.blocked,true);
            assert.equal(car.chicagoMixedTrafficStatusR49.waiting,'route');
        }
        assert(car.chicagoMixedTrafficStatusR49.replans>=1);
        assert.equal(car.x,-280);assert.equal(car.z,-80);
    }finally{Nav.follow=original}
});
test('R53 pedestrian ground matches landward slabs and leaves bridge deck at street level',()=>{
    global.THREE=three();
    try{
        const c=build();
        assert(Math.abs(Road.localPavementHeight(c,-304,-144)-.271)<.001);
        assert(Math.abs(Road.localPavementHeight(c,-184,-16)-.271)<.001);
        assert.equal(Road.localPavementHeight(c,-240,-80),0);
        assert.equal(Road.localPavementHeight(c,-280,-80),0);
        assert.equal(Road.localPavementHeight(c,-240,-120),0);
    }finally{delete global.THREE}
});
test('R53 F8 telemetry distinguishes bridge occupancy, waits, blocked paths and replans',()=>{
    global.THREE=three();
    try{
        const c=build(),panel=new Telemetry();
        const waiting={x:-239,z:-80,speed:0,heading:0,y:0,
            damage:0,chicagoMixedTrafficR49:true,chicagoWestTrafficR53:true,
            chicagoMixedTrafficStatusR49:{
                speedLimit:0,waiting:'traffic',replans:2}};
        const blocked={x:-200,z:-40,speed:0,heading:0,y:0,
            damage:0,chicagoMixedTrafficR49:true,chicagoWestTrafficR53:true,
            chicagoMixedTrafficStatusR49:{
                speedLimit:0,waiting:'route',blocked:true,replans:1}};
        const g={city:c,currentCityKey:'chicago',missionType:'freeroam',
            vehicles:[waiting,blocked],playerCar:null};
        panel.sample(g,.51,.051);
        const report=panel.sample(g,.54,.017);
        assert.equal(report.westCanalRoads,5);
        assert.equal(report.westBridgeVehicles,1);
        assert.equal(report.westCanalCars,2);
        assert.equal(report.blockedRoutes,1);
        assert.equal(report.waitingTraffic,1);
        assert.equal(report.replans,3);
    }finally{delete global.THREE}
});
test('R53 is loaded in both Chicago game modes before CityBuilder and shares spawn pipeline',()=>{
    const html=fs.readFileSync('index.html','utf8'),
        city=fs.readFileSync('js/world/city-builder.js','utf8'),
        engine=fs.readFileSync('js/engine/driver2-game-engine.js','utf8');
    assert(html.includes('chicago-west-canal-r53.js'));
    assert(html.indexOf('chicago-west-canal-r53.js')<
        html.indexOf('city-builder.js'));
    assert(city.includes('DriverChicagoWestCanalR53.isCarvedBlock('));
    assert(city.includes('DriverChicagoWestCanalR53.build(this)'));
    assert(engine.includes('DriverChicagoMixedTrafficR49.spawnSpecs('));
    assert(engine.includes('car.chicagoWestTrafficR53=spec.goalIndex>=19'));
    assert(engine.includes("this.startMission('freeroam')"));
});
