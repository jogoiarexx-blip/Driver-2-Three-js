'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('GLB adicionado ao GitHub tem assinatura, dimensões e atlas corretos',()=>{
    const p=path.join(__dirname,'../assets/vehicles/carro_driver2_otimizado.glb');
    assert.ok(fs.existsSync(p),'O carro GLB deve fazer parte do ZIP/repositório');
    const bytes=fs.readFileSync(p);
    assert.equal(bytes.toString('ascii',0,4),'glTF');
    assert.equal(bytes.readUInt32LE(4),2);
    assert.equal(bytes.readUInt32LE(8),bytes.length);
    const len=bytes.readUInt32LE(12);
    const gltf=JSON.parse(bytes.subarray(20,20+len).toString('utf8'));
    assert.ok(gltf.meshes.length>=1);
    const primitive=gltf.meshes[0].primitives[0];
    const coords=gltf.accessors[primitive.attributes.POSITION];
    const size=coords.max.map((x,i)=>x-coords.min[i]);
    assert.ok(size[0]>size[2]*1.8,'Comprimento original tem eixo X');
    assert.ok(size[1]>.2,'O carro nao pode estar achatado');
    assert.ok(gltf.materials.length>0);
    assert.ok(gltf.images?.length>=1,'Textura do GLB está ausente');
    // Comprova que o novo arquivo no GitHub corresponde ao GLB fornecido.
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
      'b692342cd53f519fe39c48c24e62f9f9ef6d9aa65e2be02884aaa50a9e80ae4f');
});

function harness(options={}){
    const calls=[],applied=[];
    let failLoads=options.failLoads||0;
    const template={name:'modelo-repositorio',clone(){
        return {rotation:{y:0},name:this.name};
    }};
    class Group {
        constructor(){this.children=[];this.rotation={y:0};this.userData={}}
        add(c){this.children.push(c)}
        updateMatrixWorld(){}
    }
    class Loader {
        load(url,success,progress,error){
            calls.push(url);
            if(failLoads-->0)error(new Error('offline'));
            else success({scene:template});
        }
    }
    const THREE={Group,GLTFLoader:Loader};
    const document={getElementById:()=>null};
    const paint={prepare:()=>{}};
    const Lib=vm.runInNewContext(
        read('js/assets/free-vehicle-library.js')+'\nFreeVehicleAssets',
        {THREE,document,Math,Number,Promise,indexedDB:undefined,
            DriverUserCarPaint:paint}
    );
    const vehicle={
        bodyStyle:'muscle',name:'BUICK 70 V8',color:0x2563eb,
        root:{parent:{}},_userCustomModel:false,_cc0ModelApplied:false,
        applyCC0Model(scene,shared){
            applied.push({scene,shared});
            this._cc0ModelApplied=shared;
            return true;
        }
    };
    const engine={vehicles:[vehicle],playerCar:vehicle};
    const lib=new Lib(engine);
    return {Lib,lib,calls,applied,vehicle,template};
}
test('o primeiro carregamento prioriza o modelo publicado no GitHub',async()=>{
    const h=harness();
    let storedCalls=0;
    h.Lib.storedBytes=async()=>{storedCalls++;return new ArrayBuffer(32)};
    const template=await h.lib.getUserTemplate();
    assert.equal(template,h.template);
    assert.equal(h.lib.userModelSource,'github');
    assert.equal(storedCalls,0,'Nao utilizar IndexedDB antigo quando o GitHub tem GLB');
    assert.equal(h.calls[0],'./assets/vehicles/carro_driver2_otimizado.glb');
});
test('modelo carregado substitui o carro e orienta a malha para Z',async()=>{
    const h=harness();
    const template=await h.lib.getUserTemplate();
    assert.ok(h.lib.applyDriver2Model(h.vehicle,template));
    assert.equal(h.applied.length,1);
    assert.equal(h.applied[0].shared,true);
    assert.equal(h.applied[0].scene.children.length,1);
    assert.equal(h.applied[0].scene.children[0].rotation.y,Math.PI/2);
    // Com rotação +90° em Y, a frente original em -X vira +Z.
    const yaw=h.applied[0].scene.children[0].rotation.y;
    const frontOriginalX=-1;
    const frontWorldZ=-Math.sin(yaw)*frontOriginalX;
    assert.ok(frontWorldZ>0.99,'Frente do GLB deve acompanhar o avanço +Z');
    assert.equal(h.vehicle._userCustomModel,true);
    assert.ok(h.lib.applyDriver2Model(h.vehicle,template));
    assert.equal(h.applied.length,2,'Nova importação deve substituir, não duplicar');
});
test('erro de rede usa importacao local existente',async()=>{
    const h=harness({failLoads:1});
    let parseCount=0;
    h.Lib.storedBytes=async()=>new ArrayBuffer(8);
    h.Lib.parseGLB=async()=>{parseCount++;return h.template};
    const model=await h.lib.getUserTemplate();
    assert.equal(model,h.template);
    assert.equal(h.lib.userModelSource,'local');
    assert.equal(parseCount,1);
});
test('falha de download pode ser tentada de novo sem reiniciar o jogo',async()=>{
    const h=harness({failLoads:1});
    h.Lib.storedBytes=async()=>null;
    assert.equal(await h.lib.getUserTemplate(),null);
    assert.equal(h.lib.userPromise,null);
    assert.equal(h.lib.userModelSource,'unavailable');
    assert.ok(await h.lib.getUserTemplate());
    assert.equal(h.calls.length,2);
    assert.equal(h.lib.userModelSource,'github');
});
test('carro com caixa inválida não é marcado como GLB aplicado',()=>{
    const h=harness();
    h.vehicle.applyCC0Model=()=>false;
    assert.equal(h.lib.applyDriver2Model(h.vehicle,h.template),false);
    assert.equal(h.vehicle._userCustomModel,false);
});
test('preload carrega GLB antes de preparar shaders externos',()=>{
    const src=read('js/ui/driver-boot-flow.js');
    assert.match(src,/userTemplate=await Promise\.race/);
    assert.ok(src.indexOf('userTemplate=await Promise.race')<
      src.indexOf('const names=[...new Set(game.vehicles'));
    assert.match(src,/library\.decorateFleet\(\)/);
    assert.match(src,/\.filter\(v=>!\(userTemplate && library\.canUseDriver2Model\(v\)\)\)/);
});
test('marcadores de missão não aparecem no meio das avenidas',()=>{
    const city=read('js/world/city-builder.js');
    const road=vm.runInNewContext(read('js/world/road-geometry.js')+
        '\nDriverRoadGeometry',{Math,Number});
    for(const p of [{x:-64,z:-144},{x:16,z:-224}]){
        assert.equal(road.inDrivingLane(p.x,p.z,1.55),false);
        assert.ok(city.includes('x:'+p.x+',z:'+p.z));
    }
});
