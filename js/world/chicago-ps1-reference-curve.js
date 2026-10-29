/** R15: first source-shaped street transplanted into Undercover.
 * Original source shape, adapted placement. This does NOT certify the whole
 * PS1 map or the original street's real neighborhood/mission coordinates.
 */
class DriverChicagoPS1ReferenceCurve {
    static get source(){return typeof DriverChicagoSourceCurveR15!=='undefined'?
        DriverChicagoSourceCurveR15:this.sourceData;}
    static isCarvedBlock(x,z){return x===-280&&z===-120;}
    static fitPoint(point){
        const points=this.source.pointsOBJ,start=points[0],end=points.at(-1);
        const sx=end[0]-start[0],sz=end[1]-start[1],den=sx*sx+sz*sz;
        const a=(60*sx-80*sz)/den,b=(-80*sx-60*sz)/den;
        const dx=point[0]-start[0],dz=point[1]-start[1];
        return {x:-320+a*dx-b*dz,z:-80+b*dx+a*dz};
    }
    static plan(){
        let points=this.source.pointsOBJ.map(p=>this.fitPoint(p));
        // Two corner-cutting passes remove the raster stair steps. They keep
        // both exact attachment points and the source curve's convex hull.
        for(let pass=0;pass<2;pass++){
            const out=[points[0]];
            for(let i=0;i<points.length-1;i++){
                const a=points[i],b=points[i+1];
                for(const t of [.25,.75])out.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
            }
            out.push(points.at(-1));points=out;
        }
        const lots=[
            {x:-267,z:-99,width:12,depth:8,height:13,palette:1},
            {x:-286,z:-99,width:14,depth:8,height:11,palette:2},
            {x:-288,z:-140,width:18,depth:10,height:10,palette:0}
        ].map(b=>({...b,baseY:0,planned:true,kind:'residential',district:'ukrainian-village'}));
        return {points,lots,width:8,sourceSHA256:this.source.sourceSHA256,
            sourcePixels:this.source.sourcePixels.length,originalPlacementCertified:false,
            wholeMapCertified:false,mode:'source-shaped-curve-r15'};
    }
    static get placement(){return {key:"chicagoReferenceCurve",x:-280,z:-120,name:"chicago-r15-source-shaped-street"};}
    static prepare(city){
        const placement=this.placement;
        if(city?.preset?.id!=='chicago')return null;
        if(city[placement.key])return city[placement.key];
        const plan=this.plan(),vertices=[],edges=[];
        const district=placement.district||plan.lots[0]?.district||
            (typeof DriverChicagoCityPlan!=='undefined'?DriverChicagoCityPlan.districtAt(placement.x,placement.z)?.id:null)||
            'ukrainian-village';
        for(let i=0;i<plan.points.length;i++){
            const p=plan.points[i],a=plan.points[Math.max(0,i-1)],b=plan.points[Math.min(plan.points.length-1,i+1)];
            const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),half=plan.width/2;
            edges.push([{x:p.x-dz/length*half,z:p.z+dx/length*half},
                {x:p.x+dz/length*half,z:p.z-dx/length*half}]);
        }
        // Reject a submerged/blocked corridor before adding geometry/lots.
        for(let i=0;i<plan.points.length;i++){
            for(const p of [plan.points[i],...edges[i]])
                if(city.isWaterAt(p.x,p.z)||city.isPointBlocked(p.x,p.z,1.55,0))
                    throw Error('A curva PS1 R15 não cabe no corredor liberado');
            if(!i)continue;
            const [a,b]=edges[i-1],[c,d]=edges[i];
            for(const p of [a,b,c,b,d,c])vertices.push(p.x,.035,p.z);
        }
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();
        const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:0x45494b,side:THREE.DoubleSide}));
        mesh.name=placement.name;city.cityGroup.add(mesh);
        const trim=placement.foundation===false?[]:[[placement.x,.006,placement.z,50,.01,50,0x526848,false]];
        for(const lot of plan.lots){
            trim.push([lot.x,.013,lot.z,lot.width+2,.012,lot.depth+2,0x96988f,false]);
            city.districtBuildings.push(lot);
            const ix=Math.floor((lot.x+320)/160),iz=Math.floor((lot.z+360)/160),key=ix+':'+iz;
            if(!city.districtChunks.has(key))city.districtChunks.set(key,{
                id:key,x:-240+ix*160,z:-320+iz*160,buildings:[]});
            city.districtChunks.get(key).buildings.push(lot);
            city.buildingBoxes.push({minX:lot.x-lot.width/2,maxX:lot.x+lot.width/2,
                minZ:lot.z-lot.depth/2,maxZ:lot.z+lot.depth/2,chicagoPlanLot:true});
        }
        if(trim.length&&typeof DriverSpecialStructures!=='undefined')
            DriverSpecialStructures.pack(city.cityGroup,trim,'chicago-r15-curved-block');
        if(city.chicagoCityPlan){
            city.chicagoCityPlan.blocks.push({x:placement.x,z:placement.z,district,kind:'reference-street'});
            city.chicagoCityPlan.lots+=plan.lots.length;
            city.chicagoCityPlan.byDistrict[district]=(
                city.chicagoCityPlan.byDistrict[district]||0)+1;
        }
        city[placement.key]={...plan,mesh};return city[placement.key];
    }
}
if(typeof module!=='undefined'&&module.exports){
    DriverChicagoPS1ReferenceCurve.sourceData=require('../../chicago/reference-curve-r15.json');
    module.exports=DriverChicagoPS1ReferenceCurve;
}
