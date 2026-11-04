/**
 * Driver 2 R86 — narrative glue for the REAL playable mission directors.
 *
 * Provides coherent chapter intro / phase cues / outcomes for the existing
 * Chicago (8), Havana (1), Vegas (3), Rio (3) missions. It observes mission
 * state; it NEVER completes objectives, advances timers or moves actors.
 * Text and stages are for this fan-made adaptation, not PS1 source claims.
 *
 * Cues are lightweight DOM text overlays, not pre-rendered movies.
 */
class DriverCampaignScenesR86 {
    static ACTS={
        chicago:{chapter:'ATO I • CHICAGO',
            trail:'Jones → testemunha → trem → entrega → refúgio → invasor → Caine → partida'},
        havana:{chapter:'ATO II • HAVANA',
            trail:'Seguir o intermediário até o encontro nos cais'},
        vegas:{chapter:'ATO III • LAS VEGAS',
            trail:'Resgate → sabotagem → veículos do roubo'},
        rio:{chapter:'ATO IV • RIO DE JANEIRO',
            trail:'Barca → capangas → helicóptero'}
    };
    static STORIES={
        story_tipoff:{
            title:'01 • VIGILÂNCIA',
            setup:'A pista inicial leva Tanner até Jones.',
            goal:'Localize o carro de Jones e faça contato.'},
        story_witness:{
            title:'02 • TESTEMUNHA',
            setup:'A próxima pista depende de uma testemunha em fuga.',
            goal:'Acompanhe o sedã sem perder o alvo.'},
        story_train:{
            title:'03 • PERSEGUIÇÃO AO TREM',
            setup:'A investigação continua na linha elevada.',
            goal:'Acompanhe o trem e alcance a estação.'},
        story_drop:{
            title:'04 • ENTREGA SUSPEITA',
            setup:'O sedã vermelho pode revelar o ponto de entrega.',
            goal:'Siga a distância segura até o depósito.'},
        story_safehouse:{
            title:'05 • CASA SEGURA',
            setup:'A polícia está no encalço de Tanner.',
            goal:'Desapareça do campo de visão e alcance o refúgio.'},
        story_intruder:{
            title:'06 • O INVASOR',
            setup:'Uma nova perseguição conduz ao setor industrial.',
            goal:'Siga o intruso e prepare-se para a armadilha.'},
        story_caine:{
            title:'07 • DEPÓSITO DE CAINE',
            setup:'A fuga exige sair do depósito e vencer o bloqueio.',
            goal:'Encontre o carro de fuga e cruze a ponte.'},
        story_leaving:{
            title:'08 • DEIXANDO CHICAGO',
            setup:'O encontro na estação é a última etapa da cidade.',
            goal:'Atravesse Chicago e encontre Jones a tempo.'},
        story_havana_lead:{
            title:'09 • PISTA EM HAVANA',
            setup:'A investigação recomeça com um intermediário.',
            goal:'Siga o sedã verde sem alertá-lo até os cais.'},
        story_vegas_ambulance:{
            title:'10 • AMBULÂNCIA',
            setup:'A primeira operação em Vegas é um resgate.',
            goal:'Assuma a ambulância e leve o ferido ao abrigo.'},
        story_vegas_c4:{
            title:'11 • EXPLOSIVOS',
            setup:'A operação seguinte exige sabotar os geradores.',
            goal:'Plante três cargas e saia do alcance da explosão.'},
        story_vegas_heist:{
            title:'12 • ROUBO DE VEÍCULOS',
            setup:'Duas entregas são necessárias para concluir o golpe.',
            goal:'Leve o carro-forte e a limusine ao abrigo.'},
        story_rio_barge:{
            title:'13 • A BARCA',
            setup:'As pistas chegam a uma embarcação nos cais.',
            goal:'Plante o C4 e afaste-se antes da detonação.'},
        story_rio_jericho:{
            title:'14 • CAPANGAS DE JERICHO',
            setup:'O sedã dos capangas precisa ser interceptado.',
            goal:'Persiga e detenha o veículo-alvo.'},
        story_rio_helicopter:{
            title:'15 • LENNY EM FUGA',
            setup:'A última pista passa pelo helicóptero.',
            goal:'Siga a aeronave até a região do Corcovado.'}
    };
    static city(type){
        if(/^story_vegas_/.test(type))return 'vegas';
        if(/^story_rio_/.test(type))return 'rio';
        if(type==='story_havana_lead')return 'havana';
        if(/^story_/.test(type))return 'chicago';
        return null;
    }
    static script(type){
        const entry=this.STORIES[type];
        if(!entry)return null;
        const city=this.city(type),act=this.ACTS[city];
        return {type,city,chapter:act.chapter,title:entry.title,
            setup:entry.setup,goal:entry.goal,trail:act.trail};
    }
    static step(game){
        if(!game?.missionActive)return null;
        const story=this.script(game.missionType);
        if(!story||game.currentCityKey!==story.city)return null;
        const id=story.type,s=game.regionalState||{};
        let phase='start',label=story.goal,hint=story.setup;
        if(story.city==='chicago' &&
            typeof DriverChicagoMissionGuidance!=='undefined'){
            const shot=game.chicagoGuidance||
                DriverChicagoMissionGuidance.snapshot(game);
            if(shot){
                phase=shot.id||'start';
                label=shot.label||label;
                hint=shot.hint||hint;
            }
        }else if(id==='story_havana_lead'){
            phase=game.havanaLeadStatus?.phase||
                game.havanaLeadDirector?.phase||'follow';
            label=phase==='meet'?'ENCONTRO NOS CAIS':
                'SIGA O INTERMEDIÁRIO';
            hint=phase==='meet'?
                'Confirme o encontro sem perder a distância segura.':
                'Mantenha 16 a 125m do sedã verde.';
        }else if(id==='story_vegas_ambulance'){
            phase=game.playerCar===game.targetCar?
                'deliver':'take';
            label=phase==='deliver'?'LEVE A AMBULÂNCIA AO ABRIGO':
                'ASSUMA A AMBULÂNCIA';
            hint=phase==='deliver'?
                'Pare dentro da área do refúgio.':
                'Aproxime-se do veículo e pressione E.';
        }else if(id==='story_vegas_heist'){
            phase='vehicle-'+Math.min(2,Math.max(0,s.delivered||0));
            label=s.delivered?'ENTREGUE A LIMUSINE':
                'ENTREGUE O CARRO-FORTE';
            hint='Duas entregas diferentes encerram a missão.';
        }else if(id==='story_vegas_c4'||
            id==='story_rio_barge'){
            phase=s.countdown>0?'escape':
                'charge-'+Math.max(0,s.phase||0);
            label=s.countdown>0?'AFASTE-SE DA DETONAÇÃO':
                'PLANTE A PRÓXIMA CARGA';
            hint=s.countdown>0?
                'Mantenha ao menos 65m do alvo.':
                'Saia do veículo e use E junto ao marcador.';
        }else if(id==='story_rio_jericho'){
            phase=(game.targetCar?.damage||0)>=50?
                'intercept':'chase';
            label=phase==='intercept'?'INTERCEPTE O SEDÃ DANIFICADO':
                'PERSEGUIÇÃO A JERICHO';
            hint='Detenha o carro dos capangas.';
        }else if(id==='story_rio_helicopter'){
            const index=Math.max(0,s.heliIndex||0);
            phase=index>=4?'final':index>=2?'middle':'pursue';
            label=phase==='final'?'ALCANCE O CORCOVADO':
                'ACOMPANHE O HELICÓPTERO';
            hint='Mantenha a aeronave ao alcance até o destino.';
        }
        return {...story,phase,label,hint,
            key:id+':'+phase};
    }
    constructor(){
        this.activeType=null;
        this.stageKey=null;
        this.visibleFor=0;
        this.element=null;
        this.lastResult=null;
    }
    ensure(){
        if(this.element||typeof document==='undefined')return;
        const el=document.createElement('div');
        el.id='driver-campaign-scene-r86';
        el.setAttribute('aria-live','polite');
        el.setAttribute('aria-hidden','true');
        el.style.cssText='position:fixed;z-index:29;'+
            'top:clamp(90px,13vh,138px);left:50%;'+
            'transform:translateX(-50%);max-width:min(92vw,570px);'+
            'width:max-content;padding:10px 17px;'+
            'border:1px solid rgba(250,204,21,.65);'+
            'border-radius:8px;background:rgba(9,17,30,.92);'+
            'color:#f8fafc;text-align:center;'+
            'font:600 clamp(11px,1.6vw,15px) Inter,Arial,sans-serif;'+
            'line-height:1.5;letter-spacing:.04em;'+
            'text-shadow:0 1px 2px #000;'+
            'box-shadow:0 8px 32px #0009;'+
            'pointer-events:none;display:none';
        document.body.appendChild(el);
        this.element=el;
    }
    show(title,subtitle,seconds=3.2,failed=false){
        this.ensure();
        this.visibleFor=Math.max(.1,seconds);
        if(!this.element)return;
        this.element.textContent=String(title||'')+
            (subtitle?' • '+String(subtitle):'');
        this.element.style.borderColor=failed?
            'rgba(251,113,133,.8)':'rgba(250,204,21,.65)';
        this.element.style.display='block';
        this.element.setAttribute('aria-hidden','false');
    }
    hide(){
        this.visibleFor=0;
        if(this.element){
            this.element.style.display='none';
            this.element.setAttribute('aria-hidden','true');
        }
    }
    begin(game,type){
        this.activeType=this.script(type)?type:null;
        this.stageKey=null;
        this.lastResult=null;
        this.hide();
        return this.script(type);
    }
    observe(game,dt=0){
        const rawDt=Math.max(0,Math.min(1,Number(dt)||0));
        const step=DriverCampaignScenesR86.step(game);
        if(this.activeType&&step&&step.type===this.activeType &&
            !game.briefingDirector?.active){
            if(step.key!==this.stageKey){
                this.stageKey=step.key;
                // Stage identity is based on the REAL director phase;
                // timers/distances do not cause a new card every frame.
                this.show(step.label,step.hint,
                    this.lastResult?2.4:3.0);
            }
        }
        if(this.visibleFor>0){
            this.visibleFor=Math.max(0,this.visibleFor-rawDt);
            if(this.visibleFor===0)this.hide();
        }
    }
    finish(game,type,failed,nextChapter){
        const story=this.script(type);
        if(!story)return;
        const follow=nextChapter?
            'PRÓXIMO ATO: '+this.ACTS[nextChapter]?.chapter:
            failed?'TENTE NOVAMENTE NO MARCADOR DA MISSÃO':
                'PRÓXIMA MISSÃO LIBERADA NO MARCADOR';
        this.lastResult={type,failed:!!failed};
        this.stageKey=null;
        this.activeType=null;
        this.show(failed?'MISSÃO NÃO CONCLUÍDA':'ETAPA CONCLUÍDA',
            story.title+' • '+follow,4,failed);
    }
    cancel(){
        this.activeType=null;this.stageKey=null;
        this.lastResult=null;this.hide();
    }
}
if(typeof window!=='undefined')
    window.DriverCampaignScenesR86=DriverCampaignScenesR86;
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverCampaignScenesR86;
