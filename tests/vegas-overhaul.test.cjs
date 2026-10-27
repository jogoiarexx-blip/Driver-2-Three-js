/** Vegas 2.0: Strip, neon, letreiros, hotéis, deserto e isolamento. */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
class Vector3 {
    constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
    set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
}
class Group{
    constructor(){this.children=[];this.position=new Vector3();
        this.rotation=new Vector3();this.scale=new Vector3(1,1,1);
        this.userData={};this.visible=true;}
    add(...items){this.children.push(...items);}
}
class Object3D extends Group{
    updateMatrix(){this.matrix={position:{...this.position},
        scale:{...this.scale},rotation:{...this.rotation}};}
}
class Geo{constructor(...a){this.args=a;}}
class Mat{constructor(a){this.args=a;}}
class Color{constructor(v){this.hex=v;}}
class Sphere{constructor(center,radius){this.center=center;this.radius=radius;}}
class Mesh extends Group{
    constructor(g,m){super();this.geometry=g;this.material=m;}
}
class InstancedMesh extends Mesh{
    constructor(g,m,n){super(g,m);this.count=n;this.matrices=[];
        this.colors=[];this.instanceMatrix={};this.instanceColor={};}
    setMatrixAt(i,m){this.matrices[i]=m;}
    setColorAt(i,c){this.colors[i]=c;}
}
const THREE={Group,Object3D,Mesh,InstancedMesh,
    Vector3,BoxGeometry:Geo,ConeGeometry:Geo,PlaneGeometry:Geo,
    TorusGeometry:Geo,
    MeshBasicMaterial:Mat,MeshLambertMaterial:Mat,Color,Sphere};
const context=vm.createContext({THREE,Map,Set,Number,Math});
for(const file of ['js/world/special-structures.js',
    'js/world/urban-districts.js','js/world/vegas-overhaul.js'])
    vm.runInContext(read(file),context,{filename:file});
const Vegas=vm.runInContext('DriverVegasOverhaul',context);
const Urban=vm.runInContext('UrbanDistricts',context);
const mockCity=id=>({
    preset:{id},cityGroup:new Group(),vegasParks:[
        {x:-120,z:120},{x:40,z:-280}
    ],buildingBoxes:[{minX:-60,maxX:-20,minZ:-140,maxZ:-100}],
    canalWallSegments:[{minX:-200,maxX:-20,z:34}],
    roadAudit:{connected:true},
    missionStart:{x:16,z:-224}
});
function assertBatch(mesh){
    assert(mesh instanceof InstancedMesh,mesh?.name);
    assert.equal(mesh.count,mesh.matrices.length,mesh.name);
    assert.equal(mesh.count,mesh.colors.length,mesh.name);
    assert(mesh.geometry.boundingSphere?.radius>0,mesh.name);
    assert.equal(mesh.frustumCulled,true,mesh.name);
    for(const m of mesh.matrices){
        assert(Object.values(m.position).every(Number.isFinite),mesh.name);
        assert(Object.values(m.scale).every(n=>n>0&&Number.isFinite(n)),mesh.name);
    }
}

test('Vegas diferencia quatro setores e cria letreiros em lote próximo',()=>{
    const c=mockCity('vegas'),g=new Group();
    const buildings=[
        {x:40,z:-120,height:65},{x:-200,z:-280,height:35},
        {x:200,z:-120,height:45},{x:-120,z:280,height:26}
    ];
    assert.equal(new Set(buildings.map(b=>
        Vegas.districtKind(b.x,b.z))).size,4);
    const v=Vegas.detailDistrict(c,buildings,g);
    assert.equal(v.length,2,'Uma malha para geometria, uma para neon');
    assert.equal(g.children.length,2);
    v.forEach(assertBatch);
    assert(v.reduce((a,m)=>a+m.count,0)>120);
});
test('LOD distante mantém janelas nas fachadas e laterais da Strip',()=>{
    const city=mockCity('vegas'),group=new Group();
    const buildings=[
        {x:40,z:-120,height:78},{x:-40,z:-120,height:84},
        {x:-200,z:-280,height:34}
    ];
    const boxes=JSON.stringify(city.buildingBoxes);
    const batches=Vegas.detailFarDistrict(city,buildings,group);
    assert.equal(batches.length,1,
        'Um lote por setor distante, sem textura externa');
    assert.equal(group.children.length,1);
    assertBatch(batches[0]);
    const pos=batches[0].matrices.map(m=>m.position);
    assert(pos.some(m=>Math.abs(m.x-20.84)<.01),
        'Hotel do lado direito sem janela lateral');
    assert(pos.some(m=>Math.abs(m.x+20.84)<.01),
        'Hotel do lado esquerdo sem janela lateral');
    assert(batches[0].count>95,
        'Fachadas distantes ainda aparecem lisas');
    assert.equal(JSON.stringify(city.buildingBoxes),boxes);
});

test('letreiro em pixels gera letras legíveis sem fontes externas',()=>{
    const parts=[];
    Vegas.pixelSign(parts,'CASINO',0,20,10,.45,0xff33aa);
    assert(parts.length>=90);
    assert(parts.every(p=>p[7]===true));
    assert(parts.every(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])));
    const side=[];
    Vegas.pixelSign(side,'VEGAS',18,14,0,.3,0x44ffaa,'side');
    assert(side.length>60);
    assert(side.every(p=>p[7]===true && p[3]===.16));
});
test('Strip possui balizadores baixos, arcos de neon e acessos livres',()=>{
    const c=mockCity('vegas'),before=JSON.stringify(c.buildingBoxes);
    const batches=Vegas.buildStrip(c);
    assert.equal(batches.length,2);
    batches.forEach(assertBatch);
    const all=batches.flatMap(m=>m.matrices);
    assert(all.some(m=>m.position.y>16));
    assert(all.some(m=>m.position.y<.09));
    // As únicas peças na parte dirigível da Strip são superficiais.
    assert(all.filter(m=>Math.abs(m.position.x)<12
        &&m.position.y<2).every(m=>m.scale.y<.1));
    assert.equal(JSON.stringify(c.buildingBoxes),before);
});
test('resorts usam palmeiras, jardins e silhuetas do deserto',()=>{
    const c=mockCity('vegas'),before=JSON.stringify(c.buildingBoxes);
    const palms=Vegas.buildStreetResorts(c);
    const gardens=Vegas.buildParks(c);
    const desert=Vegas.buildDesert(c);
    assert.equal(palms.length,2);
    assert.equal(gardens.length,2);
    assert.equal(desert.length,2);
    [...palms,...gardens].forEach(assertBatch);
    for(const mountain of desert){
        assert(mountain.count===9);
        assert.equal(mountain.matrices.length,9);
        assert(mountain.matrices.every(m=>
            Math.abs(m.position.x)>410||Math.abs(m.position.z)>410));
    }
    assert.equal(JSON.stringify(c.buildingBoxes),before);
});
test('cassino e hotel possuem letreiros, sem bloquear missões',()=>{
    const c=mockCity('vegas'),before=JSON.stringify(c.buildingBoxes);
    const casino=Vegas.detailLandmark(c,-280,-280);
    const hotel=Vegas.detailLandmark(c,280,-280);
    assert.equal(casino.length,2);
    assert.equal(hotel.length,2);
    [...casino,...hotel].forEach(assertBatch);
    assert(casino[1].count>80);
    assert(hotel[1].count>60);
    assert.equal(JSON.stringify(c.buildingBoxes),before);
});
test('High Roller, torre e pirâmide são silhuetas sem colisão',()=>{
    const city=mockCity('vegas'),boxes=JSON.stringify(city.buildingBoxes);
    const attraction=Vegas.buildAttractions(city);
    assert.equal(attraction.length,4);
    attraction.filter(m=>m instanceof InstancedMesh).forEach(assertBatch);
    const wheel=city.cityGroup.children.find(m=>
        m.name==='vegas-high-roller-outline');
    const pyramid=city.cityGroup.children.find(m=>
        m.name==='vegas-pyramid-backdrop');
    assert(wheel&&pyramid);
    assert(wheel.position.x>410);
    assert(pyramid.position.z>410);
    assert.equal(JSON.stringify(city.buildingBoxes),boxes);
});
test('skyline da Strip é mais alto; outros mapas preservam alturas',()=>{
    const old=Urban.random;
    try{
        Urban.random=()=>.5;
        const strip=Urban.height('vegas',40,-120);
        const downtown=Urban.height('vegas',-200,-280);
        const resort=Urban.height('vegas',200,-120);
        assert(strip>downtown+20 && strip>resort+15);
        assert.equal(Urban.height('havana',40,-120),21);
        assert.equal(Urban.height('rio',40,-120),39);
    }finally{Urban.random=old;}
});
test('Vegas integra CityBuilder e scripts antes de consumir o módulo',()=>{
    const builder=read('js/world/city-builder.js'),html=read('index.html');
    assert(html.includes('src="./js/world/vegas-overhaul.js"'));
    assert(html.indexOf('vegas-overhaul.js')<html.indexOf('city-builder.js'));
    for(const regex of [
        /DriverVegasOverhaul\.buildCity\(this\)/,
        /DriverVegasOverhaul\.detailDistrict\(this/,
        /DriverVegasOverhaul\.detailLandmark\(this/,
        /this\.vegasParks\.push\(\{x:cx,z:cz\}\)/
    ])assert.match(builder,regex);
});
test('isolamento de Chicago, Havana e Rio e conservação de colisões',()=>{
    const city=mockCity('vegas');
    const boxes=JSON.stringify(city.buildingBoxes);
    const road=JSON.stringify(city.roadAudit);
    Vegas.buildCity(city);
    assert.equal(city.vegasOverhaulStats.addedColliders,0);
    assert.equal(city.vegasOverhaulStats.externalAssets,0);
    assert.equal(city.vegasOverhaulStats.pointLights,0);
    assert(city.cityGroup.children.some(m=>m.name==='vegas-high-roller-outline'));
    assert(city.cityGroup.children.some(m=>m.name==='vegas-pyramid-backdrop'));
    assert(city.cityGroup.children.length>=8);
    assert.equal(JSON.stringify(city.buildingBoxes),boxes);
    assert.equal(JSON.stringify(city.roadAudit),road);
    for(const id of ['chicago','havana','rio']){
        const other=mockCity(id),local=new Group();
        Vegas.buildCity(other);
        assert.equal(other.cityGroup.children.length,0,id);
        assert.equal(Vegas.detailDistrict(other,[{x:40,z:-120,height:55}],local).length,0,id);
        assert.equal(Vegas.detailLandmark(other,-280,-280).length,0,id);
        assert.equal(other.vegasOverhaulStats,undefined,id);
    }
});
