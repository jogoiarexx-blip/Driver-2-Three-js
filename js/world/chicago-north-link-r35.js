/** R35: connected source pavement adapted as a physical northern extension. */
const DriverChicagoR35Base=typeof module!=='undefined'&&module.exports?
    require('./chicago-ps1-reference-curve.js'):
    DriverChicagoPS1ReferenceCurve;
class DriverChicagoNorthLinkR35 extends DriverChicagoR35Base {
    static get source(){
        return typeof DriverChicagoSourceNorthLinkR35!=='undefined'?
            DriverChicagoSourceNorthLinkR35:this.sourceDataR35;
    }
    static fitPoint(point){return DriverChicagoR35Base.fitPoint(point);}
    static get placement(){
        return {key:'chicagoReferenceNorthLinkR35',x:-180,z:950,
            foundation:false,district:'wrigleyville',
            name:'chicago-r35-adapted-north-link'};
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
        const predecessor=typeof DriverChicagoPS1EasternForkR25!=='undefined'?
            DriverChicagoPS1EasternForkR25:this.parentR25;
        if(!predecessor?.plan)throw Error('R35 requer o plano R25');
        const end=predecessor.plan().points.at(-1),start=path.points[0];
        const seam=Math.hypot(end.x-start.x,end.z-start.z);
        if(seam>.05)throw Error('R35 não conecta ao nó 752 da R25');
        path.points[0]={...end};
        path.lots=[];
        path.width=8;
        path.mode='source-north-link-r35-adapted';
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
    DriverChicagoNorthLinkR35.sourceDataR35=
        require('../../chicago/reference-north-link-r35.json');
    DriverChicagoNorthLinkR35.parentR25=
        require('./chicago-ps1-eastern-fork-r25.js');
    module.exports=DriverChicagoNorthLinkR35;
}
