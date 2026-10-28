'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(
    path.join(root,'chicago/manifest.json'),'utf8'));
const footprint=JSON.parse(fs.readFileSync(
    path.join(root,'chicago/ps1-footprint-calibration-r3.json'),'utf8'));
test('R3 usa as extensões ORIGINAIS do mapa, não escala quadrada inventada',()=>{
    assert.equal(footprint.geometryTiles,54);
    assert.equal(manifest.tiles.length,footprint.geometryTiles);
    assert.equal(footprint.originalOBJ.extentX,102.2229);
    assert.equal(footprint.originalOBJ.extentZ,191.4874);
    assert(Math.abs(footprint.originalOBJ.aspectXtoZ-.533836)<1e-6);
    assert.equal(footprint.visualWorldScale,5.1);
    assert.equal(footprint.undercoverCurrentRoadGrid.widthX,640);
    assert.equal(footprint.undercoverCurrentRoadGrid.lengthZ,640);
    assert(footprint.ratioOriginalToProcedural.axisZ>1.5);
    assert(footprint.ratioOriginalToProcedural.axisX<.82);
});
test('relatório permanece honesto: não certifica vias, água ou missões',()=>{
    assert.equal(footprint.streetsCertified,false);
    assert.equal(footprint.shorelineCertified,false);
    assert.equal(footprint.missionsMigrated,false);
    assert.equal(footprint.safeFloorOnly,true);
    assert.equal(footprint.safeFloorPixels,49387);
    assert.match(footprint.warning,/não equivale à área jogável/);
});
test('medidas são reproduzíveis diretamente do manifest publicado',()=>{
    const output=execFileSync(process.execPath,[
        path.join(root,'tools/chicago-r3-footprint.cjs'),'--check'
    ],{cwd:root,encoding:'utf8'});
    assert.match(output,/PASS: PS1 footprint reproduzido/);
});
