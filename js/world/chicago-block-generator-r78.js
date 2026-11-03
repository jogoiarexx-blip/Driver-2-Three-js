/**
 * Chicago R78 — pilot sequential frontage blocks in the PLAYABLE city.
 * Pure parcel planning + batched, non-colliding facade detail.
 * The existing 80-unit road grid is a COMPATIBILITY boundary, not claimed PS1.
 *
 * New functioning interiors are registered via CityBuilder's existing E/exit
 * system; everything else is either a closed facade or a FUTURE shell slot.
 * Road, AI, missions, protected parcels and original 54 PS1 sectors unchanged.
 */
class DriverChicagoBlockGeneratorR78 {
    static VERSION='r78-pilot-1';
    static PILOTS=[
        {x:-280,z:-120,style:'rowhouses',district:'ukrainian-village'},
        {x:-280,z:-40,style:'rowhouses',district:'ukrainian-village'},
        {x:40,z:-40,style:'downtown',district:'loop',interior:'r78-loop-shop'},
        {x:120,z:-40,style:'downtown',district:'loop'},
        {x:-40,z:-200,style:'downtown',district:'loop'},
        {x:40,z:-200,style:'downtown',district:'loop'},
        {x:-40,z:120,style:'riverside',district:'river-north'},
        {x:120,z:200,style:'riverside',district:'river-north'},
        {x:-120,z:280,style:'industrial',district:'goose-island-edge',
            interior:'r78-goose-warehouse'}
    ];
    static INTERIOR_OFFSETS={
        'r78-loop-shop':{x:1300,z:0,name:'Loja no Loop',kind:'r78-shop'},
        'r78-goose-warehouse':{x:1360,z:0,name:'Depósito de Goose Island',kind:'r78-warehouse'}
    };
    static pilotAt(x,z){
        return this.PILOTS.find(p=>p.x===x&&p.z===z)||null;
    }
    static hash(x,z,n=0){
        const value=Math.imul((x*101)|0,73856093)^
            Math.imul((z*101)|0,19349663)^Math.imul(n+87,83492791);
        return ((Math.imul(value^(value>>>13),1274126177)^(value>>>16))>>>0)/
            4294967295;
    }
    static lots(blockX,blockZ,districtKind='tower'){
        const pilot=this.pilotAt(blockX,blockZ);
        if(!pilot)return null;
        const rows=2,columns=pilot.style==='industrial'?3:5,
            totalSpan=42.4,frontDepth=pilot.style==='industrial'?14.2:14.0,
            gap=pilot.style==='industrial'?.34:.18,
            width=(totalSpan-gap*(columns-1))/columns,
            zOffset=pilot.style==='industrial'?14.0:14.2,lotArray=[];
        for(const side of [-1,1]){
            for(let col=0;col<columns;col++){
                const localX=-totalSpan/2+width/2+col*(width+gap);
                const x=blockX+localX,z=blockZ+side*zOffset;
                const variance=this.hash(blockX,blockZ,col+31+side*101);
                const height=pilot.style==='rowhouses'?9.5+variance*5.5:
                    pilot.style==='downtown'?18+variance*35:
                    pilot.style==='riverside'?17+variance*26:
                    8+variance*7;
                const kind=pilot.style==='rowhouses'?'residential':
                    pilot.style==='industrial'?'industrial':
                    pilot.style==='riverside'?'apartment':districtKind;
                const facade=pilot.style==='rowhouses'?'brick-rowhouse':
                    pilot.style==='industrial'?'loading-bay':
                    pilot.style==='riverside'?'riverside-masonry':'loop-storefront';
                const palette=pilot.style==='rowhouses'?2:
                    pilot.style==='industrial'?2:col%2===0?0:1;
                const landmarkInterior=pilot.interior&&side===1&&
                    col===Math.floor(columns/2)?pilot.interior:null;
                const tier=landmarkInterior?'full':
                    col===1&&side===1?'shell-planned':'facade-only';
                const id='r78-'+blockX+'-'+blockZ+'-'+side+'-'+col;
                const lot={id,blockX,blockZ,x,z,width,depth:frontDepth,
                    height:Math.round(height*100)/100,
                    kind,palette,planned:true,district:pilot.district,
                    pilotR78:true,facadeStyle:facade,
                    interiorTier:tier,
                    interiorId:landmarkInterior,
                    frontageSide:side,
                    frontage:'x',
                    sourceGeometryCertified:false};
                // 50×50 sidewalk pad; reserve 3.6 units to its edge.
                if(Math.abs(x-blockX)+width/2>21.51||
                   Math.abs(z-blockZ)+frontDepth/2>21.51)
                    throw new Error('R78 lot intrudes into the inherited street');
                lotArray.push(lot);
            }
        }
        return lotArray;
    }
    static plan(city,x,z,kind) {
        if(city?.preset?.id!=='chicago')return null;
        return this.lots(x,z,kind);
    }
    static registerInteriors(city,buildings){
        if(city?.preset?.id!=='chicago'||!Array.isArray(city.interiors))
            return 0;
        let registered=0;
        for(const b of buildings){
            if(b.interiorTier!=='full'||!b.interiorId)continue;
            const cfg=this.INTERIOR_OFFSETS[b.interiorId];
            if(!cfg||city.interiors.some(p=>p.id===b.interiorId))continue;
            // Door on the NORTH face: leaveInterior() uses door.z+4,
            // hence the return spawn is outside the AABB and on a dry pad.
            const door={x:b.x,z:b.z+b.depth/2+2.8},
                returnedZ=door.z+4.0;
            if(b.frontageSide!==1||
               city.isWaterAt?.(door.x,door.z)||
               city.isWaterAt?.(door.x,returnedZ)||
               city.isPointBlocked?.(door.x,returnedZ,.3,0))
                continue;
            city.interiors.push({id:b.interiorId,name:cfg.name,kind:cfg.kind,
                door,inside:{x:cfg.x,z:cfg.z},r78SourceLot:b.id,
                accessible:true,storyCritical:false});
            registered++;
        }
        return registered;
    }
    static decorateChunk(city,buildings,parent){
        if(city?.preset?.id!=='chicago'||!parent||
           typeof DriverSpecialStructures==='undefined')return null;
        const parts=[],count={facades:0,shellPlanned:0,full:0,signs:0};
        const add=(x,y,z,w,h,d,c,light=false)=>
            parts.push([x,y,z,w,h,d,c,light]);
        for(const b of buildings||[]){
            if(!b.pilotR78)continue;
            const {x,z,width:w,depth:d,height:h,frontageSide:s}=b;
            const face=z+s*(d/2+.14),color=b.facadeStyle==='brick-rowhouse'?
                0xb2a39a:b.facadeStyle==='loading-bay'?0x8b9797:
                b.facadeStyle==='riverside-masonry'?0xb6af9f:0x9c9389;
            // Thin storefront stripes, cornices and front-entry frames:
            // these are DECORATIONS, not walkable/solid geometry.
            add(x,h+.54,z+s*(d/2+.16),w+.12,.28,.3,color);
            add(x,h*.60,face,w-.2,.12,.15,color);
            if(b.facadeStyle==='loading-bay'){
                for(const dx of [-w*.23,w*.23]){
                    add(x+dx,2.9,face,w*.36,3.9,.19,0x465563);
                    add(x+dx,4.96,face,w*.38,.26,.3,color);
                }
            }else{
                const isShop=b.facadeStyle==='loop-storefront'||
                    b.interiorTier==='full'||b.interiorTier==='shell-planned';
                if(isShop){
                    add(x,2.2,face,w*.64,3.45,.14,0x344c58);
                    add(x,4.08,face+s*.04,w*.83,.33,.27,0x98755d);
                    // Door is a marker: actual teleport trigger only for
                    // FULL registered rooms, never for shell-planned.
                    add(x,.95,face+s*.09,2.05,1.9,.11,
                        b.interiorTier==='full'?0x428a74:0x585a58);
                    count.signs++;
                }else{
                    for(const dx of [-w*.25,w*.25])
                        add(x+dx,2.4,face,w*.32,2.35,.13,0x4d5c64);
                    add(x,1.25,face+s*.06,1.75,2.3,.12,0x5d5348);
                }
                if(b.facadeStyle==='brick-rowhouse'){
                    add(x,h+.85,z,w*.86,1.3,d*.80,0x634942);
                    add(x,h+.12,face,w-.2,.17,.25,0xc1aea0);
                }
            }
            count.facades++;
            if(b.interiorTier==='shell-planned')count.shellPlanned++;
            if(b.interiorTier==='full')count.full++;
        }
        if(!parts.length)return count;
        DriverSpecialStructures.pack(parent,parts,'chicago-r78-sequential-frontages');
        return count;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoBlockGeneratorR78;
