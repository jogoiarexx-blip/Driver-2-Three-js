const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),vm=require('vm'),root=process.cwd();const read=p=>fs.readFileSync(p,'utf8');
const context=vm.createContext({Math,Date,performance:{now:()=>10000},VehicleVisuals:{update(){},setHeadlights(){}},GPUResourceUtils:{disposeSubtree(){}}});
vm.runInContext(read('js/physics/arcade-dynamics.js')+read('js/physics/vehicle-collisions.js')+read('js/vehicles/driver-vehicle.js'),context);
const Real=vm.runInContext('DriverVehicle',context);
class Car{constructor(scene,c){Object.assign(this,{y:0,vy:0,speed:0,lateralVelocity:0,damage:0,hubcaps:0,wheels:[],wheelSpin:0,pitchAngle:0,rollAngle:0,steerAngle:0,chassisTilt:{rotation:{x:0,z:0}},root:{}},c)}updateTransform(){} updatePhysics(...args){return Real.prototype.updatePhysics.apply(this,args)}}
const road=require(root+'/js/world/chicago-north-link-r35.js').plan(),group={};road.mesh={parent:group};
const city={cityGroup:group,chicagoReferenceNorthLinkR35:road,chicagoPS1StreetNetwork:{sourceCorridors:11},isWaterAt:()=>false,isPointBlocked:()=>false,getGroundHeightAt:()=>0,missionStart:{type:'story_tipoff'}};
const game={city,scene:{remove(){}},currentCityKey:'chicago'};
const script=read('tests/chicago-r35-north-link-browser.cjs');const body=script.split('const report=await page.evaluate(reverse=>{')[1].split('  },reverse);')[0];
for(const reverse of [false,true])test(`R35 física arcade em piso plano, sentido ${reverse}`,()=>{const c=vm.createContext({window:{DriverGame:game},DriverVehicle:Car,DriverChicagoPS1StreetNetwork:require(root+'/js/world/chicago-ps1-street-network-r22.js'),Math,reverse});const result=vm.runInContext('(function(){'+body+'})()',c);assert(result.frames<7200);assert(result.maxOffset<2.45);assert.equal(result.offroadFrames,0);assert(result.finalDistance<3.7);assert.equal(result.maxDamage,0);});
