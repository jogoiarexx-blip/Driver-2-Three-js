/** R16: contiguous source corridor. Uses the exact same similarity fit as R15.
 * Plain paving bridges texture gaps in the source; this is still adapted
 * placement and does not certify the full map or original neighborhood.
 */
const DriverChicagoExtensionBase=typeof module!=='undefined'&&module.exports?
    require('./chicago-ps1-reference-curve.js'):DriverChicagoPS1ReferenceCurve;
class DriverChicagoPS1ReferenceExtension extends DriverChicagoExtensionBase {
    static get source(){return typeof DriverChicagoSourceExtensionR16!=='undefined'?
        DriverChicagoSourceExtensionR16:this.extensionData;}
    static fitPoint(point){return DriverChicagoExtensionBase.fitPoint(point);}
    static isCarvedBlock(x,z){return x===-280&&z===-40;}
    static get placement(){return {key:'chicagoReferenceExtension',x:-280,z:-40,name:'chicago-r16-source-extension'};}
    static plan(){
        const plan=super.plan();
        plan.lots=[
            {x:-270,z:-24,width:18,depth:12,height:12,palette:1},
            {x:-270,z:-50,width:18,depth:12,height:10,palette:2},
            {x:-290,z:-50,width:12,depth:10,height:9,palette:0}
        ].map(b=>({...b,baseY:0,planned:true,kind:'residential',district:'ukrainian-village'}));
        plan.mode='source-extension-r16';return plan;
    }
}
if(typeof module!=='undefined'&&module.exports){
    DriverChicagoPS1ReferenceExtension.extensionData=require('../../chicago/reference-extension-r16.json');
    module.exports=DriverChicagoPS1ReferenceExtension;
}
