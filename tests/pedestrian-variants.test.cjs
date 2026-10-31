'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path');
const Roster=vm.runInNewContext(
    fs.readFileSync('js/assets/driver-pedestrian-variants.js','utf8')+
    '\nDriverPedestrianVariants', {});

test('13 variantes e dois modelos base ocupam 15 vagas diferentes',()=>{
    const defs=Roster.DEFINITIONS;
    assert.equal(defs.length,13);
    assert.equal(new Set(defs.map(d=>d.pedestrianIndex)).size,13);
    assert.equal(new Set(defs.map(d=>d.url)).size,13);
    assert.deepEqual(Array.from(defs,d=>d.pedestrianIndex),[2,3,4,5,6,7,8,9,10,11,12,13,14]);
    for(const d of defs){
        assert(d.pedestrianIndex>=2&&d.pedestrianIndex<28);
        assert.equal(d.textureMaxSize,1024);
        const file=decodeURIComponent(d.url.replace(/^\.\//,''));
        const bytes=fs.readFileSync(path.join(__dirname,'..',file));
        assert.equal(bytes.toString('ascii',0,4),'glTF',d.id);
        assert.equal(bytes.readUInt32LE(4),2,d.id);
        assert.equal(bytes.readUInt32LE(8),bytes.length,d.id);
        const j=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
        assert(Array.isArray(j.nodes)&&j.nodes.length>0,d.id);
        if(d.pedestrianIndex<=4){
            assert(j.skins?.length>0,d.id);
            assert(j.animations?.some(a=>a.name===d.walkName),d.id);
            assert(j.animations.some(a=>a.name==='Running'),d.id);
        }else{
            assert.equal(d.allowStatic,true);
            assert.equal(d.allowAnyAnimation,true);
        }
    }
});

test('crianças são menores que adultos e pastor maior que os outros cães',()=>{
    const defs=Roster.DEFINITIONS;
    const children=defs.filter(d=>d.species==='child');
    const dogs=defs.filter(d=>d.species==='dog');
    assert.equal(children.length,2);
    assert.equal(dogs.length,3);
    assert(children.every(d=>d.height>=1.1&&d.height<=1.4));
    assert(children.every(d=>d.height<defs[0].height));
    const shepherd=dogs.find(d=>d.id==='german-shepherd');
    assert(shepherd);
    assert(dogs.filter(d=>d!==shepherd).every(d=>d.height<shepherd.height));
    assert(dogs.every(d=>d.height<children[0].height));
});

test('GLBs são entregues progressivamente e usam o mesmo adaptador de rig',async()=>{
    const loaded=[],fills=[];
    class DummyAdapter{
        constructor(manager,config){this.config=config;this.state='pending';}
        async load(){this.state='ready';loaded.push(this.config.id);}
        attachToPedestrian(){}
        release(){}
        update(){}
        status(){return {id:this.config.id,state:this.state};}
    }
    const ctx=vm.createContext({DriverMalePedestrian:DummyAdapter});
    const R=vm.runInContext(fs.readFileSync('js/assets/driver-pedestrian-variants.js','utf8')+
        '\nDriverPedestrianVariants',ctx);
    const manager={uploadedCrowd:{fill(){fills.push(loaded.length);}}};
    const roster=new R(manager);
    assert.equal(await roster.load(),true);
    assert.equal(loaded.length,13);
    assert.equal(loaded.slice(0,5).join(','),
        'girl,boy,german-shepherd,dog-mailou,dog-3');
    assert.equal(fills.length,13);
    assert.equal(fills[0],1);
    assert.equal(fills[12],13);
});
