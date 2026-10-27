/**
 * Faixas de pedestre e postes nas quatro cidades.
 * Instancing mantém quatro chamadas principais, independentemente do mapa.
 */
class DriverStreetFurniture {
    static hidePole(prop) {
        if(!prop || prop.type!=='pole' || prop.hidden)return false;
        const dummy=new THREE.Object3D();
        dummy.position.set(0,-1000,0);
        dummy.scale.set(0,0,0);
        dummy.updateMatrix();
        prop.poleMesh.setMatrixAt(prop.instanceIndex,dummy.matrix);
        prop.lampMesh.setMatrixAt(prop.instanceIndex,dummy.matrix);
        prop.poleMesh.instanceMatrix.needsUpdate=true;
        prop.lampMesh.instanceMatrix.needsUpdate=true;
        prop.hidden=true;
        return true;
    }
    static build(city) {
        const positions = [];
        const crosswalks = [];
        // Cruzamentos da malha base, sem colocar marcas no canal.
        for (let x=-320; x<=320; x+=80) {
            for (let z=-320; z<=320; z+=80) {
                for (const sign of [-1, 1]) {
                    for (let line=0;line<5;line++) {
                        const offset = (line - 2) * 1.6;
                        crosswalks.push({x:x+offset,z:z+sign*12,alongX:true});
                        crosswalks.push({x:x+sign*12,z:z+offset,alongX:false});
                    }
                }
                // Postes nos cantos externos sem invadir a via.
                positions.push([x-12,z-12]);
                positions.push([x+12,z+12]);
            }
        }
        const stripe = new THREE.InstancedMesh(
            new THREE.PlaneGeometry(0.85, 3.5),
            new THREE.MeshBasicMaterial({
                color: 0xe5e7eb, side: THREE.DoubleSide,
                depthWrite: false, polygonOffset:true, polygonOffsetFactor:-2
            }),crosswalks.length
        );
        const obj = new THREE.Object3D();
        crosswalks.forEach((p,i)=>{
            obj.position.set(p.x,0.081,p.z);
            obj.rotation.set(-Math.PI/2,0,p.alongX?Math.PI/2:0);
            obj.scale.set(1,1,1);
            obj.updateMatrix();
            stripe.setMatrixAt(i,obj.matrix);
        });
        stripe.instanceMatrix.needsUpdate=true;
        stripe.frustumCulled=false;

        const pole = new THREE.InstancedMesh(
            new THREE.CylinderGeometry(0.12,0.15,5.8,6),
            new THREE.MeshLambertMaterial({color:0x64748b}),positions.length
        );
        const bulb = new THREE.InstancedMesh(
            new THREE.BoxGeometry(0.85,0.35,0.85),
            new THREE.MeshBasicMaterial({
                color:city.preset.id==='vegas'?0xfacc15:0xffe4a3
            }),positions.length
        );
        positions.forEach(([x,z],i)=>{
            obj.rotation.set(0,0,0);obj.scale.set(1,1,1);
            obj.position.set(x,2.9,z);obj.updateMatrix();pole.setMatrixAt(i,obj.matrix);
            obj.position.set(x,5.85,z);obj.updateMatrix();bulb.setMatrixAt(i,obj.matrix);
        });
        pole.instanceMatrix.needsUpdate=true;
        bulb.instanceMatrix.needsUpdate=true;
        // Postes visuais instanciados continuam em apenas duas draw calls.
        // O registro individual permite derrubar somente a instância
        // atingida, sem recalcular nem esconder os demais postes.
        if(Array.isArray(city.destructibleProps))positions.forEach(([x,z],index)=>{
            city.destructibleProps.push({
                type:'pole',x,z,hit:false,shattered:false,
                instanceIndex:index,poleMesh:pole,lampMesh:bulb,
                mesh:null
            });
        });
        // Sem sombras/luzes físicas adicionais para preservar desempenho móvel.
        for (const mesh of [stripe,pole,bulb]) {
            mesh.frustumCulled=false;
            mesh.castShadow=false;
            city.cityGroup.add(mesh);
        }
    }
}
