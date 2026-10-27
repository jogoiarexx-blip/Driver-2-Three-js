'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const {Physics,Collisions}=vm.runInNewContext(
    read('js/physics/arcade-dynamics.js')+'\n'+
    read('js/physics/vehicle-collisions.js')+
    '\n({Physics:DriverArcadePhysics,Collisions:DriverVehicleCollisions})',
    {Math,Number,WeakMap,Infinity});
function car(x,z,heading=0,speed=0,style='muscle'){
    return {x,z,heading,speed,bodyStyle:style,maxSpeed:60,
        damage:0,lateralVelocity:0,updateTransform(){}};
}
const city={isPointBlocked:()=>false};
test('volumes fisicos preservam o eixo frontal +Z de cada carro',()=>{
    const dims=Collisions.dimensions(car(0,0));
    assert.ok(dims.length>dims.width);
    assert.equal(Collisions.axes(car(0,0))[1].z,1);
    const rotated=Collisions.axes(car(0,0,Math.PI/2));
    assert.ok(rotated[1].x>.999);
});
test('dois carros paralelos em faixas vizinhas nao batem so por raio circular',()=>{
    const a=car(0,0,0,35),b=car(3.05,0,0,35);
    assert.equal(Collisions.orientedContact(a,b),null);
    assert.equal(new Collisions().step([a,b],a,city,100),0);
});
test('caminhao comprido alcanca carro mais a frente',()=>{
    const a=car(0,0,0,15,'truck'),b=car(0,5.7,Math.PI,15);
    assert.ok(Collisions.orientedContact(a,b));
    assert.equal(new Collisions().step([a,b],a,city,300),1);
    assert.ok(a.damage>0);
});
test('onibus parado ao lado nao colide atraves da rua',()=>{
    const a=car(0,0,0,0,'bus'),b=car(3.5,0,0,0);
    assert.equal(Collisions.orientedContact(a,b),null);
    assert.equal(new Collisions().step([a,b],a,city,300),0);
});
test('perpendicular na intersecao usa eixos das duas carrocerias',()=>{
    const a=car(0,0,0,0),b=car(4.1,4.1,Math.PI/2,0);
    assert.equal(Collisions.orientedContact(a,b),null);
    b.x=1.5;b.z=1.5;
    assert.ok(Collisions.orientedContact(a,b));
});
test('sweep OBB detecta impactos rapidos antes de atravessar',()=>{
    const a=car(5,0,Math.PI/2,55),
          b=car(-5,0,-Math.PI/2,55);
    a.prevX=-5;a.prevZ=0;b.prevX=5;b.prevZ=0;
    const collision=new Collisions(), hit=collision.sweptOrientedContact(a,b);
    assert.ok(hit&&hit.t>0&&hit.t<.5);
    const results=[];
    assert.equal(collision.step([a,b],a,city,100,null,e=>results.push(e)),1);
    assert.equal(results[0].swept,true);
    assert.ok(a.x<b.x);
});
test('sweep OBB ignora carros que passam ao lado com folga',()=>{
    const a=car(5,0,Math.PI/2,55),
          b=car(-5,3.4,-Math.PI/2,55);
    a.prevX=-5;a.prevZ=0;b.prevX=5;b.prevZ=3.4;
    assert.equal(new Collisions().sweptOrientedContact(a,b),null);
});
test('sweep OBB nao confunde elevacao diferente com contato',()=>{
    const a=car(5,0,Math.PI/2,55),
          b=car(-5,0,-Math.PI/2,55);
    a.prevX=-5;a.prevZ=0;b.prevX=5;b.prevZ=0;
    a.y=0;b.y=8;
    assert.equal(new Collisions().step([a,b],a,city,100),0);
});
test('volume fisico personalizado exige limites conservadores',()=>{
    const a=car(0,0);a.colliderSize={width:1.1,length:90};
    assert.equal(Collisions.dimensions(a).width,2.45);
    a.colliderSize={width:3.2,length:7.1};
    assert.equal(Collisions.dimensions(a).length,7.1);
});
const Rig=vm.runInNewContext(
    read('js/vehicles/vehicle-wheel-rig.js')+
    '\nDriverVehicleWheelRig',{Math,Number,DriverVehicleCollisions:Collisions});
test('modelo publicado possui uma malha unificada, sem rodas isoladas',()=>{
    const bytes=fs.readFileSync(path.join(__dirname,
        '../assets/vehicles/carro_driver2_otimizado.glb'));
    const len=bytes.readUInt32LE(12);
    const gltf=JSON.parse(bytes.subarray(20,20+len).toString('utf8'));
    assert.equal(gltf.meshes.length,1);
    assert.equal(gltf.nodes.length,1);
    assert.equal(gltf.nodes[0].name,'Carro_Driver2_Carroceria_E_Detalhes');
    assert.deepEqual(gltf.nodes.filter(n=>/wheel|tire|pneu|roda/i.test(n.name||'')),[]);
});
test('rig GLB unificado nao adiciona rodas visuais duplicadas',()=>{
    const vehicle=car(0,0);
    const model={traverse(cb){cb({isMesh:true,name:'Carro_LowPoly'})}};
    const result=Rig.mount(vehicle,model);
    assert.equal(result.independent,false);
    assert.equal(result.pivots.length,0);
    assert.equal(result.anchors.length,4);
    assert.equal(result.anchors[0].z,-result.anchors[2].z);
    assert.ok(result.anchors[0].x<0&&result.anchors[1].x>0);
});
test('rig so extrai quatro rodas se as quatro forem malhas separadas',()=>{
    const named={traverse(fn){
        for(const n of ['wheel_FL','wheel_FR','wheel_RL','wheel_RR'])
            fn({isMesh:true,name:n});
    }};
    assert.equal(Rig.namedWheels(named).length,4);
    const merged={traverse(fn){fn({isMesh:true,name:'whole_car'})}};
    assert.equal(Rig.namedWheels(merged).length,0);
});
test('esterco e giro atualizam apenas pivôs reais sem mudar a física',()=>{
    const vehicle=car(0,0);vehicle.steerAngle=.28;vehicle.wheelSpin=2.1;
    vehicle.wheelRig={independent:true,pivots:[
        {front:true,steer:{rotation:{y:0}},roll:{rotation:{x:0}}},
        {front:false,steer:{rotation:{y:0}},roll:{rotation:{x:0}}}
    ]};
    Rig.update(vehicle);
    assert.equal(vehicle.wheelRig.pivots[0].steer.rotation.y,.28);
    assert.equal(vehicle.wheelRig.pivots[1].steer.rotation.y,0);
    assert.equal(vehicle.wheelRig.pivots[1].roll.rotation.x,2.1);
});
test('depuracao visual habilitada sem interferir nos controles de volante',()=>{
    const html=read('index.html');
    const engine=read('js/engine/driver2-game-engine.js');
    const assets=read('js/assets/free-vehicle-library.js');
    assert.match(html,/vehicles\/vehicle-wheel-rig\.js/);
    assert.match(engine,/code==='KeyI'/);
    assert.match(assets,/DriverVehicleWheelRig\.mount\(vehicle,wrapped\)/);
    assert.match(engine,/this\.debugVehiclePhysics/);
});
