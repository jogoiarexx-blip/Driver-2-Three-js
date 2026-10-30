'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
let Link;try{Link=require('../js/world/chicago-north-link-r36.js')}catch{}
test('R36 conecta exatamente ao final R35 e conserva cadeia de 17 arestas da fonte',()=>{
 assert(Link,'prolongamento R36 ausente');const p=Link.plan(),old=require('../js/world/chicago-north-link-r35.js').plan();assert.deepEqual(p.points[0],old.points.at(-1));assert(p.points.at(-1).z>1240);assert.equal(p.wholeMapCertified,false);const r=require('../chicago/reference-north-link-r36.json'),g=require('../chicago/reference-network.json');assert.equal(r.sourceEdgeIds.length,17);let points=[];r.sourceEdgeIds.forEach((id,i)=>{const e=g.edges[id],from=r.sourceNodeIds[i],to=r.sourceNodeIds[i+1];assert(new Set([e.from,e.to]).has(from)&&new Set([e.from,e.to]).has(to));const pts=e.from===from?e.pointsOBJ:[...e.pointsOBJ].reverse();points.push(...pts.slice(i?1:0));});assert.deepEqual(points,r.pointsOBJ);
});
