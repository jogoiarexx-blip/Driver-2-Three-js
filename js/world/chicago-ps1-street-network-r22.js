/**
 * Chicago R22 — malha navegável derivada dos corredores já digitalizados
 * de pavimento dos 54 setores PS1 (R15–R20).
 *
 * Os corredores da fonte preservam a forma observada, mas são deslocados
 * e redimensionados no Undercover. O curto acesso à malha 80 m é inferido
 * a partir da topologia, NÃO certificado como estrada da ROM.
 * Mantém missões, colisores, saves e tráfego original intactos.
 */
class DriverChicagoPS1StreetNetwork {
    static SOURCE_NAMES=[
        ['curve','chicagoReferenceCurve'],
        ['extension','chicagoReferenceExtension'],
        ['loop','chicagoReferenceLoop'],
        ['bridge','chicagoReferenceBridge'],
        ['north-stem','chicagoReferenceNorthStem'],
        ['north-continuation','chicagoReferenceNorthContinuation'],
        ['north-branch','chicagoReferenceNorthBranch'],
        ['west-arterial','chicagoReferenceArterial']
    ];
    static sourcePaths(city){
        const result=[];
        for(const [id,key] of this.SOURCE_NAMES){
            const data=id.startsWith('north-')?
                city?.chicagoReferenceNorthNetwork?.segments?.[id.slice(6)]:
                city?.[key];
            if(data?.points?.length>1)
                result.push({id,points:data.points,width:data.width||8,
                    provenance:'PS1-surface-reference-adapted'});
        }
        return result;
    }
    static distancePointSegment(p,a,b){
        const dx=b.x-a.x,dz=b.z-a.z;
        const t=Math.max(0,Math.min(1,
            ((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));
        return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);
    }
    static simplify(points,tolerance=1.15){
        if(!Array.isArray(points)||points.length<3)return points||[];
        const keep=new Set([0,points.length-1]);
        const queue=[[0,points.length-1]];
        while(queue.length){
            const [lo,hi]=queue.pop();let best=tolerance,index=-1;
            for(let i=lo+1;i<hi;i++){
                const d=this.distancePointSegment(points[i],
                    points[lo],points[hi]);
                if(d>best){best=d;index=i;}
            }
            if(index>=0){
                keep.add(index);
                queue.push([lo,index],[index,hi]);
            }
        }
        return [...keep].sort((a,b)=>a-b).map(i=>points[i]);
    }
    static connectionPlan(city){
        const branch=city?.chicagoReferenceNorthNetwork?.segments?.branch;
        const last=branch?.points?.at(-1);
        if(!last)return [];
        // O braço leste da bifurcação chega perto da antiga rua grid z=320.
        // O segmento é novo: sua implantação exige auditoria AABB e água.
        return [{
            id:'north-branch-to-wrigley-grid',
            from:{x:last.x,z:last.z},
            to:{x:-240,z:320},
            width:8,sourceKind:'topology-inferred-grid-feeder'
        }];
    }
    static checkConnector(city,link){
        if(!link?.from||!link?.to)return {valid:false,reason:'missing-endpoint'};
        const {from:a,to:b}=link,dx=b.x-a.x,dz=b.z-a.z;
        const length=Math.hypot(dx,dz);
        if(!Number.isFinite(length)||length<2||length>90)
            return {valid:false,reason:'invalid-length'};
        const nx=-dz/length,nz=dx/length,half=link.width/2;
        const steps=Math.max(3,Math.ceil(length/2));
        for(let i=0;i<=steps;i++){
            const t=i/steps,x=a.x+dx*t,z=a.z+dz*t;
            for(const offset of [-half+.65,0,half-.65]){
                const px=x+nx*offset,pz=z+nz*offset;
                if(city.isWaterAt?.(px,pz))
                    return {valid:false,reason:'water',x:px,z:pz};
                if(city.isPointBlocked?.(px,pz,.6,0))
                    return {valid:false,reason:'collision',x:px,z:pz};
            }
        }
        return {valid:true,length,pointsTested:(steps+1)*3};
    }
    static makeMesh(city,link){
        const {from:a,to:b,width}=link,dx=b.x-a.x,dz=b.z-a.z,
            length=Math.hypot(dx,dz),nx=-dz/length*width/2,
            nz=dx/length*width/2,vertices=[];
        for(const [x,z] of [
            [a.x-nx,a.z-nz],[b.x-nx,b.z-nz],[a.x+nx,a.z+nz],
            [b.x-nx,b.z-nz],[b.x+nx,b.z+nz],[a.x+nx,a.z+nz]
        ])vertices.push(x,.039,z);
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position',
            new THREE.Float32BufferAttribute(vertices,3));
        geo.computeVertexNormals();
        const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({
            color:0x45494b,side:THREE.DoubleSide
        }));
        mesh.name='chicago-r22-'+link.id;
        mesh.userData.chicagoPS1StreetConnector=true;
        mesh.userData.originalPlacementCertified=false;
        city.cityGroup.add(mesh);
        return mesh;
    }
    static build(city){
        if(city?.preset?.id!=='chicago')return null;
        if(city.chicagoPS1StreetNetwork)return city.chicagoPS1StreetNetwork;
        const source=this.sourcePaths(city),planned=this.connectionPlan(city),
            links=[];
        for(const candidate of planned){
            const audit=this.checkConnector(city,candidate);
            const record={...candidate,...audit,mesh:null};
            if(audit.valid&&typeof THREE!=='undefined')
                record.mesh=this.makeMesh(city,candidate);
            links.push(record);
        }
        const radarPaths=[
            ...source.map(p=>({...p,points:this.simplify(p.points)})),
            ...links.filter(p=>p.valid).map(p=>({
                id:p.id,points:[p.from,p.to],width:p.width,
                provenance:'topology-inferred-grid-feeder'
            }))
        ];
        const report={
            sourceCorridors:source.length,
            connectorsPlanned:links.length,
            connectorsAccepted:links.filter(l=>l.valid).length,
            connectorsRejected:links.filter(l=>!l.valid)
                .map(l=>({id:l.id,reason:l.reason})),
            links,radarPaths,
            missionsMigrated:false,
            wholePS1MapCertified:false,
            mode:'source-topology-with-audited-grid-feeder-r22'
        };
        city.chicagoPS1StreetNetwork=report;
        return report;
    }
    static drawRadar(ctx,city,pos,scale,w,h){
        const paths=city?.chicagoPS1StreetNetwork?.radarPaths||[];
        if(!paths.length||!Number.isFinite(scale)||scale<=0)return 0;
        const visibleX=(w/2+24)/scale,visibleZ=(h/2+24)/scale;
        let drawn=0;
        ctx.save();
        for(const path of paths){
            if(!path.points||path.points.length<2)continue;
            const pts=path.points.filter(p=>Number.isFinite(p.x)&&
                Number.isFinite(p.z));
            if(pts.length<2)continue;
            const inView=pts.some(p=>Math.abs(p.x-pos.x)<visibleX&&
                Math.abs(p.z-pos.z)<visibleZ);
            if(!inView){
                // O polígono pode cruzar a vista mesmo com os pontos fora:
                // não esconder linhas compridas que atravessam a tela.
                let crossing=false;
                for(let i=1;i<pts.length;i++){
                    const a=pts[i-1],b=pts[i];
                    if(Math.max(a.x,b.x)>=pos.x-visibleX&&
                       Math.min(a.x,b.x)<=pos.x+visibleX&&
                       Math.max(a.z,b.z)>=pos.z-visibleZ&&
                       Math.min(a.z,b.z)<=pos.z+visibleZ){
                        crossing=true;break;
                    }
                }
                if(!crossing)continue;
            }
            ctx.beginPath();
            for(let i=0;i<pts.length;i++){
                const x=(pts[i].x-pos.x)*scale,
                    y=-(pts[i].z-pos.z)*scale;
                if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
            }
            ctx.lineJoin='round';ctx.lineCap='round';
            ctx.lineWidth=Math.max(1.7,Math.min(5,path.width*scale*.70));
            ctx.strokeStyle=path.provenance==='topology-inferred-grid-feeder'?
                '#c4bfab':'#8fa1aa';
            ctx.stroke();drawn++;
        }
        ctx.restore();
        return drawn;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoPS1StreetNetwork;
