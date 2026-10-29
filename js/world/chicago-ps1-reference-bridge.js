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
        if(!this.cachedPlan){const p=super.plan();p.lots=[];p.mode='source-north-bridge-r18';this.cachedPlan=p;}
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
    static isBridgeDeck(x,z){return z>=22&&z<=80&&this.distance(x,z)<=6;}
    static profile(z){return .18*Math.max(0,Math.min(1,(z-22)/12,(80-z)/14));}
    static deckHeight(x,z){return this.isBridgeDeck(x,z)?this.profile(z):null;}
    static openingAt(z){const x=this.axisAt(z);return x===null?null:{minX:x-8,maxX:x+8};}
    static bridgeEdges(start,end){
        const path=[{x:this.axisAt(start),z:start},...this.plan().points.filter(p=>p.z>start&&p.z<end),{x:this.axisAt(end),z:end}];
        return path.map((p,i)=>{
            const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)];
            const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
            return [-1,1].map(sign=>({x:p.x-sign*dz/len*6,z:p.z+sign*dx/len*6}));
        });
    }
    static railSegments(){
        if(!this.cachedRails){const edges=this.bridgeEdges(28,72);this.cachedRails=[];
            for(let i=1;i<edges.length;i++)for(const side of [0,1])this.cachedRails.push({a:edges[i-1][side],b:edges[i][side]});}
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
        const deck=[],rails=[],edges=this.bridgeEdges(22,80);
        const triangle=(out,a,b,c)=>out.push(...a,...b,...c);
        const v=p=>[p.x,this.profile(p.z),p.z];
        for(let i=1;i<edges.length;i++){
            const [a,b]=edges[i-1],[c,d]=edges[i];
            triangle(deck,v(a),v(b),v(c));triangle(deck,v(b),v(d),v(c));
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
