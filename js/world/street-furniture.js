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
                // Travessia completa: 10 barras ao longo dos 22m de
                // pista. A versão anterior tinha apenas cinco barras no
                // meio da rua, parecendo um risco branco desconectado.
                // Alternar cruzamentos com zebra: evita um tabuleiro
                // branco repetido a cada 80m, como nas capturas antigas.
                if(((x+z)/80)%2===0)for(const sign of [-1,1]) {
                    for(let line=0;line<10;line++) {
                        const offset=(line-4.5)*2.12;
                        const crossZ=z+sign*16.5;
                        // Nunca pintar sobre o canal (z=34..66).
                        if(!(crossZ>31&&crossZ<69))
                            crosswalks.push({x:x+offset,z:crossZ,
                                alongX:true});
                        if(!(z>31&&z<69))
                            crosswalks.push({x:x+sign*16.5,
                                z:z+offset,alongX:false});
                    }
                }
                // Postes nos cantos externos sem invadir a via.
                // Calçada externa: 16m do eixo (12m de pista e 4m
                // de afastamento). Não posicionar postes no canal.
                const south=z-16;
                const north=z+16;
                positions.push([x-16,
                    south>31&&south<69?north:south]);
                positions.push([x+16,
                    north>31&&north<69?south:north]);
            }
        }
        const stripe = new THREE.InstancedMesh(
            new THREE.PlaneGeometry(.95,2.65),
            new THREE.MeshBasicMaterial({
                color: 0xd6d5c9, side: THREE.DoubleSide,
                transparent:true,opacity:.76,
                depthWrite: false, polygonOffset:true, polygonOffsetFactor:-2
            }),crosswalks.length
        );
        const obj = new THREE.Object3D();
        // Plano em XZ; rotacionar ao redor de Y para cruzamentos leste/oeste.
        if(stripe.geometry && typeof stripe.geometry.rotateX==='function')
            stripe.geometry.rotateX(-Math.PI/2);
        crosswalks.forEach((p,i)=>{
            obj.position.set(p.x,.081,p.z);
            obj.rotation.set(0,p.alongX?0:Math.PI/2,0);
            obj.scale.set(1,1,1);
            obj.updateMatrix();
            stripe.setMatrixAt(i,obj.matrix);
        });
        stripe.instanceMatrix.needsUpdate=true;
        stripe.frustumCulled=false;
        stripe.name='road-crosswalk-zebra';

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

        // Placas regionais abaixo das luminárias, espaçadas para não
        // poluir visualmente o mapa. Sem colisões ou luzes dinâmicas.
        const signPalette={
            chicago:[0x1e3a5f,0xe2e8f0],
            havana:[0xa16207,0xffedd5],
            vegas:[0x581c87,0x22d3ee],
            rio:[0x0f766e,0xfef08a]
        }[city.preset.id]||[0x1e3a5f,0xe2e8f0];
        const selected=positions.filter((_,i)=>i%4===0);
        if(selected.length){
            const board=new THREE.InstancedMesh(
                new THREE.BoxGeometry(2.15,.65,.17),
                new THREE.MeshLambertMaterial({color:signPalette[0]}),
                selected.length
            );
            const stripe=new THREE.InstancedMesh(
                new THREE.BoxGeometry(1.83,.085,.2),
                new THREE.MeshBasicMaterial({color:signPalette[1]}),
                selected.length
            );
            selected.forEach(([x,z],i)=>{
                obj.rotation.set(0,0,0);obj.scale.set(1,1,1);
                obj.position.set(x+1.05,4.82,z);
                obj.updateMatrix();board.setMatrixAt(i,obj.matrix);
                obj.position.set(x+1.05,4.57,z+.04);
                obj.updateMatrix();stripe.setMatrixAt(i,obj.matrix);
            });
            for(const mesh of [board,stripe]){
                mesh.instanceMatrix.needsUpdate=true;
                mesh.frustumCulled=false;
                mesh.castShadow=false;
                mesh.name='street-signs-'+city.preset.id;
                city.cityGroup.add(mesh);
            }
        }

        // Sem sombras/luzes físicas adicionais para preservar desempenho móvel.
        for (const mesh of [stripe,pole,bulb]) {
            mesh.frustumCulled=false;
            mesh.castShadow=false;
            city.cityGroup.add(mesh);
        }
    }
}
