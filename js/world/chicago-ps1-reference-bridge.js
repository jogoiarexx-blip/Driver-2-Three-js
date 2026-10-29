/** R18: source-shaped northern continuation with a reconstructed canal deck.
 * Source alignment is shared with R15-R17; bridge grade and placement are
 * adapted to Undercover, not certified PS1 bridge geometry or mission data.
 */
const DriverChicagoSourceBridgeBase=typeof module!=='undefined'&&module.exports?
    require('./chicago-ps1-reference-curve.js'):DriverChicagoPS1ReferenceCurve;
class DriverChicagoPS1ReferenceBridge extends DriverChicagoSourceBridgeBase {
    static get source(){return typeof DriverChicagoSourceBridgeR18!=='undefined'?
        DriverChicagoSourceBridgeR18:this.bridgeData;}
    static fitPoint(point){return DriverChicagoSourceBridgeBase.fitPoint(point);}
    static get placement(){return {key:'chicagoReferenceBridge',x:-360,z:120,foundation:false,name:'chicago-r18-source-north-road'};}
    static plan(){
        if(!this.cachedPlan){
            const p=super.plan(),points=[p.points[0]];
            for(let i=1;i<p.points.length;i++){
                const a=p.points[i-1],b=p.points[i],dz=b.z-a.z;
                const cuts=Math.abs(dz)<1e-9?[]:[22,34,66,80].map(z=>(z-a.z)/dz).filter(t=>t>0&&t<1).sort((a,b)=>a-b);
                for(const t of cuts)points.push({x:a.x+(b.x-a.x)*t,z:a.z+dz*t});
                points.push(b);
            }
            p.points=points;p.lots=[];p.mode='source-north-bridge-r18';this.cachedPlan=p;
        }
        return this.cachedPlan;
    }
    static axisAt(z){
        const p=this.plan().points;
        for(let i=1;i<p.length;i++){
            const a=p[i-1],b=p[i];
            if(z<Math.min(a.z,b.z)||z>Math.max(a.z,b.z)||Math.abs(b.z-a.z)<1e-9)continue;
            return a.x+(b.x-a.x)*(z-a.z)/(b.z-a.z);
        }
        return null;
    }
    static distance(x,z){
        if(!Number.isFinite(x)||!Number.isFinite(z))return Infinity;
        const p=this.plan().points;let best=Infinity;
        for(let i=1;i<p.length;i++){
            const a=p[i-1],b=p[i],dx=b.x-a.x,dz=b.z-a.z;
            const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
            best=Math.min(best,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));
        }
        return best;
    }
    static deckPolygon(){
        if(this.cachedPolygon)return this.cachedPolygon;
        const points=this.bridgeEdges(22,80).flat().sort((a,b)=>a.x-b.x||a.z-b.z);
        const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
        const half=items=>{const out=[];for(const p of items){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
        const lower=half(points),upper=half([...points].reverse());
        this.cachedPolygon=lower.slice(0,-1).concat(upper.slice(0,-1));return this.cachedPolygon;
    }
    static isBridgeDeck(x,z){
        if(!Number.isFinite(x)||!Number.isFinite(z)||z<12||z>90)return false;
        const p=this.deckPolygon();
        return p.every((a,i)=>{const b=p[(i+1)%p.length];return (b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x)>=-1e-6;});
    }
    static profile(z){return .18*Math.max(0,Math.min(1,(z-22)/12,(80-z)/14));}
    static deckHeight(x,z){return this.isBridgeDeck(x,z)?this.profile(z):null;}
    static openingAt(z){
        const p=this.deckPolygon(),xs=[];
        for(let i=0;i<p.length;i++){
            const a=p[i],b=p[(i+1)%p.length];
            if(z<Math.min(a.z,b.z)||z>Math.max(a.z,b.z)||Math.abs(b.z-a.z)<1e-9)continue;
            xs.push(a.x+(b.x-a.x)*(z-a.z)/(b.z-a.z));
        }
        return xs.length?{minX:Math.min(...xs)-2,maxX:Math.max(...xs)+2}:null;
    }
    static bridgeEdges(start,end){
        const path=[{x:this.axisAt(start),z:start},...this.plan().points.filter(p=>p.z>start&&p.z<end),{x:this.axisAt(end),z:end}];
        return path.map((p,i)=>{
            const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)];
            const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
            return [-1,1].map(sign=>({x:p.x-sign*dz/len*8,z:p.z+sign*dx/len*8}));
        });
    }
    static railSegments(){
        if(this.cachedRails)return this.cachedRails;
        const polygon=this.deckPolygon();this.cachedRails=[];
        for(let i=0;i<polygon.length;i++){
            const a=polygon[i],b=polygon[(i+1)%polygon.length],dz=b.z-a.z;
            if(Math.abs(dz)<1e-9)continue;
            const low=Math.max(0,Math.min((28-a.z)/dz,(72-a.z)/dz));
            const high=Math.min(1,Math.max((28-a.z)/dz,(72-a.z)/dz));
            if(low>=high)continue;
            const at=t=>({x:a.x+(b.x-a.x)*t,z:a.z+dz*t});
            const cuts=[low,...[34,66].map(z=>(z-a.z)/dz).filter(t=>t>low&&t<high).sort((a,b)=>a-b),high];
            for(let j=1;j<cuts.length;j++)this.cachedRails.push({a:at(cuts[j-1]),b:at(cuts[j])});
        }
        return this.cachedRails;
    }
    static railBlocked(x,z,radius=1.2,y=0){
        if(!Number.isFinite(x)||!Number.isFinite(z)||z<20||z>80||y< -1||y>=1.4)return false;
        return this.railSegments().some(({a,b})=>{
            const dx=b.x-a.x,dz=b.z-a.z;
            const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
            return Math.hypot(x-a.x-dx*t,z-a.z-dz*t)<.18+radius;
        });
    }
    static prepare(city){
        if(city?.preset?.id!=='chicago')return null;
        if(city.chicagoReferenceBridge)return city.chicagoReferenceBridge;
        const result=super.prepare(city),positions=result.mesh.geometry.attributes.position;
        for(let i=0;i<positions.count;i++)positions.setY(i,.035+(this.deckHeight(positions.getX(i),positions.getZ(i))??0));
        positions.needsUpdate=true;result.mesh.geometry.computeVertexNormals();
        result.mesh.geometry.computeBoundingBox();result.mesh.geometry.computeBoundingSphere();
        const deck=[],rails=[];
        const triangle=(out,a,b,c)=>out.push(...a,...b,...c);
        const v=p=>[p.x,this.profile(p.z),p.z];
        const clip=(points,z,above)=>{
            const out=[];
            for(let i=0;i<points.length;i++){
                const a=points[i],b=points[(i+1)%points.length],inside=p=>above?p.z>=z:p.z<=z;
                if(inside(a))out.push(a);
                if(inside(a)!==inside(b)){const t=(z-a.z)/(b.z-a.z);out.push({x:a.x+(b.x-a.x)*t,z});}
            }
            return out;
        };
        for(const [lo,hi] of [[12,22],[22,34],[34,66],[66,80],[80,90]]){
            const polygon=clip(clip(this.deckPolygon(),lo,true),hi,false);
            for(let i=1;i<polygon.length-1;i++)triangle(deck,v(polygon[0]),v(polygon[i]),v(polygon[i+1]));
        }
        for(const {a,b} of this.railSegments()){
            const low=p=>[p.x,this.profile(p.z)+.05,p.z],high=p=>[p.x,this.profile(p.z)+.85,p.z];
            triangle(rails,low(a),high(a),low(b));triangle(rails,high(a),high(b),low(b));
        }
        for(const [name,data,color] of [['chicago-r18-bridge-deck',deck,0x727b80],['chicago-r18-bridge-rails',rails,0xa6afb2]]){
            const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(data,3));geo.computeVertexNormals();
            const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide}));mesh.name=name;city.cityGroup.add(mesh);
        }
        return result;
    }
}
if(typeof module!=='undefined'&&module.exports){
    DriverChicagoPS1ReferenceBridge.bridgeData=require('../../chicago/reference-bridge-r18.json');
    module.exports=DriverChicagoPS1ReferenceBridge;
}
