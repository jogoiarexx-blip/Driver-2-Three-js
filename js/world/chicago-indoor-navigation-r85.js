/**
 * Chicago R85 — two doors per R84 interior and reliable narrow-obstacle
 * walking. No new city streets, traffic colliders, or world-visible props.
 *
 * All additions come from blueprint geometry: a solid mesh has an equal
 * physical AABB. The sweep is active ONLY within R83/R84 interiors so
 * normal driving, pedestrian outdoor logic and other cities are unchanged.
 */
class DriverChicagoIndoorNavigationR85 {
    static VERSION='r85-two-room-doors-foot-sweep-mobile';
    static MAX_SWEEP=.22;
    static enhance(architecture,place){
        const b=place?.r84Blueprint;
        if(!b||b.r85Enhanced)return false;
        const add=(...args)=>architecture.part(b,...args);
        // Extra partition divides the east room from the main hall.
        // Keep 3.6m clear *only while the actual door is open*.
        const doorZ=b.tall?-3.2:0;
        for(const [lo,hi] of [[-8,doorZ-1.8],[doorZ+1.8,8]]){
            if(hi-lo>0.2)
                add(3.1,2.7,(lo+hi)/2,.35,5.4,hi-lo,
                    b.tall?0x87908c:0x8d8a7e,true,
                    'r85-east-wall');
        }
        add(3.1,3.65,doorZ,.45,.3,3.6,
            0xb3a494,false,'r85-east-door-header');
        b.doors.push({id:'east',x:3.1,z:doorZ,width:3.6,
            open:false,room:b.tall?'Escada':'Almoxarifado'});
        if(b.tall){
            // The existing small box upstairs looked solid but was
            // previously cosmetic; derive its collider from that mesh.
            const p=b.parts.find(p=>p.label==='upstairs-light-case');
            if(p&&!p.solid){
                p.solid=true;
                b.colliders.push({
                    minX:p.x-p.w/2,maxX:p.x+p.w/2,
                    minY:p.y-p.h/2,maxY:p.y+p.h/2,
                    minZ:p.z-p.d/2,maxZ:p.z+p.d/2,
                    label:p.label
                });
            }
        }else{
            // Small, carefully spaced office furniture — must not
            // intersect spawn, exit, door or existing cabinets.
            add(8.7,.45,2.25,.75,.9,.75,
                0x8b806d,true,'r85-office-stool');
            add(6.15,.55,-5.2,.8,1.1,.8,
                0x77786b,true,'r85-office-stool-back');
        }
        b.r85Enhanced=true;
        b.r85Rooms=b.tall?
            ['Recepção','Arquivo','Acesso à escada','Dois patamares']:
            ['Recepção','Escritório','Almoxarifado'];
        return true;
    }
    static active(city,fromX,fromZ,toX,toZ){
        if(city?.preset?.id!=='chicago')return false;
        const r83=typeof DriverChicagoAccessibleInteriorsR83!=='undefined'?
            DriverChicagoAccessibleInteriorsR83:null;
        const r84=typeof DriverChicagoVerticalInteriorsR84!=='undefined'?
            DriverChicagoVerticalInteriorsR84:null;
        // Both helpers reject outdoor coordinates in constant time.
        return !!(r83&&(r83.nearRoom(city,fromX,fromZ)||
            r83.nearRoom(city,toX,toZ))||
            r84&&(r84.nearRoom(city,fromX,fromZ)||
            r84.nearRoom(city,toX,toZ)));
    }
    static canStand(city,from,to,radius){
        const y=city.getGroundHeightAt(to.x,to.z,from.y);
        if(!Number.isFinite(y))return null;
        const r83=typeof DriverChicagoAccessibleInteriorsR83!=='undefined'?
            DriverChicagoAccessibleInteriorsR83:null;
        const r84=typeof DriverChicagoVerticalInteriorsR84!=='undefined'?
            DriverChicagoVerticalInteriorsR84:null;
        if(r83&&!r83.safeStep(city,from.x,from.z,from.y,
            to.x,to.z,y))return null;
        if(r84&&!r84.safeStep(city,from.x,from.z,from.y,
            to.x,to.z,y))return null;
        if(city.isPointBlocked(to.x,to.z,radius,y))return null;
        return {x:to.x,z:to.z,y};
    }
    static move(city,from,to,radius=.55){
        if(!this.active(city,from.x,from.z,to.x,to.z))
            return null;
        if(!Number.isFinite(from.x)||!Number.isFinite(from.z)||
            !Number.isFinite(from.y)||!Number.isFinite(to.x)||
            !Number.isFinite(to.z))return {...from,blocked:true,steps:0};
        const requestedX=to.x-from.x,requestedZ=to.z-from.z;
        const distance=Math.hypot(requestedX,requestedZ);
        // Clamp both the number AND the LENGTH of substeps. A giant
        // tab-resume delta must never tunnel through a thin collider.
        const fraction=distance>0?
            Math.min(1,24*this.MAX_SWEEP/distance):1;
        const dx=requestedX*fraction,dz=requestedZ*fraction;
        const steps=Math.max(1,Math.ceil(
            Math.hypot(dx,dz)/this.MAX_SWEEP));
        const sx=dx/steps,sz=dz/steps;
        let point={x:from.x,y:from.y,z:from.z},blocked=false;
        for(let i=0;i<steps;i++){
            let next=this.canStand(city,point,{
                x:point.x+sx,z:point.z+sz},radius);
            if(!next&&Math.abs(sx)>1e-8&&Math.abs(sz)>1e-8){
                // Sliding follows whichever axis is free. Each
                // alternate path is checked against the SAME AABBs.
                const slideX=this.canStand(city,point,{
                    x:point.x+sx,z:point.z},radius);
                const slideZ=this.canStand(city,point,{
                    x:point.x,z:point.z+sz},radius);
                next=slideX||slideZ;
            }
            if(!next){blocked=true;break}
            point=next;
        }
        return {...point,blocked,steps};
    }
}
if(typeof window!=='undefined')
    window.DriverChicagoIndoorNavigationR85=
        DriverChicagoIndoorNavigationR85;
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoIndoorNavigationR85;
