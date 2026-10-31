'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

class Vector {
    constructor(x=0,y=0,z=0){this.set(x,y,z);}
    set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
    clone(){return new Vector(this.x,this.y,this.z);}
    copy(v){return this.set(v.x,v.y,v.z);}
}
class Group {
    constructor(){
        this.children=[];this.position=new Vector();
        this.rotation=new Vector();this.scale=new Vector(1,1,1);
        this.visible=true;this.userData={};this.parent=null;
    }
    add(...children){
        for(const c of children){
            if(c.parent)c.parent.remove(c);
            this.children.push(c);c.parent=this;
        }
    }
    remove(child){
        this.children=this.children.filter(c=>c!==child);
        child.parent=null;
    }
    updateMatrix(){}
    updateWorldMatrix(){}
    localToWorld(p){
        p.x+=this.position.x;p.y+=this.position.y;p.z+=this.position.z;
        return p;
    }
}
class Mesh extends Group {
    constructor(geometry,material){super();
        this.geometry=geometry;this.material=material;}
    clone(){const m=new Mesh(this.geometry,this.material);
        m.position.copy(this.position);return m;}
}
class Geometry{
    rotateX(){}
    rotateY(){}
    rotateZ(){}
}
class Material{constructor(config){this.color=config?.color??0;}}
const THREE={Group,Mesh,Vector3:Vector,BoxGeometry:Geometry,
    CylinderGeometry:Geometry,SphereGeometry:Geometry,
    ConeGeometry:Geometry,MeshLambertMaterial:Material,
    MeshBasicMaterial:Material,DoubleSide:2};
const source=name=>fs.readFileSync(name,'utf8');
const Doors=vm.runInNewContext(source(
    'js/vehicles/driver-vehicle-doors-r58.js')+
    '\nDriverVehicleDoorsR58',{THREE,module:{exports:{}}});
const Mount=vm.runInNewContext(source(
    'js/vehicles/driver-vehicle-mount.js')+
    '\nDriverVehicleMount',{THREE,DriverVehicleDoorsR58:Doors});
const Vehicle=vm.runInNewContext(source(
    'js/vehicles/driver-vehicle.js')+
    '\nDriverVehicle',{THREE});
const Tanner=vm.runInNewContext(source(
    'js/entities/tanner-controller.js')+
    '\nTannerController',{THREE});
const BikeIK=vm.runInNewContext(source(
    'js/entities/tanner-motorcycle-contact-ik.js')+
    '\nDriverMotorcycleContactIK',{THREE});
const PoliceDoors=vm.runInNewContext(source(
    'js/vehicles/police-door-rig.js')+
    '\nDriverPoliceDoorRig',{THREE});

function car(bodyStyle='sedan'){
    const vehicle={bodyStyle,x:0,y:0,z:0,heading:0,
        speed:0,lateralVelocity:0,chassisTilt:new Group(),
        motorcycleRider:{visible:false},isPolice:false};
    if(bodyStyle!=='motorcycle')
        Doors.attach(vehicle,new Material(),new Material());
    return vehicle;
}
function actor(x=-2){
    const group=new Group();
    group.position.set(x,0,0);
    return {group,heading:0,motorcycleVehicle:null,
        pendingMotorcycleVehicle:null,visible:false,poses:0,
        setPosition(x,y,z,h){
            this.group.position.set(x,y,z);this.heading=h;
        },
        setVisible(v){this.visible=v;this.group.visible=v;},
        applyVehicleTransitionPose(){this.poses++;},
        resetVehicleTransitionPose(){this.restored=true;},
        mountOnMotorcycle(){return false;}
    };
}
function engine(vehicle,kind){
    const t=actor();
    return {tanner:t,city:{isWaterAt:()=>false,
        isPointBlocked:()=>false,getGroundHeightAt:()=>0},
        playerCar:kind==='exit'?vehicle:null,
        mode:kind==='exit'?'driving':'on_foot',
        felony:0,isPoliceNearPlayer:()=>false};
}
function advance(engine,seconds=2){
    let frames=0,peak=0;
    while(engine.vehicleMountTransition&&frames<Math.ceil(seconds/.025)){
        Mount.update(engine,.025);frames++;
        const v=engine.vehicleMountTransition?.vehicle;
        if(v?.entryDoorsR58)
            peak=Math.max(peak,Math.abs(
                v.entryDoorsR58.pieces[-1].hinge.rotation.y));
    }
    return {frames,peak};
}
test('R58 native cars have two swinging doors with eased opening, a held aperture and exact closure',()=>{
    const v=car();
    assert.equal(v.chassisTilt.children.length,4);
    assert.equal(Doors.attach({...v,bodyStyle:'motorcycle'},
        new Material(),new Material()),null);
    let previous=0;
    for(let t=0;t<=.27;t+=.027){
        Doors.transition(v,-1,'enter',t);
        const a=v.entryDoorsR58.pieces[-1].hinge.rotation.y;
        assert(a>=previous-1e-7);
        previous=a;
    }
    assert(Math.abs(previous-1.12)<.005);
    assert.equal(v.entryDoorsR58.pieces[1].hinge.rotation.y,0);
    Doors.transition(v,1,'exit',.5);
    assert(v.entryDoorsR58.pieces[1].hinge.rotation.y<-.95);
    Doors.transition(v,1,'exit',1);
    assert.equal(v.entryDoorsR58.pieces[1].hinge.rotation.y,0);
    assert.equal(v.entryDoorsR58.pieces[1].cavity.visible,false);
});
test('R58 Tanner enters native car after door opens, seats then closes — without early driving state',()=>{
    const v=car(),e=engine(v,'enter');
    assert(Mount.start(e,v,'enter'));
    assert.equal(e.mode,'on_foot');
    for(let i=0;i<14;i++)Mount.update(e,.025);
    assert.equal(e.mode,'on_foot');
    assert(v.entryDoorsR58.amount>.99);
    const result=advance(e);
    assert.equal(e.vehicleMountTransition,null);
    assert.equal(e.mode,'driving');
    assert.equal(e.playerCar,v);
    assert.equal(v.entryDoorsR58.amount,0);
    assert(e.tanner.poses>20);
    assert.equal(e.tanner.visible,false);
    assert(result.frames>20);
});
test('R58 native car exit opens door before Tanner moves out and ends with door closed',()=>{
    const v=car(),e=engine(v,'exit');
    assert(Mount.start(e,v,'exit'));
    Mount.update(e,.03);
    assert(e.vehicleMountTransition);
    assert(e.mode==='driving');
    assert(v.entryDoorsR58.amount>0);
    advance(e);
    assert.equal(e.mode,'on_foot');
    assert.equal(e.tanner.visible,true);
    assert.equal(v.entryDoorsR58.amount,0);
});
test('R58 motorcycle geometry includes tank, saddle, handlebar and steering fork',()=>{
    const v=Object.create(Vehicle.prototype);
    v.bodyStyle='motorcycle';v.color=0xff6600;
    v.chassisTilt=new Group();v.root=new Group();v.wheels=[];
    v.mountMotorcycleRider=()=>{};
    v.buildMotorcycleMesh();
    assert.equal(v.wheels.length,2);
    assert(v.chassisTilt.children.length>=8);
    assert(v.motorcycleSteerGroup);
    assert.equal(v.motorcycleSteerGroup.name,
        'motorcycle-steering-r58');
    v.steerAngle=.40;v.wheelSpin=2;
    v.heading=0;v.x=0;v.y=0;v.z=0;
    v.updateTransform();
    assert(Math.abs(v.motorcycleSteerGroup.rotation.y-.36)<1e-7);
    assert.equal(v.wheels[0].rotation.y,.4);
});
test('R58 bike fallback rider appears after entry and disappears when dismount begins',()=>{
    const bike=car('motorcycle'),e=engine(bike,'enter');
    assert(Mount.start(e,bike,'enter'));
    advance(e);
    assert.equal(e.mode,'driving');
    assert.equal(bike.motorcycleRider.visible,true);
    assert(Mount.start(e,bike,'exit'));
    for(let i=0;i<12;i++)Mount.update(e,.025);
    assert.equal(bike.motorcycleRider.visible,false);
    advance(e);
    assert.equal(e.mode,'on_foot');
    assert.equal(bike.motorcycleRider.visible,false);
});
test('R58 mounts real Tanner GLB after its rig arrives; pending rider is cleared on detachment',()=>{
    const bike=car('motorcycle'),t=Object.create(Tanner.prototype);
    t.group=new Group();t.playerModel=null;
    t.vehicleBoneRig=null;t.motorcycleVehicle=null;
    t.pendingMotorcycleVehicle=null;
    t.resetVehicleTransitionPose=()=>{};
    t.applyVehicleTransitionPose=()=>{};
    t.contactShadow={visible:true};
    assert.equal(t.mountOnMotorcycle(bike),false);
    assert.equal(t.pendingMotorcycleVehicle,bike);
    t.vehicleBoneRig={};t.playerModel=new Group();
    assert.equal(t.mountOnMotorcycle(bike),true);
    assert.equal(t.pendingMotorcycleVehicle,null);
    assert.equal(t.motorcycleVehicle,bike);
    assert.equal(t.group.parent,bike.chassisTilt);
    // The async callback hides the provisional mesh on success.
    bike.motorcycleRider.visible=false;
    assert.equal(bike.motorcycleRider.visible,false);
    t.scene=new Group();
    assert.equal(t.detachFromMotorcycle(),true);
    assert.equal(t.pendingMotorcycleVehicle,null);
    assert.equal(t.group.parent,t.scene);
});
test('R58 mounting leg is mirrored correctly for left and right approaches',()=>{
    const t=Object.create(Tanner.prototype);
    t.group=new Group();
    for(const n of ['leftArm','rightArm','leftLeg','rightLeg'])
        t[n]=new Group();
    t.applyVehicleTransitionPose('motorcycle','enter',.50,.025,-1);
    assert(t.leftLeg.rotation.x>1);
    assert(t.rightLeg.rotation.x<0);
    t.applyVehicleTransitionPose('motorcycle','enter',.50,.025,1);
    assert(t.rightLeg.rotation.x>1);
    assert(t.leftLeg.rotation.x<0);
});
test('R58 legacy GLB door hinges ease open and closed, without abrupt angular velocity',()=>{
    assert(PoliceDoors.progress(.001)<.001);
    assert.equal(PoliceDoors.progress(.38),1);
    assert.equal(PoliceDoors.progress(.92),1);
    assert(Math.abs(PoliceDoors.progress(1.35))<1e-7);
    let previous=0;
    for(let t=0;t<=.38;t+=.019){
        const value=PoliceDoors.progress(t);
        assert(value>=previous-1e-7);previous=value;
    }
});
test('R58 script order, cache keys and desktop AA stay compatible with mobile',()=>{
    const html=source('index.html'),
        engine=source('js/engine/driver2-game-engine.js');
    assert(html.includes('driver-vehicle-doors-r58.js'));
    assert(html.indexOf('driver-vehicle-doors-r58.js')<
        html.indexOf('driver-vehicle.js?v=r58'));
    assert(html.includes('driver-vehicle-mount.js?v=r58'));
    assert(html.includes('tanner-controller.js?v=r58'));
    assert(engine.includes('antialias: true'));
    assert(engine.includes('coarse?1.5:1.85'));
});

test('R58 seated bike coordinates match raised group root, steering bars and footrests',()=>{
    const bike=car('motorcycle');
    bike.chassisTilt.position.set(0,0,0);
    const p=Mount.ridingSeat(bike);
    assert(Math.abs(p.y-.22)<1e-8);
    assert(Math.abs(p.z+.30)<1e-8);
    const targets=BikeIK.contacts(bike,{steer:0});
    assert.equal(targets.leftHand.y,1.47);
    assert.equal(targets.rightHand.y,1.47);
    assert.equal(targets.leftHand.z,.74);
    assert.equal(targets.rightFoot.z,-.17);
    assert.equal(targets.leftFoot.y,.67);
    const t=Object.create(Tanner.prototype);
    t.group=new Group();t.vehicleBoneRig={};
    t.playerModel=new Group();t.motorcycleVehicle=null;
    t.resetVehicleTransitionPose=()=>{};
    t.applyVehicleTransitionPose=()=>{};
    assert.equal(t.mountOnMotorcycle(bike),true);
    assert(Math.abs(t.group.position.y-p.y)<1e-8);
    assert(Math.abs(t.group.position.z-p.z)<1e-8);
});
