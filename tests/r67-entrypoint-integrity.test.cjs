'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const entries=[...html.matchAll(/<script\b[^>]*?\bsrc=["']([^"']+)["']/gi)]
    .map(m=>m[1]);
const locals=entries.filter(url=>!/^https?:\/\//i.test(url));
test('todos os scripts locais do jogo existem e ficam dentro do repositório',()=>{
    assert(locals.length>100,'bootstrap should retain the existing game modules');
    const seen=new Set();
    for(const url of locals){
        const part=decodeURIComponent(url.split(/[?#]/)[0]);
        const absolute=path.resolve(root,part);
        assert(absolute.startsWith(root+path.sep),
            'script path escapes repository: '+url);
        assert(fs.statSync(absolute).isFile(),'missing local game script: '+url);
        assert(!seen.has(absolute),'duplicate script load: '+url);
        seen.add(absolute);
    }
});
test('recursos compartilhados da GPU carregam antes do construtor de cidades',()=>{
    const names=locals.map(x=>x.split('?')[0]);
    const gpu=names.findIndex(x=>x.endsWith('/gpu-resources.js'));
    const city=names.findIndex(x=>x.endsWith('/city-builder.js'));
    const engine=names.findIndex(x=>x.endsWith('/driver2-game-engine.js'));
    assert(gpu>=0&&city>=0&&engine>=0);
    assert(gpu<city&&city<engine);
});
