'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const R48=require('../js/world/chicago-connectors-r48.js');
const Traffic=require('../js/traffic/chicago-neighborhood-traffic.js');

function city(){
    const boxes=[];
    return {
        preset:{id:'chicago'},buildingBoxes:boxes,
        cityGroup:{children:[],add(o){this.children.push(o)}},
        isWaterAt(x,z){return z>34.85&&z<65.15},
        isPointBlocked(x,z,radius=0){
            return boxes.some(b=>x+radius>b.minX&&x-radius<b.maxX &&
                z+radius>b.minZ&&z-radius<b.maxZ);
        }
    };
}
function three(){
    class Obj{
        constructor(){this.children=[];this.position={set(x,y,z){this.x=x;this.y=y;this.z=z}};
            this.rotation={set(x,y,z){this.x=x;this.y=y;this.z=z}};
            this.scale={set(){}};this.userData={};}
        add(o){this.children.push(o)}
        updateMatrix(){this.matrix={};}
    }
    class Mesh extends Obj{constructor(g,m){super();this.geometry=g;this.material=m}}
    class Instances extends Mesh{constructor(g,m,count){super(g,m);
        this.count=count;this.instanceMatrix={needsUpdate:false};}
        setMatrixAt(i,m){assert(i>=0&&i<this.count);}
    }
    return {Group:Obj,Object3D:Obj,Mesh,InstancedMesh:Instances,
        BoxGeometry:class {constructor(...args){this.args=args}},
        MeshLambertMaterial:class{constructor(args){this.args=args}},
        MeshBasicMaterial:class{constructor(args){this.args=args}}};
}
test('R48: six cleared blocks, six intersections, five streets and ten real grid exits',()=>{
    const p=R48.topology();
    assert.equal(p.nodes.length,6);
    assert.equal(p.internalEdges,7);
    assert.equal(p.gridExits,10);
    assert.equal(p.edges.length,17);
    assert.equal(R48.streets().length,5);
    assert(R48.isCarvedBlock(40,-120));
    assert(R48.isCarvedBlock(200,-40));
    assert(!R48.isCarvedBlock(-120,-120));
    assert(!R48.isCarvedBlock(200,-200));
    assert.equal(new Set(p.nodes.map(n=>n.id)).size,6);
    // Undirected graph must connect all internal nodes to grid exits.
    const key=p=>p.x+','+p.z;
    const adjacency=new Map();
    for(const e of p.edges){
        for(const node of [e.from,e.to])
            if(!adjacency.has(key(node)))adjacency.set(key(node),new Set());
        adjacency.get(key(e.from)).add(key(e.to));
        adjacency.get(key(e.to)).add(key(e.from));
    }
    const reached=new Set([key(p.nodes[0])]),queue=[key(p.nodes[0])];
    for(const k of queue)for(const next of adjacency.get(k)||[])
        if(!reached.has(next)){reached.add(next);queue.push(next)}
    assert.equal(reached.size,16); // six nodes + ten external gateways
});
test('R48: road graph passes physical clearance audit and rejects water or blocked roads',()=>{
    const good=city(),audit=R48.audit(good);
    assert(audit.ready);
    assert.equal(audit.blocked.length,0);
    assert.equal(audit.edges.length,17);
    const blocked=city();
    blocked.buildingBoxes.push({minX:87,maxX:93,minZ:-126,maxZ:-114});
    assert(!R48.audit(blocked).ready);
    const flooded=city();
    flooded.isWaterAt=()=>true;
    assert(!R48.audit(flooded).ready);
    assert.equal(R48.audit({...good,preset:{id:'rio'}}),null);
});
test('R48: build replaces cleared blocks with drivable roads, actual junction markings and collision lots',()=>{
    global.THREE=three();
    try{
        const c=city(),plan=R48.build(c);
        assert(plan.ready,JSON.stringify(plan.blocked));
        assert(plan.visualReady);
        assert.equal(plan.corridorsBuilt,5);
        assert.equal(plan.crossingsBuilt,6);
        assert.equal(plan.gridExits,10);
        assert.equal(plan.buildingsBuilt,12);
        assert.equal(plan.sidewalkQuarters,24);
        assert.equal(plan.crosswalkStripes,96);
        assert.equal(c.buildingBoxes.length,12);
        assert.equal(c.cityGroup.children.length,1);
        assert.equal(R48.build(c),plan); // idempotent, no duplicate colliders
        assert.equal(c.buildingBoxes.length,12);
        assert(R48.audit(c).ready);
        assert.equal(Object.keys(plan.loops).length,4);
        for(const loop of Object.values(plan.loops)){
            assert.equal(loop.closed,0);
            for(const p of loop.points){
                assert(!c.isWaterAt(p.x,p.z));
                assert(!c.isPointBlocked(p.x,p.z,1.8));
            }
        }
    }finally{delete global.THREE}
});
test('R48: civilians are spawned on both new loops in same lane direction, other cities unaffected',()=>{
    const c=city();
    c.chicagoConnectorsR48={ready:true,loops:R48.loops()};
    const specs=Traffic.spawnSpecs(c);
    assert.equal(specs.length,6);
    assert.deepEqual(specs.map(s=>s.id),[
        'r48-outer','r48-outer','r48-east','r48-east',
        'r48-grid-west','r48-grid-east']);
    assert(specs.every(s=>s.reverse===false));
    assert(specs.every(s=>s.maxSpeed===12));
    assert.equal(Traffic.spawnSpecs({...c,preset:{id:'vegas'}}).length,0);
    for(const spec of specs){
        const car={x:spec.x,z:spec.z,heading:spec.heading,speed:0,
            chicagoNeighborhoodTrafficId:spec.id,
            chicagoNeighborhoodTrafficPhase:spec.distance,
            chicagoNeighborhoodTrafficReverse:spec.reverse};
        const input=Traffic.getInput(c,car,specs);
        assert(input&&typeof input.up==='boolean');
        assert(car.chicagoNeighborhoodTrafficStatus.id.startsWith('r48-'));
    }
});
test('R48: same CityBuilder and spawnAllVehicles paths feed Undercover and Take a Ride',()=>{
    const html=fs.readFileSync('index.html','utf8');
    const builder=fs.readFileSync('js/world/city-builder.js','utf8');
    const engine=fs.readFileSync('js/engine/driver2-game-engine.js','utf8');
    assert(html.includes('js/world/chicago-connectors-r48.js'));
    assert(html.indexOf('chicago-connectors-r48.js')<
        html.indexOf('city-builder.js'));
    assert(builder.includes('DriverChicagoConnectorsR48.isCarvedBlock('));
    assert(builder.includes('DriverChicagoConnectorsR48.build(this)'));
    assert(engine.includes('this.spawnAllVehicles();'));
    assert(engine.includes('DriverChicagoNeighborhoodTraffic.spawnSpecs('));
    assert(engine.includes("this.startMission('freeroam')"));
});
