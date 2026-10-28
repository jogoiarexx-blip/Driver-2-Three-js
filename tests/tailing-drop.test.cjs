'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

const sources=['js/physics/arcade-dynamics.js',
    'js/police/pursuit-tactics.js','js/gameplay/tailing-drop.js',
    'js/traffic/traffic-ai.js'].map(read).join('\n');
const {Physics,Mission,Traffic}=vm.runInNewContext(sources+
    '\n({Physics:DriverArcadePhysics,Mission:DriverTailingDropMission,Traffic:DriverTrafficAI})',
    {Math,THREE:{MathUtils:{clamp:(n,a,b)=>Math.max(a,Math.min(b,n))}}});
const Save=vm.runInNewContext(read('js/gameplay/checkpoint-route.js')+
    '\n'+read('js/world/chicago-train.js')+
    '\n'+read('js/gameplay/home-save.js')+
    '\nDriverHomeSave',{Math,Date,Set,JSON});
function target() {
    return {x:4,z:-54,heading:0,speed:0,maxSpeed:39,accel:24,
        lateralVelocity:0,wheelSpin:0,steerAngle:0,pitchAngle:0,rollAngle:0,
        damage:0,chassisTilt:{rotation:{}},bodyStyle:'muscle',isTarget:true};
}
function player(x=4,z=-108){return{x,z,heading:0,speed:20};}
const fakeCity={
    roadExtent:320,worldLimit:410,
    isPointBlocked(x,z,r=2){
        if(Math.abs(x)>410||Math.abs(z)>410)return true;
        for(let bx=-320;bx<=320;bx+=80){
            for(let bz=-320;bz<=320;bz+=80){
                const cx=bx+40,cz=bz-40;
                if(Math.abs(cz-50)<28 || (cx===200&&cz===-200))continue;
                if(x+r>cx-19.2&&x-r<cx+19.2&&
                    z+r>cz-19.2&&z-r<cz+19.2)return true;
            }
        }
        return false;
    },
    isTrafficGreen(){return true;}
};
test('missão começa a uma distância segura de 54 metros',()=>{
    const info=new Mission().update(.016,player(),target(),'driving');
    assert.equal(info.distance,54);
    assert.equal(info.zone,'green');
    assert.equal(info.failed,null);
});
test('o brasileiro segue sete pontos em direção ao depósito',()=>{
    const car=target();
    const route=Mission.attachRoute(car);
    assert.equal(route.waypoints.length,7);
    assert.equal(route.waypoints[0].z,0);
    assert.equal(route.waypoints[6].x,204);
    assert.equal(route.waypoints[6].z,-160);
});
test('alcançar um waypoint avança somente a rota do suspeito',()=>{
    const car=target();
    Mission.attachRoute(car);
    car.x=4;car.z=0;
    const next=Mission.advanceRoute(car);
    assert.equal(car.scriptedDrive.index,1);
    assert.equal(next.z,80);
});
test('não avança quando ainda está longe da próxima curva',()=>{
    const car=target();Mission.attachRoute(car);
    const before=car.scriptedDrive.index;
    const next=Mission.advanceRoute(car);
    assert.equal(car.scriptedDrive.index,before);
    assert.equal(next.z,0);
});
test('aproximar-se demais faz o suspeito desconfiar',()=>{
    const mission=new Mission(),car=target();
    for(let i=0;i<12;i++)mission.update(.05,{x:car.x,z:car.z-5},car);
    assert.ok(mission.suspicion>30);
    assert.equal(mission.lastStatus,'close');
});
test('insistir na traseira do suspeito resulta em ser visto',()=>{
    const mission=new Mission(),car=target();
    let result;
    for(let i=0;i<45;i++)result=mission.update(.05,car,car);
    assert.equal(result.failed,'seen');
    assert.equal(result.complete,false);
});
test('sair do ponto cego recupera a barra de suspeita',()=>{
    const mission=new Mission(),car=target();
    for(let i=0;i<10;i++)mission.update(.05,car,car);
    const initial=mission.suspicion;
    for(let i=0;i<40;i++)mission.update(.05,player(),car);
    assert.ok(mission.suspicion<initial);
    assert.equal(mission.lastStatus,'green');
});
test('ficar muito longe do carro faz perder o alvo',()=>{
    const mission=new Mission(),car=target();
    let result;
    for(let i=0;i<65;i++)
        result=mission.update(.05,{x:car.x,z:car.z-200},car);
    assert.equal(result.failed,'lost');
});
test('voltar para o intervalo verde reduz contador de perda',()=>{
    const mission=new Mission(),car=target();
    for(let i=0;i<9;i++)mission.update(.05,{x:car.x,z:car.z-200},car);
    const previous=mission.lost;
    for(let i=0;i<25;i++)mission.update(.05,player(),car);
    assert.ok(mission.lost<previous);
});
test('chegar ao depósito sem espionagem segura não completa',()=>{
    const mission=new Mission(),car=target();
    Mission.attachRoute(car);
    car.scriptedDrive.done=true;car.x=200;car.z=-160;
    const position={x:200,z:-210};
    const result=mission.update(.016,position,car,'driving');
    assert.equal(result.arrived,true);
    assert.equal(result.complete,false);
});
test('seguir discretamente e acompanhar o carro até o depósito conclui',()=>{
    const mission=new Mission(),car=target();
    Mission.attachRoute(car);
    for(let i=0;i<110;i++)mission.update(.05,player(),car);
    car.scriptedDrive.done=true;car.x=200;car.z=-160;
    const result=mission.update(.05,{x:200,z:-205},car,'driving');
    assert.equal(result.arrived,true);
    assert.equal(result.failed,null);
    assert.equal(result.complete,true);
});
test('chegada a pé não conclui vigilância que exige carro',()=>{
    const mission=new Mission(),car=target();
    Mission.attachRoute(car);
    for(let i=0;i<105;i++)mission.update(.05,player(),car);
    car.scriptedDrive.done=true;car.x=200;car.z=-160;
    const result=mission.update(.05,{x:200,z:-210},car,'on_foot');
    assert.equal(result.complete,false);
});
test('acertar o suspeito repetidamente pode arruinar a missão',()=>{
    const mission=new Mission(),car=target();
    car.damage=98;
    assert.equal(mission.update(.016,player(),car).failed,'wrecked');
});
test('missões reiniciadas não reutilizam suspeita ou distância',()=>{
    const mission=new Mission();mission.suspicion=80;mission.lost=65;
    mission.failed='seen';mission.reset();
    assert.equal(mission.suspicion,0);
    assert.equal(mission.lost,0);
    assert.equal(mission.failed,null);
});
test('IA específica ignora o jogador quando seleciona próximo alvo',()=>{
    const car=target();Mission.attachRoute(car);
    const ai=new Traffic(fakeCity);
    const first=ai.getInput(car,.016,[car],{x:-100,z:0},0);
    assert.equal(car.scriptedDrive.index,0);
    assert.equal(first.up,true);
});
test('tráfego guiado respeita semáforo vermelho na aproximação',()=>{
    const car=target();Mission.attachRoute(car);
    car.z=-18;car.speed=12;
    const city={...fakeCity,isTrafficGreen:()=>false};
    const ai=new Traffic(city);
    const input=ai.getInput(car,.016,[car],player(),0);
    assert.equal(input.down,true);
});
test('veículo ao alcançar o destino deixa de acelerar',()=>{
    const car=target();Mission.attachRoute(car);
    car.scriptedDrive.index=6;car.x=204;car.z=-160;car.speed=0;
    const ai=new Traffic(fakeCity);
    const control=ai.getInput(car,.016,[car],player(),0);
    assert.equal(car.scriptedDrive.done,true);
    assert.equal(control.up,false);
});
test('simulação do motor percorre a rota inteira sem atravessar prédio',()=>{
    const car=target();Mission.attachRoute(car);
    const ai=new Traffic(fakeCity);
    let collisions=0,frames=0;
    for(frames=0;frames<5200&&!car.scriptedDrive.done;frames++){
        const dt=1/60;
        const input=ai.getInput(car,dt,[car],null,0);
        const steer=input.left?-1:input.right?1:0;
        const throttle=input.up?1:input.down?-1:0;
        Physics.update(car,dt,throttle,steer,input.handbrake,input.sprint);
        const velocity=Physics.velocity(car);
        const nextX=car.x+velocity.x*dt,nextZ=car.z+velocity.z*dt;
        if(!fakeCity.isPointBlocked(nextX,nextZ,1.7)){
            car.x=nextX;car.z=nextZ;
        }else{car.speed=0;collisions++;}
    }
    assert.equal(collisions,0);
    assert.equal(car.scriptedDrive.done,true);
    assert.ok(frames<5200);
    assert.ok(Math.hypot(car.x-200,car.z+179)<32);
});
test('save aceita a missão furtiva e locais adicionais dentro da cidade',()=>{
    const store=new Save({});
    for(const room of ['home','warehouse','diner','garage']){
        const raw={version:1,city:'chicago',interior:room,
            mission:{type:'story_drop'},
            tanner:{x:1180,z:0},vehicles:[{x:0,z:0}]};
        assert.equal(store.valid(raw),true);
    }
});
test('motor restaura coordenadas estendidas de uma oficina',()=>{
    assert.equal(Save.position({x:1180,y:0,z:0}).x,1180);
    assert.equal(Save.position({x:15000,y:0,z:0}).x,1500);
});
test('UI inclui medidor e missão de história no menu',()=>{
    const html=read('index.html'),game=read('js/engine/driver2-game-engine.js');
    assert.match(html,/id="tail-proximity"/);
    assert.match(html,/id="tail-needle"/);
    assert.match(html,/id="d2-start-story"/);
    assert.match(read('js/gameplay/campaign-flow.js'), /'story_drop'/);
    assert.match(read('js/engine/driver2-game-engine.js'), /activateNearbyMission\(\)/);
    assert.match(game,/new DriverTailingDropMission\(\)/);
    assert.match(game,/this\.dropDirector\.update\(/);
});
test('progresso da missão inclui rota e indicadores persistentes',()=>{
    const save=read('js/gameplay/home-save.js');
    assert.match(save,/routeIndex:game\.targetCar/);
    assert.match(save,/director\.suspicion=/);
    assert.match(save,/director\.safeSeconds=/);
});
test('lanchonete e oficina são reservadas com interiores independentes',()=>{
    const code=read('js/world/city-builder.js');
    assert.match(code,/buildEnterableStore\(blockX,blockZ,'diner'\)/);
    assert.match(code,/buildEnterableStore\(blockX,blockZ,'garage'\)/);
    assert.match(code,/inside:\{x:diner\?1120:1180,z:0\}/);
});

test('módulo furtivo vem antes da inteligência de tráfego',()=>{
    const html=read('index.html');
    const scripts=[...html.matchAll(/src="\.\/(js\/[^"?]+\.js)(?:\?[^"]*)?"/g)]
        .map(m=>m[1]);
    assert.ok(scripts.indexOf('js/gameplay/tailing-drop.js') <
        scripts.indexOf('js/traffic/traffic-ai.js'));
});
test('salvamento só aparece dentro da casa, não na lanchonete',()=>{
    const src=read('js/engine/driver2-game-engine.js');
    assert.match(src,/saveButton\.classList\.toggle\('hidden'/);
    assert.match(src,/this\.interiorPlace\?\.id!=='home'/);
    assert.match(read('index.html'),/id="interior-title"/);
});
