/** Civilian traffic for two physically proven adapted Chicago blocks.
 * R43/R44 paths reuse exactly built streets; no grid shortcut, teleport,
 * special police routing or mutation of the original mission waypoints.
 */
class DriverChicagoNeighborhoodTraffic {
    static LOOPS=['r43','r44'];
    static getLoop(city,id){
        return city?.preset?.id==='chicago'?
            (id==='r43'?city.chicagoR43BlockLoop:
             id==='r44'?city.chicagoR44BlockLoop:null):null;
    }
    static points(loop,reverse=false){
        if(!loop?.points||loop.points.length<5||loop.closed>1e-4)
            return null;
        return reverse?[...loop.points].reverse():loop.points;
    }
    static measurements(points){
        const distances=[0];
        for(let i=1;i<points.length;i++)
            distances.push(distances.at(-1)+Math.hypot(
                points[i].x-points[i-1].x,
                points[i].z-points[i-1].z));
        return distances;
    }
    static sample(points,measurements,dist){
        const length=measurements.at(-1);
        if(!length)return {...points[0]};
        const d=((dist%length)+length)%length;
        for(let i=1;i<points.length;i++){
            if(measurements[i]+1e-6<d)continue;
            const t=(d-measurements[i-1])/
                (measurements[i]-measurements[i-1]||1);
            return {x:points[i-1].x+
                (points[i].x-points[i-1].x)*t,
                z:points[i-1].z+
                (points[i].z-points[i-1].z)*t};
        }
        return {...points.at(-1)};
    }
    static project(points,measurements,x,z,progress){
        const length=measurements.at(-1);
        let best=null;
        // Search copies around the CURRENT lap, not only the first
        // two repetitions. Cars must circulate indefinitely without
        // progress freezing after completing their second lap.
        const lap=Math.floor(progress/length);
        for(const offset of [(lap-1)*length,lap*length,
                             (lap+1)*length]){
            for(let i=1;i<points.length;i++){
                const start=measurements[i-1]+offset,
                      end=measurements[i]+offset;
                if(end<progress-9||start>progress+17)continue;
                const a=points[i-1],b=points[i],
                    dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
                if(den<1e-9)continue;
                const t=Math.max(0,Math.min(1,
                    ((x-a.x)*dx+(z-a.z)*dz)/den));
                const p=start+t*(end-start);
                const distance=Math.hypot(x-(a.x+dx*t),z-(a.z+dz*t));
                if(!best||distance<best.distance)
                    best={distance,progress:p};
            }
        }
        return best;
    }
    static routeFor(car,city){
        const loop=this.getLoop(city,car?.chicagoNeighborhoodTrafficId);
        if(!loop||car.scriptedDrive||car.isPolice||car.isTarget||
            car.isMafia||car.isSecret)return null;
        if(!car.chicagoNeighborhoodTrafficRoute ||
            car.chicagoNeighborhoodTrafficRoute.loop!==loop){
            const reverse=!!car.chicagoNeighborhoodTrafficReverse;
            const points=this.points(loop,reverse);
            if(!points)return null;
            car.chicagoNeighborhoodTrafficRoute={
                loop,points,measurements:this.measurements(points),
                progress:car.chicagoNeighborhoodTrafficPhase||0,
                maxOffset:0,laps:0,updates:0,stuckSeconds:0
            };
        }
        return car.chicagoNeighborhoodTrafficRoute;
    }
    static getInput(city,car,vehicles){
        const route=this.routeFor(car,city);
        if(!route)return null;
        const points=route.points,m=route.measurements,
            length=m.at(-1);
        const nearest=this.project(points,m,car.x,car.z,route.progress);
        if(nearest)route.progress=Math.max(route.progress,
            Math.min(route.progress+3,nearest.progress));
        route.laps=Math.floor(route.progress/length);
        route.maxOffset=Math.max(route.maxOffset,nearest?.distance||0);
        route.updates++;
        const progress=route.progress;
        const pBehind=this.sample(points,m,progress-6),
              pNear=this.sample(points,m,progress+3),
              pAhead=this.sample(points,m,progress+15);
        const headA=Math.atan2(pNear.x-pBehind.x,pNear.z-pBehind.z),
              headB=Math.atan2(pAhead.x-pNear.x,pAhead.z-pNear.z);
        const turn=Math.abs(Math.atan2(
            Math.sin(headB-headA),Math.cos(headB-headA)));
        const target=this.sample(points,m,progress+(turn>.18?11.5:6.2));
        const desired=Math.atan2(target.x-car.x,target.z-car.z);
        const delta=Math.atan2(
            Math.sin(desired-car.heading),Math.cos(desired-car.heading));
        let limit=turn>.18||Math.abs(delta)>.2?2.7:4.3;
        // Simple car-following preserves shared R41/R42 intersections
        // without permitting scripted cars or emergency vehicles here.
        const fx=Math.sin(car.heading),fz=Math.cos(car.heading);
        for(const other of vehicles||[]){
            if(other===car||other.missionParked||
                Math.abs((other.y||0)-(car.y||0))>3.2)continue;
            const dx=other.x-car.x,dz=other.z-car.z,
                forward=dx*fx+dz*fz,
                lateral=Math.abs(dx*fz-dz*fx);
            if(forward>0&&forward<14&&lateral<3.3){
                limit=Math.min(limit,forward<6.5?0:
                    Math.max(1.8,(forward-6.5)*.7));
            }
        }
        route.stalled=!!(limit===0&&car.speed<.6);
        car.chicagoNeighborhoodTrafficStatus={
            id:car.chicagoNeighborhoodTrafficId,
            progress:+progress.toFixed(2),laps:route.laps,
            maxOffset:+route.maxOffset.toFixed(3),
            steer:delta,limit,
            updates:route.updates
        };
        return {up:car.speed<limit-.12,
            down:car.speed>limit+.12 || limit===0&&car.speed>.5,
            left:delta<-.035,right:delta>.035,
            handbrake:false,sprint:false};
    }
    static spawnSpecs(city,vehicles=[]){
        if(city?.preset?.id!=='chicago')return [];
        // One modest sedan per block; maintain generous initial separation.
        const specs=[
            {id:'r43',distance:24,reverse:false,
                name:'SEDÃ CHICAGO QUADRA LESTE',color:0x8d9eaf},
            // Both circuits travel southbound on their shared R42 lane.
            // Opposite directions created a head-on deadlock at z≈850.
            {id:'r44',distance:107,reverse:false,
                name:'COUPÉ CHICAGO QUADRA OESTE',color:0xb9a282}
        ];
        const result=[];
        for(const spec of specs){
            const loop=this.getLoop(city,spec.id);
            const points=this.points(loop,spec.reverse);
            if(!points)continue;
            const m=this.measurements(points);
            const center=this.sample(points,m,spec.distance),
                before=this.sample(points,m,spec.distance-2),
                ahead=this.sample(points,m,spec.distance+2);
            const heading=Math.atan2(ahead.x-before.x,ahead.z-before.z);
            if(city.isWaterAt(center.x,center.z)||
                city.isPointBlocked(center.x,center.z,1.8,0))continue;
            if([...vehicles,...result].some(other=>
                Math.hypot(other.x-center.x,other.z-center.z)<18))continue;
            result.push({...spec,x:center.x,z:center.z,
                heading,maxSpeed:12,accel:10,bodyStyle:'sedan'});
        }
        return result;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoNeighborhoodTraffic;
