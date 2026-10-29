'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
class Vector3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 clone(){return new Vector3(this.x,this.y,this.z);}
 copy(x){this.x=x.x;this.y=x.y;this.z=x.z;return this;}
}
class Euler{
 set(x,y,z,order){this.x=x;this.y=y;this.z=z;this.order=order;return this;}
}
class Quaternion{
 constructor(x=0,y=0,z=0,w=1){this.x=x;this.y=y;this.z=z;this.w=w;}
 clone(){return new Quaternion(this.x,this.y,this.z,this.w);}
 copy(q){Object.assign(this,{x:q.x,y:q.y,z:q.z,w:q.w});return this;}
 setFromEuler(e){this.x=e.x;this.y=e.y;this.z=e.z;this.w=1;return this;}
 multiply(q){this.x+=q.x;this.y+=q.y;this.z+=q.z;return this;}
}
const Rig=vm.runInNewContext(fs.readFileSync('js/entities/tanner-vehicle-bone-rig.js','utf8')+
 '\nDriverTannerVehicleRig',{THREE:{Quaternion,Euler},Math,Number});
const real=fs.readFileSync('assets/player/Tanner.glb');
const gltf=JSON.parse(real.subarray(20,20+real.readUInt32LE(12)).toString('utf8'));
const joints=new Set((gltf.skins||[]).flatMap(s=>s.joints||[]));
const names=[...joints].map(i=>gltf.nodes[i]?.name);

function rig(){
 const nodes=names.map(name=>({
  name,isBone:true,quaternion:new Quaternion(.08,.03,.02,1),
  position:new Vector3(.01,1.1,-.02),
  scale:new Vector3(1,1,1)
 }));
 const root={traverse(fn){for(const n of nodes)fn(n);}};
 return {root,nodes,object:Rig.bind(root)};
}

test('Tanner GLB has hips, shoulders, forearms, knees and two complete legs',()=>{
 assert.equal(real.toString('ascii',0,4),'glTF');
 assert.equal(gltf.skins.length,1);
 for(const role of Object.values(Rig.bones))
   assert(names.includes('mixamorig:'+role),'bone missing: '+role);
 assert(names.length>=30);
});
test('skeleton motorcycle pose changes bone quaternions without changing skin dimensions',()=>{
 const {nodes,object}=rig();assert(object);
 const hips=nodes.find(n=>n.name==='mixamorig:Hips');
 const left=nodes.find(n=>n.name==='mixamorig:LeftUpLeg');
 const scale=left.scale.clone(),original=left.quaternion.clone();
 assert(Rig.apply(object,'motorcycle','enter',.65,-1));
 assert(object.applied>.8);
 assert.notEqual(left.quaternion.x,original.x);
 assert(hips.position.y<1.1);
 assert.deepEqual([left.scale.x,left.scale.y,left.scale.z],[scale.x,scale.y,scale.z]);
 Rig.restore(object);
 assert.equal(left.quaternion.x,original.x);
 assert.equal(hips.position.y,1.1);
});
test('many frame updates do not accumulate angular or positional deformation',()=>{
 const {nodes,object}=rig();
 const left=nodes.find(n=>n.name==='mixamorig:LeftUpLeg');
 Rig.apply(object,'motorcycle','ride',1,-1);
 const expected=left.quaternion.x;
 for(let i=0;i<500;i++)Rig.apply(object,'motorcycle','ride',1,-1);
 assert.equal(left.quaternion.x,expected);
 Rig.restore(object);
 assert.equal(left.quaternion.x,.08);
});
test('mount side swaps the high swinging leg',()=>{
 const a=rig(),b=rig();
 Rig.apply(a.object,'motorcycle','enter',.65,-1);
 Rig.apply(b.object,'motorcycle','enter',.65,1);
 const rotations=r=>[
  r.nodes.find(n=>n.name==='mixamorig:LeftUpLeg').quaternion.x,
  r.nodes.find(n=>n.name==='mixamorig:RightUpLeg').quaternion.x
 ];
 const [al,ar]=rotations(a),[bl,br]=rotations(b);
 assert(Math.abs(al-br)<1e-6 && Math.abs(ar-bl)<1e-6);
});
test('missing skeletal rig keeps procedural fallback safe',()=>{
 assert.equal(Rig.bind({traverse(fn){fn({name:'unknown',isBone:true,
  quaternion:new Quaternion(),position:new Vector3()});}}),null);
 assert.equal(Rig.apply(null,'motorcycle','enter',.7),false);
});
test('reparent flow exists and leaves the real character out of vehicle disposal',()=>{
 const controller=fs.readFileSync('js/entities/tanner-controller.js','utf8');
 const mount=fs.readFileSync('js/vehicles/driver-vehicle-mount.js','utf8');
 const engine=fs.readFileSync('js/engine/driver2-game-engine.js','utf8');
 assert.match(controller,/mountOnMotorcycle\(vehicle\)/);
 assert.match(controller,/detachFromMotorcycle\(\)/);
 assert.match(mount,/engine\.tanner\.mountOnMotorcycle\?\.\(s\.vehicle\)/);
 assert.match(engine,/this\.tanner\.detachFromMotorcycle\?\.\(\)/);
});
