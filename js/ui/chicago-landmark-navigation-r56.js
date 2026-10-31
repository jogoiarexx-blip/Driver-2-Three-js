/**
 * Chicago R56 — minimap landmarks and opt-in route guidance.
 * Uses existing verified street graph and R55 final access lanes.
 * Passive markers do not affect campaign, traffic, collisions or saves.
 */
class DriverChicagoLandmarkNavigationR56 {
    static PLACES=[
        {id:'navy-pier',name:'NAVY PIER',code:'P',color:'#67d9f0'},
        {id:'wrigley',name:'WRIGLEY FIELD',code:'W',color:'#a7d596'},
        {id:'soldier',name:'SOLDIER FIELD',code:'S',color:'#e8c98e'}
    ];
    static selected(game) {
        return this.PLACES.find(p=>p.id===game?.landmarkNavigationR56?.target)||null;
    }
    static isEligible(game) {
        return game?.currentCityKey==='chicago'&&
            !game.loadingActive&&!game.interiorPlace&&
            !game.missionActive&&game.missionType==='freeroam'&&
            !game.inReplayMode;
    }
    static getRoute(id) {
        if(typeof DriverChicagoLandmarkAccessR55==='undefined')return null;
        return DriverChicagoLandmarkAccessR55.ROUTES.find(r=>r.id===id)||null;
    }
    static bind(game) {
        if(!game||game.landmarkNavigationR56?.bound)return;
        game.landmarkNavigationR56={bound:true,target:null,path:null,
            reason:null,lastPlanAt:-Infinity,build:null,raised:null,
            plannedPosition:null,lastStatus:''};
        const toggle=document.getElementById('driver-landmarks-r56-toggle');
        const menu=document.getElementById('driver-landmarks-r56-menu');
        if(toggle&&menu)toggle.addEventListener('click',()=>{
            const show=menu.classList.contains('hidden');
            menu.classList.toggle('hidden',!show);
            toggle.setAttribute('aria-expanded',String(show));
        });
        document.querySelectorAll('[data-chicago-landmark-r56]').forEach(button=>{
            button.addEventListener('click',()=>{
                this.select(game,button.dataset.chicagoLandmarkR56);
                this.closeMenu();
            });
        });
        this.renderUI(game);
    }
    static closeMenu() {
        const menu=document.getElementById('driver-landmarks-r56-menu');
        const toggle=document.getElementById('driver-landmarks-r56-toggle');
        if(menu)menu.classList.add('hidden');
        if(toggle)toggle.setAttribute('aria-expanded','false');
    }
    static cityChanged(game) {
        const s=game?.landmarkNavigationR56;
        if(!s)return;
        s.path=null;s.reason=null;s.plannedPosition=null;
        s.build=null;s.raised=null;s.lastPlanAt=-Infinity;
        if(game.currentCityKey!=='chicago')s.target=null;
        this.closeMenu();
        this.renderUI(game);
    }
    static select(game,id) {
        const s=game?.landmarkNavigationR56;
        if(!s)return false;
        const place=this.PLACES.find(p=>p.id===id);
        if(id!=='clear'&&!place)return false;
        if(id!=='clear'&&game.currentCityKey!=='chicago')return false;
        s.target=id==='clear'?null:id;
        s.path=null;s.reason=null;s.plannedPosition=null;
        s.lastPlanAt=-Infinity;
        if(s.target)this.plan(game,true);
        this.renderUI(game);
        return true;
    }
    static clearSegment(city,a,b) {
        if(!a||!b)return false;
        if(Math.hypot(a.x-b.x,a.z-b.z)<.4)return true;
        return typeof DriverChicagoMixedNavigationR49!=='undefined'&&
            DriverChicagoMixedNavigationR49.clear(city,a,b,false);
    }
    static plan(game,force=false) {
        const s=game?.landmarkNavigationR56;
        if(!s?.target||!this.isEligible(game)||!game.city?.ready)
            return null;
        const now=typeof performance!=='undefined'?performance.now():Date.now();
        const player=game.getPlayerPosition();
        const city=game.city,raised=!!city.bridgeRaised,build=city.buildSequence||0;
        const traveled=s.plannedPosition?
            Math.hypot(player.x-s.plannedPosition.x,
                player.z-s.plannedPosition.z):Infinity;
        if(!force&&s.build===build&&s.raised===raised&&
            now-s.lastPlanAt<3200&&traveled<32)return s.path;
        s.build=build;s.raised=raised;s.lastPlanAt=now;
        s.plannedPosition={x:player.x,z:player.z};
        s.path=null;s.reason='Rota não validada';
        const route=this.getRoute(s.target);
        if(!route||typeof DriverChicagoMixedNavigationR49==='undefined' ||
            typeof DriverChicagoLandmarkAccessR55==='undefined')return null;
        if(!DriverChicagoLandmarkAccessR55.sampleRoute(city,route,1.55).open){
            s.reason='Acesso bloqueado';return null;
        }
        const entry={x:route.from[0],z:route.from[1]};
        const endpoint={x:route.to[0],z:route.to[1]};
        // Nunca substituir ausência de caminho por uma linha reta fictícia.
        const main=DriverChicagoMixedNavigationR49.plan(city,player,entry);
        if(!Array.isArray(main)||!main.length){
            s.reason='Sem caminho rodável confirmado';return null;
        }
        const first=main[0],last=main[main.length-1];
        if(!this.clearSegment(city,player,first) ||
           !this.clearSegment(city,last,entry) ||
           !this.clearSegment(city,entry,endpoint)){
            s.reason='Trecho de ligação bloqueado';return null;
        }
        const path=[{x:player.x,z:player.z},...main.map(p=>({x:p.x,z:p.z}))];
        if(Math.hypot(last.x-entry.x,last.z-entry.z)>.4)path.push(entry);
        if(Math.hypot(path.at(-1).x-endpoint.x,path.at(-1).z-endpoint.z)>.4)
            path.push(endpoint);
        s.path=path;s.reason=null;
        return path;
    }
    static update(game) {
        const s=game?.landmarkNavigationR56;
        if(!s)return;
        const menu=document.getElementById('driver-landmarks-r56');
        if(menu)menu.classList.toggle('hidden',game.currentCityKey!=='chicago');
        if(s.target&&this.isEligible(game))this.plan(game);
        this.renderUI(game);
    }
    static renderUI(game) {
        const s=game?.landmarkNavigationR56;
        if(!s)return;
        const text=document.getElementById('driver-landmarks-r56-status');
        if(!text)return;
        const dest=this.selected(game);
        let message='';
        if(dest&&game.currentCityKey==='chicago'){
            if(!this.isEligible(game))
                message=dest.name+' · orientação pausada';
            else if(s.path){
                const p=game.getPlayerPosition(),r=this.getRoute(dest.id);
                const direct=r?Math.hypot(p.x-r.to[0],p.z-r.to[1]):0;
                message=direct<12?dest.name+' · VOCÊ CHEGOU':
                    dest.name+' · '+Math.round(direct)+'m em linha reta';
            }else message=dest.name+' · '+(s.reason||'calculando rota');
        }
        if(s.lastStatus!==message){
            s.lastStatus=message;
            text.textContent=message;
        }
        text.classList.toggle('hidden',!message);
        document.querySelectorAll('[data-chicago-landmark-r56]').forEach(button=>{
            const active=s.target===button.dataset.chicagoLandmarkR56;
            button.setAttribute('aria-pressed',String(active));
        });
    }
    static drawRadar(ctx,game,pos,scale) {
        if(game?.currentCityKey!=='chicago'||game.interiorPlace ||
            game.missionActive||game.missionType!=='freeroam')return;
        const s=game.landmarkNavigationR56;
        // ctx já está traduzido, espelhado e rotacionado pelo radar real.
        if(s?.path?.length>1&&this.isEligible(game)){
            ctx.save();
            ctx.beginPath();
            const first=s.path[0];
            ctx.moveTo((first.x-pos.x)*scale,-(first.z-pos.z)*scale);
            for(let i=1;i<s.path.length;i++){
                const p=s.path[i];
                ctx.lineTo((p.x-pos.x)*scale,-(p.z-pos.z)*scale);
            }
            ctx.strokeStyle='#68d8e5';ctx.lineWidth=2.25;
            ctx.setLineDash([5,3]);ctx.stroke();ctx.setLineDash([]);
            ctx.restore();
        }
        ctx.save();ctx.textAlign='center';ctx.font='bold 9px sans-serif';
        for(const place of this.PLACES){
            const r=this.getRoute(place.id);
            if(!r)continue;
            const x=(r.to[0]-pos.x)*scale,z=-(r.to[1]-pos.z)*scale;
            const chosen=s?.target===place.id;
            ctx.beginPath();ctx.arc(x,z,chosen?7:5,0,Math.PI*2);
            ctx.fillStyle='#111827';ctx.fill();
            ctx.strokeStyle=place.color;ctx.lineWidth=chosen?2.2:1.3;
            ctx.stroke();
            ctx.save();ctx.translate(x,z);ctx.scale(-1,1);
            ctx.fillStyle=place.color;
            ctx.fillText(place.code,0,3);
            ctx.restore();
        }
        ctx.restore();
    }
    static audit(game) {
        const s=game?.landmarkNavigationR56;
        return {bound:!!s?.bound,city:game?.currentCityKey||null,
            destination:s?.target||null,routeAvailable:!!s?.path,
            segments:s?.path?.length||0,reason:s?.reason||null,
            suppressedByMission:!!game?.missionActive};
    }
}
if(typeof window!=='undefined')
    window.DriverChicagoLandmarkNavigationR56=DriverChicagoLandmarkNavigationR56;
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoLandmarkNavigationR56;
