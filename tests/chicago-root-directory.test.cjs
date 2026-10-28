'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Chicago PS1 original fica diretamente em chicago/ na raiz',()=>{
    const preview=read('chicago-original-preview.html');
    const streamer=read('js/world/chicago-original-tile-stream.js');
    assert.match(preview,/baseUrl:\s*'\.\/chicago\/'/);
    assert.match(streamer,/baseUrl\s*=\s*'\.\/chicago\/'/);
    assert.doesNotMatch(preview,/\.\/assets\/chicago\//);
    assert.doesNotMatch(streamer,/\.\/assets\/chicago\//);
});

test('instruções de publicação e estrutura de raiz ficam consistentes',()=>{
    const guide=read('chicago/README.md');
    const project=read('README.md');
    assert.match(guide,/manifest\.json/);
    assert.match(guide,/chunks\/\*\.glb/);
    assert.match(project,/chicago\/manifest\.json/);
    assert.doesNotMatch(project,/assets\/chicago\//);
});

test('apenas visualização: não modificar ruas, tráfego, física nem colisores',()=>{
    const streamer=read('js/world/chicago-original-tile-stream.js');
    assert.match(streamer,/chicagoVisualOnly/);
    assert.doesNotMatch(streamer,/buildingBoxes\.push|isPointBlocked\(|roadExtent\s*=/);
});


test('publicação efetiva da Chicago: todos os 54 GLBs do manifesto na raiz',()=>{
    const base=path.join(root,'chicago');
    const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
    assert.equal(manifest.format,'Driver2ChicagoVisualTilesV1');
    assert.equal(manifest.visualOnly,true);
    assert.equal(manifest.collisionReady,false);
    assert.equal(manifest.tiles.length,54);
    const atlas=path.join(base,manifest.atlas);
    assert(fs.statSync(atlas).size>100_000,'Atlas Chicago está ausente ou vazio');
    const urls=new Set();
    for(const tile of manifest.tiles){
        assert.match(tile.url,/^chunks\/[0-9_]+\.glb$/);
        assert(!urls.has(tile.url),'GLB duplicado '+tile.url);
        urls.add(tile.url);
        const entry=path.join(base,tile.url);
        assert(fs.statSync(entry).size>1000,'GLB não encontrado ou vazio: '+tile.url);
    }
});
