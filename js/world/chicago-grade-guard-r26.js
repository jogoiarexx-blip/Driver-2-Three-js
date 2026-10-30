/**
 * Chicago R26 — grade-aware evidence from actual PS1 GLB triangle heights.
 * A projected crossing is NOT a road junction unless its 3-D levels agree.
 * Never certifies source lanes, crossing directions, sidewalks or missions.
 *
 * Uses the raster grid and the ungraded 4279-edge surface skeleton as input.
 * This module is deliberately pure: no CityBuilder/traffic modifications.
 */
class DriverChicagoGradeGuardR26 {
    static LEVEL_GAP_OBJ=.12;
    static MAX_RAMP_STEP_OBJ=.16;
    static sample(raster,x,z){
        const col=Math.round((x-raster.xminOBJ)/raster.stepOBJ);
        const row=Math.round((raster.zmaxOBJ-z)/raster.stepOBJ);
        if(!Number.isFinite(col)||!Number.isFinite(row)||col<0||row<0||
           col>=raster.width||row>=raster.height)
            return {status:'outside',yMin:null,yMax:null,distanceCells:null};
        const candidates=[[0,0],[1,0],[-1,0],[0,1],[0,-1]];
        for(const [dx,dz] of candidates){
            const cx=col+dx,rz=row+dz;
            if(cx<0||rz<0||cx>=raster.width||rz>=raster.height)continue;
            const i=rz*raster.width+cx;
            if(!raster.count[i])continue;
            const lo=raster.minY[i],hi=raster.maxY[i];
            if(!Number.isFinite(lo)||!Number.isFinite(hi))continue;
            return {
                status:hi-lo>this.LEVEL_GAP_OBJ?'stacked':
                    dx||dz?'nearby':'single-surface',
                yMin:+lo.toFixed(4),yMax:+hi.toFixed(4),
                distanceCells:Math.abs(dx)+Math.abs(dz)
            };
        }
        return {status:'unknown',yMin:null,yMax:null,distanceCells:null};
    }
    static edgeProbes(points){
        const out=[];
        if(!points||points.length<2)return out;
        for(let i=1;i<points.length;i++){
            const a=points[i-1],b=points[i];
            if(i===1)out.push(a);
            const dist=Math.hypot(b[0]-a[0],b[1]-a[1]);
            const steps=Math.max(1,Math.ceil(dist/.5));
            for(let j=1;j<=steps;j++){
                const t=j/steps;
                out.push([a[0]+(b[0]-a[0])*t,
                    a[1]+(b[1]-a[1])*t]);
            }
        }
        return out;
    }
    static inspectEdge(edge,raster,nodes){
        const samples=this.edgeProbes(edge.pointsOBJ)
            .map(p=>this.sample(raster,p[0],p[1]));
        const stacked=samples.filter(p=>p.status==='stacked').length;
        const unknown=samples.filter(p=>p.status==='unknown'||p.status==='outside').length;
        const nearby=samples.filter(p=>p.status==='nearby').length;
        const solid=samples.filter(p=>p.status==='single-surface').length;
        const lo=samples.filter(s=>s.yMin!==null).map(p=>p.yMin);
        const hi=samples.filter(s=>s.yMax!==null).map(p=>p.yMax);
        const from=nodes?.[edge.from],to=nodes?.[edge.to];
        const nodeConflict=from?.status==='stacked'||to?.status==='stacked';
        const floorGap=lo.length?Math.max(...hi)-Math.min(...lo):null;
        // A rising road is possible, but an elevation difference must
        // be investigated against the actual GLB before routing cars.
        const gradeChange=from?.yMin!==null&&to?.yMin!==null?
            Math.abs((from.yMin+from.yMax)/2-
                     (to.yMin+to.yMax)/2):null;
        let status='unknown';
        if(stacked||nodeConflict)status='multi-level-conflict';
        else if(unknown||nearby||!solid)status='incomplete-observation';
        else if(floorGap>this.MAX_RAMP_STEP_OBJ ||
                gradeChange>this.MAX_RAMP_STEP_OBJ)
            status='ramp-review';
        else status='single-level-evidence';
        return {status,
            probeCount:samples.length,
            observed:solid+nearby,
            nearby,unknown,stacked,
            floorGapOBJ:floorGap===null?null:+floorGap.toFixed(4),
            gradeChangeOBJ:gradeChange===null?null:+gradeChange.toFixed(4),
            junctionGradeCertified:false,
            streetCertified:false};
    }
    static audit(graph,raster,pavingRecords=null){
        if(!graph?.nodes||!graph?.edges)
            throw Error('Grafo de nós e arestas obrigatório');
        const size=raster?.width*raster?.height;
        if(!Number.isInteger(size)||size<=0||
           raster.minY.length!==size||
           raster.maxY.length!==size||
           raster.count.length!==size)
            throw Error('Raster de níveis incompleto');
        const nodes=graph.nodes.map((n,id)=>({
            id,...this.sample(raster,n.pointOBJ[0],n.pointOBJ[1])
        }));
        const edges=graph.edges.map((e,id)=>({
            id,from:e.from,to:e.to,...this.inspectEdge(e,raster,nodes)
        }));
        const countBy=(list,key)=>list.reduce((sum,x)=>{
            sum[x[key]]=(sum[x[key]]||0)+1;return sum;
        },{});
        const excluded=new Set(nodes.filter(n=>n.status==='stacked').map(n=>n.id));
        const candidates=edges.filter(e=>e.status==='single-level-evidence' &&
            nodes[e.from].status==='single-surface' &&
            nodes[e.to].status==='single-surface' &&
            (!pavingRecords||['medium','strong'].includes(
                pavingRecords[e.id]?.confidence)));
        return {
            format:'Driver2ChicagoPS1GradeEvidenceR26',
            trianglesRead:raster.trianglesRead,
            tilesRead:raster.tilesRead,
            sourceOriginalOBJ:true,
            graphEdges:edges.length,graphNodes:nodes.length,
            nodeCounts:countBy(nodes,'status'),
            edgeCounts:countBy(edges,'status'),
            stackedNodeIds:[...excluded],
            gradeGuardCandidates:candidates.map(x=>x.id),
            gradeGuardComponents:this.components(candidates),
            nodes,edges,
            trafficRewired:false,missionsMigrated:false,
            sourceRoadCertified:false,gradedIntersectionsCertified:false,
            warning:'Single-level evidence is not certified road geometry. Near samples, ramps, overpasses, missing source materials and sidewalks require independent verification.'
        };
    }
    static components(candidates){
        const adjacent=new Map(),visited=new Set(),groups=[];
        for(const e of candidates)for(const n of [e.from,e.to]){
            if(!adjacent.has(n))adjacent.set(n,[]);
            adjacent.get(n).push(e.id);
        }
        const byId=new Map(candidates.map(e=>[e.id,e]));
        for(const initial of candidates){
            if(visited.has(initial.id))continue;
            const queue=[initial.id],ids=[];
            visited.add(initial.id);
            while(queue.length){
                const id=queue.pop(),e=byId.get(id);
                ids.push(id);
                for(const n of [e.from,e.to])for(const k of adjacent.get(n)||[])
                    if(!visited.has(k)){visited.add(k);queue.push(k);}
            }
            groups.push({edges:ids.length,firstEdge:Math.min(...ids),
                sampleEdgeIds:ids.slice(0,30)});
        }
        return groups.sort((a,b)=>b.edges-a.edges);
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoGradeGuardR26;
