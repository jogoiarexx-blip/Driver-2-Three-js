/**
 * Chicago R28 — 3D-aware source-graph routing SANDBOX (audit only).
 *
 * Only uses exact PS1 skeleton node IDs and original GLB height evidence.
 * Never infer junctions from projected X/Z intersections or pixel overlap.
 * The source graph includes sidewalks/yards: routes are candidates for
 * human review, NOT validated driving lanes, missions or live traffic.
 */
class DriverChicagoR28LayeredRoutes {
    static MAX_SLOPE=.085; // elevation / horizontal OBJ length; conservative REVIEW gate
    static MAX_ENDPOINT_DELTA=.16;
    static sourceDistance(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
    static build(graph,grade,paving,opts={}){
        if(!graph?.nodes||!graph?.edges||graph.nodes.length!==grade?.nodes?.length||
           graph.edges.length!==grade?.edges?.length||
           graph.edges.length!==paving?.length)
           throw Error('R28 exige graph, grade e pavimento da mesma revisão');
        const maxSlope=opts.maxSlope??this.MAX_SLOPE;
        if(!(maxSlope>0&&maxSlope<=.3))throw Error('Inclinação máxima inválida');
        const reject={paving:0,grade:0,node:0,endpoint:0,slope:0,degenerate:0};
        const edges=[],adj=new Map();
        const append=(node,item)=>{
            if(!adj.has(node))adj.set(node,[]);
            adj.get(node).push(item);
        };
        for(let id=0;id<graph.edges.length;id++){
            const e=graph.edges[id],g=grade.edges[id],p=paving[id];
            if(!['medium','strong'].includes(p?.confidence)){reject.paving++;continue;}
            if(g?.status!=='single-level-evidence'){reject.grade++;continue;}
            const from=grade.nodes[e.from],to=grade.nodes[e.to];
            if(from?.status!=='single-surface'||to?.status!=='single-surface'){
                reject.node++;continue;
            }
            const af=(from.yMin+from.yMax)/2,
                at=(to.yMin+to.yMax)/2,delta=at-af;
            if(!Number.isFinite(af)||!Number.isFinite(at)||
               Math.abs(delta)>this.MAX_ENDPOINT_DELTA){
                reject.endpoint++;continue;
            }
            const pts=e.pointsOBJ||[];
            let length=0;
            for(let j=1;j<pts.length;j++)
                length+=this.sourceDistance(pts[j-1],pts[j]);
            if(length<.05){reject.degenerate++;continue;}
            const slope=Math.abs(delta)/length;
            if(slope>maxSlope){reject.slope++;continue;}
            const item={
                id,from:e.from,to:e.to,
                lengthOBJ:+length.toFixed(4),
                startHeightOBJ:+af.toFixed(4),
                endHeightOBJ:+at.toFixed(4),
                gradeFraction:+slope.toFixed(4),
                pavingClass:p.confidence,
                certifiedRoad:false,gradeApprovedForTraffic:false
            };
            edges.push(item);
            // Bidirectional for structural reachability ONLY; do not
            // interpret as real-world traffic flow or one-way permissions.
            append(e.from,{to:e.to,edgeId:id,length:item.lengthOBJ});
            append(e.to,{to:e.from,edgeId:id,length:item.lengthOBJ});
        }
        const graphModel={
            format:'Driver2ChicagoLayeredReviewRoutesR28',
            sourceGraphNodes:graph.nodes.length,sourceGraphEdges:graph.edges.length,
            candidates:edges.length,rejected:reject,edges,
            routingNodes:adj.size,adjacency:adj,
            originalGradeAuthoritative:false,
            certifiedRoads:0,trafficEnabled:false,
            fakeTwoDimensionalJunctionsAdded:0,
            missionsMigrated:false
        };
        graphModel.components=this.components(graphModel);
        return graphModel;
    }
    static components(model){
        const seen=new Set(),result=[];
        for(const root of model.adjacency.keys()){
            if(seen.has(root))continue;
            const nodes=[root];seen.add(root);
            let length=0,edgeSet=new Set();
            for(let at=0;at<nodes.length;at++)
                for(const link of model.adjacency.get(nodes[at])||[]){
                    if(!edgeSet.has(link.edgeId)){
                        length+=link.length;edgeSet.add(link.edgeId);
                    }
                    if(!seen.has(link.to)){
                        seen.add(link.to);nodes.push(link.to);
                    }
                }
            result.push({
                nodes:nodes.length,edges:edgeSet.size,
                totalLengthOBJ:+length.toFixed(3),
                nodeIds:nodes.sort((a,b)=>a-b),
                edgeIds:[...edgeSet].sort((a,b)=>a-b)
            });
        }
        return result.sort((a,b)=>
            b.totalLengthOBJ-a.totalLengthOBJ||a.nodeIds[0]-b.nodeIds[0]);
    }
    static route(model,start,end){
        if(!Number.isInteger(start)||!Number.isInteger(end))
            throw Error('R28 roteia somente nós de origem PS1');
        if(!model.adjacency.has(start)||!model.adjacency.has(end))
            return null;
        if(start===end)return {nodeIds:[start],edgeIds:[],lengthOBJ:0};
        const dist=new Map([[start,0]]),prev=new Map(),
              visited=new Set();
        // Small audit graph; no external packages; deterministic tie-break.
        while(true){
            let current=null,best=Infinity;
            for(const [id,value] of dist)
                if(!visited.has(id)&&(value<best||
                   (value===best&&(current===null||id<current)))){
                    current=id;best=value;
                }
            if(current===null||current===end)break;
            visited.add(current);
            for(const link of model.adjacency.get(current)||[]){
                if(visited.has(link.to))continue;
                const candidate=best+link.length;
                const known=dist.get(link.to)??Infinity;
                if(candidate<known-1e-7){
                    dist.set(link.to,candidate);
                    prev.set(link.to,{from:current,edgeId:link.edgeId});
                }
            }
        }
        if(!prev.has(end))return null;
        const nodeIds=[end],edgeIds=[];
        let id=end;
        while(id!==start){
            const entry=prev.get(id);
            if(!entry)throw Error('R28 previous-chain invalid');
            edgeIds.push(entry.edgeId);id=entry.from;nodeIds.push(id);
        }
        nodeIds.reverse();edgeIds.reverse();
        return {nodeIds,edgeIds,lengthOBJ:+dist.get(end).toFixed(3)};
    }
    static examples(model,count=6){
        return model.components.slice(0,count).map(component=>{
            const start=component.nodeIds[0];
            // Select a far reached node, but never claim true road
            // longest path or cross at arbitrary coordinates.
            let best={nodeIds:[start],edgeIds:[],lengthOBJ:0};
            for(const end of component.nodeIds){
                const candidate=this.route(model,start,end);
                if(candidate?.lengthOBJ>best.lengthOBJ)best=candidate;
            }
            return {
                nodes:component.nodes,edges:component.edges,
                totalLengthOBJ:component.totalLengthOBJ,
                sampleRoute:best,
                certifiedForVehicle:false
            };
        });
    }
    static publication(model,examples=this.examples(model)){
        return {
            format:model.format,
            sourceGraphEdges:model.sourceGraphEdges,
            sourceGraphNodes:model.sourceGraphNodes,
            candidateEdgeCount:model.candidates,
            filteredEdgeCounts:model.rejected,
            routingNodes:model.routingNodes,
            components:examples,
            candidateEdgeIds:model.edges.map(e=>e.id),
            candidateEdges:model.edges,
            noInferredCrossings:true,
            autoTrafficRouting:false,
            certifiedRoads:0,missionsMigrated:false,
            notes:'Source pavement includes yards/sidewalks. True grade/traffic/lane direction is not certified. Routing is a segregated diagnostics graph only.'
        };
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoR28LayeredRoutes;
