'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const Director=vm.runInNewContext(read('js/gameplay/caine-compound.js')+
    '\nDriverCaineCompound',{Math});
class Node {
    constructor(){
        this.children=[];this.visible=true;this.parent=null;
        this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};
        this.rotation={x:0,y:0,z:0};this.scale={x:1,y:1,z:1};
    }
    add(...args){for(const a of args){this.children.push(a);a.parent=this;}}
}
class Mesh extends Node{
    constructor(geometry,material){super();this.geometry=geometry;this.material=material;}
}
class Geometry {constructor(...a){this.args=a;}}
class Material {constructor(options){this.options=options;}}
const THREE={Group:Node,Mesh,BoxGeometry:Geometry,MeshLambertMaterial:Material,
    MeshBasicMaterial:Material};
const City=vm.runInNewContext(read('js/world/city-builder.js')+
    '\nCityBuilder',{THREE,Math});
function state(overrides={}){
    return {position:{x:1050,z:-8.3},mode:'on_foot',
        interiorId:'warehouse',...overrides};
}
function advanceToBridge(m){
    m.update(.05,state({position:{x:200,z:-175},interiorId:null}));
    m.update(.05,state({position:{x:240,z:-160},mode:'driving',interiorId:null}));
    return m.update(.05,state({position:{x:0,z:-70},mode:'driving',interiorId:null}));
}
test('começa dentro do depósito e precisa sair a pé',()=>{
    const m=new Director();
    const status=m.update(.05,state());
    assert.equal(status.phase,'warehouse');
    assert.equal(status.activateVans,false);
});
test('sair do galpão libera a fase de procurar o carro',()=>{
    const m=new Director();
    const result=m.update(.05,state({position:{x:200,z:-175},interiorId:null}));
    assert.equal(result.phase,'find_car');
    assert.equal(result.changed,true);
});
test('entrar num carro libera perseguidores, uma única vez',()=>{
    const m=new Director();
    m.update(.05,state({interiorId:null}));
    const result=m.update(.05,state({position:{x:240,z:-160},mode:'driving',interiorId:null}));
    assert.equal(result.phase,'escape');
    assert.equal(result.activateVans,true);
    assert.equal(result.bridgeClosed,false);
});
test('aproximar-se da ponte dispara contagem de dezenove segundos',()=>{
    const m=new Director(),result=advanceToBridge(m);
    assert.equal(result.phase,'bridge');
    assert.equal(result.bridgeClosing,true);
    assert.ok(result.bridgeSeconds>0);
});
test('distância longa da ponte não inicia o relógio antes da hora',()=>{
    const m=new Director();
    m.update(.05,state({interiorId:null}));
    const s=m.update(.05,state({mode:'driving',interiorId:null,position:{x:240,z:-120}}));
    assert.equal(s.phase,'escape');
    assert.equal(s.bridgeSeconds,0);
});
test('ponte pode ser atravessada antes de fechar',()=>{
    const m=new Director();advanceToBridge(m);
    const r=m.update(.05,state({
        mode:'driving',interiorId:null,position:{x:0,z:94}
    }));
    assert.equal(r.completed,true);
    assert.equal(r.phase,'done');
    assert.equal(r.bridgeClosed,false);
});
test('não vence atravessando a ponte a pé',()=>{
    const m=new Director();advanceToBridge(m);
    const r=m.update(.05,state({
        mode:'on_foot',interiorId:null,position:{x:0,z:94}
    }));
    assert.equal(r.completed,false);
});
test('fechamento da ponte após dezenove segundos falha a missão',()=>{
    const m=new Director();advanceToBridge(m);
    let r;
    for(let i=0;i<390;i++)r=m.update(.05,state({
        mode:'driving',interiorId:null,position:{x:0,z:0}
    }));
    assert.equal(r.bridgeClosed,true);
    assert.equal(r.failed,'bridge_closed');
    assert.equal(r.completed,false);
});
test('dt grande não fecha a ponte instantaneamente',()=>{
    const m=new Director();advanceToBridge(m);
    const before=m.bridgeSeconds;
    m.update(200,state({mode:'driving',interiorId:null,position:{x:0,z:0}}));
    assert.ok(m.bridgeSeconds-before<=0.051);
});
test('mapa rejeita falsa vitória longe do arco da ponte',()=>{
    assert.equal(Director.crossedBridge({x:60,z:110}),false);
    assert.equal(Director.crossedBridge({x:0,z:-15}),false);
    assert.equal(Director.crossedBridge({x:0,z:92},'on_foot'),false);
});
test('guardar e carregar mantém relógio, viaturas e fase',()=>{
    const m=new Director();advanceToBridge(m);
    for(let i=0;i<48;i++)m.update(.05,state({
        mode:'driving',interiorId:null,position:{x:0,z:0}
    }));
    const snapshot=m.export(),copy=new Director();
    copy.restore(snapshot);
    assert.equal(copy.phase,'bridge');
    assert.equal(copy.vansActivated,true);
    assert.equal(copy.bridgeSeconds,m.bridgeSeconds);
});
test('restauração limita valores adulterados',()=>{
    const m=new Director();
    m.restore({phase:'inexistente',bridgeSeconds:999,bridgeClosing:true});
    assert.equal(m.phase,'warehouse');
    assert.equal(m.bridgeSeconds,19);
    assert.equal(m.bridgeClosed,true);
});
test('reset limpa ponte e vans da missão anterior',()=>{
    const m=new Director();advanceToBridge(m);
    m.reset();
    assert.equal(m.bridgeClosed,false);
    assert.equal(m.vansActivated,false);
    assert.equal(m.bridgeClosing,false);
    assert.equal(m.phase,'warehouse');
});
test('decoração cria pátio fechado e marcador verde da saída',()=>{
    const env={cityGroup:new Node(),buildingBoxes:[],caineBridgeGate:null};
    City.prototype.buildCaineCompoundDetails.call(env);
    assert.ok(env.cityGroup.children.length>=13);
    assert.equal(env.buildingBoxes.length,4);
    assert.equal(env.caineBridgeGate.visible,false);
});
test('portão da ponte bloqueia colisão apenas quando fecha',()=>{
    const env={worldLimit:410,caineBridgeClosed:false,
        buildingBoxes:[],interiorArea:()=>false};
    assert.equal(City.prototype.isPointBlocked.call(env,0,51),false);
    env.caineBridgeClosed=true;
    assert.equal(City.prototype.isPointBlocked.call(env,0,51),true);
    assert.equal(City.prototype.isPointBlocked.call(env,0,30),false);
    // O canal aberto nao e um collider invisivel: a agua permite queda.
    assert.equal(City.prototype.isPointBlocked.call(env,16,51),false);
});
test('acesso ao depósito e carro permanecem fora das paredes novas',()=>{
    const env={cityGroup:new Node(),buildingBoxes:[],caineBridgeGate:null};
    City.prototype.buildCaineCompoundDetails.call(env);
    env.interiorArea=()=>false;
    env.worldLimit=410;env.caineBridgeClosed=false;
    assert.equal(City.prototype.isPointBlocked.call(env,200,-175),false);
    assert.equal(City.prototype.isPointBlocked.call(env,240,-160),false);
    assert.equal(City.prototype.isPointBlocked.call(env,240,-80),false);
});
test('capítulo está no menu e script vem antes da engine',()=>{
    const html=read('index.html');
    const scripts=[...html.matchAll(/src="\.\/(js\/[^"?]+\.js)(?:\?[^"]*)?"/g)].map(x=>x[1]);
    assert.match(html,/id="d2-start-story"/);
    assert.match(read('js/gameplay/campaign-flow.js'), /'story_caine'/);
    assert.match(read('js/engine/driver2-game-engine.js'), /activateNearbyMission\(\)/);
    assert.ok(scripts.indexOf('js/gameplay/caine-compound.js')>=0);
    assert.ok(scripts.indexOf('js/gameplay/caine-compound.js')<
        scripts.indexOf('js/engine/driver2-game-engine.js'));
});
test('motor cria duas vans de Caine em vez de carros policiais',()=>{
    const js=read('js/engine/driver2-game-engine.js');
    assert.match(js,/activateCaineVans\(\)/);
    assert.match(js,/isTarget:true,isPolice:false/);
    assert.match(js,/caineDirector\.update/);
});
test('save persiste o capítulo 7 e os estados da ponte',()=>{
    const js=read('js/gameplay/home-save.js');
    assert.match(js,/story_caine/);
    assert.match(js,/game\.caineDirector\.export\(\)/);
    assert.match(js,/game\.caineDirector\.restore\(data\.caine\)/);
});
test('a página oferece barra visual do tempo da ponte',()=>{
    const html=read('index.html'),js=read('js/engine/driver2-game-engine.js');
    for(const id of ['caine-escape-progress','caine-bridge-fill',
        'caine-escape-phase','caine-escape-detail'])
        assert.match(html,new RegExp('id="'+id+'"'));
    assert.match(js,/BRIDGE_SECONDS/);
});
test('não altera condições das seis missões anteriores',()=>{
    const js=read('js/engine/driver2-game-engine.js');
    for(const name of ['story_tipoff','story_witness','story_train',
        'story_drop','story_safehouse','story_intruder'])
        assert.match(js,new RegExp(name));
});

test('fuga completa é navegável pelo motor de física antes de a ponte fechar',()=>{
    const sources=[
        'js/physics/arcade-dynamics.js',
        'js/police/pursuit-tactics.js',
        'js/gameplay/tailing-drop.js',
        'js/traffic/traffic-ai.js'
    ].map(read).join('\n');
    const {Physics,Traffic}=vm.runInNewContext(sources+
        '\n({Physics:DriverArcadePhysics,Traffic:DriverTrafficAI})',{
            Math,THREE:{MathUtils:{clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}}
        });
    const city={
        roadExtent:320,worldLimit:410,caineBridgeClosed:false,
        isTrafficGreen:()=>true,
        isPointBlocked(x,z,r=1.7) {
            if(Math.abs(x)>410||Math.abs(z)>410)return true;
            if(this.caineBridgeClosed&&Math.abs(x)<11+r&&
                z+r>49.5&&z-r<52.5)return true;
            if(z>33.5&&z<66.5&&Math.abs(x)>=11)return true;
            for(let bx=-320;bx<=320;bx+=80)
                for(let bz=-320;bz<=320;bz+=80){
                    const cx=bx+40,cz=bz-40;
                    if(Math.abs(cz-50)<28||(cx===200&&cz===-200))continue;
                    if(x+r>cx-19.2&&x-r<cx+19.2&&
                        z+r>cz-19.2&&z-r<cz+19.2)return true;
                }
            return false;
        }
    };
    const car={
        x:240,z:-160,heading:0,speed:0,damage:0,maxSpeed:52,accel:28,
        lateralVelocity:0,wheelSpin:0,steerAngle:0,pitchAngle:0,rollAngle:0,
        chassisTilt:{rotation:{x:0,z:0}},bodyStyle:'muscle',
        scriptedDrive:{
            waypoints:[
                {x:240,z:-80},{x:160,z:-80},{x:80,z:-80},{x:0,z:-80},
                {x:0,z:0},{x:0,z:95}
            ],index:0,done:false,maxSpeed:34
        }
    };
    const director=new Director();
    director.update(.05,state({position:{x:200,z:-175},interiorId:null}));
    director.update(.05,state({position:{x:240,z:-160},
        mode:'driving',interiorId:null}));
    const ai=new Traffic(city);
    let collided=0,won=false,seconds=0;
    for(let i=0;i<6000;i++){
        const dt=1/60;
        const input=ai.getInput(car,dt,[car],null,0);
        const steer=input.left?-1:input.right?1:0;
        Physics.update(car,dt,input.up?1:input.down?-1:0,
            steer,input.handbrake,input.sprint);
        const v=Physics.velocity(car);
        const nx=car.x+v.x*dt,nz=car.z+v.z*dt;
        if(city.isPointBlocked(nx,nz,1.7)){collided++;car.speed=0;}
        else{car.x=nx;car.z=nz;}
        const result=director.update(dt,{
            position:{x:car.x,z:car.z},mode:'driving',interiorId:null
        });
        city.caineBridgeClosed=result.bridgeClosed;
        seconds=i/60;
        if(result.failed)assert.fail('A ponte fechou antes da travessia');
        if(result.completed){won=true;break;}
    }
    assert.equal(won,true);
    assert.equal(collided,0);
    assert.ok(seconds<60);
    assert.ok(car.z>66);
});
test('restore de save ativa vans antes de aplicar estados dos veículos',()=>{
    const js=read('js/gameplay/home-save.js');
    const activation=js.indexOf('game.activateCaineVans();');
    const positions=js.indexOf('for(let i=0;i<Math.min(data.vehicles.length');
    assert.ok(activation>0&&activation<positions);
});
