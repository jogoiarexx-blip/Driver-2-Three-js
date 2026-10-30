#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const manifest=read('chicago/manifest.json'),survey=read('chicago/reference-street-survey.json');
const network=read('chicago/reference-network.json'),recovery=read('chicago/reference-recovery-r29.json');
const Curve=require('../js/world/chicago-ps1-reference-curve.js');
const sourceHash=crypto.createHash('sha256').update(fs.readFileSync('chicago/reference-street-survey.json')).digest('hex');
if([network.sourceSHA256,recovery.sourceSHA256,Curve.source.sourceSHA256].some(h=>h!==sourceHash))throw Error('Falha de proveniência: fontes incompatíveis');
const hashes=new Map(survey.tiles.map(t=>[t.id,t]));
const intersect=(a,b)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minZ<=b.maxZ&&a.maxZ>=b.minZ;
const edges=network.edges.map((e,id)=>{const xs=e.pointsOBJ.map(p=>p[0]),zs=e.pointsOBJ.map(p=>p[1]);return {id,minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};});
const candidates=new Set(recovery.combinedCandidateIds);
const sectors=manifest.tiles.map(t=>{
 const lo=t.bounds.min,hi=t.bounds.max,box={minX:lo[0],maxX:hi[0],minZ:lo[2],maxZ:hi[2]};
 const evidence=hashes.get(t.id);if(!evidence||evidence.triangles!==t.triangles)throw Error('Evidence mismatch: '+t.id);
 const overlap=edges.filter(e=>intersect(e,box));
 return {id:t.id,sourceBounds:box,worldCorners:[[lo[0],lo[2]],[hi[0],lo[2]],[hi[0],hi[2]],[lo[0],hi[2]]].map(p=>Curve.fitPoint(p)),
  sourceHash:evidence.sha256,triangles:t.triangles,classifiedTriangles:evidence.selected,
  candidateEdgeBoundingBoxes:overlap.length,reviewEdgeBoundingBoxes:overlap.filter(e=>candidates.has(e.id)).length,
  status:'evidence-only',certifiedRoads:false};
});
const result={format:'Driver2ChicagoSectorInventoryR30',sourceSHA256:sourceHash,
 manifestSHA256:crypto.createHash('sha256').update(fs.readFileSync('chicago/manifest.json')).digest('hex'),
 totalTriangles:sectors.reduce((sum,s)=>sum+s.triangles,0),sectors,wholeMapBuilt:false,missionsMigrated:false,
 limitations:'Candidate counts use bounding-box overlap and may count one edge in multiple tiles. Surface classification does not certify roads, levels or traffic. World placement is adapted.'};
fs.writeFileSync('chicago/sector-inventory-r30.json',JSON.stringify(result,null,2)+'\n');
const all=sectors.flatMap(s=>s.worldCorners),minX=Math.min(...all.map(p=>p.x)),maxZ=Math.max(...all.map(p=>p.z));
const scale=.5,poly=s=>s.worldCorners.map(p=>`${((p.x-minX)*scale+40).toFixed(2)},${((maxZ-p.z)*scale+40).toFixed(2)}`).join(' ');
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><rect width="600" height="900" fill="#121e29"/><text x="25" y="24" fill="white" font-family="sans-serif" font-size="15">54 setores originais projetados no Undercover — R30</text>`;
for(const s of sectors){const c=s.worldCorners.reduce((a,p)=>({x:a.x+p.x/4,z:a.z+p.z/4}),{x:0,z:0});const x=(c.x-minX)*scale+40,z=(maxZ-c.z)*scale+40;svg+=`<polygon points="${poly(s)}" fill="${s.reviewEdgeBoundingBoxes?'#566f64':'#354852'}" fill-opacity=".65" stroke="#a2c6b6" stroke-width="1"><title>${s.id}: ${s.triangles} triângulos, ${s.reviewEdgeBoundingBoxes} caixas candidatas R29; somente evidência</title></polygon><text x="${x.toFixed(2)}" y="${z.toFixed(2)}" fill="white" font-family="sans-serif" font-size="8" text-anchor="middle">${s.id}</text>`;}
svg+='<text x="25" y="875" fill="#d5e5e1" font-family="sans-serif" font-size="12">Caixas sobrepostas não são estradas certificadas. Posição adaptada.</text></svg>\n';
fs.writeFileSync('docs/chicago-evolucao/setores-originais-r30.svg',svg);
console.log(`Inventário: ${sectors.length} setores, ${result.totalTriangles} triângulos`);
