/**
 * Campanha de Chicago: locais de início independentes das áreas de missão.
 * Coordenadas adaptadas à malha deste projeto, não dados extraídos do jogo PS1.
 * O diretor original de cada missão continua controlando objetivos e vitória.
 */
class DriverChicagoMissionHubs {
    static SPECS={
        story_tipoff:{x:-64,z:-144,label:'01 • SURVEILLANCE TIP OFF',
            place:'Gold Coast (setor adaptado)',
            hint:'Entre no veículo e encontre o carro de Jones.'},
        story_witness:{x:12,z:-112,label:'02 • CHASE THE WITNESS',
            place:'Avenidas centrais',hint:'Intercepte e siga a testemunha.'},
        story_train:{x:-16,z:-224,label:'03 • TRAIN PURSUIT',
            place:'Estação do El Train',hint:'Persiga o trem até a estação.'},
        story_drop:{x:-84,z:-80,label:'04 • TAILING THE DROP',
            place:'Distrito comercial',hint:'Siga o carro sem ser notado.'},
        story_safehouse:{x:-128,z:-80,label:'05 • ESCAPE TO THE SAFE HOUSE',
            place:'Casa de Tanner',hint:'Despiste a polícia e alcance a casa.'},
        story_intruder:{x:-84,z:-88,label:'06 • CHASE THE INTRUDER',
            place:'Garagens de Greektown',hint:'Siga o invasor até o galpão.'},
        story_caine:{x:4,z:-108,label:"07 • CAINE'S COMPOUND",
            place:'Distrito industrial',hint:'Prepare a fuga do depósito.'},
        story_leaving:{x:-4,z:-128,label:'08 • LEAVING CHICAGO',
            place:'Centro de Chicago',hint:'Encontre Jones antes de partir.'}
    };

    static spec(city,type){
        if(city?.preset?.id!=='chicago')return null;
        return this.SPECS[type]||null;
    }
    static sync(city,type,active=false){
        const marker=city?.missionStart;
        if(!marker)return null;
        const spec=this.spec(city,type);
        if(spec && marker.type!==type){
            marker.x=spec.x;marker.z=spec.z;marker.type=type;
            marker.ring?.position?.set(spec.x,.55,spec.z);
            marker.arrow?.position?.set(spec.x,3.3,spec.z);
        }
        // Esconde o início quando a missão está em andamento. O ponto
        // reaparece após concluir/falhar, para o próximo capítulo.
        if(marker.ring)marker.ring.visible=!active;
        if(marker.arrow)marker.arrow.visible=!active;
        return spec;
    }
    static distance(pos,start){
        if(!pos||!start)return Infinity;
        return Math.hypot(pos.x-start.x,pos.z-start.z);
    }
    static canStart(pos,start,active,limit=10){
        return !!start&&!active&&this.distance(pos,start)<=limit;
    }
}
