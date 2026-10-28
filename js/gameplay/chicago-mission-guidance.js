/**
 * Guia de missão da campanha Chicago — apresentação, sem física nem vitória.
 * Observa estados dos diretores existentes, sem alterar regras da campanha.
 * As coordenadas são adaptações da malha procedural do nosso Driver 2.
 */
class DriverChicagoMissionGuidance {
    static SNAP_RADIUS=7;
    static point(pos){
        if(!pos||!Number.isFinite(pos.x)||!Number.isFinite(pos.z))
            return null;
        return {x:pos.x,z:pos.z};
    }
    static target(car){
        return this.point(car);
    }
    static snapshot(game){
        if(!game?.missionActive||game.currentCityKey!=='chicago'||
            !DriverCampaignFlow.CHICAGO.includes(game.missionType))
            return null;
        const type=game.missionType;
        const pos=game.getPlayerPosition?.();
        const home=this.point(game.city?.safeHouseZone);
        const target=this.target(game.targetCar);
        let id='start',label='',hint='',destination=null,warning='';
        switch(type){
        case 'story_tipoff':
            if(game.mode==='on_foot' && game.playerCar!==game.targetCar){
                const nearJones=pos && target && Math.hypot(
                    pos.x-target.x,pos.z-target.z)<10;
                const own=game.playerCar && !game.playerCar.isTarget?
                    this.point(game.playerCar):null;
                const nearOwn=own && Math.hypot(
                    pos.x-own.x,pos.z-own.z)<8;
                if(nearJones){
                    id='jones';label='ENTRE NO CARRO DE JONES';
                    hint='Pressione E próximo ao carro de Jones.';
                    destination=target;
                }else if(!nearOwn && target){
                    id='drive';label='ENCONTRE O CARRO DE JONES';
                    hint='Siga até o carro destacado no radar e saia a pé.';
                    destination=target;
                }else{
                    id='enter';label='ENTRE NO SEU CARRO';
                    hint='Pressione E perto do carro para dirigir até Jones.';
                    destination=own||target;
                }
            }else{
                id='jones';label='ENCONTRE JONES';
                hint='Aproxime-se do carro de Jones, saia e pressione E para entrar.';
                destination=target;
            }
            break;
        case 'story_witness':{
            id='witness';label='PERSIGA A TESTEMUNHA';
            destination=target;
            const d=pos&&target?Math.hypot(pos.x-target.x,pos.z-target.z):Infinity;
            const contact=Math.floor(game.witnessCloseTime||0);
            hint='Contato '+contact+'/48s • Mantenha até 85m do sedã azul.';
            if(d>85)warning='ALVO DISTANTE • NÃO PERCA O SEDÃ';
            break;
        }
        case 'story_train':
            if(game.trainLine?.arrived){
                id='platform';label='SUBA ATÉ A PLATAFORMA';
                destination={x:-14,z:-260};
                hint=game.mode==='on_foot'?
                    'Siga pela rampa cinza e alcance o trem no elevado.':
                    'Pare perto da estação e pressione E para sair do carro.';
            }else{
                id='train';label='ACOMPANHE O TREM ELEVADO';
                destination=this.point(game.trainLine?.position);
                hint='Mantenha o trem à vista até a parada na estação.';
                if((game.trainLostSeconds||0)>3)
                    warning='ATENÇÃO • TREM QUASE PERDIDO';
            }
            break;
        case 'story_drop':{
            const info=game.dropStatus||{};
            const routeDone=!!game.targetCar?.scriptedDrive?.done;
            id=routeDone?'depot':'tail';
            label=routeDone?'CHEGUE AO GALPÃO':'SIGA O SEDÃ VERMELHO';
            destination=target;
            hint='Mantenha de 18m a 100m • Suspeita '+
                Math.round(info.suspicion||0)+'% • Perda '+
                Math.round(info.lost||0)+'%';
            if(info.zone==='close')warning='MUITO PERTO • AFASTE-SE';
            if(info.zone==='far')warning='MUITO LONGE • APROXIME-SE';
            break;
        }
        case 'story_safehouse':{
            const info=game.safeHouseStatus||{};
            const safe=info.phase==='reach_home';
            id=safe?'home':'evade';
            label=safe?'ALCANCE A CASA SEGURA':'DESPISTE A POLÍCIA';
            destination=safe?home:null;
            hint=safe?
                'Pare na casa verde ou entre no imóvel a pé.':
                'Quebre a visão das viaturas • Felony abaixo de 32%.';
            if(info.policeWatching)warning='VIATURAS ENXERGAM TANNER';
            break;
        }
        case 'story_intruder':{
            const phase=game.intruderStatus?.phase ||
                game.intruderDirector?.phase||'opening';
            if(phase==='opening' && game.mode==='on_foot'){
                id='car';label='PEGUE O ESPORTIVO PRETO';
                destination=this.point(game.playerCar);
                hint='Aproxime-se do veículo e pressione E.';
            }else if(phase==='yard'||phase==='blocked'){
                id=phase;label=phase==='yard'?
                    'PARE NO PÁTIO INDUSTRIAL':'ARMADILHA NO PÁTIO';
                destination=phase==='yard'?{x:200,z:-160}:null;
                hint=phase==='yard'?
                    'Estacione próximo ao carro do invasor.':
                    'A van amarela bloqueou a saída.';
            }else{
                id='chase';label='NÃO PERCA O INVASOR';
                destination=target;
                hint='Acompanhe o sedã cinza até o depósito.';
                if((game.intruderStatus?.lostSeconds||0)>3)
                    warning='INVASOR ESCAPANDO';
            }
            break;
        }
        case 'story_caine':{
            const phase=game.caineStatus?.phase||
                game.caineDirector?.phase||'warehouse';
            id=phase;
            if(phase==='warehouse'){
                label='SAIA DO GALPÃO';
                destination=this.point(game.interiorPlace?.exit);
                hint='Caminhe até a porta e pressione E.';
            }else if(phase==='find_car'){
                label='PEGUE O CARRO AMARELO';
                destination={x:240,z:-160};
                hint='Pressione E próximo ao carro no pátio.';
            }else if(phase==='bridge'){
                label='ATRAVESSE A PONTE';
                destination={x:0,z:100};
                hint='Cruze antes do fechamento • Restam '+
                    Math.ceil(game.caineStatus?.bridgeRemaining||0)+'s.';
                warning='PONTE FECHANDO';
            }else{
                label='FUJA DAS VANS DE CAINE';
                destination={x:0,z:80};
                hint='Siga para a travessia central do Rio Chicago.';
            }
            break;
        }
        case 'story_leaving':{
            const phase=game.leavingStatus?.phase||
                game.leavingDirector?.phase||'drive';
            id=phase;
            label=phase==='reunion'?
                'ESPERE JONES NA ESTAÇÃO':'ALCANCE A ESTAÇÃO RANDOLPH';
            destination={x:0,z:-240};
            hint=phase==='reunion'?
                'Mantenha o carro parado no marcador verde.':
                'Dirija na chuva, evite a máfia e chegue antes do tempo.';
            if((game.missionTimeLeft||0)<30)
                warning='TEMPO QUASE ESGOTADO';
            break;
        }
        default:
            return null;
        }
        const point=this.point(destination);
        const distance=pos&&point?
            Math.round(Math.hypot(point.x-pos.x,point.z-pos.z)):null;
        return {type,id,label,hint,destination:point,distance,warning};
    }
    static render(game){
        const root=document.getElementById('chicago-mission-guidance');
        if(!root)return null;
        const data=this.snapshot(game);
        root.classList.toggle('hidden',!data);
        game.chicagoGuidance=data;
        if(!data)return null;
        const title=document.getElementById('chicago-guidance-title');
        const desc=document.getElementById('chicago-guidance-detail');
        const alert=document.getElementById('chicago-guidance-alert');
        const main=data.label+(data.distance!==null?
            ' • '+data.distance+'m':'');
        if(title && title.textContent!==main)title.textContent=main;
        if(desc && desc.textContent!==data.hint)desc.textContent=data.hint;
        if(alert){
            alert.classList.toggle('hidden',!data.warning);
            if(alert.textContent!==data.warning)alert.textContent=data.warning;
        }
        const previous=game.chicagoGuidanceStage;
        const stage=data.type+':'+data.id;
        if(previous!==stage){
            game.chicagoGuidanceStage=stage;
            // Transição discreta no HUD; não bloqueia controles nem timer.
            root.classList.remove('driver-stage-enter');
            void root.offsetWidth; // reinicia somente quando muda a etapa
            root.classList.add('driver-stage-enter');
        }
        return data;
    }
    static drawRadar(ctx,game,pos,scale){
        const data=game.chicagoGuidance;
        if(!data?.destination || !pos || !Number.isFinite(scale) ||
            scale<=0)return;
        const x=(data.destination.x-pos.x)*scale;
        const y=-(data.destination.z-pos.z)*scale;
        ctx.save();
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(x,y);
        ctx.strokeStyle='#fbbf24';ctx.lineWidth=1.8;
        ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);
        ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);
        ctx.fillStyle='#0f172a';ctx.fill();
        ctx.strokeStyle=data.warning?'#fb7185':'#facc15';
        ctx.lineWidth=2.6;ctx.stroke();
        // Centro sólido, sem texto espelhado dentro do transform do radar.
        ctx.fillStyle=data.warning?'#fb7185':'#facc15';
        ctx.beginPath();ctx.arc(x,y,2.8,0,Math.PI*2);ctx.fill();
        ctx.restore();
    }
}
