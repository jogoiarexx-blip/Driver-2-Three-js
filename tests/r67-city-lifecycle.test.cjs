'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=path=>fs.readFileSync(path,'utf8');
const gpuSrc=read('js/engine/gpu-resources.js');
const citySrc=read('js/world/city-builder.js');
const gpu=vm.runInNewContext(gpuSrc+';GPUResourceUtils');
const disposes=()=>({count:0,dispose(){this.count++}});
const mesh=(g,m)=>({geometry:g,material:m,children:[],userData:{}});
const group=(children=[],userData={})=>({
    userData,children,clear(){this.children=[];}
});
function getCity(withGpu=true,frame=null){
    const globals={CITY_PRESETS:{chicago:{id:'chicago'},havana:{id:'havana'}},
        requestAnimationFrame:frame||((cb)=>cb(0))};
    if(withGpu)globals.GPUResourceUtils=gpu;
    return vm.runInNewContext(citySrc+';CityBuilder',globals);
}
test('city reset releases owned resources but preserves cached GLB descendants',()=>{
    const City=getCity(true),state=Object.create(City.prototype);
    const shared={geo:disposes(),mat:disposes(),tex:disposes()};
    shared.tex.isTexture=true;shared.mat.map=shared.tex;
    const owned={geo:disposes(),mat:disposes(),tex:disposes()};
    owned.tex.isTexture=true;owned.mat.map=owned.tex;
    const cachedRoot=group([group([mesh(shared.geo,shared.mat)])],
        {cc0SharedAsset:true});
    const oldObjects=group([cachedRoot,mesh(owned.geo,owned.mat)]);
    state.cityGroup=oldObjects;state.buildSequence=0;
    state.resetCityForPreset('havana');
    assert.equal(owned.geo.count,1);
    assert.equal(owned.mat.count,1);
    assert.equal(owned.tex.count,1);
    assert.equal(shared.geo.count,0,'GLB geometry shared between clones');
    assert.equal(shared.mat.count,0,'shared template material');
    assert.equal(shared.tex.count,0,'shared GLB texture');
    assert.equal(state.cityGroup.children.length,0);
    assert.equal(state.preset.id,'havana');
});
test('fallback without GPU helper still respects shared root and its descendants',()=>{
    const City=getCity(false),state=Object.create(City.prototype);
    const keep=disposes(),drop=disposes();
    state.cityGroup=group([
        group([group([mesh(keep,disposes())])],{cc0SharedAsset:true}),
        mesh(drop,disposes())
    ]);
    state.buildSequence=0;
    state.resetCityForPreset('havana');
    assert.equal(keep.count,0);
    assert.equal(drop.count,1);
});
test('old progressive load is cancelled on a newer city reset, with no stale ready',async()=>{
    const frames=[],City=getCity(true,cb=>{frames.push(cb);});
    const state=Object.create(City.prototype);
    state.buildSequence=0;state.ready=false;
    state.resetCityForPreset=function(city){
        this.buildSequence++;this.ready=false;this.preset={id:city};
    };
    let count=0;
    state.buildEnvironmentStages=function*(){
        count++;yield 'Primeiro';
        count++;yield 'Segundo';
    };
    const events=[];
    const pending=state.loadCityPresetProgressive('chicago',(fraction,label)=>
        events.push({fraction,label}));
    assert.equal(frames.length,1);
    state.resetCityForPreset('havana');
    frames.shift()(0);
    assert.equal(await pending,false);
    assert.equal(count,1,'generator must not rebuild the second stage');
    assert.equal(state.preset.id,'havana');
    assert.equal(state.ready,false);
    assert(!events.some(e=>e.fraction===1));
});
test('uninterrupted progressive loading completes and reports full progress',async()=>{
    const frames=[],City=getCity(true,cb=>{frames.push(cb);});
    const state=Object.create(City.prototype);
    state.buildSequence=0;state.ready=false;
    state.resetCityForPreset=function(city){
        this.buildSequence++;this.ready=false;this.preset={id:city};
    };
    state.buildEnvironmentStages=function*(){
        yield 'Base';yield 'Prédios';
    };
    const events=[];
    const promise=state.loadCityPresetProgressive('chicago',(fraction,label)=>
        events.push({fraction,label}));
    while(frames.length){frames.shift()(0);await Promise.resolve();}
    assert.equal(await promise,true);
    assert.equal(state.ready,true);
    assert.equal(events.at(-1).fraction,1);
});
