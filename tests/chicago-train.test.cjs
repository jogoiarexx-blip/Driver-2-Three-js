'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

class Node {
    constructor(){
        this.children=[];this.parent=null;this.visible=true;
        this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};
        this.rotation={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};
        this.scale={x:1,y:1,z:1,set(x,y,z){this.x=x;this.y=y;this.z=z;}};
        this.matrix={};
    }
    add(...nodes){for(const node of nodes){this.children.push(node);node.parent=this;}}
    remove(node){this.children=this.children.filter(n=>n!==node);node.parent=null;}
    updateMatrix(){this.matrix={position:{...this.position},
        rotation:{...this.rotation},scale:{...this.scale}};}
    clear(){this.children.length=0;}
}
class Mesh extends Node{
    constructor(geometry,material){super();this.geometry=geometry;this.material=material;}
}
class InstancedMesh extends Mesh{
    constructor(geometry,material,count){super(geometry,material);this.count=count;
        this.indices=[];this.matrices=[];
        this.instanceMatrix={needsUpdate:false};}
    setMatrixAt(i,m){this.indices.push(i);
        this.matrices[i]=m?JSON.parse(JSON.stringify(m)):null;}
}
class Geometry {constructor(...args){this.args=args;}}
class Material {constructor(opts){this.opts=opts;}}
const THREE={
    Group:Node,Mesh,InstancedMesh,Object3D:Node,
    MeshLambertMaterial:Material,MeshBasicMaterial:Material,
    BoxGeometry:Geometry,CylinderGeometry:Geometry
};
const context={Math,THREE,GPUResourceUtils:{disposeSubtree(){}}};
const Train=vm.runInNewContext(read('js/world/chicago-train.js')+
    '\nDriverChicagoTrain',context);
const City=vm.runInNewContext(read('js/world/city-builder.js')+
    '\nCityBuilder',context);
const Tactics=vm.runInNewContext(read('js/police/pursuit-tactics.js')+
    '\nPolicePursuitTactics',{Math});
const Save=vm.runInNewContext(read('js/gameplay/checkpoint-route.js')+
    '\n'+read('js/gameplay/home-save.js')+'\nDriverHomeSave',
    {Math,Date,Set,JSON,DriverChicagoTrain:Train});

function scene(){
    return new (class extends Node {})();
}
function trainInstance(){
    const host=scene();
    const train=new Train(host,{preset:{id:'chicago'}});
    return {host,train};
}
test('trem de Chicago tem locomotiva e dois vagões com janelas',()=>{
    const {train}=trainInstance();
    assert.equal(train.group.children.length,3);
    assert.ok(train.group.children.every(c=>c.children.length>7));
    assert.equal(train.group.visible,false);
});
test('missão habilita trem de Chicago e começa no ponto inicial',()=>{
    const {train}=trainInstance();
    train.reset(true);
    assert.equal(train.active,true);
    assert.equal(train.group.visible,true);
    assert.equal(train.position.z,168);
    assert.equal(train.arrived,false);
});
test('trem anda sem saltos, independente de passos longos no relógio',()=>{
    const {train}=trainInstance();train.reset(true);
    train.update(0.05);
    assert.ok(Math.abs(train.position.z-(168-7.8*.05))<0.00001);
    const z=train.position.z;
    train.update(100);
    assert.ok(z-train.position.z<=0.391);
});
test('trem chega à estação e para exatamente no ponto de parada',()=>{
    const {train}=trainInstance();train.reset(true);
    for(let i=0;i<1300;i++)train.update(.05);
    assert.equal(train.position.z,-258);
    assert.equal(train.arrived,true);
    const elapsed=train.elapsed;
    train.update(.05);
    assert.equal(train.elapsed,elapsed);
});
test('reset reinicia perseguição e volta a ocultar trem fora da missão',()=>{
    const {train}=trainInstance();train.reset(true);
    train.update(.05);train.reset(false);
    assert.equal(train.active,false);
    assert.equal(train.arrived,false);
    assert.equal(train.position.z,168);
});
test('troca para Havana desativa o trem exclusivo de Chicago',()=>{
    const {train}=trainInstance();train.reset(true);
    train.setCity({preset:{id:'havana'}});
    train.reset(true);
    assert.equal(train.active,false);
    assert.equal(train.group.visible,false);
});
test('linha elevada tem pórticos fora da pista e sem pilares no canal',()=>{
    const city={preset:{id:'chicago'},cityGroup:scene()};
    Train.buildInfrastructure(city);
    assert.equal(city.cityGroup.children.length,6);
    const sleepers=city.cityGroup.children[3],
        supports=city.cityGroup.children[4],
        beams=city.cityGroup.children[5];
    assert.equal(sleepers.count,188);
    assert.equal(supports.count,34);
    assert.equal(beams.count,17);
    assert.equal(sleepers.instanceMatrix.needsUpdate,true);
    assert.equal(supports.matrices.length,34);
    for(const mat of supports.matrices){
        assert(Math.abs(mat.position.x)>13&&Math.abs(mat.position.x)<15,
            'Pilar invadiu a avenida');
        assert(!(mat.position.z>31&&mat.position.z<69),
            'Pilar no leito do canal');
    }
    assert(beams.matrices.every(m=>Math.abs(m.position.x)<.01));
});
test('linha férrea não existe em Havana, Las Vegas ou Rio',()=>{
    for(const id of ['havana','vegas','rio']){
        const city={preset:{id},cityGroup:scene()};
        Train.buildInfrastructure(city);
        assert.equal(city.cityGroup.children.length,0);
    }
});
test('estação cria rampa, plataforma e colisão do prédio lateral',()=>{
    const env={cityGroup:scene(),buildingBoxes:[],trainStation:null};
    City.prototype.buildChicagoStationBlock.call(env,-40,-280);
    assert.equal(env.buildingBoxes.length,1);
    assert.ok(env.cityGroup.children.length>=7);
    assert.equal(env.trainStation.platform.height,11.3);
    assert.equal(env.trainStation.ramp.startZ,-217);
});
test('rampa é uma superfície física contínua para Tanner',()=>{
    const city={
        trainStation:{
            ramp:{minX:-17,maxX:-11,startZ:-217,endZ:-246},
            platform:{...Train.PLATFORM}
        },bridgeAngle:0.1
    };
    const at=z=>City.prototype.getGroundHeightAt.call(city,-14,z);
    assert.equal(at(-217),0);
    assert.ok(at(-230)>4 && at(-230)<7);
    assert.equal(at(-246),11.3);
    assert.equal(at(-263),11.3);
});
test('plataforma não aceita vitória no chão ou antes da chegada a pé',()=>{
    const pos={x:-14,z:-260,y:0};
    assert.equal(Train.onPlatform(pos),false);
    pos.y=11.3;
    assert.equal(Train.onPlatform(pos),true);
    pos.x=40;
    assert.equal(Train.onPlatform(pos),false);
});
test('plataforma só pertence à estação de Chicago',()=>{
    const pos={x:-14,z:-260,y:11.3};
    assert.equal(City.prototype.onTrainPlatform.call({
        preset:{id:'havana'}
    },pos),false);
    assert.equal(City.prototype.onTrainPlatform.call({
        preset:{id:'chicago'}
    },pos),true);
});
test('módulo Train Pursuit carrega antes de montar a cidade e iniciar engine',()=>{
    const html=read('index.html');
    const scripts=[...html.matchAll(/src="\.\/(js\/[^"?]+\.js)(?:\?[^"]*)?"/g)].map(x=>x[1]);
    const train=scripts.indexOf('js/world/chicago-train.js');
    const city=scripts.indexOf('js/world/city-builder.js');
    const engine=scripts.indexOf('js/engine/driver2-game-engine.js');
    assert.ok(train>=0 && city>train && engine>city);
    assert.match(html,/id="d2-start-story"/);
    assert.match(read('js/gameplay/campaign-flow.js'), /'story_train'/);
    assert.match(read('js/engine/driver2-game-engine.js'), /activateNearbyMission\(\)/);
});
test('Train Pursuit verifica distância, estação e entrada na plataforma',()=>{
    const engine=read('js/engine/driver2-game-engine.js');
    assert.match(engine,/trainLostSeconds>6/);
    assert.match(engine,/this\.city\.onTrainPlatform\(current\)/);
    assert.match(engine,/this\.mode==='on_foot'/);
    assert.match(engine,/this\.trainLine\.update\(dt\)/);
    assert.match(engine,/this\.missionTimeLeft=120/);
});
test('estado do trem é uma opção válida no sistema de save',()=>{
    const saver=new Save({getItem(){return null;},setItem(){}});
    assert.equal(Save.TYPES.includes('story_train'),true);
    assert.equal(Train.START_Z,168);
    assert.equal(Train.STOP_Z,-258);
    assert.ok(saver.valid({
        version:1,city:'chicago',interior:null,mission:{type:'story_train'},
        tanner:{x:0,z:0},vehicles:[{x:0,z:0}]
    }));
});
test('save captura posição e chegada do trem, sem dados gráficos pesados',()=>{
    const {train}=trainInstance();train.reset(true);
    train.update(.05);
    const car={x:4,y:0,z:215,heading:Math.PI,speed:0,damage:0,damageZones:{}};
    const game={
        trainLine:train,trainLostSeconds:1.5,missionType:'story_train',
        currentCityKey:'chicago',weatherMode:'day',felony:0,mode:'driving',
        tanner:{heading:0,group:{position:{x:0,y:0,z:0}}},
        vehicles:[car],playerCar:car,city:{secretGateOpen:false},
        missionActive:true,missionTimeLeft:99,pursuitChapter:{phase:0,elapsed:0},
        missionMarkers:[],completedMissions:new Set()
    };
    const snapshot=new Save({getItem(){},setItem(){}}).capture(game);
    assert.equal(snapshot.train.position,train.position.z);
    assert.equal(snapshot.train.elapsed,train.elapsed);
    assert.equal(snapshot.train.lost,1.5);
    assert.equal(typeof snapshot.train.position,'number');
});
test('nenhum teleporte ocorre durante a movimentação do trem',()=>{
    const {train}=trainInstance();
    train.reset(true);
    let previous=train.position.z;
    for(let i=0;i<60;i++){
        train.update(1/60);
        assert.ok(train.position.z<previous);
        assert.ok(previous-train.position.z<0.2);
        previous=train.position.z;
    }
});
