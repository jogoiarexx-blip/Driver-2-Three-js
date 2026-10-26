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
    static decorate(builder) {
        const buildings = builder.districtBuildings;
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
            builder.cityGroup.add(mesh);
        });
    }
}
