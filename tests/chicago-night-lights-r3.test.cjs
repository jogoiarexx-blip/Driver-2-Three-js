'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const file=fs.readFileSync(path.join(root,'js/render/chicago-night-lights.js'),'utf8');
class Object3D{
    constructor(){
        this.position={set:(x,y,z)=>{this.p=[x,y,z];}};
        this.rotation={set:(x,y,z)=>{this.r=[x,y,z];}};
        this.scale={set:(x,y,z)=>{this.s=[x,y,z];}};
    }
    updateMatrix(){this.matrix={p:this.p,r:this.r,s:this.s};}
}
class Color{
    constructor(v=0){this.hex=v;}
    setHex(hex){this.hex=hex;return this;}
}
class Material{
    constructor(props={}){
        Object.assign(this,props);
        this.color=new Color(props.color);
        this.emissive=props.emissive!==undefined?new Color(props.emissive):null;
        this.userData={};
    }
}
class BufferAttribute{
    constructor(data,size){this.data=data;this.itemSize=size;
        this.count=data.length/size;this.needsUpdate=false;}
    setXYZ(i,x,y,z){this.data[i*3]=x;this.data[i*3+1]=y;this.data[i*3+2]=z;}
}
class BufferGeometry{
    constructor(){this.attributes={};}
    setAttribute(key,attr){this.attributes[key]=attr;}
}
class PlaneGeometry{
    constructor(w,h){this.w=w;this.h=h;}
    rotateX(angle){this.rotation=angle;}
    dispose(){this.disposed=true;}
}
class InstancedMesh{
    constructor(geometry,material,count){
        this.geometry=geometry;this.material=material;this.count=count;
        this.userData={};this.matrices=[];this.instanceMatrix={};
    }
    setMatrixAt(index,matrix){this.matrices[index]=JSON.parse(JSON.stringify(matrix));}
}
class Points{
    constructor(geometry,material){
        this.geometry=geometry;this.material=material;this.userData={};
    }
}
const THREE={
    MeshBasicMaterial:Material,PointsMaterial:Material,
    CanvasTexture:class{constructor(canvas){this.image=canvas;}},
    BufferAttribute,BufferGeometry,Points,PlaneGeometry,InstancedMesh,
    Object3D,DoubleSide:2,AdditiveBlending:3
};
const document={
    createElement(name){
        assert.equal(name,'canvas');
        const operations=[];
        const gradient={
            addColorStop(x,color){operations.push([x,color]);}
        };
        const ctx={createRadialGradient(){return gradient;},fillRect(){}};
        return {width:0,height:0,operations,getContext(){return ctx;}};
    }
};
const Nights=vm.runInNewContext(file+'\nDriverChicagoNightLights',
    {THREE,document,Math,Number,Array,Float32Array});
function makeCity(id='chicago'){
    const meshes=[];
    const spots=[[20,-20],[40,-40],[100,-60]];
    const props=spots.map(([x,z],instanceIndex)=>({
        type:'pole',x,z,instanceIndex
    }));
    const bulb={material:new Material({color:0xffe4a3})};
    return {
        preset:{id},districtMaterialCache:new Map(),
        streetLampPositions:spots,streetLampBulb:bulb,
        cityGroup:{children:meshes,add(mesh){this.children.push(mesh);}},
        destructibleProps:props,
        buildingBoxes:[{minX:0,maxX:100,minZ:0,maxZ:100}],
        sidewalkGrid:new Set(['20:-20']),
        districtChunks:new Map()
    };
}
function makeParent(){
    return {children:[],add(mesh){this.children.push(mesh);}};
}
function planned(x,z,type='residential'){
    return {x,z,width:17,depth:19,height:28,baseY:.35,kind:type,planned:true};
}
test('morning has no GPU-visible night passes; dusk/night fade in',()=>{
    const city=makeCity();
    Nights.installStreets(city);
    const state=city.chicagoNightState;
    assert.equal(city.cityGroup.children.length,2);
    assert.equal(state.streetHalos.visible,false);
    assert.equal(state.streetPools.visible,false);
    Nights.update(city,.50);
    assert.equal(state.streetHalos.visible,true);
    assert.equal(state.streetPools.visible,true);
    assert(Math.abs(state.streetHalos.material.opacity-.67*.5)<1e-10);
    assert.equal(city.streetLampBulb.material.color.hex,0xffe0a0);
    Nights.update(city,1);
    assert(state.streetHalos.material.opacity>.65);
    Nights.update(city,0);
    assert.equal(state.streetHalos.visible,false);
    assert.equal(state.streetPools.visible,false);
    assert.equal(city.streetLampBulb.material.color.hex,0x6c7278);
});
test('2 streetlight batches per whole city without point lights or new colliders',()=>{
    const city=makeCity();
    const before=JSON.stringify(city.buildingBoxes);
    const old=Array.from(city.sidewalkGrid);
    const state=Nights.installStreets(city);
    assert.equal(city.cityGroup.children.length,2);
    assert.equal(state.streetHalos.geometry.attributes.position.count,3);
    assert.equal(state.streetPools.count,3);
    assert.deepEqual(Array.from(city.sidewalkGrid),old);
    assert.equal(JSON.stringify(city.buildingBoxes),before);
    assert(state.streetHalos.isLight===undefined);
    assert.equal(Nights.installStreets(city),state,'cannot double-install');
    assert.equal(city.cityGroup.children.length,2);
});
test('broken streetlights remove own halos and fake illumination',()=>{
    const city=makeCity(),state=Nights.installStreets(city);
    const pole=city.destructibleProps[1];
    Nights.hidePole(pole);
    assert.equal(state.streetHalos.geometry.attributes.position.data[4],-1000);
    assert.equal(state.streetHalos.geometry.attributes.position.needsUpdate,true);
    assert.equal(state.streetPools.matrices[1].p[1],-1000);
    assert.equal(state.streetPools.instanceMatrix.needsUpdate,true);
});
test('apartment/commerce window illumination is deterministic, near-LOD only',()=>{
    const city=makeCity(),parent=makeParent();
    const buildings=[
        planned(-100,-120),planned(-80,-120,'commercial'),
        planned(-50,-80,'apartment'),planned(-30,-60,'tower'),
        planned(-20,-40,'industrial'),{...planned(-10,-40),planned:false}
    ];
    const collider=JSON.stringify(city.buildingBoxes);
    const a=Nights.decorateWindows(city,buildings,parent);
    assert(a.windows>0);
    assert(a.batches>0&&a.batches<=2);
    assert.equal(JSON.stringify(city.buildingBoxes),collider);
    assert(parent.children.every(m=>m.userData.visualOnly&&m.visible===false));
    const first=parent.children.flatMap(m=>m.matrices.map(v=>v.p.join(',')));
    const other=makeParent();
    const b=Nights.decorateWindows(makeCity(),buildings,other);
    assert.equal(a.windows,b.windows);
    const second=other.children.flatMap(m=>m.matrices.map(v=>v.p.join(',')));
    assert.deepEqual(first,second);
    const total=buildings.slice(0,4).reduce((n,b)=>
        n+Math.min(18,Math.max(1,Math.floor((b.height-5)/3.3)))*
        Math.min(6,Math.max(1,Math.floor((b.width-1.6)/3))),0);
    assert(a.windows<total,'do not light every window');
    Nights.update(city,1);
    assert(parent.children.every(m=>m.visible));
    Nights.update(city,0);
    assert(parent.children.every(m=>!m.visible));
});
test('city change isolates other cities; shops brighten without point lights',()=>{
    const city=makeCity(),parent=makeParent();
    const material=new Material({color:0xffffff,emissive:0x8b643f,emissiveIntensity:0});
    city.districtMaterialCache.set('chicago-r2-shop-0',material);
    Nights.decorateWindows(city,[planned(12,20)],parent);
    Nights.update(city,.75);
    assert.equal(material.emissive.hex,0x8b643f);
    assert(Math.abs(material.emissiveIntensity-.56*.75)<1e-10);
    assert(Math.abs(city.chicagoNightState.materials[0].opacity-.72*.75)<1e-10);
    const other=makeCity('havana');
    Nights.update(other,1);
    assert.equal(other.chicagoNightState,undefined);
    assert.equal(Nights.installStreets(other),null);
    assert.equal(Nights.decorateWindows(other,[planned(5,10)],makeParent()).windows,0);
    assert.equal(material.emissiveIntensity,.56*.75);
});
test('new near chunk created at night immediately receives proper luminosity',()=>{
    const city=makeCity();
    Nights.update(city,1);
    const near=makeParent();
    const result=Nights.decorateWindows(city,[planned(4,8)],near);
    assert(result.windows>0);
    assert(near.children.every(m=>m.visible));
    assert(city.chicagoNightState.materials[0].opacity>.70);
});
test('clock, LOD and destroyed poles wired correctly; topology unchanged',()=>{
    const read=p=>fs.readFileSync(path.join(root,p),'utf8');
    const builder=read('js/world/city-builder.js');
    const street=read('js/world/street-furniture.js');
    const clock=read('js/render/day-night-cycle.js');
    const store=read('js/render/chicago-street-textures.js');
    const html=read('index.html');
    assert(builder.includes('DriverChicagoNightLights.installStreets(this)'));
    assert(builder.includes('DriverChicagoNightLights.decorateWindows('));
    assert(builder.includes('this.chicagoNightState=null;'));
    assert(street.includes('DriverChicagoNightLights.hidePole(prop)'));
    assert(street.includes('city.streetLampPositions=positions'));
    assert(clock.includes('DriverChicagoNightLights.update(game.city'));
    assert(store.includes('emissiveIntensity:.56*(city.chicagoNightState?.level||0)'));
    assert(html.includes('js/render/chicago-night-lights.js'));
    assert(html.indexOf('chicago-night-lights.js')<html.indexOf('city-builder.js'));
    assert(builder.includes('this.districtLOD.register('));
    assert(builder.includes('this.buildingBoxes = []'));
});
