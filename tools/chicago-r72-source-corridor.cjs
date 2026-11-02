#!/usr/bin/env node
'use strict';
/** R72: original PS1 tile/corridor study. Read-only: never enables traffic. */
const fs=require('node:fs'),path=require('node:path'),
    zlib=require('node:zlib'),crypto=require('node:crypto'),
    assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const Corridor=require('../js/world/chicago-corridor-review-r72.js');
const Roads=require('../js/world/chicago-road-evidence-r24.js');
function build(){
    const load=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
    const graph=load('chicago/reference-network.json');
    const r28=load('chicago/reference-layered-r28.json');
    const r29=load('chicago/reference-recovery-r29.json');
    const manifest=load('chicago/manifest.json');
    const r15=load('chicago/reference-curve-r15.json');
    const report=Corridor.build(graph,r28,r29,manifest,r15);
    const reference=load('chicago/corridor-review-r72.json');
    assert.deepStrictEqual(report,reference,
        'The committed source corridor must reproduce deterministically');
    const surveyBytes=fs.readFileSync(path.join(root,
        'chicago/reference-street-survey.json'));
    const hash=crypto.createHash('sha256').update(surveyBytes)
        .digest('hex');
    assert.equal(hash,report.sourceSHA256,
        'R24 material survey differs from the PS1 original graph');
    const survey=JSON.parse(surveyBytes);
    const masks=Object.fromEntries(Roads.LAYERS.map(name=>[
        name,zlib.gunzipSync(Buffer.from(
            survey.layers[name].gzipBitsetBase64,'base64'))
    ]));
    const material=Corridor.materials(report,survey,masks,Roads);
    const rejectedForPhysicalMigration=[];
    if(!['strong','medium'].includes(material.confidence))
        rejectedForPhysicalMigration.push('source-pavement-confidence-not-strong-or-medium');
    if(material.outerEdges<.5||material.grass>.3)
        rejectedForPhysicalMigration.push('narrow-original-road-or-grassy-shoulders');
    if(!report.projectedUndercoverR15.withinLegacyGrid320)
        rejectedForPhysicalMigration.push('R15-world-projection-outside-old-road-grid');
    rejectedForPhysicalMigration.push('original-width-not-certified');
    rejectedForPhysicalMigration.push('placement-and-collision-survey-not-done');
    const result={
        ...report,materialEvidence:material,
        otherLongerR29Route:{
            edgeIds:r29.topComponents[0].samplePath.edgeIds,
            lengthOBJ:r29.topComponents[0].totalLengthOBJ,
            requiresNeighborHeightRecovery:true,
            chosenForR72:false
        },
        sourceOverlayReady:true,
        runtimePhysicalRoadEnabled:false,
        rejectedForPhysicalMigration
    };
    return result;
}
if(require.main===module){
    const result=build(),dest=path.resolve(root,process.argv[2]||
        'qa-artifacts/chicago-r72/corridor-material-audit.json');
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n');
    console.log('CHICAGO_R72_CORRIDOR',JSON.stringify({
        edge:result.candidateEdgeId,
        lengthOBJ:result.lengthPolylineOBJ,
        sourceGLBs:result.tiles.map(t=>t.id),
        originalPaving:result.materialEvidence,
        r28DirectGrade:result.r28Evidence,
        projectedWorldBounds:result.projectedUndercoverR15.bounds,
        physicalRoadEnabled:result.runtimePhysicalRoadEnabled,
        blockedReasons:result.rejectedForPhysicalMigration,
        json:dest
    }));
}
module.exports={build};
