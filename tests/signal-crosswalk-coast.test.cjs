'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const Road=vm.runInNewContext(read('js/world/road-geometry.js')+
    '\nDriverRoadGeometry',{Math,Number});
const Nav=vm.runInNewContext(read('js/entities/pedestrian-sidewalk-nav.js')+
    '\nDriverPedestrianSidewalks',{Math,Number,Array,DriverRoadGeometry:Road});
const r=Nav.route({x:40,z:-40});
const city=(phase=1)=>{
    let current=phase;
    return {districtBuildings:[{x:40,z:-40},{x:120,z:-40}],
        isWaterAt:()=>false,isPointBlocked:()=>false,
        getTrafficPhase(){return current},
        isTrafficGreen(axis){return axis==='z'?
            current<10:current>=12&&current<22},
        setPhase(value){current=value}};
};
const makePed=()=>({block:{x:40,z:-40},route:r,
    x:r[1].x,z:r[1].z,nextCorner:1,walkCorners:2,
    waitTimer:0,diveTimer:0,walkSpeed:2.65});
test('pedestre só entra na travessia quando os carros da avenida recebem vermelho',()=>{
    const c=city(15),p=makePed();
    for(let i=0;i<20;i++){
        const status=Nav.step(p,.05,c,[]);
        assert.equal(status.state,'signal_wait');
        assert.equal(p.x,63);
        assert.equal(p.z,-63);
    }
    c.setPhase(1);
    const start=Nav.step(p,.05,c,[]);
    assert.equal(start.state,'crossing');
    assert.ok(p.x>63);
    assert.ok(p.crossing);
});
test('tempo restante deve ser suficiente até o fim da travessia',()=>{
    const c=city(9),p=makePed();
    assert.equal(Nav.step(p,.05,c,[]).state,'signal_wait');
    c.setPhase(2);
    assert.equal(Nav.step(p,.05,c,[]).state,'crossing');
});
test('pedestre termina travessia mesmo se o sinal mudar durante o percurso',()=>{
    const c=city(1),p=makePed();
    assert.equal(Nav.step(p,.05,c,[]).state,'crossing');
    c.setPhase(18);
    let finished=false;
    for(let i=0;i<160;i++){
        const status=Nav.step(p,.05,c,[]);
        if(status.completed){finished=true;break}
    }
    assert.equal(finished,true);
    assert.equal(p.x,97);
    assert.equal(p.z,-63);
    assert.equal(p.block.x,120);
    assert.equal(p.nextCorner,1);
    assert.equal(p.crossing,null);
});
test('pedestre espera quando um carro ocupa o trajeto, mesmo no sinal vermelho',()=>{
    const c=city(1),p=makePed(),car={x:80,z:-63,heading:0,speed:0};
    assert.equal(Nav.step(p,.05,c,[car]).state,'signal_wait');
    car.x=160;
    assert.equal(Nav.step(p,.05,c,[car]).state,'crossing');
});
test('pedestre não atravessa água nem prédios apesar de verde para ele',()=>{
    const c=city(1),p=makePed();
    c.isWaterAt=(x,z)=>x>78&&x<82;
    assert.equal(Nav.step(p,.05,c,[]).state,'walk');
    assert.equal(p.crossing,undefined);
    const b=makePed();const d=city(1);
    d.isPointBlocked=(x,z)=>x>78&&x<82;
    assert.equal(Nav.step(b,.05,d,[]).state,'walk');
});
test('travessia no eixo Z só ocorre quando tráfego norte-sul está vermelho',()=>{
    const r=Nav.route({x:40,z:-40});
    const b={x:40,z:40};
    const ped={block:{x:40,z:-40},route:r,
        x:r[2].x,z:r[2].z,nextCorner:2,walkCorners:2,
        waitTimer:0,diveTimer:0};
    const c=city(4);c.districtBuildings.push(b);
    assert.equal(Nav.step(ped,.05,c,[]).state,'signal_wait');
    c.setPhase(13);
    assert.equal(Nav.step(ped,.05,c,[]).state,'crossing');
});
class G{constructor(...values){this.args=values}
    rotateX(v){this.rotated=v;return this}}
class M{constructor(config={}){this.config=config;this.opacity=config.opacity}}
class Pos{set(x,y,z){this.x=x;this.y=y;this.z=z}}
class Dummy{constructor(){this.position=new Pos();this.rotation={set(){}};this.scale={set(){}};this.matrix={};}updateMatrix(){this.matrix={x:this.position.x,y:this.position.y,z:this.position.z}}}
class Instanced{constructor(geometry,material,count){this.geometry=geometry;this.material=material;this.count=count;this.coords=[];this.instanceMatrix={needsUpdate:false};}
    setMatrixAt(i,m){this.coords[i]={...m}}}
const THREE={InstancedMesh:Instanced,Object3D:Dummy,
    MeshBasicMaterial:M,MeshLambertMaterial:M,PlaneGeometry:G,
    CylinderGeometry:G,BoxGeometry:G,ConeGeometry:G,
    DoubleSide:2};
const Coast=vm.runInNewContext(read('js/world/coastal-visuals.js')+
    '\nDriverCoastalVisuals',{THREE,Math,Number});
test('quatro cidades possuem margens visuais e vegetação distintas',()=>{
    const styles=['chicago','havana','vegas','rio'].map(id=>Coast.style(id));
    assert.equal(new Set(styles.map(s=>s.kind)).size,4);
    assert.equal(new Set(styles.map(s=>s.shore)).size,4);
    assert.equal(Coast.style('vegas').kind,'desert');
    assert.equal(Coast.style('rio').kind,'tropical');
});
test('margens e vegetação usam quatro draw calls instanciadas por cidade',()=>{
    for(const id of ['chicago','havana','vegas','rio']){
        const group={children:[],add(mesh){this.children.push(mesh)}};
        const c={preset:{id},cityGroup:group};
        const result=Coast.build(c);
        assert.equal(group.children.length,4,id);
        assert.equal(result.foamCount,40);
        assert.equal(result.plantCount,8);
        assert.equal(result.shoreMesh.count,8);
        assert.equal(result.trunks.count,8);
        assert.equal(result.crowns.count,8);
        assert.ok(group.children.every(m=>m.instanceMatrix.needsUpdate));
        assert.ok(result.foamMesh.coords.every(p=>p.y>0.06));
        assert.ok(result.shoreMesh.coords.every(p=>
            Road.roadDistance(p.x)>12));
        const before=group.children.length;
        Coast.update(c,.016);
        assert.equal(group.children.length,before);
        assert.ok(c.waterFoamMaterial.opacity>.2);
    }
});
test('objetos costeiros mantêm livre a rua, ponte e entrada de garagem',()=>{
    const c={preset:{id:'rio'},cityGroup:{children:[],add(m){this.children.push(m)}}};
    const result=Coast.build(c);
    for(const p of result.trunks.coords){
        assert.equal(Road.inDrivingLane(p.x,p.z,1),false);
        assert.ok(Math.abs(p.x)>24);
    }
    assert.ok(result.foamMesh.coords.every(p=>Math.abs(p.x)>24));
});
test('código integra a travessia nos pedestres e anima a água por cidade',()=>{
    const ped=read('js/entities/pedestrians-roadblocks.js');
    assert.match(ped,/DriverPedestrianSidewalks.step\(p,dt,this.city,vehicles\)/);
    assert.match(ped,/state.state==='crossing'/);
    const city=read('js/world/city-builder.js');
    assert.match(city,/DriverCoastalVisuals.build\(this\)/);
    assert.match(city,/DriverCoastalVisuals.update\(this,dt\)/);
    assert.match(city,/this.parkGeometryCache/);
    const html=read('index.html');
    assert.ok(html.indexOf('js/world/coastal-visuals.js')>
        html.indexOf('js/world/urban-districts.js'));
    assert.ok(html.indexOf('js/world/coastal-visuals.js')<
        html.indexOf('js/world/city-builder.js'));
});
