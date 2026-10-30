#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),{polylineIntersects}=require('./chicago-r31-segment-sector.cjs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const survey=fs.readFileSync('chicago/reference-street-survey.json');
const hash=crypto.createHash('sha256').update(survey).digest('hex');
const graph=read('chicago/reference-network.json'),review=read('chicago/reference-recovery-r29.json'),inventory=read('chicago/sector-inventory-r30.json');
if([graph.sourceSHA256,review.sourceSHA256,inventory.sourceSHA256].some(x=>x!==hash))throw Error('Fontes incompatíveis');
const Curve=require('../js/world/chicago-ps1-reference-curve.js');
if(Curve.source.sourceSHA256!==hash)throw Error('Curva incompatível');
const inputPaths=['chicago/reference-street-survey.json','chicago/reference-network.json','chicago/reference-recovery-r29.json','chicago/sector-inventory-r30.json','chicago/reference-curve-r15.json','chicago/manifest.json','js/world/chicago-ps1-reference-curve.js'];
const inputHashes=Object.fromEntries(inputPaths.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
if(inputHashes['chicago/manifest.json']!==inventory.manifestSHA256)throw Error('Manifesto incompatível');
for(const s of inventory.sectors){const b=s.sourceBounds;const pts=[[b.minX,b.minZ],[b.maxX,b.minZ],[b.maxX,b.maxZ],[b.minX,b.maxZ]];pts.forEach((p,i)=>{const q=Curve.fitPoint(p),old=s.worldCorners[i];if(!old||Math.hypot(q.x-old.x,q.z-old.z)>1e-7)throw Error('Projeção incompatível: '+s.id);});}
const candidateIds=[...new Set(review.combinedCandidateIds)].sort((a,b)=>a-b);
if(candidateIds.some(id=>!Number.isInteger(id)||!graph.edges[id]))throw Error('Aresta inválida');
const sectors=inventory.sectors.map(s=>({id:s.id,sourceBounds:s.sourceBounds,worldCorners:s.worldCorners,
 candidateIds:candidateIds.filter(id=>polylineIntersects(graph.edges[id].pointsOBJ,s.sourceBounds)),
 previousBoundingBoxCount:s.reviewEdgeBoundingBoxes}));
const output={format:'Driver2ChicagoSectorCandidatesR31',sourceSHA256:hash,
 candidateEdges:candidateIds.length,inputHashes,sectors,roadCertified:false,trafficEnabled:false,missionsMigrated:false,
 limitations:'Intersection of source centerline with tile AABBs; tile boundaries and overlapping source bounds can assign the same edge to several tiles. Candidate pavement may be sidewalk, yard or another height; no inferred drivable route.'};
fs.writeFileSync('chicago/sector-candidates-r31.json',JSON.stringify(output,null,2)+'\n');
const all=sectors.flatMap(s=>s.worldCorners),minX=Math.min(...all.map(p=>p.x)),maxZ=Math.max(...all.map(p=>p.z));
const xy=p=>`${((p.x-minX)*.5+40).toFixed(2)},${((maxZ-p.z)*.5+40).toFixed(2)}`;
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><rect width="600" height="900" fill="#121e29"/><text x="20" y="23" fill="white" font-family="sans-serif" font-size="14">Chicago PS1 • setores e segmentos candidatos R29</text>';
for(const s of sectors)svg+=`<polygon points="${s.worldCorners.map(xy).join(' ')}" fill="#354852" fill-opacity=".36" stroke="#90b8a9" stroke-width=".8"><title>Setor ${s.id}: ${s.candidateIds.length} segmentos candidatos</title></polygon>`;
for(const id of candidateIds)svg+=`<polyline points="${graph.edges[id].pointsOBJ.map(p=>xy(Curve.fitPoint(p))).join(' ')}" fill="none" stroke="#f3c55b" stroke-width="1.5"><title>Segmento candidato ${id}: não certificado como rua</title></polyline>`;
svg+='<text x="20" y="870" fill="#d5e5e1" font-family="sans-serif" font-size="12">Amarelo: pavimento candidato, sem certificação de ruas ou tráfego.</text></svg>\n';
fs.writeFileSync('docs/chicago-evolucao/candidatos-setores-r31.svg',svg);
console.log(JSON.stringify({sectors:sectors.length,candidates:candidateIds.length,sectorAssignments:sectors.reduce((n,s)=>n+s.candidateIds.length,0),oldBoundingAssignments:sectors.reduce((n,s)=>n+s.previousBoundingBoxCount,0),sectorsWithCandidates:sectors.filter(s=>s.candidateIds.length).length}));
