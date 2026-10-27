/**
 * Variações arquitetônicas por cidade. Apenas três lotes instanciados
 * para decorar todos os edifícios, mantendo baixo custo em aparelhos móveis.
 */
class UrbanDistricts {
    static random(x, z, salt=0) {
        let n = Math.imul((x|0) + salt * 1171, 73856093) ^ Math.imul(z|0, 19349663);
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    }
    static height(city, x, z) {
        const r = this.random(x,z,3);
        return city === 'chicago' ? 25 + r * 54 :
            city === 'havana' ? 12 + r * 18 :
            city === 'vegas' ? 22 + r * 42 : 16 + r * 32;
    }
    // Perfis de fachadas do jogo PS1: Wrigley/Downtown, Habana Vieja,
    // Strip e fachadas sombreadas da orla. Não altera vias nem colisores.
    static profile(id){
        const map={
            chicago:{style:'steel-piers',color:0x94a3b8,secondary:0x475569,
                front:[.75,16,.55],accent:[23,.75,1.3]},
            havana:{style:'colonial-balconies',color:0xe7d4ba,
                secondary:0x64748b,front:[10,.42,2.15],
                accent:[10,.9,.18]},
            vegas:{style:'casino-neon',color:0x38bdf8,
                secondary:0xf472b6,front:[3,13,.45],
                accent:[18,.6,2.0]},
            rio:{style:'coastal-brise',color:0xe2e8f0,
                secondary:0x0f766e,front:[20,.3,1.4],
                accent:[19,1.0,.28]}
        };
        return map[id]||map.chicago;
    }

    static addRegionalFacades(builder,buildings,parent) {
        if(!buildings.length)return;
        const id=builder.preset.id,profile=this.profile(id);
        // Só nos setores LOD próximos: 2 draw calls em instancing para
        // todos os prédios do setor, sem colocar modelos na rua.
        const make=(dims,color)=>new THREE.InstancedMesh(
            new THREE.BoxGeometry(...dims),
            new THREE.MeshLambertMaterial({color:0xffffff}),
            buildings.length);
        const front=make(profile.front,profile.color);
        const accent=make(profile.accent,profile.secondary);
        const dummy=new THREE.Object3D();
        for(const [i,b] of buildings.entries()){
            const phase=this.random(b.x,b.z,14);
            const hue1=new THREE.Color(profile.color);
            const hue2=new THREE.Color(profile.secondary);
            let frontX=b.x+12,frontY=6,frontZ=b.z+19.5;
            let accentX=b.x,accentY=8,accentZ=b.z+20;
            if(id==='chicago'){
                frontX=b.x+(phase>.5?13:-13);
                frontY=b.height*.47;
                frontZ=b.z+19.45;
                accentY=Math.min(b.height-.8,14);
            }else if(id==='havana'){
                frontX=b.x+(phase>.5?8:-8);
                frontY=6;
                frontZ=b.z+20.25;
                accentX=frontX;accentY=6.75;accentZ=b.z+21.2;
            }else if(id==='vegas'){
                frontX=b.x+(phase>.5?12:-12);
                frontY=Math.min(b.height*.5,18);
                frontZ=b.z+19.55;
                accentY=4.7;accentZ=b.z+21.0;
            }else{
                frontX=b.x;
                frontY=7+(Math.floor(phase*4)*3);
                frontZ=b.z+19.6;
                accentY=frontY+2.4;
                accentZ=b.z+19.5;
            }
            dummy.rotation.set(0,0,0);
            dummy.scale.set(1,id==='chicago'?
                Math.max(.6,b.height/36):1,1);
            dummy.position.set(frontX,frontY,frontZ);
            dummy.updateMatrix();
            front.setMatrixAt(i,dummy.matrix);
            dummy.scale.set(1,1,1);
            dummy.position.set(accentX,accentY,accentZ);
            dummy.updateMatrix();
            accent.setMatrixAt(i,dummy.matrix);
            front.setColorAt(i,hue1);
            accent.setColorAt(i,hue2);
        }
        for(const mesh of [front,accent]){
            mesh.instanceMatrix.needsUpdate=true;
            if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
            mesh.frustumCulled=false;
            mesh.userData.regionalStyle=profile.style;
            parent.add(mesh);
        }
    }
    static decorate(builder, buildings=builder.districtBuildings,
        parent=builder.cityGroup) {
        if (!buildings.length) return;
        const id = builder.preset.id;
        const palettes = {
            chicago:[0x64748b,0x334155,0x94a3b8,0x475569],
            havana:[0xfda4af,0xfb923c,0x5eead4,0xfde68a],
            vegas:[0x22d3ee,0xf472b6,0xc084fc,0xfacc15],
            rio:[0x38bdf8,0x34d399,0xfde047,0xfb7185]
        };
        const count=buildings.length;
        const roofs=new THREE.InstancedMesh(
            new THREE.BoxGeometry(38.4,0.75,38.4),
            new THREE.MeshLambertMaterial({color:0xffffff}),count);
        const signs=new THREE.InstancedMesh(
            new THREE.BoxGeometry(28,1.3,0.65),
            new THREE.MeshBasicMaterial({color:0xffffff}),count);
        const ornaments=new THREE.InstancedMesh(
            id==='chicago' ? new THREE.CylinderGeometry(2.3,2.3,2.4,8) :
                new THREE.BoxGeometry(3.3,1.4,3.3),
            new THREE.MeshLambertMaterial({color:0xffffff}),count);
        const obj=new THREE.Object3D();
        buildings.forEach((b,i)=>{
            const color=new THREE.Color(palettes[id][Math.floor(this.random(b.x,b.z,7)*4)]);
            obj.position.set(b.x,b.height+0.55,b.z);obj.scale.set(1,1,1);
            obj.rotation.set(0,0,0);obj.updateMatrix();roofs.setMatrixAt(i,obj.matrix);
            roofs.setColorAt(i,new THREE.Color(id==='havana'?0xe2e8f0:0x64748b));

            // Letreiros/cornijas nos comércios, afastados da pista.
            obj.position.set(b.x,id==='vegas'?8:4.8,b.z+19.25);
            obj.scale.set(0.8+this.random(b.x,b.z,2)*0.18,1,1);
            obj.updateMatrix();signs.setMatrixAt(i,obj.matrix);signs.setColorAt(i,color);

            // Caixas d'água, pequenos terraços e topos iluminados.
            obj.position.set(b.x+7,b.height+1.8,b.z-5);
            obj.scale.set(1,id==='vegas'?2.3:1,1);
            obj.updateMatrix();ornaments.setMatrixAt(i,obj.matrix);
            ornaments.setColorAt(i,color);
        });
        [roofs,signs,ornaments].forEach(mesh=>{
            mesh.instanceMatrix.needsUpdate=true;
            if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
            mesh.frustumCulled=false;
            parent.add(mesh);
        });
        this.addRegionalFacades(builder,buildings,parent);
    }
}
