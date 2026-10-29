'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/entities/tanner-motorcycle-contact-ik.js','utf8');
const IK=vm.runInNewContext(source+'\nDriverMotorcycleContactIK',{Math,Number});

test('motorcycle targets remain symmetric with neutral handlebars',()=>{
 const p=IK.contacts({},{steer:0});
 assert.equal(p.leftHand.x,-p.rightHand.x);
 assert.equal(p.leftFoot.x,-p.rightFoot.x);
 assert.equal(p.leftFoot.y,p.rightFoot.y);
 assert(p.leftHand.z>p.leftFoot.z);
});
test('handlebar grip targets follow steering without moving the foot pegs',()=>{
 const neutral=IK.contacts({}, {steer:0});
 const turn=IK.contacts({}, {steer:.55});
 assert.notEqual(turn.leftHand.x,neutral.leftHand.x);
 assert.notEqual(turn.rightHand.z,neutral.rightHand.z);
 assert.equal(turn.leftFoot.x,neutral.leftFoot.x);
 assert.equal(turn.rightFoot.z,neutral.rightFoot.z);
});
test('lean follows steering, rolling and lateral velocity gradually',()=>{
 const prev=IK.signals(null,{speed:10,steerAngle:0,rollAngle:0,lateralVelocity:0},1/60);
 const v={speed:11,steerAngle:.6,rollAngle:.12,lateralVelocity:3};
 const first=IK.signals(prev,v,1/60);
 assert(first.lean<0);
 const target=-.6*.16-.12*.22-3*.007;
 assert(Math.abs(first.lean)<Math.abs(target));
 let state=first;
 for(let i=0;i<80;i++)state=IK.signals(state,v,1/60);
 assert(Math.abs(state.lean-target)<.001);
});
test('hard braking stays bounded and restores after the bike stops',()=>{
 let state=IK.signals(null,{speed:25},1/60);
 state=IK.signals(state,{speed:0},1/60);
 assert(state.pitch>=-.14&&state.pitch<=.14);
 assert(state.brake>0);
 for(let i=0;i<110;i++)state=IK.signals(state,{speed:0},1/60);
 assert(state.brake<.001);
});
test('velocity spikes, zero delta and invalid measurements never produce NaN',()=>{
 let state=IK.signals(null,{speed:10,steerAngle:NaN,rollAngle:NaN},0);
 assert(Number.isFinite(state.lean)&&Number.isFinite(state.pitch));
 state=IK.signals(state,{speed:1e8,steerAngle:1e8,rollAngle:1e8,lateralVelocity:1e8},1e3);
 assert(Math.abs(state.lean)<=.21&&Math.abs(state.pitch)<=.14);
 assert(Number.isFinite(state.lean)&&Number.isFinite(state.pitch));
});
test('missing rig or vehicle safely disables contact IK',()=>{
 assert.equal(IK.apply(null,null,{}),null);
 assert.equal(IK.apply({vehicleBoneRig:null},null,{}),null);
});
test('Tanner controller is wired to the original GLB rather than extra procedural meshes',()=>{
 const controller=fs.readFileSync('js/entities/tanner-controller.js','utf8');
 const html=fs.readFileSync('index.html','utf8');
 const rig=fs.readFileSync('js/entities/tanner-vehicle-bone-rig.js','utf8');
 assert.match(controller,/DriverMotorcycleContactIK\.signals/);
 assert.match(controller,/DriverMotorcycleContactIK\.apply/);
 assert.match(rig,/leftHand:'LeftHand'/);
 assert.match(rig,/rightFoot:'RightFoot'/);
 assert(html.indexOf('tanner-motorcycle-contact-ik.js')<html.indexOf('tanner-controller.js'));
});
