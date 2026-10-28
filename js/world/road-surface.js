/**
 * Driver 2-inspired streets: localized asphalt, painted lane markings,
 * readable intersections and low-poly curbs. All pieces are render-only.
 * Existing grid, bridge, traffic AI, missions and sidewalks are unchanged.
 */
class DriverRoadSurface {
    static STEP=80;
    static ROAD_HALF=12;
    static palette(id){
        return ({
            chicago:{sidewalk:0x777a7c,curb:0xb2b0a6,
                yellow:0xc6ad68,white:0xc8c9c3},
            havana:{sidewalk:0xae967c,curb:0xd1bfa7,
                yellow:0xcab078,white:0xe0d0b0},
            vegas:{sidewalk:0x8d8581,curb:0xc2b0a0,
                yellow:0xc5a768,white:0xcac8c0},
            rio:{sidewalk:0x9d9d96,curb:0xd4c8ae,
                yellow:0xd2b87b,white:0xe0ddd0}
        })[id]||this.palette('chicago');
    }

    static laneClear(x,z){
        // Marks never cross the 24m intersection box, and painted
        // lines stop before river/canal (z=34..66).
        const dx=Math.abs(x-Math.round(x/80)*80);
        const dz=Math.abs(z-Math.round(z/80)*80);
        return (dx>18 || dz>18)&&!(z>31&&z<69);
    }

    static buildAsphalt(city){
        const tiles=[],add=(x,z,w,d,angle=0)=>
            tiles.push({x,y:.020,z,w,d,angle});
        const axes=[];
        for(let n=-320;n<=320;n+=80)axes.push(n);
        // Intersections are ONE square. Road segments end at its edges;
        // no overlapping planes or floating line decals in crossings.
        for(const x of axes)for(const z of axes)
            add(x,z,24,24);
        for(const axis of axes){
            // Two outer stretches reaching the existing city boundary.
            for(const [a,b] of [[-420,-332],[332,420]]){
                const m=(a+b)/2,len=b-a;
                add(axis,m,24,len);
                add(m,axis,24,len,Math.PI/2);
            }
            for(let n=-320;n<320;n+=80){
                const mid=n+40;
                add(axis,mid,24,56);
                add(mid,axis,24,56,Math.PI/2);
            }
        }
        const geometry=new THREE.PlaneGeometry(1,1);
        geometry.rotateX(-Math.PI/2);
        const texture=PS1TextureFactory.createRoadTexture(city.preset.id);
        const material=new THREE.MeshLambertMaterial({
            map:texture,side:THREE.DoubleSide,
            polygonOffset:true,polygonOffsetFactor:-1
        });
        const mesh=new THREE.InstancedMesh(geometry,material,tiles.length);
        const dummy=new THREE.Object3D();
        tiles.forEach((p,i)=>{
            dummy.position.set(p.x,p.y,p.z);
            dummy.rotation.set(0,p.angle,0);
            dummy.scale.set(p.w,1,p.d);
            dummy.updateMatrix();
            mesh.setMatrixAt(i,dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate=true;
        mesh.frustumCulled=false; // one giant merged city-wide batch
        mesh.castShadow=false;
        mesh.receiveShadow=false;
        mesh.name='driver2-road-asphalt-'+city.preset.id;
        city.cityGroup.add(mesh);
        city.roadSurfaceStats={regions:tiles.length,intersectionCount:81,
            paintedInsideIntersections:0,collidersAdded:0,materials:1};
        return mesh;
    }

    static buildMarkings(city){
        const scheme=this.palette(city.preset.id);
        const yellow=[],white=[];
        const add=(target,x,z,w,d,angle=0,y=.067)=>
            target.push({x,z,w,d,angle,y});
        for(let road=-320;road<=320;road+=80){
            for(let along=-409;along<=409;along+=11){
                // Dashes only between junctions (no yellow bars across
                // intersections or the water).
                if(!this.laneClear(road,along))continue;
                const centerLen=4.35;
                for(const offset of [-.23,.23])
                    add(yellow,road+offset,along,.13,centerLen);
                if(this.laneClear(along,road)){
                    for(const offset of [-.23,.23])
                        add(yellow,along,road+offset,.13,
                            centerLen,Math.PI/2);
                }
                // Worn white roadside paint, separated from curb.
                if(Math.floor(along/11)%3!==0){
                    for(const side of [-1,1]){
                        add(white,road+side*10.85,along,.13,3.6);
                        if(this.laneClear(along,road))
                            add(white,along,road+side*10.85,
                                .13,3.6,Math.PI/2);
                    }
                }
            }
            // Stop lines sit BEFORE crossings, never on the junction.
            for(let cross=-320;cross<=320;cross+=80){
                for(const sign of [-1,1]){
                    const z=cross+sign*20.8;
                    if(!(z>31&&z<69))
                        add(white,road,z,21.3,.30,0,.071);
                    const x=cross+sign*20.8;
                    // The same strip across the perpendicular roadway.
                    if(!(road>31&&road<69))
                        add(white,x,road,.30,21.3,0,.071);
                }
            }
        }
        const batches=[];
        const materialColor=[
            new THREE.MeshBasicMaterial({color:scheme.yellow,
                side:THREE.DoubleSide,depthWrite:false,
                polygonOffset:true,polygonOffsetFactor:-2}),
            new THREE.MeshBasicMaterial({color:scheme.white,
                side:THREE.DoubleSide,depthWrite:false,
                polygonOffset:true,polygonOffsetFactor:-2})
        ];
        const geometry=new THREE.PlaneGeometry(1,1);
        geometry.rotateX(-Math.PI/2);
        for(const [index,items] of [yellow,white].entries()){
            const mesh=new THREE.InstancedMesh(
                geometry,materialColor[index],items.length);
            const dummy=new THREE.Object3D();
            items.forEach((p,i)=>{
                dummy.position.set(p.x,p.y,p.z);
                dummy.rotation.set(0,p.angle,0);
                dummy.scale.set(p.w,1,p.d);
                dummy.updateMatrix();
                mesh.setMatrixAt(i,dummy.matrix);
            });
            mesh.instanceMatrix.needsUpdate=true;
            mesh.frustumCulled=false;
            mesh.castShadow=false;
            mesh.name=index?'driver2-road-white':'driver2-road-yellow';
            city.cityGroup.add(mesh);
            batches.push(mesh);
        }
        if(city.roadSurfaceStats)Object.assign(city.roadSurfaceStats,
            {yellowMarks:yellow.length,whiteMarks:white.length});
        return batches;
    }

    static buildCurbs(city,blocks){
        if(!blocks?.length)return null;
        const shade=this.palette(city.preset.id);
        const pieces=[];
        for(const {x,z} of blocks){
            // Existing slab is 50x.35x50, top y=.35. The thin lip
            // has no collider and does not obstruct park, garage,
            // mission triggers or Tanner on foot.
            for(const s of [-1,1]){
                pieces.push({x:x+s*24.89,y:.19,z,
                    w:.22,h:.38,d:49.8});
                pieces.push({x,y:.19,z:z+s*24.89,
                    w:49.8,h:.38,d:.22});
            }
        }
        const geometry=new THREE.BoxGeometry(1,1,1);
        const material=new THREE.MeshLambertMaterial({color:shade.curb});
        const mesh=new THREE.InstancedMesh(geometry,material,pieces.length);
        const dummy=new THREE.Object3D();
        pieces.forEach((piece,i)=>{
            dummy.position.set(piece.x,piece.y,piece.z);
            dummy.rotation.set(0,0,0);
            dummy.scale.set(piece.w,piece.h,piece.d);
            dummy.updateMatrix();
            mesh.setMatrixAt(i,dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate=true;
        mesh.frustumCulled=false;
        mesh.castShadow=false;
        mesh.name='driver2-stone-curbs-'+city.preset.id;
        city.cityGroup.add(mesh);
        return mesh;
    }
}
