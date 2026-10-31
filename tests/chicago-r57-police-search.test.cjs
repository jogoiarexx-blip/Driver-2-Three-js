'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Physics=require('../js/physics/arcade-dynamics.js');
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
const Pursuit=vm.runInNewContext(
    fs.readFileSync('js/traffic/pursuit-navigation.js','utf8')+
    '\nDriverPursuitNavigation',{DriverRoadGeometry:Road}
);
const Tactics={
    targetFor(_car,player){return player},
    targetIsSafe(){return true},
    maneuverFor(){return null}
};
const Three=Math;
const TrafficAI=vm.runInNewContext(
    fs.readFileSync('js/traffic/traffic-ai.js','utf8')+
    '\nDriverTrafficAI',
    {
        THREE:{MathUtils:{clamp:(n,a,b)=>Math.max(a,Math.min(b,n))}},
        PolicePursuitTactics:Tactics,
        DriverRoadGeometry:Road,
        DriverChicagoMixedNavigationR49:Nav,
        DriverPursuitNavigation:Pursuit
    }
);
function three(){
    class Obj{
        constructor(){this.children=[];this.userData={};
            this.position={set(){}};
            this.rotation={set(){}};
            this.scale={set(){}};}
        add(o){this.children.push(o)}
        updateMatrix(){this.matrix={}}
    }
    class Mesh extends Obj{}
    class Inst extends Mesh{
        constructor(g,m,n){super();this.count=n;
            this.instanceMatrix={needsUpdate:false};}
        setMatrixAt(i){assert(i>=0&&i<this.count)}
    }
    return {Group:Obj,Object3D:Obj,Mesh,InstancedMesh:Inst,
        BoxGeometry:class{},CylinderGeometry:class{},
        MeshLambertMaterial:class{},MeshBasicMaterial:class{}};
}
function city(){
    const c={preset:{id:'chicago'},roadExtent:320,buildSequence:1,
        bridgeRaised:false,buildingBoxes:[],
        chicagoPS1RiverBranches:{bridgeCount:10},
        chicagoPS1StreetNetwork:{radarPaths:[]},
        cityGroup:{children:[],add(o){this.children.push(o)}},
        isWaterAt(x,z){return North.isBridgeDeck(x,z)?false:
            River.waterAt(x,z);},
        isPointBlocked(x,z,r=0){return this.buildingBoxes.some(b=>
            x+r>b.minX&&x-r<b.maxX&&z+r>b.minZ&&z-r<b.maxZ);},
        isTrafficGreen(){return true}
    };
    for(const module of [R48,R50,R52,R53]){
        const report=module.build(c);
        assert(report.ready,JSON.stringify(report.blocked));
    }
    return c;
}
function police(start){
    return {...start,y:0,speed:0,steerAngle:0,
        lateralVelocity:0,damage:0,wheelSpin:0,
        chassisTilt:{rotation:{}},bodyStyle:'sedan',
        maxSpeed:37,accel:20,isPolice:true};
}
function drive(ai,car,goal,seconds,vehicles=[car]){
    let collisions=0,meters=0,searchFrames=0,cornerFrames=0;
    const dt=.05;
    for(let i=0;i<Math.round(seconds/dt);i++){
        const input=ai.getInput(car,dt,vehicles,goal,85);
        assert(input);
        if(car.chicagoPoliceSearchStatusR57?.active)searchFrames++;
        if(car.chicagoPoliceSearchStatusR57?.cornerBrake)cornerFrames++;
        Physics.update(car,dt,input.up?1:input.down?-1:0,
            input.right?1:input.left?-1:0,input.handbrake,false);
        const vx=Math.sin(car.heading)*car.speed+
            Math.cos(car.heading)*car.lateralVelocity;
        const vz=Math.cos(car.heading)*car.speed-
            Math.sin(car.heading)*car.lateralVelocity;
        const nx=car.x+vx*dt,nz=car.z+vz*dt;
        if(ai.city.isWaterAt(nx,nz)||
            ai.city.isPointBlocked(nx,nz,1.55)){
            collisions++;car.speed=0;
        }else{
            meters+=Math.hypot(nx-car.x,nz-car.z);
            car.x=nx;car.z=nz;
        }
    }
    return {collisions,meters,searchFrames,cornerFrames};
}
test('R57 police without direct sight brakes into narrow R52 corners instead of hitting the first shop',()=>{
    global.THREE=three();
    try{
        const c=city(),car=police({x:-116,z:236,
            heading:Math.PI});
        const outcome=drive(new TrafficAI(c),car,{x:120,z:-120},14);
        assert.equal(outcome.collisions,0,JSON.stringify(outcome));
        assert(outcome.meters>30);
        // Police radio has intermittent last-known-position windows.
        // The search should be active for a useful portion of the replay.
        assert(outcome.searchFrames>=140);
        assert(outcome.cornerFrames>0);
        assert.equal(car.policeLineOfSight,false);
        assert.equal(car.sirenActive,true);
    }finally{delete global.THREE}
});
test('R57 police slows behind an existing civilian in dense Chicago traffic without rear ending it',()=>{
    global.THREE=three();
    try{
        const c=city(),car=police({x:-116,z:236,heading:0});
        const ahead={x:-116,z:242,y:0,speed:0,heading:0};
        const ai=new TrafficAI(c);
        const input=ai.getInput(car,.05,[car,ahead],
            {x:120,z:-120},85);
        assert.equal(input.up,false);
        assert.equal(car.chicagoPoliceSearchStatusR57.active,true);
        assert.equal(car.chicagoPoliceSearchStatusR57.waiting,'traffic');
        assert.equal(car.chicagoPoliceSearchStatusR57.speedLimit,0);
    }finally{delete global.THREE}
});
test('R57 unavailable bridge keeps searching officer stopped; never silently switches to legacy grid',()=>{
    global.THREE=three();
    const previous=Nav.follow;
    try{
        const c=city(),car=police({x:-116,z:236,heading:0});
        const ai=new TrafficAI(c);
        Nav.follow=()=>({target:null,blocked:true});
        const control=ai.getInput(car,.05,[car],{x:120,z:-120},85);
        assert.equal(control.up,false);
        assert.equal(control.left,false);
        assert.equal(control.right,false);
        assert.equal(car.chicagoPoliceSearchStatusR57.blocked,true);
        assert.equal(car.chicagoPoliceSearchStatusR57.speedLimit,0);
        assert.equal(ai.getRoute(car).reverseTimer,0);
    }finally{Nav.follow=previous;delete global.THREE}
});
test('R57 visibility and scripted chase remain unchanged by secondary-road corner protection',()=>{
    global.THREE=three();
    try{
        const c=city(),car=police({x:84,z:196,heading:0});
        const ai=new TrafficAI(c);
        const control=ai.getInput(car,.05,[car],{x:84,z:210},85);
        assert(control);
        assert.equal(car.policeLineOfSight,true);
        assert.equal(car.chicagoPoliceSearchStatusR57?.active,false);
        const scripted=police({x:84,z:196,heading:0});
        scripted.scriptedDrive={waitSeconds:2};
        const second=new TrafficAI(c).getInput(scripted,.05,
            [scripted],{x:84,z:210},85);
        assert.equal(second.up,false);
        assert.equal(scripted.chicagoPoliceSearchStatusR57,undefined);
    }finally{delete global.THREE}
});
test('R57 browser script caches police controller and F8 report in both city modes',()=>{
    const html=fs.readFileSync('index.html','utf8'),
        telemetry=fs.readFileSync(
            'js/engine/driver-traffic-telemetry-r50.js','utf8'),
        engine=fs.readFileSync('js/engine/driver2-game-engine.js','utf8');
    assert(html.includes('traffic-ai.js?v=chicago-police-r57'));
    assert(html.includes('driver-traffic-telemetry-r50.js?v=r57-police'));
    assert(telemetry.includes('policeSearchBlocked:'));
    assert(telemetry.includes('policeCornerBrakes:'));
    assert(engine.includes('this.startMission(\'freeroam\')'));
    assert(engine.includes('this.trafficAI.getInput('));
});
