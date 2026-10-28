'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

const captions=[];
class V3 {
    constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
    set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
}
class Group {
    constructor(){
        this.children=[];this.position=new V3();this.rotation=new V3();
        this.scale=new V3(1,1,1);this.userData={};this.parent=null;
    }
    add(...items){for(const item of items){item.parent=this;this.children.push(item);}}
}
class Mesh extends Group {
    constructor(geometry,material){super();this.geometry=geometry;this.material=material;}
}
class Sprite extends Group {
    constructor(material){super();this.material=material;}
}
class Geometry {
    constructor(...args){this.args=args;}
}
class Material {
    constructor(opts){this.opts=opts||{};this.userData={};}
}
class Texture {
    constructor(canvas){this.canvas=canvas;this.isTexture=true;}
}
const THREE={
    Group,Mesh,Sprite,BoxGeometry:Geometry,TorusGeometry:Geometry,
    CylinderGeometry:Geometry,MeshLambertMaterial:Material,
    MeshBasicMaterial:Material,SpriteMaterial:Material,CanvasTexture:Texture
};
const fakeDocument={createElement(type){
    assert.equal(type,'canvas');
    return {width:0,height:0,getContext(type){
        assert.equal(type,'2d');
        return {fillStyle:'',font:'',textAlign:'',textBaseline:'',
            fillRect(){},fillText(value){captions.push(value);}};
    }};
}};
const packed=[];
const structures={pack(parent,parts,name){
    const mesh=new Group();mesh.name=name;
    mesh.userData.visualParts=parts;
    parent.add(mesh);
    packed.push({name,parts});
    return [mesh];
}};
const World=vm.runInNewContext(
    read('js/world/chicago-neighborhoods.js')+
    '\nDriverChicagoNeighborhoods',
    {THREE,document:fakeDocument,DriverSpecialStructures:structures,
        Math,Number,String}
);
const segments=[];
for(const z of [34,66])
    for(const [minX,maxX] of [
        [-427,-255],[-225,-11.5],[11.5,225],[255,427]])
        segments.push({z,minX,maxX});

function city(id='chicago',withStadium=true){
    const stadium=withStadium?{x:-280,z:200,open:false,
        gate:{name:'gate-existing'},box:{minX:-285,maxX:-275}}:null;
    return {preset:{id},cityGroup:new Group(),buildingBoxes:[{
        minX:100,maxX:110,minZ:100,maxZ:110
    }],canalWallSegments:segments.map(s=>({...s})),
    chicagoStadium:stadium};
}

test('dez bairros com posições relativas ao mapa original',()=>{
    const d=World.DISTRICTS;
    assert.equal(d.length,10);
    assert.equal(new Set(Array.from(d,x=>x.id)).size,10);
    const at=id=>d.find(x=>x.id===id);
    assert(at('wrigleyville').z>at('lincoln-park').z-100);
    assert(at('lincoln-park').z>at('gold-coast').z);
    assert(at('gold-coast').z>at('downtown').z);
    assert(at('navy-pier').x>at('gold-coast').x);
    assert(at('greektown').x<at('downtown').x);
    assert(at('chinatown').z<at('downtown').z);
    assert(at('grant-park').x>at('downtown').x);
    assert(at('meigs-field').z<at('grant-park').z);
    assert(Array.from(d,x=>x.color).every(Number.isFinite));
});

test('somente Chicago recebe as placas e dez marcadores coloridos',()=>{
    packed.length=0;captions.length=0;
    const c=city(),before=JSON.stringify(c.buildingBoxes);
    const beforeWalls=JSON.stringify(c.canalWallSegments);
    const result=World.build(c);
    assert.equal(result.districts,10);
    assert.equal(result.labels,10);
    assert.equal(result.addedColliders,0);
    assert.equal(result.mode,'visual-only');
    assert.equal(result.root.parent,c.cityGroup);
    assert.equal(JSON.stringify(c.buildingBoxes),before);
    assert.equal(JSON.stringify(c.canalWallSegments),beforeWalls);
    assert(captions.includes('GOLD COAST'));
    assert(captions.includes('MEIGS FIELD'));
    const markers=packed.find(x=>x.name==='chicago-neighborhood-beacons');
    assert.equal(markers.parts.length,20);
    assert.equal(new Set(markers.parts.map(x=>x[6])).size,10);
    assert.equal(World.build(c),result,'build duplo não gera duplicação');
    assert.equal(c.cityGroup.children.length,1);
});

test('margens reforçadas não cobrem o vão de nenhuma das duas pontes',()=>{
    packed.length=0;
    const c=city();
    World.build(c);
    const edge=packed.find(x=>x.name==='chicago-river-edge-reinforcement');
    assert(edge && edge.parts.length>25);
    for(const p of edge.parts){
        const [x,y,z,w,h,d]=p;
        assert([x,y,z,w,h,d].every(Number.isFinite));
        assert([34,66].some(wallZ=>Math.abs(z-wallZ)<2));
        for(const crossing of [0,240]){
            assert(x+w/2<=crossing-11.5 ||
                x-w/2>=crossing+11.5,
                'Faixa visual não pode tapar ponte '+crossing);
        }
    }
});

test('Wrigley Field existente preserva portão, carro secreto e referência',()=>{
    packed.length=0;
    const c=city(),stadium=c.chicagoStadium,colliders=c.buildingBoxes;
    const initial=JSON.stringify(colliders);
    const result=World.build(c);
    assert.equal(c.chicagoStadium,stadium);
    assert.equal(c.chicagoStadium.gate.name,'gate-existing');
    assert.equal(c.chicagoStadium.open,false);
    assert.equal(c.buildingBoxes,colliders);
    assert.equal(JSON.stringify(colliders),initial);
    assert.deepEqual({...result.stadium},{x:-280,z:200,enhanced:true});
    assert(packed.some(p=>p.name==='chicago-wrigley-visual-trim'));
});

test('Navy Pier fica a leste e traz uma roda-gigante independente',()=>{
    const c=city();
    const result=World.build(c);
    const pier=result.pier;
    assert(pier.x>320);
    assert(pier.wheel.name==='chicago-navy-pier-ferris-wheel');
    assert(pier.wheel.children.length>=21);
    assert.equal(pier.wheel.parent,result.root);
    assert(result.root.children.some(n=>n.name==='chicago-sign-navy-pier'));
});

test('outras três cidades não recebem alterações e Chicago sem estádio mantém fallback',()=>{
    for(const id of ['havana','vegas','rio']){
        const c=city(id);
        assert.equal(World.build(c),null);
        assert.equal(c.cityGroup.children.length,0);
        assert.equal(c.chicagoNeighborhoods,undefined);
    }
    const c=city('chicago',false);
    const layer=World.build(c);
    assert.equal(layer.stadium,null);
    assert.equal(layer.districts,10);
});

test('camada só executa quando cidade constrói o cenário, nunca toca IA/física',()=>{
    const builder=read('js/world/city-builder.js');
    const html=read('index.html');
    const a=html.indexOf('js/world/chicago-neighborhoods.js');
    const b=html.indexOf('js/world/city-builder.js');
    assert(a>=0&&b>a);
    assert.match(builder,/DriverChicagoNeighborhoods\.build\(this\)/);
    assert(builder.indexOf('DriverChicagoOverhaul.buildCity(this)')<
        builder.indexOf('DriverChicagoNeighborhoods.build(this)'));
    const layer=read('js/world/chicago-neighborhoods.js');
    assert.doesNotMatch(layer,/buildingBoxes\.(?:push|splice)|isPointBlocked\(|setGroundHeight|roadExtent\s*=/);
});
