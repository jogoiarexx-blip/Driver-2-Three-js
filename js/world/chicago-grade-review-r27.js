/**
 * Chicago R27 — investigate ambiguous PS1 pavement overlaps at the REAL
 * GLB heights. This never equates shared X/Z with an at-grade junction.
 * 
 * "sustained" means repeated height-separated surface evidence; it is NOT
 * a certified viaduct or a navigable layer. "isolated" can be ramps,
 * duplicate triangles, curb cuts or rasterization noise.
 */
class DriverChicagoGradeReviewR27 {
    static GAP=.12;
    static HIGH_GAP=.45;
    static rasterCell(r,x,z){
        const col=Math.round((x-r.xminOBJ)/r.stepOBJ),
              row=Math.round((r.zmaxOBJ-z)/r.stepOBJ);
        if(col<0||row<0||col>=r.width||row>=r.height)
            return null;
        const i=row*r.width+col;
        return {i,col,row,count:r.count[i],
            min:r.count[i]?r.minY[i]:null,
            max:r.count[i]?r.maxY[i]:null,
            gap:r.count[i]?r.maxY[i]-r.minY[i]:0};
    }
    static neighborhood(r,cell){
        if(!cell)return {stackedNeighbors:0,highGapNeighbors:0};
        let stacked=0,highGap=0;
        for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
            if(!dx&&!dz)continue;
            const col=cell.col+dx,row=cell.row+dz;
            if(col<0||row<0||col>=r.width||row>=r.height)continue;
            const i=row*r.width+col;
            if(!r.count[i])continue;
            const gap=r.maxY[i]-r.minY[i];
            if(gap>this.GAP)stacked++;
            if(gap>this.HIGH_GAP)highGap++;
        }
        return {stackedNeighbors:stacked,highGapNeighbors:highGap};
    }
    static inspectEdge(edge,raster,guard,levelStatus){
        const samples=guard.edgeProbes(edge.pointsOBJ);
        const seen=new Set();
        const conflict=[];
        let unknown=0,neighbor=0,observed=0,maxGap=0;
        for(const p of samples){
            const cell=this.rasterCell(raster,p[0],p[1]);
            if(!cell||!cell.count){unknown++;continue;}
            observed++;
            if(cell.gap<=this.GAP)continue;
            maxGap=Math.max(maxGap,cell.gap);
            if(seen.has(cell.i))continue;
            seen.add(cell.i);
            const near=this.neighborhood(raster,cell);
            if(near.stackedNeighbors>0)neighbor++;
            conflict.push({
                x:+(raster.xminOBJ+cell.col*raster.stepOBJ).toFixed(3),
                z:+(raster.zmaxOBJ-cell.row*raster.stepOBJ).toFixed(3),
                yLow:+cell.min.toFixed(4),
                yHigh:+cell.max.toFixed(4),
                gap:+cell.gap.toFixed(4),
                repeats:cell.count,
                adjacentConflicts:near.stackedNeighbors,
                adjacentHighGap:near.highGapNeighbors
            });
        }
        const high=conflict.filter(c=>c.gap>this.HIGH_GAP);
        const sustained=high.filter(c=>
            c.adjacentHighGap>=2).length;
        // NOT geometry-certified; status is an explanation PRIORITY only.
        let kind='not-assessed';
        if(levelStatus==='multi-level-conflict'){
            if(sustained>=2)kind='sustained-separated-height-evidence';
            else if(conflict.length)kind='localized-or-ambiguous-overlap';
            else kind='shared-node-conflict-without-edge-overlap';
        }else if(levelStatus==='incomplete-observation'){
            kind='height-observation-incomplete';
        }else if(levelStatus==='ramp-review'){
            kind='slope-or-ramp-review';
        }else kind='single-level-evidence';
        return {
            kind,
            samples:samples.length,observed,unknown,
            overlapCells:conflict.length,
            adjacentOverlaps:neighbor,
            highGapCells:high.length,
            sustainedHighGapCells:sustained,
            maxHeightDifferenceOBJ:+maxGap.toFixed(4),
            examples:conflict
                .sort((a,b)=>b.gap-a.gap).slice(0,8),
            isBridgeCertified:false,
            canCrossAtGrade:false,
            canAutoJoinTraffic:false
        };
    }
    static audit(graph,raster,grade,source){
        if(graph.edges.length!==grade.edges.length||
           graph.nodes.length!==grade.nodes.length)
            throw Error('R27 needs matching source graph and grade audit');
        const ids=grade.edges
            .filter(e=>e.status==='multi-level-conflict').map(e=>e.id);
        const records=ids.map(id=>({
            id,from:graph.edges[id].from,to:graph.edges[id].to,
            ...this.inspectEdge(graph.edges[id],raster,
                source,grade.edges[id].status)
        }));
        const knownRouteIds={
            r23:[1822,1777,1762,1650,1557,1550],
            r25:[1520,1437,1017]
        };
        const routes=Object.fromEntries(Object.entries(knownRouteIds)
            .map(([key,ids])=>[key,ids.map(id=>({
                id,sourceGrade:grade.edges[id].status,
                ...this.inspectEdge(graph.edges[id],raster,
                    source,grade.edges[id].status)
            }))]));
        const count=key=>records.filter(r=>r.kind===key).length;
        const tally={
            sustainedSeparatedHeight:count('sustained-separated-height-evidence'),
            localizedOrAmbiguous:count('localized-or-ambiguous-overlap'),
            sharedNodeNoLocalOverlap:count('shared-node-conflict-without-edge-overlap')
        };
        if(Object.values(tally).reduce((a,b)=>a+b,0)!==records.length)
            throw Error('Unaccounted R27 conflict edges');
        return {
            format:'Driver2ChicagoGradeReviewR27',
            sourceSurveySHA256:source.hash||null,
            sourceGraphNodes:graph.nodes.length,
            sourceGraphEdges:graph.edges.length,
            sourceTiles:raster.tilesRead,
            sourceTriangles:raster.trianglesRead,
            inspectedConflictEdges:records.length,
            conflictBreakdown:tally,
            records,routes,
            previousGradeGuardCandidates:grade.gradeGuardCandidates.length,
            // These status labels are NOT authorization to connect roads.
            gradeSeparatedRoutesCanAutoConnect:false,
            certifiedOverpasses:0,certifiedAtGradeJunctions:0,
            trafficOrMissionsModified:false,
            warning:'Level separation is inferred from repeated overlapping pavement samples, NOT confirmed overpass / ramp classification. No 2-D crossing may auto-connect.'
        };
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoGradeReviewR27;
