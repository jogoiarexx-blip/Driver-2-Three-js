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
