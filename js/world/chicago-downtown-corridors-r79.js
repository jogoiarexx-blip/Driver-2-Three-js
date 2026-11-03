/**
 * Chicago R79 — two ACTUAL drivable Downtown service corridors crossing
 * four R78 street-frontage blocks. A gradual topology migration, NOT a claim
 * that the PS1 ROM puts these roads at these coordinates.
 *
 * Source of lots: R78 (real existing CityBuilder footprints).
 * Road centerline, 5.6m clear width, graded 3D surface, R49 route edges
 * and lot-side polygons all derive from the SAME polyline.
 *
 * 80m compatibility streets are never removed without proven replacement.
 */
class DriverChicagoDowntownCorridorsR79 {
    static VERSION='r79-downtown-connected-corridors';
    static WIDTH=5.6;
    static CORRIDORS=[
        {id:'loop-west-cross-street',district:'downtown-west',
         points:[[-160,-40],[-140,-40.45],[-120,-40],[-100,-39.55],
            [-80,-40],[-60,-39.55],[-40,-40],[-20,-40.45],[0,-40]],
         buildingCells:[[-120,-40],[-40,-40]]},
        {id:'loop-south-cross-street',district:'downtown-south',
         points:[[-80,-200],[-60,-200.45],[-40,-200],[-20,-199.55],
            [0,-200],[20,-200.45],[40,-200],[60,-199.55],[80,-200]],
         buildingCells:[[-40,-200],[40,-200]]}
    ];
    static classify(){return {
        roadMode:'adapted-downtown-service-streets',
        originalSourceCoordinatesCertified:false,
        streetWidthPS1Certified:false,missionCoordinatesMigrated:false,
        originalMapReplacementComplete:false};
    }
    static floor(city,x,z) {
        return typeof city.getGroundHeightAt==='function'?
            city.getGroundHeightAt(x,z,null,true):0;
    }
    static segmentAudit(city,a,b,width=this.WIDTH) {
        if(city?.preset?.id!=='chicago'||![a?.x,a?.z,b?.x,b?.z,width]
            .every(Number.isFinite)||width<3||width>9)
            return {valid:false,reason:'invalid-segment'};
        const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
        if(len<2||len>38)
            return {valid:false,reason:'unsupported-step-length'};
        const nx=-dz/len,nz=dx/len,steps=Math.ceil(len/1.25);
        let tested=0;
        for(const offset of [0,-width/2+.22,width/2-.22]){
            let lastY=null;
            for(let i=0;i<=steps;i++){
                const t=i/steps,x=a.x+dx*t+nx*offset,
                    z=a.z+dz*t+nz*offset;
                if(city.isWaterAt?.(x,z))
                    return {valid:false,reason:'water',tested};
                if(city.isPointBlocked?.(x,z,.26,0))
                    return {valid:false,reason:'collision',tested};
                const y=this.floor(city,x,z);
                if(!Number.isFinite(y))
                    return {valid:false,reason:'nonfinite-floor',tested};
                if(lastY!==null&&Math.abs(y-lastY)>.35+len/steps*.4)
                    return {valid:false,reason:'unsafe-grade',tested};
                lastY=y;tested++;
            }
        }
        return {valid:true,reason:null,tested,length:len};
    }
    static makePlan(city) {
        if(city?.preset?.id!=='chicago')return null;
        const corridors=[],links=[],rejected=[];
        for(const spec of this.CORRIDORS){
            const points=spec.points.map(p=>({x:p[0],z:p[1]}));
            const segments=[];
            for(let i=1;i<points.length;i++){
                const from=points[i-1],to=points[i];
                const audit=this.segmentAudit(city,from,to);
                if(!audit.valid)
                    rejected.push({corridor:spec.id,index:i-1,reason:audit.reason});
                segments.push({id:spec.id+'-'+(i-1),corridor:spec.id,
                    from,to,width:this.WIDTH,...audit,
                    source:'R79-adapted-to-existing-road-grid',
                    originalPS1SegmentCertified:false});
            }
            // A gap blocks the ENTIRE source-to-grid corridor. Don't draw
            // orphan pavement or inject a fake route into R49.
            const contiguous=segments.every(s=>s.valid);
            const c={id:spec.id,district:spec.district,
                sourcePoints:points,roadWidth:this.WIDTH,segments,
                contiguous,buildingCells:spec.buildingCells,
                originalPS1PlacementCertified:false};
            corridors.push(c);
            if(contiguous)links.push(...segments.map(s=>({
                id:s.id,corridor:s.corridor,from:s.from,to:s.to,
                width:s.width,drivable:true,
                source:'R79-graded-connected-pavement'})));
        }
        return {version:this.VERSION,...this.classify(),
            corridors,links,rejected,
            connectedCorridors:corridors.filter(c=>c.contiguous).length,
            connectedSegments:links.length,
            polygonCells:[],matchedBuildings:0,
            mesh:null,markings:null,buildSequence:city.buildSequence||0};
    }
    // The frontages from R78 are inside TWO polygons per active corridor
    // cell, determined by a continuous segment of the real centerline.
    // These polygons do not themselves create walls/colliders or roads.
    static polygonFor(cell,side,points,width=this.WIDTH) {
        const [cx,cz]=cell,start=cx-21.2,end=cx+21.2;
        const zAt=x=>{
            for(let i=1;i<points.length;i++){
                const a=points[i-1],b=points[i];
                if(x>=Math.min(a.x,b.x)-1e-7&&
                   x<=Math.max(a.x,b.x)+1e-7)
                    return a.z+(b.z-a.z)*(x-a.x)/(b.x-a.x);
            }
            return null;
        };
        const z0=zAt(start),z1=zAt(end);
        if(!Number.isFinite(z0)||!Number.isFinite(z1))return null;
        const inset=width/2+1.2,outer=21.2;
        const verts=side===1?
            [[start,z0+inset],[end,z1+inset],
             [end,cz+outer],[start,cz+outer]]:
            [[start,cz-outer],[end,cz-outer],
             [end,z1-inset],[start,z0-inset]];
        if(verts.some(v=>!v.every(Number.isFinite)))return null;
        const signedArea=verts.reduce((sum,p,i)=>{
            const q=verts[(i+1)%verts.length];
            return sum+p[0]*q[1]-q[0]*p[1];
        },0)/2;
        return {id:'r79-'+cx+'-'+cz+'-'+side,
            blockX:cx,blockZ:cz,side,vertices:verts,
            area:Math.abs(signedArea),roadCenterZ:[z0,z1],
            openToCorridor:true,roadWidth:width,
            sourceCertified:false};
    }
    static inPolygon(p,verts){
        // Robust convex quadrilateral test for building corners.
        let sign=0;
        for(let i=0;i<verts.length;i++){
            const a=verts[i],b=verts[(i+1)%verts.length],
                cross=(b[0]-a[0])*(p[1]-a[1])-
                      (b[1]-a[1])*(p[0]-a[0]);
            if(Math.abs(cross)<1e-6)continue;
            const s=Math.sign(cross);
            if(sign&&sign!==s)return false;
            sign=s;
        }
        return true;
    }
    static linkParcels(city,report){
        const buildings=city?.districtBuildings||[];
        for(const corridor of report.corridors){
            if(!corridor.contiguous)continue;
            const points=corridor.sourcePoints;
            for(const cell of corridor.buildingCells){
                const local=buildings.filter(b=>
                    b.pilotR78&&b.blockX===cell[0]&&b.blockZ===cell[1]);
                if(local.length!==10)continue;
                const polygons=[-1,1].map(side=>
                    this.polygonFor(cell,side,points,corridor.roadWidth));
                if(polygons.some(x=>!x))continue;
                let ok=true;
                for(const b of local){
                    const poly=polygons.find(p=>p.side===b.frontageSide);
                    const corners=[
                        [b.x-b.width/2,b.z-b.depth/2],
                        [b.x+b.width/2,b.z-b.depth/2],
                        [b.x+b.width/2,b.z+b.depth/2],
                        [b.x-b.width/2,b.z+b.depth/2]
                    ];
                    if(!poly||!corners.every(p=>this.inPolygon(p,poly.vertices))){
                        ok=false;break;
                    }
                }
                if(!ok)continue;
                // Migrate only metadata. Old visual and AABB footprints
                // remain identical; polygons will own the rebuilding later.
                for(const b of local){
                    b.r79ParcelPolygon=polygons.find(p=>p.side===b.frontageSide).id;
                    b.streetFrontageR79=corridor.id;
                    report.matchedBuildings++;
                }
                report.polygonCells.push(...polygons);
            }
        }
        return report;
    }
    static surface(city,report) {
        if(typeof THREE==='undefined'||!city.cityGroup||
            !report.links.length)return;
        const vertices=[],paint=[];
        for(const road of report.links){
            const a=road.from,b=road.to,dx=b.x-a.x,dz=b.z-a.z,
                length=Math.hypot(dx,dz),nx=-dz/length,
                nz=dx/length,steps=Math.ceil(length/1.25),
                half=road.width/2;
            const point=(t,side,offset=.031)=>{
                const x=a.x+dx*t+nx*side*half,
                    z=a.z+dz*t+nz*side*half;
                return [x,this.floor(city,x,z)+offset,z];
            };
            for(let i=0;i<steps;i++){
                const t=i/steps,u=(i+1)/steps,
                    l0=point(t,-1),r0=point(t,1),
                    l1=point(u,-1),r1=point(u,1);
                vertices.push(...l0,...l1,...r0,...r0,...l1,...r1);
            }
            // Short broken center marks follow the same road centerline.
            // Both marks stop before the connector endpoints.
            if(length>12){
                const j=Math.ceil(length/9);
                for(let k=0;k<j;k++){
                    const t=(k+.25)/j,u=Math.min(1,(k+.58)/j);
                    const x0=a.x+dx*t,z0=a.z+dz*t,
                        x1=a.x+dx*u,z1=a.z+dz*u,
                        sx=nx*.10,sz=nz*.10;
                    const pp=(x,z)=>[x,this.floor(city,x,z)+.058,z];
                    paint.push(...pp(x0+sx,z0+sz),...pp(x1+sx,z1+sz),
                        ...pp(x0-sx,z0-sz),...pp(x0-sx,z0-sz),
                        ...pp(x1+sx,z1+sz),...pp(x1-sx,z1-sz));
                }
            }
        }
        const meshFor=(verts,name,color,offset)=>{
            const geo=new THREE.BufferGeometry();
            geo.setAttribute('position',
                new THREE.Float32BufferAttribute(verts,3));
            geo.computeVertexNormals();
            const mat=new THREE.MeshLambertMaterial({
                color,side:THREE.DoubleSide,
                polygonOffset:true,polygonOffsetFactor:offset});
            const mesh=new THREE.Mesh(geo,mat);
            mesh.name=name;mesh.receiveShadow=true;
            mesh.userData.r79VerifiedSurface=true;
            mesh.userData.ps1PositionCertified=false;
            city.cityGroup.add(mesh);
            return mesh;
        };
        report.mesh=meshFor(vertices,'chicago-r79-downtown-live-pavement',
            0x464b4e,-2);
        if(paint.length)report.markings=meshFor(paint,
            'chicago-r79-downtown-lane-dashes',0xb4a982,-3);
    }
    static build(city) {
        if(city?.preset?.id!=='chicago'||!city.cityGroup)return null;
        if(city.chicagoDowntownR79?.buildSequence===(city.buildSequence||0))
            return city.chicagoDowntownR79;
        const report=this.makePlan(city);
        this.linkParcels(city,report);
        this.surface(city,report);
        city.chicagoDowntownR79=report;
        if(city.chicagoCityPlan){
            city.chicagoCityPlan.r79Corridors=report.connectedCorridors;
            city.chicagoCityPlan.r79RoadSegments=report.connectedSegments;
            city.chicagoCityPlan.r79PolygonSides=report.polygonCells.length;
        }
        return report;
    }
}
if(typeof window!=='undefined')
    window.DriverChicagoDowntownCorridorsR79=DriverChicagoDowntownCorridorsR79;
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoDowntownCorridorsR79;
