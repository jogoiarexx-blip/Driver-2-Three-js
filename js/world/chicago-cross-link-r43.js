/** R43: a source-derived cross street linking R42 to R39 at two *real*
 * constructed asphalt segments. Source road classification/grade remains
 * uncertified and this does not reassign mission locations.
 */
const DriverChicagoR43Base=typeof module!=='undefined'&&module.exports?
    require('./chicago-ps1-reference-curve.js'):DriverChicagoPS1ReferenceCurve;
class DriverChicagoCrossLinkR43 extends DriverChicagoR43Base {
    static get source(){
        return typeof DriverChicagoSourceCrossLinkR43!=='undefined'?
            DriverChicagoSourceCrossLinkR43:this.sourceDataR43;
    }
    static fitPoint(point){return DriverChicagoR43Base.fitPoint(point);}
    static get placement(){
        return {key:'chicagoReferenceCrossLinkR43',x:115,z:804,
            foundation:false,district:'wrigleyville',
            name:'chicago-r43-cross-link-adapted-road'};
    }
    static nearestExistingRoadPoint(sourcePoint,road){
        if(!road||road.length<2)throw Error('R43 exige as geometrias da R42 e R39');
        let best=null;
        for(let i=1;i<road.length;i++){
            const a=road[i-1],b=road[i],dx=b.x-a.x,dz=b.z-a.z;
            const den=dx*dx+dz*dz;if(den<1e-8)continue;
            const t=Math.max(0,Math.min(1,
                ((sourcePoint.x-a.x)*dx+(sourcePoint.z-a.z)*dz)/den));
            const point={x:a.x+t*dx,z:a.z+t*dz};
            const distance=Math.hypot(point.x-sourcePoint.x,point.z-sourcePoint.z);
            if(!best||distance<best.distance)best={point,distance,index:i-1,t};
        }
        return best;
    }
    static plan(){
        const path=super.plan();
        const Network=typeof module!=='undefined'&&module.exports?
            require('./chicago-ps1-street-network-r22.js'):
            DriverChicagoPS1StreetNetwork;
        const ParentStart=typeof DriverChicagoSouthStemR42!=='undefined'?
            DriverChicagoSouthStemR42:this.parentR42;
        const ParentEnd=typeof DriverChicagoSouthEastR39!=='undefined'?
            DriverChicagoSouthEastR39:this.parentR39;
        if(!ParentStart?.plan||!ParentEnd?.plan)
            throw Error('R43 requer pavimento existente R42 e R39');
        const original=this.source.pointsOBJ.map(p=>this.fitPoint(p));
        const first=this.nearestExistingRoadPoint(original[0],ParentStart.plan().points);
        const last=this.nearestExistingRoadPoint(original.at(-1),ParentEnd.plan().points);
        if(!first||first.distance>2.5)
            throw Error('R43 não encaixa no pavimento R42 (nó 799)');
        if(!last||last.distance>3.2)
            throw Error('R43 não encaixa no pavimento R39 (nó 792)');
        let points=Network.simplify(original,1.1);
        points[0]={...first.point};points[points.length-1]={...last.point};
        for(let pass=0;pass<2;pass++){
            const out=[points[0]];
            for(let i=1;i<points.length;i++)
                for(const t of [.25,.75])
                    out.push({x:points[i-1].x+(points[i].x-points[i-1].x)*t,
                              z:points[i-1].z+(points[i].z-points[i-1].z)*t});
            out.push(points.at(-1));points=out;
        }
        path.points=points;path.width=8;path.lots=[];
        path.mode='source-cross-link-r43-adapted';
        path.sourceEdgeIds=this.source.sourceEdgeIds;
        path.sourceNodeIds=this.source.sourceNodeIds;
        path.sourceJoinNodeId=this.source.sourceJoinNodeId;
        path.sourceEndNodeId=this.source.sourceEndNodeId;
        path.predecessorJoinIndex=first.index;
        path.predecessorJoinT=first.t;
        path.adaptedSeamLength=first.distance;
        path.successorJoinIndex=last.index;
        path.successorJoinT=last.t;
        path.adaptedEndSeamLength=last.distance;
        path.junctionRadius=7;
        path.roadClassificationCertified=false;
        path.gradedJunctionsCertified=false;
        path.originalPlacementCertified=false;
        path.wholeMapCertified=false;
        path.missionsMigrated=false;
        return path;
    }
    static prepare(city){
        if(city?.preset?.id!=='chicago')return null;
        if(city[this.placement.key])return city[this.placement.key];
        const path=this.plan(),radius=path.junctionRadius;
        const joins=[path.points[0],path.points.at(-1)];
        for(const join of joins){
            for(let i=0;i<24;i++)for(const dist of [0,3,6.5]){
                const angle=i*Math.PI/12;
                const x=join.x+Math.cos(angle)*dist,
                      z=join.z+Math.sin(angle)*dist;
                if(city.isWaterAt(x,z)||city.isPointBlocked(x,z,1,0))
                    throw Error('Entroncamentos R43 obstruídos');
            }
        }
        const result=super.prepare(city),meshes=[];
        for(let i=0;i<joins.length;i++){
            const geo=new THREE.CircleGeometry(radius,32);
            geo.rotateX(-Math.PI/2);
            const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({
                color:0x45494b,side:THREE.DoubleSide
            }));
            mesh.position.set(joins[i].x,.040,joins[i].z);
            mesh.name='chicago-r43-cross-junction-'+i;
            mesh.userData.chicagoR43Road=true;
            city.cityGroup.add(mesh);
            meshes.push(mesh);
        }
        result.junctionMeshes=meshes;
        result.junctionMesh=meshes[0];
        return result;
    }
}
if(typeof module!=='undefined'&&module.exports){
    DriverChicagoCrossLinkR43.sourceDataR43=
        require('../../chicago/reference-cross-link-r43.json');
    DriverChicagoCrossLinkR43.parentR42=
        require('./chicago-south-stem-r42.js');
    DriverChicagoCrossLinkR43.parentR39=
        require('./chicago-southeast-r39.js');
    module.exports=DriverChicagoCrossLinkR43;
}
