'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const source=read('js/assets/uploaded-vehicles.js');
const engineSource=read('js/engine/driver2-game-engine.js');
const aiSource=read('js/traffic/traffic-ai.js');

const clearCity=()=>({
    preset:{id:'havana'},roadExtent:320,
    isWaterAt:()=>false,isPointBlocked:()=>false,
    isTrafficGreen:()=>true
});
const clearRoads={segmentDrivable:()=>true,laneSegment:()=>true};
class FakeVehicle {
    constructor(scene,options){Object.assign(this,options);this.scene=scene;
        this.speed=0;this.y=0;this.damage=0;
    }
}
const Spawn=vm.runInNewContext(source+';DriverUploadedVehicles',{
    DriverVehicle:FakeVehicle,DriverRoadGeometry:clearRoads,Math
});
const Traffic=vm.runInNewContext(aiSource+';DriverTrafficAI',{
    THREE:{MathUtils:{clamp:(n,a,b)=>Math.max(a,Math.min(b,n))}},
    DriverRoadGeometry:clearRoads,Math
});

test('quatro GLBs enviados viram civis móveis em todas as cidades',()=>{
    for(const id of ['chicago','havana','vegas','rio']){
        const city={...clearCity(),preset:{id}};
        const engine={scene:{},city,vehicles:[{x:0,z:-20,isSecret:false}]};
        const cars=Spawn.spawn(engine);
        assert.equal(cars.length,4,id);
        assert.equal(engine.vehicles.length,5,id);
        assert.deepEqual(Array.from(new Set(cars.map(v=>v.uploadedModel))).sort(),
            ['cargo-van','motorcycle','pickup-new','pickup-old'].sort());
        for(const car of cars){
            assert.equal(car.uploadedTraffic,true);
            assert.equal(car.missionParked,false);
            assert.equal(car.isSecret,undefined);
            assert.equal(car.isTarget,undefined);
            assert.ok(car.bodyStyle==='truck'||car.bodyStyle==='motorcycle');
            const route=new Traffic(city).getRoute(car);
            assert.ok(Number.isFinite(route.target.x)&&Number.isFinite(route.target.z));
        }
        assert.equal(Spawn.spawn(engine).length,0,'sem duplicar em re-spawn');
    }
});

test('motoristas dos GLBs recebem aceleração da IA e não são estacionados',()=>{
    const city=clearCity(),engine={scene:{},city,vehicles:[{x:0,z:-20,speed:0,y:0}]};
    const cars=Spawn.spawn(engine),ai=new Traffic(city);
    for(const car of cars){
        const controls=ai.getInput(car,1/60,engine.vehicles,
            {x:0,z:-20},0);
        assert.equal(controls.up,true,car.uploadedModel+' precisa acelerar');
        assert.equal(controls.down,false,car.uploadedModel);
    }
});

test('spawn evita água, colisores, ruas sem continuidade e carros sobrepostos',()=>{
    const taken=new Set(['4,-60','84,-60','-84,-54','-44,-84']);
    const city={...clearCity(),
        isWaterAt:(x,z)=>taken.has(x+','+z),
        isPointBlocked:()=>false};
    const engine={scene:{},city,vehicles:[]};
    const cars=Spawn.spawn(engine);
    assert.equal(cars.length,4,'deve escolher faixas alternativas');
    assert(cars.every(v=>!city.isWaterAt(v.x,v.z)));
    const skip=vm.runInNewContext(source+';DriverUploadedVehicles',{
        DriverVehicle:FakeVehicle,
        DriverRoadGeometry:{segmentDrivable:()=>false},Math
    });
    assert.equal(skip.spawn({scene:{},city:clearCity(),vehicles:[]}).length,0,
        'sem segmento dirigível validado não nasce um carro dentro do bloco');
    const blocked={...clearCity(),isPointBlocked:()=>true};
    assert.equal(Spawn.spawn({scene:{},city:blocked,vehicles:[]}).length,0);
    const wet={...clearCity(),isWaterAt:()=>true};
    assert.equal(Spawn.spawn({scene:{},city:wet,vehicles:[]}).length,0);
});

test('apenas o carro de garagem é secreto; Jones e van de missão não herdam o rótulo',()=>{
    assert.match(engineSource,/this\.secretCar = new DriverVehicle[\s\S]*?isSecret: true/);
    assert.match(engineSource,/this\.targetCar\.missionParked=true/);
    assert.match(engineSource,/van\.missionParked=true/);
    const jones=engineSource.match(/name:'CARRO DE JONES'[\s\S]*?\}\);/);
    assert.ok(jones);
    assert.doesNotMatch(jones[0],/isSecret\s*:/);
    const ambush=engineSource.match(/name:'VAN AMARELA • EMBOSCADA'[\s\S]*?\}\);/);
    assert.ok(ambush);
    assert.doesNotMatch(ambush[0],/isSecret\s*:/);
    // R66: somente a criação do veículo secreto da garagem marca esse tipo.
    const secretStarts=[...engineSource.matchAll(/isSecret:\s*true/g)];
    assert.equal(secretStarts.length,1);
});

test('garagem conserva identificador do GLB da van sem permitir novo carro secreto',()=>{
    const Garage=vm.runInNewContext(
        read('js/gameplay/tanner-garage.js')+';DriverTannerGarage');
    const storage={getItem:()=>null,setItem:()=>{}},garage=new Garage(storage);
    const van={name:'FURGÃO DE ENTREGAS',bodyStyle:'truck',
        color:0x807565,uploadedModel:'cargo-van',maxSpeed:38,accel:20};
    assert.equal(garage.store(van),true);
    assert.equal(garage.take(0).uploadedModel,'cargo-van');
    assert.equal(garage.canStore({...van,isSecret:true}),false);
});
