/** Testa Chicago 2.0: fachada, rio, ferrovia, parques, trem e isolamento. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
class Vector3 {
    constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
    set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
}
class Group {
    constructor(){
        this.children=[];this.position=new Vector3();this.rotation=new Vector3();
        this.scale=new Vector3(1,1,1);this.userData={};this.visible=true;
    }
    add(...xs){this.children.push(...xs);}
}
class Object3D extends Group {
    updateMatrix(){
        this.matrix={position:{...this.position},scale:{...this.scale},
            rotation:{...this.rotation}};
    }
}
class Geometry{}
class Material{constructor(config){this.config=config;}}
class Color{constructor(hex){this.hex=hex;}}
class Sphere{constructor(center,radius){this.center=center;this.radius=radius;}}
class InstancedMesh extends Group{
    constructor(geometry,material,count){
        super();this.geometry=geometry;this.material=material;this.count=count;
        this.matrixes=[];this.colors=[];this.instanceMatrix={};this.instanceColor={};
    }
    setMatrixAt(i,m){this.matrixes[i]=m;}
    setColorAt(i,c){this.colors[i]=c;}
}
const THREE={Group,Object3D,BoxGeometry:Geometry,InstancedMesh,
    MeshBasicMaterial:Material,MeshLambertMaterial:Material,
    Vector3,Sphere,Color};
const context=vm.createContext({THREE,Map,Set,Number,Math});
for(const file of ['js/world/special-structures.js',
    'js/world/chicago-overhaul.js','js/world/urban-districts.js']){
    vm.runInContext(read(file),context,{filename:file});
}
const S=vm.runInContext('DriverSpecialStructures',context);
const O=vm.runInContext('DriverChicagoOverhaul',context);
const U=vm.runInContext('UrbanDistricts',context);
const C=vm.runInNewContext(read('js/world/city-builder.js')+
    '\nCityBuilder',{THREE,Math,Map,Set});
assert.match(read('index.html'),/src="\.\/js\/world\/chicago-overhaul\.js"/);
assert(read('index.html').indexOf('chicago-overhaul.js')<
    read('index.html').indexOf('city-builder.js'));
assert.match(read('js/world/chicago-train.js'),
    /DriverChicagoOverhaul\.detailTrain\(this\)/);
assert.match(read('js/world/city-builder.js'),
    /DriverChicagoOverhaul\.buildCity\(this\)/);
assert.match(read('js/world/city-builder.js'),
    /DriverChicagoOverhaul\.detailDistrict\(this/);
assert.match(read('js/world/city-builder.js'),
    /DriverChicagoOverhaul\.detailLandmark\(this/);

// A curva do skyline não deve mudar outros três mapas.
const original=U.random;
U.random=()=>.5;
const core=U.height('chicago',40,-120);
const suburbs=U.height('chicago',280,-280);
assert(core>suburbs+25);
assert.equal(U.height('havana',40,-120),21);
assert(U.height('vegas',40,-120)>60);
assert.equal(U.height('rio',40,-120),39);
U.random=original;

const checkBatch=mesh=>{
    assert.equal(mesh.matrixes.length,mesh.count,mesh.name);
    assert.equal(mesh.colors.length,mesh.count,mesh.name);
    assert(mesh.geometry.boundingSphere?.radius>0,mesh.name);
    assert.equal(mesh.frustumCulled,true,mesh.name);
    for(const m of mesh.matrixes){
        assert(Object.values(m.position).every(Number.isFinite),mesh.name);
        assert(Object.values(m.scale).every(v=>v>0&&Number.isFinite(v)),
            mesh.name);
    }
};
for(const id of ['chicago','havana','vegas','rio']){
    const world={preset:{id},cityGroup:new Group(),
        chicagoParks:[{x:-120,z:120},{x:40,z:-280}],
        buildingBoxes:[{minX:20,maxX:60,minZ:-60,maxZ:-20}]};
    const colliders=JSON.stringify(world.buildingBoxes);
    O.buildCity(world);
    const parent=new Group();
    const local=O.detailDistrict(world,[{x:40,z:-120,height:100},
        {x:-200,z:-40,height:37},{x:200,z:120,height:28}],parent);
    if(id!=='chicago'){
        assert.equal(world.cityGroup.children.length,0,id);
        assert.equal(local.length,0,id);
        assert.equal(world.chicagoOverhaulStats,undefined,id);
    } else {
        assert.equal(world.cityGroup.children.length,5);
        assert.equal(local.length,1);
        assert.equal(world.chicagoOverhaulStats.addedColliders,0);
        const a=O.detailLandmark(world,-280,-280);
        const b=O.detailLandmark(world,280,-280);
        assert.equal(a.length+b.length,4);
        const train={group:new Group()};
        const t=O.detailTrain(train);
        assert.equal(t.length,2);
        assert.equal(train.group.children.length,2);
        const all=[...world.cityGroup.children,...local,...a,...b,...t];
        all.forEach(checkBatch);
        assert(all.reduce((v,m)=>v+m.count,0)<1800,
            'Excesso de detalhes adicionais, revisar orçamento de CPU');
    }
    assert.equal(JSON.stringify(world.buildingBoxes),colliders);
}
console.log(JSON.stringify({status:'PASS',maps:4,
    skylineCenter:Number(core.toFixed(1)),
    skylineSuburbs:Number(suburbs.toFixed(1)),
    collisionBoxesUnchanged:true,trainPreserved:true,
    isolatedFromOtherMaps:true},null,2));
