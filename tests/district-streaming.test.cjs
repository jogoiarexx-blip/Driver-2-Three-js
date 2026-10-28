'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const LOD=vm.runInNewContext(
    read('js/world/district-lod.js')+'\nDriverDistrictLOD',{Math,Number,Error,Infinity}
);
const create=(opts={})=>new LOD({...opts,nearRadius:165,farRadius:230});
function add(lod,id,x,z){
    const far={visible:false};
    let constructed=0;
    const item=lod.register({id,x,z,far,buildNear:()=>{
        constructed++;
        return {visible:false};
    }});
    return {far,item,count:()=>constructed};
}
test('cidade distante usa silhueta sem criar detalhes',()=>{
    const lod=create(),a=add(lod,'a',0,0);
    assert.equal(a.far.visible,true);
    assert.equal(a.count(),0);
    assert.equal(lod.stats().far,1);
});
test('detalhes só são criados ao aproximar do bairro',()=>{
    const lod=create(),a=add(lod,'a',0,0);
    const result=lod.update({x:0,z:0});
    assert.equal(result.near,1);
    assert.equal(result.built,1);
    assert.equal(a.count(),1);
    assert.equal(a.far.visible,false);
    assert.equal(a.item.near.visible,true);
});
test('distância retorna para LOD leve, sem descartar cache de detalhes',()=>{
    const lod=create(),a=add(lod,'a',0,0);
    lod.update({x:0,z:0});
    lod.update({x:1000,z:1000});
    assert.equal(a.far.visible,true);
    assert.equal(a.item.near.visible,false);
    lod.update({x:0,z:0});
    assert.equal(a.count(),1);
    assert.equal(lod.stats().built,1);
});
test('histerese evita oscilação e piscadas nas fronteiras',()=>{
    const lod=create(),a=add(lod,'a',0,0);
    lod.update({x:0,z:0});
    for(const x of [249,265,245,270]) {
        const result=lod.update({x,z:0});
        assert.equal(result.near,1);
    }
    lod.update({x:320,z:0});
    assert.equal(lod.stats().near,0);
    lod.update({x:280,z:0});
    assert.equal(lod.stats().near,0);
    lod.update({x:240,z:0});
    assert.equal(lod.stats().near,1);
});
test('orçamento carrega no máximo um bairro novo por atualização',()=>{
    const lod=create({maxSwitches:1});
    add(lod,'far',140,0);
    const near=add(lod,'near',0,0);
    const first=lod.update({x:0,z:0});
    assert.equal(first.near,1);
    assert.equal(first.switched,1);
    assert.equal(near.item.level,'near');
    const second=lod.update({x:0,z:0});
    assert.equal(second.near,2);
    assert.equal(second.switched,1);
});
test('distância é até a borda do bairro, não apenas o centro',()=>{
    const lod=create(),a=add(lod,'a',0,0);
    assert.equal(lod.distance(a.item,{x:70,z:0}),0);
    assert.equal(lod.distance(a.item,{x:180,z:0}),100);
});
test('posição inválida preserva o estado do bairro',()=>{
    const lod=create();add(lod,'a',0,0);
    lod.update({x:NaN,z:0});
    lod.update(null);
    assert.equal(lod.stats().far,1);
});
test('falha ao criar detalhes mantém o cenário visível',()=>{
    const lod=create(),far={visible:true};
    lod.register({id:'bad',x:0,z:0,far,buildNear:()=>{throw Error('GPU')}});
    lod.update({x:0,z:0});
    assert.equal(far.visible,true);
    assert.equal(lod.stats().failed,1);
    assert.equal(lod.stats().near,0);
});
test('nova instância de cidade não herda cache de detalhes',()=>{
    const a=create();add(a,'a',0,0);a.update({x:0,z:0});
    const b=create();add(b,'a',0,0);
    assert.equal(a.stats().built,1);
    assert.equal(b.stats().built,0);
});
test('cidade mantém caixas de colisão independentemente de LOD',()=>{
    const city=read('js/world/city-builder.js');
    assert.match(city,/this\.districtBuildings\.push\(building\)/);
    assert.match(city,/this\.buildingBoxes\.push\(\{/);
    assert.match(city,/buildDistrictRepresentations\(sidewalkPositions,sidewalkMat\)/);
    assert.match(city,/new THREE\.InstancedMesh\(chunk\.geometry/);
    assert.match(city,/DriverDistrictVisibility\.makeGeometry\(chunk\.buildings\)/);
    assert.match(city,/this\.districtLOD=new DriverDistrictLOD/);
    assert.match(city,/this\.districtLOD\.update\(focus,\{force\}\)/);
});
test('detalhes arquitetônicos só entram nas malhas de perto',()=>{
    const city=read('js/world/city-builder.js');
    const urban=read('js/world/urban-districts.js');
    assert.match(city,/UrbanDistricts\.decorate\(this,chunk\.buildings,group\)/);
    assert.match(urban,/parent\.add\(mesh\)/);
    assert.match(city,/this\.districtMaterialCache\.get\(palette\)/);
});
test('pré-aquecimento compila os shaders dos bairros próximos antes de mostrar jogo',()=>{
    const boot=read('js/ui/driver-boot-flow.js');
    const warm=boot.indexOf('game.city.updateDistrictLOD(0,game.getPlayerPosition(),true)');
    const shader=boot.indexOf('game.renderer.compile(game.scene,game.camera)');
    assert.ok(warm>0 && warm<shader);
});
test('módulo de LOD carrega antes do construtor de cidades',()=>{
    const html=read('index.html');
    const lod=html.indexOf('js/world/district-lod.js');
    const city=html.indexOf('js/world/city-builder.js');
    assert.ok(lod>0 && lod<city);
    assert.match(html,/id="district-lod-status"/);
});
