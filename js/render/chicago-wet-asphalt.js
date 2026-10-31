/**
 * Driver 2 / Chicago — R5 pavimento molhado.
 * Escurece o material existente e desenha até 48 reflexos irregulares
 * em UMA InstancedMesh próxima ao player. Sem água falsa, luzes WebGL,
 * novos colisores ou modificações no atlas/traçado da cidade.
 */
class DriverChicagoWetAsphalt {
    static MAX_PATCHES=48;
    static GRID=12;
    static smooth(a,b,value){
        const t=Math.max(0,Math.min(1,(value-a)/(b-a)));
        return t*t*(3-2*t);
    }
    static hash(x,z,seed=31){
        let h=Math.imul(x|0,73856093)^Math.imul(z|0,19349663)^
            Math.imul(seed,83492791);
        h=Math.imul(h^(h>>>15),2246822519);
        return ((h^(h>>>13))>>>0)/4294967296;
    }
    static texture(){
        const canvas=document.createElement('canvas');
        canvas.width=canvas.height=128;
        const ctx=canvas.getContext('2d');
        ctx.save();
        ctx.translate(64,64);
        ctx.scale(1,.56);
        const glow=ctx.createRadialGradient(0,0,3,0,0,62);
        glow.addColorStop(0,'rgba(186,204,216,.48)');
        glow.addColorStop(.28,'rgba(158,179,194,.34)');
        glow.addColorStop(.62,'rgba(130,154,171,.17)');
        glow.addColorStop(.92,'rgba(115,139,151,.035)');
        glow.addColorStop(1,'rgba(115,139,151,0)');
        ctx.fillStyle=glow;
        ctx.fillRect(-64,-64,128,128);
        // Reflexos difusos e falhas pequenas no asfalto, não quadrados opacos.
        let s=0x57A5FA3D;
        const rnd=()=>{
            s=(Math.imul(s,1664525)+1013904223)>>>0;
            return s/4294967296;
        };
        for(let i=0;i<24;i++){
            const y=Math.floor((rnd()-.5)*82);
            const x=Math.floor((rnd()-.5)*93);
            ctx.globalAlpha=.08+rnd()*.15;
            ctx.fillStyle=i%3?'#e9eef1':'#667d8a';
            ctx.fillRect(x,y,9+rnd()*35,.5+rnd()*2.1);
        }
        ctx.globalAlpha=1;
        ctx.restore();
        const texture=new THREE.CanvasTexture(canvas);
        texture.name='driver2-chicago-wet-asphalt-r5';
        texture.magFilter=THREE.LinearFilter;
        texture.minFilter=THREE.LinearMipmapLinearFilter;
        return texture;
    }
    static install(city,roadMesh){
        if(city?.preset?.id!=='chicago'||!roadMesh?.material)return null;
        if(city.chicagoWetAsphalt)return city.chicagoWetAsphalt;
        const geo=new THREE.PlaneGeometry(1,1);
        geo.rotateX(-Math.PI/2);
        const material=new THREE.MeshBasicMaterial({
            map:this.texture(),color:0x9cb0bd,
            transparent:true,opacity:0,depthWrite:false,depthTest:true,
            side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2
        });
        const mesh=new THREE.InstancedMesh(geo,material,this.MAX_PATCHES);
        mesh.frustumCulled=false;
        mesh.castShadow=false;
        mesh.receiveShadow=false;
        mesh.visible=false;
        mesh.name='chicago-r5-asphalt-wet-patches';
        mesh.userData.visualOnly=true;
        city.cityGroup.add(mesh);
        const state={
            roadMesh,mesh,material,wet:0,puddles:0,
            lastX:Infinity,lastZ:Infinity,rebuilds:0
        };
        city.chicagoWetAsphalt=state;
        return state;
    }
    static nearestRoad(value){
        return Math.abs(value-Math.round(value/80)*80);
    }
    static safePatch(city,x,z){
        // Grade PS1 procedural: apenas faixa de rodagem, nunca calçadas.
        if(Math.min(this.nearestRoad(x),this.nearestRoad(z))>8.3)
            return null;
        if(city.isWaterAt?.(x,z)||city.isOnSidewalk?.(x,z,1.8))
            return null;
        const ground=typeof city.getGroundHeightAt==='function'?
            city.getGroundHeightAt(x,z,0):0;
        // Pistas/viadutos inclinados precisam de decal orientado pela normal:
        // não desenhar um plano horizontal flutuando sobre eles.
        if(!Number.isFinite(ground)||ground<-.25||ground>.55)
            return null;
        return ground;
    }
    static positionPatches(city,focus){
        const state=city.chicagoWetAsphalt;
        if(!state||!Number.isFinite(focus?.x)||!Number.isFinite(focus?.z))
            return 0;
        const baseX=Math.floor(focus.x/this.GRID)*this.GRID;
        const baseZ=Math.floor(focus.z/this.GRID)*this.GRID;
        if(Math.abs(baseX-state.lastX)<this.GRID&&
            Math.abs(baseZ-state.lastZ)<this.GRID)
            return state.puddles;
        state.lastX=baseX;state.lastZ=baseZ;
        const dummy=new THREE.Object3D();
        let count=0;
        search: for(let ix=-8;ix<=8;ix++)for(let iz=-8;iz<=8;iz++){
            const x=baseX+ix*this.GRID,z=baseZ+iz*this.GRID;
            if(Math.hypot(x-focus.x,z-focus.z)>94)continue;
            const chance=this.hash(Math.floor(x/this.GRID),Math.floor(z/this.GRID));
            if(chance<.37)continue;
            const ground=this.safePatch(city,x,z);
            if(ground===null)continue;
            const offsetX=(this.hash(ix,iz,11)-.5)*2.1;
            const offsetZ=(this.hash(ix,iz,22)-.5)*2.1;
            dummy.position.set(x+offsetX,ground+.049,z+offsetZ);
            dummy.rotation.set(0,this.hash(ix,iz,17)*Math.PI,0);
            dummy.scale.set(3.5+chance*3.8,1,4.4+chance*5.5);
            dummy.updateMatrix();
            state.mesh.setMatrixAt(count,dummy.matrix);
            count++;
            if(count===this.MAX_PATCHES)break search;
        }
        // InstancedMesh.count é fixo: ocultar slots vazios fora da câmera.
        for(let i=count;i<this.MAX_PATCHES;i++){
            dummy.position.set(0,-1000,0);
            dummy.rotation.set(0,0,0);
            dummy.scale.set(0,0,0);
            dummy.updateMatrix();
            state.mesh.setMatrixAt(i,dummy.matrix);
        }
        state.mesh.instanceMatrix.needsUpdate=true;
        state.puddles=count;
        state.rebuilds++;
        return count;
    }
    static update(game,dt=0){
        const city=game?.city;
        if(city?.preset?.id!=='chicago')return {wet:0,patches:0};
        const state=city.chicagoWetAsphalt;
        if(!state)return {wet:0,patches:0};
        const raining=!!(game.dayNight?.rain||game.effects?.rainEnabled);
        const target=raining?1:0;
        const safeDt=Math.max(0,Math.min(.05,Number(dt)||0));
        const response=1-Math.exp(-safeDt*(raining?1.6:.95));
        state.wet+= (target-state.wet)*response;
        if(Math.abs(target-state.wet)<.002)state.wet=target;
        const clock=game.dayNight;
        const height=clock?Math.sin((clock.time-.25)*Math.PI*2):1;
        const darkness=1-this.smooth(-.14,.35,height);
        // Escurecer apenas o material da pista existente, não terreno/parques.
        const gray=1-.29*state.wet;
        state.roadMesh.material.color.setRGB(gray,gray,gray);
        state.material.opacity=Math.min(.35,state.wet*(.15+darkness*.14));
        state.material.color.setHex(darkness>.55?0xb2ad9d:0xa0b8c6);
        if(state.wet<.025||!city.ready){
            state.mesh.visible=false;
            return {wet:state.wet,patches:0};
        }
        const focus=typeof game.getPlayerPosition==='function'?
            game.getPlayerPosition():null;
        this.positionPatches(city,focus);
        state.mesh.visible=state.puddles>0;
        return {wet:state.wet,patches:state.puddles};
    }
}
