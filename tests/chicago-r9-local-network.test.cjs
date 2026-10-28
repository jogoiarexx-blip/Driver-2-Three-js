'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const River=require('../js/world/chicago-ps1-river-branches.js');
const North=require('../js/world/chicago-goose-island-north-yard.js');
const Network=require('../js/world/chicago-local-road-network.js');
const Road=vm.runInNewContext(read('js/world/road-geometry.js')+
    '\nDriverRoadGeometry',{Math,Number,Map,Set});
global.DriverRoadGeometry=Road;
global.DriverChicagoGooseIslandNorthYard=North;
function city(name='chicago'){
    const c={preset:{id:name},
        buildingBoxes:[],roadExtent:320,
        chicagoGooseIslandStreet:{accessReady:true},
        chicagoGooseIslandNorthYard:{accessReady:true},
        isPointBlocked(x,z,r=1.55){
            return this.buildingBoxes.some(b=>
                x+r>b.minX&&x-r<b.maxX&&z+r>b.minZ&&z-r<b.maxZ);
        },
        isWaterAt(x,z){
            if(name!=='chicago')return false;
            if(North.isBridgeDeck(x,z))return false;
            return River.waterAt(x,z);
        }};
    return c;
}
test('grafo R9 verifica os 10 trechos físicos, com 3 fluxos dirigidos',()=>{
    const c=city(),report=Network.build(c);
    assert.equal(report.format,'Driver2ChicagoLocalRoadAuditR9');
    assert.equal(report.segmentsChecked,10);
    assert.equal(report.flows.length,3);
    assert.equal(report.flowsAvailable,3);
    assert.equal(report.allFlowRoutesAvailable,true);
    assert.equal(report.blocked.length,0);
    assert(report.flows.every(f=>f.segments.every(e=>e.valid)));
    assert.equal(c.chicagoLocalRoadNetwork,report);
    assert.equal(report.originalPS1RoadsCertified,false);
    assert.equal(report.missionsMigrated,false);
});
test('se o rio bloquear uma faixa R6, não certificar fluxo nem inventar desvios',()=>{
    const c=city(),original=c.isWaterAt.bind(c);
    c.isWaterAt=(x,z)=>original(x,z)||
        (Math.abs(x+196)<3&&Math.abs(z-278)<4);
    const r=Network.audit(c);
    assert.equal(r.flowsAvailable,2);
    assert.equal(r.allFlowRoutesAvailable,false);
    assert(r.blocked.some(s=>s.startsWith('island-north-east:')));
    assert(r.flows.find(f=>f.id==='west-island-east').available);
});
test('se a ponte sul for bloqueada, somente o retorno perde autorização',()=>{
    const c=city();
    c.buildingBoxes.push({minX:-211,maxX:-201,minZ:270,maxZ:274});
    const r=Network.audit(c);
    assert.equal(r.flows.find(f=>f.id==='north-south-west').available,false);
    assert(r.flows.find(f=>f.id==='west-island-east').available);
});
test('isolamento das outras cidades e dos pontos de missão',()=>{
    for(const name of ['rio','vegas','havana']){
        const c=city(name);
        assert.equal(Network.audit(c),null);
        assert.equal(Network.build(c),null);
        assert.equal(c.chicagoLocalRoadNetwork,undefined);
    }
    const src=read('js/world/chicago-local-road-network.js');
    assert.doesNotMatch(src,/missionStart\s*=|saveState\s*=|playerCar\s*=/);
    const html=read('index.html');
    assert(html.indexOf('chicago-local-road-network.js')<
        html.indexOf('city-builder.js'));
    const builder=read('js/world/city-builder.js');
    assert.match(builder,/DriverChicagoLocalRoadNetwork\.build\(this\)/);
});
