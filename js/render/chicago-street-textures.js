/**
 * Chicago visual R2 — materiais de calçadas, meios-fios e letreiros.
 * Isolado do traçado: não gera ruas, terreno, colisores ou missões.
 * Texturas pequenas geradas uma vez por cidade; letreiros apenas no LOD perto.
 */
class DriverChicagoStreetTextures {
    static texture(canvas,name) {
        const tex=new THREE.CanvasTexture(canvas);
        tex.name='driver2-chicago-r2-'+name;
        tex.magFilter=THREE.NearestFilter;
        tex.minFilter=THREE.NearestMipmapNearestFilter||THREE.NearestFilter;
        tex.generateMipmaps=true;
        tex.wrapS=THREE.RepeatWrapping;
        tex.wrapT=THREE.RepeatWrapping;
        tex.anisotropy=1; // Evitar custo extra na GPU de entrada.
        return tex;
    }

    static random(seed) {
        let state=seed>>>0;
        return ()=>{
            state=(Math.imul(state,1664525)+1013904223)>>>0;
            return state/4294967296;
        };
    }

    static createSidewalkTexture() {
        const canvas=document.createElement('canvas');
        canvas.width=256;canvas.height=256;
        const ctx=canvas.getContext('2d');
        const rnd=this.random(0xC41CA12);
        ctx.fillStyle='#898b89';
        ctx.fillRect(0,0,256,256);
        // Dez placas de 25,6px por bloco instanciado de 50 m.
        // Juntas discretas, sem marcas de pista sobre a calçada.
        for(let row=0;row<10;row++)for(let col=0;col<10;col++){
            const x=Math.floor(col*25.6),y=Math.floor(row*25.6);
            const width=Math.ceil((col+1)*25.6)-x;
            const height=Math.ceil((row+1)*25.6)-y;
            const tone=105+Math.floor(rnd()*15);
            ctx.fillStyle='rgb('+tone+','+(tone+2)+','+(tone+1)+')';
            ctx.fillRect(x+1,y+1,width-2,height-2);
            ctx.fillStyle='#656866';
            ctx.globalAlpha=.40;
            ctx.fillRect(x,y,width,1);
            ctx.fillRect(x,y,1,height);
            ctx.globalAlpha=1;
            // Algumas placas recebem remendos ou microfissuras.
            if(rnd()<.28){
                const px=x+4+Math.floor(rnd()*12),py=y+4+Math.floor(rnd()*11);
                ctx.fillStyle='#4a5150';ctx.globalAlpha=.25;
                ctx.fillRect(px,py,9,1);
                ctx.fillRect(px+8,py,1,4);
                ctx.globalAlpha=1;
            }
            if(rnd()<.16){
                ctx.fillStyle='#bbbeb6';ctx.globalAlpha=.28;
                ctx.fillRect(x+4,y+9,14,3);
                ctx.globalAlpha=1;
            }
        }
        // Granulação de concreto determinista, com transparência baixa.
        for(let i=0;i<1100;i++){
            const x=Math.floor(rnd()*256),y=Math.floor(rnd()*256);
            ctx.fillStyle=rnd()>.5?'#d0cfc6':'#353c3b';
            ctx.globalAlpha=.05+rnd()*.10;
            ctx.fillRect(x,y,1,1);
        }
        ctx.globalAlpha=1;
        return this.texture(canvas,'sidewalk');
    }

    static createCurbTexture() {
        const canvas=document.createElement('canvas');
        canvas.width=256;canvas.height=64;
        const ctx=canvas.getContext('2d');
        const rnd=this.random(0xC41CC0B);
        ctx.fillStyle='#91948d';ctx.fillRect(0,0,256,64);
        // Pedras e juntas da borda, sem criar geometrias adicionais.
        for(let i=0;i<16;i++){
            const x=i*16;
            ctx.fillStyle=i%3===0?'#7c807a':'#989b95';
            ctx.fillRect(x+1,0,14,64);
            ctx.fillStyle='#626863';ctx.globalAlpha=.55;
            ctx.fillRect(x,0,1,64);ctx.globalAlpha=1;
            ctx.fillStyle='#c5c5b9';ctx.globalAlpha=.22;
            ctx.fillRect(x+2,1,12,2);ctx.globalAlpha=1;
        }
        for(let i=0;i<180;i++){
            ctx.fillStyle=rnd()>.5?'#4a504b':'#e6e6df';
            ctx.globalAlpha=.07;
            ctx.fillRect(Math.floor(rnd()*256),Math.floor(rnd()*64),2,1);
        }
        ctx.globalAlpha=1;
        return this.texture(canvas,'curb');
    }

    static createShopSignTexture(kind) {
        const options=[
            {label:'DINER',back:'#702f27',border:'#c4a585',text:'#f2d7ad'},
            {label:'MARKET',back:'#264b50',border:'#bfae7b',text:'#f7e9cb'},
            {label:'AUTO PARTS',back:'#293d55',border:'#ab7b54',text:'#f0e3c9'},
            {label:'BARBER',back:'#64503d',border:'#c5b28e',text:'#f5ece0'}
        ];
        const option=options[(Number(kind)|0)%options.length];
        const canvas=document.createElement('canvas');
        canvas.width=256;canvas.height=64;
        const ctx=canvas.getContext('2d');
        const rnd=this.random(0xC4100+kind*167);
        ctx.fillStyle=option.back;ctx.fillRect(0,0,256,64);
        ctx.fillStyle=option.border;
        ctx.fillRect(0,0,256,5);ctx.fillRect(0,59,256,5);
        ctx.fillRect(0,0,5,64);ctx.fillRect(251,0,5,64);
        ctx.fillStyle=option.text;ctx.font='bold 27px Georgia, serif';
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(option.label,128,33,231);
        // Tinta antiga: manchas leves, nunca efeito luminoso exagerado.
        for(let i=0;i<72;i++){
            ctx.fillStyle=rnd()>.5?'#f3e8d4':'#101921';
            ctx.globalAlpha=.035+rnd()*.07;
            ctx.fillRect(Math.floor(rnd()*256),Math.floor(rnd()*64),2,2);
        }
        ctx.globalAlpha=1;
        return this.texture(canvas,'shop-'+kind);
    }

    static decorateShops(city,buildings,parent) {
        if(city?.preset?.id!=='chicago'||!Array.isArray(buildings)||
            !parent||!city.districtMaterialCache||!city.districtTextureCache)
            return {shops:0,batches:0};
        const groups=[[],[],[],[]];
        for(const b of buildings){
            if(!b.planned||b.kind!=='commercial')continue;
            const {x,z,width:w,depth:d,height:h}=b;
            const base=b.baseY??.35;
            if(![x,z,w,d,h,base].every(Number.isFinite)||w<7||d<4||h<6)
                continue;
            const variant=Math.abs(Math.imul(Math.round(x*3),73856093)^
                Math.imul(Math.round(z*3),19349663))%4;
            groups[variant].push({
                x,z:z+d/2+1.07,y:base+4.92,
                width:Math.min(w*.69,8.8),height:.75
            });
        }
        let shops=0,batches=0;
        const geometry=new THREE.PlaneGeometry(1,1);
        const dummy=new THREE.Object3D();
        groups.forEach((items,index)=>{
            if(!items.length)return;
            const key='chicago-r2-shop-'+index;
            let material=city.districtMaterialCache.get(key);
            if(!material){
                const tex=this.createShopSignTexture(index);
                city.districtTextureCache.set(key,tex);
                material=new THREE.MeshLambertMaterial({
                    map:tex,side:THREE.DoubleSide,transparent:false
                });
                city.districtMaterialCache.set(key,material);
            }
            const mesh=new THREE.InstancedMesh(geometry,material,items.length);
            items.forEach((p,i)=>{
                dummy.position.set(p.x,p.y,p.z);
                dummy.rotation.set(0,0,0);
                dummy.scale.set(p.width,p.height,1);
                dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
            });
            mesh.instanceMatrix.needsUpdate=true;
            // Chunks próximos já fazem controle de visibilidade por LOD.
            mesh.frustumCulled=false;
            mesh.castShadow=false;
            mesh.receiveShadow=false;
            mesh.name='chicago-r2-shopfront-'+index;
            mesh.userData.visualOnly=true;
            parent.add(mesh);
            shops+=items.length;batches++;
        });
        // Evitar geometria vazia alocada em chunks sem lojas.
        if(!batches)geometry.dispose();
        return {shops,batches};
    }
}
