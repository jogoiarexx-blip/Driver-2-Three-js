'use strict';
/**
 * R71: per-sector evidence inventory for all original Chicago PS1 GLB tiles.
 * The source OBJ->GLB tiles are VISUAL ONLY. A 3D mesh, ground candidate,
 * and an adapted Undercover route must never be counted as a certified lane.
 */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function build(manifest){
    if(manifest?.format!=='Driver2ChicagoVisualTilesV1'||
        !Array.isArray(manifest.tiles))throw Error('Unexpected Chicago GLB manifest');
    const seen=new Set();
    const sectors=manifest.tiles.map(tile=>{
        if(!/^\d\d_\d\d$/.test(tile.id)||seen.has(tile.id))
            throw Error('Duplicate/invalid sector id: '+tile.id);
        seen.add(tile.id);
        if(tile.url!==`chunks/${tile.id}.glb` ||
           !Number.isSafeInteger(tile.triangles)||tile.triangles<1 ||
           !Number.isSafeInteger(tile.faces)||tile.faces<1 ||
           !Number.isSafeInteger(tile.bytes)||tile.bytes<1 ||
           !Array.isArray(tile.bounds?.min)||
           !Array.isArray(tile.bounds?.max)||
           tile.bounds.min.length!==3||tile.bounds.max.length!==3||
           tile.bounds.min.some((v,i)=>!Number.isFinite(v)||
               v>tile.bounds.max[i]))
            throw Error('Incomplete PS1 tile metadata '+tile.id);
        return {
            id:tile.id,
            meshUrl:'chicago/'+tile.url,
            sourceBounds:tile.bounds,
            visualSource:'manifest-listed',
            triangles:tile.triangles,faces:tile.faces,bytes:tile.bytes,
            gameplayPlacement:'not-calibrated-to-undercover',
            drivingFloor:'not-certified',
            collisions:'not-certified',
            water:'not-certified',
            trafficSigns:'not-certified',
            trafficAI:'not-certified',
            pedestrians:'not-certified',
            missions:'not-certified',
            humanPlaytestE4:'not-run',
            physicalDeviceE5:'not-run'
        };
    }).sort((a,b)=>a.id.localeCompare(b.id));
    const sum=field=>sectors.reduce((n,s)=>n+s[field],0);
    if(sectors.length!==54 ||
       sum('triangles')!==manifest.triangles ||
       sum('faces')!==manifest.faceCount)
        throw Error('Manifest totals do not match 54 original tiles');
    return {
        format:'Driver2ChicagoSectorInventoryR71',
        input:'chicago/manifest.json',
        caveat:'54 original PS1 GLB sectors are available for visualization; none is automatically certified as a drivable Undercover sector.',
        sourceTiles:sectors.length,
        sourceTriangles:sum('triangles'),
        sourceFaces:sum('faces'),
        sourceBytes:sum('bytes'),
        sectorsCertifiedForGameplay:0,
        sectors,
    };
}
if(require.main===module){
    const manifest=JSON.parse(fs.readFileSync(
        path.join(root,'chicago/manifest.json'),'utf8'));
    const result=build(manifest);
    const output=process.argv[2]||path.join(root,
        'qa-artifacts/chicago-r71/sector-inventory.json');
    fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
    fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
    process.stdout.write(JSON.stringify({
        sectors:result.sourceTiles,triangles:result.sourceTriangles,
        certified:result.sectorsCertifiedForGameplay,output})+'\n');
}
module.exports={build};
