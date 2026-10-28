'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const River=require('../js/world/chicago-ps1-river-branches.js');
const instances=[];
class Vector{
    constructor(){this.x=0;this.y=0;this.z=0;}
    set(x,y,z){this.x=x;this.y=y;this.z=z;}
}
class Object3D{
    constructor(){this.position=new Vector();this.rotation=new Vector();this.scale=new Vector();}
    updateMatrix(){this.matrix={position:{x:this.position.x,y:this.position.y,z:this.position.z},
        rotation:{y:this.rotation.y},scale:{x:this.scale.x,y:this.scale.y,z:this.scale.z}};}
}
class InstancedMesh{
    constructor(geo,mat,count){
        this.geometry=geo;this.material=mat;this.count=count;
        this.items=[];this.instanceMatrix={};instances.push(this);
    }
    setMatrixAt(i,m){this.items[i]=JSON.parse(JSON.stringify(m));}
}
class Geom{constructor(...args){this.args=args;} rotateX(){return this;}}
class Material{constructor(opts){this.opts=opts;}}
const THREE={
    InstancedMesh,Object3D,
    PlaneGeometry:Geom,BoxGeometry:Geom,CylinderGeometry:Geom,
    MeshBasicMaterial:Material,MeshLambertMaterial:Material,DoubleSide:2
};
const context=vm.createContext({
    THREE,Math,Number,Map,Set,
    DriverChicagoPS1RiverBranches:River,
    PS1TextureFactory:{
        createRoadTexture:()=>({}),createAsphaltTexture:()=>({})
    }
});
const surface=vm.runInContext(
    read('js/world/road-surface.js')+'\nDriverRoadSurface',
    context);
const furniture=vm.runInContext(
    read('js/world/street-furniture.js')+'\nDriverStreetFurniture',
    context);
const water=(x,z)=>River.waterAt(x,z) ||
    (z>34.85&&z<65.15&&Math.abs(x)>12.25);
const city=(name='chicago')=>({
    preset:{id:name},cityGroup:{children:[],add(v){this.children.push(v);}},
    destructibleProps:[],isWaterAt:water
});
test('R3 não gera malha asfaltada onde R2 transformou ruas em canais',()=>{
    instances.length=0;
    const c=city(),mesh=surface.buildAsphalt(c);
    assert(mesh.count>175);
    assert(c.roadSurfaceStats.removedWetTiles>10,
        'R2 não removeu nenhum trecho asfaltado da água');
    for(const item of mesh.items){
        const {x,z}=item.position;
        assert.equal(water(x,z),false,
            'Asfalto continua cobrindo o leito em '+x+','+z);
    }
    assert.equal(mesh.items.length,mesh.count);
    assert.equal(c.roadSurfaceStats.intersectionCount,81);
    const other=city('rio');
    surface.buildAsphalt(other);
    assert.equal(other.roadSurfaceStats.removedWetTiles,0,
        'O Rio de Janeiro não pode receber a hidrografia de Chicago');
    assert(other.roadSurfaceStats.regions>c.roadSurfaceStats.regions);
});
test('marcas de pista se limitam a asfalto seco e às pontes reais',()=>{
    const c=city();
    const meshes=surface.buildMarkings(c);
    assert.equal(meshes.length,2);
    for(const mesh of meshes){
        for(const item of mesh.items){
            const {x,z}=item.position;
            assert.equal(water(x,z),false,
                'Tinta de rua sobre água: '+x+','+z);
        }
    }
    assert(c.roadSurfaceStats===undefined ||
        c.roadSurfaceStats.materials===1);
    assert.equal(surface.dryStreetPoint(c,-240,120),false);
    assert.equal(surface.dryStreetPoint(c,-240,160),true);
    assert.equal(surface.dryStreetPoint(c,-160,200),false);
    assert.equal(surface.dryStreetPoint(c,-160,240),true);
});
test('postes e faixas de pedestre deixam de flutuar sobre Goose Island',()=>{
    const c=city();
    furniture.build(c);
    const zebra=c.cityGroup.children.find(m=>m.name==='road-crosswalk-zebra');
    const light=c.cityGroup.children.find(m=>m.name==='street-signs-chicago');
    assert(zebra&&light);
    for(const mesh of c.cityGroup.children){
        if(!mesh.items)continue;
        for(const item of mesh.items){
            const {x,z}=item.position;
            assert(!water(x,z),'Objeto de rua sobre água: '+mesh.name+' '+x+','+z);
        }
    }
    assert(c.destructibleProps.length>0);
    assert(c.destructibleProps.length<162);
});
test('canais interrompem ruas no sentido norte-sul mas as pontes preservam travessias leste-oeste',()=>{
    const Road=vm.runInNewContext(
        read('js/world/road-geometry.js')+'\nDriverRoadGeometry',
        {Math,Number,Map,Set});
    const c=city();c.roadExtent=320;c.isPointBlocked=()=>false;
    for(const z of River.BRIDGES_WEST){
        assert(Road.segmentDrivable(c,-275,z+4,-205,z+4),
            'Tráfego perdeu ponte oeste '+z);
    }
    for(const z of River.BRIDGES_EAST){
        assert(Road.segmentDrivable(c,-195,z+4,-125,z+4),
            'Tráfego perdeu ponte leste '+z);
    }
    assert.equal(Road.segmentDrivable(c,-240,92,-240,148),false);
    assert.equal(Road.segmentDrivable(c,-160,171,-160,222),false);
    const graph=Road.auditNetwork(c);
    assert.equal(graph.nodes,81);
    assert(graph.largestComponent>=55,
        'Ruas do Undercover desconectadas por engano');
});
test('canal só altera renderização, sem mexer nos colliders, missões ou física',()=>{
    const source=read('js/world/road-surface.js');
    const street=read('js/world/street-furniture.js');
    assert.match(source,/removedWetTiles/);
    assert.match(source,/dryStreetPoint\(city/);
    assert.match(street,/const dry=/);
    assert.doesNotMatch(source,/buildingBoxes\.push|missionStart\s*=|scriptedDrive\s*=/);
    assert.doesNotMatch(street,/buildingBoxes\.push|missionStart\s*=/);
});
