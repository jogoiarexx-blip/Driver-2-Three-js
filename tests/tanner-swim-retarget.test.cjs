'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=(p)=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
class Quaternion {
  constructor(x=0,y=0,z=0,w=1){this.set(x,y,z,w)}
  set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this}
  clone(){return new Quaternion(this.x,this.y,this.z,this.w)}
  copy(q){return this.set(q.x,q.y,q.z,q.w)}
  normalize(){const n=Math.hypot(this.x,this.y,this.z,this.w)||1;return this.set(this.x/n,this.y/n,this.z/n,this.w/n)}
  multiply(q){const a=this.clone();return this.set(a.w*q.x+a.x*q.w+a.y*q.z-a.z*q.y,a.w*q.y-a.x*q.z+a.y*q.w+a.z*q.x,a.w*q.z+a.x*q.y-a.y*q.x+a.z*q.w,a.w*q.w-a.x*q.x-a.y*q.y-a.z*q.z)}
  premultiply(q){const b=this.clone();return this.copy(q).multiply(b)}
  invert(){return this.set(-this.x,-this.y,-this.z,this.w)}
  dot(q){return this.x*q.x+this.y*q.y+this.z*q.z+this.w*q.w}
}
class Track {
  constructor(name,times,values){Object.assign(this,{name,times,values})}
}
class Clip {
  constructor(name,duration,tracks){Object.assign(this,{name,duration,tracks})}
}
const animations=vm.runInNewContext(
  read('js/entities/tanner-swim-animations.js')+'\nDriverTannerSwimAnimations',
  {THREE:{Quaternion,QuaternionKeyframeTrack:Track,AnimationClip:Clip},
   atob,Int16Array,Math,Map,Object,Number}
);
const bones=()=>animations.boneNames.map(name=>({
  isBone:true,name:'mixamorig:'+name,quaternion:new Quaternion()
}));
test('nado do velho vira 2 clips reais sem trocar modelo do Tanner',()=>{
  const mesh=bones(),clips=animations.build({traverse:f=>mesh.forEach(f)});
  assert.deepEqual(Array.from(clips.map(c=>c.name)),['swim_forward','swim_idle']);
  for(const clip of clips){
    assert.equal(clip.tracks.length,22);
    assert.ok(clip.duration>=3);
    for(const track of clip.tracks){
      assert.ok(track.name.startsWith('mixamorig:'));
      for(let i=0;i<track.values.length;i+=4){
        const q=track.values.slice(i,i+4);
        assert.ok(q.every(Number.isFinite),'Quaternion invalido');
        assert.ok(Math.abs(Math.hypot(...q)-1)<1e-5);
      }
    }
  }
});
test('não aplica retarget a rig sem bones Mixamo',()=>{
  assert.equal(animations.build({traverse:()=>{}}).length,0);
});
const Tanner=vm.runInNewContext(
  read('js/entities/tanner-controller.js')+'\nTannerController',
  {Math,THREE:{},console}
);
const mock=()=>{
  const t=Object.create(Tanner.prototype),anim=[];
  t.group={visible:true,position:{x:0,y:0,z:2},rotation:{y:0}};
  t.heading=0;t.walkCycle=0;t.isSwimming=false;t.swimClock=0;
  t.isSitting=false;t.playerModel={};
  t.playModelAnimation=(name)=>anim.push(name);
  for(const bone of ['leftLeg','rightLeg','leftArm','rightArm'])
    t[bone]={rotation:{x:0}};
  t.contactShadow={visible:true};
  const city={
    isWaterAt:(x,z)=>z>=1&&z<5,
    getGroundHeightAt:()=>0,
    isPointBlocked:()=>false
  };
  return {t,anim,city};
};
test('na agua parado, Tanner boia e seleciona swim_idle',()=>{
  const {t,city,anim}=mock();t.update(.016,{},city);
  assert.equal(t.isSwimming,true);
  assert.equal(anim.at(-1),'swim_idle');
  assert.ok(t.group.position.y>-1&&t.group.position.y<-.65);
  assert.equal(t.contactShadow.visible,false);
});
test('na agua em movimento, Tanner nada e nao caminha no leito',()=>{
  const {t,city,anim}=mock();t.update(.1,{up:true},city);
  assert.equal(t.isSwimming,true);
  assert.equal(anim.at(-1),'swim_forward');
  assert.ok(t.group.position.z>2&&t.group.position.z<2.6);
  assert.ok(t.group.position.y>-.85);
});
test('ao atingir terra, retorna a animacao de caminhada e piso',()=>{
  const {t,city,anim}=mock();
  t.group.position.z=4.7;t.update(.2,{up:true},city);
  assert.equal(t.isSwimming,false);
  assert.equal(anim.at(-1),'walk');
  assert.equal(t.group.position.y,0);
  assert.equal(t.contactShadow.visible,true);
});
test('index carrega fonte dos clips antes do Tanner e invalida cache',()=>{
  const html=read('index.html');
  assert.ok(html.indexOf('tanner-swim-animations.js')>0);
  assert.ok(html.indexOf('tanner-swim-animations.js')<
    html.indexOf('tanner-controller.js'));
  assert.match(html,/tanner-controller\.js\?v=swim-retarget-r1/);
});
