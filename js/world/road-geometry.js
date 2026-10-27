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
    // Verifica todo o corredor, e não apenas o destino. Evita rotas da IA
    // atravessando canal, muros, edifícios ou acessos fechados.
    static segmentDrivable(city,x0,z0,x1,z1,radius=1.25){
        const data=[x0,z0,x1,z1,radius];
        if(!data.every(Number.isFinite)||radius<0)return false;
        const distance=Math.hypot(x1-x0,z1-z0);
        const steps=Math.max(1,Math.ceil(distance/3));
        for(let i=0;i<=steps;i++){
            const t=i/steps,x=x0+(x1-x0)*t,z=z0+(z1-z0)*t;
            if(city?.isWaterAt?.(x,z))return false;
            if(city?.isPointBlocked?.(x,z,radius,0))return false;
        }
        return true;
    }
    static laneSegment(city,axis,sign,crossX,crossZ,nextX,nextZ,offset=4){
        if(axis!=='x'&&axis!=='z')return false;
        if(sign!==1&&sign!==-1)return false;
        // Mesmo referencial de DriverTrafficAI.positionInLane().
        const x0=axis==='z'?crossX+sign*offset:crossX;
        const z0=axis==='x'?crossZ-sign*offset:crossZ;
        const x1=axis==='z'?crossX+sign*offset:nextX;
        const z1=axis==='x'?crossZ-sign*offset:nextZ;
        return this.segmentDrivable(city,x0,z0,x1,z1);
    }
    static auditNetwork(city){
        const limit=Math.min(320,Math.max(0,Number(city?.roadExtent)||320));
        const nodes=[],edges=[],adjacency=new Map();
        for(let x=-limit;x<=limit;x+=this.STEP)
            for(let z=-limit;z<=limit;z+=this.STEP){
                const key=x+','+z;
                nodes.push({x,z,key});
                adjacency.set(key,[]);
            }
        for(const node of nodes){
            for(const [dx,dz] of [[this.STEP,0],[0,this.STEP]]){
                const nx=node.x+dx,nz=node.z+dz;
                const next=nx+','+nz;
                if(!adjacency.has(next))continue;
                const axis=dx?'x':'z';
                // Conectividade bidirecional: o trânsito trafega em faixas
                // opostas, e ambos os sentidos devem permanecer livres.
                const valid=this.laneSegment(city,axis,1,node.x,node.z,nx,nz)&&
                    this.laneSegment(city,axis,-1,node.x,node.z,nx,nz);
                if(!valid)continue;
                adjacency.get(node.key).push(next);
                adjacency.get(next).push(node.key);
                edges.push([node.key,next]);
            }
        }
        const visited=new Set(),components=[];
        for(const node of nodes){
            if(visited.has(node.key))continue;
            const queue=[node.key];visited.add(node.key);
            for(let i=0;i<queue.length;i++){
                const k=queue[i];
                for(const other of adjacency.get(k)){
                    if(!visited.has(other)){visited.add(other);queue.push(other)}
                }
            }
            components.push(queue);
        }
        return {
            nodes:nodes.length,edges:edges.length,
            components:components.length,
            largestComponent:Math.max(0,...components.map(c=>c.length)),
            disconnected:nodes.length-Math.max(0,...components.map(c=>c.length))
        };
    }
    static validGarageExit(x,z,city,vehicles=[],skip=null){
        if(city?.isPointBlocked?.(x,z,1.8,0))return false;
        if(city?.isWaterAt?.(x,z))return false;
        return !vehicles.some(v=>v&&v!==skip &&
            Math.hypot(v.x-x,v.z-z)<5);
    }
}
