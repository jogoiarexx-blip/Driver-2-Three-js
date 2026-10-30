'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
let Blocks;try{Blocks=require('../js/world/chicago-north-roadside-r32.js')}catch{}
test('lotes mantêm afastamento das ruas e obedecem água e colisão',()=>{
 assert(Blocks,'módulo de quarteirões ausente');
 const path={points:[{x:0,z:430},{x:0,z:630}],width:8};
 const city={preset:{id:'chicago'},isWaterAt:(x,z)=>x>0,isPointBlocked:()=>false};
 const lots=Blocks.plan(city,[path]);assert(lots.length>0);assert(lots.every(b=>b.x<0&&b.z>420));
 assert(lots.every(b=>Math.abs(b.x)-b.width/2>=6));
 assert.deepEqual(Blocks.plan({preset:{id:'havana'}},[path]),[]);
});
test('nenhum lote é produzido perto de obstáculos ou fora dos limites',()=>{
 const p={points:[{x:0,z:430},{x:0,z:600}],width:8};
 assert.deepEqual(Blocks.plan({preset:{id:'chicago'},isWaterAt:()=>false,isPointBlocked:()=>true},[p]),[]);
});
test('rejeita retângulo que sobrepõe obstáculo estreito na borda',()=>{
 const p={points:[{x:0,z:440},{x:0,z:510}],width:8};
 const city={preset:{id:'chicago'},isWaterAt:()=>false,isPointBlocked:()=>false,buildingBoxes:[{minX:-22,maxX:-21,minZ:463,maxZ:464}]};
 assert(!Blocks.plan(city,[p]).some(l=>l.x-l.width/2< -21&&l.x+l.width/2> -22&&l.z-l.depth/2<464&&l.z+l.depth/2>463));
 assert(Blocks.plan(city,[p]).every(l=>l.z-l.depth/2>=440));
});
test('corredor norte recebe ocupação contínua sem lotes sobrepostos',()=>{
 const classes=['chicago-ps1-reference-arterial','chicago-ps1-north-candidate-r23','chicago-ps1-eastern-fork-r25'];
 const paths=classes.map(n=>require('../js/world/'+n+'.js').plan());
 const city={preset:{id:'chicago'},isWaterAt:()=>false,isPointBlocked:()=>false,buildingBoxes:[]};
 const lots=Blocks.plan(city,paths);assert(lots.length>=26,`poucos lotes: ${lots.length}`);
 for(let i=0;i<lots.length;i++)for(let j=0;j<i;j++)assert(!(Math.abs(lots[i].x-lots[j].x)<11&&Math.abs(lots[i].z-lots[j].z)<11));
});
