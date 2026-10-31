'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
    fs=require('node:fs'),vm=require('node:vm');
const R48=require('../js/world/chicago-connectors-r48.js');
const R50=require('../js/world/chicago-connectors-r50.js');
const Road=require('../js/world/road-geometry.js');
global.DriverRoadGeometry=Road;
global.DriverChicagoConnectorsR48=R48;
global.DriverChicagoConnectorsR50=R50;
const Nav=require('../js/traffic/chicago-mixed-navigation-r49.js');
global.DriverChicagoMixedNavigationR49=Nav;
const Traffic=require('../js/traffic/chicago-mixed-traffic-r49.js');
const Telemetry=require('../js/engine/driver-traffic-telemetry-r50.js');
function three(){
    class O{
        constructor(){this.children=[];this.userData={};
            this.position={set(){}};this.rotation={set(){}};
            this.scale={set(){}};}
        add(x){this.children.push(x)}updateMatrix(){this.matrix={}}
    }
    class M extends O{constructor(g,m){super();this.geometry=g;this.material=m}}
    class I extends M{constructor(g,m,n){super(g,m);this.count=n;
        this.instanceMatrix={needsUpdate:false};}
        setMatrixAt(i){assert(i>=0&&i<this.count);}
    }
    return {Group:O,Object3D:O,Mesh:M,InstancedMesh:I,
        BoxGeometry:class{},MeshBasicMaterial:class{},
        MeshLambertMaterial:class{}};
}
function city(){
    return {preset:{id:'chicago'},roadExtent:320,bridgeRaised:false,
        buildSequence:1,buildingBoxes:[],cityGroup:{add(){}},
        chicagoPS1StreetNetwork:{radarPaths:[]},
        isWaterAt(x,z){return z>34.85&&z<65.15&&Math.abs(x)>12.25},
        isPointBlocked(x,z,r=0){return this.buildingBoxes.some(b=>
            x+r>b.minX&&x-r<b.maxX&&z+r>b.minZ&&z-r<b.maxZ);}
    };
}
test('R50 expands Chicago with six additional intersections and ten grid exits',()=>{
    global.THREE=three();
    try{
        const c=city(),south=R48.build(c),north=R50.build(c);
        assert(south.ready);assert(north.ready,JSON.stringify(north.blocked));
        assert.equal(north.corridorsBuilt,5);
        assert.equal(north.crossingsBuilt,6);
        assert.equal(north.gridExits,10);
        assert.equal(c.buildingBoxes.length,24);
        assert.equal(c.chicagoPS1StreetNetwork.radarPaths.length,10);
        assert(!R50.isCarvedBlock(120,120));
        assert(!R50.isCarvedBlock(200,-200));
        assert.equal(R50.build(c),north);
        for(const loop of Object.values(north.loops))
            for(let i=1;i<loop.points.length;i++)
                assert(R50.laneClear(c,loop.points[i-1],loop.points[i]));
    }finally{delete global.THREE;}
});
test('R50 navigation joins north/south districts through existing bridges',()=>{
    const c=city();
    c.chicagoConnectorsR48={ready:true};
    c.chicagoConnectorsR50={ready:true};
    const g=Nav.compile(c);
    assert.equal(g.secondaryNodes,12);
    assert.equal(g.gateways,20);
    const path=Nav.plan(c,{x:120,z:200},{x:120,z:-120});
    assert(path&&path.length>7);
    assert(path.some(p=>p.z>160));
    assert(path.some(p=>p.z<0));
    for(let i=1;i<path.length;i++)
        assert(Nav.clear(c,path[i-1],path[i]));
    c.bridgeRaised=true;
    assert.notEqual(Nav.compile(c),g);
});
test('R50 eight new commuter vehicles distributed between two districts',()=>{
    const c=city();
    c.chicagoConnectorsR48={ready:true};
    c.chicagoConnectorsR50={ready:true};
    const specs=Traffic.spawnSpecs(c);
    assert.equal(specs.length,8);
    assert.equal(specs.filter(s=>s.z>160).length,4);
    assert.equal(Traffic.spawnSpecs({...c,preset:{id:'rio'}}).length,0);
});
test('R50 station ramp remains walkable and ground-level cars pass below without phantom rails',()=>{
    const src=fs.readFileSync('js/world/city-builder.js','utf8');
    const City=vm.runInNewContext(src+'\nCityBuilder');
    const c={preset:{id:'chicago'},bridgeAngle:.08,worldLimit:410,
        interiorFloorAt:()=>false,interiorArea:()=>false,
        trainStation:{
            ramp:{minX:-17,maxX:-11,startZ:-217,endZ:-246},
            platform:{minX:-22,maxX:-6,minZ:-282,maxZ:-246,height:11.3}
        },buildingBoxes:[],getSidewalkHeightAt:()=>0,
        isWaterAt:()=>false};
    const ground=City.prototype.getGroundHeightAt;
    assert.equal(ground.call(c,-14,-232,0,true),0);
    assert(ground.call(c,-14,-232,0,false)>0);
    assert.equal(ground.call(c,-14,-260,0,true),0);
    assert.equal(ground.call(c,-14,-260,0,false),0);
    assert.equal(ground.call(c,-14,-260,11.3,false),11.3);
    assert.equal(City.prototype.isPointBlocked.call(c,-17.2,-229,1.55,0),false);
});
test('R50 telemetry samples without changing physics and reports rendering spikes',()=>{
    const telemetry=new Telemetry();
    const car={x:40,z:-120,y:0,speed:0,damage:0,
        chicagoMixedTrafficR49:true};
    const game={vehicles:[car],playerCar:null,
        city:{chicagoConnectorsR50:{ready:true}},
        currentCityKey:'chicago',missionType:'freeroam'};
    telemetry.sample(game,.5,.055);
    const report=telemetry.sample(game,.55,.02);
    assert.equal(report.vehicles,1);
    assert.equal(report.roadsR50,true);
    assert(report.slowFrames>=1);
    assert.equal(report.stationCarLift,0);
    assert.equal(telemetry.toggle(),true);
});
test('R50 scripts and HUD remain connected to game engine in both modes',()=>{
    const html=fs.readFileSync('index.html','utf8'),
        css=fs.readFileSync('css/styles.css','utf8'),
        city=fs.readFileSync('js/world/city-builder.js','utf8'),
        engine=fs.readFileSync('js/engine/driver2-game-engine.js','utf8');
    for(const script of ['chicago-connectors-r50.js',
        'chicago-water-r50.js','driver-traffic-telemetry-r50.js'])
        assert(html.includes(script));
    assert(html.indexOf('chicago-connectors-r50.js')<
        html.indexOf('city-builder.js'));
    assert(html.includes('id="d2-traffic-telemetry"'));
    assert(css.includes('.speedometer-90s-footer,'));
    assert(city.includes('DriverChicagoConnectorsR50.build(this)'));
    assert(engine.includes('this.trafficTelemetry?.sample(this,dt,rawDt)'));
    assert(engine.includes("this.startMission('freeroam')"));
});
