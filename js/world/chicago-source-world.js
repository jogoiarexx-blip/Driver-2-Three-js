/** R20 reserves a rectangular world for the complete R15-aligned footprint.
 * Newly available land is a foundation for reconstruction, not a completed map.
 */
class DriverChicagoSourceWorld {
    static get source(){return typeof DriverChicagoSourceWorldR20!=='undefined'?DriverChicagoSourceWorldR20:this.sourceData;}
    static bounds(id){return id==='chicago'?{...this.source.playBounds}:{minX:-410,maxX:410,minZ:-410,maxZ:410};}
    static terrain(id){return id==='chicago'?{...this.source.groundBounds}:{minX:-420,maxX:420,minZ:-420,maxZ:420};}
    static apply(city){
        city.worldBounds=this.bounds(city.preset?.id);city.worldTerrain=this.terrain(city.preset?.id);
        city.worldLimit=Math.max(...Object.values(city.worldBounds).map(Math.abs));
    }
    static grassRects(){
        const b=this.terrain('chicago');
        return [
            {x0:b.minX,x1:b.maxX,z0:420,z1:b.maxZ},
            {x0:b.minX,x1:b.maxX,z0:b.minZ,z1:-420},
            {x0:b.minX,x1:-420,z0:-420,z1:420},
            {x0:420,x1:b.maxX,z0:-420,z1:420}
        ].filter(r=>r.x1>r.x0&&r.z1>r.z0);
    }
    static buildGrass(city){
        if(city?.preset?.id!=='chicago'||city.chicagoSourceGround)return null;
        const positions=[];
        for(const r of this.grassRects())for(const [x,z] of [[r.x0,r.z0],[r.x1,r.z0],[r.x0,r.z1],[r.x1,r.z0],[r.x1,r.z1],[r.x0,r.z1]])positions.push(x,.001,z);
        const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();
        const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:0x526848,side:THREE.DoubleSide}));
        mesh.name='chicago-r20-expanded-ground';mesh.userData.unbuiltSourceFoundation=true;
        city.cityGroup.add(mesh);city.chicagoSourceGround=mesh;return mesh;
    }
}
if(typeof module!=='undefined'&&module.exports){DriverChicagoSourceWorld.sourceData=require('../../chicago/reference-world-r20.json');module.exports=DriverChicagoSourceWorld;}
