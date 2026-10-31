'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const operations=[];
const document={
    createElement(tag){
        assert.equal(tag,'canvas');
        const paints=[];
        const ctx={
            fillStyle:'#000',globalAlpha:1,font:'',textAlign:'',textBaseline:'',
            fillRect(x,y,w,h){
                assert([x,y,w,h].every(Number.isFinite));
                paints.push(['rect',x,y,w,h,this.fillStyle,this.globalAlpha]);
            },
            fillText(text,x,y,maxWidth){
                assert([x,y,maxWidth].every(Number.isFinite));
                paints.push(['text',text,x,y,maxWidth,this.font]);
            }
        };
        const canvas={width:0,height:0,paints,
            getContext(){return ctx;}};
        operations.push(canvas);
        return canvas;
    }
};
class Object3D {
    constructor(){
        this.position={set:(x,y,z)=>{this.pos=[x,y,z];}};
        this.scale={set:(x,y,z)=>{this.scl=[x,y,z];}};
        this.rotation={set:(x,y,z)=>{this.rot=[x,y,z];}};
    }
    updateMatrix(){this.matrix={position:this.pos,scale:this.scl,rotation:this.rot};}
}
class InstancedMesh {
    constructor(geo,mat,count){
        this.geometry=geo;this.material=mat;this.count=count;
        this.instanceMatrix={};this.matrices=[];
        this.userData={};
    }
    setMatrixAt(i,m){this.matrices[i]={...m};}
}
const THREE={
    CanvasTexture:class {constructor(image){this.image=image;}},
    MeshLambertMaterial:class {constructor(props){this.options=props;}},
    PlaneGeometry:class {constructor(w,h){this.width=w;this.height=h;}dispose(){this.disposed=true;}},
    InstancedMesh,Object3D,
    DoubleSide:2,RepeatWrapping:1,
    NearestFilter:2,NearestMipmapNearestFilter:3
};
const file=fs.readFileSync(path.join(root,'js/render/chicago-street-textures.js'),'utf8');
const Textures=vm.runInNewContext(file+'\nDriverChicagoStreetTextures',
    {THREE,document,Math,Number,Array});

test('Chicago sidewalk has 256px concrete slabs with repeat and mipmap',()=>{
    const tex=Textures.createSidewalkTexture();
    assert.equal(tex.image.width,256);
    assert.equal(tex.image.height,256);
    assert.equal(tex.wrapS,THREE.RepeatWrapping);
    assert.equal(tex.magFilter,THREE.NearestFilter);
    assert.equal(tex.minFilter,THREE.NearestMipmapNearestFilter);
    assert(tex.image.paints.length>1100);
    assert(!tex.image.paints.some(p=>p.includes('#eab308')));
});

test('concrete and curb textures are deterministic and do not depend on Math.random',()=>{
    for(const method of ['createSidewalkTexture','createCurbTexture']){
        const a=Textures[method]();
        const b=Textures[method]();
        assert.deepEqual(a.image.paints,b.image.paints);
    }
    const curbs=Textures.createCurbTexture();
    assert.equal(curbs.image.width,256);
    assert.equal(curbs.image.height,64);
});

test('vintage sign atlas has four stable labels without external images',()=>{
    const labels=[];
    for(let i=0;i<4;i++){
        const tex=Textures.createShopSignTexture(i);
        assert.equal(tex.image.width,256);
        assert.equal(tex.image.height,64);
        labels.push(tex.image.paints.find(p=>p[0]==='text')[1]);
    }
    assert.deepEqual(labels,['DINER','MARKET','AUTO PARTS','BARBER']);
});

function city(id='chicago'){
    return {preset:{id},buildingBoxes:[{minX:1,maxX:3}],
        districtTextureCache:new Map(),districtMaterialCache:new Map()};
}
const shops=[
    {x:-100,z:-140,width:17,depth:22,height:13,baseY:.35,
        planned:true,kind:'commercial'},
    {x:-80,z:-180,width:18,depth:24,height:15,baseY:.35,
        planned:true,kind:'commercial'},
    {x:-150,z:-20,width:16,depth:27,height:18,baseY:.35,
        planned:true,kind:'residential'},
    {x:-170,z:-80,width:8,depth:10,height:9,baseY:.35,
        planned:false,kind:'commercial'}
];
test('shop decals are near LOD only, deterministic, no collider changes',()=>{
    const c=city(),parent={children:[],add(o){this.children.push(o);}};
    const original=JSON.stringify(c.buildingBoxes);
    const result=Textures.decorateShops(c,shops,parent);
    assert.equal(result.shops,2);
    assert(result.batches>=1&&result.batches<=2);
    assert.equal(parent.children.reduce((n,b)=>n+b.count,0),2);
    assert.equal(JSON.stringify(c.buildingBoxes),original);
    for(const child of parent.children){
        assert(child.userData.visualOnly);
        assert(child.matrices.every(m=>m.position[1]>0&&m.position[2]<0));
        assert(child.matrices.every(m=>m.scale[0]>0&&m.scale[1]===.75));
    }
    const size=c.districtMaterialCache.size;
    Textures.decorateShops(c,shops,{add(){}});
    assert.equal(c.districtMaterialCache.size,size,'textures must be reused');
});
test('shop decoration is Chicago-specific and requires planned lots',()=>{
    for(const id of ['havana','rio','vegas']){
        const parent={children:[],add(o){this.children.push(o);}};
        const result=Textures.decorateShops(city(id),shops,parent);
        assert.equal(result.shops,0);
        assert.equal(parent.children.length,0);
    }
    const parent={children:[],add(o){this.children.push(o);}};
    assert.equal(Textures.decorateShops(city(),shops.filter(b=>!b.planned),parent).shops,0);
});

test('rendering uses shared sidewalk materials, never changes street or LOD topology',()=>{
    const builder=fs.readFileSync(path.join(root,'js/world/city-builder.js'),'utf8');
    const road=fs.readFileSync(path.join(root,'js/world/road-surface.js'),'utf8');
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    assert.match(builder,/DriverChicagoStreetTextures\.createSidewalkTexture\(\)/);
    assert.match(builder,/DriverChicagoStreetTextures\.decorateShops\(/);
    assert.match(road,/DriverChicagoStreetTextures\.createCurbTexture\(\)/);
    assert.match(builder,/this\.buildingBoxes\.push\(/);
    assert.match(builder,/this\.districtLOD\.register\(/);
    assert(html.includes('js/render/chicago-street-textures.js'));
    assert(html.indexOf('chicago-street-textures.js')<html.indexOf('city-builder.js'));
    assert(html.indexOf('chicago-street-textures.js')<html.indexOf('road-surface.js'));
});
