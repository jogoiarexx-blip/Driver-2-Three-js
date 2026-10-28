'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const OriginalMap=require('../js/world/chicago-original-drive-map.js');
const FreeRide=require('../js/world/chicago-original-free-ride.js');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function synthetic(){
    const width=100,height=100;
    const data={format:OriginalMap.FORMAT,width,height,tiles:54,
        xminOBJ:0,zmaxOBJ:25,centerOBJ:[12.5,12.5],
        stepOBJ:.25,scale:3.4,roadCertified:false,
        missionLocationsMigrated:false,spawn:{x:0,z:0,heading:0}};
    const bytes=new Uint8Array(Math.ceil(width*height/8));
    const put=(row,col)=>{const bit=row*width+col;bytes[bit>>>3]|=128>>>(bit&7);};
    for(let row=40;row<=60;row++)for(let col=40;col<=60;col++)put(row,col);
    return {data,bytes};
}
test('a região de colisão é extraída da máscara PS1, sem depender da grade de 80',()=>{
    const map=new OriginalMap(),{data,bytes}=synthetic();
    map.bind(data,bytes);
    assert.equal(map.ready,true);
    assert.equal(map.isPointBlocked(0,0),false);
    assert.equal(map.isPointBlocked(70,0),true);
    assert.equal(map.isPointBlocked(0,-70),true);
    assert.equal(map.getGroundHeightAt(),0);
    assert.equal(map.isWaterAt(),false);
});
test('não criar rota ou posição jogável caso bitset ou spawn sejam inválidos',()=>{
    const {data,bytes}=synthetic();
    assert.throws(()=>new OriginalMap().bind({...data,tiles:52},bytes),/incompatível/);
    assert.throws(()=>new OriginalMap().bind(data,bytes.slice(0,50)),/danificado/);
    assert.throws(()=>new OriginalMap().bind({...data,spawn:{x:200,z:0,heading:0}},bytes),/spawn/);
    assert.throws(()=>new OriginalMap().bind({...data,roadCertified:true},bytes),/certificação/);
});
test('Passeio Livre PS1 usa o MESMO modelo de física DriverVehicle',()=>{
    const source=read('js/world/chicago-original-free-ride.js');
    assert.equal(typeof FreeRide,'function');
    assert.match(source,/new DriverVehicle\(/);
    assert.match(source,/\.updatePhysics\(dt,this\.input\(\),this\.world/);
    assert.match(source,/new DriverChicagoOriginalTileStream\(/);
    assert.doesNotMatch(source,/new CityBuilder\(|\.buildingBoxes\.push\(/);
    assert.match(source,/this\.stream\.root\.position\.y=0/);
});
test('entrada do menu e arquivos da cidade original são independentes da campanha',()=>{
    const html=read('index.html');
    const ride=read('chicago-original-drive.html');
    assert.match(html,/id="d2-chicago-original-drive"/);
    assert.match(html,/href="\.\/chicago-original-drive\.html"/);
    for(const file of [
        'gpu-resources.js','arcade-dynamics.js','vehicle-collisions.js',
        'vehicle-damage-fx.js','vehicle-visuals.js','driver-vehicle.js',
        'chicago-original-drive-map.js','chicago-original-tile-stream.js',
        'chicago-original-free-ride.js'
    ])assert(ride.includes(file),'Script não incluído: '+file);
    assert.match(ride,/Passeio Livre/);
    assert.doesNotMatch(ride,/new CityBuilder\(/);
});
