/** R20: observed western S arterial outside the former 410-unit boundary. */
const DriverChicagoArterialBase=typeof module!=='undefined'&&module.exports?
    require('./chicago-ps1-reference-curve.js'):DriverChicagoPS1ReferenceCurve;
class DriverChicagoPS1ReferenceArterial extends DriverChicagoArterialBase {
    static get source(){return typeof DriverChicagoSourceArterialR20!=='undefined'?DriverChicagoSourceArterialR20:this.sourceDataR20;}
    static fitPoint(point){return DriverChicagoArterialBase.fitPoint(point);}
    static get placement(){return {key:'chicagoReferenceArterial',x:-400,z:480,foundation:false,district:'wrigleyville',name:'chicago-r20-west-arterial'};}
    static plan(){const p=super.plan();p.lots=[];p.mode='source-west-arterial-r20';return p;}
}
if(typeof module!=='undefined'&&module.exports){DriverChicagoPS1ReferenceArterial.sourceDataR20=require('../../chicago/reference-arterial-r20.json');module.exports=DriverChicagoPS1ReferenceArterial;}
