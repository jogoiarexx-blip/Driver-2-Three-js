'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const road=vm.runInNewContext(read('js/world/road-geometry.js')+
    '\nDriverRoadGeometry',{Math,Number});
const Nav=vm.runInNewContext(read('js/entities/pedestrian-sidewalk-nav.js')+
    '\nDriverPedestrianSidewalks',{
        Math,Number,Array,DriverRoadGeometry:road
    });
const Urban=vm.runInNewContext(read('js/world/urban-districts.js')+
    '\nUrbanDistricts',{Math,Number});
const four=['chicago','havana','vegas','rio'];

test('fachadas regionais têm perfis distintos nas quatro cidades',()=>{
    const styles=four.map(id=>Urban.profile(id).style);
    assert.equal(new Set(styles).size,4);
    const colors=four.map(id=>Urban.profile(id).color);
    assert.equal(new Set(colors).size,4);
    assert.equal(Urban.profile('havana').style,'colonial-balconies');
    assert.equal(Urban.profile('vegas').style,'casino-neon');
});
test('arquitetura acrescenta só duas instâncias de fachadas por setor de perto',()=>{
    class Geometry{constructor(...args){this.args=args}}
    class Material{constructor(options){this.options=options||{}}}
    class Color{constructor(value){this.value=value}}
    class Mesh{
        constructor(geo,mat,count){
            this.geometry=geo;this.material=mat;this.count=count;
            this.instanceMatrix={needsUpdate:false};
            this.instanceColor={needsUpdate:false};
            this.userData={};
            this.positions=[];this.colors=[];
        }
        setMatrixAt(i,m){this.positions[i]=m.position}
        setColorAt(i,c){this.colors[i]=c.value}
    }
    class Object3D{
        constructor(){
            this.matrix={position:null};
            this.position={set:(x,y,z)=>{this.matrix.position={x,y,z}}};
            this.scale={set(){}};
            this.rotation={set(){}};
        }
        updateMatrix(){}
    }
    const THREE={BoxGeometry:Geometry,CylinderGeometry:Geometry,
        MeshLambertMaterial:Material,MeshBasicMaterial:Material,
        InstancedMesh:Mesh,Object3D,Color};
    const Districts=vm.runInNewContext(
        read('js/world/urban-districts.js')+'\nUrbanDistricts',
        {THREE,Math,Number});
    const buildings=[{x:40,z:-40,height:26},
        {x:120,z:-40,height:36}];
    for(const id of four){
        const group={children:[],add(m){this.children.push(m)}};
        const builder={preset:{id},cityGroup:group,districtBuildings:buildings};
        Districts.decorate(builder,buildings,group);
        assert.equal(group.children.length,7,id);
        assert.equal(group.children.slice(0,5).every(m=>m.count===2),true,id);
        assert.ok(group.children.slice(-2).every(m=>m.userData.architecture===true),id);
        const [front,accent]=group.children.slice(3,5);
        assert.equal(front.userData.regionalStyle,Districts.profile(id).style);
        assert.equal(accent.userData.regionalStyle,Districts.profile(id).style);
        assert.equal(front.instanceMatrix.needsUpdate,true);
        assert.equal(accent.instanceMatrix.needsUpdate,true);
        assert.ok(front.positions.every(p=>p.z>=-22),id);
        assert.ok(accent.positions.every(p=>p.z>=-22),id);
    }
});
test('rotas de passeio contornam a construção sem entrar nas faixas',()=>{
    const block={x:40,z:-40},r=Nav.route(block);
    assert.equal(r.length,4);
    const city={isPointBlocked:()=>false};
    for(const p of r){
        assert.equal(Nav.permitted(city,p.x,p.z),true);
        assert.equal(road.inDrivingLane(p.x,p.z,.75),false);
    }
    assert.equal(Nav.permitted(city,4,-40),false);
});
test('pedestres recusam água, edifícios, pontos inválidos',()=>{
    assert.equal(Nav.permitted({isWaterAt:()=>true},17,-40),false);
    assert.equal(Nav.permitted({isPointBlocked:()=>true},17,-40),false);
    assert.equal(Nav.permitted({},NaN,4),false);
    assert.equal(Nav.permitted({},17,-40),true);
});
test('blocos de pedestres são selecionados perto do foco sem ruas',()=>{
    const blocks=[
        {x:-200,z:-200},{x:40,z:-40},{x:120,z:-40},{x:-120,z:-120}
    ];
    const city={districtBuildings:blocks,isPointBlocked:()=>false};
    const first=Nav.pick(city,{x:40,z:-50},3);
    assert.equal(first[0].x,40);
    assert.equal(first.length,3);
    assert.ok(first.every(b=>Nav.blockSafe(city,b)));
});
test('pedestre percorre anel seguro e faz curvas ao chegar ao canto',()=>{
    const r=Nav.route({x:40,z:-40});
    const ped={route:r,x:r[0].x,z:r[0].z,nextCorner:1,
        walkSpeed:3,waitTimer:0,diveTimer:0};
    let turns=0,old=ped.nextCorner;
    for(let i=0;i<2800;i++){
        const result=Nav.step(ped,.05,{},[]);
        assert.equal(result.state,'walk');
        assert.equal(Nav.permitted({},ped.x,ped.z),true);
        if(ped.nextCorner!==old){turns++;old=ped.nextCorner}
    }
    assert.ok(turns>=4);
});
test('dodge por carro rápido não empurra pedestre para asfalto',()=>{
    const route=Nav.route({x:40,z:-40});
    const p={x:route[0].x,z:route[0].z,route,nextCorner:1,
        walkSpeed:3,waitTimer:0,diveTimer:0};
    const car={x:p.x,z:p.z,heading:0,speed:32};
    const a=Nav.step(p,.016,{},[car]);
    assert.equal(a.state,'dodge');
    assert.equal(a.newDodge,true);
    for(let i=0;i<30;i++)Nav.step(p,.016,{},[car]);
    assert.equal(Nav.permitted({},p.x,p.z),true);
});
test('pedestre distante permanece reutilizável e não ganha geometria extra',()=>{
    const source=read('js/entities/pedestrians-roadblocks.js');
    assert.match(source,/for\(let i=0;i<28;i\+\+\)/);
    assert.match(source,/DriverPedestrianSidewalks\.step\(p,dt,this\.city,vehicles\)/);
    assert.match(source,/dist<235/);
    assert.match(source,/p\.mesh\.visible=dist<235/);
    assert.match(source,/this\.roadblocks=\[\]/);
    assert.match(source,/this\.group\.remove\(this\.group\.children\[0\]\)/);
});
test('novo módulo carrega antes dos pedestres, sem alterar cenas antigas',()=>{
    const html=read('index.html'),engine=read('js/engine/driver2-game-engine.js');
    assert.ok(html.indexOf('entities/pedestrian-sidewalk-nav.js')>
        html.indexOf('engine/gpu-resources.js'));
    assert.ok(html.indexOf('entities/pedestrians-roadblocks.js')>
        html.indexOf('entities/pedestrian-sidewalk-nav.js'));
    assert.match(engine,/this\.pedManager\.spawnCityPedestrians\(this\.city/);
    assert.match(engine,/this\.getPlayerPosition\(\)\);/);
    const city=read('js/world/city-builder.js');
    assert.match(city,/UrbanDistricts\.decorate\(this,chunk\.buildings,group\)/);
});

test('streaming reutiliza no máximo três pedestres longe sem criar malhas',()=>{
    const Ped=vm.runInNewContext(read('js/entities/pedestrians-roadblocks.js')+
        '\nPedestrianAndRoadblockManager',{
            DriverPedestrianSidewalks:Nav,
            GPUResourceUtils:{disposeSubtree(){}},
            THREE:{Group:class{}},
            Math,Number
        });
    const manager=Object.create(Ped.prototype);
    const blocks=[];
    for(const x of [-280,-200,-120,-40,40,120,200,280])
        for(const z of [-280,-200,-120,-40,120,200,280])
            blocks.push({x,z});
    manager.city={districtBuildings:blocks,isPointBlocked:()=>false};
    manager.pedestrians=Array.from({length:28},()=>({
        x:700,z:700,nextCorner:1,
        mesh:{visible:true,position:{set(x,y,z){this.x=x;this.y=y;this.z=z}}}
    }));
    manager.pedestrianClock=0;
    assert.equal(manager.recycleDistantPedestrians({x:40,z:-40},1.2),3);
    assert.equal(manager.pedestrians.length,28);
    assert.ok(manager.pedestrians.slice(0,3).every(p=>
        Math.hypot(p.x-40,p.z+40)<235));
    assert.ok(manager.pedestrians.slice(0,3).every(p=>p.mesh.visible===false));
    assert.equal(manager.recycleDistantPedestrians({x:40,z:-40},.2),0);
});
