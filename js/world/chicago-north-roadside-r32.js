/** R32: adapted roadside buildings on the built northern corridor. */
class DriverChicagoNorthRoadsideR32 {
 static pointSegment(p,a,b){
  const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
  const t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/den)):0;
  return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);
 }
 static plan(city,paths){
  if(city?.preset?.id!=='chicago')return [];
  const lots=[],bounds=city.worldBounds||{minX:-560,maxX:432,minZ:-432,maxZ:1392};
  for(const path of paths){
   let remaining=25;
   for(let i=1;i<path.points.length;i++){
    const a=path.points[i-1],b=path.points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
    if(len<1e-8)continue;
    while(remaining<=len){
     const t=remaining/len,cx=a.x+dx*t,cz=a.z+dz*t;
     for(const side of [-1,1]){
      const x=cx-side*dz/len*17,z=cz+side*dx/len*17,half=5.5;
      if(z-half<440||x-half<bounds.minX||x+half>bounds.maxX||z-half<bounds.minZ||z+half>bounds.maxZ)continue;
      const probes=[[x,z],[x-half,z-half],[x-half,z+half],[x+half,z-half],[x+half,z+half]];
      if((city.buildingBoxes||[]).some(b=>x+half>b.minX&&x-half<b.maxX&&z+half>b.minZ&&z-half<b.maxZ))continue;
      if(probes.some(([px,pz])=>city.isPointBlocked(px,pz,1,0)))continue;
      let wet=false;for(let ix=0;ix<=11&&!wet;ix++)for(let iz=0;iz<=11;iz++)if(city.isWaterAt(x-half+ix,z-half+iz)){wet=true;break;}
      if(wet)continue;
      // Half diagonal + 4m road half-width + 1m clearance.
      if(paths.some(p=>p.points.slice(1).some((q,j)=>this.pointSegment({x,z},p.points[j],q)<Math.SQRT2*half+(p.width||8)/2+1)))continue;
      if(lots.some(l=>Math.abs(l.x-x)<12&&Math.abs(l.z-z)<12))continue;
      lots.push({x,z,width:11,depth:11,height:8+(lots.length%4)*3,baseY:0,
       palette:lots.length%3,planned:true,kind:'residential',district:'wrigleyville',adaptedR32:true});
     }
     remaining+=28;
    }
    remaining-=len;
   }
  }
  return lots;
 }
 static build(city,paths){
  if(city?.preset?.id!=='chicago')return [];
  const lots=this.plan(city,paths);
  for(const lot of lots){
   city.districtBuildings.push(lot);
   const ix=Math.floor((lot.x+320)/160),iz=Math.floor((lot.z+360)/160),key=ix+':'+iz;
   if(!city.districtChunks.has(key))city.districtChunks.set(key,{id:key,x:-240+ix*160,z:-320+iz*160,buildings:[]});
   city.districtChunks.get(key).buildings.push(lot);
   city.buildingBoxes.push({minX:lot.x-lot.width/2,maxX:lot.x+lot.width/2,minZ:lot.z-lot.depth/2,maxZ:lot.z+lot.depth/2,adaptedR32:true});
  }
  city.chicagoNorthRoadsideR32=lots;return lots;
 }
}
if(typeof module!=='undefined'&&module.exports)module.exports=DriverChicagoNorthRoadsideR32;
