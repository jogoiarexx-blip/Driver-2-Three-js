'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const Mount=vm.runInNewContext(read('js/vehicles/driver-vehicle-mount.js')+
    '\nDriverVehicleMount',{Math,Number});
const Rider=vm.runInNewContext(read('js/assets/uploaded-vehicles.js')+
    '\nDriverUploadedVehicles',{Math,Number});
function harness(style='motorcycle',city={}){
 const bike={bodyStyle:style,x:0,y:0,z:0,heading:0,speed:0,
    lateralVelocity:0,motorcycleRider:{visible:false,rotation:{x:0,z:0}}};
 const tanner={
    heading:0,group:{visible:true,position:{x:-2,y:0,z:0}},
    poses:[],resetCount:0,
    setVisible(value){this.group.visible=value;},
    setPosition(x,y,z,h){Object.assign(this.group.position,{x,y,z});this.heading=h;},
    applyVehicleTransitionPose(...args){this.poses.push(args);},
    resetVehicleTransitionPose(){this.resetCount++;}
 };
 const engine={vehicles:[bike],city,mode:'on_foot',playerCar:null,
    vehicleMountTransition:null,policeDoorTransition:null,tanner,felony:80,
    isPoliceNearPlayer:()=>false};
 return {engine,bike,tanner};
}
function run(engine,count=110){
 for(let i=0;i<count;i++){
   Mount.update(engine,1/60);
   Rider.updateRiders(engine);
 }
}
test('mount motorcycle gradually: foot first, visible rider only near seating',()=>{
 const {engine,bike,tanner}=harness();
 assert(Mount.start(engine,bike,'enter'));
 assert.equal(engine.mode,'on_foot');
 Rider.updateRiders(engine);
 assert.equal(bike.motorcycleRider.visible,false);
 Mount.update(engine,1/60);
 assert.equal(tanner.group.visible,true);
 assert(tanner.poses.length>0);
 for(let i=0;i<105;i++){Mount.update(engine,1/60);Rider.updateRiders(engine);}
 assert.equal(engine.mode,'driving');
 assert.equal(engine.playerCar,bike);
 assert.equal(tanner.group.visible,false);
 assert.equal(bike.motorcycleRider.visible,true);
 assert.equal(tanner.resetCount,1);
 assert.equal(engine.vehicleMountTransition,null);
});
test('dismount bike gradually and restore Tanner in a clear safe position',()=>{
 const {engine,bike,tanner}=harness('motorcycle',{isPointBlocked:()=>false});
 engine.mode='driving';engine.playerCar=bike;tanner.setVisible(false);
 Rider.updateRiders(engine);assert.equal(bike.motorcycleRider.visible,true);
 assert(Mount.start(engine,bike,'exit'));
 assert.equal(engine.mode,'driving');
 for(let i=0;i<25;i++){Mount.update(engine,1/60);Rider.updateRiders(engine);}
 assert.equal(bike.motorcycleRider.visible,false);
 assert.equal(tanner.group.visible,true);
 run(engine);
 assert.equal(engine.mode,'on_foot');
 assert.equal(engine.playerCar,bike);
 assert(tanner.group.position.x < -1.5);
 assert(tanner.resetCount===1);
 assert.equal(bike.motorcycleRider.visible,false);
});
test('car transition freezes physics and changes driver only when finished',()=>{
 const {engine,bike,tanner}=harness('muscle');
 bike.speed=8;
 engine.playerCar={name:'previous'};
 assert(Mount.start(engine,bike,'enter'));
 assert.equal(bike.speed,0);
 assert.equal(engine.playerCar.name,'previous');
 assert.equal(engine.mode,'on_foot');
 assert.equal(Mount.start(engine,bike,'exit'),false);
 run(engine);
 assert.equal(engine.mode,'driving');
 assert.equal(engine.playerCar,bike);
 assert(tanner.poses.length>0);
 assert.equal(engine.felony,15);
 assert(Mount.start(engine,bike,'exit'));
 run(engine);
 assert.equal(engine.mode,'on_foot');
 assert.equal(tanner.group.visible,true);
});
test('blocked exit refuses to teleport Tanner into buildings or water',()=>{
 const {engine,bike}=harness('motorcycle',{
    isWaterAt:()=>true,isPointBlocked:()=>true
 });
 engine.mode='driving';engine.playerCar=bike;
 assert.equal(Mount.start(engine,bike,'exit'),false);
 assert.equal(engine.mode,'driving');
 assert.equal(engine.vehicleMountTransition,null);
});
test('both sides are considered if the first exit sidewalk is obstructed',()=>{
 const {engine,bike,tanner}=harness('muscle',{
    isPointBlocked:x=>x<0,isWaterAt:()=>false
 });
 engine.mode='driving';engine.playerCar=bike;
 assert(Mount.start(engine,bike,'exit'));
 run(engine);
 assert.equal(engine.mode,'on_foot');
 assert(tanner.group.position.x>2);
});
test('runner and HTML use transition module while preserving police door rig',()=>{
 const html=read('index.html');
 const engine=read('js/engine/driver2-game-engine.js');
 assert.match(html,/driver-vehicle-mount\.js/);
 assert(html.indexOf('driver-vehicle-mount.js')<
        html.indexOf('driver2-game-engine.js'));
 assert.match(engine,/DriverVehicleMount\.start\(this,this\.playerCar,'exit'\)/);
 assert.match(engine,/DriverVehicleMount\.start\(this,closestCar,'enter'\)/);
 assert.match(engine,/DriverVehicleMount\.update\(this,dt\)/);
 assert.match(engine,/this\.policeDoorTransition\|\|this\.vehicleMountTransition/);
 assert.match(engine,/this\.startPoliceDoorTransition\(this\.playerCar,'exit'\)/);
});

// A única referência aceitável para o fim da animação é a posição
// real do chassi, não uma estimativa baseada no centro físico.
test('motorcycle seat anchor uses chassis world transform, not vehicle y',()=>{
 class Vec{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}}
 const Actual=vm.runInNewContext(read('js/vehicles/driver-vehicle-mount.js')+
     '\nDriverVehicleMount',{Math,Number,THREE:{Vector3:Vec}});
 const {engine,bike}=harness();
 bike.x=9;bike.y=1;bike.z=8;bike.heading=.8;
 bike.chassisTilt={
   updateWorldMatrix(){this.updated=true;},
   localToWorld(v){return {x:bike.x+v.x+.25,y:2.15,z:bike.z+v.z-1.2};}
 };
 const seat=Actual.ridingSeat(bike);
 assert.equal(seat.x,9.25);
 assert.equal(seat.y,2.15);
 assert.equal(seat.z,6.5);
 assert.equal(bike.chassisTilt.updated,true);
 assert(Actual.start(engine,bike,'enter'));
 const s=engine.vehicleMountTransition;
 assert.equal(s.seat.y,seat.y);
 assert.equal(s.seat.x,seat.x);
});
test('mount approaches bike on shortest heading path across 180° boundary',()=>{
 const from=Math.PI-.08,to=-Math.PI+.08;
 const quarter=Mount.heading(from,to,.25);
 const halfway=Mount.heading(from,to,.5);
 assert(Math.abs(quarter-from)<.06);
 assert(Math.abs(halfway-from)<.1);
 assert(Math.abs(Math.sin(halfway))<.1);
});
test('seat pose is not clamped to pavement during the leg sweep',()=>{
 const {engine,bike,tanner}=harness('motorcycle',{
     getGroundHeightAt:()=>9
 });
 assert(Mount.start(engine,bike,'enter'));
 for(let i=0;i<80;i++)Mount.update(engine,1/60);
 assert(tanner.group.position.y<1,
    'seat phase should not jump up to sidewalk/pavement height');
});
