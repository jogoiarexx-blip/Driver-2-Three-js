/**
 * Streaming de detalhe por bairro. Colisões permanecem independentes da LOD.
 * Cada bairro conserva silhuetas leves distantes; as malhas texturizadas e
 * cornijas só são criadas na primeira aproximação e depois reutilizadas.
 * Orçamento de alterações por frame e histerese evitam travamentos/piscadas.
 */
class DriverDistrictLOD {
    constructor({nearRadius=165,farRadius=230,chunkHalfSize=80,maxSwitches=2}={}) {
        if(!(nearRadius>0 && farRadius>nearRadius))
            throw new Error('Faixas de LOD inválidas');
        this.nearRadius=nearRadius;
        this.farRadius=farRadius;
        this.chunkHalfSize=chunkHalfSize;
        this.maxSwitches=maxSwitches;
        this.entries=[];
        this.totalBuilt=0;
        this.lastFocus=null;
    }
    register({id,x,z,far,buildNear}) {
        if(!far || typeof buildNear!=='function')
            throw new Error('Bairro sem silhueta ou construtor');
        const entry={id,x,z,far,buildNear,near:null,level:'far',
            failed:false,buildCount:0};
        far.visible=true;
        this.entries.push(entry);
        return entry;
    }
    distance(entry,focus) {
        const dx=Math.max(0,Math.abs(focus.x-entry.x)-this.chunkHalfSize);
        const dz=Math.max(0,Math.abs(focus.z-entry.z)-this.chunkHalfSize);
        return Math.hypot(dx,dz);
    }
    update(focus,{force=false,maxSwitches=this.maxSwitches}={}) {
        if(!focus || !Number.isFinite(focus.x) || !Number.isFinite(focus.z))
            return this.stats(0);
        this.lastFocus={x:focus.x,z:focus.z};
        const switches=[];
        for(const entry of this.entries){
            const d=this.distance(entry,focus);
            const target=entry.level==='near'?
                (d>this.farRadius?'far':'near'):
                (d<this.nearRadius?'near':'far');
            if(target!==entry.level)switches.push({entry,target,d});
        }
        // Carregar primeiro os detalhes próximos; descarregar primeiro os
        // distantes. Mantém o trajeto do player sem malhas invisíveis.
        switches.sort((a,b)=>{
            if(a.target!==b.target)return a.target==='near'?-1:1;
            return a.target==='near'?a.d-b.d:b.d-a.d;
        });
        let changed=0;
        const cap=force?Infinity:Math.max(0,Math.floor(maxSwitches));
        for(const task of switches){
            if(changed>=cap)break;
            const {entry,target}=task;
            if(target==='near'){
                if(entry.failed)continue;
                if(!entry.near){
                    try {
                        const near=entry.buildNear();
                        if(!near)throw new Error('Construtor de LOD vazio');
                        entry.near=near;
                        entry.buildCount++;
                        this.totalBuilt++;
                    }catch(err){
                        entry.failed=true;
                        // Em falha mantemos o cenário distante visível.
                        continue;
                    }
                }
                entry.near.visible=true;
                entry.far.visible=false;
                entry.level='near';
            }else{
                if(entry.near)entry.near.visible=false;
                entry.far.visible=true;
                entry.level='far';
            }
            changed++;
        }
        return this.stats(changed);
    }
    stats(switched=0) {
        const near=this.entries.filter(e=>e.level==='near').length;
        return {total:this.entries.length,near,far:this.entries.length-near,
            built:this.totalBuilt,switched,
            failed:this.entries.filter(e=>e.failed).length};
    }
}
