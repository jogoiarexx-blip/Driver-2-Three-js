'use strict';
// Liang–Barsky: a segment touching the boundary belongs to both adjacent
// sectors. This records geometric intersection, never road certification.
function segmentIntersects(a,b,box){
 let lo=0,hi=1;const dx=b[0]-a[0],dz=b[1]-a[1];
 for(const [p,q] of [[-dx,a[0]-box.minX],[dx,box.maxX-a[0]],[-dz,a[1]-box.minZ],[dz,box.maxZ-a[1]]]){
  if(p===0){if(q<0)return false;continue;}
  const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
  if(lo>hi)return false;
 }
 return true;
}
function polylineIntersects(points,box){
 for(let i=1;i<points.length;i++)if(segmentIntersects(points[i-1],points[i],box))return true;
 return false;
}
module.exports={segmentIntersects,polylineIntersects};
