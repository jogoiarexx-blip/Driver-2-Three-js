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
            'letter-spacing:.24em;text-align:center;padding:24px;'+
            'white-space:pre-line;text-shadow:0 3px 12px #000';
        overlay.setAttribute('aria-hidden','true');
        document.body.appendChild(overlay);
        this.element=overlay;
    }
    begin(game,type){
        if(!type?.startsWith('story_')||typeof document==='undefined')return;
        this.shotsR87?.release();
        this.shotsR87=typeof DriverMissionShotsR87!=='undefined'?
            new DriverMissionShotsR87(game,type):null;
        this.ensure();
        const title=document.getElementById('mission-title')?.textContent||
            type.replace(/_/g,' ').toUpperCase();
        const story=typeof DriverCampaignScenesR86!=='undefined'?
            DriverCampaignScenesR86.script(type):null;
        this.introTitle=story?story.chapter+'\n'+story.title:title;
        this.introSetup=story?.setup||'';
        this.introGoal=story?.goal||'';
        this.seconds=0;this.active=true;
        // A vinheta usa a primeira etapa REAL, sem reescrever diretores.
        // A cena e os controles permanecem pausados durante a abertura.
        this.stageIntro=typeof DriverChicagoMissionGuidance!=='undefined'?
            (DriverChicagoMissionGuidance.snapshot(game)?.label||''):'';
        this.startedAt=typeof performance!=='undefined'?performance.now():null;
        this.element.textContent=this.introTitle;
        this.element.dataset.originalTitle=this.introTitle;
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
            this.shotsR87?.release();
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
                // Same 5-second real-world establishing shot, now
                // visually linked to the actual goal of this mission.
                // No fake pre-rendered cutscene or gameplay teleport.
                this.element.textContent=this.seconds<3.15?
                    (this.introSetup||this.stageIntro||this.introTitle):
                    (this.stageIntro||this.introGoal||'');
            }else{
                this.element.style.background='#000';
                this.element.style.opacity='1';
                this.element.textContent=this.introTitle;
            }
        }
        return true;
    }
    // Mild camera dolly only during the actual street establishing shot.
    // Uses the camera calculated by DriverCameraRig each frame; it never
    // moves Tanner, a vehicle, or a mission actor.
    decorateCamera(camera){
        if(!this.active||!camera?.position||
            this.seconds<=2.05||this.seconds>=5)return;
        const t=Math.max(0,Math.min(1,(this.seconds-2.05)/2.95));
        const ease=t*t*(3-2*t);
        camera.position.x+=Math.sin(ease*Math.PI)*.5;
        camera.position.y+=Math.sin(ease*Math.PI)*.16;
        this.shotsR87?.decorate(camera,this.seconds);
    }
    cancel(){
        this.shotsR87?.release();
        this.shotsR87=null;
        this.active=false;this.seconds=0;
        if(this.element){
            this.element.style.display='none';
            this.element.setAttribute('aria-hidden','true');
        }
    }
}
