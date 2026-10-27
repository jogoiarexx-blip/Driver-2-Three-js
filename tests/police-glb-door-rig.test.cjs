'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
class Node {
    constructor(){this.name='';this.children=[];this.parent=null;this.rotation={y:0};
        this.position={set(x,y,z){this.x=x;this.y=y;this.z=z}};}
    add(v){v.parent=this;this.children.push(v)}
    traverse(fn){fn(this);for(const v of this.children)v.traverse(fn)}
    getObjectByName(name){let result=null;this.traverse(x=>{if(x.name===name)result=x});return result}
}
class Geometry{
    constructor(){this.attributes={};this.index=null}
    setAttribute(k,v){this.attributes[k]=v}
    setIndex(a){this.index={count:a.length,getX:i=>a[i]}}
}
class Mesh extends Node{
    constructor(geometry,material){super();this.isMesh=true;this.geometry=geometry;this.material=material;}
}
const THREE={Group:Node,BufferGeometry:Geometry,Mesh};
const Rig=vm.runInNewContext(read('js/vehicles/police-door-rig.js')+
    '\nDriverPoliceDoorRig',{THREE,Math,Number,Object,Array});
test('GLB com portas reais recebe seus pivôs sem duplicar carroceria',()=>{
    const root=new Node(),left=new Node(),right=new Node();
    left.name='police_left_door_hinge';
    right.name='police_right_door_hinge';
    root.add(left);root.add(right);
    const vehicle={isPolice:true};
    assert.equal(Rig.mount(vehicle,root),true);
    assert.equal(root.children.length,2);
    assert.equal(vehicle.policeDoorRig.left,left);
    assert.equal(vehicle.policeDoorRig.right,right);
});
test('porta abre, segura, fecha e conclui a entrada apenas uma vez',()=>{
    const root=new Node(),hinge=new Node();
    hinge.name='police_left_door_hinge';root.add(hinge);
    const vehicle={isPolice:true};
    assert.equal(Rig.mount(vehicle,root),true);
    let completed=0;
    assert.equal(Rig.start(vehicle,'enter',()=>completed++),true);
    assert.equal(Rig.start(vehicle,'enter',()=>completed++),false);
    Rig.update(vehicle,.08);
    assert.ok(hinge.rotation.y>0);
    for(let i=0;i<16;i++)Rig.update(vehicle,.08);
    assert.equal(vehicle.policeDoorRig.phase,'closed');
    assert.equal(hinge.rotation.y,0);
    assert.equal(completed,1);
});
test('saída animada pode ser cancelada em troca de cidade',()=>{
    const root=new Node(),hinge=new Node();
    hinge.name='police_left_door_hinge';root.add(hinge);
    const vehicle={isPolice:true};Rig.mount(vehicle,root);
    let entered=0;
    Rig.start(vehicle,'exit',()=>entered++);
    Rig.update(vehicle,.08);
    Rig.cancel(vehicle);
    for(let i=0;i<30;i++)Rig.update(vehicle,.08);
    assert.equal(entered,0);
    assert.equal(vehicle.policeDoorRig.phase,'closed');
    assert.equal(hinge.rotation.y,0);
});
test('GLB monolítico separa painéis frontais usando índices e mesmo material',()=>{
    const positions=[];
    const faceIndices=[];
    function face(n,x,y,z){
        for(let i=0;i<n;i++){
            for(let k=0;k<3;k++){
                faceIndices.push(positions.length);
                positions.push({x:x+k*.0001,y,z});
            }
        }
    }
    face(1300,-.2,0,-.32);face(1300,-.2,0,.32);
    face(2400,.75,-.22,0);
    const pos={count:positions.length,getX:i=>positions[i].x,
        getY:i=>positions[i].y,getZ:i=>positions[i].z};
    const geom=new Geometry();
    geom.setAttribute('position',pos);
    geom.setIndex(faceIndices);
    const body=new Mesh(geom,{name:'original'});
    const root=new Node();root.add(body);
    const vehicle={isPolice:true};
    assert.equal(Rig.mount(vehicle,root),true);
    assert.equal(body.geometry.index.count,2400*3);
    assert.equal(body.children.length,2);
    assert.equal(body.children[0].children[0].material,body.material);
    assert.equal(body.children[1].children[0].material,body.material);
    assert.equal(body.children[0].children[0].geometry.index.count,1300*3);
    assert.equal(body.children[1].children[0].geometry.index.count,1300*3);
});
test('modelo que não possui porta detectável mantém fallback seguro',()=>{
    const root=new Node(),body=new Mesh(new Geometry(),{});
    root.add(body);const vehicle={isPolice:true};
    assert.equal(Rig.mount(vehicle,root),false);
    assert.equal(vehicle.policeDoorRig,undefined);
});
test('viaturas usam arquivo local antes de Kenney e conservam sirene e danos',()=>{
    const lib=read('js/assets/free-vehicle-library.js');
    const vehicle=read('js/vehicles/driver-vehicle.js');
    const engine=read('js/engine/driver2-game-engine.js');
    const html=read('index.html');
    const boot=read('js/ui/driver-boot-flow.js');
    assert.match(lib,/policeModelUrl='\.\/assets\/vehicles\/car%20police\.glb'/);
    assert.match(lib,/getPoliceTemplate\(\)/);
    assert.match(lib,/applyPoliceModel\(vehicle,template\)/);
    assert.match(lib,/DriverPoliceDoorRig\.mount\(vehicle,wrapped\)/);
    assert.match(vehicle,/this\.sirenAssembly/);
    assert.match(vehicle,/this\.damageGroup/);
    assert.match(engine,/startPoliceDoorTransition\(vehicle,kind\)/);
    assert.match(engine,/DriverPoliceDoorRig\.update/);
    assert.match(engine,/vehicle===this\.policeDoorTransition\?\.vehicle/);
    assert.match(boot,/getPoliceTemplate\(\)/);
    const a=html.indexOf('js/vehicles/police-door-rig.js');
    assert.ok(a>html.indexOf('js/vehicles/vehicle-wheel-rig.js'));
    assert.ok(a<html.indexOf('js/assets/free-vehicle-library.js'));
});

test('GLB policial publicado no GitHub contém duas dobradiças reais e textura preservada',()=>{
    const lib=read('js/assets/free-vehicle-library.js');
    const pathMatch=lib.match(/this\.policeModelUrl='\.\/(assets\/vehicles\/[^']+)'/);
    assert.ok(pathMatch,'o caminho precisa estar declarado no carregador');
    const relative=decodeURIComponent(pathMatch[1]);
    const bytes=fs.readFileSync(path.join(__dirname,'..',relative));
    assert.ok(bytes.length>1000000,'o modelo de polícia foi encontrado');
    assert.equal(bytes.subarray(0,4).toString('ascii'),'glTF');
    assert.equal(bytes.readUInt32LE(8),bytes.length);
    const jsonSize=bytes.readUInt32LE(12);
    const json=JSON.parse(bytes.subarray(20,20+jsonSize).toString('utf8'));
    const names=json.nodes.map(n=>n.name);
    assert.ok(names.includes('police_left_door_hinge'));
    assert.ok(names.includes('police_right_door_hinge'));
    assert.ok(names.includes('Police_Door_left_Mesh'));
    assert.ok(names.includes('Police_Door_right_Mesh'));
    assert.equal(json.meshes.length,3);
    assert.ok(json.textures?.length>0);
    assert.ok(json.images?.length>0);
    assert.ok(json.nodes.find(n=>n.name==='police_left_door_hinge').children.length>0);
    assert.ok(json.nodes.find(n=>n.name==='police_right_door_hinge').children.length>0);
});
test('alternar PS1 e GLB reseta somente o rig policial sem travar restauração',()=>{
    const lib=read('js/assets/free-vehicle-library.js');
    assert.match(lib,/DriverPoliceDoorRig\.cancel\(v\)/);
    assert.match(lib,/v\.policeDoorRig=null/);
    assert.match(lib,/v\._policeCustomModel=false/);
});
