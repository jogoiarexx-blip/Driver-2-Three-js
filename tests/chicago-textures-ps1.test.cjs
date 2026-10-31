'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const repoRoot=require('node:path').join(__dirname,'..');
const operations=[];
const document={
    createElement(type){
        assert.equal(type,'canvas');
        const ownOps=[];
        const ctx={
            globalAlpha:1,fillStyle:'#000',
            fillRect(x,y,w,h){
                assert([x,y,w,h].every(Number.isFinite));
                ownOps.push([x,y,w,h,this.fillStyle,this.globalAlpha]);
            }
        };
        const canvas={
            width:0,height:0,operations:ownOps,
            getContext(type){assert.equal(type,'2d');return ctx;}
        };
        operations.push(canvas);
        return canvas;
    }
};
const THREE={
    CanvasTexture:class {
        constructor(image){this.image=image;this.canvas=image;}
    },
    RepeatWrapping:1000,
    NearestFilter:1001,
    NearestMipmapNearestFilter:1002
};
const src=fs.readFileSync(
    require('node:path').join(repoRoot,'js/render/ps1-texture-factory.js'),'utf8');
const factory=vm.runInNewContext(src+'\nPS1TextureFactory',
    {document,THREE,Math,Number});

test('Chicago tem quatro paletas de fachada 128x256, recicláveis e filtradas',()=>{
    for(let i=0;i<4;i++){
        const tex=factory.createBuildingTexture('#784c3e','#dfb58a','chicago',i);
        assert.equal(tex.image.width,128);
        assert.equal(tex.image.height,256);
        assert.equal(tex.name,'driver2-chicago-facade-'+i);
        assert.equal(tex.magFilter,THREE.NearestFilter);
        assert.equal(tex.minFilter,THREE.NearestMipmapNearestFilter);
        assert.equal(tex.wrapS,THREE.RepeatWrapping);
        assert(tex.image.operations.length>300);
    }
});

test('padrões de janelas, tijolos e reflexos são deterministas',()=>{
    for(let palette=0;palette<4;palette++){
        const a=factory.createBuildingTexture('#784c3e','#dfb58a','chicago',palette);
        const b=factory.createBuildingTexture('#784c3e','#dfb58a','chicago',palette);
        assert.deepEqual(a.image.operations,b.image.operations);
    }
});

test('Chicago não modifica texturas das outras três cidades',()=>{
    for(const city of ['havana','vegas','rio']){
        const tex=factory.createBuildingTexture('#ccaa88','#f6f0db',city,2);
        assert.equal(tex.image.width,64);
        assert.equal(tex.image.height,128);
    }
});

test('textura de asfalto Chicago mantém a cidade sem pintura amarela embutida',()=>{
    const tex=factory.createRoadTexture('chicago');
    const paints=tex.image.operations;
    assert(paints.length>160);
    assert(paints.some(op=>op[4]==='#1f242a'));
    assert(!paints.some(op=>op[4]==='#eab308'));
    assert.equal(tex.needsUpdate,true);
});

test('novo pacote não altera posição dos lotes nem gera novas meshes',()=>{
    const builder=fs.readFileSync(
        require('node:path').join(repoRoot,'js/world/city-builder.js'),'utf8');
    assert.match(builder,/pal\.wall,pal\.win,this\.preset\.id,palette/);
    assert.match(builder,/new THREE\.InstancedMesh\(/);
    const textureCode=src.slice(src.indexOf('static createChicagoFacadeTexture'),
        src.indexOf('// Fundo urbano entre ruas'));
    assert(!/buildingBoxes|districtChunks|cityGroup|geometry|setMatrixAt/.test(textureCode));
});
