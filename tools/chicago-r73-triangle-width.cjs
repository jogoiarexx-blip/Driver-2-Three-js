#!/usr/bin/env node
'use strict';
/**
 * R73 — read-only triangle-width probe for the original PS1 Chicago corridor.
 * Does not import gameplay, write city/traffic data, or certify a driveable road.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),
 zlib=require('node:zlib'),assert=require('node:assert/strict');
const {glbAccessors}=require('./chicago-r26-grade-audit.cjs');
const R24=require('../js/world/chicago-road-evidence-r24.js');
const root=path.resolve(__dirname,'..');
const CELL=.25,STEP=.10,HALF=.80,TRACK_STEP=.25,MAX_STACKED_Y=.045,MAX_CROSS_Y=.06;
const REGIONS=[[65,191,128,254],[2,88,65,152]];
function fixtureTriangles(accessors,rect){
 const {pos,uv,indices}=accessors,found=[];
 for(let i=0;i<indices.count;i+=3){
  const ids=[indices.get(i),indices.get(i+1),indices.get(i+2)];
  const vertices=ids.map(k=>[pos.get(k,0),pos.get(k,1),pos.get(k,2)]);
  const xs=vertices.map(p=>p[0]),zs=vertices.map(p=>p[2]),ys=vertices.map(p=>p[1]);
  if(Math.max(...xs)<rect.minX||Math.min(...xs)>rect.maxX||
     Math.max(...zs)<rect.minZ||Math.min(...zs)>rect.maxZ)continue;
  if(Math.max(...ys)-Math.min(...ys)>.16||Math.min(...ys)<-.18||Math.max(...ys)>2.05)continue;
  const tex=ids.map(k=>[uv.get(k,0)*2048,uv.get(k,1)*2048]);
  const lo=[Math.min(...tex.map(p=>p[0])),Math.min(...tex.map(p=>p[1]))];
  const hi=[Math.max(...tex.map(p=>p[0])),Math.max(...tex.map(p=>p[1]))];
  if(!REGIONS.some(([a,b,c,d])=>lo[0]>=a-1e-4&&lo[1]>=b-1e-4&&
                                 hi[0]<=c+1e-4&&hi[1]<=d+1e-4))continue;
  found.push(vertices);
 }
 return found;
}
function cell(x,z){return Math.floor(x/CELL)+','+Math.floor(z/CELL)}
function indexTriangles(triangles){
 const index=new Map();
 for(const tri of triangles){
  const xs=tri.map(p=>p[0]),zs=tri.map(p=>p[2]);
  const minX=Math.floor(Math.min(...xs)/CELL),maxX=Math.floor(Math.max(...xs)/CELL);
  const minZ=Math.floor(Math.min(...zs)/CELL),maxZ=Math.floor(Math.max(...zs)/CELL);
  for(let ix=minX;ix<=maxX;ix++)for(let iz=minZ;iz<=maxZ;iz++){
   const key=ix+','+iz;
   if(!index.has(key))index.set(key,[]);
   index.get(key).push(tri);
  }
 }
 return index;
}
function heightAt(tri,x,z){
 const [a,b,c]=tri;
 const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
 if(Math.abs(den)<1e-10)return null;
 const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;
 const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
 if(u< -1e-5||v< -1e-5||u+v>1.00001)return null;
 return a[1]*u+b[1]*v+c[1]*(1-u-v);
}
function footprint(index,x,z){
 const y=[];
 for(const tri of index.get(cell(x,z))||[]){
  const h=heightAt(tri,x,z);
  if(h!==null&&Number.isFinite(h))y.push(h);
 }
 if(!y.length)return {present:false,stacked:false,y:null};
 const min=Math.min(...y),max=Math.max(...y);
 return {present:true,stacked:max-min>MAX_STACKED_Y,
  y:+((min+max)/2).toFixed(5),heightRange:+(max-min).toFixed(5)};
}
function inspect(report,survey,masks,triangles){
 assert.equal(report.candidateEdgeId,3445);
 assert.equal(report.originalRoadCertified,false);
 const index=indexTriangles(triangles);
 const samples=[],rejectCounts={geometryMissing:0,stacked:0,materialMissing:0,grass:0,water:0,gradeJump:0};
 let lanesWithBothSides=0,completeSections=0;
 for(let segment=1;segment<report.sourcePointsOBJ.length;segment++){
  const a=report.sourcePointsOBJ[segment-1],b=report.sourcePointsOBJ[segment];
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  const sections=Math.max(1,Math.ceil(length/TRACK_STEP)),nx=-dz/length,nz=dx/length;
  for(let k=0;k<=sections;k++){
   if(segment>1&&k===0)continue;
   const t=k/sections,x=a[0]+dx*t,z=a[1]+dz*t;
   const cuts=[];
   for(let step=-8;step<=8;step++){
    const offset=+(step*STEP).toFixed(2),sx=x+nx*offset,sz=z+nz*offset;
    const geometry=footprint(index,sx,sz),material=R24.sample(survey,masks,sx,sz);
    cuts.push({offset,...geometry,paving:material.paving,grass:material.grass,
      water:material.water,outside:material.outside});
   }
   const center=cuts[8];
   for(const cut of cuts){
    const gradeJump=center.present&&cut.present&&Math.abs(cut.y-center.y)>MAX_CROSS_Y;
    cut.ok=cut.present&&!cut.stacked&&cut.paving&&!cut.grass&&!cut.water&&
      !cut.outside&&!gradeJump;
    if(!cut.present)rejectCounts.geometryMissing++;
    if(cut.stacked)rejectCounts.stacked++;
    if(!cut.paving)rejectCounts.materialMissing++;
    if(cut.grass)rejectCounts.grass++;
    if(cut.water)rejectCounts.water++;
    if(gradeJump)rejectCounts.gradeJump++;
   }
   let left=0,right=0;
   if(center.ok){
    for(let i=7;i>=0&&cuts[i].ok;i--)left++;
    for(let i=9;i<17&&cuts[i].ok;i++)right++;
   }
   const halfWidth=Math.min(left,right)*STEP;
   if(halfWidth>0)lanesWithBothSides++;
   if(left===8&&right===8)completeSections++;
   samples.push({atOBJ:[+x.toFixed(4),+z.toFixed(4)],
    sourceProgress:+(t*length).toFixed(3),centerY:center.y,
    contiguousLeftOBJ:+(left*STEP).toFixed(2),
    contiguousRightOBJ:+(right*STEP).toFixed(2),
    symmetricWidthOBJ:+(2*halfWidth).toFixed(2),cuts});
  }
 }
 const widths=samples.map(s=>s.symmetricWidthOBJ),sorted=widths.slice().sort((a,b)=>a-b);
 return {format:'DriverChicagoOriginalTriangleWidthR73',
  provenance:{candidateEdgeId:3445,sourceSHA256:report.sourceSHA256,
   originalSectorIds:report.tiles.map(t=>t.id),triangleSamplePredicate:'R26 pavement-UV regions and height band',
   exactTriangleBarycentric:true,r24MaskStepOBJ:survey.stepOBJ},
  params:{trackStepOBJ:TRACK_STEP,lateralStepOBJ:STEP,maximumOffsetOBJ:HALF,
   maximumHeightOverlapOBJ:MAX_STACKED_Y,maximumCrossSectionGradeChangeOBJ:MAX_CROSS_Y},
  evidence:{totalCrossSections:samples.length,crossSectionsWithSymmetricPaving:lanesWithBothSides,
   crossSectionsFullyCovered:completeSections,minimumSymmetricWidthOBJ:sorted[0],
   medianSymmetricWidthOBJ:sorted[Math.floor(sorted.length/2)],
   maximumSymmetricWidthOBJ:sorted.at(-1),rejectedSampleReasons:rejectCounts},
  certifiedForDriving:false,calibratedToUndercover:false,trafficEnabled:false,
  collidersCreated:0,missionsChanged:false,
  interpretation:'Original PS1 visual triangles + source material masks; neither collision geometry nor measured car width. A clear swath is NOT a certified lane.',
  crossSections:samples};
}
function build(){
 const load=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
 const report=load('chicago/corridor-review-r72.json'),manifest=load('chicago/manifest.json');
 const raw=fs.readFileSync(path.join(root,'chicago/reference-street-survey.json'));
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),report.sourceSHA256);
 const survey=JSON.parse(raw);
 const masks=Object.fromEntries(R24.LAYERS.map(name=>[
  name,zlib.gunzipSync(Buffer.from(survey.layers[name].gzipBitsetBase64,'base64'))]));
 const expectedBytes=Math.ceil(survey.width*survey.height/8);
 for(const name of R24.LAYERS)assert.equal(masks[name].length,expectedBytes);
 const p=report.sourcePointsOBJ.flatMap(v=>v[0]);
 const q=report.sourcePointsOBJ.flatMap(v=>v[1]);
 const rect={minX:Math.min(...p)-1,maxX:Math.max(...p)+1,
  minZ:Math.min(...q)-1,maxZ:Math.max(...q)+1};
 const triangles=[],sourceTiles=[];
 assert.equal(report.tiles.length,2);
 for(const tile of report.tiles){
  const entry=manifest.tiles.find(t=>t.id===tile.id);
  assert(entry&&entry.url==='chunks/'+tile.id+'.glb');
  assert.deepStrictEqual(entry.bounds,tile.bounds);
  const file=path.join(root,'chicago',entry.url);
  const accessors=glbAccessors(file);
  assert.equal(accessors.triangles,entry.triangles);
  const region=fixtureTriangles(accessors,rect);
  triangles.push(...region);
  sourceTiles.push({id:tile.id,sourceTriangles:accessors.triangles,
   regionPavingTriangles:region.length,sha256:crypto.createHash('sha256')
     .update(fs.readFileSync(file)).digest('hex')});
 }
 const result=inspect(report,survey,masks,triangles);
 result.provenance.sourceTiles=sourceTiles;
 result.evidence.pavingTrianglesInSwath=triangles.length;
 return result;
}
if(require.main===module){
 const result=build();
 const dest=path.resolve(root,process.argv[2]||'qa-artifacts/chicago-r73/triangle-width.json');
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n');
 console.log('CHICAGO_R73_TRIANGLE_WIDTH',JSON.stringify({
  sourceTiles:result.provenance.sourceTiles,geometry:result.evidence,
  roadCertified:false,trafficEnabled:false,output:dest}));
}
module.exports={fixtureTriangles,indexTriangles,heightAt,footprint,inspect,build};
