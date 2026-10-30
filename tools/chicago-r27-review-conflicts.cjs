#!/usr/bin/env node
'use strict';
/**
 * Chicago R27 — grade-conflict triage using the R26 raster of all original
 * PS1 geometry. Does NOT modify or import any playable road/mission graph.
 * Usage: node tools/chicago-r27-review-conflicts.cjs [output.json]
 */
const fs=require('node:fs'),path=require('node:path'),
    assert=require('node:assert/strict');
const Root=path.resolve(__dirname,'..');
const R26=require('./chicago-r26-grade-audit.cjs');
const Guard=require('../js/world/chicago-grade-guard-r26.js');
const Review=require('../js/world/chicago-grade-review-r27.js');
function build(root=Root,file='qa-artifacts/chicago-r27/height-review.json'){
    const source=JSON.parse(fs.readFileSync(path.join(root,
        'chicago/reference-network.json'),'utf8'));
    const expected=JSON.parse(fs.readFileSync(path.join(root,
        'chicago/reference-grade-r26.json'),'utf8'));
    const run=R26.build(root,'qa-artifacts/chicago-r27/r26-regression.json',
        {includeRaster:true});
    assert.equal(run.raster.trianglesRead,1544872);
    assert.equal(source.edges.length,4279);
    assert.equal(run.grade.edges.length,source.edges.length);
    const actual=run.grade.edges.filter(e=>
        e.status==='multi-level-conflict').map(e=>e.id);
    assert.deepEqual(actual,expected.conflictEdgeIds,
        'R27 requires matching immutable R26-grade conflict evidence');
    assert.equal(source.sourceSHA256,expected.sourceSurveySHA256);
    const review=Review.audit(source,run.raster,run.grade,{
        edgeProbes:Guard.edgeProbes.bind(Guard),
        hash:source.sourceSHA256
    });
    assert.equal(review.inspectedConflictEdges,55);
    assert.equal(review.sourceTiles,54);
    assert.equal(review.sourceTriangles,1544872);
    const dest=path.resolve(root,file);
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.writeFileSync(dest,JSON.stringify(review,null,2)+'\n');
    const compact={
        format:review.format,
        sourceSurveySHA256:source.sourceSHA256,
        sourceTiles:review.sourceTiles,
        sourceTriangles:review.sourceTriangles,
        sourceGraphEdges:review.sourceGraphEdges,
        inspectedConflictEdges:review.inspectedConflictEdges,
        conflictBreakdown:review.conflictBreakdown,
        records:review.records.map(r=>({
            id:r.id,kind:r.kind,overlapCells:r.overlapCells,
            sustainedHighGapCells:r.sustainedHighGapCells,
            maxHeightDifferenceOBJ:r.maxHeightDifferenceOBJ,
            examples:r.examples.slice(0,2)
        })),
        existingReferenceRoutes:Object.fromEntries(
            Object.entries(review.routes).map(([name,rows])=>[
                name,rows.map(r=>({id:r.id,kind:r.kind,
                    grade:r.sourceGrade,overlapCells:r.overlapCells,
                    maxHeightDifferenceOBJ:r.maxHeightDifferenceOBJ}))
            ])),
        autoTrafficJunctionsAuthorized:0,
        certifiedOverpasses:0,certifiedAtGradeJunctions:0,
        warning:review.warning
    };
    const compactPath=path.join(path.dirname(dest),'grade-review-compact.json');
    fs.writeFileSync(compactPath,JSON.stringify(compact,null,2)+'\n');
    console.log('CHICAGO_R27_GRADE_REVIEW '+JSON.stringify({
        sourceTriangles:review.sourceTriangles,
        sourceSectors:review.sourceTiles,
        conflicts:review.inspectedConflictEdges,
        counts:review.conflictBreakdown,
        r23:compact.existingReferenceRoutes.r23,
        r25:compact.existingReferenceRoutes.r25,
        output:path.relative(root,dest),
        compact:path.relative(root,compactPath),
        certifiedOverpasses:0,trafficRewired:false
    }));
    console.log('CHICAGO_R27_GRADE_COMPACT '+JSON.stringify(compact));
    return {review,compact};
}
if(require.main===module)build(Root,process.argv[2]||
    'qa-artifacts/chicago-r27/height-review.json');
module.exports={build};
