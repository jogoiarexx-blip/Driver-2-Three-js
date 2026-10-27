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

    static targetIsSafe(city, point) {
        return !!point && Math.abs(point.x)<238 && Math.abs(point.z)<238 &&
            (!city || !city.isPointBlocked(point.x,point.z,1.7));
    }
}
