/** R19: three source corridors with one canonical north junction.
 * All source points share the R15 fit; adapted placement, not a certification
 * of the whole PS1 map, original neighborhood, grades or campaign routes.
 */
const DriverChicagoNorthBase=typeof module!=='undefined'&&module.exports?
    require('./chicago-ps1-reference-curve.js'):DriverChicagoPS1ReferenceCurve;
class DriverChicagoPS1ReferenceNorthNetwork {
    static get source(){return typeof DriverChicagoSourceNorthR19!=='undefined'?
        DriverChicagoSourceNorthR19:this.sourceData;}
    static fitPoint(point){return DriverChicagoNorthBase.fitPoint(point);}
    static isCarvedBlock(x,z){return x===-280&&z===280;}
    static get roadClasses(){
        if(this.cachedRoadClasses)return this.cachedRoadClasses;
        const network=this;
        const placements={
            stem:{key:'chicagoReferenceNorthStem',x:-360,z:240,foundation:false},
            continuation:{key:'chicagoReferenceNorthContinuation',x:-360,z:320,foundation:false},
            branch:{key:'chicagoReferenceNorthBranch',x:-280,z:280}
        };
        this.cachedRoadClasses=Object.fromEntries(Object.keys(placements).map(name=>[name,class extends DriverChicagoNorthBase {
            static get source(){return network.source.edges[name];}
            static fitPoint(point){return network.fitPoint(point);}
            static get placement(){return {...placements[name],district:'wrigleyville',name:'chicago-r19-north-'+name};}
            static plan(){
                const plan=super.plan();plan.mode='source-north-'+name+'-r19';
                plan.lots=name==='branch'?[
                    {x:-287,z:262,width:16,depth:10,height:11,palette:1},
                    {x:-265,z:262,width:12,depth:10,height:10,palette:2},
                    {x:-288,z:301,width:14,depth:10,height:12,palette:0}
                ].map(b=>({...b,baseY:0,planned:true,kind:'residential',district:'wrigleyville'})):[];
                return plan;
            }
        }]));
        return this.cachedRoadClasses;
    }
    static plans(){return Object.fromEntries(Object.entries(this.roadClasses).map(([name,Road])=>[name,Road.plan()]));}
    static junction(){const p=this.plans().stem.points.at(-1);return {...p,radius:9};}
    static prepare(city){
        if(city?.preset?.id!=='chicago')return null;
        if(city.chicagoReferenceNorthNetwork)return city.chicagoReferenceNorthNetwork;
        const segments=Object.fromEntries(Object.entries(this.roadClasses).map(([name,Road])=>[name,Road.prepare(city)]));
        const junction=this.junction();
        const apron=new THREE.Mesh(new THREE.CircleGeometry(junction.radius,48),
            new THREE.MeshLambertMaterial({color:0x45494b,side:THREE.DoubleSide}));
        apron.rotation.x=-Math.PI/2;apron.position.set(junction.x,.034,junction.z);
        apron.name='chicago-r19-north-junction-apron';city.cityGroup.add(apron);
        city.chicagoReferenceNorthNetwork={segments,junction:{...junction,mesh:apron},wholeMapCertified:false,missionsMigrated:false};
        return city.chicagoReferenceNorthNetwork;
    }
}
if(typeof module!=='undefined'&&module.exports){
    DriverChicagoPS1ReferenceNorthNetwork.sourceData=require('../../chicago/reference-north-r19.json');
    module.exports=DriverChicagoPS1ReferenceNorthNetwork;
}
