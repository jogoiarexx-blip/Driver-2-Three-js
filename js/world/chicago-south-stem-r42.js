/** R42 — 8 connected original-surface edges, adapted to drivable southward street.
 * Joins R41 at original network node 576, projected to R41's actual smoothed
 * road segment so cars and pedestrians never enter a disjoint lane.
 * Road status, source placement and grade remain unverified against PS1.
 */
const DriverChicagoR42Base=typeof module!=='undefined'&&module.exports?
    require('./chicago-ps1-reference-curve.js'):DriverChicagoPS1ReferenceCurve;
class DriverChicagoSouthStemR42 extends DriverChicagoR42Base {
    static get source(){
        return typeof DriverChicagoSourceSouthStemR42!=='undefined'?
            DriverChicagoSourceSouthStemR42:this.sourceDataR42;
    }
    static fitPoint(point){return DriverChicagoR42Base.fitPoint(point);}
    static get placement(){
        return {key:'chicagoReferenceSouthStemR42',x:86,z:784,
            foundation:false,district:'wrigleyville',
            name:'chicago-r42-south-stem-adapted-road'};
    }
    static nearestExistingRoadPoint(sourcePoint,road){
        if(!road||road.length<2)throw Error('R42 exige a geometria de R41');
        let best=null;
        for(let i=1;i<road.length;i++){
            const a=road[i-1],b=road[i],dx=b.x-a.x,dz=b.z-a.z;
            const den=dx*dx+dz*dz;if(den<1e-8)continue;
            const t=Math.max(0,Math.min(1,(
                (sourcePoint.x-a.x)*dx+(sourcePoint.z-a.z)*dz)/den));
            const point={x:a.x+dx*t,z:a.z+dz*t};
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
        const Parent=typeof DriverChicagoWestLateralR41!=='undefined'?
            DriverChicagoWestLateralR41:this.parentR41;
        if(!Parent?.plan)throw Error('R42 depende de R41');
        const rawStart=this.fitPoint(this.source.pointsOBJ[0]);
        const nearest=this.nearestExistingRoadPoint(rawStart,Parent.plan().points);
        if(!nearest||nearest.distance>2.5)
            throw Error('R42 não conecta ao pavimento R41 no nó 576');
        let points=Network.simplify(this.source.pointsOBJ.map(p=>this.fitPoint(p)),1.3);
        points[0]={...nearest.point};
        for(let pass=0;pass<2;pass++){
            const out=[points[0]];
            for(let i=1;i<points.length;i++)
                for(const t of [.25,.75])
                    out.push({x:points[i-1].x+(points[i].x-points[i-1].x)*t,
                              z:points[i-1].z+(points[i].z-points[i-1].z)*t});
            out.push(points.at(-1));points=out;
        }
        path.points=points;path.width=8;path.lots=[];
        path.mode='source-south-stem-r42-adapted';
        path.predecessorJoinIndex=nearest.index;
        path.predecessorJoinT=nearest.t;
        path.adaptedSeamLength=nearest.distance;
        path.junctionRadius=8;
        path.sourceEdgeIds=this.source.sourceEdgeIds;
        path.sourceNodeIds=this.source.sourceNodeIds;
        path.sourceJoinNodeId=this.source.sourceJoinNodeId;
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
        const join=this.plan().points[0],radius=8;
        for(let i=0;i<24;i++)for(const dist of [0,4,7.5]){
            const rad=i*Math.PI/12,x=join.x+Math.cos(rad)*dist,
                z=join.z+Math.sin(rad)*dist;
            if(city.isWaterAt(x,z)||city.isPointBlocked(x,z,1,0))
                throw Error('Entroncamento R42 obstruído');
        }
        const result=super.prepare(city);
        const geo=new THREE.CircleGeometry(radius,32);
        geo.rotateX(-Math.PI/2);
        const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({
            color:0x45494b,side:THREE.DoubleSide
        }));
        mesh.position.set(join.x,.039,join.z);
        mesh.name='chicago-r42-south-junction-apron';
        mesh.userData.chicagoR42Road=true;
        city.cityGroup.add(mesh);
        result.junctionMesh=mesh;
        return result;
    }
}
if(typeof module!=='undefined'&&module.exports){
    DriverChicagoSouthStemR42.sourceDataR42=
        require('../../chicago/reference-south-stem-r42.json');
    DriverChicagoSouthStemR42.parentR41=
        require('./chicago-west-lateral-r41.js');
    module.exports=DriverChicagoSouthStemR42;
}
