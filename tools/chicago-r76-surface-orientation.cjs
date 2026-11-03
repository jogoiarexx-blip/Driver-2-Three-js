#!/usr/bin/env node
'use strict';
/**
 * R76: read-only PS1 Chicago source-mesh geometry classification.
 * Triangle inclination, original UV, height overlap and sector provenance.
 * NO physical roads, collisions, player, traffic, mission or save imports.
 * A horizontal surface is NOT evidence that it is an automobile road.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),
 assert=require('node:assert/strict');
const {glbAccessors}=require('./chicago-r26-grade-audit.cjs');
const R74=require('./chicago-r74-source-seam.cjs');
const Probe=require('./chicago-r73-triangle-width.cjs');
const root=path.resolve(__dirname,'..');
const STEP=.25,CELL=.25,FOCUS=[-.12,-.10,-.08],
 OFFSETS=[-.6,-.5,-.4,-.3,-.2,-.12,-.1,-.08,0,.1,.2,.3,.4,.5,.6];
const ORIGINAL_SHA={
 '01_02':'5de1b285ed8e74a3e024530fe474c0f4ad55e88ef26757209b644ef5e8f733c4',
 '01_03':'985165a16cfb3b57ac206d096d8b067e3d69120a5e5994fb48865974b6160315'
};
function round(v,n=5){return +v.toFixed(n)}
function orientation(tri){
 const [a,b,c]=tri;
 const v=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],
       w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
 const cx=v[1]*w[2]-v[2]*w[1],
       cy=v[2]*w[0]-v[0]*w[2],
       cz=v[0]*w[1]-v[1]*w[0];
 const magnitude=Math.hypot(cx,cy,cz);
 const projectedArea=Math.abs(cy)/2;
 if(magnitude<1e-10)return {kind:'degenerate_triangle',angle:null,projectedAreaOBJ2:0};
 const angle=Math.acos(Math.min(1,Math.abs(cy)/magnitude))*180/Math.PI;
 const kind=projectedArea<1e-9?'vertical_or_edge_on':
  angle<=15?'near_horizontal':
  angle<=35?'inclined':'steep_wall_like';
 return {kind,angle:round(angle,3),projectedAreaOBJ2:round(projectedArea,7)};
}
function tilesInRect(accessors,rect,tileId){
 const {pos,uv,indices}=accessors,rows=[];
 for(let i=0;i<indices.count;i+=3){
  const ids=[indices.get(i),indices.get(i+1),indices.get(i+2)];
  const tri=ids.map(k=>[pos.get(k,0),pos.get(k,1),pos.get(k,2)]);
  if(!tri.every(p=>p.every(Number.isFinite)))continue;
  if(Math.max(...tri.map(p=>p[0]))<rect.minX||
     Math.min(...tri.map(p=>p[0]))>rect.maxX||
     Math.max(...tri.map(p=>p[2]))<rect.minZ||
     Math.min(...tri.map(p=>p[2]))>rect.maxZ)continue;
  const uvs=ids.map(k=>[uv.get(k,0)*2048,uv.get(k,1)*2048]);
  rows.push({tile:tileId,triangleIndex:i/3,tri,uvs,
   orientation:orientation(tri)});
 }
 return rows;
}
function indexRows(rows){
 const byCell=new Map();
 for(const row of rows){
  const tri=row.tri,xs=tri.map(p=>p[0]),zs=tri.map(p=>p[2]);
  const x0=Math.floor(Math.min(...xs)/CELL),x1=Math.floor(Math.max(...xs)/CELL);
  const z0=Math.floor(Math.min(...zs)/CELL),z1=Math.floor(Math.max(...zs)/CELL);
  for(let ix=x0;ix<=x1;ix++)for(let iz=z0;iz<=z1;iz++){
   const key=ix+','+iz;
   if(!byCell.has(key))byCell.set(key,[]);
   byCell.get(key).push(row);
  }
 }
 return byCell;
}
function materialAt(uv){
 // Original R26 heuristic applies to atlas coordinates only.
 return R74.withinUV([uv])?'r26_paving_uv_heuristic':'other_atlas_uv';
}
function sample(index,x,z){
 const rows=index.get(Math.floor(x/CELL)+','+Math.floor(z/CELL))||[];
 const hits=[];
 for(const r of rows){
  const y=Probe.heightAt(r.tri,x,z);
  if(y===null||!Number.isFinite(y))continue;
  const uv=R74.interpolateUV(r.tri,r.uvs,x,z);
  if(!uv||!uv.every(Number.isFinite))continue;
  hits.push({tile:r.tile,triangleIndex:r.triangleIndex,
   sourceYOBJ:round(y),
   uv:uv.map(v=>round(v,3)),
   uvMaterial:materialAt(uv),
   geometryClass:r.orientation.kind,
   normalTiltDeg:r.orientation.angle,
   projectedAreaOBJ2:r.orientation.projectedAreaOBJ2});
 }
 hits.sort((a,b)=>a.tile.localeCompare(b.tile)||
  a.triangleIndex-b.triangleIndex);
 const heights=hits.map(v=>v.sourceYOBJ);
 const heightSpreadOBJ=heights.length>0?round(Math.max(...heights)-Math.min(...heights)):null;
 const kinds=[...new Set(hits.map(v=>v.geometryClass))];
 const materials=[...new Set(hits.map(v=>v.uvMaterial))];
 return {hits,
  count:hits.length,heightSpreadOBJ,
  surfaces:kinds,uvMaterials:materials,
  overlappingHeights:heightSpreadOBJ!==null&&heightSpreadOBJ>.045,
  mixedAtlasUV:materials.length>1,
  possibleWall:!!hits.find(v=>v.geometryClass==='steep_wall_like'||
    v.geometryClass==='vertical_or_edge_on')};
}
function inspect(report,rows){
 assert.equal(report.candidateEdgeId,3445);
 assert.equal(report.originalRoadCertified,false);
 const index=indexRows(rows),sections=[],totals={
  sections:0,pointSamples:0,pointHits:0,missingGeometry:0,
  multiTriangleSamples:0,stacksOver045:0,sourceGeometryKinds:{},
  sourceUVKinds:{}
 };
 const sourceOrientations={};
 for(const row of rows)sourceOrientations[row.orientation.kind]=
  (sourceOrientations[row.orientation.kind]||0)+1;
 const byOffset=Object.fromEntries(FOCUS.map(o=>[String(o),{
  sections:0,hits:0,otherMaterialHits:0,pavingUVHits:0,
  nearHorizontalHits:0,inclinedHits:0,steepHits:0,overlaps:0
 }]));
 for(let segment=1;segment<report.sourcePointsOBJ.length;segment++){
  const a=report.sourcePointsOBJ[segment-1],b=report.sourcePointsOBJ[segment],
   dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  assert(len>0);
  const nx=-dz/len,nz=dx/len;
  const steps=Math.max(1,Math.ceil(len/STEP));
  for(let i=0;i<=steps;i++){
   if(segment>1&&i===0)continue;
   const t=i/steps,x=a[0]+dx*t,z=a[1]+dz*t;
   const cuts=OFFSETS.map(offset=>{
    const sx=x+nx*offset,sz=z+nz*offset;
    const hit=sample(index,sx,sz);
    totals.pointSamples++;
    totals.pointHits+=hit.count;
    if(!hit.count)totals.missingGeometry++;
    if(hit.count>1)totals.multiTriangleSamples++;
    if(hit.overlappingHeights)totals.stacksOver045++;
    for(const h of hit.hits){
     totals.sourceGeometryKinds[h.geometryClass]=(totals.sourceGeometryKinds[h.geometryClass]||0)+1;
     totals.sourceUVKinds[h.uvMaterial]=(totals.sourceUVKinds[h.uvMaterial]||0)+1;
    }
    if(Object.hasOwn(byOffset,String(offset))){
     const item=byOffset[String(offset)];
     item.sections++;
     item.hits+=hit.count;
     item.otherMaterialHits+=hit.hits.filter(h=>h.uvMaterial==='other_atlas_uv').length;
     item.pavingUVHits+=hit.hits.filter(h=>h.uvMaterial==='r26_paving_uv_heuristic').length;
     item.nearHorizontalHits+=hit.hits.filter(h=>h.geometryClass==='near_horizontal').length;
     item.inclinedHits+=hit.hits.filter(h=>h.geometryClass==='inclined').length;
     item.steepHits+=hit.hits.filter(h=>h.geometryClass==='steep_wall_like'||h.geometryClass==='vertical_or_edge_on').length;
     if(hit.count>1)item.overlaps++;
    }
    return {offset,sourceXZOBJ:[round(sx,4),round(sz,4)],...hit};
   });
   sections.push({atOBJ:[round(x,4),round(z,4)],cuts});
  }
 }
 totals.sections=sections.length;
 return {format:'DriverChicagoR76OriginalSourceSurfaceGeometry',
  edgeId:3445,sourceSHA256:report.sourceSHA256,
  sourceSectors:report.tiles.map(x=>x.id),
  params:{crossSectionStepMaxOBJ:STEP,offsetsOBJ:OFFSETS,
   focusOffsetsOBJ:FOCUS,triangleSampleExactXZ:true},
  evidence:{...totals,sourceTrianglesInROI:rows.length,
   originalTriangleOrientationKinds:sourceOrientations,
   focalOffsets:byOffset},
  sections,
  certifiedRoad:false,runtimeRoadEnabled:false,collidersCreated:0,
  geometryChanged:false,trafficChanged:false,missionsChanged:false,
  note:'Triangle inclination is only a geometric orientation. Near-horizontal surfaces may be sidewalk, roof, yard or road; atlas heuristics do not prove a driveable lane. Vertical faces are edge-on in exact XZ probes.'
 };
}
function build(){
 const load=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
 const report=load('chicago/corridor-review-r72.json'),manifest=load('chicago/manifest.json');
 const survey=fs.readFileSync(path.join(root,'chicago/reference-street-survey.json'));
 assert.equal(crypto.createHash('sha256').update(survey).digest('hex'),report.sourceSHA256);
 assert.deepEqual(report.tiles.map(t=>t.id),['01_02','01_03']);
 const pts=report.sourcePointsOBJ;
 const rect={minX:Math.min(...pts.map(p=>p[0]))-1,
  maxX:Math.max(...pts.map(p=>p[0]))+1,
  minZ:Math.min(...pts.map(p=>p[1]))-1,
  maxZ:Math.max(...pts.map(p=>p[1]))+1};
 const rows=[],sourceTiles=[];
 for(const tile of report.tiles){
  const original=manifest.tiles.find(t=>t.id===tile.id);
  assert(original&&original.url==='chunks/'+tile.id+'.glb');
  assert.deepEqual(original.bounds,tile.bounds);
  const file=path.join(root,'chicago',original.url);
  const buf=fs.readFileSync(file);
  const sha=crypto.createHash('sha256').update(buf).digest('hex');
  assert.equal(sha,ORIGINAL_SHA[tile.id]);
  const accessors=glbAccessors(file);
  assert.equal(accessors.triangles,original.triangles);
  const subset=tilesInRect(accessors,rect,tile.id);
  rows.push(...subset);
  sourceTiles.push({id:tile.id,sha256:sha,
   sourceTriangles:original.triangles,trianglesInROI:subset.length});
 }
 const result=inspect(report,rows);
 result.provenance={sourceTiles,
  originalSourceSurveySHA256:report.sourceSHA256,
  originalGLBUnmodified:true};
 return result;
}
function compact(full){
 return {format:'DriverChicagoR76SurfaceOrientationViewer',
  edgeId:full.edgeId,sourceSHA256:full.sourceSHA256,
  sourceSectors:full.sourceSectors,
  offsetsOBJ:FOCUS,
  evidence:full.evidence,
  crossSections:full.sections.map((s,index)=>({
   index,atOBJ:s.atOBJ,
   cuts:FOCUS.map(offset=>{
    const c=s.cuts.find(x=>Math.abs(x.offset-offset)<1e-7);
    return {offset,point:c.sourceXZOBJ,hits:c.hits.map(h=>({
     tile:h.tile,triangleIndex:h.triangleIndex,
     sourceYOBJ:h.sourceYOBJ,uvMaterial:h.uvMaterial,
     geometryClass:h.geometryClass,normalTiltDeg:h.normalTiltDeg
    })),heightSpreadOBJ:c.heightSpreadOBJ,
     mixedAtlasUV:c.mixedAtlasUV,overlappingHeights:c.overlappingHeights};
   })
  })),
  certifiedRoad:false,runtimeRoadEnabled:false,collidersCreated:0};
}
if(require.main===module){
 const full=build();
 const out=path.resolve(root,process.argv[2]||'qa-artifacts/chicago-r76/orientation.json');
 const compactOut=path.resolve(root,process.argv[3]||'qa-artifacts/chicago-r76/orientation-compact.json');
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.mkdirSync(path.dirname(compactOut),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(full,null,2)+'\n');
 fs.writeFileSync(compactOut,JSON.stringify(compact(full),null,2)+'\n');
 console.log('CHICAGO_R76_ORIENTATION',JSON.stringify({
  sectors:full.provenance.sourceTiles,
  evidence:full.evidence,certifiedRoad:false,
  runtimeRoadEnabled:false,report:out,viewer:compactOut}));
}
module.exports={orientation,tilesInRect,indexRows,materialAt,sample,inspect,compact,build};
