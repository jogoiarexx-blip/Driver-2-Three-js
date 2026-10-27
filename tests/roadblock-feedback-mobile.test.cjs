'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

class Transform {
    constructor(){
        this.x=0;this.y=0;this.z=0;
    }
    set(x,y,z){this.x=x;this.y=y;this.z=z;}
}
class Node {
    constructor(){
        this.position=new Transform();
        this.rotation=new Transform();
        this.scale=new Transform();this.scale.set(1,1,1);
        this.children=[];this.parent=null;this.visible=true;
    }
    add(...nodes){nodes.forEach(n=>{n.parent=this;this.children.push(n);});}
    remove(n){this.children=this.children.filter(x=>x!==n);n.parent=null;}
}
class Geometry{
    constructor(){}
    rotateX(){return this;}
}
class Material{
    constructor(args={}){this.opacity=args.opacity??1;this.color={setHex(){}};}
    clone(){return new Material({opacity:this.opacity});}
}
class Mesh extends Node {
    constructor(geometry,material){super();this.geometry=geometry;this.material=material;}
    clone(){const n=new Mesh(this.geometry,this.material);n.position.set(this.position.x,this.position.y,this.position.z);return n;}
}
class BufferGeometry {
    constructor(){this.attributes={};}
    setAttribute(key,v){this.attributes[key]=v;}
}
class Points extends Mesh{}
const THREE={
    Group:Node,Mesh,Points, BoxGeometry:Geometry,
    CylinderGeometry:Geometry, PlaneGeometry:Geometry,
    BufferGeometry, BufferAttribute:class {constructor(array,itemSize){this.array=array;this.itemSize=itemSize;}},
    MeshLambertMaterial:Material, MeshBasicMaterial:Material, PointsMaterial:Material,
    MathUtils:{clamp:(x,a,b)=>Math.max(a,Math.min(b,x))}
};
const context={THREE,Math,Float32Array,
    GPUResourceUtils:{disposeSubtree(){}}
};
const Director=vm.runInNewContext(
    read('js/police/roadblock-director.js')+'\nPoliceRoadblockDirector',context);
const Ped=vm.runInNewContext(
    read('js/entities/pedestrians-roadblocks.js')+'\nPedestrianAndRoadblockManager',context);
const Traffic=vm.runInNewContext(
    read('js/police/pursuit-tactics.js')+'\n'+
    read('js/traffic/traffic-ai.js')+'\nDriverTrafficAI',context);
const Feedback=vm.runInNewContext(
    read('js/render/impact-feedback.js')+'\nDriverImpactFeedback',context);
const Effects=vm.runInNewContext(
    read('js/render/effects-manager.js')+'\nEffectsManager',context);
function scene(){return{nodes:[],add(n){this.nodes.push(n);},remove(n){this.nodes=this.nodes.filter(v=>v!==n);}};}
function car(x=0,z=90,speed=20){return{x,z,speed,heading:0};}
function manager(){
    return new Ped(scene());
}
test('diretor rejeita pontos já ocupados pelo tráfego',()=>{
    const d=new Director();
    const city={isPointBlocked:()=>false};
    const parked=[car(0,80,0),car(0,120,0),car(0,160,0)];
    const candidate=d.candidate(car(4,-20),city,parked);
    assert.equal(candidate,null);
});
test('diretor só coloca bloqueio à frente do motorista',()=>{
    const d=new Director();
    const city={isPointBlocked:()=>false};
    const p=d.candidate(car(4,-20),city,[]);
    assert.ok(p);
    assert.ok((p.z+20)>56);
});
test('aviso só aparece diante de bloqueios vivos',()=>{
    const d=new Director();
    d.active=true;
    d.lastCenter={x:0,z:90,axis:'z'};
    const live={roadblocks:[{dynamic:true,smashed:false,arming:0.9}]};
    const alert=d.warning(car(0,0),live);
    assert.ok(alert);
    assert.equal(alert.arming,true);
    assert.equal(alert.distance,90);
    live.roadblocks[0].smashed=true;
    assert.equal(d.warning(car(0,0),live),null);
});
test('aviso não aparece se o jogador já passou o bloqueio',()=>{
    const d=new Director();
    d.active=true;d.lastCenter={x:0,z:20,axis:'z'};
    const live={roadblocks:[{dynamic:true,smashed:false}]};
    assert.equal(d.warning(car(0,100),live),null);
});
test('bloqueio some quando Tanner deixa de dirigir',()=>{
    const d=new Director();d.active=true;
    d.lastCenter={x:0,z:90,axis:'z'};
    let cleared=0;
    const ped={roadblocks:[{dynamic:true,smashed:false}],clearDynamicRoadblocks(){
        cleared++;this.roadblocks=[];}};
    d.update(0.016,{pedManager:ped,mode:'on_foot',felony:95,playerCar:car(),
        missionType:'freeroam',getPlayerPosition:()=>({x:0,z:0})});
    assert.equal(cleared,1);
    assert.equal(d.active,false);
});
test('spawn gera três cavaletes e beacons sem PointLight',()=>{
    const ped=manager();
    ped.spawnPoliceRoadblocks({}, {dynamic:true,locations:[{x:0,z:90,axis:'z'}]});
    assert.equal(ped.roadblocks.length,3);
    assert.ok(ped.roadblocks.every(b=>b.beacon && b.arming===1.25));
});
test('bloqueio em montagem ainda não pode ser destruído',()=>{
    const ped=manager(),player=car();
    ped.spawnPoliceRoadblocks({}, {dynamic:true,locations:[{x:0,z:90,axis:'z'}]});
    let hit=0;
    ped.update(0.1,[player],null,player,()=>hit++);
    assert.equal(hit,0);
    assert.equal(ped.roadblocks.filter(b=>b.smashed).length,0);
});
test('polícia não destrói a própria barreira',()=>{
    const ped=manager(),officer=car(),player=car(60,60,15);
    ped.spawnPoliceRoadblocks({}, {dynamic:true,locations:[{x:0,z:90,axis:'z'}]});
    for(let i=0;i<30;i++)ped.update(0.05,[officer,player],null,player);
    assert.equal(ped.roadblocks.filter(b=>b.smashed).length,0);
});
test('jogador pode romper barricada preparada',()=>{
    const ped=manager(),officer=car(60,60),player=car();
    ped.spawnPoliceRoadblocks({}, {dynamic:true,locations:[{x:0,z:90,axis:'z'}]});
    for(let i=0;i<30;i++)ped.update(0.05,[officer,player],null,player);
    assert.equal(ped.roadblocks.filter(b=>b.smashed).length,1);
});
test('rompimento dispara retorno de impacto',()=>{
    const ped=manager(),player=car();
    ped.spawnPoliceRoadblocks({}, {dynamic:false,locations:[{x:0,z:90,axis:'z'}]});
    const entries=[];
    ped.update(1/60,[player],null,player,(p,block,speed)=>entries.push({p,block,speed}));
    assert.equal(entries.length,1);
    assert.equal(entries[0].p,player);
    assert.equal(entries[0].speed,20);
});
test('limpeza remove apenas barricadas dinâmicas',()=>{
    const ped=manager();
    ped.spawnPoliceRoadblocks({}, {dynamic:false,locations:[{x:0,z:90,axis:'z'}]});
    ped.spawnPoliceRoadblocks({}, {dynamic:true,locations:[{x:0,z:120,axis:'z'}]});
    ped.clearDynamicRoadblocks();
    assert.equal(ped.roadblocks.length,4);
    assert.ok(ped.roadblocks.every(b=>!b.dynamic));
});
test('impacto forte provoca tremor amortecido e dissipação',()=>{
    const fx=new Feedback();
    const cam={position:{x:0,y:0,z:0}};
    const el={style:{}};
    fx.trigger(40);
    const first=fx.update(0.016,cam,el,false);
    assert.ok(first>0 && first<=0.30);
    assert.notEqual(cam.position.x,0);
    for(let i=0;i<70;i++)fx.update(0.016,cam,el,false);
    assert.equal(fx.strength,0);
    assert.equal(el.style.opacity,'0.000');
});
test('opção de movimento reduzido desativa tremor e flash',()=>{
    const fx=new Feedback(),cam={position:{x:0,y:0,z:0}};
    const el={style:{}};
    fx.trigger(50);
    assert.equal(fx.update(0.01,cam,el,true),0);
    assert.equal(cam.position.x,0);
    assert.equal(el.style.opacity,'0.000');
});
test('faíscas reutilizam pool limitado e desaparecem',()=>{
    const effects=new Effects(scene());
    assert.equal(effects.impactSparks.length,22);
    for(let i=0;i<10;i++)effects.spawnImpactSparks(0,0,0,1);
    assert.ok(effects.impactSparks.filter(p=>p.life>0).length<=22);
    effects.update(2.1);
    assert.ok(effects.impactSparks.every(p=>!p.mesh.visible));
    assert.ok(effects.spawnImpactSparks(0,0,0,0.5)>0);
});
test('HTML e CSS expõem os controles móveis e alertas',()=>{
    const html=read('index.html'),css=read('css/styles.css');
    const engine=read('js/engine/driver2-game-engine.js');
    assert.match(html,/id="mission-compact-progress"/);
    assert.match(html,/id="btn-objective-toggle"/);
    assert.match(html,/id="btn-hud-more"/);
    assert.match(html,/id="roadblock-warning"/);
    assert.match(html,/id="impact-flash"/);
    assert.match(css,/#hud-top-row/);
    assert.match(engine,/roadblockDirector\.warning\(/);
    assert.match(engine,/impactFeedback\.trigger\(/);
});

test('tráfego civil freia diante de bloqueio intacto',()=>{
    const city={isPointBlocked:()=>false,isTrafficGreen:()=>true};
    const ai=new Traffic(city);
    const vehicle={x:4,z:-95,heading:0,speed:16,bodyStyle:'muscle',isPolice:false,isTarget:false};
    ai.policeRoadblocks=[{x:4,z:-72,arming:0,smashed:false,dynamic:true}];
    assert.equal(ai.getInput(vehicle,1/60,[vehicle],null,0).down,true);
});
test('viatura retoma perseguição após barricada destruída',()=>{
    const city={isPointBlocked:()=>false,isTrafficGreen:()=>true};
    const ai=new Traffic(city);
    const police={x:4,z:-95,heading:0,speed:16,bodyStyle:'muscle',
        isPolice:true,isTarget:false};
    const barrier={x:4,z:-72,arming:0,smashed:false,dynamic:true};
    ai.policeRoadblocks=[barrier];
    const player={x:4,z:0,heading:0,speed:0};
    assert.equal(ai.getInput(police,1/60,[police],player,90).down,true);
    barrier.smashed=true;
    assert.equal(ai.getInput(police,1/60,[police],player,90).up,true);
});


test('dois policiais são posicionados fora da pista do bloqueio vertical',()=>{
    const ped=manager();
    ped.spawnPoliceRoadblocks({}, {dynamic:true,locations:[{x:0,z:90,axis:'z'}]});
    assert.equal(ped.roadblockOfficers.length,2);
    assert.ok(ped.roadblockOfficers.every(o=>Math.abs(o.mesh.position.x)>=12));
    assert.equal(ped.roadblocks.length,3);
});
test('bloqueio horizontal posiciona agentes nas calçadas transversais',()=>{
    const ped=manager();
    ped.spawnPoliceRoadblocks({}, {dynamic:true,locations:[{x:80,z:0,axis:'x'}]});
    assert.equal(ped.roadblockOfficers.length,2);
    assert.ok(ped.roadblockOfficers.every(o=>Math.abs(o.mesh.position.z)>=12));
});
test('policiais sinalizam parar durante a animação',()=>{
    const ped=manager();
    ped.spawnPoliceRoadblocks({}, {dynamic:true,locations:[{x:0,z:90,axis:'z'}]});
    const officer=ped.roadblockOfficers[0];
    const first=officer.arms[0].rotation.z;
    ped.updateRoadblockOfficers(0.16, null);
    assert.notEqual(officer.arms[0].rotation.z,first);
    assert.ok(officer.arms[0].rotation.z < -0.4);
});
test('policiais recuam em direção ao acostamento quando Tanner se aproxima',()=>{
    const ped=manager();
    ped.spawnPoliceRoadblocks({}, {dynamic:true,locations:[{x:0,z:90,axis:'z'}]});
    const officer=ped.roadblockOfficers[1];
    ped.updateRoadblockOfficers(0.15,{x:officer.x,z:officer.z});
    assert.ok(officer.retreat>0);
    assert.ok(Math.abs(officer.mesh.position.x)>Math.abs(officer.x));
});
test('limpar barricadas dinâmicas remove os agentes associados',()=>{
    const ped=manager();
    ped.spawnPoliceRoadblocks({}, {dynamic:true,locations:[{x:0,z:90,axis:'z'}]});
    ped.clearDynamicRoadblocks();
    assert.equal(ped.roadblocks.length,0);
    assert.equal(ped.roadblockOfficers.length,0);
});
test('barricada da missão Fura-Bloqueios não cria guardas adicionais',()=>{
    const ped=manager();
    ped.spawnPoliceRoadblocks({}, {dynamic:false});
    assert.equal(ped.roadblockOfficers.length,0);
    assert.equal(ped.roadblocks.length,12);
});
test('recriar pedestres limpa lista de policiais de bloqueios anteriores',()=>{
    const ped=manager();
    ped.spawnPoliceRoadblocks({}, {dynamic:true,locations:[{x:0,z:90,axis:'z'}]});
    ped.spawnCityPedestrians();
    assert.equal(ped.roadblockOfficers.length,0);
    assert.equal(ped.roadblocks.length,0);
    assert.equal(ped.pedestrians.length,28);
});
test('polícia guarda última posição vista quando Tanner foge do campo de visão',()=>{
    const ai=new Traffic({isPointBlocked:()=>false,isTrafficGreen:()=>true});
    const cop={x:4,z:0,heading:0,isPolice:true};
    const first=ai.pursuitInformation(cop,.016,{x:4,z:35,heading:0,speed:20},85);
    assert.equal(first.z,35);
    const lost=ai.pursuitInformation(cop,.5,{x:150,z:160,heading:0,speed:20},85);
    assert.equal(lost.x,4);
    assert.equal(lost.z,35);
    assert.equal(ai.policeMemory.get(cop).visible,false);
});
test('rádio envia localização aproximada, não a posição exata',()=>{
    const ai=new Traffic({isPointBlocked:()=>false,isTrafficGreen:()=>true});
    const cop={x:0,z:0,heading:0,isPolice:true};
    const dispatched=ai.pursuitInformation(cop,.016,
        {x:135,z:93,heading:1.4,speed:40},90);
    assert.equal(dispatched.x,160);
    assert.equal(dispatched.z,80);
    assert.equal(dispatched.speed,0);
});
test('informação de rádio expira antes do próximo aviso',()=>{
    const ai=new Traffic({isPointBlocked:()=>false,isTrafficGreen:()=>true});
    const cop={x:0,z:0,heading:0,isPolice:true};
    const fugitive={x:135,z:93,heading:0,speed:0};
    assert.ok(ai.pursuitInformation(cop,.016,fugitive,90));
    assert.equal(ai.pursuitInformation(cop,6,fugitive,90),null);
    assert.ok(ai.pursuitInformation(cop,5,fugitive,90));
});
test('procurar jogador em fuga não reaproveita memória depois do reset',()=>{
    const ai=new Traffic({isPointBlocked:()=>false,isTrafficGreen:()=>true});
    const cop={x:0,z:0,heading:0,isPolice:true};
    ai.pursuitInformation(cop,.016,{x:0,z:30},90);
    ai.reset();
    assert.equal(ai.policeMemory.has(cop),false);
});


test('viatura em manobra ativa não vira quando perdeu a visão',()=>{
    const ai=new Traffic({isPointBlocked:()=>false,isTrafficGreen:()=>true});
    const cop={x:0,z:-22,heading:0,speed:23,pursuitRole:1,isPolice:true,bodyStyle:'muscle'};
    const visible={x:0,z:0,heading:0,speed:24};
    ai.getInput(cop,1/60,[cop],visible,90);
    assert.equal(cop.policeManeuver,'flank');
    ai.city.isPointBlocked=()=>true;
    ai.getInput(cop,1/60,[cop],{x:100,z:0,heading:0,speed:26},90);
    assert.equal(cop.policeManeuver,null);
});
