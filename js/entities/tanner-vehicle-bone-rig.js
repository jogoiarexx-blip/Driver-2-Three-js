/**
 * Driver 2 — pose de entrada/saída usando os ossos reais Mixamo do Tanner.
 * Não altera skeleton.bindMatrix, pesos, material nem a física dos veículos.
 * Aplicar depois do AnimationMixer; restaurar antes do próximo mixer.update
 * evita acumular rotações quadro após quadro.
 */
class DriverTannerVehicleRig {
    static bones={
        hips:'Hips',spine:'Spine',spine1:'Spine1',spine2:'Spine2',
        leftArm:'LeftArm',rightArm:'RightArm',
        leftForeArm:'LeftForeArm',rightForeArm:'RightForeArm',
        leftHand:'LeftHand',rightHand:'RightHand',
        leftUpLeg:'LeftUpLeg',rightUpLeg:'RightUpLeg',
        leftLeg:'LeftLeg',rightLeg:'RightLeg',
        leftFoot:'LeftFoot',rightFoot:'RightFoot'
    };
    static bind(root){
        if(!root?.traverse || typeof THREE==='undefined' ||
           typeof THREE.Quaternion!=='function')return null;
        const found={};
        root.traverse(node=>{
            if(!node.isBone || !node.quaternion) return;
            const name=String(node.name||'').replace(/^mixamorig[:_]?/i,'');
            for(const [role,boneName] of Object.entries(this.bones))
                if(name.toLowerCase()===boneName.toLowerCase() && !found[role])
                    found[role]={
                        node,
                        rotation:node.quaternion.clone(),
                        position:node.position.clone()
                    };
        });
        // Não mexer em rig desconhecido: preserva animação Walking.
        if(!found.hips||!found.leftUpLeg||!found.rightUpLeg||
           !found.leftArm||!found.rightArm)return null;
        return {found,offset:new THREE.Quaternion(),euler:new THREE.Euler(),
                active:false,applied:0};
    }
    static ease(t){
        t=Math.max(0,Math.min(1,t));
        return t*t*(3-2*t);
    }
    static progress(kind,t){
        const p=Math.max(0,Math.min(1,t));
        if(kind==='ride')return 1;
        if(kind==='enter')return this.ease((p-.20)/.34);
        return 1-this.ease((p-.14)/.66);
    }
    static restore(rig){
        if(!rig?.active)return;
        for(const entry of Object.values(rig.found)){
            entry.node.quaternion.copy(entry.rotation);
            entry.node.position.copy(entry.position);
        }
        rig.active=false;rig.applied=0;
    }
    static apply(rig,style,kind,t,mountSide=-1){
        if(!rig)return false;
        // Só modificar o GLB depois que o mixer foi atualizado.
        // Sempre restaurar a pose-base antes de escrever o próximo quadro.
        this.restore(rig);
        const w=this.progress(kind,t);
        if(w<.001)return false;
        const bike=style==='motorcycle';
        const side=mountSide===1?1:-1;
        const swing=kind==='ride'?1:Math.sin(Math.PI*this.ease(
            Math.max(0,Math.min(1,(t-.22)/.62))));
        const arm=bike?.65:.33,leg=bike?.80:.28;
        const pose={
            hips:[-leg*.16,0,side*leg*.055],
            spine:[-arm*.12,0,0],
            spine1:[-arm*.14,0,0],
            spine2:[-arm*.10,0,0],
            leftArm:[-arm*(side===1?1:.8),0,-arm*.12],
            rightArm:[-arm*(side===-1?1:.8),0,arm*.12],
            leftForeArm:[-arm*.60,0,0],
            rightForeArm:[-arm*.60,0,0],
            leftUpLeg:[-leg*(side===1?1.15:.75)*(kind==='ride'?1:swing),0,0],
            rightUpLeg:[-leg*(side===-1?1.15:.75)*(kind==='ride'?1:swing),0,0],
            leftLeg:[leg*(side===1?1.5:1.1),0,0],
            rightLeg:[leg*(side===-1?1.5:1.1),0,0]
        };
        for(const [role,entry] of Object.entries(rig.found)){
            const r=pose[role];
            if(!r)continue;
            rig.euler.set(r[0]*w,r[1]*w,r[2]*w,'XYZ');
            rig.offset.setFromEuler(rig.euler);
            entry.node.quaternion.copy(entry.rotation).multiply(rig.offset);
        }
        if(rig.found.hips){
            const hips=rig.found.hips;
            hips.node.position.y=hips.position.y-(bike?.25:.10)*w;
            hips.node.position.x=hips.position.x+(kind==='ride'?0:side*.035*w);
        }
        rig.active=true;
        rig.applied=w;
        return true;
    }
}
