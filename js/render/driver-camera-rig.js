/**
 * Câmera cinematográfica Driver 2, com suavização temporal e verificação
 * de visibilidade em torno dos quarteirões.
 */
class DriverCameraRig {
    constructor() {
        this.lastMode = -1;
        this.focus = null;
    }
    static visibleDistance(city, origin, desired, minimum = 3.4) {
        if (!city || typeof city.isPointBlocked !== 'function') return 1;
        const dx = desired.x - origin.x, dz = desired.z - origin.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 0.01) return 1;
        const increments = Math.max(5, Math.ceil(distance / 1.7));
        for (let i = 2; i <= increments; i++) {
            const fraction = i / increments;
            const x = origin.x + dx * fraction;
            const z = origin.z + dz * fraction;
            const y = origin.y + (desired.y-origin.y) * fraction;
            if (city.isPointBlocked(x, z, 0.5, y)) {
                return Math.max(Math.min(1,minimum/distance),(i - 2) / increments);
            }
        }
        return 1;
    }
    static targetPosition(pos, car, mode, cameraMode, lookBack) {
        const sx = Math.sin(pos.heading), cz = Math.cos(pos.heading);
        if (mode !== 'driving' || !car) {
            return {
                location: {x:pos.x-sx*6.5,y:pos.y+3.3,z:pos.z-cz*6.5},
                focus: {x:pos.x,y:pos.y+1.5,z:pos.z},
                instant: false, fov:62
            };
        }
        const velocity = Math.abs(car.speed);
        if (lookBack) {
            return {
                location: {x:pos.x+sx*8,y:pos.y+3.4,z:pos.z+cz*8},
                focus: {x:pos.x-sx*13,y:pos.y+1.25,z:pos.z-cz*13},
                instant:true,fov:62
            };
        }
        if (cameraMode===1) {
            return {
                location: {x:pos.x+sx*0.75,y:pos.y+1.7,z:pos.z+cz*0.75},
                focus:{x:pos.x+sx*25,y:pos.y+1.4,z:pos.z+cz*25},
                instant:true,fov:65
            };
        }
        if (cameraMode===2) {
            return {
                location: {x:pos.x+sx*13+cz*19,y:pos.y+19,z:pos.z+cz*13-sx*19},
                focus: {x:pos.x+sx*3,y:pos.y+1.5,z:pos.z+cz*3},
                instant:false,fov:58
            };
        }
        const distance=10.5+Math.min(2.2,velocity*0.045);
        const lateralSlip=DriverArcadePhysics.clamp(car.lateralVelocity||0,-10,10);
        return {
            location:{
                x:pos.x-sx*distance-cz*lateralSlip*0.17,
                y:pos.y+4.0+Math.min(0.6,velocity*0.01),
                z:pos.z-cz*distance+sx*lateralSlip*0.17
            },
            focus: {x:pos.x+sx*4.7,y:pos.y+1.35,z:pos.z+cz*4.7},
            instant:false,fov:62+Math.min(9,velocity*0.17)
        };
    }
    update(camera, pos, car, mode, cameraMode, lookBack, city, dt) {
        const spec=DriverCameraRig.targetPosition(pos, car, mode, cameraMode, lookBack);
        // Enquadramento cinematográfico temporário no salto da ponte.
        // Conserva os modos de câmera escolhidos pelo jogador.
        if(mode==='driving' && cameraMode===0 && !lookBack &&
            typeof DriverChicagoEastBridge!=='undefined' &&
            DriverChicagoEastBridge.isJumpCamera(city,pos,car)){
            spec.location.y+=3.5;
            spec.fov=Math.max(spec.fov,76);
            spec.focus.y+=.7;
        }
        const occlusionMode=!spec.instant && cameraMode!==2;
        if (occlusionMode) {
            const ratio=DriverCameraRig.visibleDistance(city,
                {x:pos.x,y:pos.y+1.5,z:pos.z}, spec.location);
            if (ratio<1) {
                spec.location.x=pos.x+(spec.location.x-pos.x)*ratio;
                spec.location.z=pos.z+(spec.location.z-pos.z)*ratio;
                spec.location.y=pos.y+1.5+(spec.location.y-pos.y-1.5)*ratio;
            }
        }
        const modeKey=(mode==='driving'?1:0)*10+cameraMode+(lookBack?100:0);
        const snap=spec.instant || this.lastMode!==modeKey;
        const factor=snap?1:1-Math.exp(-(cameraMode===2?3.1:7)*Math.min(0.05,dt));
        const target=new THREE.Vector3(spec.location.x,spec.location.y,spec.location.z);
        camera.position.lerp(target,factor);
        const focus=new THREE.Vector3(spec.focus.x,spec.focus.y,spec.focus.z);
        if (!this.focus || snap) this.focus=focus.clone();
        else this.focus.lerp(focus,1-Math.exp(-9*Math.min(dt,0.05)));
        camera.lookAt(this.focus);
        const newFov=THREE.MathUtils.lerp(camera.fov,spec.fov,snap?1:1-Math.exp(-3*dt));
        if (Math.abs(newFov-camera.fov)>0.06) {
            camera.fov=newFov;
            camera.updateProjectionMatrix();
        }
        this.lastMode=modeKey;
    }
}
