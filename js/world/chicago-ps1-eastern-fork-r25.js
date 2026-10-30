/**
 * Chicago R25 — observed east/north-east fork continuing R23.
 * Three connected surface-skeleton edges: 1520 / 1437 / 1017.
 * Surface evidence is NOT certified PS1 street or overpass geometry.
 * This is a collision-gated physical adaptation in Undercover.
 */
const DriverChicagoR25Base=typeof module!=='undefined'&&module.exports?
    require('./chicago-ps1-reference-curve.js'):
    DriverChicagoPS1ReferenceCurve;
class DriverChicagoPS1EasternForkR25 extends DriverChicagoR25Base {
    static get source(){
        return typeof DriverChicagoSourceEasternForkR25!=='undefined'?
            DriverChicagoSourceEasternForkR25:this.sourceDataR25;
    }
    static fitPoint(point){return DriverChicagoR25Base.fitPoint(point);}
    static get placement(){
        return {key:'chicagoReferenceEasternForkR25',x:-265,z:770,
            foundation:false,district:'wrigleyville',
            name:'chicago-r25-source-eastern-fork'};
    }
    static plan(){
        const path=super.plan();
        const predecessor=typeof DriverChicagoPS1NorthCandidateR23!=='undefined'?
            DriverChicagoPS1NorthCandidateR23:this.parentR23;
        if(!predecessor?.plan)throw Error('R25 requer o plano R23');
        const end=predecessor.plan().points.at(-1),start=path.points[0];
        const seam=Math.hypot(end.x-start.x,end.z-start.z);
        if(seam>.05)throw Error('R25 não conecta ao nó 1125 da R23');
        path.points[0]={...end};
        path.lots=[];
        path.width=8;
        path.mode='source-eastern-fork-r25-uncertified';
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
    DriverChicagoPS1EasternForkR25.sourceDataR25=
        require('../../chicago/reference-eastern-fork-r25.json');
    DriverChicagoPS1EasternForkR25.parentR23=
        require('./chicago-ps1-north-candidate-r23.js');
    module.exports=DriverChicagoPS1EasternForkR25;
}
