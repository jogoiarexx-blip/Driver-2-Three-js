'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const Road=vm.runInNewContext(read('js/world/road-geometry.js')+
 '\nDriverRoadGeometry',{Math,Number});
const Garage=vm.runInNewContext(read('js/gameplay/tanner-garage.js')+
 '\nDriverTannerGarage',{Math,Number,JSON});
const City=vm.runInNewContext(read('js/world/city-builder.js')+
 '\nCityBuilder',{Math,Number});
const Vehicle=vm.runInNewContext(read('js/vehicles/driver-vehicle.js')+
 '\nDriverVehicle',{
 Math,Date,performance:{now:()=>12000},
 DriverArcadePhysics:{update:()=>0},
 DriverVehicleCollisions:{recordZone:()=>{}},
 VehicleVisuals:{update:()=>{}}
});
const storage=()=>{const map=new Map();return{
 getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),
 removeItem:k=>map.delete(k),map}};
const vehicle=()=>({name:'BUICK CUSTOM',color:0x3366cc,bodyStyle:'muscle',
 maxSpeed:55,accel:30,damage:14,_userCustomModel:true});
const cityMock=()=>{
 const p={height:11.3,minX:-22,maxX:-6,minZ:-282,maxZ:-246};
 return {trainStation:{ramp:{minX:-17,maxX:-11,startZ:-217,
     endZ:-246},platform:p},
    bridgeAngle:.1,
    canalWallSegments:[{minX:11.5,maxX:225,z:34},
        {minX:255,maxX:427,z:34},
        {minX:11.5,maxX:225,z:66},
        {minX:255,maxX:427,z:66}],
    buildingBoxes:[],worldLimit:410,
    interiorArea:()=>false,
    isWaterAt:City.prototype.isWaterAt,
    getGroundHeightAt:City.prototype.getGroundHeightAt,
    isPointBlocked:City.prototype.isPointBlocked};
};
const physicsCar=(x,z,heading,speed,city)=>{
    const car={
       x,z,y:city.getGroundHeightAt(x,z),heading,speed,
       maxSpeed:65,accel:30,vy:0,lateralVelocity:0,
       damage:0,damageZones:{front:0,rear:0,left:0,right:0},
       hubcaps:0,isSecret:false,isPolice:false,isDrifting:false,
       wheels:[],updateTransform(){},chassisTilt:{rotation:{x:0,z:0}}
    };
    return car;
};
const fx=()=>({splashes:0,spawnWaterSplash(){this.splashes++},
    spawnTireSmoke(){},ejectHubcap(){},addSkidMark(){}});
test('urbanismo mantém postes fora do eixo da pista',()=>{
    assert.equal(Road.inDrivingLane(16,16),false);
    assert.equal(Road.inDrivingLane(10,17),true);
    assert.equal(Road.legalFurniture(16,16),true);
    assert.equal(Road.legalFurniture(10,17),false);
    assert.equal(Road.legalFurniture(16,50),false);
    assert.equal(Road.furnitureCorner(-80,-160,1,1).x,-64);
    assert.equal(Road.resolve(10,0),null);
});
test('cidade não coloca objetos dentro de caixas de edifícios',()=>{
    const c={buildingBoxes:[{minX:15,maxX:30,minZ:15,maxZ:30}]};
    assert.equal(Road.legalFurniture(16,16,c),false);
    assert.equal(Road.legalFurniture(16,-16,c),true);
});
test('cercas visíveis impedem passagem, aberturas deixam cair',()=>{
    const c=cityMock();
    assert.equal(c.isPointBlocked(160,34,1.5),true);
    assert.equal(c.isPointBlocked(240,34,1.5),false);
    assert.equal(c.isPointBlocked(240,50,1.5),false);
    assert.equal(c.isWaterAt(240,50),true);
    assert.equal(c.getGroundHeightAt(240,50),-4);
    assert.ok(c.getGroundHeightAt(0,50)>0);
});
test('superfície da rampa é progressiva e termina na plataforma',()=>{
    const c=cityMock();
    const at=z=>c.getGroundHeightAt(-14,z);
    assert.equal(at(-217),0);
    assert.ok(at(-230)>4&&at(-230)<7);
    assert.equal(at(-246),11.3);
    assert.equal(at(-260),11.3);
    assert.equal(c.getGroundHeightAt(-18,-240),0);
});
test('carro não recebe impulso vertical irreal na rampa do trem',()=>{
    const c=cityMock(),car=physicsCar(-14,-218,Math.PI,34,c);
    const effect=fx(), ys=[];
    for(let i=0;i<17;i++){
        Vehicle.prototype.updatePhysics.call(car,.05,
            {up:true},c,effect,null,true);
        ys.push(car.y);
    }
    assert.ok(Math.max(...ys)>6);
    assert.ok(Math.max(...ys)<12);
    assert.ok(Math.abs(car.vy)<8);
    for(let i=1;i<ys.length;i++)
        assert.ok(Math.abs(ys[i]-ys[i-1])<1.5);
});
test('rampa não lança carro que se aproxima pela lateral elevada',()=>{
    const c=cityMock(),car=physicsCar(-19,-240,Math.PI/2,40,c);
    for(let i=0;i<6;i++)
        Vehicle.prototype.updatePhysics.call(car,.05,
            {up:true},c,fx(),null,true);
    assert.ok(car.y<2);
    assert.ok(Math.abs(car.vy)<10);
});
test('carro entra na água, gera respingo e recupera posição seca',()=>{
    const c=cityMock(),car=physicsCar(240,24,0,30,c);
    const effect=fx();let submerged=false;
    for(let i=0;i<60;i++){
        Vehicle.prototype.updatePhysics.call(car,.05,{up:true},c,
            effect,null,true);
        if(car.isSubmerged){submerged=true;break}
    }
    assert.equal(submerged,true);
    assert.equal(effect.splashes,1);
    for(let i=0;i<35;i++)
        Vehicle.prototype.updatePhysics.call(car,.05,{},c,effect,null,true);
    assert.equal(car.isSubmerged,false);
    assert.ok(car.z<=26);
    assert.equal(effect.splashes,1);
});
test('garagem salva até cinco veículos e preserva modelo, cor e estado',()=>{
    const store=storage(),a=new Garage(store);
    assert.equal(a.canStore(vehicle()),true);
    for(let i=0;i<5;i++)
        assert.equal(a.store({...vehicle(),name:'CAR '+i}),true);
    assert.equal(a.store(vehicle()),false);
    const b=new Garage(store);
    assert.equal(b.list().length,5);
    assert.equal(b.list()[0].color,0x3366cc);
    assert.equal(b.list()[0].custom,true);
    assert.equal(b.list()[0].damage,14);
    assert.equal(b.take(0).name,'CAR 0');
    assert.equal(new Garage(store).list().length,4);
});
test('armazenamento inválido não gera duplicação de carro',()=>{
    const store={getItem:()=>null,setItem(){throw Error('blocked')}};
    const garage=new Garage(store);
    assert.equal(garage.store(vehicle()),false);
    assert.equal(garage.cars.length,0);
    assert.equal(garage.take(0),null);
    assert.equal(garage.store({...vehicle(),isPolice:true}),false);
});
test('garagem só libera saída onde não existem carros ou colisores',()=>{
    const city={isPointBlocked:()=>false,isWaterAt:()=>false};
    assert.equal(Road.validGarageExit(-129,-90,city,[]),true);
    assert.equal(Road.validGarageExit(-129,-90,city,
        [{x:-127,z:-90}]),false);
    assert.equal(Road.validGarageExit(-129,-90,
        {isPointBlocked:()=>true},[]),false);
});
test('menu e carregamento ligam sistemas sem paths absolutos',()=>{
    const html=read('index.html');
    const engine=read('js/engine/driver2-game-engine.js');
    for(const needle of ['world/road-geometry.js',
        'gameplay/tanner-garage.js','tanner-garage-panel',
        'btn-route-home','driver-mission-start-status'])
        assert.ok(html.includes(needle),needle);
    for(const needle of ['this.tannerGarage.store(car)',
        'this.tannerGarage.take(index)','getNearbyMissionStart()',
        'activateNearbyMission()','this.navigationHome'])
        assert.ok(engine.includes(needle),needle);
});
test('spawns de missões ficam fora dos colliders principais',()=>{
    const city=read('js/world/city-builder.js');
    assert.match(city,/x:-64,z:-144,type:'story_tipoff'/);
    assert.match(city,/x:16,z:-224,type:'story_havana_lead'/);
    assert.equal(Road.roadDistance(-64),16);
    assert.equal(Road.roadDistance(16),16);
});
