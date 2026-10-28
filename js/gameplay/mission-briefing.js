/**
 * Undercover opening: two seconds on a letter-spaced black title
 * card, followed by a three-second camera view of the live street.
 * No timers outside game loop, no mission timer or vehicle movement.
 */
class DriverMissionBriefing {
    constructor(){
        this.seconds=0;this.active=false;
        this.element=null;
    }
    ensure(){
        if(this.element||typeof document==='undefined')return;
        const overlay=document.createElement('div');
        overlay.id='driver-undercover-intro';
        overlay.setAttribute('aria-live','polite');
        overlay.style.cssText='position:fixed;inset:0;z-index:35;'+
            'background:#000;pointer-events:none;display:flex;'+
            'align-items:center;justify-content:center;'+
            'transition:background .5s ease;color:#f1f1ed;'+
            'font:600 clamp(14px,2.8vw,30px) Georgia,serif;'+
            'letter-spacing:.36em;text-align:center;padding:24px';
        overlay.setAttribute('aria-hidden','true');
        document.body.appendChild(overlay);
        this.element=overlay;
    }
    begin(game,type){
        if(!type?.startsWith('story_')||typeof document==='undefined')return;
        this.ensure();
        const title=document.getElementById('mission-title')?.textContent||
            type.replace(/_/g,' ').toUpperCase();
        this.seconds=0;this.active=true;
        // A vinheta usa a primeira etapa REAL, sem reescrever diretores.
        // A cena e os controles permanecem pausados durante a abertura.
        this.stageIntro=typeof DriverChicagoMissionGuidance!=='undefined'?
            (DriverChicagoMissionGuidance.snapshot(game)?.label||''):'';
        this.startedAt=typeof performance!=='undefined'?performance.now():null;
        this.element.textContent=title;
        this.element.style.display='flex';
        this.element.style.opacity='1';
        this.element.style.background='#000';
        this.element.setAttribute('aria-hidden','false');
    }
    tick(dt){
        if(!this.active)return false;
        this.seconds=this.startedAt!==null &&
            typeof performance!=='undefined'?
            Math.max(0,(performance.now()-this.startedAt)/1000):
            this.seconds+Math.max(0,Math.min(.2,Number(dt)||0));
        if(this.seconds>=5){
            this.active=false;
            if(this.element){
                this.element.style.display='none';
                this.element.setAttribute('aria-hidden','true');
            }
            return false;
        }
        if(this.element){
            if(this.seconds>2.05){
                this.element.style.background='rgba(0,0,0,0)';
                this.element.style.opacity=String(Math.min(.82,
                    Math.max(0,(5-this.seconds)/2)));
                // Keep the title briefly, then show street scene.
                // Mostra o primeiro objetivo por menos de 1 segundo
                // antes de liberar a cena, mantendo os 5s originais.
                this.element.textContent=this.seconds<3?
                    (this.stageIntro||this.element.dataset.originalTitle||
                        this.element.textContent):'';
            }else{
                this.element.style.background='#000';
                this.element.style.opacity='1';
                this.element.dataset.originalTitle=this.element.textContent;
            }
        }
        return true;
    }
    cancel(){
        this.active=false;this.seconds=0;
        if(this.element){
            this.element.style.display='none';
            this.element.setAttribute('aria-hidden','true');
        }
    }
}
