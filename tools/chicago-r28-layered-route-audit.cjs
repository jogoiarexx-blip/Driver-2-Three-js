#!/usr/bin/env node
'use strict';
/**
 * R28: real source GLB heights + R24 asphalt evidence + R26 floor
 * grade, produce an ISOLATED candidate graph for route discovery.
 * This NEVER plugs into DriverCity/Vehicle or authorizes traffic.
 */
const fs=require('node:fs'),path=require('node:path'),
    assert=require('node:assert/strict');
const SourceR26=require('./chicago-r26-grade-audit.cjs');
const Routes=require('../js/world/chicago-layered-routes-r28.js');
const root=path.resolve(__dirname,'..');
function build(output='qa-artifacts/chicago-r28/layered-review-routes.json'){
    const graph=require('../chicago/reference-network.json');
    const gradeMeta=require('../chicago/reference-grade-r26.json');
    const checked=SourceR26.build(root,'qa-artifacts/chicago-r28/r26-height-regression.json',
        {includeRaster:true});
    assert.equal(graph.sourceSHA256,gradeMeta.sourceSurveySHA256);
    assert.equal(checked.raster.tilesRead,54);
    assert.equal(checked.raster.trianglesRead,1544872);
    assert.deepEqual(checked.grade.edges.filter(e=>
        e.status==='multi-level-conflict').map(e=>e.id),gradeMeta.conflictEdgeIds);
    const model=Routes.build(graph,checked.grade,checked.paving.records);
    const payload=Routes.publication(model);
    payload.sourceSurveySHA256=graph.sourceSHA256;
    payload.sourceGeometrySectors=54;
    payload.sourceTriangles=1544872;
    payload.originalLayeredRoadsCertified=false;
    payload.trafficAndMissionsUnchanged=true;
    payload.referencePaths={
        r23:require('../chicago/reference-north-candidate-r23.json')
            .sourceEdgeIds.map(id=>({
                id,qualified:payload.candidateEdgeIds.includes(id),
                grade:checked.grade.edges[id].status,
                paving:checked.paving.records[id].confidence
            })),
        r25:require('../chicago/reference-eastern-fork-r25.json')
            .sourceEdgeIds.map(id=>({
                id,qualified:payload.candidateEdgeIds.includes(id),
                grade:checked.grade.edges[id].status,
                paving:checked.paving.records[id].confidence
            }))
    };
    const destination=path.resolve(root,output);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.writeFileSync(destination,JSON.stringify(payload,null,2)+'\n');
    const compact={
        format:payload.format,
        sourceSurveySHA256:payload.sourceSurveySHA256,
        sourceGeometrySectors:54,sourceTriangles:1544872,
        sourceGraphNodes:graph.nodes.length,
        sourceGraphEdges:graph.edges.length,
        candidateEdgeIds:payload.candidateEdgeIds,
        candidateCount:payload.candidateEdgeCount,
        filteredEdgeCounts:payload.filteredEdgeCounts,
        components:payload.components.map(c=>({
            nodes:c.nodes,edges:c.edges,
            totalLengthOBJ:c.totalLengthOBJ,
            sampleRoute:c.sampleRoute
        })),
        referencePaths:payload.referencePaths,
        roadCertified:false,trafficEnabled:false,
        missionLocationsMigrated:false,
        notes:payload.notes
    };
    fs.writeFileSync(path.join(path.dirname(destination),
        'layered-routes-compact.json'),JSON.stringify(compact,null,2)+'\n');
    console.log('CHICAGO_R28_LAYERED_ROUTING '+JSON.stringify({
        qualified:payload.candidateEdgeCount,
        rejected:payload.filteredEdgeCounts,
        routingNodes:payload.routingNodes,
        topComponents:payload.components.slice(0,3)
            .map(c=>({edges:c.edges,nodes:c.nodes,
                length:c.totalLengthOBJ,
                example:c.sampleRoute.lengthOBJ})),
        existingRoutes:payload.referencePaths,
        certifiedRoads:0,
        output:path.relative(root,destination)
    }));
    console.log('CHICAGO_R28_COMPACT '+JSON.stringify(compact));
    return {payload,compact};
}
if(require.main===module)build(process.argv[2]||
    'qa-artifacts/chicago-r28/layered-review-routes.json');
module.exports={build};
