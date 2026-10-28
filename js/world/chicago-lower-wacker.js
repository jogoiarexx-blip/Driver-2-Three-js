/**
 * Lower Wacker Drive — corredor coberto na Chicago low-poly.
 * Complementa (não substitui) as estradas, missões e colisões do projeto.
 * Convenção: +Z avança para norte no mundo atual. A cobertura fica
 * acima da pista existente para não haver interseção com o asfalto.
 * Sem sombras dinâmicas, refletores caros ou objetos por quadro.
 */
class DriverChicagoLowerWacker {
    static X=240;
    static Z0=-232;
    static Z1=-92;
    static ROOF_Y=7.1;
    static HALF_WIDTH=12.8;

    /** Somente quem está abaixo da cobertura fica escondido. */
    static isCovered(city,point) {
        if(city?.preset?.id!=='chicago'||!point)return false;
        const y=Number(point.y)||0;
        return point.x>=this.X-this.HALF_WIDTH &&
            point.x<=this.X+this.HALF_WIDTH &&
            point.z>=this.Z0 && point.z<=this.Z1 &&
            y<this.ROOF_Y-0.6;
    }

    /** A cobertura bloqueia a visão de quem está fora, não de quem
     * dirige dentro do mesmo túnel. A patrulha retém memória de rádio.
     */
    static blocksPoliceSight(city,cop,target) {
        const c=this.isCovered(city,cop);
        const t=this.isCovered(city,target);
        return c!==t;
    }

    /** Apenas os pilares são obstáculos AABB; o teto não bloqueia carros. */
    static isPillarContact(city,x,z,radius=1.55) {
        if(city?.preset?.id!=='chicago')return false;
        for(const box of city.chicagoLowerWacker?.pillarBoxes||[]){
            if(x+radius>box.minX&&x-radius<box.maxX&&
                z+radius>box.minZ&&z-radius<box.maxZ)return true;
        }
        return false;
    }

    static ceilingTexture() {
        // Faixas repetidas de placas de concreto via Canvas2D.
        const canvas=document.createElement('canvas');
        canvas.width=128;canvas.height=128;
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#46505a';ctx.fillRect(0,0,128,128);
        ctx.strokeStyle='#29323b';ctx.lineWidth=3;
        for(let y=0;y<=128;y+=32){
            ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();
        }
        ctx.fillStyle='rgba(235,180,90,.18)';
        ctx.fillRect(0,17,128,3);
        const texture=new THREE.CanvasTexture(canvas);
        texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
        texture.repeat.set(2,9);
        texture.magFilter=THREE.NearestFilter;
        texture.minFilter=THREE.LinearMipmapLinearFilter;
        return texture;
    }

    static build(city) {
        if(city?.preset?.id!=='chicago')return;
        const root=new THREE.Group();
        root.name='lower-wacker-chicago';
        city.cityGroup.add(root);

        const concrete=new THREE.MeshLambertMaterial({color:0x60656b});
        const metal=new THREE.MeshLambertMaterial({color:0x343a40});
        const amber=new THREE.MeshBasicMaterial({color:0xffc66f});
        const roof=new THREE.Mesh(new THREE.BoxGeometry(
            this.HALF_WIDTH*2,0.85,this.Z1-this.Z0),
            new THREE.MeshLambertMaterial({map:this.ceilingTexture(),
                side:THREE.DoubleSide}));
        roof.position.set(this.X,this.ROOF_Y, (this.Z0+this.Z1)*.5);
        roof.receiveShadow=false;
        root.add(roof);

        // Faixas e lajes laterais, sem paredes que fechem cruzamentos.
        for(const dx of [-this.HALF_WIDTH,this.HALF_WIDTH]){
            const parapet=new THREE.Mesh(
                new THREE.BoxGeometry(.42,1.25,this.Z1-this.Z0),metal);
            parapet.position.set(this.X+dx,this.ROOF_Y+.72,
                (this.Z0+this.Z1)*.5);
            root.add(parapet);
        }

        const pillarXs=[this.X-10,this.X+10];
        const pillarZs=[-220,-202,-184,-140,-122,-104];
        const positions=[];
        const boxes=[];
        for(const z of pillarZs)for(const x of pillarXs){
            positions.push({x,y:3.2,z});
            const half=.76;
            const b={minX:x-half,maxX:x+half,minZ:z-half,maxZ:z+half};
            boxes.push(b);
            city.buildingBoxes.push(b);
        }

        // Uma única draw call para os 12 pilares; colisores permanecem AABB.
        const posts=new THREE.InstancedMesh(
            new THREE.BoxGeometry(1.5,6.4,1.5),concrete,positions.length);
        const matrix=new THREE.Matrix4();
        positions.forEach((p,i)=>{
            matrix.makeTranslation(p.x,p.y,p.z);
            posts.setMatrixAt(i,matrix);
        });
        posts.instanceMatrix.needsUpdate=true;
        posts.frustumCulled=false;
        root.add(posts);

        // Iluminação amarela de sódio: placas emissivas, SEM PointLight
        // em cada lâmpada, protegendo o orçamento de 60 FPS.
        const lamps=[];
        for(let z=this.Z0+9;z<this.Z1-4;z+=13)
            lamps.push({x:this.X,y:this.ROOF_Y-.53,z});
        const fixtures=new THREE.InstancedMesh(
            new THREE.BoxGeometry(4,.08,.42),amber,lamps.length);
        lamps.forEach((p,i)=>{
            matrix.makeTranslation(p.x,p.y,p.z);
            fixtures.setMatrixAt(i,matrix);
        });
        fixtures.instanceMatrix.needsUpdate=true;
        fixtures.frustumCulled=false;
        root.add(fixtures);

        // Portais de entrada com travessa elevada: nenhum collider na pista.
        for(const z of [this.Z0,this.Z1]){
            const beam=new THREE.Mesh(new THREE.BoxGeometry(
                this.HALF_WIDTH*2,.75,.55),metal);
            beam.position.set(this.X,this.ROOF_Y-1.15,z);
            root.add(beam);
        }

        city.chicagoLowerWacker={
            root,pillarBoxes:boxes,
            pillarCount:positions.length,lampCount:lamps.length,
            coveredBounds:{x0:this.X-this.HALF_WIDTH,
                x1:this.X+this.HALF_WIDTH,z0:this.Z0,z1:this.Z1}
        };
        // Cidade pode reiniciar/reconstruir o cenário sem cache AABB obsoleto.
        if(city._spatialCollisions)city._spatialCollisions.boxes=null;
    }
}
