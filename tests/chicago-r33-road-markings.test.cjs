'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
let M;try{M=require('../js/world/chicago-north-markings-r33.js')}catch{}
test('faixas seguem apenas os segmentos e respeitam recuo nas extremidades',()=>{
 assert(M,'gerador de faixas ausente');const p=[{x:0,z:0},{x:0,z:20},{x:20,z:20}];
 const d=M.dashes(p);assert(d.length>0);for(const x of d){assert(x.a.z===0||x.a.x===0||x.a.z===20);assert(x.b.x===0||x.b.z===20);assert(Math.hypot(x.b.x-x.a.x,x.b.z-x.a.z)<=3.01)}
});
