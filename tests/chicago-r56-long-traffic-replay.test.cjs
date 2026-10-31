'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
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
const Navigation=require('../js/traffic/chicago-mixed-navigation-r49.js');
global.DriverChicagoMixedNavigationR49=Navigation;
const Traffic=require('../js/traffic/chicago-mixed-traffic-r49.js');

function three(){
    class Obj {
        constructor(){
            this.children=[];this.userData={};
            this.position={set(x,y,z){Object.assign(this,{x,y,z})}};
            this.rotation={set(){}};this.scale={set(){}};
        }
        add(object){this.children.push(object)}
        updateMatrix(){this.matrix={}}
    }
    class Mesh extends Obj {
        constructor(geometry,material){super();this.geometry=geometry;
            this.material=material}
    }
    class Instances extends Mesh{
        constructor(geometry,material,count){
            super(geometry,material);
            this.count=count;this.instanceMatrix={needsUpdate:false};
        }
        setMatrixAt(index){assert(index>=0&&index<this.count)}
    }
    return {Group:Obj,Object3D:Obj,Mesh,InstancedMesh:Instances,
        BoxGeometry:class{},CylinderGeometry:class{},
        MeshLambertMaterial:class{},MeshBasicMaterial:class{}};
}
function city(){
    return {preset:{id:'chicago'},roadExtent:320,buildSequence:1,
        bridgeRaised:false,buildingBoxes:[],
        chicagoPS1RiverBranches:{bridgeCount:10},
        chicagoPS1StreetNetwork:{radarPaths:[]},
        cityGroup:{children:[],add(object){this.children.push(object)}},
        isWaterAt(x,z){
            return North.isBridgeDeck(x,z)?false:River.waterAt(x,z);
        },
        isPointBlocked(x,z,r=0){
            return this.buildingBoxes.some(box=>
                x+r>box.minX&&x-r<box.maxX&&
                z+r>box.minZ&&z-r<box.maxZ);
        },
        isTrafficGreen(){return true}
    };
}
function build(){
    const c=city();
    for(const module of [R48,R50,R52,R53]){
        const report=module.build(c);
        assert.equal(report.ready,true,
            'District failed geometry audit: '+JSON.stringify(report.blocked));
    }
    return c;
}
function drive(city,spec,seconds){
    const car={...spec,y:0,speed:0,steerAngle:0,
        lateralVelocity:0,damage:0,wheelSpin:0,
        chassisTilt:{rotation:{}},chicagoMixedTrafficR49:true,
        chicagoMixedTrafficGoalIndex:spec.goalIndex};
    const dt=.05,frames=Math.round(seconds/dt);
    let collisions=0,waterCollisions=0,meters=0,goalChanges=0,
        lastGoal=spec.goalIndex,blockedFrames=0;
    const firstCollisions=[];
    for(let tick=0;tick<frames;tick++){
        const input=Traffic.getInput(city,car,[car],dt,[]);
        assert(input&&typeof input.up==='boolean');
        const status=car.chicagoMixedTrafficStatusR49;
        assert(status&&Number.isInteger(status.destination));
        if(status.blocked)blockedFrames++;
        if(status.destination!==lastGoal){
            goalChanges++;lastGoal=status.destination;
        }
        Physics.update(car,dt,input.up?1:input.down?-1:0,
            input.right?1:input.left?-1:0,input.handbrake,false);
        const vx=Math.sin(car.heading)*car.speed+
            Math.cos(car.heading)*car.lateralVelocity;
        const vz=Math.cos(car.heading)*car.speed-
            Math.sin(car.heading)*car.lateralVelocity;
        const nx=car.x+vx*dt,nz=car.z+vz*dt;
        assert(Number.isFinite(nx)&&Number.isFinite(nz),
            'non-finite vehicle coordinates at '+tick);
        const wet=city.isWaterAt(nx,nz);
        if(wet||city.isPointBlocked(nx,nz,1.55)){
            collisions++;
            if(wet)waterCollisions++;
            if(firstCollisions.length<4)firstCollisions.push({
                time:+(tick*dt).toFixed(2),
                x:+car.x.toFixed(2),z:+car.z.toFixed(2)
            });
            // Same collision outcome as vehicle physics: no movement.
            car.speed=0;
        }else{
            meters+=Math.hypot(nx-car.x,nz-car.z);
            car.x=nx;car.z=nz;
        }
    }
    return {collisions,waterCollisions,meters,goalChanges,
        blockedFrames,firstCollisions};
}
test('R56 actual arcade car physics: all four Chicago districts drive for 70 seconds without hitting buildings/water',()=>{
    global.THREE=three();
    try{
        const c=build(),specs=Traffic.spawnSpecs(c,[]);
        assert.equal(specs.length,16);
        for(const index of [0,4,8,12]){
            const result=drive(c,specs[index],70);
            assert.equal(result.collisions,0,
                specs[index].name+' '+JSON.stringify(result));
            assert(result.meters>350,
                specs[index].name+' did not make meaningful progress');
            assert(result.goalChanges>=2);
            assert.equal(result.waterCollisions,0);
        }
    }finally{delete global.THREE}
});
test('R56 10-minute continuous arcade replay traverses bridges and tight junctions without phantom walls',()=>{
    global.THREE=three();
    try{
        const c=build(),specs=Traffic.spawnSpecs(c,[]);
        const result=drive(c,specs[8],600);
        assert.equal(result.collisions,0,JSON.stringify(result));
        assert(result.meters>3500,JSON.stringify(result));
        assert(result.goalChanges>=12,JSON.stringify(result));
        assert.equal(result.blockedFrames,0);
    }finally{delete global.THREE}
});
test('R56 building AABBs have physically usable turn clearance; R53 slabs match foot height',()=>{
    global.THREE=three();
    try{
        const c=build();
        // Before R56: this tyre position intersected a R53 corner
        // building AABB and caused 202 contacts in a 600-second replay.
        assert.equal(c.isPointBlocked(-310.08,-70.39,1.55),false);
        assert(Math.abs(Road.localPavementHeight(c,-300,-140)-.271)<.001);
        assert(Math.abs(Road.localPavementHeight(c,-180,-20)-.271)<.001);
        assert.equal(Road.localPavementHeight(c,-240,-80),0);
        const newLots=c.buildingBoxes.filter(b=>b.chicagoR53Lot);
        assert.equal(newLots.length,8);
        for(const b of newLots){
            assert(!c.isWaterAt(b.minX,b.minZ));
            assert(!c.isWaterAt(b.maxX,b.maxZ));
        }
    }finally{delete global.THREE}
});
