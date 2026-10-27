/**
 * Perseguição com funções diferentes para as quatro viaturas:
 * perseguidor, flanqueadores e interceptor. A IA de ruas mantém o fallback.
 */
class PolicePursuitTactics {
    static targetFor(cop, player, felony = 0) {
        if (!player) return null;
        const dx=player.x-cop.x, dz=player.z-cop.z;
        const distance=Math.hypot(dx,dz);
        const heading=Number(player.heading)||0;
        const speed=Math.max(-20,Math.min(56,Number(player.speed)||0));
        const sin=Math.sin(heading), cos=Math.cos(heading);
        const role=Number.isInteger(cop.pursuitRole) ? cop.pursuitRole % 4 : 0;
        const aggressive=Math.max(0,Math.min(1,(felony-25)/75));
        let lead=0.18;
        let lateral=0;
        if (role===1) {lead=0.38; lateral=6.5;}
        else if (role===2) {lead=0.38; lateral=-6.5;}
        else if (role===3) {lead=0.9+aggressive*0.40; lateral=0;}
        const forecast = Math.min(distance / 48, lead);
        const forward = speed * forecast;
        return {
            x:player.x + sin*forward + cos*lateral,
            z:player.z + cos*forward - sin*lateral,
            role, distance
        };
    }

    // Manobras opcionais em ruas abertas: flanquear ou fechar a passagem.
    // Nunca executa o corte sem visão direta e velocidade compatível.
    static maneuverFor(cop, seenTarget, felony, city, visible = false) {
        if (!cop || !seenTarget || !visible || felony < 62) return null;
        const role = Number.isInteger(cop.pursuitRole) ? cop.pursuitRole % 4 : 0;
        if (role === 0) return null;
        const distance = Math.hypot(seenTarget.x - cop.x, seenTarget.z - cop.z);
        const targetSpeed = Math.max(0,Number(seenTarget.speed)||0);
        if (distance < 9 || distance > 44 || targetSpeed < 9 ||
            Math.abs(cop.speed || 0) < 5) return null;
        const heading = Number(seenTarget.heading)||0;
        const fx=Math.sin(heading), fz=Math.cos(heading);
        const side = role===1 ? 4.2 : role===2 ? -4.2 : 0;
        const lead = role===3 ?
            Math.min(24,Math.max(12,targetSpeed*0.7)) :
            Math.min(11,Math.max(5,targetSpeed*0.31));
        const point={
            x:seenTarget.x+fx*lead+fz*side,
            z:seenTarget.z+fz*lead-fx*side
        };
        if (!this.targetIsSafe(city,point)) return null;
        return {
            x:point.x,z:point.z,
            mode:role===3?'intercept':'flank',
            speedLimit:role===3 && distance < 22 ?
                Math.min(21,targetSpeed*0.85) :
                Math.min(37,Math.max(18,targetSpeed*1.06))
        };
    }

    static targetIsSafe(city, point) {
        const limit=city&&Number.isFinite(city.worldLimit)?
            city.worldLimit-10:238;
        return !!point && Math.abs(point.x)<limit && Math.abs(point.z)<limit &&
            (!city || !city.isPointBlocked(point.x,point.z,1.7));
    }
}
