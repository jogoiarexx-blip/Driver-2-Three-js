#!/usr/bin/env node
/**
 * Dimensão medível da cidade do Driver 2 PS1 a partir do manifest que veio
 * dos GLBs originais. NÃO converte pixels de piso em ruas certificadas.
 * Saída: chicago/ps1-footprint-calibration-r3.json.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(
    path.join(root,'chicago/manifest.json'),'utf8'));
const drive=JSON.parse(fs.readFileSync(
    path.join(root,'chicago/drive-mask.json'),'utf8'));
if(manifest.format!=='Driver2ChicagoVisualTilesV1'||
   drive.format!=='Driver2ChicagoDriveMaskV1'||
   manifest.tiles.length!==54||drive.tiles!==54)
    throw Error('É necessária a geometria PS1 completa para calibração');
const m=manifest.bounds;
const extentX=m.max[0]-m.min[0];
const extentZ=m.max[2]-m.min[2];
const scale=5.1;
const originalWorld={widthX:extentX*scale,lengthZ:extentZ*scale};
const cityRoadGrid={widthX:640,lengthZ:640,step:80};
const result={
    format:'Driver2ChicagoOriginalFootprintCalibrationR3',
    evidence:'chicago/manifest.json from supplied original PS1 GLB geometry',
    geometryTiles:manifest.tiles.length,
    originalOBJ:{
        minX:m.min[0],maxX:m.max[0],minZ:m.min[2],maxZ:m.max[2],
        extentX:Number(extentX.toFixed(4)),
        extentZ:Number(extentZ.toFixed(4)),
        aspectXtoZ:Number((extentX/extentZ).toFixed(6))
    },
    visualWorldScale:scale,
    projectedWorldAtCurrentScale:{
        extentX:Number(originalWorld.widthX.toFixed(3)),
        extentZ:Number(originalWorld.lengthZ.toFixed(3))
    },
    undercoverCurrentRoadGrid:cityRoadGrid,
    ratioOriginalToProcedural:{
        axisX:Number((originalWorld.widthX/cityRoadGrid.widthX).toFixed(4)),
        axisZ:Number((originalWorld.lengthZ/cityRoadGrid.lengthZ).toFixed(4))
    },
    safeFloorPixels:drive.safePixels,
    safeFloorOnly:true,
    streetsCertified:false,
    shorelineCertified:false,
    missionsMigrated:false,
    recommendedNextStep:'Trace traversable streets and waterways from original PS1 geometry, then remap story nodes without nonuniformly scaling all assets.',
    warning:'A caixa do modelo inclui extensões e recortes não dirigíveis. Não equivale à área jogável, nem comprova a fidelidade do rio.'
};
const target=path.join(root,'chicago/ps1-footprint-calibration-r3.json');
if(process.argv.includes('--check')){
    const baseline=JSON.parse(fs.readFileSync(target,'utf8'));
    if(JSON.stringify(baseline)!==JSON.stringify(result))
        throw Error('Baseline PS1 R3 diverge da geometria original');
    console.log('PASS: PS1 footprint reproduzido.');
}else{
    fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result,null,2));
}
