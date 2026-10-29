'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
let Plan;try{Plan=require('../js/world/chicago-city-plan.js');}catch{}
test('plano integral representa treze setores, incluindo os três bairros antes ausentes',()=>{
 assert(Plan,'plano de parcelamento precisa existir');
 assert.equal(Plan.DISTRICTS.length,13);
 const seen=new Set();
 for(let x=-400;x<=400;x+=10)for(let z=-400;z<=400;z+=10){
  const d=Plan.districtAt(x,z);assert(d);seen.add(d.id);
 }
 assert.equal(seen.size,13);
 for(const id of ['goose-island','wicker-park','ukrainian-village'])assert(seen.has(id));
});
test('lotes são deterministas, variam por bairro e mantêm ruas livres',()=>{
 assert(Plan);
 const styles=new Set();let count=0;
 for(let x=-280;x<=280;x+=80)for(let z=-360;z<=280;z+=80){
  if(Plan.isProtected(x,z))continue;
  const a=Plan.lots(x,z);assert.deepEqual(a,Plan.lots(x,z));
  for(const b of a){
   count++;styles.add(b.kind);
   assert(b.width>0&&b.depth>0&&b.height>0);
   assert(Math.abs(b.x-x)+b.width/2<=22.01);
   assert(Math.abs(b.z-z)+b.depth/2<=22.01);
   assert.equal(b.planned,true);
  }
 }
 assert(count>40);assert(styles.size>=4);
 assert(Plan.lots(280,200).length===0,'Lincoln Park não recebe torre');
});
test('locais interativos e centros das missões não são substituídos',()=>{
 assert(Plan);
 for(const [x,z] of [[-120,-120],[120,120],[200,-200],[-200,-200],[120,-280],[-280,200],[-40,-280],[280,-280],[-280,-280]])
  assert(Plan.isProtected(x,z),x+','+z);
 assert(!Plan.isProtected(-280,120));
});
test('instâncias e colisores usam a mesma planta, sem torre invisível no pátio',()=>{
 assert(Plan);
 const city={preset:{id:'chicago',palettes:[{},{},{},{}]},
  districtChunks:new Map(),districtBuildings:[],buildingBoxes:[]};
 Plan.addBlock(city,-280,120);
 assert.equal(city.districtBuildings.length,6);
 assert.equal(city.buildingBoxes.length,6);
 city.districtBuildings.forEach((b,i)=>{
  const box=city.buildingBoxes[i];
  assert.equal(box.maxX-box.minX,b.width);
  assert.equal(box.maxZ-box.minZ,b.depth);
 });
 assert(!city.buildingBoxes.some(b=>-280>b.minX&&-280<b.maxX&&120>b.minZ&&120<b.maxZ));
});
test('aeródromo é físico no Undercover, sem pousar pista sobre água ou avenida',()=>{
 assert(Plan);
 assert.equal(typeof Plan.buildLandmarks,'function');
 const spec=Plan.AIRFIELD;
 assert(spec.length>100);
 const Coast=require('../js/world/chicago-ps1-coastline.js');
 for(let z=spec.z-spec.length/2;z<=spec.z+spec.length/2;z+=2)
  for(const x of [spec.x-spec.width/2,spec.x+spec.width/2])
   assert(!Coast.waterAt(x,z));
});
test('becos só se tornam vias quando o corredor inteiro está seco e sem colisão',()=>{
 assert.equal(typeof Plan.courtyardLinks,'function');
 const city={chicagoCityPlan:{blocks:[{x:-280,z:120,kind:'residential'}]},
  isWaterAt:(x,z)=>x<-310,
  isPointBlocked:(x,z,r)=>x> -250};
 const links=Plan.courtyardLinks(city);
 assert.equal(links.length,0,'água a oeste e edifício a leste proíbem ambos os acessos');
 city.isWaterAt=()=>false;city.isPointBlocked=()=>false;
 assert.equal(Plan.courtyardLinks(city).length,2);
});
test('calçada inteira deve caber em terra: centro seco do píer não basta',()=>{
 assert.equal(typeof Plan.allowsSidewalk,'function');
 assert.equal(Plan.allowsSidewalk(360,-40),false,'deck estreito não autoriza bloco 50x50');
 assert.equal(Plan.allowsSidewalk(360,280),false,'canto ultrapassa a costa norte');
 assert.equal(Plan.allowsSidewalk(360,360),false);
 assert.equal(Plan.allowsSidewalk(280,200),true);
});
test('pedestres usam centros das calçadas, não centros deslocados dos sublotes',()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const Road=vm.runInNewContext(fs.readFileSync('js/world/road-geometry.js','utf8')+'\nDriverRoadGeometry',{Math,Number});
 const Nav=vm.runInNewContext(fs.readFileSync('js/entities/pedestrian-sidewalk-nav.js','utf8')+'\nDriverPedestrianSidewalks',
  {Math,Number,Array,DriverRoadGeometry:Road});
 const blocks=[{x:40,z:-40},{x:120,z:-40}];
 const city={preset:{id:'chicago',palettes:[{},{},{},{}]},
  districtChunks:new Map(),districtBuildings:[],buildingBoxes:[],
  sidewalkGrid:new Set(blocks.map(b=>b.x+':'+b.z)),
  isWaterAt:()=>false,isOnSidewalk:()=>true,isTrafficGreen:()=>false,getTrafficPhase:()=>2,
  isPointBlocked(x,z,r){return this.buildingBoxes.some(b=>x+r>b.minX&&x-r<b.maxX&&z+r>b.minZ&&z-r<b.maxZ);}};
 blocks.forEach(b=>Plan.addBlock(city,b.x,b.z));
 const chosen=Nav.pick(city,{x:40,z:-40},28);
 assert.equal(chosen.length,28,'subdividir lotes não pode remover a população');
 assert(chosen.every(b=>blocks.some(p=>p.x===b.x&&p.z===b.z)));
 const route=Nav.route(blocks[0]);
 const cross=Nav.crossingPlan({block:blocks[0],x:route[1].x,z:route[1].z},1,city);
 assert(cross,'travessia deve encontrar a quadra vizinha, apesar dos sublotes');
 assert.equal(cross.block.x,120);
});
