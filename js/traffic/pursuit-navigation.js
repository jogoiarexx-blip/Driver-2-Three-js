/**
 * Navegação das perseguições — rotas curtas pelo grafo viário (80 m).
 * Adaptação PS1: preserva os waypoints e temporizadores das missões.
 * A* é executado somente quando o destino muda ou uma via é bloqueada.
 * Não há teleporte, busca por quadro nem novos colliders.
 */
class DriverPursuitNavigation {
    static STEP=80;
    static LIMIT=320;
    static KEY(x,z){return x+','+z;}
    static node(x,z){return {x,z};}
    static nearest(n){return Math.round(n/this.STEP)*this.STEP;}
    static distance(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
    static closedDrawbridge(city,a,b){
        if(city?.preset?.id!=='chicago'||!city.bridgeRaised)return false;
        // Enquanto as folhas estão levantadas a IA não atravessa a
        // faixa completa do rio. O jogador ainda pode usar rampas.
        const south=Math.min(a.z,b.z),north=Math.max(a.z,b.z);
        return south<34 && north>66;
    }
    static clear(city,a,b){
        if(!a||!b||this.closedDrawbridge(city,a,b))return false;
        if(typeof DriverRoadGeometry!=='undefined')
            return DriverRoadGeometry.segmentDrivable(
                city,a.x,a.z,b.x,b.z,1.45);
        const d=this.distance(a,b),steps=Math.ceil(d/3);
        for(let i=0;i<=steps;i++){
            const t=i/Math.max(1,steps);
            const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
            if(city.isWaterAt?.(x,z)||city.isPointBlocked?.(x,z,1.45,0))
                return false;
        }
        return true;
    }
    static edge(city,a,b){
        if(!a||!b||this.distance(a,b)>this.STEP+.01||
            this.closedDrawbridge(city,a,b))return false;
        if(a.x!==b.x&&a.z!==b.z)return false;
        const axis=a.x===b.x?'z':'x';
        const sign=axis==='z'?Math.sign(b.z-a.z):Math.sign(b.x-a.x);
        if(!sign)return false;
        if(typeof DriverRoadGeometry!=='undefined'){
            // Ambas as faixas devem existir; nunca atravessar o rio
            // numa rua em que uma das duas laterais esteja submersa.
            return DriverRoadGeometry.laneSegment(city,axis,sign,
                a.x,a.z,b.x,b.z,4) &&
                DriverRoadGeometry.laneSegment(city,axis,-sign,
                a.x,a.z,b.x,b.z,4);
        }
        return this.clear(city,a,b);
    }
    static plan(city,from,goal){
        if(!city||!from||!goal)return null;
        const limit=Math.min(this.LIMIT,Math.max(80,
            Number(city.roadExtent)||this.LIMIT));
        const clamp=v=>Math.max(-limit,Math.min(limit,this.nearest(v)));
        const start=this.node(clamp(from.x),clamp(from.z));
        const end=this.node(clamp(goal.x),clamp(goal.z));
        if(!this.clear(city,from,start)||!this.clear(city,end,goal))
            return null;
        if(this.distance(from,goal)<35&&this.clear(city,from,goal))
            return [goal];
        const key=n=>this.KEY(n.x,n.z);
        const best=new Map([[key(start),0]]);
        const previous=new Map();
        const nodes=new Map([[key(start),start]]);
        const open=[{node:start,g:0,f:this.distance(start,end)}];
        const closed=new Set();
        let found=false;
        const offsets=[[80,0],[-80,0],[0,80],[0,-80]];
        while(open.length && closed.size<150){
            open.sort((a,b)=>a.f-b.f);
            const curr=open.shift(),here=curr.node,k=key(here);
            if(closed.has(k))continue;
            if(k===key(end)){found=true;break;}
            closed.add(k);
            for(const [dx,dz] of offsets){
                const next=this.node(here.x+dx,here.z+dz);
                if(Math.abs(next.x)>limit||Math.abs(next.z)>limit)continue;
                const nk=key(next);
                if(closed.has(nk)||!this.edge(city,here,next))continue;
                const cost=curr.g+this.STEP;
                if(cost>= (best.get(nk)??Infinity))continue;
                best.set(nk,cost);previous.set(nk,k);nodes.set(nk,next);
                open.push({node:next,g:cost,
                    f:cost+Math.abs(next.x-end.x)+Math.abs(next.z-end.z)});
            }
        }
        if(!found)return null;
        const path=[];
        let current=key(end);
        while(current!==key(start)){
            path.push(nodes.get(current));
            current=previous.get(current);
            if(!current)return null;
        }
        path.push(start);
        path.reverse();
        path.push(goal);
        return path;
    }
    static follow(city,car,waypoint,route,dt){
        if(!waypoint||!route)return {target:waypoint,blocked:false};
        const key=this.KEY(waypoint.x,waypoint.z);
        const stamp=!!city.bridgeRaised;
        let state=route.missionNavigation;
        if(!state||state.key!==key||state.raised!==stamp){
            const planned=this.plan(city,car,waypoint);
            state={key,raised:stamp,path:planned,index:0,
                retry:0,check:0,blocked:!planned};
            route.missionNavigation=state;
        }
        // Um caminho temporariamente indisponível é reavaliado, não
        // atravessado nem substituído por teleporte.
        if(!state.path){
            state.retry+=dt;
            if(state.retry>=1.25){
                state.retry=0;
                state.path=this.plan(city,car,waypoint);
                state.index=0;state.blocked=!state.path;
            }
            return {target:null,blocked:!state.path};
        }
        const path=state.path;
        while(state.index<path.length-1 &&
            this.distance(car,path[state.index])<12)
            state.index++;
        let target=path[state.index]||waypoint;
        state.check+=dt;
        if(state.check>=.35){
            state.check=0;
            // Replanifique se uma ponte levantar ou se um obstáculo
            // mudar no trajeto imediato.
            if(!this.clear(city,car,target)){
                const revised=this.plan(city,car,waypoint);
                if(revised){
                    state.path=revised;state.index=0;
                    target=revised[0]||waypoint;
                }else{
                    state.path=null;state.blocked=true;
                    return {target:null,blocked:true};
                }
            }
        }
        return {target,blocked:false};
    }
}
