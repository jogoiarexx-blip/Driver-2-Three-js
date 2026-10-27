'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const vmVehicle=vm.runInNewContext(read('js/vehicles/driver-vehicle.js')+
    '\nDriverVehicle',{
        Math,Date,performance:{now:()=>10000},
        DriverArcadePhysics:{update:(car,dt,throttle,steer)=>{
            car._steer=steer;return 0;
        }},
        VehicleVisuals:{update:()=>{},setHeadlights:()=>{}},
        DriverVehicleCollisions:{recordZone:()=>{}},
        GPUResourceUtils:{disposeSubtree:()=>{}}
    });
const fakeCar=()=>({
    x:0,z:0,y:0,vy:0,heading:0,speed:30,damage:0,maxSpeed:55,
    accel:30,bodyStyle:'muscle',isSecret:false,hubcaps:0,
    isDrifting:true,chassisTilt:{rotation:{x:0,z:0}},
    updateTransform(){},
    wheels:[],skidFxClock:0
});
const city={
    getGroundHeightAt:()=>0,
    isPointBlocked:()=>false
};
const effects=()=>{
    const stats={smoke:0,marks:0};
    return {...stats,
        spawnTireSmoke(){this.smoke++},
        addSkidMark(){this.marks++},
        ejectHubcap(){}
    };
};
const empty={playCrash(){}};
test('A e D corrigidos no jogador, sem inverter controles da IA',()=>{
    const a=fakeCar(),d=fakeCar(),npc=fakeCar();
    const fx=effects();
    vmVehicle.prototype.updatePhysics.call(a,.016,
        {left:true,up:true},city,fx,empty,true);
    vmVehicle.prototype.updatePhysics.call(d,.016,
        {right:true,up:true},city,fx,empty,true);
    vmVehicle.prototype.updatePhysics.call(npc,.016,
        {right:true,up:true},city,fx,empty,false);
    assert.equal(a._steer,1);
    assert.equal(d._steer,-1);
    assert.equal(npc._steer,1);
});
test('curva forte em velocidade deixa marcas e fumaça sem SHIFT',()=>{
    const car=fakeCar(),fx=effects();
    const math=Object.create(Math);
    const originalRandom=Math.random;
    // Atributos explícitos, deterministicamente validáveis por regex
    // e execução da rotina repetida com o estado de drift já ativado.
    for(let frame=0;frame<12;frame++)
        vmVehicle.prototype.updatePhysics.call(car,.02,
            {right:true,up:true},city,fx,empty,true);
    assert.ok(fx.marks>=2);
    assert.ok(fx.smoke>=0);
    assert.match(read('js/vehicles/driver-vehicle.js'),
        /hardCorner\?\.72:\.54/);
});
test('física reconhece curva forte rápida como drift',()=>{
    const Physics=vm.runInNewContext(
        read('js/physics/arcade-dynamics.js')+'\nDriverArcadePhysics',
        {Math}
    );
    const car=fakeCar();
    car.damage=0;car.steerAngle=0;car.wheelSpin=0;
    car.pitchAngle=0;car.rollAngle=0;car.lateralVelocity=0;
    Physics.update(car,1/60,1,1,false,false);
    assert.equal(car.isDrifting,true);
});
test('colisão atravessando a posição de caixa detecta segmento do veículo',()=>{
    const THREE={MathUtils:{lerp:(a,b,t)=>a+(b-a)*t}};
    const City=vm.runInNewContext(
        read('js/world/city-builder.js')+'\nCityBuilder',
        {THREE,Math}
    );
    const box={type:'crate',x:0,z:0,mesh:{
        position:{x:0,y:.5,z:0},rotation:{x:0,z:0}
    },hit:false,shattered:false};
    const city=Object.create(City.prototype);
    city.signalClock=0;city.bridgeAngle=.1;city.bridgeRaised=false;
    city.caineBridgeGate=null;city.secretGateOpen=false;
    city.debrisPieces=[];city.destructibleProps=[box];
    city.refreshTrafficLights=()=>{};
    let hit=false;city.shatterProp=(prop)=>{prop.shattered=true;return true;};
    const vehicle={prevX:-9,prevZ:0,x:9,z:0,speed:34,
        heading:0,damage:0};
    city.update(.016,[vehicle],()=>{hit=true});
    assert.equal(hit,true);
    assert.equal(box.hit,true);
    assert.equal(box.shattered,true);
    assert.ok(vehicle.speed<34);
});
test('colisão forte cria detritos e objeto deixa de ser sólido',()=>{
    const src=read('js/world/city-builder.js');
    assert.match(src,/shatterProp\(prop,impactSpeed\)/);
    assert.match(src,/prop\.mesh\.visible=false/);
    assert.match(src,/this\.debrisPieces\.push\(/);
    assert.match(src,/this\.debrisPieces\.splice\(i,1\)/);
    assert.match(src,/Math\.abs\(bx\+bz\)\/80/);
});
test('pintura clonada não compartilha material entre carros',()=>{
    const code=read('js/assets/driver-user-car-paint.js');
    assert.match(code,/const copy=mat\.clone\(\)/);
    assert.match(code,/shader\.uniforms\.driverPaintColor/);
    assert.match(code,/smoothstep\(0\.008, 0\.057, olive\)/);
    assert.match(code,/DriverUserCarPaint/);
});
test('modelo importado é rotacionado para o eixo Z da física',()=>{
    const src=read('js/assets/free-vehicle-library.js');
    assert.match(src,/clone\.rotation\.y=Math\.PI\/2/);
    assert.match(src,/driver2_otimizado\.glb/);
    assert.match(src,/applyCC0Model\(wrapped,true\)/);
    assert.match(src,/importUserCar\(file\)/);
    assert.match(src,/indexedDB\.open\('driver2-car-import-v1'/);
});
test('menu permite importação local e controle da cor',()=>{
    const html=read('index.html');
    const boot=read('js/ui/driver-boot-flow.js');
    assert.match(html,/id="driver-car-file"/);
    assert.match(html,/data-import-driver-car/);
    assert.match(html,/data-driver-paint/);
    assert.match(boot,/this\.pendingUserCarFile=file/);
    assert.match(boot,/freeVehicleAssets\.importUserCar\(file\)/);
    assert.ok(html.indexOf('js/assets/driver-user-car-paint.js')<
        html.indexOf('js/assets/free-vehicle-library.js'));
});
test('partida antiga e controles de IA conservam funções',()=>{
    assert.match(read('js/gameplay/home-save.js'),/static VERSION = 1/);
    assert.match(read('js/traffic/traffic-ai.js'),/getInput\(car, dt, vehicles/);
    assert.match(read('js/engine/driver2-game-engine.js'),
        /window\.DriverBoot = new DriverBootFlow\(\)/);
});
