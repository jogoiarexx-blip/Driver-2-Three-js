'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Street=require('../js/world/chicago-ps1-street-network-r22.js');
const Inventory=require('../tools/chicago-r71-sector-inventory.cjs');
const root=process.cwd();
const clean=(extra={})=>({
    preset:{id:'chicago'},cityGroup:{children:[],add(o){this.children.push(o)}},
    isWaterAt:()=>false,isPointBlocked:()=>false,
    getGroundHeightAt:()=>0,...extra
});
const road={id:'north-branch-to-wrigley-grid',
    from:{x:-320,z:300},to:{x:-240,z:320},width:8};

test('R71: inferred PS1 connector tests full lane width, water and walls',()=>{
    const c=clean();
    const a=Street.checkConnector(c,road);
    assert.equal(a.valid,true);
    assert(a.pointsTested>=100);
    c.isWaterAt=(x,z)=>z>312&&x<-270;
    assert.equal(Street.checkConnector(c,road).reason,'water');
    c.isWaterAt=()=>false;
    c.isPointBlocked=(x,z)=>x>-280&&z>312;
    assert.equal(Street.checkConnector(c,road).reason,'collision');
    c.isPointBlocked=()=>false;
    assert.equal(Street.checkConnector(c,{...road,width:Infinity}).valid,false);
    assert.equal(Street.checkConnector(c,{...road,
        to:{x:Infinity,z:300}}).valid,false);
});

test('R71: discontinuous pavement levels cannot become a false road/bridge',()=>{
    let samples=0;
    const c=clean({getGroundHeightAt:(x,z,referenceY,forVehicle)=>{
        assert.equal(forVehicle,true);
        samples++;
        return x>-270?3.0:0;
    }});
    const audited=Street.checkConnector(c,road);
    assert.equal(audited.valid,false);
    assert.equal(audited.reason,'disconnected-floor-levels');
    assert(samples>10);
    c.getGroundHeightAt=(x,z)=>Number.isFinite(x)?NaN:0;
    assert.equal(Street.checkConnector(c,road).reason,
        'missing-floor-height');
    c.getGroundHeightAt=(x,z)=>.002*(x+320);
    assert.equal(Street.checkConnector(c,road).valid,true,
        'gradual grades remain safe');
});

test('R71: actual GLB connector street geometry follows exact tire surface',()=>{
    class BufferGeometry {
        constructor(){this.attributes={}}
        setAttribute(k,v){this.attributes[k]=v}
        computeVertexNormals(){}
    }
    class Attr{
        constructor(array,itemSize){this.array=array;this.itemSize=itemSize;
            this.count=array.length/itemSize}
    }
    class Material{constructor(o){this.options=o}}
    class Mesh{
        constructor(geometry,material){this.geometry=geometry;
            this.material=material;this.userData={};}
    }
    const THREE={BufferGeometry,Float32BufferAttribute:Attr,
        MeshLambertMaterial:Material,Mesh,DoubleSide:2};
    const js=fs.readFileSync('js/world/chicago-ps1-street-network-r22.js','utf8');
    const Impl=vm.runInNewContext(js+';DriverChicagoPS1StreetNetwork',{THREE});
    const c=clean({getGroundHeightAt:(x,z)=>.001*x+.003*z});
    assert.equal(Impl.checkConnector(c,road).valid,true);
    const mesh=Impl.makeMesh(c,road);
    const pos=mesh.geometry.attributes.position;
    assert(pos.count>6,'many short strips, not a floating flat rectangle');
    assert.equal(mesh.userData.drivingFloorMatched,true);
    assert.equal(mesh.userData.originalPlacementCertified,false);
    let varied=false,last=null;
    for(let i=0;i<pos.array.length;i+=3){
        const [x,y,z]=pos.array.slice(i,i+3);
        assert(Math.abs(y-(c.getGroundHeightAt(x,z)+.039))<1e-8,
            'every vertex must use exact wheel height');
        if(last!==null&&Math.abs(y-last)>.01)varied=true;
        last=y;
    }
    assert(varied,'real slope produces varying mesh vertex height');
    assert.equal(c.cityGroup.children[0],mesh);
    assert.equal(c.buildingBoxes,undefined,'no invented building collider');
});

test('R71: every original PS1 GLB tile gets an honest per-sector inventory',()=>{
    const manifest=JSON.parse(fs.readFileSync('chicago/manifest.json','utf8'));
    const actual=Inventory.build(manifest);
    const saved=JSON.parse(fs.readFileSync(
        'chicago/sector-inventory-r71.json','utf8'));
    assert.deepEqual(actual,saved,'committed report must equal tool output');
    assert.equal(saved.sourceTiles,54);
    assert.equal(saved.sourceTriangles,1544872);
    assert.equal(saved.sourceFaces,840281);
    assert.equal(saved.sectorsCertifiedForGameplay,0);
    assert.equal(saved.sectors.length,54);
    const ids=new Set(saved.sectors.map(s=>s.id));
    assert.equal(ids.size,54);
    for(const sector of saved.sectors){
        assert(fs.existsSync(sector.meshUrl),
            'source sector GLB missing: '+sector.meshUrl);
        assert(sector.triangles>0);
        assert.equal(sector.drivingFloor,'not-certified');
        assert.equal(sector.trafficAI,'not-certified');
        assert.equal(sector.collisions,'not-certified');
        assert.equal(sector.missions,'not-certified');
        assert.equal(sector.humanPlaytestE4,'not-run');
        assert.equal(sector.gameplayPlacement,'not-calibrated-to-undercover');
    }
});

test('R71: incomplete or duplicate source manifest cannot certify sectors',()=>{
    const manifest=JSON.parse(fs.readFileSync('chicago/manifest.json','utf8'));
    const broken=structuredClone(manifest);
    broken.tiles[1].id=broken.tiles[0].id;
    assert.throws(()=>Inventory.build(broken),/Duplicate/);
    const truncated=structuredClone(manifest);
    truncated.tiles.pop();
    assert.throws(()=>Inventory.build(truncated),/totals/);
});
