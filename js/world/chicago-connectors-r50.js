/**
 * Chicago R50 — North River secondary street network (procedural approximation).
 *
 * Six genuinely cleared blocks at (40,120,200) x (200,280); two E-W
 * corridors and three N-S corridors. Ten gateways tie them to existing
 * 80-unit roads. Streets, sidewalks, small lots and NPCs share coordinates.
 *
 * NOT a scale-accurate copy of the PS1 Chicago map.
 */
class DriverChicagoConnectorsR50 {
    static X=[40,120,200];
    static Z=[200,280];
    static WIDTH=17;
    static isCarvedBlock(x,z){
        return this.X.includes(x)&&this.Z.includes(z);
    }
    static nodes(){
        return this.Z.flatMap(z=>this.X.map(x=>({id:'block-'+x+'-'+z,x,z})));
    }
    static streets(){
        return [
            ...this.Z.map(z=>({id:'east-west-'+z,axis:'x',from:{x:0,z},to:{x:240,z}})),
            ...this.X.map(x=>({id:'north-south-'+x,axis:'z',from:{x,z:160},to:{x,z:320}}))
        ];
    }
    static topology(){
        const nodes=this.nodes();
        const edges=[];
        // Seven links between the six internal intersections.
        for(const z of this.Z)
            for(let i=0;i<this.X.length-1;i++)
                edges.push({id:'horizontal-'+this.X[i]+'-'+z,
                    from:{x:this.X[i],z},to:{x:this.X[i+1],z}});
        for(const x of this.X)
            edges.push({id:'vertical-'+x,
                from:{x,z:this.Z[0]},to:{x,z:this.Z[1]}});
        // Ten exits onto already traversable streets of the 80-unit grid.
        for(const z of this.Z)
            for(const x of [0,240])
                edges.push({id:'grid-eastwest-'+x+'-'+z,
                    from:{x:x===0?40:200,z},to:{x,z}});
        for(const x of this.X)
            for(const z of [160,320])
                edges.push({id:'grid-northsouth-'+x+'-'+z,
                    from:{x,z:z===160?200:280},to:{x,z}});
        return {nodes,edges,gridExits:10,internalEdges:7};
    }
    static laneClear(city,from,to){
        if(!city||!from||!to)return false;
        const dx=to.x-from.x,dz=to.z-from.z;
        const len=Math.hypot(dx,dz);
        if(len<1)return false;
        const nx=-dz/len,nz=dx/len,steps=Math.ceil(len/2.5);
        for(let i=0;i<=steps;i++){
            const t=i/steps,x=from.x+dx*t,z=from.z+dz*t;
            for(const offset of [-4,0,4]){
                const px=x+nx*offset,pz=z+nz*offset;
                if(city.isWaterAt?.(px,pz)||
                   city.isPointBlocked?.(px,pz,1.6,0))return false;
            }
        }
        return true;
    }
    static audit(city){
        if(city?.preset?.id!=='chicago')return null;
        const graph=this.topology();
        const blocked=graph.edges.filter(edge=>
            !this.laneClear(city,edge.from,edge.to)).map(edge=>edge.id);
        const protectedBlocks=graph.nodes.filter(node=>
            typeof DriverChicagoCityPlan!=='undefined' &&
            DriverChicagoCityPlan.isProtected(node.x,node.z))
            .map(node=>node.id);
        return {...graph,blocked,protectedBlocks,
            ready:blocked.length===0&&protectedBlocks.length===0,
            source:'procedural connecting streets, not PS1-certified',
            verifiedGeometry:false};
    }
    static rectangleLoop(left,right,bottom,top){
        const points=[
            {x:left,z:bottom-4},{x:right-4,z:bottom-4},
            {x:right+4,z:bottom+4},{x:right+4,z:top-4},
            {x:right-4,z:top+4},{x:left+4,z:top+4},
            {x:left-4,z:top-4},{x:left-4,z:bottom+4},
            {x:left,z:bottom-4}
        ];
        return {points,closed:0,width:this.WIDTH,
            originalPlacementCertified:false};
    }
    static loops(){
        return {
            'r50-outer':this.rectangleLoop(40,200,200,280),
            'r50-east':this.rectangleLoop(120,200,200,280),
            // These two circuits cross the existing main-grid streets
            // x=0/240 and z=-160, proving neighborhood-to-grid traffic.
            'r50-grid-west':this.rectangleLoop(0,120,160,280),
            'r50-grid-east':this.rectangleLoop(120,240,160,280)
        };
    }
    static build(city){
        if(city?.preset?.id!=='chicago')return null;
        if(city.chicagoConnectorsR50)return city.chicagoConnectorsR50;
        const report=this.audit(city);
        report.corridorsPlanned=this.streets().length;
        report.crossingsPlanned=this.nodes().length;
        report.visualReady=false;
        if(!report.ready){
            city.chicagoConnectorsR50=report;
            return report;
        }
        const group=new THREE.Group();
        group.name='chicago-r50-south-loop-street-grid';
        group.userData.proceduralApproximation=true;
        group.userData.originalPS1PlacementCertified=false;
        const roadMaterial=new THREE.MeshLambertMaterial({color:0x3b4146});
        const curbMaterial=new THREE.MeshLambertMaterial({color:0x8b9292});
        const paintMaterial=new THREE.MeshBasicMaterial({color:0xc7b982});
        const zebraMaterial=new THREE.MeshBasicMaterial({color:0xd5d4c8});
        for(const street of this.streets()){
            const dx=street.to.x-street.from.x,dz=street.to.z-street.from.z;
            const length=Math.hypot(dx,dz);
            const mesh=new THREE.Mesh(
                new THREE.BoxGeometry(
                    street.axis==='x'?length:this.WIDTH,.08,
                    street.axis==='z'?length:this.WIDTH),roadMaterial);
            mesh.position.set(
                (street.from.x+street.to.x)/2,.052,
                (street.from.z+street.to.z)/2);
            mesh.name='r50-asphalt-'+street.id;
            group.add(mesh);
        }
        // Raised pedestrian corners replace each fully-cleared 80x80 lot.
        // Roads occupy the central 17-unit cross, with visible pavements.
        const corners=new THREE.InstancedMesh(
            new THREE.BoxGeometry(24,.28,24),curbMaterial,24);
        const dummy=new THREE.Object3D();
        let cornerIndex=0;
        for(const node of report.nodes){
            for(const sx of [-1,1])for(const sz of [-1,1]){
                dummy.position.set(node.x+sx*23,.14,node.z+sz*23);
                dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);
                dummy.updateMatrix();
                corners.setMatrixAt(cornerIndex++,dummy.matrix);
            }
        }
        corners.instanceMatrix.needsUpdate=true;
        corners.name='r50-sidewalk-quarters';
        group.add(corners);
        // Reused building materials, two narrow buildings per cleared lot.
        const wallMaterials=[
            new THREE.MeshLambertMaterial({color:0x756a63}),
            new THREE.MeshLambertMaterial({color:0x767c80}),
            new THREE.MeshLambertMaterial({color:0x8b7666})
        ];
        let lots=0;
        for(const node of report.nodes){
            for(const side of [-1,1]){
                const x=node.x+side*23,z=node.z-side*23;
                const height=10+(lots%4)*2;
                const mesh=new THREE.Mesh(new THREE.BoxGeometry(12,height,12),
                    wallMaterials[lots%wallMaterials.length]);
                mesh.position.set(x,height/2+.28,z);
                mesh.name='r50-local-building-'+lots;
                group.add(mesh);
                city.buildingBoxes.push({
                    minX:x-6,maxX:x+6,minZ:z-6,maxZ:z+6,
                    chicagoR50Lot:true
                });
                lots++;
            }
        }
        // Instanced paint: dozens of stripes but just two draw calls.
        const stripes=[];
        for(const street of this.streets()){
            const axis=street.axis;
            const length=Math.hypot(street.to.x-street.from.x,
                street.to.z-street.from.z);
            for(let d=11;d<length-9;d+=17){
                const t=d/length;
                const x=street.from.x+(street.to.x-street.from.x)*t;
                const z=street.from.z+(street.to.z-street.from.z)*t;
                // Leave junction centers free of dashed lane paint.
                if(report.nodes.some(n=>Math.hypot(n.x-x,n.z-z)<14))continue;
                stripes.push({x,z,rotation:axis==='z'?0:Math.PI/2});
            }
        }
        const lines=new THREE.InstancedMesh(
            new THREE.BoxGeometry(.22,.014,5.5),paintMaterial,stripes.length);
        stripes.forEach((stripe,i)=>{
            dummy.position.set(stripe.x,.104,stripe.z);
            dummy.rotation.set(0,stripe.rotation,0);dummy.updateMatrix();
            lines.setMatrixAt(i,dummy.matrix);
        });
        lines.instanceMatrix.needsUpdate=true;
        lines.name='r50-center-lane-markings';group.add(lines);
        const walks=[];
        for(const node of report.nodes){
            for(const axis of ['x','z'])for(const sign of [-1,1]){
                for(const offset of [-2.4,-.8,.8,2.4]){
                    const x=node.x+(axis==='x'?sign*12.5:offset);
                    const z=node.z+(axis==='z'?sign*12.5:offset);
                    walks.push({x,z,rotation:axis==='z'?Math.PI/2:0});
                }
            }
        }
        const crossings=new THREE.InstancedMesh(
            new THREE.BoxGeometry(.9,.012,3.1),zebraMaterial,walks.length);
        walks.forEach((walk,i)=>{
            dummy.position.set(walk.x,.105,walk.z);
            dummy.rotation.set(0,walk.rotation,0);dummy.updateMatrix();
            crossings.setMatrixAt(i,dummy.matrix);
        });
        crossings.instanceMatrix.needsUpdate=true;
        crossings.name='r50-zebra-crosswalks';group.add(crossings);
        city.cityGroup.add(group);
        // Mostrar os cinco corredores também no minimapa do Undercover e
        // do Take a Ride, sem confundi-los com trechos extraídos do PS1.
        const radar=city.chicagoPS1StreetNetwork?.radarPaths;
        if(Array.isArray(radar)){
            for(const street of this.streets()){
                const id='r50-'+street.id;
                if(!radar.some(item=>item.id===id))
                    radar.push({id,points:[street.from,street.to],
                        width:this.WIDTH,
                        provenance:'procedural-r50-local-grid'});
            }
        }
        const after=this.audit(city);
        Object.assign(report,{
            ready:after.ready,blocked:after.blocked,
            loops:after.ready?this.loops():{},
            corridorsBuilt:5,crossingsBuilt:6,
            buildingsBuilt:lots,sidewalkQuarters:cornerIndex,
            laneMarkings:stripes.length,crosswalkStripes:walks.length,
            visualReady:true,group
        });
        city.chicagoConnectorsR50=report;
        return report;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoConnectorsR50;
