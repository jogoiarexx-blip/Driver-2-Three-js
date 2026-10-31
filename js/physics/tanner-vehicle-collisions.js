/** Contato leve entre Tanner a pé e os veículos, sem raycasts por quadro. */
class DriverTannerVehicleCollisions {
    static resolve(tanner, vehicles, city, previous, vehiclePositions) {
        const p=tanner.group.position;
        let hits=0;
        for(const car of vehicles) {
            if(!Number.isFinite(car.x)||!Number.isFinite(car.z) ||
                Math.abs((car.y||0)-(p.y||0))>2.2 || car.isSubmerged) continue;
            const old=vehiclePositions.get(car)||{x:car.x,z:car.z};
            // Mudanças bruscas de posição não representam movimento físico.
            if(Math.hypot(car.x-old.x,car.z-old.z)>8) continue;
            const h=Number(car.heading)||0, c=Math.cos(h), s=Math.sin(h);
            const local=(x,z,cx,cz)=>({x:(x-cx)*c-(z-cz)*s,
                z:(x-cx)*s+(z-cz)*c});
            const a=local(previous.x,previous.z,old.x,old.z);
            const b=local(p.x,p.z,car.x,car.z);
            const dim=DriverVehicleCollisions.dimensions(car);
            const half={x:dim.width/2+.48,z:dim.length/2+.48};
            let enter=0,exit=1,axis=null,sign=0;
            for(const key of ['x','z']) {
                const d=b[key]-a[key], limit=half[key];
                if(Math.abs(d)<1e-9) {
                    if(Math.abs(a[key])>=limit) { exit=-1; break; }
                    continue;
                }
                const t1=(-limit-a[key])/d,t2=(limit-a[key])/d;
                const near=Math.min(t1,t2),far=Math.max(t1,t2);
                if(near>enter){enter=near;axis=key;sign=d>0?-1:1;}
                exit=Math.min(exit,far);
            }
            if(exit<enter || exit<0 || enter>1) continue;
            if(!axis) {
                // Se já havia sobreposição, sair pela face mais próxima.
                const dx=half.x-Math.abs(a.x),dz=half.z-Math.abs(a.z);
                axis=dx<dz?'x':'z'; sign=a[axis]>=0?1:-1;
                // Deixar a pessoa sair da área já sobreposta; não deixar
                // atravessar para a face oposta no mesmo quadro.
                if(Math.abs(b.x)>half.x||Math.abs(b.z)>half.z) {
                    if(b[axis]*sign>=half[axis] ||
                        (axis==='x' && Math.abs(b.z)>half.z) ||
                        (axis==='z' && Math.abs(b.x)>half.x))continue;
                }
            }
            const target={x:b.x,z:b.z};
            target[axis]=sign*(half[axis]+.02);
            const x=car.x+target.x*c+target.z*s;
            const z=car.z-target.x*s+target.z*c;
            const carMoved=Math.hypot(car.x-old.x,car.z-old.z)>.01;
            if(!city?.isPointBlocked?.(x,z,.45,p.y||0)) {
                p.x=x;p.z=z;
            } else {
                // Em um canto, não empurrar Tanner através de edifícios.
                p.x=previous.x;p.z=previous.z;
                car.x=old.x;car.z=old.z;
                car.updateTransform?.();
            }
            if(carMoved)car.speed*=.55;
            hits++;
        }
        return hits;
    }
}
