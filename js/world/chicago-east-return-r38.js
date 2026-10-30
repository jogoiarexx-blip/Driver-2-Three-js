/** R38: connected source pavement adapted as a physical northern extension. */
const DriverChicagoR38Base=typeof module!=='undefined'&&module.exports?
    require('./chicago-ps1-reference-curve.js'):
    DriverChicagoPS1ReferenceCurve;
class DriverChicagoEastReturnR38 extends DriverChicagoR38Base {
    static get source(){
        return typeof DriverChicagoSourceEastReturnR38!=='undefined'?
            DriverChicagoSourceEastReturnR38:this.sourceDataR38;
    }
    static fitPoint(point){return DriverChicagoR38Base.fitPoint(point);}
    static get placement(){
        return {key:'chicagoReferenceEastReturnR38',x:-180,z:950,
            foundation:false,district:'wrigleyville',
            name:'chicago-r38-adapted-north-link'};
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
        const predecessor=typeof DriverChicagoNorthBranchR37!=='undefined'?
            DriverChicagoNorthBranchR37:this.parentR37;
        if(!predecessor?.plan)throw Error('R38 requer o plano R37');
        const previous=predecessor.plan().points;
        const index=previous.length-8,start=previous[index],before=previous[index-1];
        const exitIndex=12,end=path.points[exitIndex],after=path.points[exitIndex+1];
        const length=Math.hypot(end.x-start.x,end.z-start.z);
        const inLength=Math.hypot(start.x-before.x,start.z-before.z),outLength=Math.hypot(after.x-end.x,after.z-end.z);
        const c1={x:start.x+(start.x-before.x)/inLength*length/3,z:start.z+(start.z-before.z)/inLength*length/3};
        const c2={x:end.x-(after.x-end.x)/outLength*length/3,z:end.z-(after.z-end.z)/outLength*length/3};
        const seam=[];
        for(let i=0;i<=12;i++){const t=i/12,u=1-t;seam.push({x:u*u*u*start.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*end.x,z:u*u*u*start.z+3*u*u*t*c1.z+3*u*t*t*c2.z+t*t*t*end.z});}
        seam[0]={...start};seam[12]={...end};
        path.points=[...seam,...path.points.slice(exitIndex+1)];
        path.adaptedSeamTrimmed=true;path.predecessorJoinIndex=index;path.adaptedSeamChordLength=length;
        // The source's terminal raster kink turns inside the arcade turning
        // radius. Ease its final approach while retaining the exact source end.
        const tailIndex=path.points.length-14,tailStart=path.points[tailIndex],tailBefore=path.points[tailIndex-1],tailEnd=path.points.at(-1);
        const tailLength=Math.hypot(tailEnd.x-tailStart.x,tailEnd.z-tailStart.z),incoming=Math.hypot(tailStart.x-tailBefore.x,tailStart.z-tailBefore.z);
        const t1={x:tailStart.x+(tailStart.x-tailBefore.x)/incoming*tailLength/3,z:tailStart.z+(tailStart.z-tailBefore.z)/incoming*tailLength/3};
        const t2={x:tailEnd.x-(tailEnd.x-tailStart.x)/3,z:tailEnd.z-(tailEnd.z-tailStart.z)/3};
        const tail=[];for(let i=0;i<=12;i++){const t=i/12,u=1-t;tail.push({x:u*u*u*tailStart.x+3*u*u*t*t1.x+3*u*t*t*t2.x+t*t*t*tailEnd.x,z:u*u*u*tailStart.z+3*u*u*t*t1.z+3*u*t*t*t2.z+t*t*t*tailEnd.z});}
        tail[0]={...tailStart};tail[12]={...tailEnd};path.points=[...path.points.slice(0,tailIndex),...tail];path.adaptedEndChordLength=tailLength;

        path.lots=[];
        path.width=8;
        path.mode='source-east-return-r38-adapted';
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
    DriverChicagoEastReturnR38.sourceDataR38=
        require('../../chicago/reference-east-return-r38.json');
    DriverChicagoEastReturnR38.parentR37=
        require('./chicago-north-branch-r37.js');
    module.exports=DriverChicagoEastReturnR38;
}
