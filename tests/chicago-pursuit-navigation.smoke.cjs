/**
 * Regressão da IA viária em Chicago.
 * node tests/chicago-pursuit-navigation.smoke.cjs
 * Sem WebGL, dependências NPM ou relógio real.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const THREE={MathUtils:{clamp:(n,a,b)=>Math.max(a,Math.min(b,n))}};
const ctx={THREE};
vm.createContext(ctx);
function load(p,name){
    const filename=path.join(__dirname,'..',p);
    vm.runInContext(fs.readFileSync(filename,'utf8')+
        '\nthis.'+name+'='+name+';',ctx,{filename});
    return ctx[name];
}
const Road=load('js/world/road-geometry.js','DriverRoadGeometry');
const Nav=load('js/traffic/pursuit-navigation.js','DriverPursuitNavigation');
const Drop=load('js/gameplay/tailing-drop.js','DriverTailingDropMission');
const Intruder=load('js/gameplay/chicago-intruder.js','DriverIntruderPursuit');
load('js/police/pursuit-tactics.js','PolicePursuitTactics');
const Traffic=load('js/traffic/traffic-ai.js','DriverTrafficAI');

const city={
    preset:{id:'chicago'},roadExtent:320,
    // Faixa de água sem travessia exceto nas duas pontes reais.
    isWaterAt(x,z){
        return z>34.85&&z<65.15 &&
            Math.abs(x)>12.25&&Math.abs(x-240)>10.25;
    },
    isPointBlocked(){return false;},
    isTrafficGreen(){return true;}
};
const start={x:84,z:80},goal={x:84,z:-80};
assert.equal(Nav.clear(city,start,goal),false);
const route=Nav.plan(city,start,goal);
assert(route && route.length>3,'Deve contornar o Rio Chicago');
assert(route.some(p=>Math.abs(p.x)<13||Math.abs(p.x-240)<11),
    'Travessia não passou por uma ponte');
for(let i=1;i<route.length;i++)
    assert(Nav.clear(city,route[i-1],route[i]),
        'Etapa atravessa água ou colisor');
assert.deepEqual([route[route.length-1].x,route[route.length-1].z],
    [goal.x,goal.z]);

// O planejamento fica em cache enquanto o waypoint não muda.
const navHolder={};
Nav.follow(city,start,goal,navHolder,.016);
const state=navHolder.missionNavigation;
assert(state?.path && !state.blocked);
for(let i=0;i<10;i++)Nav.follow(city,start,goal,navHolder,.016);
assert.equal(navHolder.missionNavigation,state);

// Os dois percursos da campanha são navegáveis sem seguir reto pelo rio.
for(const points of [Drop.ROUTE,Intruder.ROUTE]){
    for(let i=1;i<points.length;i++){
        const part=Nav.plan(city,points[i-1],points[i]);
        assert(part,'Rota inacessível: '+JSON.stringify(points[i]));
        for(let j=1;j<part.length;j++)
            assert(Nav.clear(city,part[j-1],part[j]));
    }
}

// Quando as duas pontes fecham, não existe plano que atravesse água.
const closed={
    ...city,
    isWaterAt(x,z){return z>34.85&&z<65.15;}
};
assert.equal(Nav.plan(closed,start,goal),null);
const halt=Nav.follow(closed,start,goal,{},.016);
assert.equal(halt.blocked,true);
assert.equal(halt.target,null);

// A IA de missão não tenta atravessar canal e não teleporta.
const pursued={
    x:84,z:80,y:0,heading:Math.PI,speed:8,bodyStyle:'sedan',
    scriptedDrive:{waypoints:[goal],index:0,done:false,maxSpeed:23}
};
const traffic=new Traffic(city);
let input=traffic.getInput(pursued,.016,[pursued],goal,0);
assert.equal(pursued.scriptedDrive.index,0);
assert.equal(pursued.x,84);
assert(traffic.getRoute(pursued).missionNavigation.path.length>3);
assert(typeof input.left==='boolean');
assert(typeof input.right==='boolean');

// Sem visão direta de Tanner do outro lado do rio, a polícia
// utiliza a memória/radio e uma rota de ruas válida.
const cop={x:84,z:80,y:0,heading:Math.PI,
    speed:10,bodyStyle:'sedan',isPolice:true};
const pursuit=new Traffic(city);
assert.equal(pursuit.unobstructed(cop,goal),false);
pursuit.getInput(cop,.016,[cop],{...goal,heading:0,speed:14},85);
const info=pursuit.getRoute(cop).policeNavHolder?.missionNavigation;
assert(info && info.path && info.path.length>2,
    'A patrulha deveria seguir o último cruzamento conhecido');

// Sem teleportar: uma colisão persistente libera uma ré temporária
// mantendo o waypoint/script intacto.
const stuck={
    x:84,z:-80,y:0,heading:0,speed:0,bodyStyle:'sedan',
    scriptedDrive:{waypoints:[{x:164,z:-80}],index:0,done:false,maxSpeed:23}
};
const stuckAI=new Traffic(city);
let reversed=false;
for(let i=0;i<44;i++){
    const control=stuckAI.getInput(stuck,.05,[stuck],null,0);
    if(control.down && stuckAI.getRoute(stuck).reverseTimer>0)
        reversed=true;
}
assert(reversed,'A IA precisa tentar ré quando colidir e ficar parada');
assert.equal(stuck.scriptedDrive.index,0);
assert.equal(stuck.x,84);

// Veículos em níveis diferentes não fazem o trânsito congelar.
const ahead={x:84,z:-70,y:11};
assert.equal(stuckAI.vehicleAhead(stuck,[stuck,ahead]),Infinity);
console.log('PASS: duas pontes, rotas de missão, A*, memória policial, ré e níveis');
