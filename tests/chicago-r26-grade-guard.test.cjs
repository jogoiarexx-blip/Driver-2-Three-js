'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
    fs=require('node:fs'),path=require('node:path'),
    os=require('node:os');
const Grade=require('../js/world/chicago-grade-guard-r26.js');
const Tool=require('../tools/chicago-r26-grade-audit.cjs');
function raster(){
    const width=33,height=33,count=new Uint16Array(width*height),
        minY=new Float32Array(width*height),
        maxY=new Float32Array(width*height);
    minY.fill(Infinity);maxY.fill(-Infinity);
    return {width,height,xminOBJ:0,zmaxOBJ:8,
        stepOBJ:.25,count,minY,maxY,tilesRead:54,trianglesRead:1544872};
}
function add(r,x,z,y){
    const c=Math.round(x/r.stepOBJ),
        row=Math.round((r.zmaxOBJ-z)/r.stepOBJ),
        i=row*r.width+c;
    r.count[i]++;
    r.minY[i]=Math.min(y,r.minY[i]);
    r.maxY[i]=Math.max(y,r.maxY[i]);
}
function pathGraph(){
    return {nodes:[
      {pointOBJ:[1,4]},{pointOBJ:[3,4]},
      {pointOBJ:[5,4]},{pointOBJ:[7,4]}
    ],edges:[
      {from:0,to:1,pointsOBJ:[[1,4],[3,4]]},
      {from:1,to:2,pointsOBJ:[[3,4],[5,4]]},
      {from:2,to:3,pointsOBJ:[[5,4],[7,4]]}
    ]};
}
test('R26 rasterizes source-space triangle at actual y height',()=>{
    const r=raster(),tri=[[1,0,4],[3,0,4],[2,0,6]];
    const n=Tool.rasterizeTriangle(r,tri);
    assert(n>5);
    assert.equal(Grade.sample(r,2,5).status,'single-surface');
    assert.equal(Grade.sample(r,2,5).yMin,0);
});
test('R26 detects stacked polygons at same x/z as grade conflict',()=>{
    const r=raster(),tri=[[1,0,4],[3,0,4],[2,0,6]],
        raised=tri.map(p=>[p[0],.84,p[2]]);
    Tool.rasterizeTriangle(r,tri);
    Tool.rasterizeTriangle(r,raised);
    const point=Grade.sample(r,2,5);
    assert.equal(point.status,'stacked');
    assert(point.yMax-point.yMin>.8);
    assert.equal(point.distanceCells,0);
});
test('R26 marks missing elevations as unsupported, not imaginary ground',()=>{
    const r=raster(),sample=Grade.sample(r,2,5);
    assert.equal(sample.status,'unknown');
    assert.equal(sample.yMin,null);
    const out=Grade.sample(r,-2,200);
    assert.equal(out.status,'outside');
});
test('R26 distinguishes ramps from true same-level evidence',()=>{
    const r=raster();
    for(let i=0;i<=24;i++){
        const x=1+i*.25,y=i*.04;
        add(r,x,4,y);
    }
    const e={from:0,to:1,pointsOBJ:[[1,4],[7,4]]};
    const nodes=[Grade.sample(r,1,4),Grade.sample(r,7,4)];
    assert.equal(Grade.inspectEdge(e,r,nodes).status,'ramp-review');
    assert.equal(Grade.inspectEdge(e,r,nodes).streetCertified,false);
});
test('R26 refuses to connect stacked crossings, even when 2D graph shares node',()=>{
    const r=raster();
    for(let i=0;i<=24;i++)add(r,1+i*.25,4,0);
    add(r,3,4,.85);
    const graph=pathGraph();
    const report=Grade.audit(graph,r);
    assert.equal(report.nodes[1].status,'stacked');
    assert.equal(report.edges[0].status,'multi-level-conflict');
    assert.equal(report.edges[1].status,'multi-level-conflict');
    assert.equal(report.edges[2].status,'single-level-evidence');
    assert.deepEqual(report.gradeGuardCandidates,[2]);
    assert.deepEqual(report.stackedNodeIds,[1]);
    assert.equal(report.gradedIntersectionsCertified,false);
    assert.equal(report.trafficRewired,false);
});
test('R26 grade guard components do not join routes via coordinate proximity',()=>{
    const e=(id,from,to)=>({id,from,to});
    const groups=Grade.components([
        e(0,0,1),e(1,1,2),e(2,3,4),e(3,5,6)
    ]);
    assert.deepEqual(groups.map(g=>g.edges),[2,1,1]);
    assert(groups.every(g=>g.sampleEdgeIds.length===g.edges));
});
test('R26 refuses invalid raster rather than silently accepting fake level',()=>{
    assert.throws(()=>Grade.audit(pathGraph(),{width:3,height:3,
        minY:new Float32Array(8),maxY:new Float32Array(9),
        count:new Uint16Array(9)}),/Raster de níveis incompleto/);
});
test('R26 grades never mark the whole original Chicago map as certified',()=>{
    const source=fs.readFileSync('js/world/chicago-grade-guard-r26.js','utf8');
    const tool=fs.readFileSync('tools/chicago-r26-grade-audit.cjs','utf8');
    assert.match(source,/gradedIntersectionsCertified:false/);
    assert.match(source,/sourceRoadCertified:false/);
    assert.match(tool,/54/);
    assert.match(tool,/manifest\.tiles\.length,54/);
    assert.match(tool,/graph\.edges\.length,4279/);
});
