'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
let Link;try{Link=require('../js/world/chicago-north-link-r35.js')}catch{}
test('prolongamento conecta R25 e preserva origem em 25 arestas',()=>{
 assert(Link,'prolongamento ausente');const ref=require('../chicago/reference-north-link-r35.json'),graph=require('../chicago/reference-network.json');
 assert.equal(ref.sourceEdgeIds.length,25);let points=[];
 ref.sourceEdgeIds.forEach((id,i)=>{const edge=graph.edges[id],from=ref.sourceNodeIds[i],to=ref.sourceNodeIds[i+1];assert(new Set([edge.from,edge.to]).has(from)&&new Set([edge.from,edge.to]).has(to));const p=edge.from===from?edge.pointsOBJ:[...edge.pointsOBJ].reverse();points.push(...p.slice(i?1:0));});
 assert.deepEqual(ref.pointsOBJ,points);const p=Link.plan(),prev=require('../js/world/chicago-ps1-eastern-fork-r25.js').plan();assert.deepEqual(p.points[0],prev.points.at(-1));assert(p.points.at(-1).z>1000);assert.equal(p.wholeMapCertified,false);assert.equal(p.missionsMigrated,false);
});
test('radar registra o prolongamento sem confundi-lo com os três braços antigos',()=>{
 const Net=require('../js/world/chicago-ps1-street-network-r22.js');
 const paths=Net.sourcePaths({chicagoReferenceNorthLinkR35:{points:[{x:0,z:0},{x:1,z:1}],width:8},chicagoReferenceNorthNetwork:{segments:{}}});
 assert.equal(paths.length,1);assert.equal(paths[0].id,'north-link-r35');
});
