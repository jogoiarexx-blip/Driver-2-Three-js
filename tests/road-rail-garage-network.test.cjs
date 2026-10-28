'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
class Element {
 constructor(geometry=null,material=null){
    this.geometry=geometry;this.material=material;this.children=[];
    this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};
    this.rotation={x:0,y:0,z:0};
 }
 add(...children){this.children.push(...children)}
}
class Geometry{constructor(...args){this.args=args}}
class Material{constructor(values){this.values=values||{}}}
const THREE={
  Mesh:Element,BoxGeometry:Geometry,PlaneGeometry:Geometry,
  CylinderGeometry:Geometry,MeshLambertMaterial:Material,
  MeshBasicMaterial:Material,DoubleSide:2
};
const context={Math,Number,THREE};
const City=vm.runInNewContext(
    read('js/world/city-builder.js')+'\nCityBuilder',context);
const Road=vm.runInNewContext(
    read('js/world/road-geometry.js')+'\nDriverRoadGeometry',
    {Math,Number});
const segmentSets=[[-427,-255],[-225,-11.5],[11.5,225],[255,427]];
function environment(){
    const segments=[];
    for(const z of [34,66])
        for(const [minX,maxX] of segmentSets)
            segments.push({z,minX,maxX});
    const c={
        roadExtent:320,worldLimit:410,
        canalWallSegments:segments,
        buildingBoxes:[],interiors:[],
        interiorArea:()=>false,
        caineBridgeClosed:false,
        trainStation:null,
        cityGroup:new Element()
    };
    c.isWaterAt=(x,z)=>City.prototype.isWaterAt.call(c,x,z);
    c.isPointBlocked=(x,z,r=1.2,y=0)=>
        City.prototype.isPointBlocked.call(c,x,z,r,y);
    c.getGroundHeightAt=(x,z,y)=>
        City.prototype.getGroundHeightAt.call(c,x,z,y);
    return c;
}
test('todas as avenidas do tabuleiro formam uma componente com ponte central',()=>{
    for(const id of ['chicago','havana','vegas','rio']){
        const c=environment();c.preset={id};
        const result=Road.auditNetwork(c);
        assert.equal(result.nodes,81,id);
        assert.equal(result.components,1,id);
        assert.equal(result.disconnected,0,id);
        assert.ok(result.edges>100,id);
    }
});
test('rota da IA no canal não atravessa água fora da ponte',()=>{
    const city=environment();
    assert.equal(city.isPointBlocked(84,0,1.5),false);
    assert.equal(city.isPointBlocked(84,80,1.5),false);
    assert.equal(Road.laneSegment(city,'z',1,80,0,80,80,4),false);
    assert.equal(Road.laneSegment(city,'z',-1,80,0,80,80,4),false);
    assert.equal(Road.laneSegment(city,'z',1,0,0,0,80,4),true);
    assert.equal(Road.laneSegment(city,'z',-1,0,0,0,80,4),true);
});
test('IA evita escolher travessia do canal sem ponte no cruzamento',()=>{
    const city=environment();
    const AI=vm.runInNewContext(read('js/traffic/traffic-ai.js')+
        '\nDriverTrafficAI',{
            Math,WeakMap,DriverRoadGeometry:Road,
            THREE:{MathUtils:{clamp:(n,lo,hi)=>Math.min(hi,Math.max(lo,n))}}
        });
    const ai=new AI(city),car={x:84,z:-20,heading:0,bodyStyle:'muscle'};
    const route=ai.getRoute(car);
    assert.equal(route.target.z,0);
    for(let i=0;i<25;i++){
        route.axis='z';route.sign=1;route.road=80;
        route.target={x:84,z:0};
        ai.chooseNext(car,route,null,false);
        assert.notEqual(route.target.z,80,
            'Carro nao pode cruzar o canal no eixo X=80');
    }
});

test('segmento rejeita muro no meio mesmo com destino livre',()=>{
    const city={isWaterAt:()=>false,
        isPointBlocked:(x,z)=>x>10&&x<15};
    assert.equal(Road.segmentDrivable(city,0,0,30,0),false);
    assert.equal(Road.segmentDrivable(city,0,10,9,10),true);
});
test('auditoria detecta desconexão se a ponte for fechada',()=>{
    const c=environment(),base=c.isPointBlocked;
    c.isPointBlocked=(x,z,r,y)=>base(x,z,r,y) ||
        (Math.abs(x)<10&&z>=34&&z<=66);
    const audit=Road.auditNetwork(c);
    assert.ok(audit.components>=2);
    assert.ok(audit.disconnected>0);
});
test('IA consulta corredor e mantém a antiga lógica de semáforo e missões',()=>{
    const src=read('js/traffic/traffic-ai.js');
    assert.match(src,/DriverRoadGeometry\.laneSegment/);
    assert.match(src,/DriverRoadGeometry\.segmentDrivable/);
    assert.match(src,/this\.city\.isTrafficGreen/);
    assert.match(src,/route\.reverseTimer/);
    assert.match(src,/scripted/);
});
test('plataforma ferroviária não teleporta carro que passa por baixo',()=>{
    const c=environment();
    c.trainStation={ramp:{minX:-17,maxX:-11,startZ:-217,endZ:-246},
      platform:{minX:-22,maxX:-6,minZ:-282,maxZ:-246,height:11.3}};
    assert.equal(c.getGroundHeightAt(-14,-263),11.3);
    assert.equal(c.getGroundHeightAt(-14,-263,0),0);
    assert.equal(c.getGroundHeightAt(-14,-263,8.7),0);
    assert.equal(c.getGroundHeightAt(-14,-263,10),11.3);
    assert.ok(c.getGroundHeightAt(-14,-230,0)>4);
    assert.ok(c.getGroundHeightAt(-14,-230,0)<7);
});
test('rampa permite corredor central e possui colisão onde os corrimãos existem',()=>{
    const c=environment();
    c.trainStation={ramp:{minX:-17,maxX:-11,startZ:-217,endZ:-246},
      platform:{height:11.3,minX:-22,maxX:-6,minZ:-282,maxZ:-246}};
    const centerHeight=c.getGroundHeightAt(-14,-230);
    assert.equal(c.isPointBlocked(-14,-230,1.55,centerHeight),false);
    assert.equal(c.isPointBlocked(-17.2,-230,.55,centerHeight),true);
    assert.equal(c.isPointBlocked(-10.8,-230,.55,centerHeight),true);
    assert.equal(c.isPointBlocked(-14,-215,1.55,0),false);
    assert.equal(c.isPointBlocked(-14,-248,1.55,11.3),false);
});
test('abrigos de Tanner têm entrada realmente aberta e saída livre',()=>{
    const c=environment();
    City.prototype.buildSafeHouseBlock.call(c,-120,-120);
    const p=c.garageParking,out=c.garageExit;
    assert.equal(p.x,-129);
    assert.equal(p.z,-111);
    assert.equal(out.z,-98);
    assert.equal(c.isPointBlocked(p.x,p.z,1.8),false);
    assert.equal(c.isPointBlocked(out.x,out.z,1.8),false);
    assert.equal(Road.validGarageExit(out.x,out.z,c,[]),true);
    assert.equal(Road.validGarageExit(out.x,out.z,c,
        [{x:out.x+2,z:out.z}]),false);
    assert.equal(c.isPointBlocked(-135,-120,.3),true);
    assert.equal(c.isPointBlocked(-129,-135,.3),true);
    assert.equal(c.isPointBlocked(-129,-104.85,.3),true);
    assert.equal(City.prototype.toggleHomeGarageDoor.call(c),true);
    assert.equal(c.isPointBlocked(-129,-104.85,.3),false);
    assert.equal(City.prototype.toggleHomeGarageDoor.call(c),false);
    assert.equal(c.isPointBlocked(-129,-104.85,.3),true);
    assert.ok(c.cityGroup.children.length>15);
});
test('carros e Tanner usam altura corrente como referência na ferrovia',()=>{
    const car=read('js/vehicles/driver-vehicle.js');
    const tanner=read('js/entities/tanner-controller.js');
    assert.match(car,/nextX,nextZ,this\.y/);
    assert.match(tanner,/nextX,nextZ,this\.group\.position\.y/);
    const game=read('js/engine/driver2-game-engine.js');
    assert.match(game,/this\.missionType!=='freeroam'/);
    assert.match(game,/this\.tannerGarage\.store\(car\)/);
});
