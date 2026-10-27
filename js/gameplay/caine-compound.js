/**
 * Chicago 07 — Caine's Compound
 * Recriação de missão: fugir do depósito, entrar em carro, evitar vans e
 * atravessar a ponte antes que ela levante. Layout adaptado ao mundo aberto.
 */
class DriverCaineCompound {
    static BRIDGE={x:0,z:80,radius:14};
    static START={x:200,z:-178};
    static CAR={x:240,z:-160};
    static BRIDGE_SECONDS=19;
    constructor(){this.reset();}
    reset(){
        this.phase='warehouse';
        this.bridgeSeconds=0;
        this.bridgeClosing=false;
        this.bridgeClosed=false;
        this.vansActivated=false;
        this.completed=false;
    }
    static crossedBridge(pos,mode='driving'){
        return mode==='driving' && !!pos &&
            Math.abs(pos.x-this.BRIDGE.x)<=this.BRIDGE.radius &&
            pos.z>=this.BRIDGE.z &&
            pos.z<=this.BRIDGE.z+34;
    }
    static nearBridge(pos){
        return !!pos && Math.abs(pos.x)<65 && pos.z>=-75 && pos.z<91;
    }
    update(dt,state){
        const step=Math.max(0,Math.min(0.05,Number(dt)||0));
        const pos=state?.position||null;
        const mode=state?.mode||'on_foot';
        const inside=state?.interiorId||null;
        const previous=this.phase;
        if(this.phase==='warehouse' && inside!=='warehouse')
            this.phase='find_car';
        if(this.phase==='find_car'&&mode==='driving'){
            this.phase='escape';
            this.vansActivated=true;
        }
        // Quando Tanner entra na região da ponte, começa a contagem.
        if(this.phase==='escape' && DriverCaineCompound.nearBridge(pos)){
            this.phase='bridge';
            this.bridgeClosing=true;
        }
        if(this.phase==='bridge' && !this.bridgeClosed){
            if(DriverCaineCompound.crossedBridge(pos,mode)){
                this.completed=true;
                this.phase='done';
            }else{
                this.bridgeSeconds=Math.min(
                    DriverCaineCompound.BRIDGE_SECONDS,this.bridgeSeconds+step);
                if(this.bridgeSeconds>=DriverCaineCompound.BRIDGE_SECONDS-1e-6){
                    this.bridgeSeconds=DriverCaineCompound.BRIDGE_SECONDS;
                    this.bridgeClosed=true;
                }
            }
        }
        const failed=this.bridgeClosed&&!this.completed?'bridge_closed':null;
        let label='SAIA DO GALPÃO PELA PORTA';
        if(this.phase==='find_car')label='PEGUE UM CARRO NO PÁTIO (E)';
        if(this.phase==='escape')label='FUJA DAS VANS E SIGA PARA A PONTE';
        if(this.phase==='bridge')label='PONTE LEVADIÇA: '+
            Math.ceil(DriverCaineCompound.BRIDGE_SECONDS-this.bridgeSeconds)+'s';
        if(this.phase==='done')label='COMPLEXO DE CAINE SUPERADO!';
        return {
            phase:this.phase,changed:previous!==this.phase,label,
            bridgeSeconds:this.bridgeSeconds,
            bridgeRemaining:Math.max(0,
                DriverCaineCompound.BRIDGE_SECONDS-this.bridgeSeconds),
            bridgeClosing:this.bridgeClosing,bridgeClosed:this.bridgeClosed,
            activateVans:this.vansActivated,completed:this.completed,failed,
            destination:DriverCaineCompound.BRIDGE
        };
    }
    export(){
        return {
            phase:this.phase,bridgeSeconds:this.bridgeSeconds,
            bridgeClosing:this.bridgeClosing,bridgeClosed:this.bridgeClosed,
            vansActivated:this.vansActivated,completed:this.completed
        };
    }
    restore(data){
        this.reset();
        const phases=['warehouse','find_car','escape','bridge','done'];
        this.phase=phases.includes(data?.phase)?data.phase:'warehouse';
        const t=Number(data?.bridgeSeconds);
        this.bridgeSeconds=Number.isFinite(t)?
            Math.max(0,Math.min(t,DriverCaineCompound.BRIDGE_SECONDS)):0;
        this.bridgeClosing=!!data?.bridgeClosing;
        this.bridgeClosed=!!data?.bridgeClosed ||
            this.bridgeSeconds>=DriverCaineCompound.BRIDGE_SECONDS;
        this.vansActivated=!!data?.vansActivated;
        this.completed=!!data?.completed;
        if(this.completed){this.phase='done';this.bridgeClosed=false;}
    }
}
