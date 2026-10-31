/**
 * Chicago Night Lights R3: night-time windows, storefronts, and street lamps.
 * One shared set of materials per city, one or two instanced window batches
 * per near-LOD chunk, and two instanced street halo/pool batches for all poles.
 * No PointLight per lamp, no new collider/road geometry or network assets.
 */
class DriverChicagoNightLights {
    static smooth(a,b,v) {
        const t=Math.max(0,Math.min(1,(v-a)/(b-a)));
        return t*t*(3-2*t);
    }
    static hash(x,z,n=0) {
        let a=Math.imul(Math.round(x*7),73856093)^
            Math.imul(Math.round(z*5),19349663)^
            Math.imul(n+1,83492791);
        a=Math.imul(a^(a>>>16),2246822519);
        return ((a^(a>>>13))>>>0)/4294967296;
    }
    static state(city) {
        if(!city.chicagoNightState)
            city.chicagoNightState={
                level:0,quantized:-1,materials:null,windowMeshes:[],
                streetHalos:null,streetPools:null,streetBulb:null,
                windows:0,shops:0
            };
        return city.chicagoNightState;
    }
    static materials(city) {
        const state=this.state(city);
        if(state.materials)return state.materials;
        // LOD criado à noite deve começar iluminado imediatamente.
        const level=Math.round(state.level*32)/32;
        state.materials=[
            new THREE.MeshBasicMaterial({
                color:0xffc781,transparent:true,opacity:.72*level,
                depthWrite:false,side:THREE.DoubleSide
            }),
            new THREE.MeshBasicMaterial({
                color:0xb8d6f2,transparent:true,opacity:.47*level,
                depthWrite:false,side:THREE.DoubleSide
            })
        ];
        state.materials.forEach(m=>{
            m.userData={chicagoNightWindow:true};
        });
        return state.materials;
    }
    static makeHaloTexture(){
        const canvas=document.createElement('canvas');
        canvas.width=canvas.height=64;
        const ctx=canvas.getContext('2d');
        const g=ctx.createRadialGradient(32,32,0,32,32,31);
        g.addColorStop(0,'rgba(255,247,206,.94)');
        g.addColorStop(.18,'rgba(255,210,129,.54)');
        g.addColorStop(.44,'rgba(255,188,94,.20)');
        g.addColorStop(1,'rgba(255,175,86,0)');
        ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
        const texture=new THREE.CanvasTexture(canvas);
        texture.name='driver2-chicago-night-halo';
        return texture;
    }
    static installStreets(city){
        if(city?.preset?.id!=='chicago'||!Array.isArray(city.streetLampPositions))return null;
        const state=this.state(city);
        if(state.streetHalos)return state;
        const spots=city.streetLampPositions;
        const texture=this.makeHaloTexture();
        const lightPositions=new Float32Array(spots.length*3);
        for(let i=0;i<spots.length;i++){
            const [x,z]=spots[i];
            lightPositions[i*3]=x;
            lightPositions[i*3+1]=5.85;
            lightPositions[i*3+2]=z;
        }
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position',new THREE.BufferAttribute(lightPositions,3));
        const halo=new THREE.Points(geo,new THREE.PointsMaterial({
            color:0xffe7b0,map:texture,transparent:true,opacity:0,
            size:11,sizeAttenuation:true,depthWrite:false,depthTest:true,
            blending:THREE.AdditiveBlending
        }));
        halo.frustumCulled=false;
        halo.visible=false;
        halo.name='chicago-r3-streetlight-halos';
        halo.userData.visualOnly=true;
        city.cityGroup.add(halo);

        const poolMaterial=new THREE.MeshBasicMaterial({
            map:texture,color:0xffd49a,transparent:true,opacity:0,
            depthWrite:false,depthTest:true,side:THREE.DoubleSide,
            blending:THREE.AdditiveBlending,polygonOffset:true,
            polygonOffsetFactor:-2
        });
        const plane=new THREE.PlaneGeometry(1,1);
        plane.rotateX(-Math.PI/2);
        const pools=new THREE.InstancedMesh(plane,poolMaterial,spots.length);
        const dummy=new THREE.Object3D();
        spots.forEach(([x,z],i)=>{
            dummy.position.set(x,.105,z);
            dummy.rotation.set(0,0,0);
            dummy.scale.set(10,1,10);
            dummy.updateMatrix();
            pools.setMatrixAt(i,dummy.matrix);
        });
        pools.instanceMatrix.needsUpdate=true;
        pools.frustumCulled=false;
        pools.castShadow=false;
        pools.visible=false;
        pools.name='chicago-r3-streetlight-pools';
        pools.userData.visualOnly=true;
        city.cityGroup.add(pools);

        state.streetHalos=halo;
        state.streetPools=pools;
        state.streetBulb=city.streetLampBulb||null;
        // Evita halo solto depois de o jogador destruir um poste.
        if(Array.isArray(city.destructibleProps))for(const prop of city.destructibleProps){
            if(prop.type!=='pole')continue;
            prop.nightHalo=halo;
            prop.nightPool=pools;
        }
        this.update(city,state.level,true);
        return state;
    }
    static hidePole(prop){
        if(!prop||!Number.isInteger(prop.instanceIndex))return;
        const i=prop.instanceIndex;
        if(prop.nightHalo){
            const attr=prop.nightHalo.geometry.attributes.position;
            if(i<attr.count){
                attr.setXYZ(i,0,-1000,0);
                attr.needsUpdate=true;
            }
        }
        if(prop.nightPool){
            const dummy=new THREE.Object3D();
            dummy.position.set(0,-1000,0);
            dummy.scale.set(0,0,0);
            dummy.updateMatrix();
            prop.nightPool.setMatrixAt(i,dummy.matrix);
            prop.nightPool.instanceMatrix.needsUpdate=true;
        }
    }
    static decorateWindows(city,buildings,parent){
        if(city?.preset?.id!=='chicago'||!Array.isArray(buildings)||!parent)
            return {windows:0,batches:0};
        const state=this.state(city);
        const groups=[[],[]];
        for(const b of buildings){
            if(!b.planned||!['residential','commercial','apartment','tower'].includes(b.kind))
                continue;
            const {x,z,width:w,depth:d,height:h}=b;
            const base=b.baseY??.35;
            if(![x,z,w,d,h,base].every(Number.isFinite)||
                w<5||d<5||h<9)continue;
            // Mesmo grid e dimensões do parcelamento visual R21.
            const floors=Math.min(18,Math.max(1,Math.floor((h-5)/3.3)));
            const columns=Math.min(6,Math.max(1,Math.floor((w-1.6)/3)));
            const rowHeight=Math.min(3.3,(h-5.1)/Math.max(1,floors));
            const span=(w-1.7)/columns;
            const sizeX=Math.max(.85,Math.min(1.7,span*.60));
            const winH=Math.min(1.75,rowHeight*.6);
            const rowStep=Math.max(1,Math.ceil(floors/7));
            for(let floor=0;floor<floors;floor+=rowStep){
                const y=base+4.25+floor*rowHeight;
                if(y+winH/2>base+h-.65)continue;
                for(let col=0;col<columns;col++){
                    const chance=this.hash(x+col,z+floor,61);
                    // Somente alguns apartamentos iluminados; padrão estável.
                    if(chance<.63)continue;
                    const kind=chance>.91?1:0;
                    const wx=x-w/2+.85+span*(col+.5);
                    const side=this.hash(x,z,103+col+floor)>.5?1:-1;
                    groups[kind].push({
                        x:wx,y,z:z+side*(d/2+.19),
                        w:sizeX*.90,h:winH*.90
                    });
                }
            }
        }
        const mats=this.materials(city);
        const geometry=new THREE.PlaneGeometry(1,1);
        let count=0,batches=0;
        const dummy=new THREE.Object3D();
        groups.forEach((items,i)=>{
            if(!items.length)return;
            const mesh=new THREE.InstancedMesh(geometry,mats[i],items.length);
            items.forEach((p,index)=>{
                dummy.position.set(p.x,p.y,p.z);
                dummy.rotation.set(0,0,0);
                dummy.scale.set(p.w,p.h,1);
                dummy.updateMatrix();
                mesh.setMatrixAt(index,dummy.matrix);
            });
            mesh.instanceMatrix.needsUpdate=true;
            mesh.frustumCulled=false;
            mesh.visible=state.level>.025;
            mesh.castShadow=false;mesh.receiveShadow=false;
            mesh.name='chicago-r3-night-windows-'+i;
            mesh.userData.visualOnly=true;
            parent.add(mesh);
            state.windowMeshes.push(mesh);
            count+=items.length;batches++;
        });
        if(!batches)geometry.dispose();
        state.windows+=count;
        return {windows:count,batches};
    }
    static update(city,level,force=false){
        if(city?.preset?.id!=='chicago')return;
        const state=this.state(city);
        const target=Math.max(0,Math.min(1,Number(level)||0));
        const quantized=Math.round(target*32);
        if(!force&&state.quantized===quantized)return;
        state.quantized=quantized;
        state.level=target;
        const intensity=quantized/32;
        if(state.materials){
            state.materials[0].opacity=.72*intensity;
            state.materials[1].opacity=.47*intensity;
        }
        for(const mesh of state.windowMeshes)
            mesh.visible=quantized>0;
        const halos=state.streetHalos;
        const pools=state.streetPools;
        if(halos){
            halos.visible=quantized>0;
            halos.material.opacity=.67*intensity;
        }
        if(pools){
            pools.visible=quantized>0;
            pools.material.opacity=.24*intensity;
        }
        if(state.streetBulb){
            state.streetBulb.material.color.setHex(
                quantized>0?0xffe0a0:0x6c7278);
        }
        // Letreiros urbanos existentes: emissividade sem luz adicional.
        if(city.districtMaterialCache)for(const [key,material] of city.districtMaterialCache){
            if(typeof key==='string'&&key.startsWith('chicago-r2-shop-')&&material.emissive){
                material.emissive.setHex(0x8b643f);
                material.emissiveIntensity=.56*intensity;
            }
        }
        state.shops=4;
    }
}
