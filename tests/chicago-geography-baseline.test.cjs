'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {audit,inspectOBJ}=require('../tools/chicago-geo-audit.cjs');
const data=audit();

test('auditoria não atribui fidelidade sem referência PS1 registrada',()=>{
    assert.equal(data.referenceGeometryRegistered,false);
    assert.equal(data.metrics.territorialCoveragePercent,null);
    assert.equal(data.metrics.geometricFidelityPercent,null);
    assert.equal(data.metrics.roadRecall,null);
});
test('setores atuais: 13 placas não comprovam fidelidade territorial',()=>{
    assert.equal(data.neighborhoods.referenceCount,13);
    assert.equal(data.neighborhoods.declaredMarkers.length,13);
    assert.deepEqual(data.neighborhoods.missingMarkers,[]);
    assert.equal(data.neighborhoods.markerCoveragePercent,100);
});
test('a grade teórica e as camadas de água atuais são detectadas',()=>{
    assert.equal(data.code.step,80);
    assert.equal(data.code.roadHalf,12);
    assert.equal(data.code.roadExtent,320);
    assert.equal(data.code.worldLimit,410);
    assert.equal(data.code.theoreticalGridNodes,81);
    assert.equal(data.code.proceduralCells,71);
    assert.equal(data.code.river.canalWaterSample,true);
    assert.equal(data.code.river.eastWaterSample,true);
    assert.equal(data.code.river.eastBridgeWaterSample,false);
});
test('não confundir grafo sem colisão real com replay de direção',()=>{
    assert.equal(data.topology.actualVehicleNavigationValidated,false);
    assert.match(data.topology.caveat,/AABB/);
    assert(data.topology.waterOnlyNoBuildings.edges>0);
});
test('Navy Pier e Meigs não estão certificados como acessíveis',()=>{
    assert.equal(data.navyPier.verifiedRoadConnection,false);
    assert.equal(data.navyPier.visualOnly,true);
    assert(data.navyPier.deckMinX>data.code.roadExtent);
    assert(data.navyPier.deckMaxX>data.code.worldLimit);
    assert.equal(data.meigs.runwayVerified,false);
});
test('OBJ opcional só produz estatística de vértices, nunca fidelidade fictícia',()=>{
    const filename=path.join(os.tmpdir(),'chicago-audit-'+process.pid+'.obj');
    try{
        fs.writeFileSync(filename,'v 0 0 0\nv 1 2 3\nv -3 4 5\nf 1 2 3\n');
        const info=inspectOBJ(filename);
        assert.equal(info.vertexCount,3);
        assert.equal(info.faceCount,1);
        assert.deepEqual(info.bounds.min,[-3,0,0]);
        assert.deepEqual(info.bounds.max,[1,4,5]);
        assert.equal(info.geometricFidelityPercent,null);
    }finally{fs.rmSync(filename,{force:true});}
});