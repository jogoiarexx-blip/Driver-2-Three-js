/**
 * Contact-aware rider: restrained CCD for real Tanner hand/foot bones.
 * Targets are expressed in motorcycle chassis space (+Z = forward).
 * IK never moves bike physics, wheel geometry, skin weights or bind matrices.
 */
class DriverMotorcycleContactIK {
    static clamp(v,min,max){return Math.max(min,Math.min(max,v));}
    static smooth(current,target,dt,rate=8){
        return current+(target-current)*(1-Math.exp(-Math.max(0,Math.min(.08,dt))*rate));
    }
    static signals(previous,vehicle,dt){
        const seconds=this.clamp(Number(dt)||0,0,.08);
        const speed=Number.isFinite(vehicle?.speed)?vehicle.speed:0;
        const steer=this.clamp(Number(vehicle?.steerAngle)||0,-.8,.8);
        const roll=this.clamp(Number(vehicle?.rollAngle)||0,-.5,.5);
        const lateral=this.clamp(Number(vehicle?.lateralVelocity)||0,-12,12);
        const last=previous||{speed,lean:0,pitch:0,brake:0};
        // Derivative is deliberately capped; physics corrections/collisions
        // cannot snap spine or arms to impossible angles.
        const accel=seconds>1e-3?
            this.clamp((speed-last.speed)/seconds,-50,50):0;
        const desiredLean=this.clamp(-steer*.16-roll*.22-lateral*.007,-.21,.21);
        const desiredPitch=this.clamp(-accel*.0035,-.14,.14);
        return {
            speed,steer,roll,lateral,
            lean:this.smooth(last.lean||0,desiredLean,seconds,7),
            pitch:this.smooth(last.pitch||0,desiredPitch,seconds,8),
            brake:this.smooth(last.brake||0,accel< -5?1:0,seconds,11)
        };
    }
    static contacts(vehicle,signals){
        // Both targets move together with steering; the left/right offsets
        // remain symmetric in the bike's local reference frame.
        const steer=this.clamp(signals.steer||0,-.8,.8);
        return {
            leftHand:{x:-.34-steer*.045,y:1.26,z:.49+steer*.06},
            rightHand:{x:.34-steer*.045,y:1.26,z:.49-steer*.06},
            leftFoot:{x:-.30,y:.70,z:-.09},
            rightFoot:{x:.30,y:.70,z:-.09}
        };
    }
    static bend(rig,role,x=0,y=0,z=0){
        const entry=rig.found[role];
        if(!entry || (Math.abs(x)+Math.abs(y)+Math.abs(z))<1e-7)return;
        rig.euler.set(x,y,z,'XYZ');
        rig.offset.setFromEuler(rig.euler);
        entry.node.quaternion.multiply(rig.offset);
    }
    static solve(rig,roles,worldTarget,rootGroup,weight=1){
        const upper=rig.found[roles[0]]?.node;
        const lower=rig.found[roles[1]]?.node;
        const end=rig.found[roles[2]]?.node;
        if(!upper||!lower||!end||!worldTarget)return null;
        const target=worldTarget;
        const p=new THREE.Vector3(),e=new THREE.Vector3();
        const direction=new THREE.Vector3(),goal=new THREE.Vector3();
        const parentQ=new THREE.Quaternion(),localDelta=new THREE.Quaternion();
        const delta=new THREE.Quaternion(),identity=new THREE.Quaternion();
        const initialDistance=(()=>{
            rootGroup.updateMatrixWorld(true);
            end.getWorldPosition(e);
            return e.distanceTo(target);
        })();
        // Models with incompatible scales or axes must keep the authored
        // animation instead of stretching bones toward a distant anchor.
        if(!Number.isFinite(initialDistance)||initialDistance>1.6)
            return {skipped:true,before:initialDistance,after:initialDistance};
        const limit=this.clamp(weight,0,1);
        for(let i=0;i<3;i++){
            for(const joint of [lower,upper]){
                rootGroup.updateMatrixWorld(true);
                joint.getWorldPosition(p);
                end.getWorldPosition(e);
                direction.copy(e).sub(p);
                goal.copy(target).sub(p);
                if(direction.lengthSq()<1e-8||goal.lengthSq()<1e-8)continue;
                direction.normalize();goal.normalize();
                delta.setFromUnitVectors(direction,goal);
                const angle=2*Math.acos(this.clamp(delta.w,-1,1));
                if(angle<1e-4)continue;
                delta.slerp(identity,1-this.clamp((i===0?.24:.19)*limit/angle,0,1));
                if(joint.parent)joint.parent.getWorldQuaternion(parentQ);
                else parentQ.identity();
                localDelta.copy(parentQ).invert().multiply(delta).multiply(parentQ);
                joint.quaternion.premultiply(localDelta).normalize();
            }
        }
        rootGroup.updateMatrixWorld(true);
        end.getWorldPosition(e);
        return {before:initialDistance,after:e.distanceTo(target),skipped:false};
    }
    static apply(tanner,vehicle,signals){
        const rig=tanner?.vehicleBoneRig;
        if(!rig||!vehicle?.chassisTilt||
           typeof THREE==='undefined')return null;
        const worldTarget=new THREE.Vector3();
        const contacts=this.contacts(vehicle,signals);
        this.bend(rig,'spine',signals.pitch*.36,0,signals.lean*.45);
        this.bend(rig,'spine1',signals.pitch*.34,0,signals.lean*.50);
        this.bend(rig,'spine2',signals.pitch*.30,0,signals.lean*.35);
        this.bend(rig,'hips',-signals.pitch*.2,0,-signals.lean*.22);
        // Keep handlebars and pegs in the vehicle's coordinate frame even
        // when chassis suspension, tilt or root heading changes.
        const pairs=[
            [['leftArm','leftForeArm','leftHand'],contacts.leftHand,.85],
            [['rightArm','rightForeArm','rightHand'],contacts.rightHand,.85],
            [['leftUpLeg','leftLeg','leftFoot'],contacts.leftFoot,.75],
            [['rightUpLeg','rightLeg','rightFoot'],contacts.rightFoot,.75]
        ];
        const report={};
        for(const [roles,point,weight] of pairs){
            worldTarget.set(point.x,point.y,point.z);
            vehicle.chassisTilt.localToWorld(worldTarget);
            report[roles[2]]=this.solve(rig,roles,worldTarget,
                tanner.group,weight);
        }
        // Small wrist/ankle finish; no free-standing hand or foot meshes.
        this.bend(rig,'leftHand',0,0,-signals.steer*.035);
        this.bend(rig,'rightHand',0,0,-signals.steer*.035);
        this.bend(rig,'leftFoot',signals.brake*.035,0,0);
        this.bend(rig,'rightFoot',signals.brake*.035,0,0);
        return report;
    }
}
