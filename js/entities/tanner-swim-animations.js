/** Mixamo Swim_Forward / Swim_Idle from the uploaded "homem velho.glb".
 * Compressed bone quaternion curves, retargeted to Tanner's existing Mixamo rig.
 * No old-man mesh/texture or root translation is included. */
class DriverTannerSwimAnimations {
 static boneNames=["Hips","Spine","Spine1","Spine2","Neck","Head","LeftShoulder","LeftArm","LeftForeArm","LeftHand","RightShoulder","RightArm","RightForeArm","RightHand","LeftUpLeg","LeftLeg","LeftFoot","LeftToeBase","RightUpLeg","RightLeg","RightFoot","RightToeBase"];
 static sourceRest=[[0.045255,-0.005182,-0.005182,0.998949],[-0.062941,0.007074,0.007086,0.997967],[-0.045976,-0.001508,0.004916,0.998929],[0.205113,-0.003239,-0.028704,0.978312],[0.032905,-0.001443,-0.00477,0.999446],[-0.172283,-0.028801,0.003081,0.984622],[-0.63883,-0.565193,-0.403629,0.330963],[-0.418054,0.479206,-0.172332,0.752259],[0.050525,-0.025337,-0.111735,0.992129],[0,0.028401,0,0.999597],[-0.706297,0.489519,0.387567,0.333628],[-0.378069,-0.537707,0.212552,0.723019],[0.08471,-0.020491,0.079061,0.993053],[0,-0.028401,0,0.999597],[0.991147,0.089756,0.072145,0.066076],[0.103125,-0.032805,0.047825,0.992976],[-0.415528,0.211946,-0.286758,0.836771],[0.143251,0.827126,-0.276739,0.467715],[0.995828,-0.054696,-0.059836,0.041884],[0.090096,0.01894,-0.029485,0.995316],[-0.402252,-0.246404,0.327355,0.818729],[0.169606,-0.807534,0.261271,0.50086]];
 static clips={swim_forward:{duration:4.5,encoded:'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'},swim_idle:{duration:3,encoded:'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'}};
 static decode(data) {
  const raw=atob(data), result=new Int16Array(raw.length/2);
  for(let i=0;i<result.length;i++){
   const word=raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8);
   result[i]=word>32767?word-65536:word;
  }
  return result;
 }
 static build(root) {
  if(typeof THREE==='undefined'||!THREE.QuaternionKeyframeTrack||
     !THREE.AnimationClip||!root?.traverse)return [];
  const nodes=new Map();
  root.traverse(node=>{
   if(!node.isBone||!node.quaternion)return;
   const key=String(node.name||'').replace(/^mixamorig[:_]?/i,'');
   if(!nodes.has(key))nodes.set(key,node);
  });
  const result=[];
  for(const [name,source] of Object.entries(this.clips)) {
   const coeff=this.decode(source.encoded),count=Math.round(source.duration*16)+1;
   if(coeff.length!==this.boneNames.length*52)
    throw new Error('Swim data length mismatch: '+name);
   const times=Array.from({length:count},(_,i)=>source.duration*i/(count-1));
   const tracks=[];
   for(let bone=0;bone<this.boneNames.length;bone++) {
    const target=nodes.get(this.boneNames[bone]);
    if(!target)continue;
    const srcRest=new THREE.Quaternion(...this.sourceRest[bone]);
    const correction=target.quaternion.clone().multiply(srcRest.invert());
    const values=[],prev=new THREE.Quaternion();
    for(let frame=0;frame<count;frame++) {
     const phase=2*Math.PI*frame/(count-1),quat=[];
     for(let axis=0;axis<4;axis++) {
      const off=(bone*4+axis)*13;
      let value=coeff[off]/32767;
      for(let k=1;k<=6;k++)
       value+=coeff[off+2*k-1]/32767*Math.cos(k*phase)+coeff[off+2*k]/32767*Math.sin(k*phase);
      quat.push(value);
     }
     const q=new THREE.Quaternion(...quat).normalize().premultiply(correction).normalize();
     if(frame&&prev.dot(q)<0)q.set(-q.x,-q.y,-q.z,-q.w);
     values.push(q.x,q.y,q.z,q.w);
     prev.copy(q);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(target.name+'.quaternion',times,values));
   }
   if(tracks.length>=12)result.push(new THREE.AnimationClip(name,source.duration,tracks));
  }
  return result;
 }
}
