/**
 * Chicago R23 — prolongamento norte pelo esqueleto de superfície do PS1.
 *
 * Cadeia de seis edges: 1822 -> 1777 -> 1762 -> 1650 -> 1557 -> 1550.
 * O dado é uma CANDIDATA extraída de piso: pode conter pátio/calçada;
 * não declarar toda a rede como ruas nem novas coordenadas de missões.
 *
 * Usa a MESMA transformação R15 das oito vias pré-existentes.
 * Costura física no término da R20 e valida água/AABB antes de construir.
 */
const DriverChicagoR23Base=typeof module!=='undefined'&&module.exports?
    require('./chicago-ps1-reference-curve.js'):
    DriverChicagoPS1ReferenceCurve;
class DriverChicagoPS1NorthCandidateR23 extends DriverChicagoR23Base {
    static get source(){
        return typeof DriverChicagoSourceNorthCandidateR23!=='undefined'?
            DriverChicagoSourceNorthCandidateR23:this.sourceDataR23;
    }
    static fitPoint(point){return DriverChicagoR23Base.fitPoint(point);}
    static get placement(){
        return {key:'chicagoReferenceNorthCandidateR23',x:-335,z:690,
            foundation:false,district:'wrigleyville',
            name:'chicago-r23-source-north-candidate'};
    }
    static plan(){
        // Não modificar os pontos originais. Apenas o início da malha do
        // clone precisa de um pequeno conector à via R20 (sem origem ROM).
        const road=super.plan();
        const origin=typeof DriverChicagoPS1ReferenceArterial!=='undefined'?
            DriverChicagoPS1ReferenceArterial:
            this.parentArterial;
        const previous=origin?.plan()?.points?.at(-1);
        if(previous){
            const first=this.source.pointsOBJ[0],
                second=this.source.pointsOBJ[1],
                joinZ=origin.source.pointsOBJ.at(-1)[1],
                dz=second[1]-first[1];
            // O esqueleto começa 0,5 OBJ ao SUL da ponta da R20.
            // Costurar no primeiro nó inteiro gerava uma curva em U:
            // o carro saía 12m da pista para só depois apontar ao norte.
            // Recortar a aresta original na latitude da R20 preserva o
            // alinhamento e mantém TODAS as outras arestas imutáveis.
            const t=(joinZ-first[1])/dz;
            if(!Number.isFinite(t)||t<0||t>1)
                throw Error('R23 sem interseção contínua com avenida R20');
            const cut=this.fitPoint([
                first[0]+(second[0]-first[0])*t,
                first[1]+dz*t
            ]);
            const seam=Math.hypot(cut.x-previous.x,cut.z-previous.z);
            if(seam>6)throw Error('R23 sem ligação curta à avenida R20');
            const forward=road.points.filter(p=>p.z>cut.z+.65);
            if(forward.length<6)
                throw Error('R23 não possui segmentos após a junção');
            road.points=[{...previous},cut,...forward];
            road.adaptedSeamLength=seam;
            road.sourceSeamTrimmed=true;
        }else throw Error('R23 requer a avenida anterior R20');
        road.lots=[];
        road.width=8;
        road.sourceEdgeIds=this.source.sourceEdgeIds;
        road.originalPlacementCertified=false;
        road.roadClassificationCertified=false;
        road.wholeMapCertified=false;
        road.mode='source-skeleton-candidate-r23-audited';
        return road;
    }
}
if(typeof module!=='undefined'&&module.exports){
    DriverChicagoPS1NorthCandidateR23.sourceDataR23=
        require('../../chicago/reference-north-candidate-r23.json');
    DriverChicagoPS1NorthCandidateR23.parentArterial=
        require('./chicago-ps1-reference-arterial.js');
    module.exports=DriverChicagoPS1NorthCandidateR23;
}
