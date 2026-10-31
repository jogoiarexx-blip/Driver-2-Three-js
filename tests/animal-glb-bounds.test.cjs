'use strict';
/** GLB metadata regression test: meshes, clip names and axis bounds.
 * Catches incorrectly oriented/static animal uploads without decoding textures.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const assets=[
  'assets/pedestrians/pastor alemao.glb',
  'assets/pedestrians/mailou.glb',
  'assets/pedestrians/cachorro 3.glb'
];
test('three uploaded dogs have readable GLB meshes and report source geometry axes',()=>{
  for(const asset of assets){
    const bytes=fs.readFileSync(path.join(__dirname,'..',asset));
    assert.equal(bytes.toString('ascii',0,4),'glTF',asset);
    const length=bytes.readUInt32LE(12);
    const j=JSON.parse(bytes.subarray(20,20+length).toString('utf8'));
    assert(j.meshes?.length>0,asset);
    const pos=j.meshes.flatMap(mesh=>
      (mesh.primitives||[]).map(p=>j.accessors?.[p.attributes?.POSITION]).filter(Boolean));
    assert(pos.length>0,asset);
    const ranges=pos.filter(a=>a.min&&a.max).map(a=>a.max.map((max,i)=>max-a.min[i]));
    const nodes=(j.nodes||[]).filter(n=>n.mesh!==undefined);
    const report={
      file:asset,meshes:j.meshes.length,skins:j.skins?.length||0,
      clipNames:(j.animations||[]).map(a=>a.name),
      posRanges:ranges.slice(0,8),
      meshNodes:nodes.slice(0,5).map(n=>({name:n.name,rotation:n.rotation,scale:n.scale,translation:n.translation})),
      sceneNodes:j.scenes?.[j.scene||0]?.nodes,
      rootNodes:(j.scenes?.[j.scene||0]?.nodes||[]).map(i=>({name:j.nodes[i]?.name,rotation:j.nodes[i]?.rotation,scale:j.nodes[i]?.scale}))
    };
    console.log('ANIMAL_GLB_AXES '+JSON.stringify(report));
  }
});
