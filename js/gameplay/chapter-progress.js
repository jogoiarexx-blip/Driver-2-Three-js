/**
 * Checkpoint da campanha, independente do save manual na casa de Tanner.
 * Libera Havana ao concluir Chicago 08, sem sobrescrever o carro/posição
 * preservados pelo jogador em DriverHomeSave.
 */
class DriverChapterProgress {
    static KEY='driver2-three-chapter-v1';
    static VERSION=2;
    static REGIONAL=['story_vegas_ambulance','story_vegas_c4',
        'story_vegas_heist','story_rio_barge','story_rio_jericho',
        'story_rio_helicopter'];

    constructor(storage) {
        this.storage=storage;
        this.chicagoComplete=false;
        this.havana09Complete=false;
        this.regionalCompleted=new Set();
        this.read();
    }
    read() {
        try {
            const raw=this.storage?.getItem(DriverChapterProgress.KEY);
            if(!raw || raw.length>2048)return false;
            const data=JSON.parse(raw);
            // V1 contained Chicago/Havana only. Import both formats
            // without losing the existing save.
            const compatible=data?.version===1||
                data?.version===DriverChapterProgress.VERSION;
            this.chicagoComplete=compatible&&data.chicago08===true;
            this.havana09Complete=compatible&&data.havana09===true;
            this.regionalCompleted=new Set(
                compatible&&Array.isArray(data.regional)?
                    data.regional.filter(id=>
                        DriverChapterProgress.REGIONAL.includes(id)):[]
            );
            return compatible;
        } catch (e) { return false; }
    }
    save() {
        try {
            if(!this.storage)return false;
            this.storage.setItem(DriverChapterProgress.KEY,JSON.stringify({
                version:DriverChapterProgress.VERSION,
                chicago08:this.chicagoComplete,
                havana09:this.havana09Complete,
                regional:[...this.regionalCompleted]
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
    completeRegional(type){
        if(!DriverChapterProgress.REGIONAL.includes(type))return false;
        if(this.regionalCompleted.has(type))return true;
        this.regionalCompleted.add(type);
        return this.save();
    }
    hasCompletedRegional(type){
        return this.regionalCompleted.has(type);
    }
    isVegasComplete(){
        return ['story_vegas_ambulance','story_vegas_c4',
            'story_vegas_heist'].every(type=>this.regionalCompleted.has(type));
    }
    isRioComplete(){
        return ['story_rio_barge','story_rio_jericho',
            'story_rio_helicopter'].every(type=>this.regionalCompleted.has(type));
    }
    canTravelToVegas(){return this.havana09Complete;}
    canTravelToRio(){return this.isVegasComplete();}
}
