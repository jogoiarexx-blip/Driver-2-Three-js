/** R13: orla procedural do Undercover, inspirada na organização do mapa PS1.
 * Coordenadas adaptadas; não representa traçado viário homologado da ROM.
 * Reserva quarteirões antes da construção, sem apagar colisores após o build.
 */
class DriverChicagoUndercoverLakefront {
    static isCarvedBlock(x,z){return x===360&&[120,200,280].includes(z);}
    static isParkBlock(x,z){return x===280&&[120,200,280].includes(z);}
    static axisX(z){
        const coast=typeof DriverChicagoPS1Coastline!=='undefined'?
            DriverChicagoPS1Coastline:this.coast;
        return coast.shoreX(z)-17;
    }
    static links(){return [80,160,240,320].map(z=>({
        from:{x:320,z},to:{x:this.axisX(z),z}
    }));}
    static build(city){
        if(city?.preset?.id!=='chicago')return null;
        if(city.chicagoUndercoverLakefront)return city.chicagoUndercoverLakefront;
        const vertices=[],paint=[],half=6.3;
        const quad=(x0,z0,x1,z1,x2,z2,x3,z3,y)=>{
            for(const p of [[x0,z0],[x1,z1],[x2,z2],[x1,z1],[x3,z3],[x2,z2]])
                vertices.push(p[0],y,p[1]);
        };
        for(let z=80;z<320;z+=4){
            const a=this.axisX(z),b=this.axisX(z+4);
            quad(a-half,z,a+half,z,b-half,z+4,b+half,z+4,.12);
            if(z%12===0)paint.push([a,.135,z+1,.16,.018,2,0xd9ca8b,false]);
        }
        for(const link of this.links()){
            const {from:a,to:b}=link;
            quad(a.x-2,a.z-half,b.x+half,b.z-half,
                a.x-2,a.z+half,b.x+half,b.z+half,.121);
        }
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
        geometry.computeVertexNormals();
        const road=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({
            color:0x42494c,side:THREE.DoubleSide}));
        road.name='chicago-undercover-r13-curved-lakeshore-road';
        city.cityGroup.add(road);
        // Parks keep their existing perimeter streets. Eastern plots become a
        // grass verge with paths instead of square high-rise blocks over water.
        const parts=[...paint];
        for(const z of [120,200,280]){
            const x=this.axisX(z);
            parts.push([329,.045,z,8,.07,54,0x52764b,false]);
            parts.push([x+10,.055,z,3,.08,54,0xa7a692,false]);
        }
        if(typeof DriverSpecialStructures!=='undefined')
            DriverSpecialStructures.pack(city.cityGroup,parts,'chicago-r13-lakeshore-verges');
        const result={road,links:this.links(),length:240,roadWidth:half*2,
            parkBlocks:3,removedOuterBlocks:3,originalRoadsCertified:false,
            mode:'undercover-procedural-lakefront-r13'};
        city.chicagoUndercoverLakefront=result;
        return result;
    }
}
if(typeof module!=='undefined'&&module.exports){
    DriverChicagoUndercoverLakefront.coast=require('./chicago-ps1-coastline.js');
    module.exports=DriverChicagoUndercoverLakefront;
}
