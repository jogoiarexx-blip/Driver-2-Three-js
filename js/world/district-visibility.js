/**
 * Per-chunk conservative world-space frustum spheres for instanced buildings.
 * Three r128 uses geometry.boundingSphere (NOT per-instance matrices) for
 * InstancedMesh. Each registered district therefore owns one BoxGeometry
 * with an aggregate bounding sphere shared by FAR and NEAR base geometry.
 *
 * Bounds are deliberately oversized to include balconies, rooftop objects,
 * roof treatments and all four faces without popping during camera motion.
 */
class DriverDistrictVisibility {
    static bounds(buildings, {side=30,roof=15,below=2}={}) {
        if(!buildings?.length)return null;
        let x1=Infinity,x2=-Infinity,z1=Infinity,z2=-Infinity,y2=-Infinity;
        for(const b of buildings){
            if(![b.x,b.z,b.height].every(Number.isFinite))return null;
            x1=Math.min(x1,b.x-side);
            x2=Math.max(x2,b.x+side);
            z1=Math.min(z1,b.z-side);
            z2=Math.max(z2,b.z+side);
            y2=Math.max(y2,Math.max(0,b.height)+roof);
        }
        const centerX=(x1+x2)*.5,centerY=(y2-below)*.5;
        const centerZ=(z1+z2)*.5;
        const radius=Math.hypot(x2-x1,y2+below,z2-z1)*.5+2;
        return {x:centerX,y:centerY,z:centerZ,radius};
    }

    static makeGeometry(buildings) {
        const geo=new THREE.BoxGeometry(38,1,38);
        if(typeof THREE.Sphere==='function'&&
           typeof THREE.Vector3==='function'){
            const b=this.bounds(buildings);
            if(b)geo.boundingSphere=new THREE.Sphere(
                new THREE.Vector3(b.x,b.y,b.z),b.radius);
        }
        return geo;
    }

    static cull(mesh, buildings, extra=15) {
        if(!mesh||typeof THREE.Sphere!=='function'||
           typeof THREE.Vector3!=='function'){
            if(mesh)mesh.frustumCulled=false;
            return false;
        }
        const b=this.bounds(buildings,{side:30,roof:extra,below:2});
        if(!b){mesh.frustumCulled=false;return false;}
        // This geometry is not shared between unrelated chunks.
        mesh.geometry.boundingSphere=new THREE.Sphere(
            new THREE.Vector3(b.x,b.y,b.z),b.radius);
        mesh.frustumCulled=true;
        return true;
    }
}
