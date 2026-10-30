/**
 * Chicago R29 — conservative missing-height recovery from original PS1 GLBs.
 *
 * The R26 raster has cells lacking a pavement triangle at their CENTER.
 * R29 examines the four immediately adjacent cells, but only recovers the
 * sample if their observed heights agree. No distant interpolation,
 * grade overpass connections, new intersections or traffic permissions.
 */
class DriverChicagoR29HeightRecovery {
    static LOCAL_SPREAD_OBJ=.045;
    static MAX_GRADIENT=.085;
    static MAX_DIRECT_GAP_OBJ=.12;
    static POINT_STEP_OBJ=.5;
    static sample(r,x,z){
        const c=Math.round((x-r.xminOBJ)/r.stepOBJ),
            row=Math.round((r.zmaxOBJ-z)/r.stepOBJ);
        if(!Number.isFinite(c)||!Number.isFinite(row)||
           c<0||row<0||c>=r.width||row>=r.height)
            return {kind:'outside',y:null};
        const at=(col,rz)=>{
            if(col<0||rz<0||col>=r.width||rz>=r.height)return null;
            const i=rz*r.width+col;
            if(!r.count[i])return null;
            const low=r.minY[i],high=r.maxY[i];
            if(!Number.isFinite(low)||!Number.isFinite(high))return null;
            return {low,high,y:(low+high)/2,spread:high-low};
        };
        const center=at(c,row);
        if(center){
            if(center.spread>this.MAX_DIRECT_GAP_OBJ)
                return {kind:'stacked',y:null,spread:center.spread};
            return {kind:'direct',y:center.y,spread:center.spread};
        }
        const neighbors=[[c+1,row],[c-1,row],[c,row+1],[c,row-1]]
            .map(([col,rz])=>at(col,rz)).filter(Boolean);
        if(!neighbors.length)return {kind:'missing',y:null};
        if(neighbors.some(n=>n.spread>this.MAX_DIRECT_GAP_OBJ))
            return {kind:'near-stacked',y:null};
        const lowest=Math.min(...neighbors.map(n=>n.low)),
              highest=Math.max(...neighbors.map(n=>n.high));
        if(highest-lowest>this.LOCAL_SPREAD_OBJ)
            return {kind:'near-ambiguous',y:null,
                spread:highest-lowest};
        return {kind:'recovered-neighbor',
            y:neighbors.reduce((sum,n)=>sum+n.y,0)/neighbors.length,
            neighbors:neighbors.length,spread:highest-lowest};
    }
    static probeEdge(edge,r,pointsGenerator){
        const points=pointsGenerator(edge.pointsOBJ);
        const samples=points.map(p=>this.sample(r,p[0],p[1]));
        const counts={direct:0,'recovered-neighbor':0,missing:0,
            stacked:0,'near-stacked':0,'near-ambiguous':0,outside:0};
        for(const s of samples)counts[s.kind]++;
        let maxSlope=0,maximumJump=0;
        for(let i=1;i<samples.length;i++){
            const left=samples[i-1],right=samples[i];
            if(left.y===null||right.y===null)continue;
            const length=Math.hypot(points[i][0]-points[i-1][0],
                points[i][1]-points[i-1][1]);
            if(length<1e-6)continue;
            const delta=Math.abs(right.y-left.y);
            maxSlope=Math.max(maxSlope,delta/length);
            maximumJump=Math.max(maximumJump,delta);
        }
        const n=points.length;
        const coverage=(counts.direct+counts['recovered-neighbor'])/n;
        return {
            counts,probes:n,coverage:+coverage.toFixed(4),
            recovered:counts['recovered-neighbor'],
            direct:counts.direct,
            maxSlope:+maxSlope.toFixed(4),
            maximumJumpOBJ:+maximumJump.toFixed(4),
            missingOrConflicted:n-counts.direct-counts['recovered-neighbor']
        };
    }
    static classify(graph,grade,paving,raster,pointsGenerator,baselineIds){
        const original=new Set(baselineIds);
        const additions=[],rejected={
            sourcePavement:0,originalLevelConflict:0,
            directBaseline:0,missingOrAmbiguous:0,
            gradeSlope:0,missingNode:0,nearbyLimit:0,endpoint:0
        };
        const reviewed=[];
        const MAX_NEAR_FRACTION=.60;
        for(let id=0;id<graph.edges.length;id++){
            if(original.has(id)){rejected.directBaseline++;continue;}
            if(!['medium','strong'].includes(paving[id]?.confidence)){
                rejected.sourcePavement++;continue;
            }
            const g=grade.edges[id];
            if(g.status==='multi-level-conflict'){
                rejected.originalLevelConflict++;continue;
            }
            if(g.status!=='incomplete-observation'){
                rejected.originalLevelConflict++;continue;
            }
            const edge=graph.edges[id],from=this.sample(raster,
                graph.nodes[edge.from].pointOBJ[0],
                graph.nodes[edge.from].pointOBJ[1]),
                to=this.sample(raster,
                graph.nodes[edge.to].pointOBJ[0],
                graph.nodes[edge.to].pointOBJ[1]);
            if(from.y===null||to.y===null){
                rejected.missingNode++;
                reviewed.push({id,status:'node-unresolved',from:from.kind,to:to.kind});
                continue;
            }
            const diagnostics=this.probeEdge(edge,raster,pointsGenerator);
            if(diagnostics.missingOrConflicted){
                rejected.missingOrAmbiguous++;
                reviewed.push({id,status:'height-gaps',...diagnostics});
                continue;
            }
            if(diagnostics.recovered/diagnostics.probes>MAX_NEAR_FRACTION){
                rejected.nearbyLimit++;
                reviewed.push({id,status:'insufficient-direct-support',...diagnostics});
                continue;
            }
            if(Math.abs(to.y-from.y)>.16){
                rejected.endpoint++;
                reviewed.push({id,status:'endpoint-height-gap',...diagnostics});
                continue;
            }
            if(diagnostics.maxSlope>this.MAX_GRADIENT){
                rejected.gradeSlope++;
                reviewed.push({id,status:'unsafe-height-gradient',...diagnostics});
                continue;
            }
            // R28 also checks endpoint-to-endpoint grade / total length.
            let len=0;
            for(let j=1;j<edge.pointsOBJ.length;j++)
                len+=Math.hypot(edge.pointsOBJ[j][0]-edge.pointsOBJ[j-1][0],
                    edge.pointsOBJ[j][1]-edge.pointsOBJ[j-1][1]);
            if(!len||Math.abs(to.y-from.y)/len>this.MAX_GRADIENT){
                rejected.gradeSlope++;continue;
            }
            additions.push({id,from:edge.from,to:edge.to,
                lengthOBJ:+len.toFixed(4),
                fromHeightOBJ:+from.y.toFixed(4),
                toHeightOBJ:+to.y.toFixed(4),
                directSamples:diagnostics.direct,
                locallyRecoveredSamples:diagnostics.recovered,
                maxSlope:diagnostics.maxSlope,
                gradeStatusBefore:g.status,
                reason:'adjacent-source-triangle-height-agreement',
                certifiedRoad:false,verifiedDriveable:false});
        }
        return {
            format:'Driver2ChicagoLocalHeightRecoveryR29',
            baselineEdges:original.size,
            recoveredEdges:additions.length,
            additionalEdgeIds:additions.map(x=>x.id),
            sourceGraphEdges:graph.edges.length,
            sourceGraphNodes:graph.nodes.length,
            thresholdNeighborSpreadOBJ:this.LOCAL_SPREAD_OBJ,
            maxRecoveredFraction:MAX_NEAR_FRACTION,
            rejections:rejected,additions,
            inspectedNonbaseline:reviewed,
            newTrafficLinks:0,newInferredNodes:0,
            bridgesCertified:0,missionRoutesModified:false,
            reviewOnly:true
        };
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoR29HeightRecovery;
