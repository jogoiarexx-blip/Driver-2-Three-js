#!/usr/bin/env node
'use strict';
/**
 * R74 — classify the apparent R73 -0.1 OBJ seam by source triangle, UV,
 * grade and R24 material coverage. Pure offline diagnosis; no game imports.
 * The "all" mesh also contains walls/props and is NEVER driveable evidence.
 */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),
 crypto=require('node:crypto'),assert=require('node:assert/strict');
const {glbAccessors}=require('./chicago-r26-grade-audit.cjs');
const Probe=require('./chicago-r73-triangle-width.cjs');
const R24=require('../js/world/chicago-road-evidence-r24.js');
const ROOT=path.resolve(__dirname,'..');
const UV_PAVING=[[65,191,128,254],[2,88,65,152]]; // R26 audit contract
const OFFSETS=[-.4,-.3,-.2,-.15,-.125,-.1,-.075,-.05,0,.05,.1,.2,.3,.4];
const EXPECTED_TILES={
 '01_02':'5de1b285ed8e74a3e024530fe474c0f4ad55e88ef26757209b644ef5e8f733c4',
 '01_03':'985165a16cfb3b57ac206d096d8b067e3d69120a5e5994fb48865974b6160315'
};
function withinUV(uvs){
 const lo=[Math.min(...uvs.map(p=>p[0])),Math.min(...uvs.map(p=>p[1]))],
       hi=[Math.max(...uvs.map(p=>p[0])),Math.max(...uvs.map(p=>p[1]))];
 return UV_PAVING.some(([x0,y0,x1,y1])=>
  lo[0]>=x0-1e-4&&lo[1]>=y0-1e-4&&
  hi[0]<=x1+1e-4&&hi[1]<=y1+1e-4);
}
function extract(accessors,rect){
 const {pos,uv,indices}=accessors;
 const sets={all:[],grade:[],uv:[],paving:[]};
 let inRect=0,nonFinite=0,failedGrade=0,failedUV=0;
 for(let i=0;i<indices.count;i+=3){
  const ids=[indices.get(i),indices.get(i+1),indices.get(i+2)];
  const tri=ids.map(j=>[pos.get(j,0),pos.get(j,1),pos.get(j,2)]);
  if(!tri.every(p=>p.every(Number.isFinite))){nonFinite++;continue}
  if(Math.max(...tri.map(p=>p[0]))<rect.minX||
     Math.min(...tri.map(p=>p[0]))>rect.maxX||
     Math.max(...tri.map(p=>p[2]))<rect.minZ||
     Math.min(...tri.map(p=>p[2]))>rect.maxZ)continue;
  inRect++;
  const ys=tri.map(p=>p[1]);
  const grade=Math.max(...ys)-Math.min(...ys)<=.16&&
   Math.min(...ys)>=-.18&&Math.max(...ys)<=2.05;
  const uvs=ids.map(j=>[uv.get(j,0)*2048,uv.get(j,1)*2048]);
  const compatible=withinUV(uvs);
  sets.all.push(tri);
  if(grade)sets.grade.push(tri);else failedGrade++;
  if(compatible)sets.uv.push(tri);else failedUV++;
  if(grade&&compatible)sets.paving.push(tri);
 }
 return {sets,counts:{inRect,failedGrade,failedUV,nonFinite,
  pavementUVAndGrade:sets.paving.length}};
}
function categorize(raw,grade,paving,material){
 if(!raw.present)return 'no_original_triangle';
 if(!grade.present)return 'grade_filter_rejected';
 if(!paving.present)return 'uv_paving_filter_rejected';
 if(material.outside)return 'outside_r24_raster';
 if(material.water)return 'r24_water';
 if(material.grass)return 'r24_grass';
 if(!material.paving)return 'r24_paving_missing';
 if(paving.stacked)return 'overlapping_paving_heights';
 return 'paving_match_uncertified';
}
function probeAt(indices,survey,masks,x,z){
 const raw=Probe.footprint(indices.all,x,z);
 const grade=Probe.footprint(indices.grade,x,z);
 const uv=Probe.footprint(indices.uv,x,z);
 const paving=Probe.footprint(indices.paving,x,z);
 const material=R24.sample(survey,masks,x,z);
 const reason=categorize(raw,grade,paving,material);
 return {reason,raw:raw.present,grade:grade.present,uv:uv.present,
  paving:paving.present,stacked:paving.stacked,
  r24:{paving:material.paving,grass:material.grass,
   water:material.water,outside:material.outside},
  sourceY:paving.y};
}
function inspect(report,survey,masks,triangleSets){
 assert.equal(report.candidateEdgeId,3445);
 assert.equal(report.originalRoadCertified,false);
 const indices=Object.fromEntries(Object.entries(triangleSets)
  .map(([key,arr])=>[key,Probe.indexTriangles(arr)]));
 const sections=[];
 const countByOffset=Object.fromEntries(OFFSETS.map(k=>[String(k),{}]));
 for(let s=1;s<report.sourcePointsOBJ.length;s++){
  const a=report.sourcePointsOBJ[s-1],b=report.sourcePointsOBJ[s];
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  assert(length>0,'cannot diagnose degenerate corridor');
  const nx=-dz/length,nz=dx/length;
  const n=Math.max(1,Math.ceil(length/.25));
  for(let i=0;i<=n;i++){
   if(s>1&&i===0)continue;
   const t=i/n,x=a[0]+dx*t,z=a[1]+dz*t;
   const cuts=OFFSETS.map(offset=>{
    const sx=x+nx*offset,sz=z+nz*offset;
    const hit=probeAt(indices,survey,masks,sx,sz);
    const counts=countByOffset[String(offset)];
    counts[hit.reason]=(counts[hit.reason]||0)+1;
    return {offset,...hit};
   });
   // +/- .02 OBJ around -0.1 is DIAGNOSTIC ONLY; never close a gap
   // by tolerance, blend surfaces, or use neighboring data in runtime.
   const neighbors=[-.02,-.01,0,.01,.02].map(delta=>({
    delta,...probeAt(indices,survey,masks,x+nx*(-.1+delta),
      z+nz*(-.1+delta))
   }));
   sections.push({atOBJ:[+x.toFixed(4),+z.toFixed(4)],
    longitudinalStep:i,offsets:cuts,seamNeighborhood:neighbors});
  }
 }
 const target=countByOffset['-0.1'];
 const seamCounts={};
 for(const section of sections){
  for(const hit of section.seamNeighborhood){
   const key=String(hit.delta)+':'+hit.reason;
   seamCounts[key]=(seamCounts[key]||0)+1;
  }
 }
 const reasonCounts=Object.entries(target)
   .sort((a,b)=>b[1]-a[1]).map(([reason,count])=>({reason,count}));
 return {format:'DriverChicagoR74SeamRootCauseAudit',
  sourceSHA256:report.sourceSHA256,edgeId:report.candidateEdgeId,
  params:{offsetsOBJ:OFFSETS,crossSectionStepMaxOBJ:.25,
   neighborJitterOBJ:[-.02,-.01,0,.01,.02],exactTriangleIntersections:true},
  evidence:{crossSections:sections.length,minusPointOneOBJ:reasonCounts,
   byOffset:countByOffset,seamNeighborhoodReasons:seamCounts},
  originalRoadCertified:false,trafficEnabled:false,collidersCreated:0,
  sourceGeometryModified:false,undercoverPositionCalibrated:false,
  warning:'Diagnostic-only source GLB polygons. Raw mesh can include walls. UV/grade filtering can reject real non-road surfaces and raster material is not collision proof.',
  sections};
}
function build(){
 const load=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
 const report=load('chicago/corridor-review-r72.json');
 const manifest=load('chicago/manifest.json');
 const raw=fs.readFileSync(path.join(ROOT,'chicago/reference-street-survey.json'));
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),report.sourceSHA256,
  'R24 raster source differs from R72 source graph');
 const survey=JSON.parse(raw);
 const masks=Object.fromEntries(R24.LAYERS.map(name=>[
  name,zlib.gunzipSync(Buffer.from(survey.layers[name].gzipBitsetBase64,'base64'))]));
 for(const k of R24.LAYERS)assert.equal(masks[k].length,
  Math.ceil(survey.width*survey.height/8),'stale mask '+k);
 assert.deepEqual(report.tiles.map(t=>t.id),['01_02','01_03']);
 const pts=report.sourcePointsOBJ,rect={
  minX:Math.min(...pts.map(p=>p[0]))-1,maxX:Math.max(...pts.map(p=>p[0]))+1,
  minZ:Math.min(...pts.map(p=>p[1]))-1,maxZ:Math.max(...pts.map(p=>p[1]))+1
 };
 const all={all:[],grade:[],uv:[],paving:[]},sourceTiles=[];
 for(const tile of report.tiles){
  const file='chicago/chunks/'+tile.id+'.glb',entry=manifest.tiles.find(t=>t.id===tile.id);
  assert(entry&&entry.url==='chunks/'+tile.id+'.glb');
  assert.deepEqual(entry.bounds,tile.bounds);
  const bytes=fs.readFileSync(path.join(ROOT,file));
  const sha=crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha,EXPECTED_TILES[tile.id],'R73 source GLB changed: revalidate');
  const accessor=glbAccessors(path.join(ROOT,file));
  assert.equal(accessor.triangles,entry.triangles);
  const obj=extract(accessor,rect);
  for(const key of Object.keys(all))all[key].push(...obj.sets[key]);
  sourceTiles.push({id:tile.id,sha256:sha,triangles:accessor.triangles,
   ...obj.counts});
 }
 const result=inspect(report,survey,masks,all);
 result.sourceTiles=sourceTiles;
 return result;
}
if(require.main===module){
 const report=build(),out=path.resolve(ROOT,process.argv[2]||
  'qa-artifacts/chicago-r74/seam-diagnostic.json');
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log('CHICAGO_R74_SEAM',JSON.stringify({
  tiles:report.sourceTiles,crossSections:report.evidence.crossSections,
  minusPointOneOBJ:report.evidence.minusPointOneOBJ,
  neighbors:report.evidence.seamNeighborhoodReasons,
  output:out,roadCertified:false,trafficEnabled:false
 }));
}
module.exports={withinUV,extract,categorize,probeAt,inspect,build};
