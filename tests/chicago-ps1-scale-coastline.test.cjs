'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
class Geometry{
    constructor(){this.attributes={};}
    setAttribute(k,v){this.attributes[k]=v;}
    computeVertexNormals(){this.normals=true;}
}
class Material{constructor(config){this.config=config;}}
class Attr{constructor(array,size){this.array=array;this.size=size;}}
class Mesh{
    constructor(geometry,material){
        this.geometry=geometry;this.material=material;this.userData={};
    }
}
const THREE={BufferGeometry:Geometry,Float32BufferAttribute:Attr,
    MeshBasicMaterial:Material,Mesh,DoubleSide:2};
const Land=vm.runInNewContext(read('js/world/chicago-ps1-coastline.js')+
    '\nDriverChicagoPS1Coastline',{THREE,Math,Number});
function city(id){
    const group={children:[],add(x){this.children.push(x)}};
    return {preset:{id},cityGroup:group,buildingBoxes:[
        {minX:-135,maxX:-105,minZ:-155,maxZ:-120}
    ],canalWallSegments:[{minX:-255,maxX:-225,z:34}],
    missionStart:{x:-64,z:-144},secretSwitchPos:{x:102,z:103}};
}
test('margem PS1 fase1 fica a leste das ruas legadas e varia com latitude',()=>{
    assert.equal(Land.SHORE.length,15);
    assert(Land.SHORE.every(x=>x.x>=345));
    for(const z of [-400,-320,-180,-90,-40,0,50,150,260,400]){
        assert(!Land.waterAt(320,z),'Rua antiga não pode cair no lago');
        if(z!==-40)assert(Land.waterAt(400,z),'Lago precisa estar visível a leste');
        assert(Land.shoreX(z)>320+20);
    }
    assert.notEqual(Land.shoreX(-350),Land.shoreX(350));
    assert(!Land.waterAt(379,-40),'Navy Pier preservado');
    assert(!Land.waterAt(411,-40),'Deck do píer preservado');
    assert(Land.waterAt(410,-20),'Lago fora da entrada do píer');
});
test('geração procedural cria água visual em batch sem alterar colisores e missões',()=>{
    const c=city('chicago');
    const before=JSON.stringify({buildingBoxes:c.buildingBoxes,
        walls:c.canalWallSegments,start:c.missionStart,
        switch:c.secretSwitchPos});
    const result=Land.build(c);
    assert.equal(result.mode,'procedural-phase1');
    assert.equal(result.addedColliders,0);
    assert.equal(result.waterPhysics,true);
    assert.equal(result.piersPreserved,true);
    assert.equal(c.cityGroup.children[0].name,'chicago-ps1-lake-michigan');
    const mesh=c.cityGroup.children[0];
    assert.equal(mesh.geometry.attributes.position.array.length,
        (Land.SHORE.length-1)*6*3);
    assert.equal(Land.build(c),result,'não duplicar ao construir duas vezes');
    assert.equal(JSON.stringify({buildingBoxes:c.buildingBoxes,
        walls:c.canalWallSegments,start:c.missionStart,
        switch:c.secretSwitchPos}),before);
    for(const id of ['havana','vegas','rio']){
        const foreign=city(id);assert.equal(Land.build(foreign),null);
        assert.equal(foreign.cityGroup.children.length,0);
    }
});
test('CityBuilder usa margem nova apenas em Chicago e mantém rios e pontes',()=>{
    const source=read('js/world/city-builder.js');
    const match=/isWaterAt\(x,z\)\s*\{([\s\S]*?)\n\s*\}/.exec(source);
    assert(match);
    assert.match(match[1],/this\.preset\?\.id==='chicago'/);
    assert.match(match[1],/DriverChicagoPS1Coastline\.waterAt\(x,z\)/);
    assert.match(match[1],/DriverChicagoEastBridge\.isDeckLocation/);
    assert.match(match[1],/z>34\.85&&z<65\.15/);
    assert.match(source,/DriverChicagoPS1Coastline\.build\(this\)/);
    const html=read('index.html');
    assert(html.indexOf('chicago-ps1-coastline.js')<
        html.indexOf('city-builder.js'));
});
test('novo tamanho da cidade PS1 não altera a física do carro',()=>{
    const Map=require('../js/world/chicago-original-drive-map.js');
    const Ride=require('../js/world/chicago-original-free-ride.js');
    const ratio=Ride.WORLD_SCALE/3.4;
    assert.equal(Ride.WORLD_SCALE,5.1);
    assert.equal(ratio,1.5);
    const map=new Map();
    const width=100,height=100,bits=new Uint8Array(1250).fill(255);
    map.bind({format:Map.FORMAT,tiles:54,width,height,
        xminOBJ:0,zmaxOBJ:25,stepOBJ:.25,centerOBJ:[12.5,12.5],
        scale:3.4,roadCertified:false,missionLocationsMigrated:false,
        spawn:{x:10,z:10,heading:0.6}},bits);
    const before={...map.spawn};
    map.rescaleWorld(Ride.WORLD_SCALE);
    assert.equal(map.mask.scale,Ride.WORLD_SCALE);
    assert(Math.abs(map.spawn.x-before.x*ratio)<1e-5);
    assert(Math.abs(map.spawn.z-before.z*ratio)<1e-5);
    assert.equal(map.isPointBlocked(map.spawn.x,map.spawn.z),false);
    assert.throws(()=>map.rescaleWorld(0),/inválida/);
    const src=read('js/world/chicago-original-free-ride.js');
    assert.match(src,/this\.world\.rescaleWorld\(DriverChicagoOriginalFreeRide\.WORLD_SCALE\)/);
    assert.match(src,/scale:DriverChicagoOriginalFreeRide\.WORLD_SCALE/);
    assert.match(src,/this\.car\.updatePhysics\(dt,this\.input\(\),this\.world/);
});
