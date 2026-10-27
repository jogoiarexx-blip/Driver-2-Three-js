/**
 * Bloqueios policiais móveis, independentes de missões especiais.
 * Spawn em posição calculada na via do jogador, com intervalo e limpeza,
 * sem mudar as barricadas fixas do modo Fura-Bloqueios.
 */
class PoliceRoadblockDirector {
    constructor() { this.reset(); }
    reset() {
        this.cooldown = 4;
        this.age = 0;
        this.active = false;
        this.lastCenter = null;
        this.wave = 0;
    }
    candidate(car, city, vehicles = []) {
        const sx = Math.sin(car.heading), sz = Math.cos(car.heading);
        const axis = Math.abs(sx) > Math.abs(sz) ? 'x' : 'z';
        const component = axis === 'x' ? sx : sz;
        const sign = component >= 0 ? 1 : -1;
        const road = THREE.MathUtils.clamp(
            Math.round((axis === 'x' ? car.z : car.x) / 80) * 80,
            -(city.roadExtent||320),city.roadExtent||320);
        for (const dist of [90,125,165]) {
            const advance = axis === 'x' ? car.x : car.z;
            let ahead = Math.round((advance + sign * dist) / 40) * 40;
            if (Math.abs(ahead) > (city.roadExtent||320)+34) continue;
            const point = axis === 'x' ?
                { x:ahead, z:road, axis } :
                { x:road, z:ahead, axis };
            const distance = Math.hypot(point.x-car.x,point.z-car.z);
            const forward = (point.x-car.x)*sx+(point.z-car.z)*sz;
            if (distance < 65 || forward < 56) continue;
            // Evita colocar cavaletes dentro de prédios ou sobre o canal.
            if (point.z > 34 && point.z < 66 && Math.abs(point.x) > 11) continue;
            const offsets=[-4,0,4];
            const valid=offsets.every(offset=> {
                const x=point.x+(axis==='z'?offset:0);
                const z=point.z+(axis==='x'?offset:0);
                return !city.isPointBlocked(x,z,1.1) &&
                    !vehicles.some(other => Math.hypot(other.x-x,other.z-z)<9);
            });
            if (valid && (!this.lastCenter ||
                Math.hypot(point.x-this.lastCenter.x,point.z-this.lastCenter.z)>35)) {
                return point;
            }
        }
        return null;
    }
    update(dt,game) {
        const ped=game.pedManager;
        if (game.missionType==='gauntlet') return; // protege o objetivo 5/5.
        const active=game.mode==='driving' && !!game.playerCar && game.felony >= 70;
        this.cooldown=Math.max(0,this.cooldown-dt);
        if (this.active) {
            this.age+=dt;
            const remaining=ped.roadblocks.filter(block=>block.dynamic && !block.smashed);
            const position=game.getPlayerPosition();
            const distance=this.lastCenter?
                Math.hypot(position.x-this.lastCenter.x,position.z-this.lastCenter.z):0;
            if (!active || this.age>26 || distance>180 || !remaining.length) {
                ped.clearDynamicRoadblocks();
                this.active=false;
                this.cooldown=Math.max(this.cooldown,8);
            }
        }
        if (!active || this.active || this.cooldown>0) return;
        const point=this.candidate(game.playerCar,game.city,game.vehicles || []);
        if (!point) { this.cooldown=4; return; }
        ped.spawnPoliceRoadblocks(game.city.preset,{dynamic:true,locations:[point]});
        this.lastCenter=point;
        this.age=0;
        this.active=true;
        this.wave++;
        this.cooldown=18;
    }

    // Dado de aviso puro; o HUD só exibe se o bloqueio está de fato à frente.
    warning(car, pedManager) {
        if (!this.active || !this.lastCenter || !car) return null;
        const blocks=pedManager?.roadblocks || [];
        const live=blocks.filter(b=>b.dynamic && !b.smashed);
        if (!live.length) return null;
        const dx=this.lastCenter.x-car.x, dz=this.lastCenter.z-car.z;
        const distance=Math.hypot(dx,dz);
        const forward=dx*Math.sin(car.heading)+dz*Math.cos(car.heading);
        if (distance>185 || forward<-9) return null;
        return {
            distance: Math.round(distance),
            arming: live.some(b=>(b.arming || 0)>0),
            x:this.lastCenter.x,z:this.lastCenter.z,
            axis:this.lastCenter.axis
        };
    }
}
