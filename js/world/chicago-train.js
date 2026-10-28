/**
 * Linha elevada de Chicago e trem da missão Train Pursuit.
 * Three.js r128, sem dependências remotas, sem física terceirizada.
 * Percurso retificado inspirado na missão original, não extraído do PS1.
 */
class DriverChicagoTrain {
    static START_Z = 168;
    static STOP_Z = -258;
    static SPEED = 7.8;
    static PLATFORM = { x:-14, z:-260, minX:-22, maxX:-6, minZ:-282, maxZ:-246, height:11.3 };

    static buildInfrastructure(city) {
        if (city.preset.id!=='chicago')return;
        const railMat=new THREE.MeshLambertMaterial({color:0x475569});
        const concrete=new THREE.MeshLambertMaterial({color:0x64748b});
        const sleeperMat=new THREE.MeshLambertMaterial({color:0x713f12});
        const deck=new THREE.Mesh(new THREE.BoxGeometry(7,0.65,565),concrete);
        deck.position.set(0,11.1,0);
        city.cityGroup.add(deck);
        for (const x of [-2.25,2.25]) {
            const rail=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.28,565),railMat);
            rail.position.set(x,11.61,0);
            city.cityGroup.add(rail);
        }
        const sleepers=new THREE.InstancedMesh(
            new THREE.BoxGeometry(6,.22,.7),sleeperMat,188);
        // O suporte antigo era uma coluna em x=0, no meio da pista,
        // logo à frente do carro. Pórticos com pernas em x±13.6
        // ficam entre a borda da via (±12) e a calçada (início ±15).
        const spans=[];
        for(let i=0;i<18;i++){
            const z=-272+i*32;
            if(z>31 && z<69)continue; // nenhum pilar dentro do canal
            spans.push(z);
        }
        const columns=new THREE.InstancedMesh(
            new THREE.BoxGeometry(.8,10.4,.8),concrete,spans.length*2);
        const beams=new THREE.InstancedMesh(
            new THREE.BoxGeometry(28,.8,1.2),railMat,spans.length);
        const dummy=new THREE.Object3D();
        for(let i=0;i<188;i++){
            dummy.position.set(0,11.50,-281+i*3);
            dummy.rotation.set(0,0,0);
            dummy.scale.set(1,1,1);
            dummy.updateMatrix();
            sleepers.setMatrixAt(i,dummy.matrix);
        }
        for(const [i,z] of spans.entries()){
            for(const [sideIndex,side] of [-1,1].entries()){
                dummy.position.set(side*13.6,5.2,z);
                dummy.rotation.set(0,0,0);
                dummy.scale.set(1,1,1);
                dummy.updateMatrix();
                columns.setMatrixAt(i*2+sideIndex,dummy.matrix);
            }
            dummy.position.set(0,10.55,z);
            dummy.updateMatrix();
            beams.setMatrixAt(i,dummy.matrix);
        }
        for(const mesh of [sleepers,columns,beams]){
            mesh.instanceMatrix.needsUpdate=true;
            mesh.frustumCulled=false;
            mesh.castShadow=false;
            city.cityGroup.add(mesh);
        }
    }

    constructor(scene,city) {
        this.scene=scene;
        this.city=city;
        this.group=new THREE.Group();
        this.group.name='chicago-elevated-train';
        const steel=new THREE.MeshLambertMaterial({color:0x64748b});
        const carriage=new THREE.MeshLambertMaterial({color:0x9ca3af});
        const accent=new THREE.MeshLambertMaterial({color:0x991b1b});
        const windowMat=new THREE.MeshBasicMaterial({color:0x38bdf8});
        const lamp=new THREE.MeshBasicMaterial({color:0xfef08a});
        const bodyGeo=new THREE.BoxGeometry(3.2,3.1,11);
        const roofGeo=new THREE.BoxGeometry(3.4,0.45,11);
        const windowsGeo=new THREE.BoxGeometry(0.07,0.95,1.7);
        const wheelsGeo=new THREE.CylinderGeometry(0.42,0.42,0.23,7);
        for(let car=0;car<3;car++){
            const carriageGroup=new THREE.Group();
            carriageGroup.position.z=car*11.9;
            const body=new THREE.Mesh(bodyGeo,car===0?accent:carriage);
            body.position.y=2.4;
            const roof=new THREE.Mesh(roofGeo,steel);
            roof.position.y=4.18;
            carriageGroup.add(body,roof);
            for(const sign of [-1,1]){
                for(const z of [-3.8,-1.3,1.4,4.0]){
                    const pane=new THREE.Mesh(windowsGeo,windowMat);
                    pane.position.set(sign*1.64,2.7,z);
                    carriageGroup.add(pane);
                }
                for(const z of [-3.5,3.5]){
                    const wheel=new THREE.Mesh(wheelsGeo,steel);
                    wheel.rotation.z=Math.PI/2;
                    wheel.position.set(sign*1.47,0.5,z);
                    carriageGroup.add(wheel);
                }
            }
            if(car===0){
                for(const x of [-1,1]){
                    const light=new THREE.Mesh(new THREE.BoxGeometry(.65,.48,.12),lamp);
                    light.position.set(x,2.4,-5.56);
                    carriageGroup.add(light);
                }
            }
            this.group.add(carriageGroup);
        }
        // Decorar somente o trem da missão, dentro do grupo móvel.
        if(typeof DriverChicagoOverhaul!=='undefined' &&
            typeof DriverSpecialStructures!=='undefined')
            DriverChicagoOverhaul.detailTrain(this);
        this.group.position.set(0,11.65,DriverChicagoTrain.START_Z);
        scene.add(this.group);
        this.reset(false);
    }

    setCity(city) {
        this.city=city;
        this.reset(false);
    }
    reset(active=false) {
        this.active=!!active && this.city?.preset?.id==='chicago';
        this.arrived=false;
        this.elapsed=0;
        this.group.position.set(0,11.65,DriverChicagoTrain.START_Z);
        this.group.visible=this.active;
    }
    update(dt) {
        if(!this.active || this.arrived) return;
        const time=Math.max(0,Math.min(0.05,Number(dt)||0));
        this.elapsed+=time;
        this.group.position.z=Math.max(DriverChicagoTrain.STOP_Z,
            this.group.position.z-DriverChicagoTrain.SPEED*time);
        if(this.group.position.z<=DriverChicagoTrain.STOP_Z+0.001){
            this.group.position.z=DriverChicagoTrain.STOP_Z;
            this.arrived=true;
        }
    }
    get position() {
        return {x:0,z:this.group.position.z,y:this.group.position.y};
    }
    static onPlatform(pos) {
        return !!pos && pos.y>=10.3 &&
            pos.x>=this.PLATFORM.minX && pos.x<=this.PLATFORM.maxX &&
            pos.z>=this.PLATFORM.minZ && pos.z<=this.PLATFORM.maxZ;
    }
    destroy() {
        if(this.group?.parent)this.group.parent.remove(this.group);
        GPUResourceUtils.disposeSubtree(this.group);
    }
}
