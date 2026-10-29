/** R17: observed western branch, sharing both R16 endpoints and R15's fit.
 * Adapted placement only. No traffic or campaign migration is inferred.
 */
const DriverChicagoLoopBase=typeof module!=='undefined'&&module.exports?
    require('./chicago-ps1-reference-curve.js'):DriverChicagoPS1ReferenceCurve;
class DriverChicagoPS1ReferenceLoop extends DriverChicagoLoopBase {
    static get source(){return typeof DriverChicagoSourceLoopR17!=='undefined'?
        DriverChicagoSourceLoopR17:this.loopData;}
    static fitPoint(point){return DriverChicagoLoopBase.fitPoint(point);}
    static get placement(){return {key:'chicagoReferenceLoop',x:-360,z:-40,name:'chicago-r17-source-west-loop'};}
    static plan(){
        const plan=super.plan();plan.lots=[];plan.mode='source-west-loop-r17';return plan;
    }
}
if(typeof module!=='undefined'&&module.exports){
    DriverChicagoPS1ReferenceLoop.loopData=require('../../chicago/reference-loop-r17.json');
    module.exports=DriverChicagoPS1ReferenceLoop;
}
