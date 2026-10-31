/** R39: new drivable southeastern extension of the R38 adapted source pavement.
 * 32 connected, previously unused original-surface skeleton edges (501→1323).
 * The source is NOT certified road, elevation, or full PS1 geometry.
 */
const DriverChicagoR39Base=typeof module!=='undefined'&&module.exports?
    require('./chicago-ps1-reference-curve.js'):DriverChicagoPS1ReferenceCurve;
class DriverChicagoSouthEastR39 extends DriverChicagoR39Base {
    static get source(){
        return typeof DriverChicagoSourceSouthEastR39!=='undefined'?
            DriverChicagoSourceSouthEastR39:this.sourceDataR39;
    }
    static fitPoint(point){return DriverChicagoR39Base.fitPoint(point);}
    static get placement(){
        return {key:'chicagoReferenceSouthEastR39',x:160,z:770,
            foundation:false,district:'wrigleyville',
            name:'chicago-r39-southeast-adapted-road'};
    }
    static plan(){
        const path=super.plan();
        const Network=typeof module!=='undefined'&&module.exports?
            require('./chicago-ps1-street-network-r22.js'):DriverChicagoPS1StreetNetwork;
        const previous=typeof DriverChicagoEastReturnR38!=='undefined'?
            DriverChicagoEastReturnR38:this.parentR38;
        if(!previous?.plan)throw Error('R39 requer R38');
        const target=previous.plan().points.at(-1);
        let points=Network.simplify(this.source.pointsOBJ.map(p=>this.fitPoint(p)),2);
        const seam=Math.hypot(target.x-points[0].x,target.z-points[0].z);
        if(seam>.05)throw Error('R39 não conecta ao nó 501 da R38');
        points[0]={...target};
        // Smooth rasterized source pixels, keeping exact endpoint and 8m width.
        for(let pass=0;pass<2;pass++){
            const out=[points[0]];
            for(let i=1;i<points.length;i++)
                for(const t of [.25,.75])
                    out.push({x:points[i-1].x+(points[i].x-points[i-1].x)*t,
                              z:points[i-1].z+(points[i].z-points[i-1].z)*t});
            out.push(points.at(-1));points=out;
        }
        path.points=points;
        path.lots=[];path.width=8;
        path.mode='source-southeast-r39-adapted';
        path.adaptedSimplificationTolerance=2;
        path.adaptedSeamLength=seam;
        path.sourceEdgeIds=this.source.sourceEdgeIds;
        path.sourceNodeIds=this.source.sourceNodeIds;
        path.gradedJunctionsCertified=false;
        path.roadClassificationCertified=false;
        path.originalPlacementCertified=false;
        path.wholeMapCertified=false;
        path.missionsMigrated=false;
        return path;
    }
}
if(typeof module!=='undefined'&&module.exports){
    DriverChicagoSouthEastR39.sourceDataR39=
        require('../../chicago/reference-southeast-r39.json');
    DriverChicagoSouthEastR39.parentR38=
        require('./chicago-east-return-r38.js');
    module.exports=DriverChicagoSouthEastR39;
}
