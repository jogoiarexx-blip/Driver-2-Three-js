/**
 * Chicago R84 — two additional genuinely playable R78 shells.
 *
 * Compact room plans and a 24-step, 7.2-unit vertical pilot:
 *   ground -> intermediate side landing (3.6) -> high landing (7.2).
 * This is not a complete second/third storey or a ROM-certified PS1 layout.
 *
 * Stair meshes and step heights share one blueprint; no fake lift/teleport.
 * Doors have a matching on/off collider and ONE visual group loads on entry.
 */
class DriverChicagoVerticalInteriorsR84 {
    static VERSION='r84-vertical-24-step-lazy';
    static SITES=[
        {id:'r84-greektown-loft',name:'Loft de Greektown',
            kind:'r84-loft',blockX:-120,blockZ:-200,
            insideX:660,tall:true},
        {id:'r84-prairie-office',name:'Escritório da Prairie',
            kind:'r84-office',blockX:40,blockZ:-200,
            insideX:720,tall:false}
    ];
    static manages(place){
        return !!place&&this.SITES.some(s=>s.id===place.id);
    }
    static nearRoom(city,x,z){
        // Hot-path fast reject, especially important for mobile vehicles.
        if(city?.preset?.id!=='chicago'||x<648||x>732||
            z<-12||z>12)return null;
        return (city.interiors||[]).find(p=>this.manages(p)&&
            Math.abs(x-p.inside.x)<12.7&&
            Math.abs(z-p.inside.z)<11.7)||null;
    }
    static register(city){
        if(city?.preset?.id!=='chicago'||!Array.isArray(city.interiors))
            return 0;
        let n=0;
        for(const site of this.SITES){
            if(city.interiors.some(p=>p.id===site.id))continue;
            const lot=(city.districtBuildings||[]).find(b=>
                b.pilotR78&&b.blockX===site.blockX&&
                b.blockZ===site.blockZ&&b.frontageSide===1&&
                b.interiorTier==='shell-planned'&&!b.interiorId);
            if(!lot)continue;
            const door={x:lot.x,z:lot.z+lot.depth/2+2.8};
            if(city.isWaterAt?.(door.x,door.z)||
               city.isWaterAt?.(door.x,door.z+4)||
               city.isPointBlocked?.(door.x,door.z+4,.4,0))
                continue;
            city.interiors.push({
                id:site.id,name:site.name,kind:site.kind,
                accessible:true,storyCritical:false,
                door,inside:{x:site.insideX,z:0},
                r84SourceLot:lot.id,
                interiorLevel:site.tall?'extended-stair-pilot':'single-floor'
            });
            lot.interiorTier='partial';lot.interiorId=site.id;n++;
        }
        return n;
    }
    static part(blue,dx,y,dz,w,h,d,color,solid=false,label=''){
        const x=blue.x+dx,z=blue.z+dz;
        blue.parts.push({x,y,z,w,h,d,color,solid,label});
        if(solid)blue.colliders.push({
            minX:x-w/2,maxX:x+w/2,minY:y-h/2,maxY:y+h/2,
            minZ:z-d/2,maxZ:z+d/2,label
        });
    }
    static blueprint(place){
        if(!this.manages(place))return null;
        const tall=place.id==='r84-greektown-loft';
        const blue={id:place.id,x:place.inside.x,z:place.inside.z,
            tall,parts:[],colliders:[],doors:[],stairs:[],
            rooms:tall?['Corredor','Arquivo','Escada longa',
                'Patamar intermediário','Plataforma superior']:
                ['Corredor','Escritório','Almoxarifado'],
            floorLevels:tall?[0,3.6,7.2]:[0],
            originalPS1InteriorCertified:false};
        const add=(...args)=>this.part(blue,...args);
        // One genuine partition with 3.6-unit opening. The moving
        // door leaf is separate and carries a dynamic collision.
        for(const [a,b] of [[-8,-1.8],[1.8,8]])
            add(-4,2.7,(a+b)/2,.35,5.4,b-a,0x81898d,
                true,'partition');
        add(-4,3.7,0,.4,.3,3.6,0xafa99e,false,'lintel');
        blue.doors.push({id:'west',x:-4,z:0,width:3.6,open:false});
        // Genuine furniture with source-matched AABBs.
        add(-8,1,5,3.1,2,2,0x796552,true,'desk');
        add(-9.2,2,-5,1.4,4,2.0,0x5d6e74,true,'shelf');
        add(0,1.2,5.8,2.5,2.4,1.5,0x646059,true,'counter');
        add(0,.05,-2,6,.07,13,0x656b6b,false,'hall-floor');
        if(!tall){
            add(7.3,1.1,5.5,3.5,2.2,2.0,0x7b8b7b,true,'filing');
            add(8.5,1.5,-5.3,2.0,3,1.7,0x6e6960,true,'storage');
            add(7,0.05,0,6.2,.07,16,0x7d7568,false,'room-floor');
        }else{
            const start=-7.6,run=.625;
            for(let i=0;i<24;i++){
                const top=Math.round((i+1)*.3*1000)/1000;
                const z=start+(i+.5)*run;
                // Each visible step has its TOP equal to heightAt().
                // Walking uses the top, not the block's full AABB.
                add(6.5,top/2,z,2.6,top,run,
                    i%2?0x8c8274:0x958b7a,false,'stair-'+i);
                blue.stairs.push({z0:start+i*run,
                    z1:start+(i+1)*run,top});
            }
            // Low-cost guard volumes on BOTH sides of the staircase.
            add(4.95,3.7,-.2,.22,7.4,14.5,
                0x62676c,true,'long-stair-west-rail');
            for(const [z,d] of [[-4.45,5.95],[3.95,6.85]])
                add(8.2,3.7,z,.22,7.4,d,
                    0x62676c,true,'long-stair-east-rail');
            // Real intermediate side balcony, reached halfway up.
            add(9.35,3.47,-.65,2.3,.26,1.15,
                0x797e83,false,'intermediate-deck');
            add(10.55,4.35,-.65,.2,1.5,1.2,
                0x647079,true,'intermediate-rail-east');
            add(9.35,4.35,-1.2,2.35,1.5,.2,
                0x647079,true,'intermediate-rail-back');
            // 7.2-high upper landing, no magic lower-floor height.
            add(7.7,7.06,8.5,4.7,.28,2.2,
                0x7a7773,false,'upper-deck');
            add(5.25,7.95,8.45,.22,1.5,2.15,
                0x65727a,true,'upper-rail-west');
            add(10.1,7.95,8.45,.22,1.5,2.15,
                0x65727a,true,'upper-rail-east');
            add(7.7,7.95,9.55,4.65,1.5,.22,
                0x65727a,true,'upper-rail-back');
            // Upstairs accent: visual-only, on the platform.
            add(8.9,7.6,8.45,.6,.65,.7,
                0xa89976,false,'upstairs-light-case');
        }
        if(blue.colliders.some(c=>c.minX<blue.x-11.4||
            c.maxX>blue.x+11.4||c.minZ<blue.z-10.4||
            c.maxZ>blue.z+10.4))
            throw new Error('R84 collider escapes physical room');
        return blue;
    }
    static prepare(city){
        if(city?.preset?.id!=='chicago')return null;
        let n=0;
        for(const place of city.interiors||[]){
            if(!this.manages(place)||place.r84Blueprint)continue;
            place.r84Blueprint=this.blueprint(place);
            place.r84Loaded=false;n++;
        }
        if(!city.chicagoVerticalInteriorsR84)
            city.chicagoVerticalInteriorsR84={
                version:this.VERSION,
                prepared:(city.interiors||[]).filter(p=>p.r84Blueprint).length,
                loadCount:0,unloadCount:0,liveRoomId:null};
        return n;
    }
    static heightAt(city,x,z,referenceY=null){
        const b=this.nearRoom(city,x,z)?.r84Blueprint;
        if(!b?.tall)return 0;
        const dx=x-b.x,dz=z-b.z;
        if(dx>=5.2&&dx<=7.8&&dz>=-7.6&&dz<7.4){
            const i=Math.max(0,Math.min(23,
                Math.floor((dz+7.6)/.625)));
            return b.stairs[i].top;
        }
        if(dx>=8.1&&dx<=10.5&&dz>=-1.2&&dz<=-.05)
            return Number.isFinite(referenceY)&&referenceY>=2.8?3.6:0;
        if(dx>=5.25&&dx<=10.0&&dz>=7.4&&dz<=9.55)
            return Number.isFinite(referenceY)&&referenceY>=6.1?7.2:0;
        return 0;
    }
    static safeStep(city,fromX,fromZ,fromY,x,z,targetY){
        if(!this.nearRoom(city,x,z)&&!this.nearRoom(city,fromX,fromZ))
            return true;
        return Number.isFinite(targetY)&&Number.isFinite(fromY)&&
            targetY-fromY<=.43&&fromY-targetY<=.75;
    }
    static blocked(city,x,z,radius=.55,y=0){
        const b=this.nearRoom(city,x,z)?.r84Blueprint;
        if(!b)return false;
        const r=Number.isFinite(radius)?Math.max(0,radius):.55;
        if(Math.abs(x-b.x)+r>11.45||Math.abs(z-b.z)+r>10.45)
            return true;
        if(b.colliders.some(c=>x+r>c.minX&&x-r<c.maxX&&
            z+r>c.minZ&&z-r<c.maxZ&&
            y<c.maxY&&y+1.9>c.minY))return true;
        return b.doors.some(d=>!d.open&&y<3.2&&
            Math.abs(x-b.x-d.x)<r+.14&&
            Math.abs(z-b.z-d.z)<r+d.width/2);
    }
    static nearbyDoor(place,pos){
        const b=place?.r84Blueprint;
        if(!b||pos.y>1.7)return null;
        return b.doors.find(d=>Math.hypot(
            pos.x-b.x-d.x,pos.z-b.z-d.z)<2.6)||null;
    }
    static interact(city,place,pos){
        const door=this.nearbyDoor(place,pos);
        if(!door)return null;
        const b=place.r84Blueprint;
        if(door.open&&Math.abs(pos.x-b.x-door.x)<.85&&
            Math.abs(pos.z-b.z-door.z)<door.width/2+.55)
            return 'Afaste-se da passagem antes de fechar.';
        door.open=!door.open;
        if(door.mesh)door.mesh.position.z=b.z+door.z+
            (door.open?3.95:0);
        return door.open?'PORTA ABERTA':'PORTA FECHADA';
    }
    static decorateEntries(city){
        const s=city?.chicagoVerticalInteriorsR84;
        if(!s||s.entrySignsBuilt||!city.cityGroup||
            typeof DriverSpecialStructures==='undefined')return 0;
        const parts=[];
        for(const p of city.interiors||[]){
            if(!p.r84Blueprint)continue;
            const b=(city.districtBuildings||[]).find(
                b=>b.id===p.r84SourceLot);
            if(!b)continue;
            const front=b.z+b.depth/2+.31;
            parts.push([b.x,4.5,front,3.0,.48,.12,0x8fbda0,true]);
            parts.push([b.x,1.95,front,2.1,2.8,.07,0x508677,false]);
        }
        if(parts.length)DriverSpecialStructures.pack(
            city.cityGroup,parts,'chicago-r84-entrances');
        s.entrySignsBuilt=true;
        return parts.length;
    }
    static enter(city,place){
        if(city?.preset?.id!=='chicago'||!this.manages(place)||
            !city.cityGroup)return false;
        if(!place.r84Blueprint)this.prepare(city);
        if(place.r84Loaded)return true;
        // One interior detail group in GPU across R82/R83/R84.
        for(const room of city.interiors||[]){
            if(room.r84Loaded)this.leave(city,room);
            if(room.r83Loaded&&
                typeof DriverChicagoAccessibleInteriorsR83!=='undefined')
                DriverChicagoAccessibleInteriorsR83.leave(city,room);
            if(room.r82Loaded&&
                typeof DriverChicagoModularInteriorsR82!=='undefined')
                DriverChicagoModularInteriorsR82.leave(city,room);
        }
        const blue=place.r84Blueprint,group=new THREE.Group();
        group.name='r84-live-interior-'+place.id;
        if(typeof DriverSpecialStructures!=='undefined'){
            const pieces=blue.parts.map(p=>[
                p.x,p.y,p.z,p.w,p.h,p.d,p.color,false]);
            DriverSpecialStructures.pack(group,pieces,group.name+'-batch');
        }
        const geo=new THREE.BoxGeometry(.24,3.2,3.56);
        const mat=new THREE.MeshLambertMaterial({color:0x507b6b});
        for(const d of blue.doors){
            const mesh=new THREE.Mesh(geo,mat);
            mesh.position.set(blue.x+d.x,1.6,blue.z+d.z+
                (d.open?3.95:0));
            mesh.name='r84-interactive-door-'+d.id;
            d.mesh=mesh;group.add(mesh);
        }
        city.cityGroup.add(group);
        place.r84Group=group;place.r84Loaded=true;
        const state=city.chicagoVerticalInteriorsR84;
        if(state){state.liveRoomId=place.id;state.loadCount++}
        return true;
    }
    static leave(city,place){
        if(!place?.r84Loaded)return false;
        const group=place.r84Group;
        if(group)city.cityGroup?.remove(group);
        const geos=new Set(),mats=new Set();
        group?.traverse?.(obj=>{
            if(obj.geometry)geos.add(obj.geometry);
            const own=Array.isArray(obj.material)?obj.material:[obj.material];
            for(const m of own)if(m)mats.add(m);
        });
        geos.forEach(g=>g.dispose?.());
        mats.forEach(m=>m.dispose?.());
        for(const d of place.r84Blueprint?.doors||[])d.mesh=null;
        place.r84Loaded=false;place.r84Group=null;
        const s=city.chicagoVerticalInteriorsR84;
        if(s){s.liveRoomId=null;s.unloadCount++}
        return true;
    }
}
if(typeof window!=='undefined')
    window.DriverChicagoVerticalInteriorsR84=DriverChicagoVerticalInteriorsR84;
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoVerticalInteriorsR84;
