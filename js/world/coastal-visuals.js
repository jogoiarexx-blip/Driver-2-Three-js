/**
 * Margens leves por cidade; nenhum colisor decorativo novo.
 * Espuma e vegetação usam instancing e geometrias comuns.
 * O espelho d'água do gameplay continua com as mesmas dimensões.
 */
class DriverCoastalVisuals {
    static style(id) {
        return ({
            chicago:{kind:'industrial',foam:0x9dc2d1,shore:0x64748b,
                leaf:0x64748b,trunk:0x475569},
            havana:{kind:'caribbean',foam:0xd5fbff,shore:0xeac18a,
                leaf:0x3f9d5c,trunk:0x926b42},
            vegas:{kind:'desert',foam:0x9684be,shore:0xc4a46e,
                leaf:0x58944e,trunk:0x477047},
            rio:{kind:'tropical',foam:0xe0ffff,shore:0xf1d6a1,
                leaf:0x15803d,trunk:0x825837}
        })[id]||this.style('chicago');
    }
    static instanced(city,geometry,material,positions) {
        if(!positions.length)return null;
        const mesh=new THREE.InstancedMesh(geometry,material,positions.length);
        const dummy=new THREE.Object3D();
        for(const [i,p] of positions.entries()){
            dummy.position.set(p.x,p.y,p.z);
            dummy.rotation.set(p.rx||0,p.ry||0,p.rz||0);
            dummy.scale.set(p.sx||1,p.sy||1,p.sz||1);
            dummy.updateMatrix();
            mesh.setMatrixAt(i,dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate=true;
        mesh.frustumCulled=false;
        mesh.castShadow=false;
        city.cityGroup.add(mesh);
        return mesh;
    }
    static build(city) {
        const style=this.style(city.preset.id);
        const waterFoam=new THREE.MeshBasicMaterial({
            color:style.foam,transparent:true,opacity:.31,
            depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,
            side:THREE.DoubleSide
        });
        const foam=[];
        for(let x=-390;x<=390;x+=39){
            if(Math.abs(x)<26)continue;
            for(const z of [34.65,65.35])
                foam.push({x,y:.088,z});
        }
        const foamGeometry=new THREE.PlaneGeometry(37,.76);
        foamGeometry.rotateX(-Math.PI/2);
        const foamMesh=this.instanced(city,foamGeometry,waterFoam,foam);
        // Praias pequenas e canteiros somente nas laterais que não
        // interceptam vias: x entre as avenidas em múltiplos de 80.
        const banks=[],plants=[];
        for(let x=-280;x<=280;x+=80){
            banks.push({x,y:.09,z:31.6});
            plants.push({x:x+((x/80)%3)*1.5,y:2.55,z:25.0});
        }
        const bankMaterial=new THREE.MeshBasicMaterial({
            color:style.shore,side:THREE.DoubleSide,
            depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2
        });
        const bankGeo=new THREE.PlaneGeometry(36,2.9);
        bankGeo.rotateX(-Math.PI/2);
        const shoreMesh=this.instanced(city,bankGeo,bankMaterial,banks);
        let trunkGeo,crownGeo;
        if(style.kind==='industrial'){
            // Bóias/defensas de cais em Chicago.
            trunkGeo=new THREE.CylinderGeometry(.46,.49,1.4,6);
            crownGeo=new THREE.CylinderGeometry(.56,.56,.2,6);
            plants.forEach(p=>p.y=.72);
        }else if(style.kind==='desert'){
            trunkGeo=new THREE.CylinderGeometry(.44,.55,4.8,7);
            crownGeo=new THREE.BoxGeometry(2.0,.65,.7);
        }else{
            trunkGeo=new THREE.CylinderGeometry(.28,.52,5.3,7);
            crownGeo=new THREE.ConeGeometry(3.0,2.35,8);
        }
        const trunks=this.instanced(city,trunkGeo,
            new THREE.MeshLambertMaterial({color:style.trunk}),plants);
        const crowns=this.instanced(city,crownGeo,
            new THREE.MeshLambertMaterial({color:style.leaf}),
            plants.map(p=>({...p,y:style.kind==='industrial'?1.5:
                style.kind==='desert'?4.5:5.6})));
        // A vegetação distante tem silhuetas econômicas (dois lotes)
        // e só substitui os detalhes das instâncias que estão longe.
        const farTrunks=this.instanced(city,
            new THREE.CylinderGeometry(.3,.4,2.7,4),
            new THREE.MeshLambertMaterial({color:style.trunk}),plants);
        const farCrowns=this.instanced(city,
            style.kind==='desert'?
                new THREE.BoxGeometry(1.6,.52,.45):
                new THREE.ConeGeometry(2.25,2.5,4),
            new THREE.MeshLambertMaterial({color:style.leaf}),
            plants.map(p=>({...p,y:style.kind==='industrial'?
                1.35:style.kind==='desert'?3.8:4.3})));
        farTrunks.visible=false;
        farCrowns.visible=false;
        city.waterFoamMaterial=waterFoam;
        city.waterVisualClock=0;
        city.coastVisuals={foamMesh,shoreMesh,trunks,crowns,
            farTrunks,farCrowns,plants,
            levels:plants.map(()=>'near'),
            lodClock:0,lodUpdates:0,lodNear:plants.length,
            style:style.kind,foamCount:foam.length,plantCount:plants.length};
        return city.coastVisuals;
    }
    static updateLOD(city,focus,force=false){
        const coast=city.coastVisuals;
        if(!coast?.farTrunks || !Number.isFinite(focus?.x) ||
            !Number.isFinite(focus?.z))return 0;
        const nearChanged=[],farChanged=[];
        for(let i=0;i<coast.plants.length;i++){
            const pos=coast.plants[i];
            const distance=Math.hypot(pos.x-focus.x,pos.z-focus.z);
            const current=coast.levels[i];
            // Histerese: permanecer próximo até 220m, retornar de
            // longe somente em <=145m. Sem piscadas na fronteira.
            const next=current==='near'?
                (distance>220?'far':'near'):
                (distance<145?'near':'far');
            if(next===current&&!force)continue;
            coast.levels[i]=next;
            (next==='near'?nearChanged:farChanged).push(i);
            this.placeLODInstance(coast.trunks,i,pos,next==='near',pos.y);
            this.placeLODInstance(coast.crowns,i,pos,next==='near',
                coast.style==='industrial'?1.5:
                coast.style==='desert'?4.5:5.6);
            this.placeLODInstance(coast.farTrunks,i,pos,next==='far',pos.y);
            this.placeLODInstance(coast.farCrowns,i,pos,next==='far',
                coast.style==='industrial'?1.35:
                coast.style==='desert'?3.8:4.3);
        }
        coast.lodNear=coast.levels.filter(x=>x==='near').length;
        coast.trunks.visible=coast.crowns.visible=coast.lodNear>0;
        coast.farTrunks.visible=coast.farCrowns.visible=
            coast.lodNear<coast.plants.length;
        const changed=nearChanged.length+farChanged.length;
        if(changed)coast.lodUpdates++;
        return changed;
    }
    static placeLODInstance(mesh,index,pos,show,height){
        const dummy=new THREE.Object3D();
        dummy.position.set(pos.x,height,pos.z);
        dummy.scale.set(show?1:0,show?1:0,show?1:0);
        dummy.updateMatrix();
        mesh.setMatrixAt(index,dummy.matrix);
        mesh.instanceMatrix.needsUpdate=true;
    }
    static update(city,dt,focus=null){
        if(!city.waterFoamMaterial)return;
        city.waterVisualClock=(city.waterVisualClock||0)+
            Math.min(.08,Math.max(0,dt));
        city.waterFoamMaterial.opacity=.27+
            Math.sin(city.waterVisualClock*1.2)*.055;
        const coast=city.coastVisuals;
        if(!coast)return;
        coast.lodClock+=Math.max(0,Math.min(dt,.15));
        if(coast.lodClock>=.38 && Number.isFinite(focus?.x) &&
            Number.isFinite(focus?.z)){
            coast.lodClock=0;
            this.updateLOD(city,focus);
        }
    }
}
