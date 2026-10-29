'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const Coast=require('../js/world/chicago-ps1-coastline.js');
let Lake;try{Lake=require('../js/world/chicago-undercover-lakefront.js');}catch{}
test('avenida curva permanece seca e conecta quatro avenidas existentes',()=>{
 assert(Lake,'módulo geográfico do Undercover');
 assert.equal(Lake.links().length,4);
 for(let z=80;z<=320;z+=2){
  const x=Lake.axisX(z);
  assert(Coast.shoreX(z)-x>=15);
  for(const side of [-6.3,0,6.3])assert(!Coast.waterAt(x+side,z));
 }
 for(const link of Lake.links()){
  assert.equal(link.from.x,320);assert.equal(link.to.x,Lake.axisX(link.from.z));
 }
 assert.notEqual(Lake.axisX(80),Lake.axisX(320));
});
test('libera somente quarteirões da orla norte e organiza Lincoln Park',()=>{
 assert(Lake);
 for(const z of [120,200,280]){
  assert(Lake.isCarvedBlock(360,z));assert(Lake.isParkBlock(280,z));
 }
 for(const [x,z] of [[120,120],[-120,-120],[200,-200],[-280,200],[280,-280]]){
  assert(!Lake.isCarvedBlock(x,z));assert(!Lake.isParkBlock(x,z));
 }
 const src=fs.readFileSync('js/world/city-builder.js','utf8');
 assert(src.includes('DriverChicagoUndercoverLakefront.isCarvedBlock(blockX,blockZ)'));
 assert(src.includes('DriverChicagoUndercoverLakefront.isParkBlock(blockX,blockZ)'));
 assert(src.includes('DriverChicagoUndercoverLakefront.build(this)'));
});
