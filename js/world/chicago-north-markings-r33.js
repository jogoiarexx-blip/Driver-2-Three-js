/** Adapted painted center dashes on already constructed northern roads. */
class DriverChicagoNorthMarkingsR33 {
 static dashes(points){
  const lengths=[];let total=0;
  for(let i=1;i<points.length;i++){let a=points[i-1],b=points[i],len=Math.hypot(b.x-a.x,b.z-a.z);lengths.push({a,b,len,start:total});total+=len;}
  const out=[];
  for(let start=5;start<total-5;start+=8){
   const end=Math.min(start+3,total-5);
   for(const seg of lengths){
    if(!seg.len)continue;const lo=Math.max(start,seg.start),hi=Math.min(end,seg.start+seg.len);if(hi<=lo)continue;
    const point=d=>({x:seg.a.x+(seg.b.x-seg.a.x)*d/seg.len,z:seg.a.z+(seg.b.z-seg.a.z)*d/seg.len});
    out.push({a:point(lo-seg.start),b:point(hi-seg.start)});
   }
  }
  return out;
 }
 static build(city,paths){
  if(city?.preset?.id!=='chicago')return null;
  const vertices=[];
  for(const path of paths)for(const d of this.dashes(path.points)){
   const dx=d.b.x-d.a.x,dz=d.b.z-d.a.z,len=Math.hypot(dx,dz);if(!len)continue;
   const nx=-dz/len*.10,nz=dx/len*.10;
   for(const p of [[d.a.x+nx,d.a.z+nz],[d.a.x-nx,d.a.z-nz],[d.b.x+nx,d.b.z+nz],[d.a.x-nx,d.a.z-nz],[d.b.x-nx,d.b.z-nz],[d.b.x+nx,d.b.z+nz]])vertices.push(p[0],.052,p[1]);
  }
  if(!vertices.length)return null;
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:0xdcc887,side:THREE.DoubleSide}));mesh.name='chicago-r33-north-road-markings';city.cityGroup.add(mesh);return mesh;
 }
}
if(typeof module!=='undefined'&&module.exports)module.exports=DriverChicagoNorthMarkingsR33;
