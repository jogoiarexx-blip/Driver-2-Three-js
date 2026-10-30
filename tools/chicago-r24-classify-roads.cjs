#!/usr/bin/env node
'use strict';
/**
 * node tools/chicago-r24-classify-roads.cjs [output.json]
 * Offline, read-only audit; generated output must not be treated as
 * navigation or handed to TrafficAI before graded geometric validation.
 */
const fs=require('node:fs'),path=require('node:path'),
    zlib=require('node:zlib'),crypto=require('node:crypto'),
    assert=require('node:assert/strict');
const Road=require('../js/world/chicago-road-evidence-r24.js');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'chicago/reference-street-survey.json'));
const survey=JSON.parse(source);
const graph=JSON.parse(fs.readFileSync(
    path.join(root,'chicago/reference-network.json'),'utf8'));
const hash=crypto.createHash('sha256').update(source).digest('hex');
assert.equal(graph.sourceSHA256,hash,'R24 precisa usar a mesma versão das superfícies');
assert.equal(graph.edges.length,4279);
assert.equal(graph.nodes.length,3230);
assert.equal(survey.tilesRead,54);
const masks=Object.fromEntries(Road.LAYERS.map(name=>[
    name,zlib.gunzipSync(Buffer.from(
        survey.layers[name].gzipBitsetBase64,'base64'))
]));
const report=Road.classify(graph,survey,masks);
assert.equal(Object.values(report.counts).reduce((a,b)=>a+b,0),4279);
const r23=JSON.parse(fs.readFileSync(
    path.join(root,'chicago/reference-north-candidate-r23.json'),'utf8'));
report.r23Candidate=r23.sourceEdgeIds.map(id=>{
    const r=report.records[id];
    return {id,confidence:r.confidence,
        center:r.center,shoulders:r.shoulders,
        laneEdges:r.laneEdges,water:r.water,lengthOBJ:r.lengthOBJ};
});
report.r23CandidateRoutedWithoutGeographicCertification=true;
const out=process.argv[2]||'qa-artifacts/chicago-r24/road-evidence.json';
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log('CHICAGO_R24_PAVING_AUDIT '+JSON.stringify({
    edges:report.graphEdges,nodes:report.graphNodes,
    tiles:report.tilesRead,counts:report.counts,
    lengthsOBJ:report.lengthsOBJ,
    components:report.components.slice(0,6).map(x=>({
        edges:x.edges,lengthOBJ:x.lengthOBJ,firstEdge:x.firstEdge
    })),
    r23:report.r23Candidate,
    output:out,roadCertified:false
}));
