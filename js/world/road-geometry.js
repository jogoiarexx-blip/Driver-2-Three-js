/**
 * Regras unificadas de posicionamento no tabuleiro viário procedural.
 * As ruas são eixos a cada 80m; faixa útil +/-12m. A área de
 * mobiliário fica entre o meio-fio e o início das edificações.
 */
class DriverRoadGeometry {
    static STEP=80;
    static ROAD_HALF=12;
    static CURB_SETBACK=4;
    static nearestAxis(value){
        const n=Number(value);
        return Number.isFinite(n)?Math.round(n/this.STEP)*this.STEP:0;
    }
    static roadDistance(value){
        return Math.abs(value-this.nearestAxis(value));
    }
    static inDrivingLane(x,z,vehicleRadius=1.55){
        return this.roadDistance(x)<this.ROAD_HALF+vehicleRadius ||
            this.roadDistance(z)<this.ROAD_HALF+vehicleRadius;
    }
    static furnitureCorner(cx,cz,sx,sz){
        const delta=this.ROAD_HALF+this.CURB_SETBACK;
        return {x:cx+sx*delta,z:cz+sz*delta};
    }
    static legalFurniture(x,z,city=null,buffer=0.6){
        if(!Number.isFinite(x)||!Number.isFinite(z))return false;
        if(this.inDrivingLane(x,z,buffer))return false;
        // Evita o canal, a estação e entradas prioritárias.
        if(z>31 && z<69)return false;
        if(city?.trainStation &&
            x>-26&&x<-4&&z>-284&&z<-207)return false;
        if(city?.safeHouseZone &&
            Math.hypot(x-city.safeHouseZone.x,
                       z-city.safeHouseZone.z)<10)return false;
        const boxes=city?.buildingBoxes||[];
        return !boxes.some(b=>x+buffer>b.minX &&
            x-buffer<b.maxX&&z+buffer>b.minZ&&z-buffer<b.maxZ);
    }
    static resolve(x,z,city=null,buffer=.6){
        if(this.legalFurniture(x,z,city,buffer))return {x,z};
        // Sem reposicionamento arbitrário para cima da pista.
        return null;
    }
    static validGarageExit(x,z,city,vehicles=[],skip=null){
        if(city?.isPointBlocked?.(x,z,1.8,0))return false;
        if(city?.isWaterAt?.(x,z))return false;
        return !vehicles.some(v=>v&&v!==skip &&
            Math.hypot(v.x-x,v.z-z)<5);
    }
}
