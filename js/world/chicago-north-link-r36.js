/** R36: connected source pavement adapted as a physical northern extension. */
const DriverChicagoR36Base=typeof module!=='undefined'&&module.exports?
    require('./chicago-ps1-reference-curve.js'):
    DriverChicagoPS1ReferenceCurve;
class DriverChicagoNorthLinkR36 extends DriverChicagoR36Base {
    static get source(){
        return typeof DriverChicagoSourceNorthLinkR36!=='undefined'?
            DriverChicagoSourceNorthLinkR36:this.sourceDataR36;
    }
    static fitPoint(point){return DriverChicagoR36Base.fitPoint(point);}
    static get placement(){
        return {key:'chicagoReferenceNorthLinkR36',x:-180,z:950,
            foundation:false,district:'wrigleyville',
            name:'chicago-r36-adapted-north-link'};
    }
    static plan(){
        const path=super.plan();
        const Network=typeof module!=='undefined'&&module.exports?
            require('./chicago-ps1-street-network-r22.js'):DriverChicagoPS1StreetNetwork;
        let smooth=Network.simplify(this.source.pointsOBJ.map(p=>this.fitPoint(p)),2);
        for(let pass=0;pass<2;pass++){
            const out=[smooth[0]];
            for(let i=1;i<smooth.length;i++)for(const t of [.25,.75])out.push({x:smooth[i-1].x+(smooth[i].x-smooth[i-1].x)*t,z:smooth[i-1].z+(smooth[i].z-smooth[i-1].z)*t});
            out.push(smooth.at(-1));smooth=out;
        }
        path.points=smooth;path.adaptedSimplificationTolerance=2;
        const predecessor=typeof DriverChicagoNorthLinkR35!=='undefined'?
            DriverChicagoNorthLinkR35:this.parentR35;
        if(!predecessor?.plan)throw Error('R36 requer o plano R35');
        const end=predecessor.plan().points.at(-1),start=path.points[0];
        const seam=Math.hypot(end.x-start.x,end.z-start.z);
        if(seam>.05)throw Error('R36 não conecta ao nó 405 da R35');
        path.points[0]={...end};
        path.lots=[];
        path.width=8;
        path.mode='source-north-link-r36-adapted';
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
    DriverChicagoNorthLinkR36.sourceDataR36=
        require('../../chicago/reference-north-link-r36.json');
    DriverChicagoNorthLinkR36.parentR35=
        require('./chicago-north-link-r35.js');
    module.exports=DriverChicagoNorthLinkR36;
}
