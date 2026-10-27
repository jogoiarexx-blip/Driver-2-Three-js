/** Havana 2.0: arquitetura, Malecón, porto, praças, LOD e isolamento. */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
class Vector3 {
    constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
    set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
}
class Group {
    constructor(){this.children=[];this.position=new Vector3();
        this.rotation=new Vector3();this.scale=new Vector3(1,1,1);
        this.userData={};this.visible=true;}
    add(...parts){this.children.push(...parts);}
}
class Object3D extends Group{
    updateMatrix(){this.matrix={position:{...this.position},
        rotation:{...this.rotation},scale:{...this.scale}};}
}
class Geo {constructor(...args){this.args=args;}}
class Mat {constructor(config){this.config=config;}}
class Color {constructor(hex){this.hex=hex;}}
class Sphere {constructor(center,radius){this.center=center;this.radius=radius;}}
class Mesh extends Group{
    constructor(geo,mat){super();this.geometry=geo;this.material=mat;}
}
class InstancedMesh extends Mesh{
    constructor(geo,mat,n){super(geo,mat);this.count=n;
        this.matrices=[];this.colors=[];this.instanceMatrix={};
        this.instanceColor={};}
    setMatrixAt(i,m){this.matrices[i]=m;}
    setColorAt(i,color){this.colors[i]=color;}
}
const THREE={Group,Object3D,Mesh,InstancedMesh,Vector3,BoxGeometry:Geo,
    PlaneGeometry:Geo,MeshBasicMaterial:Mat,MeshLambertMaterial:Mat,
    Color,Sphere,DoubleSide:2};
const context=vm.createContext({THREE,Map,Set,Math,Number});
for(const file of ['js/world/special-structures.js',
    'js/world/urban-districts.js','js/world/havana-overhaul.js'])
    vm.runInContext(read(file),context,{filename:file});
const H=vm.runInContext('DriverHavanaOverhaul',context);
const Urban=vm.runInContext('UrbanDistricts',context);
const city=id=>({preset:{id},cityGroup:new Group(),
    havanaParks:[{x:-120,z:120},{x:40,z:-280}],
    buildingBoxes:[{minX:20,maxX:60,minZ:-60,maxZ:-20}],
    canalWallSegments:[{minX:40,maxX:200,z:34}],
    sidewalkGrid:new Set(['40:-40']),
    missionStart:{x:16,z:-224}});
const checkBatch=m=>{
    assert(m instanceof InstancedMesh,m?.name);
    assert(m.count>0,m.name);
    assert.equal(m.matrices.length,m.count,m.name);
    assert.equal(m.colors.length,m.count,m.name);
    assert(m.geometry.boundingSphere?.radius>0,m.name);
    assert.equal(m.frustumCulled,true,m.name);
    for(const p of m.matrices){
        assert(Object.values(p.position).every(Number.isFinite));
        assert(Object.values(p.scale).every(n=>Number.isFinite(n)&&n>0));
    }
};

test('quatro perfis de bairros geram fachadas diferentes em um lote LOD',()=>{
    const world=city('havana'),group=new Group();
    const buildings=[
        {x:-200,z:-120,height:20},
        {x:40,z:-120,height:25},
        {x:40,z:-200,height:40},
        {x:200,z:-120,height:24}
    ];
    assert.equal(new Set(buildings.map(b=>H.districtKind(b.x,b.z))).size,4);
    const out=H.detailDistrict(world,buildings,group);
    assert.equal(out.length,1);
    assert.equal(group.children.length,1);
    assert(out[0].count>80,'Fachadas coloniais sem detalhes');
    checkBatch(out[0]);
});

test('Malecón visível com guarda-corpos fora da ponte e das entradas de água',()=>{
    const world=city('havana'),before=JSON.stringify(world.buildingBoxes);
    const out=H.buildMalecon(world);
    assert.equal(out.length,1);
    checkBatch(out[0]);
    for(const item of out[0].matrices){
        const {x,z}=item.position;
        assert(Math.abs(z-32.65)<5||Math.abs(z-67.35)<5,
            'Malecón fora da margem');
        assert(Math.abs(x)>=28,'Invasão visual da ponte levadiça');
        assert(!(Math.abs(x)>215&&Math.abs(x)<265),
            'Guarda-corpo nas entradas do canal');
    }
    assert.equal(JSON.stringify(world.buildingBoxes),before);
});

test('porto e pano de mar ficam fora dos eixos dirigíveis',()=>{
    const world=city('havana'),before=JSON.stringify(world.buildingBoxes);
    const batches=H.buildHarbor(world);
    assert.equal(batches.length,1);
    checkBatch(batches[0]);
    const sea=world.cityGroup.children.find(m=>m.name==='havana-sea-backdrop');
    assert(sea,'Sem horizonte marítimo');
    assert(sea.position.x < -420);
    // Guindastes têm centros dentro dos lotes x±280.
    for(const matrix of batches[0].matrices)
        assert(Math.abs(matrix.position.x)<294);
    assert.equal(JSON.stringify(world.buildingBoxes),before);
});

test('praças e parques mantêm caminhos e colisores',()=>{
    const world=city('havana'),before=JSON.stringify(world.buildingBoxes);
    const out=H.buildPaseo(world);
    assert.equal(out.length,1);
    checkBatch(out[0]);
    assert(out[0].count>40);
    assert.equal(JSON.stringify(world.buildingBoxes),before);
});

test('Capitólio e Plaza da Revolução têm detalhes próprios',()=>{
    const world=city('havana'),before=JSON.stringify(world.buildingBoxes);
    const left=H.detailLandmark(world,-280,-280);
    const right=H.detailLandmark(world,280,-280);
    assert.equal(left.length,2,'Luminárias + pedra do Capitólio');
    assert.equal(right.length,1,'Plaza da Revolução');
    for(const m of [...left,...right])checkBatch(m);
    assert.equal(JSON.stringify(world.buildingBoxes),before);
});

test('construtor, scripts e escala de alturas permanecem compatíveis',()=>{
    const builder=read('js/world/city-builder.js');
    const html=read('index.html');
    assert(html.includes('src="./js/world/havana-overhaul.js"'));
    assert(html.indexOf('havana-overhaul.js')<html.indexOf('city-builder.js'));
    for(const pattern of [
        /DriverHavanaOverhaul\.buildCity\(this\)/,
        /DriverHavanaOverhaul\.detailDistrict\(this/,
        /DriverHavanaOverhaul\.detailLandmark\(this/,
        /this\.havanaParks\.push\(\{x:cx,z:cz\}\)/
    ])assert.match(builder,pattern);
    const random=Urban.random;
    try{
        Urban.random=()=>.5;
        assert.equal(Urban.height('havana',40,-120),21);
        assert(Urban.height('havana',40,-200)>Urban.height('havana',-200,-120));
        assert.equal(Urban.height('rio',40,-120),39);
        assert(Urban.height('vegas',40,-120)>60);
    }finally{Urban.random=random;}
});

test('não modifica Chicago, Vegas nem Rio e não cria novas colisões',()=>{
    const world=city('havana'),before=JSON.stringify(world.buildingBoxes);
    H.buildCity(world);
    assert.equal(world.havanaOverhaulStats.addedColliders,0);
    assert.equal(world.havanaOverhaulStats.externalAssets,0);
    assert(world.cityGroup.children.length>=4);
    assert.equal(JSON.stringify(world.buildingBoxes),before);
    for(const id of ['chicago','vegas','rio']){
        const other=city(id),local=new Group();
        H.buildCity(other);
        assert.equal(other.cityGroup.children.length,0,id);
        assert.equal(H.detailDistrict(other,[{x:0,z:0,height:20}],local).length,0,id);
        assert.equal(H.detailLandmark(other,-280,-280).length,0,id);
        assert.equal(other.havanaOverhaulStats,undefined,id);
    }
});
