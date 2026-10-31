/** Closed drivable neighborhood block bounded by R41 → R42 → R43 → R39.
 * Each transition is snapped to already-generated mesh centerlines; this
 * model is deliberately not declared to match the PS1 map at original scale.
 */
class DriverChicagoR43BlockLoop {
    static project(points,p) {
        if(!Array.isArray(points)||points.length<2||!p)throw Error('Loop: invalid pavement');
        let best=null;
        for(let i=1;i<points.length;i++){
            const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z;
            const den=dx*dx+dz*dz;if(den<1e-9)continue;
            const t=Math.max(0,Math.min(1,
                ((p.x-a.x)*dx+(p.z-a.z)*dz)/den));
            const point={x:a.x+dx*t,z:a.z+dz*t};
            const distance=Math.hypot(p.x-point.x,p.z-point.z);
            if(!best||distance<best.distance)best={index:i-1,t,point,distance};
        }
        if(!best)throw Error('Loop: zero-length road');
        return best;
    }
    static slice(points,from,to,tolerance=.1){
        const a=this.project(points,from),b=this.project(points,to);
        if(a.distance>tolerance||b.distance>tolerance)
            throw Error('Loop: junction outside connected asphalt');
        const start=a.index+a.t,end=b.index+b.t;
        if(Math.abs(start-end)<1e-5)throw Error('Loop: collapsed road leg');
        const forward=end>start,lo=Math.min(start,end),hi=Math.max(start,end);
        const inner=points.map((p,i)=>({p,i}))
            .filter(x=>x.i>lo+1e-6&&x.i<hi-1e-6)
            .map(x=>({...x.p}));
        if(!forward)inner.reverse();
        const out=[{...a.point},...inner,{...b.point}];
        return out.filter((p,i)=>!i||Math.hypot(p.x-out[i-1].x,p.z-out[i-1].z)>1e-6);
    }
    static build(roads){
        const {r39,r41,r42,r43}=roads||{};
        if(![r39,r41,r42,r43].every(p=>p&&p.width===8&&p.points?.length>1))
            throw Error('Loop: roads R39/R41/R42/R43 are required');
        const j41=r41.points[0],j42=r42.points[0],
            j43=r43.points[0],j39=r43.points.at(-1);
        const route=[
            {id:'west-lateral-r41',road:r41,from:j41,to:j42},
            {id:'south-stem-r42',road:r42,from:j42,to:j43},
            {id:'cross-link-r43',road:r43,from:j43,to:j39},
            {id:'southeast-r39',road:r39,from:j39,to:j41}
        ];
        const legs=[],path=[];
        for(const entry of route){
            const points=this.slice(entry.road.points,entry.from,entry.to);
            if(path.length&&Math.hypot(path.at(-1).x-points[0].x,path.at(-1).z-points[0].z)>1e-5)
                throw Error('Loop: disconnected intersection '+entry.id);
            const length=points.slice(1).reduce((s,p,i)=>
                s+Math.hypot(p.x-points[i].x,p.z-points[i].z),0);
            if(length<10)throw Error('Loop: collapsed leg '+entry.id);
            legs.push({id:entry.id,points,length,startIndex:path.length?path.length-1:0,
                endIndex:(path.length?path.length-1:0)+points.length-1});
            path.push(...points.slice(path.length?1:0));
        }
        const closed=Math.hypot(path[0].x-path.at(-1).x,path[0].z-path.at(-1).z);
        if(closed>1e-5)throw Error('Loop: open circuit '+closed);
        const length=legs.reduce((n,p)=>n+p.length,0);
        return {points:path,legs,length,closed,
            sourceCorridorCount:4,originalPlacementCertified:false,
            gradedJunctionsCertified:false,missionsMigrated:false};
    }
    static fromCity(city){
        return this.build({
            r39:city?.chicagoReferenceSouthEastR39,
            r41:city?.chicagoReferenceWestLateralR41,
            r42:city?.chicagoReferenceSouthStemR42,
            r43:city?.chicagoReferenceCrossLinkR43
        });
    }
}
if(typeof module!=='undefined'&&module.exports)module.exports=DriverChicagoR43BlockLoop;
