'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const North=require('../js/world/chicago-goose-island-north-yard.js');
const River=require('../js/world/chicago-ps1-river-branches.js');
const Road=vm.runInNewContext(read('js/world/road-geometry.js')+
    '\nDriverRoadGeometry',{Math,Number,Map,Set});
const AI=vm.runInNewContext(read('js/traffic/traffic-ai.js')+
    '\nDriverTrafficAI',{
      Math,Number,Map,Set,WeakMap,
      THREE:{MathUtils:{clamp:(v,a,b)=>Math.min(b,Math.max(a,v))}},
      DriverRoadGeometry:Road,
      DriverChicagoGooseIslandNorthYard:North
    });
function city(cityId='chicago'){
 const c={
   preset:{id:cityId},roadExtent:320,buildingBoxes:[],
   chicagoGooseIslandNorthYard:{accessReady:true},
   isPointBlocked(x,z,radius=1.55){
     return this.buildingBoxes.some(b=>x+radius>b.minX&&x-radius<b.maxX&&
       z+radius>b.minZ&&z-radius<b.maxZ);
   },
   isWaterAt(x,z){
     if(cityId!=='chicago')return false;
     return !North.isBridgeDeck(x,z)&&River.waterAt(x,z);
   }
 };
 return c;
}
test('duas faixas do canal norte são dirigíveis sem atravessar água',()=>{
 const c=city();
 assert.equal(North.testSouthbound(c),true);
 assert(Road.segmentDrivable(c,-204,311,-204,244,1.65));
 assert(Road.segmentDrivable(c,-204,249,-240,244,1.65));
 assert.equal(c.isWaterAt(-204,306.3),false);
 assert.equal(c.isWaterAt(-220,306.3),true);
 for(let z=245;z<=315;z+=2)
    assert.equal(c.isWaterAt(-204,z),false,'Água na pista sul '+z);
});
test('caminhão desce sentido contrário e sai pela travessia oeste',()=>{
 const c=city(),ai=new AI(c);
 const truck={gooseIslandSouthbound:true,
    x:-204,z:311,heading:Math.PI,speed:5,
    bodyStyle:'truck'};
 const route=ai.getRoute(truck);
 assert.equal(route.isNorthYardSouth,true);
 assert.equal(route.axis,'z');
 assert.equal(route.sign,-1);
 assert.equal(route.target.x,-204);
 assert.equal(route.target.z,240);
 truck.z=248;
 ai.chooseNext(truck,route,null,false);
 assert.equal(route.isNorthYardSouth,false);
 assert.equal(route.southYardCompleted,true);
 assert.equal(route.axis,'x');
 assert.equal(route.sign,-1);
 assert.equal(route.target.x,-240);
 assert.equal(route.target.z,244);
 assert(Road.segmentDrivable(c,truck.x,truck.z,
   route.target.x,route.target.z,1.65));
});
test('nunca gerar rota de retorno se a ponte estiver inundada ou bloqueada',()=>{
 const c=city();
 assert.equal(North.testSouthbound(c),true);
 const car={gooseIslandSouthbound:true,
    x:-204,z:311,heading:Math.PI};
 const old=c.isWaterAt.bind(c);
 c.isWaterAt=(x,z)=>old(x,z)||
    (Math.abs(x+204)<4&&Math.abs(z-306.3)<2);
 assert.equal(North.testSouthbound(c),false);
 assert.equal(new AI(c).getRoute(car).isNorthYardSouth,undefined);
 c.isWaterAt=old;
 c.buildingBoxes.push({minX:-210,maxX:-201,minZ:289,maxZ:292});
 assert.equal(North.testSouthbound(c),false);
 c.buildingBoxes=[];
 c.chicagoGooseIslandNorthYard.accessReady=false;
 assert.equal(North.testSouthbound(c),false);
});
test('missões, polícia e outras cidades não entram na rota especial',()=>{
 const car={gooseIslandSouthbound:true,
    x:-204,z:311,heading:Math.PI};
 for(const id of ['havana','vegas','rio']){
    assert.equal(new AI(city(id)).getRoute(car).isNorthYardSouth,undefined);
 }
 assert.equal(new AI(city()).getRoute({...car,
    scriptedDrive:{done:false}}).isNorthYardSouth,undefined);
 const source=read('js/engine/driver2-game-engine.js');
 assert.match(source,/name:'RETORNO SUL GOOSE ISLAND'/);
 assert.match(source,/DriverChicagoGooseIslandNorthYard\.testSouthbound/);
 assert.doesNotMatch(read('js/world/chicago-goose-island-north-yard.js'),
    /missionStart\s*=|saveState\s*=|scriptedDrive\s*=/);
});
