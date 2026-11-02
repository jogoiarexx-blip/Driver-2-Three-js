/**
 * R72 — primeiro corredor contínuo PS1 para revisão em detalhe.
 * Fonte: aresta 3445 R28, nós originais 2560 -> 2805.
 * NÃO muda pisos, IA, colisores, missões nem salva uma colocação adaptada.
 */
class DriverChicagoCorridorR72 {
    static EDGE_ID=3445;
    static fitR15(point,reference){
        const src=reference?.pointsOBJ||[],first=src[0],last=src[src.length-1];
        if(!first||!last)throw Error('Missing calibrated R15 reference');
        const dx=last[0]-first[0],dz=last[1]-first[1],den=dx*dx+dz*dz;
        if(!Number.isFinite(den)||den<.001)throw Error('Degenerate R15 reference');
        const a=(60*dx-80*dz)/den,b=(-80*dx-60*dz)/den;
        const x=point[0]-first[0],z=point[1]-first[1];
        return {x:-320+a*x-b*z,z:-80+b*x+a*z};
    }
    static intersectsTile(points,bounds){
        const min=bounds?.min,max=bounds?.max;
        if(!min||!max||![...min,...max].every(Number.isFinite))return false;
        // Liang-Barsky; an edge may cross a tile despite having no vertex
        // inside it. Never infer 3D collision from this X/Z-only check.
        for(let i=1;i<points.length;i++){
            const a=points[i-1],b=points[i];
            if(!a||!b||![...a,...b].every(Number.isFinite))continue;
            const dx=b[0]-a[0],dz=b[1]-a[1];
            const p=[-dx,dx,-dz,dz];
            const q=[a[0]-min[0],max[0]-a[0],a[1]-min[2],max[2]-a[1]];
            let lo=0,hi=1,possible=true;
            for(let j=0;j<4;j++){
                if(Math.abs(p[j])<1e-9){
                    if(q[j]<0){possible=false;break}
                }else{
                    const t=q[j]/p[j];
                    if(p[j]<0)lo=Math.max(lo,t);
                    else hi=Math.min(hi,t);
                    if(lo>hi){possible=false;break}
                }
            }
            if(possible)return true;
        }
        return false;
    }
    static routeLength(points){
        return points.slice(1).reduce((total,p,i)=>
            total+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
    }
    static build(graph,r28,r29,manifest,r15){
        if(!graph?.edges||!graph.nodes||
           graph.edges.length!==4279||graph.nodes.length!==3230)
            throw Error('Unexpected PS1 street network');
        if(graph.sourceSHA256!==r28?.sourceSurveySHA256||
           graph.sourceSHA256!==r29?.sourceSHA256||
           graph.sourceSHA256!==r15?.sourceSHA256)
            throw Error('Mixed or stale source audit datasets');
        const id=this.EDGE_ID,edge=graph.edges[id];
        if(!r28.candidateEdgeIds?.includes(id)||
           !r29.combinedCandidateIds?.includes(id)||
           r29.recoveredEdges?.some(e=>e.id===id))
            throw Error('R72 selected edge lacks direct R28 grade evidence');
        const component=r28.components?.find(c=>
            c.sampleRoute?.edgeIds?.includes(id));
        if(!component||component.edges!==1||
           component.sampleRoute.edgeIds.length!==1)
            throw Error('R72 candidate changed component identity');
        const points=edge?.pointsOBJ||[];
        if(points.length<2||!points.every(p=>
            p.length===2&&p.every(Number.isFinite)))
            throw Error('Invalid corridor polyline');
        const originalLength=this.routeLength(points);
        const fitted=points.map(p=>this.fitR15(p,r15));
        const minX=Math.min(...fitted.map(p=>p.x)),
            maxX=Math.max(...fitted.map(p=>p.x)),
            minZ=Math.min(...fitted.map(p=>p.z)),
            maxZ=Math.max(...fitted.map(p=>p.z));
        const tiles=(manifest?.tiles||[]).filter(tile=>
            this.intersectsTile(points,tile.bounds)).map(tile=>({
                id:tile.id,url:'chicago/'+tile.url,
                bounds:tile.bounds,
                roadCertified:false
            })).sort((a,b)=>a.id.localeCompare(b.id));
        if(!tiles.length||manifest.tiles.length!==54)
            throw Error('Original GLB source sectors not found');
        return {
            format:'DriverChicagoOriginalCorridorReviewR72',
            sourceSHA256:graph.sourceSHA256,
            sourceTriangles:manifest.triangles,
            candidateEdgeId:id,nodeIds:[edge.from,edge.to],
            sourcePointsOBJ:points,
            lengthPolylineOBJ:+originalLength.toFixed(3),
            sourceGraphLengthOBJ:edge.lengthOBJ,
            sourcePixels:edge.sourcePixels,
            selectedForReview:'R28 directly observed grade; R29 height interpolation not required',
            r28Evidence:true,r29RecoveredHeight:false,
            adjacentR28EdgesInComponent:component.edges,
            tiles,tilesCount:tiles.length,
            projectedUndercoverR15:{
                method:'R15 similarity fit; source position NOT certified',
                worldPoints:fitted.map(p=>({
                    x:+p.x.toFixed(4),z:+p.z.toFixed(4)
                })),
                bounds:{minX:+minX.toFixed(4),maxX:+maxX.toFixed(4),
                    minZ:+minZ.toFixed(4),maxZ:+maxZ.toFixed(4)},
                withinLegacyGrid320:minX>=-320&&maxX<=320&&
                    minZ>=-320&&maxZ<=320,
                calibratedOriginalPlacement:false,
                roadCollisionSurveyed:false
            },
            originalRoadCertified:false,
            gameTrafficEnabled:false,collisionCreated:false,
            missionsMigrated:false,
            nextGate:'Inspect material coverage, original lane width and height triangulation; calibrate placement and recheck Undercover collisions before any drivable integration'
        };
    }
    static materials(report,survey,masks,roadEvidence){
        if(report?.candidateEdgeId!==this.EDGE_ID||
            report.sourceSHA256!==survey?.sourceSHA256&&
            survey?.sourceSHA256!==undefined)
            throw Error('Corridor material survey mismatch');
        if(!roadEvidence?.profile)throw Error('Material profile unavailable');
        const edge={pointsOBJ:report.sourcePointsOBJ};
        const material=roadEvidence.profile(edge,survey,masks);
        return {
            ...material,
            actualLaneWidthCertified:false,
            gradeAndMaterialTogetherCertified:false,
            noGameplayChanges:true
        };
    }
    static overlay(THREE,report){
        if(!THREE?.Group||report?.candidateEdgeId!==this.EDGE_ID)
            throw Error('Cannot create corridor overlay');
        const group=new THREE.Group();
        group.name='chicago-r72-original-source-corridor';
        group.userData={visualOnly:true,roadCertified:false,
            trafficEnabled:false,collidersCreated:0,
            sourceEdgeId:report.candidateEdgeId};
        const line=[],nodes=[];
        for(let i=1;i<report.sourcePointsOBJ.length;i++)
            for(const p of [report.sourcePointsOBJ[i-1],report.sourcePointsOBJ[i]])
                line.push(p[0],.52,p[1]);
        for(const p of [report.sourcePointsOBJ[0],report.sourcePointsOBJ.at(-1)])
            nodes.push(p[0],.66,p[1]);
        const segments=new THREE.BufferGeometry();
        segments.setAttribute('position',
            new THREE.Float32BufferAttribute(line,3));
        const road=new THREE.LineSegments(segments,new THREE.LineBasicMaterial({
            color:0xffc94d,depthTest:false
        }));
        road.name='r72-edge-3445-source-trace';road.renderOrder=22;
        group.add(road);
        const pointsGeo=new THREE.BufferGeometry();
        pointsGeo.setAttribute('position',
            new THREE.Float32BufferAttribute(nodes,3));
        const endpoints=new THREE.Points(pointsGeo,new THREE.PointsMaterial({
            color:0xfff4d0,size:2.8,depthTest:false
        }));
        endpoints.name='r72-source-endpoints';endpoints.renderOrder=23;
        group.add(endpoints);
        // Outline tiles that actually intersect the centerline. These are
        // provenance bounds, NOT inferred lane/collision boundaries.
        const bounds=[];
        for(const tile of report.tiles){
            const b=tile.bounds,min=b.min,max=b.max,y=.46;
            const corners=[
                [min[0],min[2]],[max[0],min[2]],
                [max[0],max[2]],[min[0],max[2]],[min[0],min[2]]
            ];
            for(let i=1;i<corners.length;i++)
                for(const p of [corners[i-1],corners[i]])
                    bounds.push(p[0],y,p[1]);
        }
        const tilesGeo=new THREE.BufferGeometry();
        tilesGeo.setAttribute('position',
            new THREE.Float32BufferAttribute(bounds,3));
        const tileLines=new THREE.LineSegments(tilesGeo,
            new THREE.LineBasicMaterial({
                color:0x67ccff,depthTest:false,transparent:true,opacity:.92
            }));
        tileLines.name='r72-source-tile-bounds';tileLines.renderOrder=21;
        group.add(tileLines);
        return group;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoCorridorR72;
