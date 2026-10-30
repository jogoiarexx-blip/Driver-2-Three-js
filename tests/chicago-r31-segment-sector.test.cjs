'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
let clip;try{clip=require('../tools/chicago-r31-segment-sector.cjs');}catch{}
test('segmento cruza retângulo mesmo com extremos externos',()=>{
 assert(clip,'interseção real ainda não foi implementada');
 const box={minX:0,maxX:10,minZ:0,maxZ:10};
 assert(clip.segmentIntersects([-5,5],[15,5],box));
 assert(!clip.segmentIntersects([-5,4],[4,15],box));
 assert(clip.segmentIntersects([-5,-5],[0,0],box));
 assert(!clip.segmentIntersects([-4,12],[12,12],box));
});
test('polilinha usa geometria real e não a caixa que envolve curvas',()=>{
 const b={minX:0,maxX:10,minZ:0,maxZ:10};
 assert(!clip.polylineIntersects([[-5,3],[-5,15],[7,15]],b));
 assert(clip.polylineIntersects([[-5,3],[5,3],[5,15]],b));
});
test('índices por setor vêm de interseção real com arestas R29 e preservam limitações',()=>{
 const fs=require('node:fs'),r=JSON.parse(fs.readFileSync('chicago/sector-candidates-r31.json'));
 const graph=require('../chicago/reference-network.json'),review=require('../chicago/reference-recovery-r29.json');
 const allowed=new Set(review.combinedCandidateIds);assert.equal(r.sectors.length,54);
 for(const s of r.sectors){assert.equal(new Set(s.candidateIds).size,s.candidateIds.length);for(const id of s.candidateIds){assert(allowed.has(id));assert(clip.polylineIntersects(graph.edges[id].pointsOBJ,s.sourceBounds));}const expected=[...allowed].filter(id=>clip.polylineIntersects(graph.edges[id].pointsOBJ,s.sourceBounds)).sort((a,b)=>a-b);assert.deepEqual(s.candidateIds,expected);}
 assert.equal(r.roadCertified,false);assert.equal(r.trafficEnabled,false);assert.equal(r.missionsMigrated,false);
});
test('interseção é simétrica e trata segmentos degenerados',()=>{
 const box={minX:0,maxX:10,minZ:0,maxZ:10};
 for(const [a,b] of [[[-5,3],[8,12]],[[5,5],[5,5]],[[15,5],[15,5]],[[0,0],[0,10]]])assert.equal(clip.segmentIntersects(a,b,box),clip.segmentIntersects(b,a,box));
 assert(clip.segmentIntersects([5,5],[5,5],box));assert(!clip.segmentIntersects([15,5],[15,5],box));
});

test('arquivos derivados indicam hashes reproduzíveis das fontes usadas',()=>{
 const crypto=require('node:crypto'),fs=require('node:fs');const r=JSON.parse(fs.readFileSync('chicago/sector-candidates-r31.json'));
 for(const [file,hash] of Object.entries(r.inputHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash);
 assert.equal(Object.keys(r.inputHashes).length,7);
});
