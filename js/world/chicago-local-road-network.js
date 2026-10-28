/**
 * Chicago R9 — auditoria única das conexões do trânsito industrial.
 *
 * Consolida os caminhos seguros já existentes (R5/R6/R8) e confirma
 * cada segmento pela MESMA regra de colisão da IA. Não altera a grade,
 * geometria PS1, missões, física, traçado nem sinais de trânsito.
 * Os três fluxos são DIRIGIDOS: a aprovação não implica que a cidade
 * inteira, ruas em sentido oposto ou toda a malha PS1 estejam conectadas.
 */
class DriverChicagoLocalRoadNetwork {
    static flows(){
        return [
            {id:'west-island-east',version:'R5',segments:[
                {from:[-276,156],to:[-200,156]},
                {from:[-200,156],to:[-196,185]},
                {from:[-196,185],to:[-196,236]},
                {from:[-196,236],to:[-160,236]}
            ]},
            {id:'island-north-east',version:'R6',segments:[
                {from:[-196,235],to:[-196,268]},
                {from:[-196,268],to:[-196,295]},
                {from:[-196,295],to:[-196,317]},
                {from:[-196,317],to:[-160,316]}
            ]},
            {id:'north-south-west',version:'R8',segments:[
                {from:[-204,311],to:[-204,244]},
                {from:[-204,249],to:[-240,244]}
            ]}
        ];
    }
    static audit(city){
        if(city?.preset?.id!=='chicago')return null;
        const road=typeof DriverRoadGeometry!=='undefined'?
            DriverRoadGeometry:null;
        const hasIsland=!!city.chicagoGooseIslandStreet?.accessReady;
        const hasNorth=!!city.chicagoGooseIslandNorthYard?.accessReady;
        const southbound=typeof DriverChicagoGooseIslandNorthYard!=='undefined' &&
            hasNorth && DriverChicagoGooseIslandNorthYard.testSouthbound(city);
        const flows=this.flows().map(flow=>{
            const links=flow.segments.map((s,index)=>{
                const from={x:s.from[0],z:s.from[1]},
                    to={x:s.to[0],z:s.to[1]};
                const valid=!!road && road.segmentDrivable(city,
                    from.x,from.z,to.x,to.z,1.65);
                return {index,from,to,valid};
            });
            const dependencies=flow.version==='R5'?hasIsland:
                flow.version==='R6'?hasNorth:southbound;
            return {id:flow.id,version:flow.version,
                available:dependencies&&links.every(s=>s.valid),
                segments:links};
        });
        const blocked=flows.flatMap(f=>f.segments.filter(l=>!l.valid)
            .map(l=>f.id+':'+l.index));
        return {
            format:'Driver2ChicagoLocalRoadAuditR9',
            reference:'procedural R5-R8 lanes, NOT ROM-certified PS1 roads',
            flows,flowsAvailable:flows.filter(f=>f.available).length,
            segmentsChecked:flows.reduce((s,f)=>s+f.segments.length,0),
            blocked,allFlowRoutesAvailable:flows.every(f=>f.available),
            originalPS1RoadsCertified:false,missionsMigrated:false
        };
    }
    static build(city){
        if(city?.preset?.id!=='chicago')return null;
        const value=this.audit(city);
        city.chicagoLocalRoadNetwork=value;
        return value;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoLocalRoadNetwork;
