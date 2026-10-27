/**
 * Rig de rodas e diagnóstico do chassi GLB.
 *
 * Nunca inventa quatro rodas por cima de uma malha GLB unificada:
 * se elas não são objetos separados, somente mede os pontos de contato.
 * GLBs futuros com rodas individuais recebem pivôs de giro/esterço.
 * A física e os controles permanecem independentes do visual.
 */
class DriverVehicleWheelRig {
    static anchors(vehicle) {
        // Calibração manual para GLBs de anatomia diferente, sem
        // sacrificar a detecção automática de futuras malhas separadas.
        const manual=vehicle?.wheelRigConfig?.anchors;
        if(Array.isArray(manual)&&manual.length===4 &&
            manual.every(p=>p && [p.x,p.y,p.z].every(Number.isFinite) &&
                Math.abs(p.x)<3 && p.y>=0 && p.y<3 &&
                Math.abs(p.z)<7))
            return manual.map((p,i)=>({
                x:p.x,y:p.y,z:p.z,front:i<2
            }));
        const dims=DriverVehicleCollisions.dimensions(vehicle);
        const halfTrack=Math.min(1.18,dims.width*.47);
        const halfBase=dims.length*.31;
        return [
            {x:-halfTrack,y:.44,z:halfBase,front:true},
            {x:halfTrack,y:.44,z:halfBase,front:true},
            {x:-halfTrack,y:.44,z:-halfBase,front:false},
            {x:halfTrack,y:.44,z:-halfBase,front:false}
        ];
    }

    static namedWheels(model) {
        const found=[];
        model.traverse(node=>{
            if(!node.isMesh)return;
            // Não confundir "wheelhouse" (parte da lataria) com pneu.
            const name=(node.name||'').toLowerCase();
            if(/wheelhouse|wheel_arch|fender|guardabarro/.test(name))return;
            if(/wheel|tire|tyre|pneu|roda|llanta/.test(name))
                found.push(node);
        });
        return found.length===4?found:[];
    }

    static mount(vehicle,model) {
        const anchors=this.anchors(vehicle);
        const rig={anchors,pivots:[],independent:false,
            source:'mesh-unificada',wheelRadius:.44};
        const wheels=this.namedWheels(model);
        if(wheels.length===4){
            vehicle.chassisTilt.updateMatrixWorld(true);
            const ordered=[];
            for(const mesh of wheels){
                const worldCenter=new THREE.Box3().setFromObject(mesh)
                    .getCenter(new THREE.Vector3());
                const localCenter=vehicle.chassisTilt.worldToLocal(worldCenter);
                const index=(localCenter.z>=0?0:2)+(localCenter.x>=0?1:0);
                if(ordered[index])return rig;
                ordered[index]={mesh,center:localCenter,index};
            }
            for(const part of ordered){
                if(!part)return rig;
            }
            // Preserva a transformação mundial ao mover as quatro
            // geometrias originais, sem duplicá-las.
            for(const item of ordered){
                const steer=new THREE.Group(),roll=new THREE.Group();
                steer.position.copy(item.center);
                vehicle.chassisTilt.add(steer);
                steer.add(roll);
                roll.attach(item.mesh);
                rig.pivots.push({steer,roll,front:item.index<2});
            }
            rig.independent=true;
            rig.source='rodas-independentes';
        }
        return rig;
    }

    static update(vehicle) {
        const rig=vehicle.wheelRig;
        if(!rig?.independent)return;
        for(const pivot of rig.pivots){
            if(pivot.front)pivot.steer.rotation.y=vehicle.steerAngle||0;
            pivot.roll.rotation.x=vehicle.wheelSpin||0;
        }
    }

    static setDebug(vehicle,visible) {
        if(!vehicle)return;
        if(!visible) {
            if(vehicle.wheelDebugGroup)vehicle.wheelDebugGroup.visible=false;
            return;
        }
        if(!vehicle.wheelDebugGroup){
            const group=new THREE.Group();
            group.name='driver2-vehicle-physics-diagnostics';
            const dims=DriverVehicleCollisions.dimensions(vehicle);
            const shape=new THREE.EdgesGeometry(
                new THREE.BoxGeometry(dims.width,dims.height,dims.length));
            const lines=new THREE.LineSegments(shape,
                new THREE.LineBasicMaterial({color:0xfacc15,depthTest:false}));
            lines.position.y=dims.height*.5;
            group.add(lines);
            // O eixo azul é frente física (+Z); vermelho é +X.
            const axis=new THREE.AxesHelper(3.0);
            axis.position.y=1;
            group.add(axis);
            const front=new THREE.Mesh(
                new THREE.ConeGeometry(.3,.7,5),
                new THREE.MeshBasicMaterial({color:0x22c55e,depthTest:false}));
            front.rotation.x=Math.PI/2;
            front.position.set(0,1,dims.length*.5+.55);
            group.add(front);
            const markers=new THREE.SphereGeometry(.19,8,6);
            const markerMat=new THREE.MeshBasicMaterial({
                color:0x38bdf8,depthTest:false
            });
            for(const anchor of this.anchors(vehicle)){
                const marker=new THREE.Mesh(markers,markerMat);
                marker.position.set(anchor.x,anchor.y,anchor.z);
                group.add(marker);
            }
            vehicle.root.add(group);
            vehicle.wheelDebugGroup=group;
        }
        vehicle.wheelDebugGroup.visible=true;
    }
}
