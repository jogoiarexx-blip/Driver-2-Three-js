/**
 * Chicago R49: navigation across the legacy 80-unit roads and R48's
 * secondary junctions. Only physically traversable street segments become
 * graph edges. No teleports or inferred road through a building/water.
 * The graph is cached per city, invalidated by raising the drawbridge.
 *
 * Source geometry is procedural/adapted, not PS1 ROM-certified.
 */
class DriverChicagoMixedNavigationR49 {
    static cache=new WeakMap();
    static STEP=80;
    static key(p){return Math.round(p.x*2)/2+','+Math.round(p.z*2)/2;}
    static distance(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
    static bridgeClosed(city,a,b){
        if(!city?.bridgeRaised)return false;
        // Only the original central movable bridge; the fixed eastern
        // crossing must not be closed by this switch.
        return Math.max(Math.abs(a.x),Math.abs(b.x))<13 &&
            Math.min(a.z,b.z)<35 && Math.max(a.z,b.z)>65;
    }
    static clear(city,a,b,offsets=true,offsetWidth=4){
        if(!a||!b||this.bridgeClosed(city,a,b))return false;
        const dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz);
        if(!Number.isFinite(dist)||dist<.01)return false;
        const nx=-dz/dist,nz=dx/dist;
        const clearance=typeof DriverRoadGeometry!=='undefined'?
            (p,q)=>DriverRoadGeometry.segmentDrivable(
                city,p.x,p.z,q.x,q.z,1.45):
            (p,q)=>{
                for(let i=0,n=Math.max(1,Math.ceil(this.distance(p,q)/3));i<=n;i++){
                    const t=i/n,x=p.x+(q.x-p.x)*t,z=p.z+(q.z-p.z)*t;
                    if(city.isWaterAt?.(x,z)||city.isPointBlocked?.(x,z,1.45,0))
                        return false;
                }
                return true;
            };
        if(!clearance(a,b))return false;
        if(offsets)for(const offset of [-offsetWidth,offsetWidth]){
            if(!clearance(
                {x:a.x+nx*offset,z:a.z+nz*offset},
                {x:b.x+nx*offset,z:b.z+nz*offset}))return false;
        }
        return true;
    }
    static compile(city){
        if(city?.preset?.id!=='chicago')return null;
        const stamp=!!city.bridgeRaised,build=city.buildSequence||0;
        const count=city.buildingBoxes?.length||0;
        const sourceStamp=city.chicagoPS1StreetNetwork?.radarPaths?.length||0;
        const cached=this.cache.get(city);
        if(cached&&cached.stamp===stamp&&cached.build===build &&
            cached.count===count&&cached.sourceStamp===sourceStamp)return cached;
        const nodes=new Map(),adj=new Map(),edges=new Set();
        const addNode=p=>{
            const key=this.key(p);
            if(!nodes.has(key)){nodes.set(key,{x:p.x,z:p.z});
                adj.set(key,[]);}
            return key;
        };
        const add=(a,b,offset=4)=>{
            const ak=addNode(a),bk=addNode(b);
            if(ak===bk)return;
            const edgeKey=[ak,bk].sort().join('|');
            if(edges.has(edgeKey)||!this.clear(city,a,b,true,offset))return;
            edges.add(edgeKey);
            const weight=this.distance(a,b);
            adj.get(ak).push({key:bk,cost:weight});
            adj.get(bk).push({key:ak,cost:weight});
        };
        const limit=Math.min(320,Math.max(80,city.roadExtent||320));
        const r48=city.chicagoConnectorsR48?.ready &&
            typeof DriverChicagoConnectorsR48!=='undefined'?
            DriverChicagoConnectorsR48.topology():null;
        const r50=city.chicagoConnectorsR50?.ready &&
            typeof DriverChicagoConnectorsR50!=='undefined'?
            DriverChicagoConnectorsR50.topology():null;
        const r52=city.chicagoGooseEastR52?.ready &&
            typeof DriverChicagoGooseEastR52!=='undefined'?
            DriverChicagoGooseEastR52.topology():null;
        const secondary=[...(r48?.edges||[]),...(r50?.edges||[]),
            ...(r52?.edges||[])];
        const gateways=secondary.flatMap(e=>[e.from,e.to]);
        // Subdivide existing 80-unit arteries where an R48 gateway joins.
        // Without splitting, a local road would end at a disconnected node.
        for(let x=-limit;x<=limit;x+=this.STEP){
            for(let z=-limit;z<=limit;z+=this.STEP){
                const from={x,z};addNode(from);
                for(const [dx,dz] of [[this.STEP,0],[0,this.STEP]]){
                    const to={x:x+dx,z:z+dz};
                    if(Math.abs(to.x)>limit||Math.abs(to.z)>limit)continue;
                    const breaks=[from,...gateways.filter(p=>
                        (dx===0?p.x===x&&p.z>z&&p.z<to.z:
                         p.z===z&&p.x>x&&p.x<to.x)),to];
                    breaks.sort((a,b)=>dx===0?a.z-b.z:a.x-b.x);
                    for(let i=1;i<breaks.length;i++)
                        add(breaks[i-1],breaks[i]);
                }
            }
        }
        for(const edge of secondary)add(edge.from,edge.to);
        // R51: roads already drawn from PS1-adapted surface references.
        // The separately audited R22 feeder is the only inferred link.
        const sources=(city.chicagoPS1StreetNetwork?.radarPaths||[])
            .filter(p=>p?.provenance==='PS1-surface-reference-adapted'||
                p?.provenance==='topology-inferred-grid-feeder');
        let sourceEdges=0,sourcePoints=0;
        for(const path of sources){
            const points=path.points||[];
            if(points.length<2)continue;
            sourcePoints+=points.length;
            let previous=points[0];
            for(let i=1;i<points.length;i++){
                const target=points[i],length=this.distance(previous,target);
                if(!Number.isFinite(length)||length<.01||length>160){
                    previous=target;continue;
                }
                const start=previous;
                for(let step=1,n=Math.ceil(length/16);step<=n;step++){
                    const t=step/n,next={
                        x:start.x+(target.x-start.x)*t,
                        z:start.z+(target.z-start.z)*t
                    };
                    const before=edges.size;
                    // Actual 8m source pavement is narrower than grid.
                    add(previous,next,1.7);
                    if(edges.size>before)sourceEdges++;
                    previous=next;
                }
            }
        }
        // Spatial buckets avoid rescanning every remote R39-R44 road node
        // whenever one NPC asks for a nearby starting intersection.
        const buckets=new Map(),bucketSize=48;
        for(const [id,p] of nodes){
            if(!adj.get(id)?.length)continue;
            const bucket=Math.floor(p.x/bucketSize)+','+
                Math.floor(p.z/bucketSize);
            if(!buckets.has(bucket))buckets.set(bucket,[]);
            buckets.get(bucket).push(id);
        }
        const graph={nodes,adj,edges:edges.size,stamp,build,count,
            sourceStamp,buckets,bucketSize,
            secondaryNodes:(r48?.nodes.length||0)+(r50?.nodes.length||0)+
                (r52?.nodes.length||0),
            gateways:(r48?.gridExits||0)+(r50?.gridExits||0)+
                (r52?.gridExits||0),
            gooseEastLinks:r52?.edges.length||0,
            sourceCorridors:sources.length,sourcePoints,sourceEdges};
        this.cache.set(city,graph);
        return graph;
    }
    static nearest(city,graph,position,radius=68){
        if(!graph||!Number.isFinite(position?.x)||
           !Number.isFinite(position?.z))return null;
        const candidates=[];
        const size=graph.bucketSize||48;
        for(let x=Math.floor((position.x-radius)/size);
                x<=Math.floor((position.x+radius)/size);x++){
            for(let z=Math.floor((position.z-radius)/size);
                    z<=Math.floor((position.z+radius)/size);z++){
                for(const key of graph.buckets.get(x+','+z)||[]){
                    const p=graph.nodes.get(key);
                    if(this.distance(position,p)<=radius)
                        candidates.push([key,p]);
                }
            }
        }
        candidates.sort((a,b)=>
            this.distance(position,a[1])-this.distance(position,b[1]));
        for(const [key,node] of candidates){
            if(this.distance(position,node)<.1 ||
               this.clear(city,position,node,false))
                return key;
        }
        return null;
    }
    static plan(city,from,goal){
        const graph=this.compile(city);
        if(!graph)return null;
        const started=typeof performance!=='undefined'&&performance.now?
            performance.now():Date.now();
        const stats=graph.planStats||(graph.planStats={
            planned:0,failed:0,lastMs:0,worstMs:0
        });
        let success=false;
        try{
        const first=this.nearest(city,graph,from);
        const last=this.nearest(city,graph,goal);
        if(!first||!last)return null;
        const start=graph.nodes.get(first),end=graph.nodes.get(last);
        const scores=new Map([[first,0]]),previous=new Map();
        const queue=[];
        // Binary heap avoids O(N log N) resorting per expanded vertex.
        const push=item=>{
            let i=queue.length;queue.push(item);
            while(i>0){const parent=(i-1)>>1;
                if(queue[parent].f<=item.f)break;
                queue[i]=queue[parent];i=parent;
            }
            queue[i]=item;
        };
        const pop=()=>{
            const top=queue[0],last=queue.pop();
            if(queue.length){let i=0;
                while(i*2+1<queue.length){
                    let j=i*2+1;
                    if(j+1<queue.length&&queue[j+1].f<queue[j].f)j++;
                    if(last.f<=queue[j].f)break;
                    queue[i]=queue[j];i=j;
                }
                queue[i]=last;
            }
            return top;
        };
        push({key:first,g:0,f:this.distance(start,end)});
        const done=new Set();
        let found=false;
        while(queue.length&&done.size<Math.min(3500,graph.nodes.size)){
            const current=pop();
            if(done.has(current.key))continue;
            if(current.key===last){found=true;break;}
            done.add(current.key);
            for(const edge of graph.adj.get(current.key)||[]){
                if(done.has(edge.key))continue;
                const nextG=current.g+edge.cost;
                if(nextG>=(scores.get(edge.key)??Infinity))continue;
                scores.set(edge.key,nextG);previous.set(edge.key,current.key);
                push({key:edge.key,g:nextG,
                    f:nextG+this.distance(graph.nodes.get(edge.key),end)});
            }
        }
        if(!found)return null;
        const keys=[last];let cursor=last;
        while(cursor!==first){
            cursor=previous.get(cursor);
            if(!cursor)return null;
            keys.push(cursor);
        }
        keys.reverse();
        const path=keys.map(k=>({...graph.nodes.get(k)}));
        if(this.distance(path.at(-1),goal)>1 &&
           this.clear(city,path.at(-1),goal,false))
            path.push({x:goal.x,z:goal.z});
        success=true;
        return path;
        }finally{
            const ms=(typeof performance!=='undefined'&&performance.now?
                performance.now():Date.now())-started;
            stats.planned++;
            if(!success)stats.failed++;
            stats.lastMs=+Math.max(0,ms).toFixed(2);
            stats.worstMs=Math.max(stats.worstMs,stats.lastMs);
        }
    }
    static follow(city,car,goal,holder,dt){
        if(!goal||!holder||city?.preset?.id!=='chicago')
            return {target:null,blocked:true};
        const stamp=!!city.bridgeRaised,build=city.buildSequence||0;
        // Mobile NPC positions may vary every frame. Replan at most every
        // 1.5s, or on a changed bridge, target neighborhood or city rebuild.
        const sector=x=>Math.round(x/32);
        const goalKey=sector(goal.x)+','+sector(goal.z);
        let state=holder.mixedNavigationR49;
        if(!state||state.stamp!==stamp||state.build!==build ||
           state.goalKey!==goalKey){
            const path=this.plan(city,car,goal);
            state={path,index:0,goalKey,stamp,build,retry:0,check:0};
            holder.mixedNavigationR49=state;
        }
        if(!state.path){
            state.retry+=Math.max(0,dt);
            if(state.retry>=1.5){
                state.retry=0;
                state.path=this.plan(city,car,goal);
                state.index=0;
            }
            return {target:null,blocked:!state.path};
        }
        while(state.index<state.path.length-1 &&
            this.distance(car,state.path[state.index])<11)
            state.index++;
        let target=state.path[state.index];
        state.check+=Math.max(0,dt);
        if(state.check>=.6){
            state.check=0;
            // The car must never steer diagonally across an occluding block.
            if(this.distance(car,target)>1 &&
               !this.clear(city,car,target,false)){
                state.path=this.plan(city,car,goal);
                state.index=0;
                if(!state.path)return {target:null,blocked:true};
                target=state.path[0];
            }
        }
        return {target,blocked:false,graph:true,
            remaining:state.path.length-state.index-1};
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoMixedNavigationR49;
