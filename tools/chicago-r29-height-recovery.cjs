#!/usr/bin/env node
'use strict';
/**
 * R29 read-only source-height recovery. No runtime wiring. Treat every
 * recovered span as REVIEW ONLY until original street geometry is checked.
 */
const fs=require('node:fs'),path=require('node:path'),
    assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const Source=require('./chicago-r26-grade-audit.cjs');
const Guard=require('../js/world/chicago-grade-guard-r26.js');
const R28=require('../js/world/chicago-layered-routes-r28.js');
const R29=require('../js/world/chicago-height-recovery-r29.js');
function build(output='qa-artifacts/chicago-r29/local-height-recovery.json'){
    const graph=require('../chicago/reference-network.json');
    const earlier=require('../chicago/reference-layered-r28.json');
    assert.equal(graph.sourceSHA256,earlier.sourceSurveySHA256);
    const full=Source.build(root,'qa-artifacts/chicago-r29/r26-recheck.json',
        {includeRaster:true});
    assert.equal(full.raster.tilesRead,54);
    assert.equal(full.raster.trianglesRead,1544872);
    const old=R28.build(graph,full.grade,full.paving.records);
    assert.deepEqual(old.edges.map(e=>e.id),earlier.candidateEdgeIds);
    const result=R29.classify(graph,full.grade,full.paving.records,
        full.raster,Guard.edgeProbes.bind(Guard),earlier.candidateEdgeIds);
    const allIds=new Set([...earlier.candidateEdgeIds,...result.additionalEdgeIds]);
    assert.equal(allIds.size,earlier.candidateCount+result.recoveredEdges);
    // No inferred coordinates or joins: one and only one ORIGINAL node ID
    // per graph endpoint. Heights are diagnostic annotations, not traffic.
    const adjacency=new Map();
    const lengths=new Map();
    for(const id of allIds){
        const e=graph.edges[id];
        let length=0;
        for(let i=1;i<e.pointsOBJ.length;i++)
            length+=Math.hypot(e.pointsOBJ[i][0]-e.pointsOBJ[i-1][0],
                e.pointsOBJ[i][1]-e.pointsOBJ[i-1][1]);
        lengths.set(id,length);
        for(const [from,to] of [[e.from,e.to],[e.to,e.from]]){
            if(!adjacency.has(from))adjacency.set(from,[]);
            adjacency.get(from).push({to,edgeId:id,length:+length.toFixed(4)});
        }
    }
    const combined={adjacency};
    const components=R28.components(combined);
    result.sourceSHA256=graph.sourceSHA256;
    result.sourceGLBTiles=54;result.originalTriangles=1544872;
    result.combinedCandidateCount=allIds.size;
    result.combinedCandidateIds=[...allIds].sort((a,b)=>a-b);
    result.components=components.map(c=>({
        nodes:c.nodes,edges:c.edges,totalLengthOBJ:c.totalLengthOBJ,
        nodeIds:c.nodeIds.slice(0,30),edgeIds:c.edgeIds.slice(0,40)
    }));
    result.topComponents=components.slice(0,10).map(c=>({
        nodes:c.nodes,edges:c.edges,totalLengthOBJ:c.totalLengthOBJ,
        samplePath:R28.route(combined,c.nodeIds[0],
            c.nodeIds[Math.min(c.nodeIds.length-1,8)])
    }));
    const byId=new Map(result.additions.map(e=>[e.id,e]));
    result.existingSourceRoutes={
        r23:require('../chicago/reference-north-candidate-r23.json')
            .sourceEdgeIds.map(id=>({id,baseline:earlier.candidateEdgeIds.includes(id),
                recovered:byId.has(id),
                grade:full.grade.edges[id].status,
                paving:full.paving.records[id].confidence})),
        r25:require('../chicago/reference-eastern-fork-r25.json')
            .sourceEdgeIds.map(id=>({id,baseline:earlier.candidateEdgeIds.includes(id),
                recovered:byId.has(id),
                grade:full.grade.edges[id].status,
                paving:full.paving.records[id].confidence}))
    };
    const out=path.resolve(root,output);
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
    const compact={
        format:result.format,
        sourceSHA256:result.sourceSHA256,
        sourceGLBTiles:54,originalTriangles:1544872,
        previousCandidateCount:result.baselineEdges,
        recoveredEdgeCount:result.recoveredEdges,
        recoveredEdges:result.additions,
        combinedCandidateCount:result.combinedCandidateCount,
        combinedCandidateIds:result.combinedCandidateIds,
        rejections:result.rejections,
        topComponents:result.topComponents,
        referenceRoutes:result.existingSourceRoutes,
        sourceRoadsCertified:false, trafficEnabled:false,
        missionRoutesModified:false,
        warning:'Neighbor-triangle recovery is source-level evidence, NOT verified road terrain or authorized traffic. No fabricated connections.'
    };
    fs.writeFileSync(path.join(path.dirname(out),'recovery-compact.json'),
        JSON.stringify(compact,null,2)+'\n');
    console.log('CHICAGO_R29_HEIGHT_RECOVERY '+JSON.stringify({
        baseline:result.baselineEdges,recovered:result.recoveredEdges,
        combined:result.combinedCandidateCount,
        rejections:result.rejections,
        components:result.topComponents.slice(0,3),
        r23:result.existingSourceRoutes.r23,
        r25:result.existingSourceRoutes.r25,
        trafficEnabled:false
    }));
    console.log('CHICAGO_R29_COMPACT '+JSON.stringify(compact));
    return {result,compact};
}
if(require.main===module)build(process.argv[2]||
    'qa-artifacts/chicago-r29/local-height-recovery.json');
module.exports={build};
