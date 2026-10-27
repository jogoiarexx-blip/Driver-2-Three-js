/**
 * Checkpoint da campanha, independente do save manual na casa de Tanner.
 * Libera Havana ao concluir Chicago 08, sem sobrescrever o carro/posição
 * preservados pelo jogador em DriverHomeSave.
 */
class DriverChapterProgress {
    static KEY='driver2-three-chapter-v1';
    static VERSION=1;

    constructor(storage) {
        this.storage=storage;
        this.chicagoComplete=false;
        this.havana09Complete=false;
        this.read();
    }
    read() {
        try {
            const raw=this.storage?.getItem(DriverChapterProgress.KEY);
            if(!raw || raw.length>2048)return false;
            const data=JSON.parse(raw);
            const compatible=data?.version===DriverChapterProgress.VERSION;
            this.chicagoComplete=compatible && data.chicago08===true;
            this.havana09Complete=this.chicagoComplete && data.havana09===true;
            return this.chicagoComplete;
        } catch (e) { return false; }
    }
    save() {
        try {
            if(!this.storage)return false;
            this.storage.setItem(DriverChapterProgress.KEY,JSON.stringify({
                version:DriverChapterProgress.VERSION,
                chicago08:this.chicagoComplete,
                havana09:this.havana09Complete
            }));
            return true;
        } catch (e) { return false; }
    }
    unlockHavana() {
        if(this.chicagoComplete)return true;
        this.chicagoComplete=true;
        return this.save();
    }
    canTravelToHavana() { return this.chicagoComplete; }
    completeHavanaLead() {
        if(!this.chicagoComplete)return false;
        if(this.havana09Complete)return true;
        this.havana09Complete=true;
        return this.save();
    }
    hasCompletedHavanaLead(){return this.havana09Complete;}
}
