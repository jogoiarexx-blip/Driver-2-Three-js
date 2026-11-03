/**
 * R80 Chicago River — playable, physically matched waterside and bridge detail.
 * APPROXIMATE procedural waterways, NOT ROM-certified PS1 geography.
 *
 * The R2 river remains the sole water/deck geometry source. R80 takes
 * existing R2 bank-rail locations, gives safe segments matching AABB
 * barriers (not invisible walls), and paints pedestrian quays on verified
 * DRY physical floor. No cars may route onto them.
 *
 * R53 (8 existing buildings) and R78 (Goose Island lots) get river-facing
 * facade trim without new buildings/collisions. Fixed bridge detail follows
 * the ten decks as pure decoration; drawbridge pivots remain untouched.
 */
class DriverChicagoRiverfrontR80 {
    static VERSION='r80-riverfront-physical-banks';
    static RAIL_HALF_WIDTH=.16;
    static RAIL_HALF_DEPTH=4.6;
    static WATER_PAD=11.9;
    static BANKS=[
        {id:'west',x:-240,start:-324,end:306,bridges:[-320,-240,-160,-80,0,80,160,240]},
        {id:'east',x:-160,start:94,end:306,bridges:[160,240]}
    ];
    static fixedBridgeSites(){
        return this.BANKS.flatMap(b=>b.bridges.map(z=>({x:b.x,z,bank:b.id})));
    }
    static classify(){
        return {originalPS1PlacementCertified:false,
            bridgeCountOriginalPS1Certified:false,
            missionCoordinatesChanged:false,waterPhysicsChanged:false,
            artificialRiverfrontFacadeOnly:false,
            drivableRoutesAdded:0};
    }
    static floor(city,x,z){
        return typeof city?.getGroundHeightAt==='function'?
            city.getGroundHeightAt(x,z,null,true):0;
    }
    static existingRailPositions(){
        const found=[];
        const source=typeof DriverChicagoPS1RiverBranches!=='undefined'?
            DriverChicagoPS1RiverBranches:null;
        for(const bank of this.BANKS){
            for(let z=bank.start+8;z<bank.end;z+=12){
                // Reproduce R2's exact skip rule and 10-unit rail.
                if((source?.isBridge(bank.x,z))||
                   (source?.isBridge(bank.x,z+6))||
                   bank.bridges.some(b=>Math.abs(b-z)<=16||
                       Math.abs(b-(z+6))<=16))continue;
                for(const side of [-1,1])
                    found.push({bank:bank.id,channelX:bank.x,z,side,
                        x:bank.x+side*(this.WATER_PAD+.5)});
            }
        }
        return found;
    }
    static clearRail(city,p){
        if(city?.preset?.id!=='chicago')return false;
        // Check a full segment, plus its clearance on the LAND side.
        // Reject overlaps with existing R53/R78 buildings, mission props,
        // narrow islands, and all deck entrances.
        const river=typeof DriverChicagoPS1RiverBranches!=='undefined'?
            DriverChicagoPS1RiverBranches:null;
        for(const dz of [-this.RAIL_HALF_DEPTH,0,this.RAIL_HALF_DEPTH]){
            const z=p.z+dz;
            if(river?.isBridge(p.channelX,z))return false;
            for(const offset of [0,p.side*.45]){
                const x=p.x+offset;
                if(city.isWaterAt?.(x,z)||
                   city.isPointBlocked?.(x,z,.22,0)||
                   !Number.isFinite(this.floor(city,x,z)))return false;
            }
        }
        return true;
    }
    static put(parts,x,y,z,w,h,d,color){
        if([x,y,z,w,h,d].every(Number.isFinite)&&w>0&&h>0&&d>0)
            parts.push([x,y,z,w,h,d,color,false]);
    }
    static buildBanks(city,report,root){
        const bankParts=[],walks=[],colliders=[],rejected=[];
        for(const p of this.existingRailPositions()){
            if(!this.clearRail(city,p)){
                rejected.push({bank:p.bank,side:p.side,z:p.z});continue;
            }
            // AABB matches the *existing visible R2 bank rail*, which is
            // 0.26 wide x 10 long. R80 avoids changing any bridge deck.
            const bx=p.x,bz=p.z,halfX=.13,halfZ=5;
            const box={minX:bx-halfX,maxX:bx+halfX,
                minZ:bz-halfZ,maxZ:bz+halfZ,
                chicagoRiverfrontR80:true,bank:p.bank};
            city.buildingBoxes.push(box);colliders.push(box);
            const y=this.floor(city,bx,bz);
            // R2 already draws the middle railing. Upper cap + riveted
            // posts and stone edge visually explain the physical barrier.
            this.put(bankParts,bx,y+1.12,bz,.3,.16,9.25,0xb2b7b4);
            this.put(bankParts,bx-p.side*.25,y+.25,bz,.3,.5,9.25,0x737776);
            for(const dz of [-4.2,-1.4,1.4,4.2])
                this.put(bankParts,bx,y+.82,bz+dz,.24,1.5,.26,0x55616b);
            // Dry pedestrian-facing quay within the old floor, not a road
            // or a new navigable path. Cars are never routed onto it.
            const walkX=bx+p.side*1.65;
            const dry=[-4.5,0,4.5].every(dz=>
                !city.isWaterAt?.(walkX,bz+dz)&&
                !city.isPointBlocked?.(walkX,bz+dz,.65,0));
            if(dry){
                const h=this.floor(city,walkX,bz);
                this.put(walks,walkX,h+.021,bz,2.8,.035,9.2,
                    p.bank==='east'?0x85877f:0x8c8982);
                // Travertine edging at shoreward foot of wall;
                // no tall invisible barrier added to pedestrian path.
                report.quaySegments++;
            }
        }
        if(bankParts.length&&typeof DriverSpecialStructures!=='undefined')
            DriverSpecialStructures.pack(root,bankParts,'r80-physical-bank-caps');
        if(walks.length&&typeof DriverSpecialStructures!=='undefined')
            DriverSpecialStructures.pack(root,walks,'r80-dry-quays');
        report.colliders=colliders;
        report.railsCreated=colliders.length;
        report.bankRejected=rejected;
        report.railDetailParts=bankParts.length;
        return report;
    }
    static buildFixedBridgeDetail(city,report,root){
        const parts=[];
        for(const {x,z} of this.fixedBridgeSites()){
            // All ornaments sit above / outside the road lanes z±4.
            // The existing R2 deck at z±13 has no new blockers.
            for(const side of [-1,1]){
                const railZ=z+side*14.05;
                this.put(parts,x,1.11,railZ,29.4,.18,.22,0x9fa7ad);
                for(const dx of [-12,-8,-4,0,4,8,12])
                    this.put(parts,x+dx,1.05,railZ,.22,1.2,.26,
                        0x616b75);
            }
            for(const sign of [-1,1])for(const dx of [-13.3,13.3]){
                // Raised stone bridge-end posts outside the vehicle lane.
                this.put(parts,x+dx,.88,z+sign*13.15,.7,1.75,.75,
                    0xa4a19a);
                this.put(parts,x+dx,1.86,z+sign*13.15,.95,.22,.97,
                    0xb8b6b1);
            }
        }
        if(parts.length&&typeof DriverSpecialStructures!=='undefined')
            DriverSpecialStructures.pack(root,parts,'r80-bridge-caps-and-rivets');
        report.fixedBridgeCount=this.fixedBridgeSites().length;
        report.bridgeDetailParts=parts.length;
        report.dynamicBridgePivotsTouched=false;
    }
    static buildFacades(city,report,root){
        const pieces=[];
        const add=(x,z,width,height,face,style)=>{
            // face: +1 facade to east, -1 to west. All attachments lie
            // fractionally OUTSIDE the extant building box, visual only.
            const hx=x+face*(width/2+.105);
            const brick=style==='industrial'?0x7b7067:0x9a9288,
                iron=style==='industrial'?0x505960:0x7e858a,
                glass=style==='industrial'?0x455861:0x435c66;
            this.put(pieces,hx,height-.4,z,.24,.44,9.7,brick);
            for(const dz of [-3.1,0,3.1]){
                for(let h=3.1;h<height-2;h+=3.45){
                    this.put(pieces,hx+face*.075,h,z+dz,.16,1.65,1.8,glass);
                    this.put(pieces,hx+face*.13,h+1.02,z+dz,.28,.16,2.02,iron);
                }
            }
            this.put(pieces,hx+face*.07,1.1,z,.18,1.95,2.1,iron);
            report.facades++;
        };
        // R53's eight buildings are already collidable and physically
        // placed on land. Add east/west canal-facing architecture only.
        const existing=city.buildingBoxes?.filter(b=>b.chicagoR53Lot)||[];
        for(const b of existing){
            const x=(b.minX+b.maxX)/2,z=(b.minZ+b.maxZ)/2;
            const face=x<-240?1:-1;
            // R53 insertion order defines heights 10,13,16 cyclically,
            // but decorative trim is capped at safe first 9m instead.
            add(x,z,b.maxX-b.minX,8.6,face,'commercial');
            report.r53Buildings++;
        }
        // Existing R78 warehouse fronts on east Goose Island waterway.
        const island=(city.districtBuildings||[]).filter(b=>b.pilotR78&&
            b.blockX===-200&&b.blockZ===120&&
            b.x+b.width/2>-185);
        for(const b of island){
            add(b.x,b.z,b.width,Math.min(11,b.height-1),1,'industrial');
            report.r78CanalBuildings++;
        }
        if(pieces.length&&typeof DriverSpecialStructures!=='undefined')
            DriverSpecialStructures.pack(root,pieces,'r80-river-facing-existing-facades');
        report.facadeParts=pieces.length;
    }
    static build(city){
        if(city?.preset?.id!=='chicago'||!city.cityGroup||
            !city.chicagoPS1RiverBranches)return null;
        if(city.chicagoRiverfrontR80)return city.chicagoRiverfrontR80;
        const root=new THREE.Group();
        root.name='chicago-r80-bridges-and-riverfront';
        root.userData.ps1SourceCoordinateCertified=false;
        city.cityGroup.add(root);
        const report={version:this.VERSION,...this.classify(),
            root,bankRejected:[],colliders:[],railsCreated:0,
            quaySegments:0,railDetailParts:0,fixedBridgeCount:0,
            bridgeDetailParts:0,facades:0,r53Buildings:0,
            r78CanalBuildings:0,facadeParts:0,ready:false};
        this.buildBanks(city,report,root);
        this.buildFixedBridgeDetail(city,report,root);
        this.buildFacades(city,report,root);
        report.ready=report.fixedBridgeCount===10 &&
            report.railsCreated>0;
        city.chicagoRiverfrontR80=report;
        // Existing R49 and car collision use exactly this AABB array.
        if(city._spatialCollisions)city._spatialCollisions.boxes=null;
        return report;
    }
}
if(typeof window!=='undefined')
    window.DriverChicagoRiverfrontR80=DriverChicagoRiverfrontR80;
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoRiverfrontR80;
