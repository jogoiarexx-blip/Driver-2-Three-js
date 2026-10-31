/** Chicago R40 — lateral east street connected to R39 at the source node 918.
 * Based on 32 connected, previously unused skeleton edges in PS1 source data.
 * This is an arcade/flat-ground adaptation, not a certified PS1 road or junction.
 */
const DriverChicagoR40Base=typeof module!=='undefined'&&module.exports?
    require('./chicago-ps1-reference-curve.js'):
    DriverChicagoPS1ReferenceCurve;
class DriverChicagoEastLateralR40 extends DriverChicagoR40Base {
    static get source(){
        return typeof DriverChicagoSourceEastLateralR40!=='undefined'?
            DriverChicagoSourceEastLateralR40:this.sourceDataR40;
    }
    static fitPoint(point){return DriverChicagoR40Base.fitPoint(point);}
    static get placement(){
        return {key:'chicagoReferenceEastLateralR40',x:235,z:795,
            foundation:false,district:'wrigleyville',
            name:'chicago-r40-east-lateral-adapted-road'};
    }
    static plan(){
        const path=super.plan();
        const Network=typeof module!=='undefined'&&module.exports?
            require('./chicago-ps1-street-network-r22.js'):
            DriverChicagoPS1StreetNetwork;
        const Parent=typeof DriverChicagoSouthEastR39!=='undefined'?
            DriverChicagoSouthEastR39:this.parentR39;
        if(!Parent?.plan)throw Error('R40 requer corredor R39');
        const predecessor=Parent.plan().points;
        const rawStart=this.fitPoint(this.source.pointsOBJ[0]);
        const sorted=predecessor.map((p,i)=>({
            index:i,point:p,distance:Math.hypot(p.x-rawStart.x,p.z-rawStart.z)
        })).sort((a,b)=>a.distance-b.distance);
        const nearest=sorted[0];
        if(!nearest || nearest.distance>3)
            throw Error('R40 não alcança a rua R39 (nó 918)');
        let points=Network.simplify(this.source.pointsOBJ.map(p=>this.fitPoint(p)),2);
        // Snap into *actual R39 asphalt* instead of a source coordinate
        // that could be off by ~1.6m after the R39 raster smoothing.
        points[0]={...nearest.point};
        for(let pass=0;pass<2;pass++){
            const out=[points[0]];
            for(let i=1;i<points.length;i++)
                for(const t of [.25,.75])
                    out.push({x:points[i-1].x+(points[i].x-points[i-1].x)*t,
                              z:points[i-1].z+(points[i].z-points[i-1].z)*t});
            out.push(points.at(-1));points=out;
        }
        path.points=points;
        path.width=8;
        path.lots=[];
        path.mode='source-east-lateral-r40-adapted';
        path.sourceEdgeIds=this.source.sourceEdgeIds;
        path.sourceNodeIds=this.source.sourceNodeIds;
        path.sourceJoinNodeId=this.source.sourceJoinNodeId;
        path.predecessorJoinIndex=nearest.index;
        path.adaptedSeamLength=nearest.distance;
        path.adaptedSimplificationTolerance=2;
        path.junctionRadius=8;
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
        // The paved junction must be dry and clear over its whole footprint.
        const join=this.plan().points[0],radius=8;
        for(let i=0;i<24;i++){
            const a=i*Math.PI/12;
            for(const d of [0,4,7.5]){
                const x=join.x+d*Math.cos(a),z=join.z+d*Math.sin(a);
                if(city.isWaterAt(x,z)||city.isPointBlocked(x,z,1,0))
                    throw Error('Entroncamento lateral R40 obstruído');
            }
        }
        const result=super.prepare(city);
        const geometry=new THREE.CircleGeometry(radius,32);
        geometry.rotateX(-Math.PI/2);
        const junction=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({
            color:0x45494b,side:THREE.DoubleSide
        }));
        junction.position.set(join.x,.038,join.z);
        junction.name='chicago-r40-east-junction-apron';
        junction.userData.chicagoR40Road=true;
        city.cityGroup.add(junction);
        result.junctionMesh=junction;
        return result;
    }
}
if(typeof module!=='undefined'&&module.exports){
    DriverChicagoEastLateralR40.sourceDataR40=
        require('../../chicago/reference-east-lateral-r40.json');
    DriverChicagoEastLateralR40.parentR39=
        require('./chicago-southeast-r39.js');
    module.exports=DriverChicagoEastLateralR40;
}
