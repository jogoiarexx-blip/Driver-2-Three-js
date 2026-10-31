/**
 * Driver 2 Chicago R57 — public approaches, waterfront promenade, car parks.
 * Geometry adapted to procedural Chicago; NOT certified PS1 road geometry.
 *
 * Road links are sampled for water/AABBs before they enter R49's graph.
 * Car parks are non-solid drivable surfaces, physical guardrails are placed
 * only at matching visible shoreline rail meshes. Props use near/far LOD.
 */
class DriverChicagoLandmarkDistrictR57 {
    static APPROACHES=[
        {id:'pier-service',district:'navy-pier',width:5.6,
            points:[[320,-80],[320,-56],[328,-51],[328,-40],[341,-40]]},
        {id:'wrigley-west',district:'wrigley',width:5.8,
            points:[[-320,240],[-301,240],[-301,227],[-289,227],[-280,225]]},
        {id:'soldier-east',district:'soldier',width:5.8,
            points:[[320,-240],[297,-240],[296,-255],[282,-255],[280,-255]]}
    ];
    static PARKING=[
        {id:'pier-south',district:'navy-pier',x:307,z:-64,w:14,d:9,spaces:4},
        {id:'pier-north',district:'navy-pier',x:308,z:-9,w:14,d:9,spaces:4},
        {id:'wrigley-west',district:'wrigley',x:-307,z:227,w:13,d:8,spaces:4},
        {id:'wrigley-east',district:'wrigley',x:-259,z:228,w:13,d:8,spaces:4},
        {id:'soldier-west',district:'soldier',x:265,z:-250,w:14,d:8,spaces:4},
        {id:'soldier-east',district:'soldier',x:302,z:-250,w:14,d:8,spaces:4}
    ];
    static SECTIONS=[
        {id:'navy-pier',x:344,z:-40},
        {id:'wrigley',x:-280,z:200},
        {id:'soldier',x:280,z:-280}
    ];
    static valid(city,x,z,r=0) {
        return Number.isFinite(x)&&Number.isFinite(z)&&
            !city?.isWaterAt?.(x,z)&&
            !city?.isPointBlocked?.(x,z,r,0);
    }
    static verifyLine(city,a,b,radius=1.6) {
        const d=Math.hypot(b[0]-a[0],b[1]-a[1]);
        for(let i=0,n=Math.max(1,Math.ceil(d/1.4));i<=n;i++){
            const t=i/n,x=a[0]+(b[0]-a[0])*t,
                z=a[1]+(b[1]-a[1])*t;
            if(!this.valid(city,x,z,radius))
                return {ok:false,at:[x,z]};
        }
        return {ok:true};
    }
    static verifyApproach(city,route) {
        if(city?.preset?.id!=='chicago')return {ok:false,reason:'city'};
        const points=route.points;
        for(let i=1;i<points.length;i++){
            const check=this.verifyLine(city,points[i-1],points[i]);
            if(!check.ok)return {ok:false,reason:'blocked-or-water',at:check.at};
        }
        return {ok:true,meters:points.slice(1).reduce((sum,p,i)=>
            sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0)};
    }
    static verifyLot(city,lot) {
        if(city?.preset?.id!=='chicago')return false;
        // Covers perimeter and individual stalls; do not just test center.
        for(let xi=-2;xi<=2;xi++)for(let zi=-2;zi<=2;zi++){
            const x=lot.x+xi*(lot.w/2-.25)/2,
                z=lot.z+zi*(lot.d/2-.25)/2;
            if(!this.valid(city,x,z,.35))return false;
        }
        return true;
    }
    static height(city,x,z) {
        const h=city?.getGroundHeightAt?.(x,z,0,true);
        return Number.isFinite(h)?h:0;
    }
    static plane(parent,name,city,points,width,mat) {
        const out=[],len=points.length;
        for(let i=1;i<len;i++){
            const a=points[i-1],b=points[i],dx=b[0]-a[0],
                dz=b[1]-a[1],dist=Math.hypot(dx,dz);
            if(dist<.1)continue;
            const nx=-dz/dist*width/2,nz=dx/dist*width/2,
                steps=Math.max(1,Math.ceil(dist/2.8));
            const vertex=(x,z)=>out.push(x,this.height(city,x,z)+.035,z);
            for(let j=0;j<steps;j++){
                const t=j/steps,u=(j+1)/steps;
                const l=[a[0]+dx*t+nx,a[1]+dz*t+nz],
                    r=[a[0]+dx*t-nx,a[1]+dz*t-nz],
                    L=[a[0]+dx*u+nx,a[1]+dz*u+nz],
                    R=[a[0]+dx*u-nx,a[1]+dz*u-nz];
                // Up-facing winding; road geometry never creates an AABB.
                vertex(...l);vertex(...L);vertex(...r);
                vertex(...r);vertex(...L);vertex(...R);
            }
        }
        if(!out.length)return null;
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position',new THREE.Float32BufferAttribute(out,3));
        geo.computeVertexNormals();
        const mesh=new THREE.Mesh(geo,mat);
        mesh.name=name;mesh.receiveShadow=true;
        parent.add(mesh);return mesh;
    }
    static box(parent,name,x,y,z,w,h,d,mat) {
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
        mesh.name=name;mesh.position.set(x,y,z);
        mesh.castShadow=false;mesh.receiveShadow=true;parent.add(mesh);
        return mesh;
    }
    static solid(city,parent,name,x,y,z,w,h,d,mat,bag) {
        const mesh=this.box(parent,name,x,y,z,w,h,d,mat);
        const aabb={minX:x-w/2,maxX:x+w/2,
            minZ:z-d/2,maxZ:z+d/2,chicagoR57:name};
        city.buildingBoxes.push(aabb);bag.push(aabb);
        return mesh;
    }
    static instances(parent,name,parts,mat) {
        if(!parts.length)return null;
        const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),
            mat,parts.length);
        const dummy=new THREE.Object3D();
        for(let i=0;i<parts.length;i++){
            const p=parts[i];
            dummy.position.set(p[0],p[1],p[2]);
            dummy.scale.set(p[3],p[4],p[5]);
            dummy.rotation.set(0,0,0);
            dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate=true;
        mesh.frustumCulled=false;mesh.name=name;
        parent.add(mesh);return mesh;
    }
    static routeGround(city,state,route,asphalt) {
        const report=this.verifyApproach(city,route);
        if(!report.ok)return {...report,id:route.id};
        const section=state.sections[route.district];
        const mesh=this.plane(section.base,'r57-secondary-street-'+route.id,
            city,route.points,route.width,asphalt);
        if(!mesh)return {ok:false,id:route.id,reason:'no-geometry'};
        const links=[];
        for(let i=1;i<route.points.length;i++)
            links.push({from:{x:route.points[i-1][0],z:route.points[i-1][1]},
                to:{x:route.points[i][0],z:route.points[i][1]},
                width:route.width,id:route.id});
        state.links.push(...links);
        return {...report,id:route.id,segments:links.length};
    }
    static makeParking(city,state,lot,asphalt,white) {
        if(!this.verifyLot(city,lot))return {id:lot.id,ok:false,
            reason:'occupied-or-water'};
        const root=state.sections[lot.district].base;
        const cx=lot.x,cz=lot.z,w=lot.w,d=lot.d;
        this.plane(root,'r57-parking-'+lot.id,city,[
            [cx-w/2,cz],[cx+w/2,cz]],d,asphalt);
        // Each bay has a real width and local ground height; no solid
        // bounding box or fake cars that would block vehicle parking.
        const marks=[];
        for(let i=0;i<=lot.spaces;i++){
            const x=cx-w/2+w*i/lot.spaces;
            marks.push([x,this.height(city,x,cz)+.06,cz,.09,.014,d-.6]);
        }
        marks.push([cx,this.height(city,cx,cz-d/2+.27)+.06,
            cz-d/2+.27,w,.014,.09]);
        this.instances(root,'r57-parking-stalls-'+lot.id,marks,white);
        state.lots.push(lot);
        return {id:lot.id,ok:true,spaces:lot.spaces};
    }
    static shoreline(city,state,steel,pave) {
        const s=state.sections['navy-pier'],parts=[],rails=[];
        const coast=typeof DriverChicagoPS1Coastline!=='undefined'?
            DriverChicagoPS1Coastline:null;
        if(!coast)return {promenadeMeters:0,rails:0};
        for(const [lo,hi] of [[-115,-65],[-18,29]]){
            for(let z=lo;z<hi;z+=7.5){
                const a=coast.shoreX(z+3.75)-1.85;
                // Never continue shore safety rail across pier entrance.
                if(!this.valid(city,a,z+3.75,.35))continue;
                const y=this.height(city,a,z+3.75);
                const box=this.solid(city,s.base,'r57-lakefront-rail-'+
                    Math.round(z*10),a,y+.77,z+3.75,.25,1.45,7.25,
                    steel,state.colliders);
                if(box)rails.push({x:a,z:z+3.75});
                // Sufficient buffer from lake; avoids fake road over water.
                const foot=a-4.0;
                if(this.valid(city,foot,z+3.75,1.0))
                    this.plane(s.base,'r57-promenade-'+Math.round(z*10),city,
                        [[foot,z],[foot,z+7.5]],5.2,pave);
                parts.push([a,y+1.57,z+3.75,.3,.12,7.25]);
            }
        }
        this.instances(s.base,'r57-shore-rail-top',parts,steel);
        s.railPoints=rails;
        return {promenadeMeters:rails.length*7.25,rails:rails.length};
    }
    static detailFor(city,section,materials) {
        if(section.near)return section.near;
        const root=new THREE.Group();
        root.name='r57-detail-'+section.id;
        section.root.add(root);
        const bases=[],tops=[],metal=[],leaves=[];
        const samples=section.id==='navy-pier'?
            [[335,-95],[337,-79],[336,-15],[335,5],[342,19]]:
            section.id==='wrigley'?
            [[-309,234],[-259,234],[-307,174],[-254,174]]:
            [[260,-246],[301,-246],[259,-308],[304,-308]];
        for(const [x,z]of samples){
            if(!this.valid(city,x,z,.9))continue;
            const h=this.height(city,x,z);
            bases.push([x,h+.37,z,1.15,.74,1.15]);
            metal.push([x,h+1.72,z,.18,2.7,.18]);
            tops.push([x,h+3.2,z,1.8,.25,1.8]);
            leaves.push([x+1.7,h+.82,z+1.8,1.8,1.55,1.8]);
        }
        this.instances(root,'r57-near-bench-base-'+section.id,
            bases,materials.timber);
        this.instances(root,'r57-near-lamp-posts-'+section.id,
            metal,materials.steel);
        this.instances(root,'r57-near-lamp-heads-'+section.id,
            tops,materials.lamp);
        this.instances(root,'r57-near-planters-'+section.id,
            leaves,materials.leaf);
        section.near=root;section.nearBuilt=true;
        return root;
    }
    static build(city) {
        if(city?.preset?.id!=='chicago'||!city.cityGroup||
            !city.chicagoStadium||!city.chicagoSoldierField)return null;
        if(city.chicagoLandmarkDistrictR57?.root?.parent===city.cityGroup)
            return city.chicagoLandmarkDistrictR57;
        const root=new THREE.Group();
        root.name='chicago-landmark-district-r57';
        city.cityGroup.add(root);
        const state={root,sections:{},links:[],lots:[],colliders:[],
            approaches:[],parking:[],clock:0,lastFocus:null,lodSwitches:0};
        const steel=new THREE.MeshLambertMaterial({color:0x728897});
        const asphalt=new THREE.MeshLambertMaterial({
            color:0x505960,side:THREE.DoubleSide,
            polygonOffset:true,polygonOffsetFactor:-2});
        const pave=new THREE.MeshLambertMaterial({
            color:0x89918f,side:THREE.DoubleSide,
            polygonOffset:true,polygonOffsetFactor:-2});
        const white=new THREE.MeshLambertMaterial({color:0xc4c6b7});
        const materials={steel,timber:new THREE.MeshLambertMaterial({color:0x886e54}),
            lamp:new THREE.MeshBasicMaterial({color:0xe3c897}),
            leaf:new THREE.MeshLambertMaterial({color:0x3d704d})};
        for(const d of this.SECTIONS){
            const section=new THREE.Group();
            section.name='r57-section-'+d.id;
            const base=new THREE.Group(),far=new THREE.Group();
            section.add(base,far);
            root.add(section);
            state.sections[d.id]={...d,root:section,base,far,near:null,
                level:'far',nearBuilt:false,railPoints:[]};
        }
        for(const route of this.APPROACHES)
            state.approaches.push(this.routeGround(city,state,route,asphalt));
        for(const lot of this.PARKING)
            state.parking.push(this.makeParking(city,state,lot,asphalt,white));
        state.coast=this.shoreline(city,state,steel,pave);
        // Far silhouettes: 3 batches, near details allocate only when needed.
        for(const section of Object.values(state.sections)){
            const pieces=[];
            if(section.id==='navy-pier'){
                for(const r of section.railPoints.filter((_,i)=>i%3===0))
                    pieces.push([r.x-2.5,1,r.z,3,2,5.5]);
            } else {
                const s=section.id==='wrigley'?
                    [[-301,225],[-260,226]]:[[262,-248],[300,-248]];
                for(const [x,z]of s)
                    pieces.push([x,.45,z,3,.9,5]);
            }
            this.instances(section.far,'r57-far-streetscape-'+section.id,
                pieces,steel);
        }
        city.chicagoLandmarkDistrictR57=state;
        if(city._spatialCollisions)city._spatialCollisions.boxes=null;
        return state;
    }
    static update(city,focus,dt) {
        const state=city?.chicagoLandmarkDistrictR57;
        if(!state||state.root.parent!==city.cityGroup||
            !Number.isFinite(focus?.x)||!Number.isFinite(focus?.z))return;
        state.clock+=(Number.isFinite(dt)?Math.max(0,dt):.016);
        if(state.clock<.16)return;
        state.clock=0;
        const tasks=[];
        for(const s of Object.values(state.sections)){
            const distance=Math.hypot(focus.x-s.x,focus.z-s.z);
            const want=s.level==='far'?distance<170:distance<235;
            if((s.level==='near')!==want)
                tasks.push({s,want,distance});
        }
        // At most one group changes per check to prevent GPU spikes.
        tasks.sort((a,b)=>a.want?-1:1);
        const task=tasks[0];
        if(task){
            const s=task.s;
            if(task.want){
                const mats=state.detailMaterials||=({
                    steel:new THREE.MeshLambertMaterial({color:0x728897}),
                    timber:new THREE.MeshLambertMaterial({color:0x886e54}),
                    lamp:new THREE.MeshBasicMaterial({color:0xe3c897}),
                    leaf:new THREE.MeshLambertMaterial({color:0x3d704d})
                });
                this.detailFor(city,s,mats);
            }
            s.near&&(s.near.visible=task.want);
            s.far.visible=!task.want;
            s.level=task.want?'near':'far';
            state.lodSwitches++;
        }
        state.lastFocus={x:focus.x,z:focus.z};
    }
    static audit(city) {
        const s=city?.chicagoLandmarkDistrictR57;
        return {installed:!!s,
            approaches:s?.approaches.map(r=>({id:r.id,ok:r.ok,
                segments:r.segments||0,reason:r.reason||null}))||[],
            parking:s?.parking.map(l=>({id:l.id,ok:l.ok,
                spaces:l.ok?l.spaces:0,reason:l.reason||null}))||[],
            totalSpaces:s?.parking.filter(l=>l.ok).reduce(
                (n,l)=>n+l.spaces,0)||0,
            shore:s?.coast||null,colliders:s?.colliders.length||0,
            graphEdges:s?.links.length||0,
            lod:s?Object.values(s.sections).map(v=>({
                id:v.id,level:v.level,nearBuilt:v.nearBuilt})):[],
            lodSwitches:s?.lodSwitches||0};
    }
}
if(typeof window!=='undefined')
    window.DriverChicagoLandmarkDistrictR57=DriverChicagoLandmarkDistrictR57;
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoLandmarkDistrictR57;
