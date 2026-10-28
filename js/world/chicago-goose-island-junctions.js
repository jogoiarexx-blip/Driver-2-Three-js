/**
 * Chicago R7 — curvas de conexão de Goose Island, escala procedural.
 *
 * Mesma malha física e rotas R4-R6. Cada entroncamento recebe uma placa
 * de asfalto com cantos arredondados e faixas de aproximação que seguem
 * o chão seco. Não é um decalque exato da malha PS1.
 *
 * Três posições: ponte sul (z160), acesso industrial (z240) e avenida
 * norte (z320). Nenhum collider ou objetivo de campanha é modificado.
 */
class DriverChicagoGooseIslandJunctions {
    static CENTERS=[
        {id:'south-west',x:-200,z:160},
        {id:'industrial',x:-200,z:240},
        {id:'north-exit',x:-200,z:320}
    ];
    static HALF=11.4;
    static CORNER_RADIUS=4.5;
    static isChicago(city){return city?.preset?.id==='chicago';}
    static perimeter(x,z){
        const h=this.HALF,r=this.CORNER_RADIUS;
        const vertices=[];
        for(const [cx,cz,start] of [
            [h-r,h-r,0],[-h+r,h-r,90],[-h+r,-h+r,180],[h-r,-h+r,270]
        ]){
            for(let i=0;i<=4;i++){
                const angle=(start+i*90/4)*Math.PI/180;
                vertices.push({x:x+cx+r*Math.cos(angle),
                    z:z+cz+r*Math.sin(angle)});
            }
        }
        return vertices;
    }
    static dryPatch(city,cx,cz){
        if(!this.isChicago(city))return false;
        const points=[{x:cx,z:cz},...this.perimeter(cx,cz)];
        return points.every(p=>!city.isWaterAt?.(p.x,p.z));
    }
    static buildOne(city,center,group){
        if(!this.dryPatch(city,center.x,center.z))return null;
        const border=this.perimeter(center.x,center.z);
        const data=[];
        for(let i=0;i<border.length;i++){
            const a=border[i],b=border[(i+1)%border.length];
            data.push(center.x,.045,center.z,
                a.x,.045,a.z,b.x,.045,b.z);
        }
        const geom=new THREE.BufferGeometry();
        geom.setAttribute('position',
            new THREE.Float32BufferAttribute(data,3));
        geom.computeVertexNormals();
        const road=new THREE.Mesh(geom,
            new THREE.MeshLambertMaterial({
                color:0x454b50,side:THREE.DoubleSide
            }));
        road.name='chicago-r7-rounded-junction-'+center.id;
        road.userData.chicagoOffGridJunction=true;
        road.userData.collidersCreated=0;
        group.add(road);

        // Centro de parada fica sobre os acessos existentes. Desenhar
        // marcas descontínuas somente em posições secas, evitando
        // falsos trajetos sobre o canal.
        const markers=[];
        const white=new THREE.MeshBasicMaterial({color:0xc3c5be});
        for(const [x,z,w,d] of [
            [center.x-8.4,center.z-7,.16,4],
            [center.x+8.4,center.z+7,.16,4],
            [center.x-7,center.z+8.4,4,.16],
            [center.x+7,center.z-8.4,4,.16]
        ]){
            if(city.isWaterAt?.(x,z))continue;
            const line=new THREE.Mesh(new THREE.BoxGeometry(w,.012,d),white);
            line.position.set(x,.076,z);
            line.name='chicago-r7-junction-lane-edge';
            group.add(line);
            markers.push(line);
        }
        return {id:center.id,at:{x:center.x,z:center.z},
            borderVertices:border.length,road,markings:markers.length};
    }
    static build(city){
        if(!this.isChicago(city))return null;
        if(city.chicagoGooseIslandJunctions)return city.chicagoGooseIslandJunctions;
        const group=new THREE.Group();
        group.name='chicago-r7-offgrid-rounded-junctions';
        group.userData.proceduralApproximation=true;
        group.userData.visualOnly=true;
        const patches=this.CENTERS.map(c=>this.buildOne(city,c,group));
        if(patches.some(p=>!p))return {
            ready:false,patches:patches.filter(Boolean),
            missing:this.CENTERS.filter((c,i)=>!patches[i]).map(c=>c.id),
            visualOnly:true
        };
        city.cityGroup.add(group);
        const result={ready:true,patches,group,
            junctionCount:patches.length,collidersAdded:0,
            visualOnly:true,roadCoordinatesCertified:false};
        city.chicagoGooseIslandJunctions=result;
        return result;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoGooseIslandJunctions;
