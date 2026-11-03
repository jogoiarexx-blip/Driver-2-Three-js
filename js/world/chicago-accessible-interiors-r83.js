/**
 * Chicago R83 — two additional playable interiors and physical mezzanine.
 * The PS1 street geography remains UNVERIFIED. Do not relocate missions.
 * New entrances use R78 shell-planned lots, so no extra exterior buildings.
 * Collision, doors and steps derive from the same blueprint as visible meshes.
 * A single interior is rendered at a time; all assets are freed on exit.
 */
class DriverChicagoAccessibleInteriorsR83 {
    static VERSION='r83-interactive-doors-mezzanine';
    static SITES=[
        {id:'r83-loop-mezzanine',name:'Escritório com mezanino',
            kind:'r83-mezzanine',blockX:-40,blockZ:-200,
            insideX:830,level:'two-level-pilot'},
        {id:'r83-ukrainian-house',name:'Casa de Ukrainian Village',
            kind:'r83-house',blockX:-280,blockZ:-200,
            insideX:900,level:'single-floor'}
    ];
    static manages(place) {
        return !!place&&this.SITES.some(site=>site.id===place.id);
    }
    static nearRoom(city,x,z){
        if(city?.preset?.id!=='chicago')return null;
        return (city.interiors||[]).find(p=>this.manages(p)&&
            Math.abs(x-p.inside.x)<12.7&&Math.abs(z-p.inside.z)<11.7)||null;
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
            const back={x:door.x,z:door.z+4};
            if(city.isWaterAt?.(door.x,door.z)||
                city.isWaterAt?.(back.x,back.z)||
                city.isPointBlocked?.(back.x,back.z,.4,0))
                continue;
            const place={id:site.id,name:site.name,kind:site.kind,
                door,inside:{x:site.insideX,z:0},r83SourceLot:lot.id,
                accessible:true,storyCritical:false,interiorLevel:site.level};
            city.interiors.push(place);
            lot.interiorTier='partial';
            lot.interiorId=site.id;
            n++;
        }
        return n;
    }
    static part(blue,dx,y,dz,w,h,d,color,solid=false,label=''){
        const part={x:blue.x+dx,y,z:blue.z+dz,w,h,d,color,
            solid,label};
        blue.parts.push(part);
        if(solid)blue.colliders.push({
            minX:part.x-w/2,maxX:part.x+w/2,
            minY:y-h/2,maxY:y+h/2,
            minZ:part.z-d/2,maxZ:part.z+d/2,label
        });
        return part;
    }
    static blueprint(place){
        if(!this.manages(place))return null;
        const mezz=place.id==='r83-loop-mezzanine';
        const blue={
            id:place.id,x:place.inside.x,z:place.inside.z,
            rooms:mezz?['Corredor','Arquivo','Escadaria','Mezanino']:
                ['Corredor','Sala','Cozinha'],
            mezzanine:mezz,multiStorey:mezz,levelHeight:3.6,
            parts:[],colliders:[],doors:[],stairs:[],
            originalPS1InteriorCertified:false
        };
        const add=(...args)=>this.part(blue,...args);
        const doorConfig=[
            {id:'west',x:-3.8,z:0,color:0x80684e},
            {id:'east',x:3.8,z:mezz?-5.5:0,color:0x557480}
        ];
        for(const door of doorConfig){
            const low=-8,high=8,half=1.8;
            const segments=[[low,door.z-half],
                [door.z+half,high]];
            for(const [a,b] of segments){
                if(b-a<.2)continue;
                add(door.x,2.7,(a+b)/2,.36,5.4,b-a,
                    0x7d8381,true,'partition-wall');
            }
            add(door.x,3.65,door.z,.45,.3,3.6,
                0xa9a298,false,'door-lintel');
            blue.doors.push({...door,open:false,width:3.6});
        }
        add(0,.05,0,5.8,.06,17,0x727170,false,'corridor-floor');
        add(-7.3,.05,0,6.3,.06,17,0x766953,false,'west-floor');
        add(7.3,.05,0,6.3,.06,17,0x4d6571,false,'east-floor');
        // Furniture never straddles a doorway or the player spawn / exit.
        add(-8,1.05,5.4,3.1,2.1,2.1,0x785c45,true,'table');
        add(-9.3,2,-5.1,1.3,4.0,2.0,0x475761,true,'cabinet');
        if(!mezz){
            add(8.9,1.1,5.0,3.1,2.2,2.0,0x6f705e,true,'kitchen');
            add(9,1.5,-5.0,1.1,3.0,2.1,0x686f7a,true,'pantry');
        }else{
            // Twelve genuine steps (30 cm rise / 62.5 cm run) climbing
            // 3.6 m into a short mezzanine. No fake teleport or ramp.
            const start=-6.1,run=.625,stepRise=.3;
            for(let i=0;i<12;i++){
                const top=(i+1)*stepRise;
                const z=start+(i+.5)*run;
                add(7.2,top/2,z,2.7,top,run,
                    i%2?0x8b8478:0x938b7d,false,'step-'+i);
                blue.stairs.push({startZ:blue.z+start+i*run,
                    endZ:blue.z+start+(i+1)*run,top});
            }
            // The underside is a visible slab. Its TOP matches heightAt.
            add(7.2,3.47,5.1,6.0,.26,7.4,
                0x676e78,false,'mezzanine-deck');
            // Solid rails prevent reaching the platform from ground level
            // or dropping off the raised edges into the room.
            add(5.5,2.0,-1.7,.24,4.0,6.0,
                0x565f69,true,'stair-guard-west');
            add(8.9,2.0,-2.0,.24,4.0,6.4,
                0x565f69,true,'stair-guard-east');
            add(4.35,4.35,5.1,.26,1.5,7.4,
                0x59656b,true,'platform-rail-west');
            add(10.25,4.35,5.1,.26,1.5,7.4,
                0x59656b,true,'platform-rail-east');
            add(7.2,4.35,8.75,5.6,1.5,.22,
                0x59656b,true,'platform-rail-back');
            add(8.6,4.15,7.5,1.2,1.1,1.1,
                0x9b815f,true,'upstairs-box');
        }
        if(blue.colliders.some(c=>c.minX<blue.x-11.4||
            c.maxX>blue.x+11.4||c.minZ<blue.z-10.4||
            c.maxZ>blue.z+10.4))
            throw new Error('R83 out-of-bounds collision');
        return blue;
    }
    static prepare(city){
        if(city?.preset?.id!=='chicago')return null;
        let n=0;
        for(const place of city.interiors||[]){
            if(!this.manages(place)||place.r83Blueprint)continue;
            place.r83Blueprint=this.blueprint(place);
            place.r83Loaded=false;
            n++;
        }
        city.chicagoAccessibleInteriorsR83={
            version:this.VERSION,prepared:(city.interiors||[])
                .filter(p=>p.r83Blueprint).length,
            loadCount:0,unloadCount:0,liveRoomId:null};
        return n;
    }
    static heightAt(city,x,z){
        const place=this.nearRoom(city,x,z);
        const b=place?.r83Blueprint;
        if(!b||!b.mezzanine)return 0;
        const dx=x-b.x,dz=z-b.z;
        // At ground level, use the unchanged world/interior floor.
        if(dx>=5.85&&dx<=8.55&&dz>=-6.1&&dz<1.4){
            const i=Math.max(0,Math.min(11,Math.floor((dz+6.1)/.625)));
            return b.stairs[i].top;
        }
        if(dx>=4.35&&dx<=10.2&&dz>=1.4&&dz<=8.8)
            return b.levelHeight;
        return 0;
    }
    static safeStep(city,fromX,fromZ,fromY,x,z,targetY){
        if(!this.nearRoom(city,x,z)&&!this.nearRoom(city,fromX,fromZ))
            return true;
        if(!Number.isFinite(targetY))return false;
        // A player cannot step from floor 0 directly onto the upper slab
        // or climb a staircase by entering its side at mid-height.
        return targetY-fromY<=.43 && fromY-targetY<=.75;
    }
    static blocked(city,x,z,radius=.55,y=0){
        const place=this.nearRoom(city,x,z);
        if(!place?.r83Blueprint)return false;
        const b=place.r83Blueprint,r=Number.isFinite(radius)?
            Math.max(0,radius):.55;
        const dx=x-b.x,dz=z-b.z;
        // Actual outer shell is 24x22, with collision at inner walls.
        if(Math.abs(dx)+r>11.45||Math.abs(dz)+r>10.45)return true;
        const intersects=c=>x+r>c.minX&&x-r<c.maxX&&
            z+r>c.minZ&&z-r<c.maxZ;
        // Only collide when player's body overlaps the object's height.
        if(b.colliders.some(c=>intersects(c)&&y<c.maxY&&y+2>c.minY))
            return true;
        return b.doors.some(door=>!door.open&&y<3.35&&
            Math.abs(dx-door.x)<r+.13&&
            Math.abs(dz-door.z)<r+door.width/2);
    }
    static nearbyDoor(place,pos,maxDistance=2.6){
        const b=place?.r83Blueprint;
        if(!b||pos.y>1.7)return null;
        return b.doors.map(door=>({
            door,d:Math.hypot(pos.x-b.x-door.x,pos.z-b.z-door.z)
        })).filter(item=>item.d<=maxDistance)
            .sort((a,c)=>a.d-c.d)[0]?.door||null;
    }
    static interact(city,place,pos){
        const door=this.nearbyDoor(place,pos);
        if(!door)return null;
        const b=place.r83Blueprint;
        // Never close a physical door through Tanner.
        if(door.open&&Math.abs(pos.x-(b.x+door.x))<.85&&
            Math.abs(pos.z-(b.z+door.z))<door.width/2+.55)
            return 'Afaste-se da passagem antes de fechar.';
        door.open=!door.open;
        if(door.mesh){
            door.mesh.position.z=b.z+door.z+(door.open?3.95:0);
        }
        return door.open?'PORTA ABERTA':'PORTA FECHADA';
    }
    static enter(city,place){
        if(city?.preset?.id!=='chicago'||!this.manages(place)||
            !city.cityGroup)return false;
        if(!place.r83Blueprint)this.prepare(city);
        if(place.r83Loaded)return true;
        // R82 and R83 never keep two interior layouts on GPU.
        for(const p of city.interiors||[]){
            if(p.r83Loaded)this.leave(city,p);
            if(p.r82Loaded&&typeof DriverChicagoModularInteriorsR82!=='undefined')
                DriverChicagoModularInteriorsR82.leave(city,p);
        }
        const b=place.r83Blueprint,g=new THREE.Group();
        g.name='r83-accessible-interior-'+place.id;
        const parts=b.parts.map(p=>[p.x,p.y,p.z,p.w,p.h,p.d,p.color,false]);
        if(typeof DriverSpecialStructures!=='undefined')
            DriverSpecialStructures.pack(g,parts,g.name+'-batch');
        const doorMat=new THREE.MeshLambertMaterial({color:0x5d8278});
        const doorGeo=new THREE.BoxGeometry(.23,3.2,3.58);
        for(const door of b.doors){
            const mesh=new THREE.Mesh(doorGeo,doorMat);
            mesh.name='r83-live-door-'+door.id;
            mesh.position.set(b.x+door.x,1.65,
                b.z+door.z+(door.open?3.95:0));
            door.mesh=mesh;g.add(mesh);
        }
        city.cityGroup.add(g);
        place.r83Group=g;place.r83Loaded=true;
        city.chicagoAccessibleInteriorsR83.liveRoomId=place.id;
        city.chicagoAccessibleInteriorsR83.loadCount++;
        return true;
    }
    static leave(city,place){
        if(!place?.r83Loaded)return false;
        if(place.r83Group)city.cityGroup?.remove(place.r83Group);
        const geos=new Set(),mats=new Set();
        place.r83Group?.traverse?.(object=>{
            if(object.geometry)geos.add(object.geometry);
            for(const m of Array.isArray(object.material)?
                object.material:[object.material])if(m)mats.add(m);
        });
        geos.forEach(g=>g.dispose?.());
        mats.forEach(m=>m.dispose?.());
        for(const door of place.r83Blueprint?.doors||[])door.mesh=null;
        place.r83Group=null;place.r83Loaded=false;
        const state=city.chicagoAccessibleInteriorsR83;
        if(state){state.liveRoomId=null;state.unloadCount++;}
        return true;
    }
}
if(typeof window!=='undefined')
    window.DriverChicagoAccessibleInteriorsR83=
        DriverChicagoAccessibleInteriorsR83;
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoAccessibleInteriorsR83;
