/**
 * Chicago R77 — recognizable PS1-era urban silhouettes in the ACTUAL
 * playable Chicago, not another offline source geometry inspector.
 *
 * Four landmark parcels replace generic R14 buildings, aligned with the
 * EXISTING gameplay grid. Their arrangement follows the PS1 map's relative
 * neighborhoods, not a certified coordinate conversion from the ROM.
 * Every ground-level solid gets a matching city.buildingBoxes AABB.
 * Roads, traffic, missions and legacy landmark locations stay unchanged.
 */
class DriverChicagoPS1PlayableLandmarksR77 {
    static SITES=[
        {id:'sears-tower',name:'SEARS TOWER',x:-40,z:-120,
            kind:'tower',district:'downtown-west'},
        {id:'marina-city',name:'MARINA CITY',x:40,z:120,
            kind:'twin-cylinder',district:'river-north'},
        {id:'merchandise-mart',name:'MERCHANDISE MART',x:-120,z:120,
            kind:'riverside-mart',district:'river-north-west'},
        {id:'water-tower',name:'CHICAGO WATER TOWER',x:200,z:120,
            kind:'limestone-tower',district:'gold-coast'}
    ];
    static STREETS=[
        {name:'WACKER DR',x:-60,z:80,axis:'x'},
        {name:'STATE ST',x:0,z:-80,axis:'z'},
        {name:'MICHIGAN AVE',x:240,z:0,axis:'z'},
        {name:'LAKE SHORE DR',x:320,z:-160,axis:'z'},
        {name:'DIVISION ST',x:160,z:160,axis:'x'},
        {name:'RANDOLPH ST',x:80,z:-80,axis:'x'}
    ];
    static siteAt(x,z) {
        return this.SITES.find(s=>s.x===x&&s.z===z)||null;
    }
    static isReservedBlock(x,z) {
        return !!this.siteAt(x,z);
    }
    static state(city) {
        if(city.chicagoPS1PlayableLandmarksR77?.root?.parent===city.cityGroup)
            return city.chicagoPS1PlayableLandmarksR77;
        const root=new THREE.Group();
        root.name='chicago-ps1-playable-landmarks-r77';
        city.cityGroup.add(root);
        const state={root,sites:[],ids:new Set(),colliders:[],
            signs:0,mode:'playable-procedural-ps1-inspired',
            originalPS1CoordinatesCertified:false};
        city.chicagoPS1PlayableLandmarksR77=state;
        return state;
    }
    static box(parts,x,y,z,w,h,d,c,glow=false) {
        if([x,y,z,w,h,d].every(Number.isFinite)&&w>0&&h>0&&d>0)
            parts.push([x,y,z,w,h,d,c,glow]);
    }
    static solid(city,state,site,x,z,w,d) {
        if(![x,z,w,d].every(Number.isFinite)||w<=0||d<=0)
            throw new Error('R77 invalid landmark collider');
        // Never expand a landmark collider into a road or another district.
        if(Math.abs(x-site.x)+w/2>24.5||
           Math.abs(z-site.z)+d/2>24.5)
            throw new Error('R77 landmark outside its reserved parcel');
        const b={minX:x-w/2,maxX:x+w/2,
            minZ:z-d/2,maxZ:z+d/2,
            chicagoPS1LandmarkR77:site.id};
        city.buildingBoxes.push(b);
        state.colliders.push(b);
    }
    static sears(city,state,site,parts) {
        const {x,z}=site;
        const dark=0x3b4750,light=0x8f9696,glass=0x546877;
        // Nine stepped bundled shafts evoke the original Sears/Willis
        // massing: unequal roof heights make this recognizable at distance.
        const stems=[
            [-11,-11,115],[-11,0,126],[-11,11,97],
            [0,-11,139],[0,0,135],[0,11,104],
            [11,-11,110],[11,0,123],[11,11,91]
        ];
        for(const [dx,dz,h] of stems) {
            this.box(parts,x+dx,.35+h/2,z+dz,10.8,h,10.8,dark);
            this.box(parts,x+dx,.35+h-.22,z+dz,11.1,.44,11.1,light);
            // Windows remain inside the shaft face; no glass collision.
            for(let y=5;y<h-3;y+=7.2){
                this.box(parts,x+dx,.35+y,z+dz+5.43,9.5,.18,.12,glass);
                this.box(parts,x+dx+5.43,.35+y,z+dz,.12,.18,9.5,glass);
            }
        }
        for(const dx of [-11,0,11])for(const dz of [-11,0,11])
            this.box(parts,x+dx,.36,z+dz,11,.18,11,0x43494c);
        for(const dx of [-3,3])
            this.box(parts,x+dx,143,z-11,.25,12,.25,0xb8bbb5);
        this.solid(city,state,site,x,z,33,33);
    }
    static marina(city,state,site,parts,parent) {
        const {x,z}=site,base=0x5d6669,concrete=0xb3aca0;
        this.box(parts,x,2.2,z,38,3.8,24,base);
        this.box(parts,x,4.35,z,39,.42,25,concrete);
        const ringGeometry=new THREE.TorusGeometry(7.65,.32,4,24);
        const rings=new THREE.InstancedMesh(ringGeometry,
            new THREE.MeshLambertMaterial({color:0xc9c0b1}),54);
        const dummy=new THREE.Object3D();
        let index=0;
        for(const dx of [-10,10]){
            const tower=new THREE.Mesh(
                new THREE.CylinderGeometry(7.1,7.1,74,18),
                new THREE.MeshLambertMaterial({color:0x6e7e87}));
            tower.position.set(x+dx,41,z);
            tower.name='r77-marina-city-tower';
            parent.add(tower);
            for(let floor=0;floor<27;floor++){
                dummy.position.set(x+dx,5.9+floor*2.70,z);
                dummy.rotation.set(Math.PI/2,0,0);
                dummy.scale.set(1,1,1);dummy.updateMatrix();
                rings.setMatrixAt(index++,dummy.matrix);
            }
            // Two tower bases + lobby: AABBs match visible solids.
            this.solid(city,state,site,x+dx,z,14.2,14.2);
        }
        rings.instanceMatrix.needsUpdate=true;
        rings.name='r77-marina-city-balcony-rings';
        rings.frustumCulled=false;
        parent.add(rings);
        // The lobby is part of the visual volume, not an empty walkthrough.
        this.solid(city,state,site,x,z,38,24);
    }
    static mart(city,state,site,parts) {
        const {x,z}=site;
        this.box(parts,x,11.6,z,43,22.5,29,0x806b5e);
        this.box(parts,x,23.15,z,44,1.15,30,0xb4ada1);
        this.box(parts,x,25.15,z,40,2.6,26,0x8a877e);
        this.box(parts,x,27.0,z,34,1.3,19,0x6d7073);
        for(let dx=-18;dx<=18;dx+=4.5){
            this.box(parts,x+dx,12,z+14.64,2.5,16,.22,0x536472);
            this.box(parts,x+dx,12,z-14.64,2.5,16,.22,0x536472);
        }
        for(let floor=0;floor<3;floor++){
            this.box(parts,x,5.3+floor*6.4,z+14.75,42,.32,.36,0xc5b69f);
            this.box(parts,x,5.3+floor*6.4,z-14.75,42,.32,.36,0xc5b69f);
        }
        this.box(parts,x,3.0,z+14.86,8,5.2,.25,0x283b44);
        this.solid(city,state,site,x,z,43,29);
    }
    static watertower(city,state,site,parts) {
        const {x,z}=site,limestone=0xc8c2af,roof=0x75818b;
        this.box(parts,x,7.7,z,16,14.7,17,limestone);
        this.box(parts,x,15.7,z,17.5,1.3,18.5,roof);
        this.box(parts,x,19.8,z,8,7.2,8,limestone);
        this.box(parts,x,24.4,z,10,.9,10,roof);
        this.box(parts,x,30.4,z,5.1,11.2,5.1,limestone);
        this.box(parts,x,36.5,z,6.4,1.3,6.4,roof);
        for(const dx of [-6.8,6.8])for(const dz of [-6.8,6.8]){
            this.box(parts,x+dx,19.1,z+dz,2.4,8,2.4,limestone);
            this.box(parts,x+dx,23.3,z+dz,3.5,1.0,3.5,roof);
            this.box(parts,x+dx,25.1,z+dz,1.15,2.9,1.15,limestone);
        }
        for(const dx of [-4.2,0,4.2])
            this.box(parts,x+dx,6.7,z+8.58,2.2,4.4,.18,0x67757a);
        this.box(parts,x,1.0,z+13,22,.18,5,0xada99d);
        this.solid(city,state,site,x,z,17,18.5);
    }
    static buildBlock(city,x,z) {
        if(city?.preset?.id!=='chicago'||!city.cityGroup||
            !Array.isArray(city.buildingBoxes))return null;
        const site=this.siteAt(x,z);
        if(!site)return null;
        const state=this.state(city);
        if(state.ids.has(site.id))return site;
        const parent=new THREE.Group();
        parent.name='r77-'+site.id;
        state.root.add(parent);
        const parts=[];
        if(site.id==='sears-tower')this.sears(city,state,site,parts);
        else if(site.id==='marina-city')this.marina(city,state,site,parts,parent);
        else if(site.id==='merchandise-mart')this.mart(city,state,site,parts);
        else if(site.id==='water-tower')this.watertower(city,state,site,parts);
        if(typeof DriverSpecialStructures!=='undefined')
            DriverSpecialStructures.pack(parent,parts,'r77-'+site.id);
        state.sites.push(site);
        state.ids.add(site.id);
        if(city._spatialCollisions)city._spatialCollisions.boxes=null;
        return site;
    }
    static signTexture(name) {
        if(typeof document==='undefined')return null;
        const cv=document.createElement('canvas');
        cv.width=512;cv.height=96;
        const ctx=cv.getContext('2d');
        if(!ctx)return null;
        ctx.fillStyle='#1b5b42';ctx.fillRect(0,0,512,96);
        ctx.fillStyle='#cdd7cf';ctx.fillRect(5,5,502,86);
        ctx.fillStyle='#1b5b42';ctx.fillRect(9,9,494,78);
        ctx.fillStyle='#f5f3e9';
        ctx.font='bold '+(name.length>12?34:40)+'px sans-serif';
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(name,256,48,470);
        const tex=new THREE.CanvasTexture(cv);
        tex.needsUpdate=true;return tex;
    }
    static CROSSINGS=[
        {x:0,z:-80},{x:80,z:-80},{x:240,z:-80},
        {x:0,z:80},{x:80,z:80},{x:240,z:80}
    ];
    static buildCrosswalks(city) {
        if(city?.preset?.id!=='chicago'||!city.cityGroup)return null;
        const state=this.state(city);
        if(state.crosswalksBuilt)return state;
        state.crosswalksBuilt=true;state.crosswalks=0;
        const parts=[];
        // Six real EXISTING grid intersections in Loop/River North.
        // Zebra strips end before the stop line. No asphalt, new path,
        // collider or traffic node is generated by this decoration.
        for(const crossing of this.CROSSINGS){
            for(const axis of ['x','z'])for(const side of [-1,1]){
                for(let offset=-7.5;offset<=7.5;offset+=2.5){
                    const px=axis==='z'?crossing.x+offset:
                        crossing.x+side*16.5;
                    const pz=axis==='z'?crossing.z+side*16.5:
                        crossing.z+offset;
                    // Never draw a crossing on water or on an AABB building.
                    if(city.isWaterAt?.(px,pz)||
                       city.isPointBlocked?.(px,pz,.3,0))continue;
                    this.box(parts,px,.083,pz,
                        axis==='z'?1.55:3.15,.012,
                        axis==='z'?3.15:1.55,0xcac5b7);
                    state.crosswalks++;
                }
            }
        }
        if(typeof DriverSpecialStructures!=='undefined')
            DriverSpecialStructures.pack(state.root,parts,'r77-ps1-crosswalks');
        return state;
    }
    static buildWayfinding(city) {
        if(city?.preset?.id!=='chicago'||!city.cityGroup)return null;
        const state=this.state(city);
        if(state.signs)return state;
        const posts=[];
        for(const s of this.STREETS){
            // Offsets sit beside existing streets; no new road or collider.
            const px=s.x+(s.axis==='z'?12:0),
                pz=s.z+(s.axis==='x'?12:0);
            posts.push([px,2.25,pz,.15,4.5,.15,0x626d70,false]);
            posts.push([px,4.65,pz,3.5,.17,.2,0x9ba9a8,false]);
            const tex=this.signTexture(s.name);
            if(!tex)continue;
            const sign=new THREE.Sprite(new THREE.SpriteMaterial({
                map:tex,transparent:true,depthWrite:false}));
            sign.position.set(px,5.3,pz);
            sign.scale.set(6.6,1.25,1);
            sign.name='r77-street-'+s.name.toLowerCase().replace(/[^a-z]+/g,'-');
            state.root.add(sign);
            state.signs++;
        }
        if(typeof DriverSpecialStructures!=='undefined')
            DriverSpecialStructures.pack(state.root,posts,'r77-street-name-posts');
        this.buildCrosswalks(city);
        return state;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoPS1PlayableLandmarksR77;
