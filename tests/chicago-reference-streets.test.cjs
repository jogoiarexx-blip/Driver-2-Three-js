'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),zlib=require('node:zlib'),crypto=require('node:crypto');
const data=JSON.parse(fs.readFileSync('chicago/reference-street-survey.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('chicago/manifest.json','utf8'));
test('referência de pavimentação abrange todos os 54 arquivos originais com hashes verificáveis',()=>{
 assert.equal(data.tilesRead,54);assert.equal(data.trianglesRead,manifest.triangles);
 assert.equal(data.tiles.length,54);
 for(const t of data.tiles){
  const m=manifest.tiles.find(m=>m.id===t.id);assert(m);
  const sha=crypto.createHash('sha256').update(fs.readFileSync('chicago/'+m.url)).digest('hex');
  assert.equal(t.sha256,sha,t.id);
 }
});
test('pisos pintados, pavimentos, grama e água não são fundidos numa rua fictícia',()=>{
 assert.equal(data.streetsCertified,false);assert.equal(data.navigationCertified,false);
 assert.equal(data.missionsMigrated,false);
 for(const layer of Object.values(data.layers)){
  const bytes=zlib.gunzipSync(Buffer.from(layer.gzipBitsetBase64,'base64'));
  assert.equal(bytes.length,Math.ceil(data.width*data.height/8));
  let pixels=0;for(let i=0;i<data.width*data.height;i++)pixels+=(bytes[i>>>3]>>>(7-(i&7)))&1;
  assert.equal(pixels,layer.pixels);
 }
 assert(data.layers.markedPaving.pixels>50000);
 assert(data.layers.grass.pixels>50000);
 assert(data.layers.water.pixels<data.layers.markedPaving.pixels,
   'ausência de água na fonte não pode ser preenchida como ruas');
});
