/**
 * Chicago R52: Goose Island east-bank neighborhood and existing fixed bridge.
 *
 * Four building cells [-120,-40] x [200,280] are replaced with actual roads,
 * pavements and smaller buildings. The central cross street at z=240 uses
 * the fixed bridge from the Chicago R2 river system, connecting Goose Island
 * at x=-200 to the original avenue x=0.
 *
 * Procedural map geometry, not a certified PS1 original street layout.
 */
class DriverChicagoGooseEastR52 {
    static X=[-120,-40];
    static Z=[200,280];
    static MID=240;
    static WIDTH=17;
    static isCarvedBlock(x,z){return this.X.includes(x)&&this.Z.includes(z);}
    static nodes(){return [200,240,280].flatMap(z=>
        this.X.map(x=>({x,z,id:'r52-'+x+'-'+z})));
    }
    static streets(){
        return [
            ...this.Z.map(z=>({id:'east-west-'+z,axis:'x',
                from:{x:-120,z},to:{x:0,z}})),
            {id:'goose-bridge',axis:'x',
                from:{x:-200,z:this.MID},to:{x:0,z:this.MID}},
            ...this.X.map(x=>({id:'north-south-'+x,axis:'z',
                from:{x,z:160},to:{x,z:320}}))
        ];
    }
    static topology(){
        const nodes=this.nodes(),edges=[],add=(id,from,to)=>
            edges.push({id,from,to});
        for(const z of [200,240,280]){
            add('east-link-'+z,{x:-120,z},{x:-40,z});
            add('avenue-'+z,{x:-40,z},{x:0,z});
        }
        for(const x of this.X){
            add('south-gateway-'+x,{x,z:160},{x,z:200});
            add('south-intersection-'+x,{x,z:200},{x,z:240});
            add('north-intersection-'+x,{x,z:240},{x,z:280});
            add('north-gateway-'+x,{x,z:280},{x,z:320});
        }
        // The crossing exists at x=-160,z=240. Never invent another bridge.
        add('existing-bridge-east',{x:-200,z:240},{x:-160,z:240});
        add('existing-bridge-westbank',{x:-160,z:240},{x:-120,z:240});
        // Existing Goose Island R4/R6 asphalt, not duplicated by this module.
        add('goose-spine-south',{x:-200,z:160},{x:-200,z:240});
        add('goose-spine-north',{x:-200,z:240},{x:-200,z:320});
        const gridExits=10; // east x=0 (3), vertical z=160/320 (4),
                            // bridge to x=-200 (1), Goose Island N/S (2).
        return {nodes,edges,gridExits,internalEdges:edges.length-gridExits};
    }
    static safe(city,from,to,width=4){
        if(!city||!from||!to)return false;
        const dx=to.x-from.x,dz=to.z-from.z,dist=Math.hypot(dx,dz);
        if(!Number.isFinite(dist)||dist<1)return false;
        const nx=-dz/dist,nz=dx/dist;
        const steps=Math.ceil(dist/2.5);
        for(let i=0;i<=steps;i++){
            const t=i/steps,x=from.x+dx*t,z=from.z+dz*t;
            for(const offset of [-width,0,width]){
                if(city.isWaterAt?.(x+nx*offset,z+nz*offset) ||
                   city.isPointBlocked?.(x+nx*offset,z+nz*offset,1.55,0))
                    return false;
            }
        }
        return true;
    }
    static audit(city){
        if(city?.preset?.id!=='chicago')return null;
        const topo=this.topology();
        const blocked=topo.edges.filter(e=>!this.safe(city,e.from,e.to))
            .map(e=>e.id);
        const protectedBlocks=this.Z.flatMap(z=>this.X.filter(x=>
            typeof DriverChicagoCityPlan!=='undefined' &&
            DriverChicagoCityPlan.isProtected(x,z)).map(x=>({x,z})));
        return {...topo,blocked,protectedBlocks,
            ready:blocked.length===0&&protectedBlocks.length===0,
            originalPS1Certified:false,bridgeReused:true};
    }
    static build(city){
        if(city?.preset?.id!=='chicago')return null;
        if(city.chicagoGooseEastR52)return city.chicagoGooseEastR52;
        const report=this.audit(city);
        report.corridorsPlanned=this.streets().length;
        if(!report.ready){city.chicagoGooseEastR52=report;return report;}
        const group=new THREE.Group();
        group.name='chicago-r52-goose-east-bank';
        group.userData.originalPS1Certified=false;
        const roadMat=new THREE.MeshLambertMaterial({color:0x41474b});
        const concrete=new THREE.MeshLambertMaterial({color:0x8a9090});
        const paint=new THREE.MeshBasicMaterial({color:0xbab39b});
        const zebra=new THREE.MeshBasicMaterial({color:0xd4d1c4});
        for(const street of this.streets()){
            const length=Math.hypot(street.to.x-street.from.x,
                street.to.z-street.from.z);
            const road=new THREE.Mesh(
                new THREE.BoxGeometry(street.axis==='x'?length:this.WIDTH,
                    .075,street.axis==='z'?length:this.WIDTH),roadMat);
            road.position.set((street.from.x+street.to.x)/2,.052,
                (street.from.z+street.to.z)/2);
            road.name='r52-road-'+street.id;
            // Bridge already has its own deck at (-160,240):
            // the road coating aligns visually but adds no collision.
            group.add(road);
        }
        const dummy=new THREE.Object3D(),sidewalkPositions=[];
        for(const z of this.Z)for(const x of this.X)
            for(const sx of [-1,1])for(const sz of [-1,1])
                sidewalkPositions.push({x:x+sx*24,z:z+sz*24});
        const sidewalk=new THREE.InstancedMesh(
            // Narrower N/S slabs keep the extra z=240 cross street open.
            new THREE.BoxGeometry(25,.27,15),concrete,
            sidewalkPositions.length);
        sidewalkPositions.forEach((p,i)=>{
            dummy.position.set(p.x,.138,p.z);dummy.rotation.set(0,0,0);
            dummy.scale.set(1,1,1);dummy.updateMatrix();
            sidewalk.setMatrixAt(i,dummy.matrix);
        });
        sidewalk.instanceMatrix.needsUpdate=true;
        sidewalk.name='r52-sidewalk-quarters';
        group.add(sidewalk);
        const palettes=[
            new THREE.MeshLambertMaterial({color:0x887469}),
            new THREE.MeshLambertMaterial({color:0x7d8081}),
            new THREE.MeshLambertMaterial({color:0x73776e})
        ];
        let lots=0;
        for(const z of this.Z)for(const x of this.X){
            for(const sx of [-1,1]){
                const bx=x+sx*24,bz=z+sx*24,height=11+(lots%4)*2.5;
                const mesh=new THREE.Mesh(
                    new THREE.BoxGeometry(11,height,12),
                    palettes[lots%palettes.length]);
                mesh.position.set(bx,height/2+.28,bz);
                mesh.name='r52-neighborhood-shop-'+lots;
                group.add(mesh);
                city.buildingBoxes.push({minX:bx-5.5,maxX:bx+5.5,
                    minZ:bz-6,maxZ:bz+6,chicagoR52Lot:true});
                lots++;
            }
        }
        const dash=[];
        for(const street of this.streets()){
            const len=Math.hypot(street.to.x-street.from.x,
                street.to.z-street.from.z);
            for(let d=13;d<len-8;d+=17){
                const t=d/len,x=street.from.x+
                    (street.to.x-street.from.x)*t,
                    z=street.from.z+(street.to.z-street.from.z)*t;
                if(report.nodes.some(n=>Math.hypot(n.x-x,n.z-z)<13) ||
                    (street.id==='goose-bridge'&&Math.abs(x+160)<18))
                    continue;
                dash.push({x,z,ry:street.axis==='x'?Math.PI/2:0});
            }
        }
        const lines=new THREE.InstancedMesh(
            new THREE.BoxGeometry(.2,.015,5),paint,dash.length);
        dash.forEach((d,i)=>{
            dummy.position.set(d.x,.104,d.z);dummy.rotation.set(0,d.ry,0);
            dummy.updateMatrix();lines.setMatrixAt(i,dummy.matrix);
        });
        lines.instanceMatrix.needsUpdate=true;
        lines.name='r52-centerlines';group.add(lines);
        const crossings=[];
        for(const node of report.nodes)
            for(const axis of ['x','z'])for(const sign of [-1,1])
                for(const offset of [-2.4,-.8,.8,2.4])
                    crossings.push({
                        x:node.x+(axis==='x'?sign*12.5:offset),
                        z:node.z+(axis==='z'?sign*12.5:offset),
                        ry:axis==='z'?Math.PI/2:0});
        const walks=new THREE.InstancedMesh(
            new THREE.BoxGeometry(.9,.015,3.1),zebra,crossings.length);
        crossings.forEach((p,i)=>{
            dummy.position.set(p.x,.107,p.z);dummy.rotation.set(0,p.ry,0);
            dummy.updateMatrix();walks.setMatrixAt(i,dummy.matrix);
        });
        walks.instanceMatrix.needsUpdate=true;
        walks.name='r52-zebra-crossings';group.add(walks);
        // Six roadside luminaires, two instanced draw calls and no dynamic
        // shadow/light source. Posts are off the 17m lanes, near each curb.
        const lamps=report.nodes.map(n=>({x:n.x+12,z:n.z+12}));
        const supports=new THREE.InstancedMesh(
            new THREE.CylinderGeometry(.12,.17,5.7,6),
            new THREE.MeshLambertMaterial({color:0x66747a}),lamps.length);
        const bulbs=new THREE.InstancedMesh(
            new THREE.BoxGeometry(.8,.3,.8),
            new THREE.MeshBasicMaterial({color:0xf2d7a5}),lamps.length);
        lamps.forEach((p,i)=>{
            dummy.position.set(p.x,2.85,p.z);
            dummy.rotation.set(0,0,0);dummy.updateMatrix();
            supports.setMatrixAt(i,dummy.matrix);
            dummy.position.set(p.x,5.76,p.z);dummy.updateMatrix();
            bulbs.setMatrixAt(i,dummy.matrix);
        });
        supports.instanceMatrix.needsUpdate=true;
        bulbs.instanceMatrix.needsUpdate=true;
        supports.name='r52-roadside-lamp-posts';
        bulbs.name='r52-roadside-lamp-glow';
        group.add(supports,bulbs);
        city.cityGroup.add(group);
        const radar=city.chicagoPS1StreetNetwork?.radarPaths;
        if(Array.isArray(radar))for(const st of this.streets()){
            const id='r52-'+st.id;
            if(!radar.some(p=>p.id===id))
                radar.push({id,points:[st.from,st.to],
                    width:this.WIDTH,provenance:'procedural-r52-bridge-road'});
        }
        const after=this.audit(city);
        Object.assign(report,{ready:after.ready,blocked:after.blocked,
            corridorsBuilt:this.streets().length,
            crossingsBuilt:report.nodes.length,buildingsBuilt:lots,
            sidewalksBuilt:sidewalkPositions.length,
            pedestrianStripes:crossings.length,
            laneMarkings:dash.length,lampCount:lamps.length,
            visualReady:true,group});
        city.chicagoGooseEastR52=report;
        return report;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoGooseEastR52;
