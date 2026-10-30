'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
    fs=require('node:fs');
const Routes=require('../js/world/chicago-layered-routes-r28.js');
function fixture(){
    const nodes=[
        {pointOBJ:[0,0]}, {pointOBJ:[3,0]}, {pointOBJ:[6,0]},
        {pointOBJ:[3,-3]}, {pointOBJ:[3,3]}, // crossing at same X/Z but separate IDs
        {pointOBJ:[3,-3]}, {pointOBJ:[3,3]},
        {pointOBJ:[8,0]}];
    const edges=[
        {from:0,to:1,pointsOBJ:[[0,0],[3,0]]},
        {from:1,to:2,pointsOBJ:[[3,0],[6,0]]},
        {from:3,to:4,pointsOBJ:[[3,-3],[3,3]]},
        {from:5,to:6,pointsOBJ:[[3,-3],[3,3]]},
        {from:2,to:7,pointsOBJ:[[6,0],[8,0]]}
    ];
    const grade={
        nodes:nodes.map((n,i)=>({id:i,status:'single-surface',
            yMin:i===3||i===4?.82:0,yMax:i===3||i===4?.82:0})),
        edges:edges.map((e,id)=>({id,status:'single-level-evidence'}))
    };
    const paving=edges.map(()=>({confidence:'medium'}));
    grade.edges[3].status='multi-level-conflict';
    paving[4].confidence='review';
    return {graph:{nodes,edges},grade,paving};
}
test('R28 never connects two crossed paths via common X/Z if original PS1 node IDs differ',()=>{
    const {graph,grade,paving}=fixture();
    const m=Routes.build(graph,grade,paving);
    assert.equal(m.candidates,3);
    assert.equal(m.rejected.paving,1);
    assert.equal(m.rejected.grade,1);
    assert.equal(m.components.length,2);
    const r=Routes.route(m,0,2);
    assert.deepEqual(r.nodeIds,[0,1,2]);
    assert.deepEqual(r.edgeIds,[0,1]);
    assert.equal(r.lengthOBJ,6);
    assert.equal(Routes.route(m,0,4),null);
    assert.equal(m.fakeTwoDimensionalJunctionsAdded,0);
    assert.equal(m.trafficEnabled,false);
});
test('R28 rejects steep ramps even when source level samples appear consistent',()=>{
    const {graph,grade,paving}=fixture();
    grade.nodes[2].yMin=.7;grade.nodes[2].yMax=.7;
    const m=Routes.build(graph,grade,paving);
    assert.equal(m.rejected.endpoint,1);
    assert.equal(Routes.route(m,0,2),null);
    assert.equal(Routes.route(m,0,1).lengthOBJ,3);
});
test('R28 rejects noisy or unknown node heights instead of inferring a road',()=>{
    const {graph,grade,paving}=fixture();
    grade.nodes[1].status='nearby';
    const m=Routes.build(graph,grade,paving);
    assert.equal(m.rejected.node,2);
    assert.equal(Routes.route(m,0,2),null);
    assert.equal(m.certifiedRoads,0);
});
test('R28 rejects excessive grade slope even if below absolute endpoint limit',()=>{
    const {graph,grade,paving}=fixture();
    grade.nodes[1].yMin=.15;grade.nodes[1].yMax=.15;
    const m=Routes.build(graph,grade,paving,{maxSlope:.04});
    assert.equal(m.rejected.slope,1);
    assert.equal(Routes.route(m,0,2),null);
});
test('R28 shortest path is deterministic and does not fabricate disconnected edges',()=>{
    const {graph,grade,paving}=fixture();
    const m=Routes.build(graph,grade,paving);
    const a=Routes.route(m,2,0);
    assert.deepEqual(a.edgeIds,[1,0]);
    assert.equal(Routes.route(m,42,0),null);
    assert.deepEqual(Routes.route(m,1,1).nodeIds,[1]);
    const j=Routes.publication(m);
    assert.deepEqual(j.candidateEdgeIds,[0,1,2]);
    assert.equal(j.noInferredCrossings,true);
    assert.equal(j.certifiedRoads,0);
    assert.equal(j.autoTrafficRouting,false);
});
test('R28 invalid mixed source datasets abort rather than creating fake links',()=>{
    const {graph,grade,paving}=fixture();
    assert.throws(()=>Routes.build(graph,grade,paving.slice(1)),/mesma revisão/);
    assert.throws(()=>Routes.build(graph,grade,paving,{maxSlope:.9}),/Inclinação/);
});
test('R28 does not alter game traffic/missions before true geographic certification',()=>{
    const routes=fs.readFileSync('js/world/chicago-layered-routes-r28.js','utf8');
    const tool=fs.readFileSync('tools/chicago-r28-layered-route-audit.cjs','utf8');
    const original=fs.readFileSync('js/world/city-builder.js','utf8');
    assert.match(routes,/fakeTwoDimensionalJunctionsAdded:0/);
    assert.match(routes,/missionsMigrated:false/);
    assert.match(tool,/chicago-r26-grade-audit/);
    assert.match(tool,/includeRaster:true/);
    assert(!original.includes('DriverChicagoR28LayeredRoutes.prepare'));
});
