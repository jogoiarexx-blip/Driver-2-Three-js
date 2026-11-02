'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/world/chicago-city-plan.js','utf8');
const Plan=require('../js/world/chicago-city-plan.js');

const lots=[
    ...Plan.lots(-280,120), // Wicker Park residential rowhouses
    ...Plan.lots(-200,200), // Goose Island industrial sheds
    ...Plan.lots(40,-40)    // Loop towers: no gabled rooftop
];
test('R68: Chicago roofs follow real parcel footprints, not large floating boxes',()=>{
    const planned=Plan.roofPlan(lots);
    assert(planned.length>=8);
    const residential=planned.filter(p=>p.kind==='residential');
    const industrial=planned.filter(p=>p.kind==='industrial');
    assert(residential.length>=6);
    assert(industrial.length>=2);
    for(const p of planned){
        const lot=lots.find(b=>b.x===p.lotX&&b.z===p.lotZ);
        assert(lot,'roof must belong to an existing parcel');
        assert(p.width>0&&p.depth>0&&p.height>0);
        assert(Math.abs(p.x-lot.x)+p.width/2<=lot.width/2+.001,
            'roof cannot cross to neighboring property');
        assert(Math.abs(p.z-lot.z)+p.depth/2<=lot.depth/2+.001);
        assert(p.y>=lot.height+(lot.baseY??.35));
        assert(!p.isCollider);
    }
    assert.deepEqual(planned,Plan.roofPlan(lots),
        'roof palette and shapes must be deterministic across reload');
});
test('R68: rooflines reject malformed lots and never alter other cities',()=>{
    const malformed=[
        {planned:true,kind:'residential',x:NaN,z:0,width:12,depth:15,height:9},
        {planned:true,kind:'industrial',x:0,z:0,width:0,depth:15,height:9},
        {planned:true,kind:'commercial',x:0,z:0,width:14,depth:15,height:12},
        {planned:false,kind:'residential',x:0,z:0,width:15,depth:20,height:11}
    ];
    assert.deepEqual(Plan.roofPlan(malformed),[]);
    const root={children:[],add(m){this.children.push(m)}};
    assert.equal(Plan.addRooflines({preset:{id:'havana'}},lots,root),0);
    assert.equal(root.children.length,0);
});
test('R68: one reusable triangular roof mesh per active Chicago LOD chunk',()=>{
    class Geometry {
        constructor(){this.data={}}
        setAttribute(k,v){this.data[k]=v}
        computeVertexNormals(){this.normals=true}
    }
    class Object3D {
        constructor(){this.matrix={};this.position={set(){}};this.scale={set(){}};
            this.rotation={set(){}};}
        updateMatrix(){}
    }
    class Mesh {
        constructor(g,m,n){this.geometry=g;this.material=m;this.count=n;
            this.instanceMatrix={needsUpdate:false};
            this.instanceColor={needsUpdate:false};
            this.userData={};this.instances=[];this.colors=[];}
        setMatrixAt(i,m){this.instances[i]=m}
        setColorAt(i,c){this.colors[i]=c}
    }
    class Color{constructor(color){this.hex=color}}
    class Material{constructor(spec){this.options=spec}}
    class Attr{constructor(a,n){this.array=a;this.itemSize=n}}
    const mock={BufferGeometry:Geometry,InstancedMesh:Mesh,Object3D,
        Color,MeshLambertMaterial:Material,
        Float32BufferAttribute:Attr,DoubleSide:2};
    const Impl=vm.runInNewContext(source+';DriverChicagoCityPlan',{THREE:mock});
    const root={children:[],add(m){this.children.push(m)}};
    const city={preset:{id:'chicago'},buildingBoxes:[
        {minX:0,maxX:10,minZ:0,maxZ:10}
    ]};
    const before=city.buildingBoxes.length;
    const count=Impl.addRooflines(city,lots,root);
    assert.equal(count,Plan.roofPlan(lots).length);
    assert.equal(root.children.length,1);
    assert.equal(root.children[0].name,'chicago-r68-rooflines');
    assert.equal(root.children[0].count,count);
    assert.equal(root.children[0].instanceMatrix.needsUpdate,true);
    assert.equal(root.children[0].geometry.data.position.array.length,54,
        '6 triangles (2 roof slopes + gables) = 18 vertices');
    assert.equal(city.buildingBoxes.length,before,'visual roof adds no physics');
});
