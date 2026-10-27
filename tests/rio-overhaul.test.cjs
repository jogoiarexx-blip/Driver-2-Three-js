/** Rio 2.0: orla, mar, montanhas, Cristo e bairros; isolamento e sem colisores. */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
class V{
    constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
    set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
}
class Group{
    constructor(){
        this.children=[];this.userData={};
        this.position=new V();this.rotation=new V();this.scale=new V(1,1,1);
        this.visible=true;
    }
    add(...o){this.children.push(...o);}
}
class Object3D extends Group{
    updateMatrix(){this.matrix={position:{...this.position},
        scale:{...this.scale},rotation:{...this.rotation}};}
}
class Geo{
    constructor(...a){this.args=a;}
    rotateX(){}
}
class Mat{constructor(o){this.options=o;}}
class Color{constructor(c){this.hex=c;}}
class Sphere{constructor(center,radius){this.center=center;this.radius=radius;}}
class Mesh extends Group{
    constructor(g,m){super();this.geometry=g;this.material=m;}
}
class InstancedMesh extends Mesh{
    constructor(g,m,n){super(g,m);this.count=n;this.matrices=[];this.colors=[];
        this.instanceMatrix={};this.instanceColor={};}
    setMatrixAt(i,m){this.matrices[i]=m;}
    setColorAt(i,c){this.colors[i]=c;}
}
const THREE={Group,Mesh,Object3D,InstancedMesh,BoxGeometry:Geo,
    ConeGeometry:Geo,PlaneGeometry:Geo,MeshBasicMaterial:Mat,
    MeshLambertMaterial:Mat,Color,Sphere,Vector3:V,DoubleSide:2};
const context=vm.createContext({THREE,Map,Set,Math,Number});
for(const file of ['js/world/special-structures.js',
    'js/world/rio-overhaul.js','js/world/urban-districts.js']){
    vm.runInContext(read(file),context,{filename:file});
}
const Rio=vm.runInContext('DriverRioOverhaul',context);
const Urban=vm.runInContext('UrbanDistricts',context);
const makeWorld=id=>({
    preset:{id},cityGroup:new Group(),
    rioParks:[{x:40,z:-280},{x:-120,z:120}],
    buildingBoxes:[{minX:20,maxX:60,minZ:-60,maxZ:-20}],
    canalWallSegments:[{minX:80,maxX:120,z:34}],
    sidewalkGrid:new Set(['40:-40'])
});
const checkInstanced=mesh=>{
    assert.equal(mesh.matrices.length,mesh.count,mesh.name);
    assert.equal(mesh.colors.length,mesh.count,mesh.name);
    assert(mesh.geometry.boundingSphere?.radius>0,mesh.name);
    assert.equal(mesh.frustumCulled,true,mesh.name);
    for(const m of mesh.matrices){
        assert(Object.values(m.position).every(Number.isFinite));
        assert(Object.values(m.scale).every(v=>v>0&&Number.isFinite(v)));
    }
};
test('Rio tem Copacabana e mar após a borda jogável sem barreiras novas',()=>{
    const city=makeWorld('rio'),boxes=JSON.stringify(city.buildingBoxes);
    const foam=Rio.buildOcean(city),beach=Rio.buildCopacabana(city);
    assert.equal(foam.length,1);
    assert.equal(beach.length,1);
    assert(city.cityGroup.children.some(o=>o.name==='rio-ocean-backdrop'));
    const ocean=city.cityGroup.children.find(o=>o.name==='rio-ocean-backdrop');
    assert(ocean.position.x>420,'Mar encobriu ruas do mapa');
    const walkway=beach[0];
    assert(walkway.count>500,'Calçadão sem ondas e quiosques');
    assert(walkway.matrices.some(m=>m.position.x>=382&&m.position.x<=390));
    assert.equal(JSON.stringify(city.buildingBoxes),boxes);
    [...foam,...beach].forEach(checkInstanced);
});
test('Corcovado com detalhes, montanhas do horizonte e parques',()=>{
    const city=makeWorld('rio'),boxes=JSON.stringify(city.buildingBoxes);
    const mountains=Rio.buildMountains(city);
    assert.equal(mountains.length,3);
    assert(mountains.every(m=>m.name?.startsWith('rio-')));
    const stat=Rio.buildCorcovadoDetails(city);
    const parks=Rio.buildParks(city);
    assert.equal(stat.length,1);
    assert.equal(parks.length,1);
    assert(stat[0].count>60);
    assert(parks[0].count>20);
    [...stat,...parks].forEach(checkInstanced);
    assert.equal(JSON.stringify(city.buildingBoxes),boxes);
});
test('estilos: orla, centro, bairros e comércio têm arquitetura diferenciada',()=>{
    const city=makeWorld('rio'),group=new Group();
    const buildings=[
        {x:200,z:-120,height:55},{x:40,z:-120,height:48},
        {x:-200,z:-120,height:31},{x:120,z:200,height:27}
    ];
    assert.equal(new Set(buildings.map(b=>Rio.districtKind(b.x,b.z))).size,4);
    const batch=Rio.detailDistrict(city,buildings,group);
    assert.equal(batch.length,1,'Mais de uma draw call por setor LOD');
    checkInstanced(batch[0]);
    assert(batch[0].count>65);
    assert.equal(group.children.length,1);
    const m1=Rio.detailLandmark(city,-280,-280);
    const m2=Rio.detailLandmark(city,280,-280);
    assert.equal(m1.length,1);
    assert.equal(m2.length,1);
    [...m1,...m2].forEach(checkInstanced);
    assert.equal(JSON.stringify(city.buildingBoxes),
        JSON.stringify(makeWorld('rio').buildingBoxes));
});
test('Rio isolado: Chicago, Havana e Vegas permanecem sem decoração carioca',()=>{
    for(const id of ['chicago','havana','vegas']){
        const city=makeWorld(id),local=new Group();
        Rio.buildCity(city);
        assert.equal(city.cityGroup.children.length,0,id);
        assert.equal(Rio.detailDistrict(city,[{x:200,z:-120,height:50}],local).length,0,id);
        assert.equal(Rio.detailLandmark(city,-280,-280).length,0,id);
        assert.equal(city.rioOverhaulStats,undefined,id);
    }
});
test('Rio integra corretamente LOD, parques, monumentos, carregamento e skyline',()=>{
    const html=read('index.html'),city=read('js/world/city-builder.js');
    assert(html.includes('src="./js/world/rio-overhaul.js"'));
    assert(html.indexOf('rio-overhaul.js')<html.indexOf('city-builder.js'));
    assert.match(city,/DriverRioOverhaul\.buildCity\(this\)/);
    assert.match(city,/DriverRioOverhaul\.detailDistrict\(this/);
    assert.match(city,/DriverRioOverhaul\.detailLandmark\(this/);
    assert.match(city,/this\.rioParks\.push\(\{x:cx,z:cz\}\)/);
    const old=Urban.random;
    Urban.random=()=>.5;
    try{
        assert( Urban.height('rio',200,-120)>Urban.height('rio',-200,-120) );
        assert.equal(Urban.height('havana',40,-120),21);
        assert(Urban.height('vegas',40,-120)>60);
    }finally{Urban.random=old;}
    const testCity=makeWorld('rio');
    Rio.buildCity(testCity);
    assert.equal(testCity.rioOverhaulStats.addedColliders,0);
    assert.equal(testCity.rioOverhaulStats.downloadAssets,0);
    assert(testCity.cityGroup.children.length>=7);
});
