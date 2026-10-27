'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
class Node{
 constructor(){this.children=[];this.rotation={y:0};this.name='';}
 add(obj){this.children.push(obj);}
 traverse(fn){fn(this);this.children.forEach(c=>c.traverse(fn))}
 getObjectByName(name){let found=null;this.traverse(obj=>{
   if(obj.name===name)found=obj;
 });return found;}
}
const THREE={Group:Node};
const Rig=vm.runInNewContext(
 read('js/vehicles/police-door-rig.js')+'\nDriverPoliceDoorRig',
 {Math,Number,THREE,Array,Object});
function model(){
 const root=new Node(),left=new Node(),right=new Node();
 left.name='police_left_door_hinge';
 right.name='police_right_door_hinge';
 root.add(left);root.add(right);
 return {root,left,right};
}
test('Tanner usa lado do motorista oposto ao passageiro do GLB anterior',()=>{
 const m=model();
 const car={x:0,y:0,z:0,heading:0,_userCustomModel:true,
    isPolice:false,_policeCustomModel:false};
 assert.equal(Rig.mount(car,m.root),true);
 assert.equal(car.policeDoorRig.side,'right');
 const p=Rig.standPoint(car,2.25);
 assert.ok(p.x>2.20&&p.x<2.3);
 assert.equal(p.z,0);
 assert.equal(Rig.start(car,'enter'),true);
 Rig.update(car,.08);
 assert.equal(m.left.rotation.y,0);
 assert.ok(m.right.rotation.y<0);
});
test('polícia preserva porta configurada enquanto Tanner usa a outra',()=>{
 const m=model();
 const car={x:10,y:0,z:-15,heading:0,isPolice:true,
    _userCustomModel:true,_policeCustomModel:true};
 assert.equal(Rig.mount(car,m.root),true);
 assert.equal(car.policeDoorRig.side,'left');
 assert.equal(Rig.standPoint(car,2.4).x,7.6);
 Rig.start(car,'exit');Rig.update(car,.08);
 assert.ok(m.left.rotation.y>0);
 assert.equal(m.right.rotation.y,0);
});
test('lado escolhido segue rotação do carro e não câmera',()=>{
 const m=model();
 const car={x:12,z:20,y:0,heading:Math.PI/2,_userCustomModel:true};
 Rig.mount(car,m.root);
 const approach=Rig.standPoint(car,2.4);
 assert.ok(Math.abs(approach.x-12)<1e-8);
 assert.ok(Math.abs(approach.z-17.6)<1e-8);
 car.heading=Math.PI;
 const back=Rig.standPoint(car,2.4);
 assert.ok(Math.abs(back.x-9.6)<1e-8);
 assert.ok(Math.abs(back.z-20)<1e-8);
});
test('ambos os lados fecham e resetam durante troca PS1 ou saída',()=>{
 const m=model();
 const car={x:0,z:0,_userCustomModel:true};
 Rig.mount(car,m.root);
 let called=0;
 Rig.start(car,'enter',()=>called++);
 for(let i=0;i<20;i++)Rig.update(car,.08);
 assert.equal(car.policeDoorRig.phase,'closed');
 assert.equal(m.left.rotation.y,0);
 assert.equal(m.right.rotation.y,0);
 assert.equal(called,1);
 Rig.start(car,'exit',()=>called++);
 Rig.update(car,.08);
 Rig.cancel(car);
 assert.equal(m.right.rotation.y,0);
 assert.equal(called,1);
});
test('HUD restaura dano, delito e quatro climas sem barra lotada',()=>{
 const html=read('index.html');
 const css=read('css/styles.css');
 for(const id of ['hud-player-panel','damage-pct','damage-bar',
    'felony-pct','felony-bar','weather-badge',
    'driver-hud-weather-controls','btn-main-menu'])
    assert.ok(html.includes('id="'+id+'"'),id);
 for(const mode of ['day','dusk','night','rain'])
    assert.ok(html.includes("window.DriverGame.setWeather('"+mode+"')"));
 assert.ok(css.includes('#driver-hud-weather-controls {'));
 assert.ok(css.includes('display:block!important;'));
 assert.ok(css.includes('#driver-hud-city-controls {display:none!important;}'));
 const restored=css.lastIndexOf('#hud-player-panel {');
 const oldHide=css.indexOf('#hud-player-panel,');
 assert.ok(restored>oldHide);
 assert.ok(css.includes('justify-content:space-between!important;'));
});
test('mostrador anos 1990 tem ponteiro funcional e escala 0 a 220',()=>{
 const html=read('index.html'),css=read('css/styles.css');
 const game=read('js/engine/driver2-game-engine.js');
 assert.ok(html.includes('class="speedometer-90s pointer-events-none"'));
 for(const id of ['speed-needle','speed-value','speed-gear',
    'rpm-bar','car-name-label','drift-badge','siren-badge'])
     assert.equal(html.split('id="'+id+'"').length-1,1,id);
 assert.ok(html.includes('rotate(-130 120 101)'));
 assert.ok(html.includes('>220</text>'));
 assert.ok(html.includes('INSTRUMENTOS <small>1990</small>'));
 assert.ok(css.includes('.speedometer-90s {'));
 assert.ok(css.includes('.speedometer-90s-dial {'));
 assert.ok(game.includes('const angle=-130+Math.min(220,kmh)/220*260'));
 assert.ok(game.includes("needle.setAttribute('transform'"));
 for(const [kmh,angle] of [[0,-130],[110,0],[220,130],[300,130]])
     assert.equal(-130+Math.min(220,kmh)/220*260,angle);
});
test('Tanner usa função única ao entrar, aproximar e sair',()=>{
 const game=read('js/engine/driver2-game-engine.js');
 assert.ok(game.split('DriverPoliceDoorRig.standPoint(vehicle,').length-1>=4);
 assert.ok(game.includes('entry.x,entry.y,entry.z,entry.heading'));
 assert.ok(game.includes('exit.x,exit.y,exit.z,exit.heading'));
 assert.ok(game.includes('const near=DriverPoliceDoorRig.standPoint(vehicle,1.08)'));
});
