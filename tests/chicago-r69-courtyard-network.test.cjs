'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const planSource=fs.readFileSync('js/world/chicago-city-plan.js','utf8');
const Plan=require('../js/world/chicago-city-plan.js');
const Road=require('../js/world/road-geometry.js');
global.DriverRoadGeometry=Road;
const Nav=require('../js/traffic/chicago-mixed-navigation-r49.js');
const city=(extra={})=>({
    preset:{id:'chicago'},roadExtent:320,buildSequence:1,
    buildingBoxes:[],bridgeRaised:false,
    chicagoCityPlan:{blocks:[{x:-280,z:120,kind:'residential',
        district:'wicker-park'}],courtyardLinks:[]},
    isWaterAt:()=>false,isPointBlocked:()=>false,
    getGroundHeightAt:()=>0,
    ...extra
});

test('R69: residential lanes have the same real full-width geometry as collision checks',()=>{
    const c=city(),links=Plan.courtyardLinks(c);
    assert.equal(links.length,2);
    assert.deepEqual(links.map(l=>l.id),[
        'residential--280-120-west','residential--280-120-east']);
    for(const l of links){
        assert.equal(l.width,5.6);
        assert.equal(Plan.verifyCourtyard(c,l),true);
        assert.equal(Road.segmentDrivable(c,
            l.from.x,l.from.z,l.to.x,l.to.z,1.3),true);
        assert.equal(l.to.z,122);
        assert.equal(Math.abs(l.to.x-l.from.x),40);
    }
});

test('R69: no invented asphalt if street shoulders cross canal, walls or abrupt grade',()=>{
    const c=city({isWaterAt:(x,z)=>z>123.2});
    assert.equal(Plan.courtyardLinks(c).length,0,
        'center dry but north shoulder underwater');
    c.isWaterAt=()=>false;
    c.isPointBlocked=(x,z,r)=>z<120;
    assert.equal(Plan.courtyardLinks(c).length,0,
        'south edge of alley clips real building collision');
    c.isPointBlocked=()=>false;
    c.getGroundHeightAt=x=>x<-300?2.4:0;
    assert.equal(Plan.courtyardLinks(c).length,1,
        'a false step prevents the western service street');
    c.getGroundHeightAt=x=>x*.002;
    assert.equal(Plan.courtyardLinks(c).length,2,
        'continuous and physically mild slope remains driveable');
    c.preset.id='rio';
    assert.deepEqual(Plan.courtyardLinks(c),[],
        'never change Havana/Vegas/Rio street topology');
});

test('R69: AI graph invalidates old cache and connects built alley to Chicago grid',()=>{
    const c=city(),before=Nav.compile(c);
    assert.equal(before.courtyardLinks,0);
    const constructed=Plan.courtyardLinks(c);
    c.chicagoCityPlan.courtyardLinks=constructed;
    const after=Nav.compile(c);
    assert.notEqual(after,before);
    assert.equal(after.courtyardLinks,2);
    assert.equal(after.courtyardConnected,2);
    assert(after.nodes.has('-280,122'));
    assert(after.adj.get('-280,122').some(p=>p.key==='-320,122'));
    assert(after.adj.get('-280,122').some(p=>p.key==='-240,122'));
    for(const end of [-320,-240]){
        const path=Nav.plan(c,{x:-280,z:122},{x:end,z:122});
        assert(path&&path.length>=2,'alley inaccessible from street');
        for(let i=1;i<path.length;i++)
            assert(Nav.clear(c,path[i-1],path[i],false),
                'AI must not cut through buildings/water');
    }
    assert.equal(Nav.compile(c),after,'static world should reuse graph');
    c.chicagoCityPlan.courtyardLinks=[];
    assert.notEqual(Nav.compile(c),after,
        'a removed road invalidates graph even when building count is unchanged');
});

test('R69: generated surface and IA edges derive from identical verified segments',()=>{
    class Geo {
        constructor(){this.attributes={};this.count=0}
        setAttribute(key,attr){this.attributes[key]=attr}
        computeVertexNormals(){}
    }
    class Mat{constructor(arg){this.arg=arg}}
    class Mesh{constructor(g,m){this.geometry=g;this.material=m;this.userData={}}}
    class Attr{constructor(data,size){this.array=data;this.itemSize=size}}
    const THREE={BufferGeometry:Geo,Float32BufferAttribute:Attr,
        MeshLambertMaterial:Mat,Mesh,DoubleSide:2};
    const Local=vm.runInNewContext(planSource+';DriverChicagoCityPlan',
        {THREE,Math});
    const c=city({cityGroup:{children:[],
        add(obj){this.children.push(obj)}}});
    const count=c.buildingBoxes.length;
    Local.buildCourtyardLinks(c);
    assert.equal(c.chicagoCityPlan.courtyardLinks.length,2);
    assert.equal(c.chicagoCityPlan.courtyardStreetSegments,2);
    assert.equal(c.chicagoCityPlan.courtyardStreetMeters,80);
    assert.equal(c.cityGroup.children.length,1);
    const mesh=c.cityGroup.children[0];
    assert.equal(mesh.name,'chicago-r69-drivable-residential-service-lanes');
    assert.equal(mesh.userData.chicagoVisualOnly,true);
    assert.equal(mesh.geometry.attributes.position.array.length,
        2*20*6*3,'20 m sections per 40m lane, 2 triangles each');
    assert.equal(c.buildingBoxes.length,count,'no invisible AABBs');
    const graph=Nav.compile(c);
    assert.equal(graph.courtyardConnected,2);
});
