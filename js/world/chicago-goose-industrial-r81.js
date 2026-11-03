/**
 * R81 — Goose Island INDUSTRIAL YARDS in the playable Driver 2 Chicago.
 *
 * Non-PS1-certified procedural geography. Uses EXISTING R4/R6 north-south
 * road and the EXISTING R2 fixed east-channel bridge at z=240, without
 * inventing a bridge, relocating missions or touching the water mask.
 *
 * Two DRIVABLE loading yards with full-width/grade collision audits.
 * Physical crates have matching visible geometry and AABB; all roads
 * and truck maneuvers derive from these exact approved waypoint links.
 * A pre-existing R78 warehouse gets one NEW, actually enterable office
 * using the same on-foot E/exit system and dedicated interior furniture.
 */
class DriverChicagoGooseIndustrialR81 {
    static VERSION='r81-island-loading-yards-and-office';
    static PADS=[
        {id:'west-loading-yard',x:-218,z:250,w:12,d:18},
        {id:'east-loading-yard',x:-182,z:250,w:12,d:18}
    ];
    static ROUTES=[
        {id:'west-bay-spur',a:[-218,250],b:[-200,250],width:5},
        {id:'east-bay-spur',a:[-200,250],b:[-182,250],width:5},
        {id:'to-spine-crossing',a:[-200,250],b:[-200,240],width:5},
        {id:'existing-east-bridge-connection',
            a:[-200,240],b:[-160,240],width:5}
    ];
    static OFFICE={
        id:'r81-goose-yard-office',name:'Escritório do Pátio Industrial',
        kind:'r81-office',inside:{x:1440,z:0},sourceBlock:[-200,120]
    };
    static classify(){
        return {originalPS1StreetCoordinatesCertified:false,
            originalPS1BuildingsCertified:false,
            existingWaterAndBridgesUnchanged:true,
            missionsMigrated:false,canUseHeavyVehicleRoutes:true};
    }
    static floor(city,x,z){
        return typeof city?.getGroundHeightAt==='function'?
            city.getGroundHeightAt(x,z,null,true):0;
    }
    static dry(city,x,z,radius=1.45){
        return !city.isWaterAt?.(x,z)&&
            !city.isPointBlocked?.(x,z,radius,0)&&
            Number.isFinite(this.floor(city,x,z));
    }
    static lineAudit(city,route){
        if(city?.preset?.id!=='chicago')return {
            valid:false,reason:'wrong-city'};
        const a={x:route.a[0],z:route.a[1]},
            b={x:route.b[0],z:route.b[1]},
            dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
        if(len<2||len>50||route.width<4||route.width>7)
            return {valid:false,reason:'bad-road-size'};
        const nx=-dz/len,nz=dx/len,
            count=Math.ceil(len/1.3),half=route.width/2-.22;
        let checked=0;
        for(const offset of [0,-half,half]){
            let previous=null;
            for(let i=0;i<=count;i++){
                const t=i/count,x=a.x+dx*t+nx*offset,
                    z=a.z+dz*t+nz*offset;
                if(city.isWaterAt?.(x,z))
                    return {valid:false,reason:'water',checked};
                if(city.isPointBlocked?.(x,z,.48,0))
                    return {valid:false,reason:'obstacle',checked};
                const y=this.floor(city,x,z);
                if(!Number.isFinite(y))
                    return {valid:false,reason:'no-floor',checked};
                if(previous!==null&&Math.abs(y-previous)>.35+len/count*.55)
                    return {valid:false,reason:'grade',checked};
                previous=y;checked++;
            }
        }
        return {valid:true,reason:null,checked,length:len};
    }
    static padAudit(city,pad){
        const x0=pad.x-pad.w/2,x1=pad.x+pad.w/2,
            z0=pad.z-pad.d/2,z1=pad.z+pad.d/2;
        let prev=null,count=0;
        // A yard is one full rectangle; never paint a pad beyond a canal
        // or under an unseen warehouse collider.
        for(let x=x0;x<=x1+.01;x+=1.5){
            for(let z=z0;z<=z1+.01;z+=1.5){
                if(!this.dry(city,x,z,.35))return {
                    valid:false,reason:'pad-water-or-collision',at:{x,z}};
                const y=this.floor(city,x,z);
                if(prev!==null&&Math.abs(y-prev)>1.2)
                    return {valid:false,reason:'pad-grade',at:{x,z}};
                prev=y;count++;
            }
        }
        return {valid:true,reason:null,samples:count};
    }
    static plan(city){
        if(city?.preset?.id!=='chicago')return null;
        const pads=this.PADS.map(p=>({...p,...this.padAudit(city,p)}));
        const routes=this.ROUTES.map(s=>({
            id:s.id,from:{x:s.a[0],z:s.a[1]},
            to:{x:s.b[0],z:s.b[1]},width:s.width,
            ...this.lineAudit(city,s)}));
        // All linked. No isolated truck spurs / unsupported false graph.
        const ready=pads.every(p=>p.valid)&&routes.every(r=>r.valid)&&
            !!city.chicagoPS1RiverBranches&&
            !!city.chicagoGooseIslandStreet&&
            !!city.chicagoGooseIslandNorthYard;
        return {version:this.VERSION,...this.classify(),ready,
            padPlan:pads,routePlan:routes,
            yards:[],links:[],storageBoxes:[],existingWarehouses:[],
            dryFloorSamples:pads.reduce((n,p)=>n+(p.samples||0),0),
            roomRegistered:city.interiors?.some(p=>p.id===this.OFFICE.id)||false,
            facadeParts:0,interiorParts:0,roadGeometry:null,
            rejected:[...pads.filter(p=>!p.valid).map(p=>({
                id:p.id,reason:p.reason})),
                ...routes.filter(r=>!r.valid).map(r=>({
                    id:r.id,reason:r.reason}))]};
    }
    static registerOffice(city){
        if(city?.preset?.id!=='chicago'||
           !Array.isArray(city.interiors))return null;
        const existing=city.interiors.find(p=>p.id===this.OFFICE.id);
        if(existing)return existing;
        const lots=(city.districtBuildings||[]).filter(b=>
            b.pilotR78&&b.blockX===-200&&b.blockZ===120&&
            b.frontageSide===1&&!b.interiorId).sort((a,b)=>a.x-b.x);
        if(!lots.length)return null;
        const b=lots[0];
        const door={x:b.x,z:b.z+b.depth/2+2.8},
            back={x:door.x,z:door.z+4};
        if(!this.dry(city,door.x,door.z,.35)||
           !this.dry(city,back.x,back.z,.4)||b.interiorTier==='full')
            return null;
        const place={...this.OFFICE,
            inside:{...this.OFFICE.inside},
            door,r81SourceLot:b.id,
            accessible:true,storyCritical:false,interiorLevel:'partial'};
        city.interiors.push(place);
        b.interiorTier='partial';
        b.interiorId=place.id;
        return place;
    }
    static pack(root,parts,name){
        if(!parts.length||typeof DriverSpecialStructures==='undefined')
            return;
        DriverSpecialStructures.pack(root,parts,name);
    }
    static put(arr,x,y,z,w,h,d,color){
        if([x,y,z,w,h,d].every(Number.isFinite)&&w>0&&h>0&&d>0)
            arr.push([x,y,z,w,h,d,color,false]);
    }
    static decorateOffice(city){
        const place=city?.interiors?.find(p=>p.id===this.OFFICE.id);
        if(!place||!city.cityGroup)return 0;
        // R82 now supplies real collidable office props lazily. Do not
        // permanently install overlapping cosmetic-only R81 furniture.
        if(typeof DriverChicagoModularInteriorsR82!=='undefined'&&
           DriverChicagoModularInteriorsR82.manages(place)){
            place.r81FurnitureCount=0;
            return 0;
        }
        const {x,z}=place.inside,parts=[];
        // One partial office with clear player spawn x,z and exit z-8.8.
        // All shelving and paperwork are COSMETIC (no invisible AABB)
        // in the same real room as the existing enter/leave mechanism.
        this.put(parts,x-8,1.9,z+2.4,2.8,3.7,7,0x4a5c67);
        for(const dz of [-.4,2,4.4])
            this.put(parts,x-8,1.3,z+dz,3.0,.13,1.1,0xb0ada2);
        this.put(parts,x+5,1.0,z+4,6,1.8,2.5,0x635747);
        this.put(parts,x+5,2.0,z+4,5.6,.15,2.3,0x9c8269);
        this.put(parts,x+5,2.65,z+7.5,5.5,2.5,.18,0x85989a);
        this.put(parts,x+5,2.7,z+7.7,3.8,1.15,.08,0x3f5f72);
        this.put(parts,x-3,1.2,z+7.7,4.3,2.4,1.8,0x776351);
        this.put(parts,x-2.8,2.48,z+7.7,3.6,.16,1.8,0x9b8368);
        // Walkway center and exit untouched.
        this.pack(city.cityGroup,parts,'r81-goose-warehouse-office-furniture');
        place.r81FurnitureCount=parts.length;
        return parts.length;
    }
    static surface(city,pad,group){
        const verts=[],x0=pad.x-pad.w/2,x1=pad.x+pad.w/2,
            z0=pad.z-pad.d/2,z1=pad.z+pad.d/2;
        const v=(x,z)=>[x,this.floor(city,x,z)+.027,z];
        verts.push(...v(x0,z0),...v(x0,z1),...v(x1,z0),
            ...v(x1,z0),...v(x0,z1),...v(x1,z1));
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
        geo.computeVertexNormals();
        const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({
            color:0x50555a,side:THREE.DoubleSide}));
        mesh.name='r81-real-warehouse-yard-'+pad.id;
        mesh.userData.verifiedTruckYard=true;
        mesh.userData.originalPS1Certified=false;
        group.add(mesh);
        return mesh;
    }
    static spur(city,route,group){
        const vertices=[],a=route.from,b=route.to,
            dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),
            nx=-dz/length*route.width/2,
            nz=dx/length*route.width/2,steps=Math.ceil(length/2);
        const v=(t,sign)=>{
            const x=a.x+dx*t+nx*sign,z=a.z+dz*t+nz*sign;
            return [x,this.floor(city,x,z)+.047,z];
        };
        for(let i=0;i<steps;i++){
            const t=i/steps,u=(i+1)/steps,
                l=v(t,-1),r=v(t,1),l2=v(u,-1),r2=v(u,1);
            vertices.push(...l,...l2,...r,...r,...l2,...r2);
        }
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position',
            new THREE.Float32BufferAttribute(vertices,3));
        geo.computeVertexNormals();
        const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({
            color:0x454e54,side:THREE.DoubleSide}));
        mesh.name='r81-truck-spur-'+route.id;
        mesh.userData.realRoadLinkedToR49=true;
        group.add(mesh);
        return mesh;
    }
    static existingIndustrialFacades(city,report,group){
        const parts=[];
        // No duplicated industrial AABB/buildings: only decorate real R4/R6
        // objects, whose coordinates are derived from existing boxes.
        const base=[
            ...(city.chicagoGooseIslandStreet?.buildings||[]),
            ...(city.chicagoGooseIslandNorthYard?.buildings||[])
        ];
        for(let i=0;i<base.length;i++){
            const b=base[i],x=(b.minX+b.maxX)/2,
                z=(b.minZ+b.maxZ)/2,
                height=i<2?(i===0?11.8:13.5):(i===2?12.8:15.4),
                face=x<-200?1:-1,
                fx=x+face*((b.maxX-b.minX)/2+.12);
            // Industrial doors, loading lamps, upper grilles.
            for(const dz of [-4.2,4.2]){
                this.put(parts,fx,2.35,z+dz,.18,4.35,4.05,0x4c5962);
                this.put(parts,fx+face*.02,4.75,z+dz,.27,.4,4.35,0xa7adaf);
                this.put(parts,fx,Math.min(height-1.7,7.2),
                    z+dz,.18,1.6,2.7,0x344a56);
            }
            this.put(parts,fx+face*.14,height-.75,z,
                .4,.95,8.9,i%2?0x918279:0x898a82);
            report.existingWarehouses.push({x,z,source:i<2?'r4':'r6'});
        }
        // At R78 office front, a visible green industrial entry panel.
        const office=city.interiors.find(p=>p.id===this.OFFICE.id);
        if(office){
            const b=city.districtBuildings.find(b=>
                b.id===office.r81SourceLot);
            if(b){
                const z=b.z+b.depth/2+.16;
                this.put(parts,b.x,2.1,z,2.2,3.5,.18,0x4c8a73);
                this.put(parts,b.x,4.2,z,3.4,.55,.25,0xd8bb80);
            }
        }
        this.pack(group,parts,'r81-sequential-warehouse-fronts');
        report.facadeParts=parts.length;
    }
    static yardProps(city,report,group){
        const parts=[];
        const specs=[
            {x:-222.4,z:257.2,w:2.4,d:2.2},
            {x:-177.6,z:257.2,w:2.4,d:2.2},
            {x:-222.4,z:243.3,w:2.4,d:2.2},
            {x:-177.6,z:243.3,w:2.4,d:2.2}
        ];
        for(const [i,p] of specs.entries()){
            const r=Math.max(p.w,p.d)*.5;
            if(!this.dry(city,p.x,p.z,r+.2))continue;
            const y=this.floor(city,p.x,p.z),h=i%2===0?1.3:1.75;
            // Spawn AABB only alongside its *visible* cargo stack.
            const box={minX:p.x-p.w/2,maxX:p.x+p.w/2,
                minZ:p.z-p.d/2,maxZ:p.z+p.d/2,
                chicagoR81YardCargo:true};
            city.buildingBoxes.push(box);report.storageBoxes.push(box);
            this.put(parts,p.x,y+h/2,p.z,p.w,h,p.d,
                i%2?0xa28d6f:0x7a674f);
            this.put(parts,p.x,y+h+.06,p.z,p.w+.04,.12,p.d+.04,
                0x5b5045);
        }
        this.pack(group,parts,'r81-yard-real-cargo-AABB');
    }
    static build(city){
        if(city?.preset?.id!=='chicago'||!city.cityGroup)return null;
        if(city.chicagoGooseIndustrialR81)return city.chicagoGooseIndustrialR81;
        const report=this.plan(city);
        const root=new THREE.Group();root.name='chicago-r81-industrial-yards';
        root.userData.romPS1GeometryCertified=false;
        report.root=root;
        // Access gates must pass BEFORE adding ANY physical cargo.
        // If unsafe, do not draw fictitious roads, or append R49 edges.
        if(report.ready){
            city.cityGroup.add(root);
            for(const pad of report.padPlan){
                const mesh=this.surface(city,pad,root);
                report.yards.push({id:pad.id,mesh,x:pad.x,z:pad.z});
            }
            report.links=report.routePlan.map(s=>({
                id:'r81-'+s.id,from:s.from,to:s.to,width:s.width,
                source:'R81-approved-linked-industrial-asphalt',
                originalPS1GeometryCertified:false}));
            for(const link of report.routePlan)this.spur(city,link,root);
            this.existingIndustrialFacades(city,report,root);
            this.yardProps(city,report,root);
        }
        report.roomRegistered=city.interiors?.some(p=>p.id===this.OFFICE.id)||false;
        city.chicagoGooseIndustrialR81=report;
        if(city._spatialCollisions)city._spatialCollisions.boxes=null;
        return report;
    }
}
if(typeof window!=='undefined')
    window.DriverChicagoGooseIndustrialR81=DriverChicagoGooseIndustrialR81;
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoGooseIndustrialR81;
