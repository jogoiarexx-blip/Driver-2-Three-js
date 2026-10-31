'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('js/physics/vehicle-collisions.js','utf8')+'\n'+fs.readFileSync('js/physics/tanner-vehicle-collisions.js','utf8')+'\nDriverTannerVehicleCollisions';
const Contact=vm.runInNewContext(code,{Math,Number,WeakMap});
const car=(extra={})=>({x:0,z:0,y:0,heading:0,speed:0,...extra});
function run(before,after,vehicle,old={x:vehicle.x,z:vehicle.z},city={isPointBlocked:()=>false}) {
 const t={group:{position:{...after,y:after.y||0}}};
 const count=Contact.resolve(t,[vehicle],city,before,new Map([[vehicle,old]]));
 return {p:t.group.position,count};
}
test('Tanner não atravessa carro parado caminhando',()=>{
 const v=car();const r=run({x:-3,z:0},{x:0,z:0},v);
 assert.equal(r.count,1);assert(r.p.x < -1.7);
});
test('carro em movimento empurra Tanner em vez de atravessá-lo',()=>{
 const v=car({z:3,speed:20});const r=run({x:0,z:0},{x:0,z:0},v,{x:0,z:-3});
 assert.equal(r.count,1);assert(r.p.z>v.z+3);assert(v.speed<20);
});
test('carro girado e ônibus usam dimensões e orientação próprias',()=>{
 const v=car({heading:Math.PI/2,bodyStyle:'bus'});
 const r=run({x:-6,z:0},{x:0,z:0},v);assert.equal(r.count,1);assert(r.p.x < -4.4);
});
test('passagem paralela e outro nível não geram colisão',()=>{
 assert.equal(run({x:4,z:-4},{x:4,z:4},car()).count,0);
 assert.equal(run({x:0,z:0},{x:0,z:0,y:12},car()).count,0);
});
test('não empurra Tanner através de parede',()=>{
 const v=car({z:2,speed:20});const r=run({x:0,z:0},{x:0,z:0},v,{x:0,z:-2},{isPointBlocked:()=>true});
 assert.equal(r.count,1);assert.equal(r.p.z,0);assert.equal(v.z,-2);
});
test('avanço irreal de veículo não cria colisão por teletransporte',()=>{
 const v=car({z:20});assert.equal(run({x:0,z:0},{x:0,z:0},v,{x:0,z:-20}).count,0);
});
test('módulo integrado após movimentação e pausado durante transições',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const engine=fs.readFileSync('js/engine/driver2-game-engine.js','utf8');
 assert(html.indexOf('vehicle-collisions.js')<html.indexOf('tanner-vehicle-collisions.js'));
 assert.match(engine,/!this\.policeDoorTransition &&\s*!this\.vehicleMountTransition/);
 assert(engine.indexOf('this.updateAIAndCollisions(dt);')<engine.indexOf('DriverTannerVehicleCollisions.resolve('));
});
