'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=location=>fs.readFileSync(path.join(root,location),'utf8');
const source=read('js/assets/free-vehicle-library.js');
const uploaded=read('js/assets/uploaded-vehicles.js');
const vehicleSource=read('js/vehicles/driver-vehicle.js');

class Group {
    constructor(){this.children=[];this.rotation={y:0};this.visible=true;}
    add(child){this.children.push(child);}
    updateMatrixWorld(){}
}
const template={clone(){return {rotation:{y:0}};}};
class Uploaded {
    static DEFINITIONS={
        'pickup-new':{url:'./assets/vehicles/caminhonete-nova-otimizada.glb'},
        'pickup-old':{url:'./assets/vehicles/caminhonete%20velha.glb'},
        motorcycle:{url:'./assets/vehicles/moto-otimizada.glb'},
        'school-bus':{url:'./assets/vehicles/onibus%20escolar.glb'},
        boat:{url:'./assets/barco%20de%20pesca.glb'}
    };
    constructor(){this.requested=[];this.decorated=[];}
    getTemplate(id){this.requested.push(id);return Promise.resolve(template);}
    decorate(car){this.decorated.push(car);car._cc0ModelApplied=true;}
    attachBoat(){}
}
const Type=vm.runInNewContext(source+';FreeVehicleAssets',{
    Math,THREE:{Group},DriverUploadedVehicles:Uploaded,
    DriverUserCarPaint:{prepare(){}},
    document:{getElementById(){return null;}}
});
function car(bodyStyle='muscle',other={}){
    return {name:'CIVIL',bodyStyle,x:0,z:0,
        root:{parent:{}},chassisTilt:{visible:false},
        applyCC0Model(){this._cc0ModelApplied=true;this.chassisTilt.visible=true;return true;},
        showProceduralFallback(){this.emergency=true;},
        ...other};
}
function library(cars){
    return new Type({vehicles:cars,playerCar:cars[0]});
}
test('todos os veículos são ligados aos GLBs locais, inclusive alvo, secreto e limusine',()=>{
    const cars=[
        car('muscle'),car('muscle',{isTarget:true}),
        car('muscle',{isSecret:true}),car('limo'),
        car('muscle',{isPolice:true}),car('truck',{x:10,z:14}),
        car('bus'),car('motorcycle'),car('truck',{x:19,z:26})
    ];
    const l=library(cars);
    const keys=cars.map(v=>l.getModelName(v));
    assert.deepEqual(Array.from(keys.slice(0,5)),
        ['driver2','driver2','driver2','driver2','police']);
    assert.ok(keys[5]==='pickup-old'||keys[5]==='pickup-new');
    assert.equal(keys[6],'school-bus');
    assert.equal(keys[7],'motorcycle');
    assert.ok(keys[8].startsWith('pickup-'));
    assert.equal(l.canUseDriver2Model(cars[1]),true);
    assert.equal(l.canUseDriver2Model(cars[2]),true);
    assert.equal(l.canUseDriver2Model(cars[3]),true);
});
test('a frota automática não usa CDN externo nem botão PS1',()=>{
    assert.doesNotMatch(source,/cdn\.jsdelivr\.net\/gh\/Hidencod/);
    assert.doesNotMatch(source,/sedan-sports\.glb|race\.glb|hatchback-sports\.glb/);
    const l=library([]);
    l.toggle();
    assert.equal(l.enabled,true);
    assert.match(source,/GLB LOCAL/);
    assert.match(source,/decorateRepositoryFallback/);
    assert.match(vehicleSource,/hideProceduralBody\(\)/);
    assert.match(vehicleSource,/this\.chassisTilt\.visible=true/);
});
test('modelo principal, policiais e veículos pesados recebem GLB sem modificar a física',async()=>{
    const cars=[
        car('muscle'),car('muscle',{isSecret:true}),car('limo'),
        car('muscle',{isPolice:true}),car('truck'),car('bus'),car('motorcycle')
    ];
    const l=library(cars);
    l.getUserTemplate=()=>Promise.resolve(template);
    l.getPoliceTemplate=()=>Promise.resolve(template);
    l.decorateFleet();
    await Promise.resolve();await Promise.resolve();
    assert.ok(cars.slice(0,4).every(v=>v._cc0ModelApplied));
    assert.ok(cars.slice(4).every(v=>v._cc0ModelApplied));
    assert.equal(cars[3]._policeCustomModel,true);
    assert.ok(cars.slice(0,3).every(v=>v._userCustomModel));
    assert.equal(l.uploaded.requested.length,3);
    assert.ok(cars.every(v=>v.chassisTilt.visible),
        'cada categoria deve estar visível pelo próprio GLB local');
});
test('falha de um modelo tenta outro GLB local antes do fallback de emergência',async()=>{
    const vehicle=car('muscle'),l=library([vehicle]);
    l.getScene=id=>Promise.resolve(id==='pickup-new'?template:null);
    l.decorateRepositoryFallback(vehicle,'driver2');
    await Promise.resolve();await Promise.resolve();
    assert.equal(vehicle._uploadedCustomModel,'pickup-new');
    assert.equal(vehicle._cc0ModelApplied,true);
    assert.equal(vehicle.emergency,undefined);
    const other=car('bus'),a=library([other]);
    a.getScene=()=>Promise.resolve(null);
    a.decorateRepositoryFallback(other,'school-bus');
    await Promise.resolve();await Promise.resolve();
    assert.equal(other.emergency,true);
    assert.equal(other._modelLoadFailed,true);
});
test('GLBs apontados pelo catálogo existem na pasta do próprio repositório',()=>{
    const local=[
        'assets/vehicles/carro_driver2_otimizado.glb',
        'assets/vehicles/car police.glb',
        'assets/vehicles/caminhonete-nova-otimizada.glb',
        'assets/vehicles/caminhonete velha.glb',
        'assets/vehicles/moto-otimizada.glb',
        'assets/vehicles/onibus escolar.glb'
    ];
    for(const filename of local){
        const bytes=fs.readFileSync(path.join(root,filename));
        assert.equal(bytes.subarray(0,4).toString('ascii'),'glTF',filename);
        assert.equal(bytes.readUInt32LE(8),bytes.length,filename);
    }
    assert.match(uploaded,/caminhonete-nova-otimizada\.glb/);
    assert.match(uploaded,/moto-otimizada\.glb/);
    assert.match(uploaded,/onibus%20escolar\.glb/);
});
