/** R37: connected source pavement adapted as a physical northern extension. */
const DriverChicagoR37Base=typeof module!=='undefined'&&module.exports?
    require('./chicago-ps1-reference-curve.js'):
    DriverChicagoPS1ReferenceCurve;
class DriverChicagoNorthBranchR37 extends DriverChicagoR37Base {
    static get source(){
        return typeof DriverChicagoSourceNorthBranchR37!=='undefined'?
            DriverChicagoSourceNorthBranchR37:this.sourceDataR37;
    }
    static fitPoint(point){return DriverChicagoR37Base.fitPoint(point);}
    static get placement(){
        return {key:'chicagoReferenceNorthBranchR37',x:-180,z:950,
            foundation:false,district:'wrigleyville',
            name:'chicago-r37-adapted-north-link'};
    }
    static prepare(city){
        if(city?.preset?.id!=='chicago')return null;
        if(city[this.placement.key])return city[this.placement.key];
        const join=this.plan().points[0];
        for(let i=0;i<16;i++){const a=i*Math.PI/8,x=join.x+Math.cos(a)*11,z=join.z+Math.sin(a)*11;
            if(city.isWaterAt(x,z)||city.isPointBlocked(x,z,1,0))throw Error('Entroncamento R37 obstruído');}
        const result=super.prepare(city),geo=new THREE.CircleGeometry(11,24);geo.rotateX(-Math.PI/2);
        const apron=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:0x45494b,side:THREE.DoubleSide}));
        apron.position.set(join.x,.036,join.z);apron.name='chicago-r37-junction-apron';city.cityGroup.add(apron);result.junctionMesh=apron;result.junctionRadius=11;return result;
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
        const predecessor=typeof DriverChicagoNorthLinkR36!=='undefined'?
            DriverChicagoNorthLinkR36:this.parentR36;
        if(!predecessor?.plan)throw Error('R37 requer o plano R36');
        const previous=predecessor.plan().points,start=path.points[0];
        const nearest=previous.reduce((best,p)=>Math.hypot(p.x-start.x,p.z-start.z)<Math.hypot(best.x-start.x,best.z-start.z)?p:best,previous[0]);
        const approach=previous[Math.max(0,previous.indexOf(nearest)-1)];
        const end=Math.hypot(approach.x-start.x,approach.z-start.z)<=8?approach:nearest;
        const seam=Math.hypot(end.x-start.x,end.z-start.z);
        if(seam>8)throw Error('R37 não conecta ao entroncamento da R36');
        path.adaptedSeamLength=seam;path.points[0]={...end};
        path.lots=[];
        path.width=8;
        path.mode='source-north-branch-r37-adapted';
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
    DriverChicagoNorthBranchR37.sourceDataR37=
        require('../../chicago/reference-north-branch-r37.json');
    DriverChicagoNorthBranchR37.parentR36=
        require('./chicago-north-link-r36.js');
    module.exports=DriverChicagoNorthBranchR37;
}
