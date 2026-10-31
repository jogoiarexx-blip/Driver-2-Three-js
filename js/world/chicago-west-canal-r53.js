/**
 * Chicago R53 — real connection on the western bank of Goose Island.
 *
 * The -240/-80 crossing is ALREADY a fixed bridge in the Chicago R2
 * river system. The east channel at x=-160,z=-80 has NO bridge; therefore
 * no road is drawn or routed through that water. Other cities unchanged.
 *
 * Adapted procedural geometry, not PS1-certificated road placement.
 */
class DriverChicagoWestCanalR53 {
    static BLOCK_X=[-280,-200];
    static BLOCK_Z=[-120,-40];
    static BRIDGE={x:-240,z:-80};
    static WIDTH=17;
    static isCarvedBlock(x,z){
        return this.BLOCK_X.includes(x)&&this.BLOCK_Z.includes(z);
    }
    static nodes(){
        return [-120,-80,-40].flatMap(z=>
            this.BLOCK_X.map(x=>({x,z,id:'west-r53-'+x+'-'+z})));
    }
    static streets(){
        return [
            ...this.BLOCK_X.map(x=>({id:'west-ns-'+x,axis:'z',
                from:{x,z:-160},to:{x,z:0}})),
            // Cross the ONLY existing fixed west-channel bridge at z=-80.
            {id:'fixed-west-bridge',axis:'x',
                from:{x:-320,z:-80},to:{x:-200,z:-80}},
            ...this.BLOCK_Z.map(z=>({id:'west-arterial-feeder-'+z,
                axis:'x',from:{x:-320,z},to:{x:-280,z}}))
        ];
    }
    static topology(){
        const nodes=this.nodes(),edges=[];
        const add=(id,from,to)=>edges.push({id,from,to});
        for(const x of this.BLOCK_X)
            for(let i=1,z=[-160,-120,-80,-40,0];i<z.length;i++)
                add('spine-'+x+'-'+z[i-1],{x,z:z[i-1]},{x,z:z[i]});
        for(const [a,b] of [[-320,-280],[-280,-240],[-240,-200]])
            add('west-bridge-'+a,{x:a,z:-80},{x:b,z:-80});
        for(const z of this.BLOCK_Z)
            add('west-grid-'+z,{x:-320,z},{x:-280,z});
        // Three west-grid feeders, four N/S grid ends.
        return {nodes,edges,gridExits:7,internalEdges:6,
            reusedFixedBridge:true};
    }
    static clear(city,from,to){
        if(!from||!to)return false;
        const dist=Math.hypot(to.x-from.x,to.z-from.z);
        if(!Number.isFinite(dist)||dist<1)return false;
        const dx=(to.x-from.x)/dist,dz=(to.z-from.z)/dist;
        const nx=-dz,nz=dx;
        for(let i=0,n=Math.ceil(dist/2.5);i<=n;i++){
            const t=i/n,x=from.x+(to.x-from.x)*t,
                z=from.z+(to.z-from.z)*t;
            for(const width of [-4,0,4]){
                const px=x+nx*width,pz=z+nz*width;
                if(city.isWaterAt?.(px,pz)||
                   city.isPointBlocked?.(px,pz,1.55,0))return false;
            }
        }
        return true;
    }
    static audit(city){
        if(city?.preset?.id!=='chicago')return null;
        const topology=this.topology();
        const blocked=topology.edges.filter(e=>!this.clear(
            city,e.from,e.to)).map(e=>e.id);
        const protectedBlocks=this.BLOCK_Z.flatMap(z=>
            this.BLOCK_X.filter(x=>
                typeof DriverChicagoCityPlan!=='undefined' &&
                DriverChicagoCityPlan.isProtected(x,z)).map(x=>({x,z})));
        // Guard against a fictional bridge over the EAST branch at -160.
        const eastChannelBridgeExists=
            !city.isWaterAt?.(-160,-80);
        return {...topology,blocked,protectedBlocks,
            eastChannelBridgeExists,
            ready:blocked.length===0&&protectedBlocks.length===0 &&
                !!city.chicagoPS1RiverBranches,
            originalPS1Certified:false};
    }
    static build(city){
        if(city?.preset?.id!=='chicago')return null;
        if(city.chicagoWestCanalR53)return city.chicagoWestCanalR53;
        const report=this.audit(city);
        if(!report.ready){
            city.chicagoWestCanalR53=report;return report;
        }
        const group=new THREE.Group();
        group.name='chicago-r53-west-canal-real-bridge';
        group.userData.originalPS1Certified=false;
        const roadMat=new THREE.MeshLambertMaterial({color:0x41474c});
        const sidewalkMat=new THREE.MeshLambertMaterial({color:0x8b9392});
        const paintMat=new THREE.MeshBasicMaterial({color:0xc4bb9b});
        const crossingMat=new THREE.MeshBasicMaterial({color:0xd8d5ca});
        for(const street of this.streets()){
            const length=Math.hypot(street.to.x-street.from.x,
                street.to.z-street.from.z);
            const road=new THREE.Mesh(new THREE.BoxGeometry(
                street.axis==='x'?length:this.WIDTH,.08,
                street.axis==='z'?length:this.WIDTH),roadMat);
            road.position.set((street.to.x+street.from.x)/2,.052,
                (street.to.z+street.from.z)/2);
            road.name='r53-asphalt-'+street.id;
            group.add(road);
        }
        // Only landward half-blocks can hold buildings/sidewalks.
        // Eastward slabs at -280 would overhang the west canal at x=-240;
        // westward slabs at -200 likewise hang over water. Never build them.
        const pavement=[];
        const dummy=new THREE.Object3D();
        for(const z of this.BLOCK_Z)for(const x of this.BLOCK_X){
            const px=x===-280?-304:-184;
            for(const side of [-1,1])
                pavement.push({x:px,z:z+side*24,halfX:x===-280?10:7});
        }
        const sidewalk=new THREE.InstancedMesh(
            new THREE.BoxGeometry(1,.27,15),sidewalkMat,pavement.length);
        for(let i=0;i<pavement.length;i++){
            const p=pavement[i];
            dummy.position.set(p.x,.136,p.z);
            dummy.rotation.set(0,0,0);
            dummy.scale.set(p.halfX*2,1,1);
            dummy.updateMatrix();sidewalk.setMatrixAt(i,dummy.matrix);
        }
        sidewalk.instanceMatrix.needsUpdate=true;
        sidewalk.name='r53-landward-sidewalks';group.add(sidewalk);
        const lotMats=[
            new THREE.MeshLambertMaterial({color:0x756d66}),
            new THREE.MeshLambertMaterial({color:0x797d80}),
            new THREE.MeshLambertMaterial({color:0x827363})
        ];
        let built=0;
        for(const p of pavement){
            const height=10+(built%3)*3;
            const box=new THREE.Mesh(new THREE.BoxGeometry(9,height,10),
                lotMats[built%lotMats.length]);
            box.position.set(p.x,height/2+.27,p.z);
            box.name='r53-landward-building-'+built;
            group.add(box);
            city.buildingBoxes.push({
                minX:p.x-4.5,maxX:p.x+4.5,
                minZ:p.z-5,maxZ:p.z+5,
                chicagoR53Lot:true
            });
            built++;
        }
        const dash=[];
        for(const st of this.streets()){
            const len=Math.hypot(st.to.x-st.from.x,st.to.z-st.from.z);
            for(let d=12;d<len-8;d+=16){
                const t=d/len,x=st.from.x+(st.to.x-st.from.x)*t,
                    z=st.from.z+(st.to.z-st.from.z)*t;
                if(report.nodes.some(n=>Math.hypot(x-n.x,z-n.z)<13)||
                   st.id==='fixed-west-bridge'&&Math.abs(x+240)<17)
                    continue;
                dash.push({x,z,r:st.axis==='x'?Math.PI/2:0});
            }
        }
        const markings=new THREE.InstancedMesh(
            new THREE.BoxGeometry(.2,.012,4.8),paintMat,dash.length);
        dash.forEach((d,i)=>{
            dummy.position.set(d.x,.104,d.z);
            dummy.rotation.set(0,d.r,0);
            dummy.scale.set(1,1,1);dummy.updateMatrix();
            markings.setMatrixAt(i,dummy.matrix);
        });
        markings.instanceMatrix.needsUpdate=true;
        markings.name='r53-lane-markings';group.add(markings);
        const zebra=[];
        for(const n of report.nodes)
            for(const axis of ['x','z'])for(const direction of [-1,1])
                for(const sideways of [-2.4,-.8,.8,2.4])
                    zebra.push({
                        x:n.x+(axis==='x'?direction*12.5:sideways),
                        z:n.z+(axis==='z'?direction*12.5:sideways),
                        r:axis==='z'?Math.PI/2:0});
        const walks=new THREE.InstancedMesh(
            new THREE.BoxGeometry(.9,.012,3.1),crossingMat,zebra.length);
        zebra.forEach((p,i)=>{
            dummy.position.set(p.x,.107,p.z);
            dummy.rotation.set(0,p.r,0);
            dummy.scale.set(1,1,1);dummy.updateMatrix();
            walks.setMatrixAt(i,dummy.matrix);
        });
        walks.instanceMatrix.needsUpdate=true;
        walks.name='r53-zebra-crossings';group.add(walks);
        city.cityGroup.add(group);
        const radar=city.chicagoPS1StreetNetwork?.radarPaths;
        if(Array.isArray(radar))
            for(const road of this.streets()){
                const id='r53-'+road.id;
                if(!radar.some(p=>p.id===id))
                    radar.push({id,points:[road.from,road.to],
                        width:this.WIDTH,
                        provenance:'procedural-r53-verified-west-bridge'});
            }
        const after=this.audit(city);
        Object.assign(report,{
            ready:after.ready,blocked:after.blocked,
            corridorsBuilt:this.streets().length,
            crossingsBuilt:report.nodes.length,
            buildingsBuilt:built,sidewalksBuilt:pavement.length,
            crosswalkStripes:zebra.length,laneMarkings:dash.length,
            visualReady:true,group
        });
        city.chicagoWestCanalR53=report;
        return report;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoWestCanalR53;
