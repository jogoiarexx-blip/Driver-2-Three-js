/**
 * Etapa geográfica 1 — Costa do Lago Michigan inspirada no mapa PS1.
 * A reconstrução aqui é PROCEDURAL e APROXIMADA; não é polígono homologado
 * da ROM. Mantém a malha viária/colisores do Undercover já funcional.
 * A água só começa a leste da última avenida x=320 (margem >=27 unidades).
 */
class DriverChicagoPS1Coastline {
    static EAST_ROAD_LIMIT=320;
    // z cresce para o norte, x cresce para leste; x da margem na escala
    // procedural. O contorno muda ao longo da costa e abre no Navy Pier.
    static SHORE=[
        {z:-420,x:365},{z:-360,x:359},{z:-280,x:352},
        {z:-200,x:351},{z:-120,x:347},{z:-72,x:349},
        {z:-48,x:350},{z:-20,x:355},{z:15,x:366},
        {z:68,x:361},{z:130,x:356},{z:200,x:354},
        {z:280,x:362},{z:360,x:373},{z:420,x:381}
    ];
    static isChicago(city) {return city?.preset?.id==='chicago';}
    static shoreX(z) {
        if(!Number.isFinite(z))return Infinity;
        const points=this.SHORE;
        if(z<=points[0].z)return points[0].x;
        for(let i=1;i<points.length;i++) {
            const b=points[i],a=points[i-1];
            if(z<=b.z) {
                const t=(z-a.z)/(b.z-a.z);
                return a.x+(b.x-a.x)*t;
            }
        }
        return points[points.length-1].x;
    }
    static pier(x,z) {
        // Navy Pier está no mundo anterior: via de acesso e deck do píer
        // NÃO podem ser convertidos em água física por esta atualização.
        return x>=326&&x<=412&&Math.abs(z+40)<=8.25;
    }
    static waterAt(x,z) {
        return Number.isFinite(x)&&Number.isFinite(z) &&
            x>=this.shoreX(z) && !this.pier(x,z);
    }
    static shorePoints(city){
        const points=this.SHORE.map(p=>({...p}));
        const min=city?.worldTerrain?.minZ??points[0].z,max=city?.worldTerrain?.maxZ??points.at(-1).z;
        if(min<points[0].z)points.unshift({z:min,x:this.shoreX(min)});
        if(max>points.at(-1).z)points.push({z:max,x:this.shoreX(max)});
        return points;
    }
    static createWater(city) {
        const vertices=[],uv=[];
        const points=this.shorePoints(city);
        // Extender o lago visual para o horizonte, sem física fora do mapa.
        for(let i=0;i<points.length-1;i++){
            const a=points[i],b=points[i+1],far=560;
            const quad=[
                [a.x,a.z,0,0],[far,a.z,1,0],
                [b.x,b.z,0,1],[far,b.z,1,1]
            ];
            for(const id of [0,1,2,1,3,2]){
                const [x,z,u,v]=quad[id];
                vertices.push(x,.075,z);uv.push(u,v);
            }
        }
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
        geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
        geometry.computeVertexNormals();
        const material=new THREE.MeshBasicMaterial({
            color:0x1c6479,side:THREE.DoubleSide,
            transparent:true,opacity:.97,depthWrite:true
        });
        const mesh=new THREE.Mesh(geometry,material);
        mesh.name='chicago-ps1-lake-michigan';
        mesh.userData.chicagoPS1Coastline=true;
        mesh.userData.collidersCreated=0;
        return mesh;
    }
    static build(city) {
        if(!this.isChicago(city))return null;
        if(city.chicagoPS1Coastline)return city.chicagoPS1Coastline;
        const mesh=this.createWater(city);
        city.cityGroup.add(mesh);
        const trim=[];
        const shoreline=this.shorePoints(city);
        for(let i=0;i<shoreline.length-1;i++){
            const a=shoreline[i],b=shoreline[i+1];
            const z=(a.z+b.z)*.5;
            if(z>=-68&&z<=-16)continue; // entrada de Navy Pier
            const x=(a.x+b.x)*.5;
            const length=b.z-a.z;
            trim.push([x-.5,.20,z,1.3,.24,length,0xb5b2a5,false]);
            trim.push([x-2,.08,z,2.2,.13,length,0x718c8c,false]);
        }
        // Um batch de linhas leves; nenhuma barreira física criada.
        if(typeof DriverSpecialStructures!=='undefined')
            DriverSpecialStructures.pack(
                city.cityGroup,trim,'chicago-ps1-lakeshore-trim');
        const result={
            mesh,shoreline:shoreline.length,
            westernRoadLimit:this.EAST_ROAD_LIMIT,
            waterPhysics:true,piersPreserved:true,
            addedColliders:0,mode:'procedural-phase1'
        };
        city.chicagoPS1Coastline=result;
        return result;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoPS1Coastline;
