/**
 * Fluxo contínuo de campanha Driver 2: entrada por marcador, progressão
 * em ordem e conclusão sem bloquear a cidade. Sem WebGL/DOM acoplado.
 */
class DriverCampaignFlow {
    static CHICAGO=[
        'story_tipoff','story_witness','story_train','story_drop',
        'story_safehouse','story_intruder','story_caine','story_leaving'
    ];
    static VEGAS=[
        'story_vegas_ambulance','story_vegas_c4','story_vegas_heist'
    ];
    static RIO=[
        'story_rio_barge','story_rio_jericho','story_rio_helicopter'
    ];
    static next(chapter,completed){
        if(chapter==='vegas'||chapter==='rio'){
            for(const type of (chapter==='vegas'?this.VEGAS:this.RIO))
                if(!completed?.has(type))return type;
            return null;
        }
        if(chapter==='havana')return completed?.has('story_havana_lead')?
            null:'story_havana_lead';
        for(const type of this.CHICAGO)
            if(!completed?.has(type))return type;
        return null;
    }
    static isFailure(title){
        return /FALH|ESGOTAD|DESTRUÍDO|ESCAPOU|ATINGIDO|PONTE FECHOU|FIM DO SURVIVAL|TEMPO ESGOTADO/i.test(String(title));
    }
    static summarize(title,description,failed,next){
        return {
            kind:failed?'failure':'success',
            message:(failed?'MISSÃO FALHOU • ':'MISSÃO CONCLUÍDA • ')+
                String(title||'').replace(/\s*CONCLUÍDA!?/gi,'').trim(),
            description:String(description||''),
            next:failed?'Retorne ao marcador para tentar novamente':
                next?'Próxima missão disponível no marcador verde (J)':
                'Explore a cidade ou escolha outro modo pelo MENU'
        };
    }
}
