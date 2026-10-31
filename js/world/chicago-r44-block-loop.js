/** Second closed block in adapted Chicago: R41 → R42 → R44.
 * Every leg follows a built asphalt segment; no synthetic connector or
 * claim of faithful PS1 road grade, neighborhood placement or street class.
 */
const DriverChicagoR44LoopBase=typeof module!=='undefined'&&module.exports?
    require('./chicago-r43-block-loop.js'):DriverChicagoR43BlockLoop;
class DriverChicagoR44BlockLoop extends DriverChicagoR44LoopBase {
    static build(roads){
        const {r41,r42,r44}=roads||{};
        if(![r41,r42,r44].every(r=>r?.width===8&&r.points?.length>1))
            throw Error('R44 loop requires R41, R42, R44');
        const joins=[
            r44.points[0],       // R41 at original node 574
            r42.points[0],       // R41 at original node 576
            r44.points.at(-1)    // R42 at original node 846
        ];
        const specs=[
            {id:'west-lateral-r41',road:r41,from:joins[0],to:joins[1]},
            {id:'south-stem-r42',road:r42,from:joins[1],to:joins[2]},
            {id:'parallel-west-r44',road:r44,from:joins[2],to:joins[0]}
        ];
        const path=[],legs=[];
        for(const entry of specs){
            const points=this.slice(entry.road.points,entry.from,entry.to);
            if(path.length&&Math.hypot(path.at(-1).x-points[0].x,
                path.at(-1).z-points[0].z)>1e-5)
                throw Error('R44 loop: disconnected junction');
            const length=points.slice(1).reduce((sum,p,i)=>
                sum+Math.hypot(p.x-points[i].x,p.z-points[i].z),0);
            if(length<10)throw Error('R44 loop: missing lane '+entry.id);
            legs.push({id:entry.id,points,length,startIndex:path.length?path.length-1:0,
                endIndex:(path.length?path.length-1:0)+points.length-1});
            path.push(...points.slice(path.length?1:0));
        }
        const closed=Math.hypot(path[0].x-path.at(-1).x,
            path[0].z-path.at(-1).z);
        if(closed>1e-5)throw Error('R44 loop: not closed');
        return {points:path,legs,length:legs.reduce((n,leg)=>n+leg.length,0),
            closed,sourceCorridorCount:3,originalPlacementCertified:false,
            gradedJunctionsCertified:false,missionsMigrated:false};
    }
    static fromCity(city){
        return this.build({
            r41:city?.chicagoReferenceWestLateralR41,
            r42:city?.chicagoReferenceSouthStemR42,
            r44:city?.chicagoReferenceParallelWestR44
        });
    }
}
if(typeof module!=='undefined'&&module.exports)module.exports=DriverChicagoR44BlockLoop;
