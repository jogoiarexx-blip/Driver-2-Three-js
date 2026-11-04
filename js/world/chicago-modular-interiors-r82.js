/**
 * Chicago R82 — true modular, COLLIDABLE interiors for the playable game.
 *
 * Venues reuse existing real exterior doors/interiors of R78 and R81.
 * Three connected on-foot zones per room: central corridor, left room,
 * right room, with genuinely OPEN passageways in the partition walls.
 * The same immutable part list builds meshes and AABB collision.
 *
 * Geometry (1-2 instanced meshes) is created on ENTER and disposed on EXIT.
 * Collision blueprints remain in memory and are extremely small.
 * No mission/safe-house/4-city/PS1-coordinate changes.
 *
 * "Complete" means modeled interconnected rooms on ONE floor, NOT stairs,
 * extra storeys or a PS1 ROM-certified building.
 */
class DriverChicagoModularInteriorsR82 {
    static VERSION='r82-three-connected-rooms-lazy';
    static IDS={
        'r78-goose-warehouse':{
            type:'warehouse',title:'Armazém industrial',
            status:'complete-single-floor',left:'Depósito',
            right:'Oficina',color:0x667179},
        'r78-loop-shop':{
            type:'shop',title:'Loja comercial',
            status:'complete-single-floor',left:'Estoque',
            right:'Atendimento',color:0xa89a87},
        'r81-goose-yard-office':{
            type:'office',title:'Escritório industrial',
            status:'partial-single-floor',left:'Arquivo',
            right:'Escritório',color:0x7d8d92}
    };
    static manages(place) {
        return !!place&&Object.prototype.hasOwnProperty.call(
            this.IDS,place.id);
    }
    static managesPoint(city,x,z){
        return city?.preset?.id==='chicago'&&
            (city.interiors||[]).some(p=>this.manages(p)&&
                Math.abs(x-p.inside.x)<12.5&&
                Math.abs(z-p.inside.z)<11.5);
    }
    static part(blue,dx,y,dz,w,h,d,color,solid=false,lit=false,label=''){
        const x=blue.x+dx,z=blue.z+dz;
        const part={x,y,z,w,h,d,color,solid,lit,label};
        blue.parts.push(part);
        if(solid)blue.colliders.push({
            minX:x-w/2,maxX:x+w/2,
            minZ:z-d/2,maxZ:z+d/2,
            r82InteriorId:blue.id,label
        });
        return part;
    }
    static blueprint(place) {
        if(!this.manages(place))return null;
        const cfg=this.IDS[place.id],blue={
            id:place.id,type:cfg.type,status:cfg.status,
            x:place.inside.x,z:place.inside.z,parts:[],colliders:[],
            rooms:[
                {id:'corridor',name:'Corredor central',x:0,z:0,
                    width:6.2,depth:16},
                {id:'west',name:cfg.left,x:-7.2,z:0,width:6,depth:15.5},
                {id:'east',name:cfg.right,x:7.2,z:0,width:6,depth:15.5}
            ],
            doors:[{x:-3.8,z:0,width:4.0},
                   {x:3.8,z:0,width:4.0}],
            spawn:{x:place.inside.x,z:place.inside.z-6},
            exit:{x:place.inside.x,z:place.inside.z-8.8},
            originalPS1InteriorCertified:false,
            multiStorey:false
        };
        const add=(...args)=>this.part(blue,...args);
        const wall=cfg.color,trim=0xb2a38f,metal=0x475762;
        // Four PHYSICAL partition sections. Genuine openings of 4m
        // at z=-2..+2. Tanner's radius is ~0.55m, thus passable.
        for(const x of [-3.8,3.8]){
            add(x,2.5,-5.15,.32,5.0,5.7,wall,true,false,
                'partition-lower');
            add(x,2.5,5.15,.32,5.0,5.7,wall,true,false,
                'partition-upper');
            for(const z of [-2.05,2.05])
                add(x,2.35,z,.6,4.7,.13,trim,false,false,'door-jamb');
            add(x,4.85,0,.48,.28,4.0,metal,false,false,'door-header');
        }
        // Flooring is cosmetic; vanilla floor/ceiling is still available.
        add(0,.055,0,5.8,.034,17.5,0x5f676b,false,false,'corridor-floor');
        for(const sign of [-1,1]){
            add(sign*7.2,.06,0,6.2,.032,16.2,
                cfg.type==='shop'?0x827867:0x575a58,
                false,false,'room-floor');
        }
        for(const z of [-6.1,1,6.7])
            add(0,5.7,z,1.8,.16,1.0,0xffcf86,
                false,true,'ceiling-light');
        // Different authored furniture per venue: physically present,
        // pushed to the side rooms. CENTRAL AISLE AND DOOR GAPS CLEAR.
        if(cfg.type==='warehouse'){
            for(const sign of [-1,1]){
                const x=sign*8.1;
                for(const z of [-5.3,4.6]){
                    add(x,.73,z,3.5,1.4,2.5,
                        sign<0?0x786550:0x566a73,true,false,'pallet');
                    add(x,1.49,z,3.3,.13,2.7,
                        0x9f8865,false,false,'pallet-top');
                }
                add(sign*9.7,2.7,.0,1.1,4.6,2.1,
                    0x6b797d,true,false,'metal-shelf');
            }
            add(-7.6,1.1,-.45,3.1,2.1,1.9,
                0x6f5945,true,false,'shipping-desk');
        }else if(cfg.type==='shop'){
            add(-8,1.1,5.1,3.4,2.2,2.0,
                0x8a674a,true,false,'stock-counter');
            for(const z of [-5.5,4.9])
                add(-9.5,2.05,z,1.2,4.1,2.3,
                    0x7c6448,true,false,'display-shelf');
            add(8,1.0,4.7,4.1,1.85,2.15,
                0x795d4d,true,false,'checkout');
            add(8,2.0,4.7,3.6,.16,2.05,
                0xb3a18f,false,false,'countertop');
            add(9.2,2.5,-5.4,1.3,4.7,2.2,
                0x4d606b,true,false,'showcase');
        }else{
            add(-8,1.35,4.9,3.0,2.7,2.5,
                0x50616b,true,false,'archive');
            add(-9.5,2.2,-4.1,1.2,4.3,2.8,
                0x65747a,true,false,'file-cabinet');
            add(8,1.02,4.8,4.2,1.9,2.2,
                0x79644f,true,false,'office-desk');
            add(8,2.1,4.8,3.7,.2,2.3,
                0xb39a78,false,false,'desk-surface');
            add(8.7,2.5,-5.1,1.4,4.8,2.6,
                0x4a6d75,true,false,'records-shelf');
        }
        // All blueprint solid boxes remain bounded by the 24x22 room
        // and cannot collide with another off-world interior.
        if(blue.colliders.some(c=>c.minX<blue.x-11.4||
            c.maxX>blue.x+11.4||c.minZ<blue.z-10.4||
            c.maxZ>blue.z+10.4))
            throw new Error('R82 room geometry outside physical shell');
        return blue;
    }
    static prepare(city){
        if(city?.preset?.id!=='chicago')return null;
        let prepared=0;
        for(const place of city.interiors||[]){
            if(!this.manages(place)||place.r82Blueprint)continue;
            const blue=this.blueprint(place);
            // Physical and visual dimensions are derived from one source.
            place.r82Blueprint=blue;
            place.r82Status=blue.status;
            place.r82Rooms=blue.rooms.map(r=>r.name);
            place.r82Loaded=false;
            prepared++;
        }
        city.chicagoModularInteriorsR82={
            version:this.VERSION,prepared:(
                city.interiors||[]).filter(p=>p.r82Blueprint).length,
            liveRoomId:null,loadCount:0,unloadCount:0,
            certifiedPS1:false
        };
        return prepared;
    }
    static blocked(city,x,z,radius=.55){
        if(!this.managesPoint(city,x,z))return false;
        const r=Number.isFinite(radius)&&radius>=0?radius:.55;
        const place=city.interiors.find(p=>p.r82Blueprint&&
            Math.abs(x-p.inside.x)<12.5&&
            Math.abs(z-p.inside.z)<11.5);
        if(!place)return false;
        return place.r82Blueprint.colliders.some(c=>
            x+r>c.minX&&x-r<c.maxX&&z+r>c.minZ&&z-r<c.maxZ);
    }
    static enter(city,place){
        if(city?.preset?.id!=='chicago'||!this.manages(place)||
            !city.cityGroup)return false;
        if(!place.r82Blueprint)this.prepare(city);
        if(place.r82Loaded)return true;
        // Exactly one extra geometry group at a time: no background
        // interior meshes or duplicate collision boxes on every entry.
        const stat=city.chicagoModularInteriorsR82;
        for(const other of city.interiors){
            if(other.r82Loaded)this.leave(city,other);
            // R83 may have been visited just before this R82 room.
            // Keep precisely ONE detailed interior on the GPU.
            if(other.r83Loaded&&
               typeof DriverChicagoAccessibleInteriorsR83!=='undefined')
                DriverChicagoAccessibleInteriorsR83.leave(city,other);
            if(other.r84Loaded&&
               typeof DriverChicagoVerticalInteriorsR84!=='undefined')
                DriverChicagoVerticalInteriorsR84.leave(city,other);
        }
        const blue=place.r82Blueprint;
        const group=new THREE.Group();
        group.name='r82-modular-interior-'+place.id;
        group.userData.interiorLoadedOnlyWhenInside=true;
        const parts=blue.parts.map(p=>[
            p.x,p.y,p.z,p.w,p.h,p.d,p.color,p.lit
        ]);
        const meshes=typeof DriverSpecialStructures!=='undefined'?
            DriverSpecialStructures.pack(group,parts,
                'r82-real-partitions-'+place.id):[];
        city.cityGroup.add(group);
        place.r82Group=group;
        place.r82Meshes=meshes;
        place.r82Loaded=true;
        if(stat){
            stat.liveRoomId=place.id;stat.loadCount++;
        }
        return true;
    }
    static leave(city,place){
        if(!place?.r82Loaded)return false;
        const group=place.r82Group;
        if(group&&city?.cityGroup)city.cityGroup.remove(group);
        // DriverSpecialStructures.pack allocates one shared geometry
        // and one material per channel. Dispose all owned assets ONCE.
        const geos=new Set(),mats=new Set();
        for(const mesh of place.r82Meshes||[]){
            if(mesh.geometry)geos.add(mesh.geometry);
            if(mesh.material){
                for(const m of Array.isArray(mesh.material)?
                    mesh.material:[mesh.material])mats.add(m);
            }
        }
        geos.forEach(g=>g.dispose?.());
        mats.forEach(m=>m.dispose?.());
        place.r82Group=null;place.r82Meshes=null;
        place.r82Loaded=false;
        const stat=city?.chicagoModularInteriorsR82;
        if(stat){stat.liveRoomId=null;stat.unloadCount++;}
        return true;
    }
}
if(typeof window!=='undefined')
    window.DriverChicagoModularInteriorsR82=DriverChicagoModularInteriorsR82;
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoModularInteriorsR82;
