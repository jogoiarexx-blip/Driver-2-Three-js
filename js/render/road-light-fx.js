/**
 * Chicago R4 — faróis desenhados no pavimento e reflexos leves de chuva.
 * Não cria SpotLight/PointLight, não altera geometria, física ou colisões.
 * Três lotes fixos: fachos, reflexos e brilho (máximo 7 veículos próximos).
 */
class DriverRoadLightFX {
    static MAX_VEHICLES=7;
    static RADIUS=110;
    static smooth(a,b,x){
        const t=Math.max(0,Math.min(1,(x-a)/(b-a)));
        return t*t*(3-2*t);
    }
    constructor(game){
        this.game=game;
        this.elapsed=0;
        this.lastWet=false;
        this.lastLevel=0;
        this.selected=[];
        const lightMap=this.makeTexture(false);
        const wetMap=this.makeTexture(true);
        this.lightMaterial=new THREE.MeshBasicMaterial({
            map:lightMap,color:0xffedbb,transparent:true,
            opacity:0,depthWrite:false,depthTest:true,
            side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,
            blending:THREE.AdditiveBlending
        });
        this.wetMaterial=new THREE.MeshBasicMaterial({
            map:wetMap,color:0xe6dcab,transparent:true,
            opacity:0,depthWrite:false,depthTest:true,
            side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,
            blending:THREE.AdditiveBlending
        });
        this.glowMaterial=new THREE.MeshBasicMaterial({
            map:wetMap,color:0xffe9b3,transparent:true,opacity:0,
            depthWrite:false,depthTest:true,side:THREE.DoubleSide,
            blending:THREE.AdditiveBlending
        });
        // O WebP é opcional: o gradiente permanece se houver erro de rede.
        if(typeof THREE.TextureLoader==='function'){
            new THREE.TextureLoader().load('./assets/effects/headlight-beam.webp',
                texture=>{
                    texture.encoding=THREE.sRGBEncoding;
                    const fallback=this.lightMaterial.map;
                    this.lightMaterial.map=texture;
                    this.lightMaterial.needsUpdate=true;
                    fallback.dispose();
                },undefined,()=>{});
        }
        const makeMesh=(mat,name,ground=true)=>{
            const geo=new THREE.PlaneGeometry(1,1);
            if(ground)geo.rotateX(-Math.PI/2);
            const mesh=new THREE.InstancedMesh(
                geo,mat,DriverRoadLightFX.MAX_VEHICLES*2
            );
            mesh.frustumCulled=false;
            mesh.castShadow=false;mesh.receiveShadow=false;
            mesh.visible=false;
            mesh.name=name;
            mesh.userData.visualOnly=true;
            game.scene.add(mesh);
            return mesh;
        };
        this.beams=makeMesh(this.lightMaterial,'chicago-r4-ground-headlights');
        this.reflections=makeMesh(this.wetMaterial,'chicago-r4-wet-road-reflections');
        this.glows=makeMesh(this.glowMaterial,'driver2-headlight-glows',false);
        this.dummy=new THREE.Object3D();
        this.hideUnused(this.beams,0);
        this.hideUnused(this.reflections,0);
        this.hideUnused(this.glows,0);
    }
    makeTexture(wet){
        const canvas=document.createElement('canvas');
        canvas.width=128;canvas.height=256;
        const ctx=canvas.getContext('2d');
        // Elipse suave, sem hard edge ou feixe branco quadrado.
        const gradient=ctx.createRadialGradient(64,67,3,64,67,64);
        if(wet){
            gradient.addColorStop(0,'rgba(230,236,244,.74)');
            gradient.addColorStop(.20,'rgba(234,218,166,.41)');
            gradient.addColorStop(.50,'rgba(215,198,148,.12)');
        }else{
            gradient.addColorStop(0,'rgba(255,246,210,.85)');
            gradient.addColorStop(.20,'rgba(255,236,176,.56)');
            gradient.addColorStop(.53,'rgba(255,214,135,.22)');
        }
        gradient.addColorStop(1,'rgba(255,218,150,0)');
        ctx.save();
        ctx.scale(1,2);
        ctx.fillStyle=gradient;
        ctx.fillRect(0,0,128,128);
        ctx.restore();
        const texture=new THREE.CanvasTexture(canvas);
        texture.name=wet?'driver2-wet-reflection':'driver2-headlight-ground';
        texture.magFilter=THREE.LinearFilter;
        texture.minFilter=THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps=true;
        return texture;
    }
    hideUnused(mesh,used){
        const dummy=this.dummy;
        for(let i=used;i<DriverRoadLightFX.MAX_VEHICLES*2;i++){
            dummy.position.set(0,-1000,0);
            dummy.scale.set(0,0,0);
            dummy.rotation.set(0,0,0);
            dummy.updateMatrix();
            mesh.setMatrixAt(i,dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate=true;
    }
    collect(city,focus){
        const selected=this.selected;
        selected.length=0;
        const add=v=>{
            if(!v||!v.headlightsOn||!Number.isFinite(v.x)||
                !Number.isFinite(v.z)||!Number.isFinite(v.heading)||
                v.isSubmerged||v.root?.visible===false)return;
            const dx=v.x-focus.x,dz=v.z-focus.z;
            const distance2=dx*dx+dz*dz;
            if(distance2>DriverRoadLightFX.RADIUS**2)return;
            // O jogador não é inserido duas vezes na lista.
            if(selected.some(p=>p.vehicle===v))return;
            selected.push({vehicle:v,distance2});
            selected.sort((a,b)=>a.distance2-b.distance2);
            if(selected.length>DriverRoadLightFX.MAX_VEHICLES)
                selected.pop();
        };
        add(this.game.playerCar);
        for(const v of this.game.vehicles||[])add(v);
        return selected;
    }
    isSafe(city,v,x,z){
        if(city?.isWaterAt?.(x,z))return false;
        if(city?.isOnSidewalk?.(x,z,1.5))return false;
        if(typeof city?.getGroundHeightAt==='function'){
            const terrain=city.getGroundHeightAt(x,z,Number(v.y)||0);
            if(!Number.isFinite(terrain)||terrain<-.5)return false;
            // Pontes, rampas e veículos elevados não ganham feixe flutuante.
            if(Math.abs((Number(v.y)||0)-terrain)>2.1)return false;
        }
        return true;
    }
    update(dt=0){
        this.elapsed+=Math.max(0,Math.min(.05,Number(dt)||0));
        const game=this.game,city=game.city;
        const enabled=!!city?.preset?.id&&!!city.ready;
        // O cone antigo é mantido como reserva quando este efeito não está
        // disponível, mas não se sobrepõe ao novo facho na partida normal.
        const syncCone=v=>{
            if(v?.headlightBeams)v.headlightBeams.visible=!enabled&&!!v.headlightsOn;
        };
        syncCone(game.playerCar);
        for(const v of game.vehicles||[])syncCone(v);
        const clock=game.dayNight;
        const angle=clock?(clock.time-.25)*Math.PI*2:0;
        const sunHeight=clock?Math.sin(angle):1;
        const rain=!!(clock?.rain||game.effects?.rainEnabled);
        const night=1-DriverRoadLightFX.smooth(-.12,.34,sunHeight);
        const light=Math.max(night,rain ? .66 : 0);
        const focus=typeof game.getPlayerPosition==='function'?
            game.getPlayerPosition():null;
        if(!enabled||light<.012||!focus){
            this.beams.visible=false;
            this.reflections.visible=false;
            this.glows.visible=false;
            this.lastLevel=0;
            this.adjustStreetPools(city,rain,0);
            return {active:0,wet:false};
        }
        const candidates=this.collect(city,focus);
        let used=0;
        for(const {vehicle:v} of candidates){
            const heading=v.heading;
            const sx=Math.sin(heading),sz=Math.cos(heading);
            const rightX=sz,rightZ=-sx;
            // Real projection on the road: not a second opaque cone in air.
            const x=v.x+sx*9.8,z=v.z+sz*9.8;
            if(!this.isSafe(city,v,x,z))continue;
            const surface=typeof city.getGroundHeightAt==='function'?
                city.getGroundHeightAt(x,z,Number(v.y)||0):0;
            // Não ultrapassar o solo no asfalto, nem colocar decal sobre a água.
            if(!Number.isFinite(surface))continue;
            for(const side of [-1,1]){
                const sideX=x+rightX*side*.84;
                const sideZ=z+rightZ*side*.84;
                this.dummy.position.set(sideX,surface+.115,sideZ);
                this.dummy.rotation.set(0,heading,0);
                this.dummy.scale.set(3.05,1,12.5);
                this.dummy.updateMatrix();
                this.beams.setMatrixAt(used,this.dummy.matrix);

                // No molhado, reflexo alongado, discreto e menor que o facho.
                this.dummy.position.set(
                    v.x+sx*6.8+rightX*side*.84,surface+.125,
                    v.z+sz*6.8+rightZ*side*.84);
                this.dummy.scale.set(1.55,1,10.6);
                this.dummy.updateMatrix();
                this.reflections.setMatrixAt(used,this.dummy.matrix);
                // Um pequeno halo por farol, sempre virado para a câmera.
                const dims=typeof DriverVehicleCollisions!=='undefined'?
                    DriverVehicleCollisions.dimensions(v):null;
                const nose=(dims?.length||5.15)*.5+.13;
                const lampOffset=Math.min(.95,(dims?.width||2.45)*.31);
                this.dummy.position.set(
                    v.x+sx*nose+rightX*side*lampOffset,
                    (Number(v.y)||0)+.8,
                    v.z+sz*nose+rightZ*side*lampOffset);
                if(this.dummy.quaternion?.copy && game.camera?.quaternion)
                    this.dummy.quaternion.copy(game.camera.quaternion);
                this.dummy.scale.set(.9,.9,1);
                this.dummy.updateMatrix();
                this.glows.setMatrixAt(used,this.dummy.matrix);
                used++;
            }
        }
        if(!used){
            this.beams.visible=false;
            this.reflections.visible=false;
            this.glows.visible=false;
            this.adjustStreetPools(city,rain,light);
            return {active:0,wet:rain};
        }
        this.hideUnused(this.beams,used);
        this.hideUnused(this.glows,used);
        if(rain)this.hideUnused(this.reflections,used);
        this.beams.visible=true;
        this.beams.instanceMatrix.needsUpdate=true;
        this.lightMaterial.opacity=Math.min(.70,light*(rain ? .49 : .32));
        this.glows.visible=true;
        this.glows.instanceMatrix.needsUpdate=true;
        this.glowMaterial.opacity=Math.min(.55,light*.48);
        this.reflections.visible=rain;
        this.wetMaterial.opacity=rain?
            Math.min(.47,light*(.23+.04*Math.sin(this.elapsed*1.2))):0;
        if(rain)this.reflections.instanceMatrix.needsUpdate=true;
        this.adjustStreetPools(city,rain,light);
        this.lastLevel=light;this.lastWet=rain;
        return {active:used/2,wet:rain};
    }
    adjustStreetPools(city,rain,level){
        // R3 só altera sua opacidade ao mudar o quantizador de luz.
        // Aplicamos um reforço leve da reflexão da chuva, sem criar luzes.
        const state=city?.preset?.id==='chicago'?city.chicagoNightState:null;
        if(!state?.streetPools)return;
        const base=(state.quantized>=0?state.quantized/32:state.level)||0;
        state.streetPools.material.opacity=.24*base*(rain?1.34:1);
        // Fica sempre <=.322 para não estourar a pista no molhado.
    }
}
