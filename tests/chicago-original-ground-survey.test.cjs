'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const reference=JSON.parse(read('chicago/ground-survey.json'));
const manifest=JSON.parse(read('chicago/manifest.json'));

test('pesquisa de solo usa todos os setores originais publicados',()=>{
    assert.equal(reference.format,'Driver2ChicagoGroundSurveyV1');
    assert.equal(reference.sourceFormat,manifest.format);
    assert.equal(reference.tilesRead,54);
    assert.equal(reference.tilesRead,manifest.tiles.length);
    assert.equal(reference.trianglesScanned,
        manifest.tiles.reduce((sum,t)=>sum+t.triangles,0));
    for(const tile of manifest.tiles)
        assert(fs.statSync(path.join(root,'chicago',tile.url)).size>1000);
});

test('piso planar, mapa e componentes medidos em unidades OBJ, não metros',()=>{
    assert.equal(reference.groundTriangleCount,269865);
    assert.equal(reference.raisedTriangleCount,36203);
    assert.equal(reference.widthPixels,411);
    assert.equal(reference.heightPixels,768);
    assert.equal(reference.pixelSizeOBJ,.25);
    assert.equal(reference.groundRasterPixels,79395);
    assert.equal(reference.surfaceRasterComponents,20);
    assert.equal(reference.largestSurfaceComponentsPixels[0],78262);
    assert.equal(reference.groundDefinition.maxAbsMeanY,.028);
    assert(reference.rasterGroundFillFraction>0 &&
        reference.rasterGroundFillFraction<1);
});

test('não declarar malha dirigível ou fidelidade com base em pixels de piso',()=>{
    assert.equal(reference.laneNetworkCertified,false);
    assert.equal(reference.vehicleCollisionCertified,false);
    assert.equal(reference.playableCoveragePercent,null);
    assert.equal(reference.roadLengthMeters,null);
    assert.match(reference.warning,/não é rede viária dirigível/);
});

test('a extração reprodutível não modifica física nem inventa ruas',()=>{
    const program=read('tools/chicago-ground-survey.py');
    assert.match(program,/Driver2ChicagoGroundSurveyV1/);
    assert.match(program,/load_glb_triangles/);
    assert.match(program,/connectedComponentsWithStats/);
    assert.match(program,/triangle|triangles/i);
    assert.doesNotMatch(program,/buildingBoxes\.push|roadExtent\s*=|isPointBlocked\(/);
});
