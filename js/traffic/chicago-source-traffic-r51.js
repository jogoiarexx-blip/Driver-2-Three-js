/**
 * R51: civilian traffic on the already-built distant source-adapted
 * R43/R44 Chicago circuits. No extra asphalt or speculative shortcuts.
 * Reuses the same mixed A* and braking behavior as central commuters.
 */
class DriverChicagoSourceTrafficR51 {
    static sample(points,dist){
        let total=0;
        const lengths=[0];
        for(let i=1;i<points.length;i++){
            total+=Math.hypot(points[i].x-points[i-1].x,
                points[i].z-points[i-1].z);
            lengths.push(total);
        }
        if(!total)return null;
        const d=((dist%total)+total)%total;
        for(let i=1;i<points.length;i++){
            if(lengths[i]<d)continue;
            const t=(d-lengths[i-1])/(lengths[i]-lengths[i-1]||1);
            return {x:points[i-1].x+(points[i].x-points[i-1].x)*t,
                z:points[i-1].z+(points[i].z-points[i-1].z)*t};
        }
        return {...points.at(-1)};
    }
    static spawnSpecs(city,vehicles=[]){
        if(city?.preset?.id!=='chicago' ||
           typeof DriverChicagoMixedNavigationR49==='undefined' ||
           !city.chicagoPS1StreetNetwork?.sourceCorridors)return [];
        const graph=DriverChicagoMixedNavigationR49.compile(city);
        if(!graph?.sourceEdges)return [];
        const routes=[
            {id:'r43',loop:city.chicagoR43BlockLoop,
                names:['SEDÃ CORREDOR PS1 ADAPTADO','TÁXI DISTRITO R43'],
                colors:[0x6a8b99,0xd6b04d]},
            {id:'r44',loop:city.chicagoR44BlockLoop,
                names:['COUPÉ DISTRITO R44','SEDÃ INTERBAIRROS R44'],
                colors:[0x907263,0x668b75]}
        ];
        const result=[];
        for(const route of routes){
            const points=route.loop?.points;
            if(!points||points.length<5 || route.loop.closed>.01)continue;
            const length=route.loop.length;
            if(!Number.isFinite(length)||length<100)continue;
            const goals=[.08,.32,.56,.8].map(r=>this.sample(points,r*length));
            if(goals.some(g=>!g))continue;
            for(const i of [0,1]){
                const position=goals[i*2],target=goals[(i*2+1)%4];
                if(city.isWaterAt?.(position.x,position.z) ||
                   city.isPointBlocked?.(position.x,position.z,1.8,0))continue;
                if([...vehicles,...result].some(v=>
                    Math.hypot(position.x-v.x,position.z-v.z)<25))continue;
                const routePath=DriverChicagoMixedNavigationR49.plan(
                    city,position,target);
                if(!routePath||routePath.length<3)continue;
                const ahead=this.sample(points,(i*2===0?.08:.56)*length+3);
                const behind=this.sample(points,(i*2===0?.08:.56)*length-3);
                const heading=Math.atan2(
                    ahead.x-behind.x,ahead.z-behind.z);
                result.push({
                    name:route.names[i],color:route.colors[i],
                    x:position.x,z:position.z,heading,
                    maxSpeed:27,accel:18,bodyStyle:'sedan',
                    goalIndex:i*2+1,goals,sourceLoop:route.id
                });
            }
        }
        return result;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoSourceTrafficR51;
