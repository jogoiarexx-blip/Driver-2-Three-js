/**
 * Chicago R11 — antecipação de curvas para trânsito local de Goose Island.
 *
 * Não muda volante, física, posição ou pontos de missão. Reduz a velocidade
 * antes de curvas de ~90 graus em quatro trechos que já têm piso e ponte
 * certificados pela rede PROCEDURAL R9 (não pela ROM original PS1).
 * O limite varia com a distância ao início da curva e fica observável
 * no objeto de rota para auditoria dos replays físicos.
 */
class DriverChicagoLocalTurnControl {
    static isLocal(car) {
        return !!(car?.gooseIslandVisitor || car?.gooseIslandRoute ||
            car?.gooseIslandNorthYard || car?.gooseIslandSouthbound);
    }
    static pendingTurn(city,car,route) {
        if(city?.preset?.id!=='chicago' ||
           !this.isLocal(car) || car?.scriptedDrive ||
           !route || !Number.isFinite(car.x) ||
           !Number.isFinite(car.z))return null;
        // A distância sempre é medida AO LONGO da pista, e não da
        // diagonal do próximo waypoint (que poderia atravessar galpão).
        if(car.gooseIslandVisitor && route.islandApproach &&
           !route.isIslandSpine &&
           Math.sin(car.heading)>.40 && car.x<=-200 &&
           Math.abs(car.z-156)<=10)
            return {name:'visitor-west-to-north',
                distance:Math.max(0,-200-car.x)};
        if(route.isIslandSpine &&
           Math.abs(car.x+200)<11 &&
           route.islandPhase==='entry' &&
           car.z<=185)
            return {name:'visitor-entry-bend',
                distance:Math.max(0,185-car.z)};
        if(route.isIslandSpine && 
           Math.abs(car.x+200)<11 &&
           route.sign>0 && car.z<=240 &&
           route.islandPhase!=='entry')
            return {name:'island-north-exit',
                distance:Math.max(0,240-car.z)};
        if(route.isNorthYard && car.z<=320 &&
           Math.abs(car.x+200)<11)
            return {name:'north-deck-exit',
                distance:Math.max(0,320-car.z)};
        if(route.isNorthYardSouth && car.z>=240 &&
           Math.abs(car.x+200)<11)
            return {name:'south-deck-exit',
                distance:Math.max(0,car.z-240)};
        return null;
    }
    static speedLimit(city,car,route) {
        const turn=this.pendingTurn(city,car,route);
        if(!turn || turn.distance>30)return null;
        // À distância 30, limite 16; ao chegar à esquina, ~7.
        // Um pouco mais rápido para caminhar sobre os decks.
        const min=(turn.name.includes('deck'))?8:7;
        const speed=+(min+(Math.min(30,turn.distance)/30)*
            (16-min)).toFixed(2);
        return {speed,distance:turn.distance,reason:turn.name};
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoLocalTurnControl;
