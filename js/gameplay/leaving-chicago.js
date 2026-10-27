/**
 * Chicago 08 — Leaving Chicago.
 * Objetivo: alcançar a estação Randolph na chuva e encontrar Jones.
 * Ajuste de coordenadas ao mapa procedural (não extraído do jogo PS1).
 */
class DriverLeavingChicago {
    static START=Object.freeze({x:-240,z:160,heading:Math.PI});
    static STATION=Object.freeze({x:0,z:-240,radius:18});
    static LIMIT=210;
    static STOP_SPEED=9;
    static CONTACT_SECONDS=.65;
    constructor(){this.reset();}
    reset(){
        this.phase='drive';
        this.arrivalSeconds=0;
        this.completed=false;
        this.failed=null;
    }
    static distance(pos) {
        if(!pos)return Infinity;
        return Math.hypot(pos.x-this.STATION.x,pos.z-this.STATION.z);
    }
    static insideStation(pos) {
        return this.distance(pos)<=this.STATION.radius;
    }
    update(dt,state={}) {
        const seconds=Math.max(0,Math.min(.05,Number(dt)||0));
        const pos=state.position||null;
        const speed=Math.abs(Number(state.speed)||0);
        const timeLeft=Number.isFinite(state.timeLeft)?state.timeLeft:Infinity;
        const dist=DriverLeavingChicago.distance(pos);
        const atStation=DriverLeavingChicago.insideStation(pos);
        const stopped=speed<=DriverLeavingChicago.STOP_SPEED;
        if(this.completed||this.failed){
            return this.snapshot(dist);
        }
        if((Number(state.damage)||0)>=100) this.failed='destroyed';
        else if(timeLeft<=0)this.failed='timeout';
        else if(atStation&&state.mode==='driving'&&stopped){
            this.arrivalSeconds=Math.min(
                DriverLeavingChicago.CONTACT_SECONDS,this.arrivalSeconds+seconds
            );
            this.phase='reunion';
            if(this.arrivalSeconds>=DriverLeavingChicago.CONTACT_SECONDS-1e-6){
                this.arrivalSeconds=DriverLeavingChicago.CONTACT_SECONDS;
                this.phase='done';
                this.completed=true;
            }
        }else{
            this.phase='drive';
            this.arrivalSeconds=0;
        }
        return this.snapshot(dist);
    }
    snapshot(dist=Infinity){
        const stage=this.phase;
        return {
            phase:stage,completed:this.completed,failed:this.failed,
            distance:dist,
            arrivalSeconds:this.arrivalSeconds,
            progress:this.arrivalSeconds/DriverLeavingChicago.CONTACT_SECONDS,
            message:this.failed==='destroyed'?'CARRO DESTRUÍDO':
                this.failed==='timeout'?'TREM PERDIDO':
                stage==='done'?'JONES ENCONTRADO • CAPÍTULO CHICAGO CONCLUÍDO':
                stage==='reunion'?'AGUARDE JONES NA ESTAÇÃO':
                'RANDOLPH STREET STATION: '+Math.round(dist)+'m • PARE NO MARCADOR'
        };
    }
    export(){
        return {
            phase:this.phase,
            arrivalSeconds:this.arrivalSeconds,
            completed:this.completed
        };
    }
    restore(data){
        this.reset();
        const n=Number(data?.arrivalSeconds);
        this.arrivalSeconds=Number.isFinite(n)?
            Math.max(0,Math.min(DriverLeavingChicago.CONTACT_SECONDS,n)):0;
        this.completed=!!data?.completed;
        this.phase=this.completed?'done':
            data?.phase==='reunion'?'reunion':'drive';
        if(this.completed)this.arrivalSeconds=DriverLeavingChicago.CONTACT_SECONDS;
    }
}
