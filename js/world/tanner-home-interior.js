/**
 * Casa de Tanner — ambientação PS1 com sala, cozinha e escritório.
 * Low-poly instanciado, materiais simples e piso Canvas2D procedural.
 * As peças físicas ficam nas laterais; o caminho central até save/saída
 * permanece livre para Tanner.
 */
class DriverTannerHomeInterior {
    static floorTexture(){
        const canvas=document.createElement('canvas');
        canvas.width=128;canvas.height=128;
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#72543c';ctx.fillRect(0,0,128,128);
        for(let i=0;i<8;i++){
            const y=i*16;
            ctx.fillStyle=i%2?'#846145':'#76543c';
            ctx.fillRect(0,y,128,14);
            ctx.strokeStyle='#422f26';ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();
            const shift=i%2?32:0;
            for(let x=shift;x<128;x+=64){
                ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+15);ctx.stroke();
            }
        }
        const texture=new THREE.CanvasTexture(canvas);
        texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
        texture.repeat.set(5,4);
        texture.magFilter=THREE.NearestFilter;
        return texture;
    }
    static build(city,place){
        if(place?.id!=='home'||!city?.cityGroup)return null;
        const x=place.inside.x,z=place.inside.z;
        const floor=new THREE.Mesh(
            new THREE.BoxGeometry(23,.06,21),
            new THREE.MeshLambertMaterial({map:this.floorTexture()}));
        floor.position.set(x,.055,z);
        floor.receiveShadow=true;
        city.cityGroup.add(floor);

        // [x,y,z,w,h,d,cor,emissivo], agrupado em 2 InstancedMesh.
        const parts=[],solid=[];
        const add=(dx,y,dz,w,h,d,color,lit=false,physics=false)=>{
            parts.push([x+dx,y,z+dz,w,h,d,color,lit]);
            if(physics)solid.push({
                minX:x+dx-w/2,maxX:x+dx+w/2,
                minZ:z+dz-d/2,maxZ:z+dz+d/2
            });
        };
        const wood=0x6b4232,mahogany=0x573b30,
            cream=0xdac8a7,sofa=0x3c5b57,
            metal=0x5b626c,screen=0x294b45,
            lamp=0xffd58d,red=0x8e473f;

        // Rodapés, quadros e faixas de papel de parede.
        for(const dx of [-11.25,11.25]){
            add(dx,.3,0,.12,.52,20,mahogany);
            for(const dz of [-6.5,.5,6.2]){
                add(dx*.975,3.2,dz,.14,1.5,2.4,wood);
                add(dx*.968,3.22,dz,.045,1.15,2.0,
                    dz===.5?0x69908a:0xa88967,true);
            }
        }
        for(const dz of [-10.35,10.35])
            add(0,.3,dz,22,.45,.12,mahogany);

        // Tapete de entrada, corredor e centro da sala.
        add(0,.10,-5.2,2.6,.045,6.0,red);
        add(0,.10,1.8,3.2,.045,4.6,0x9d7152);
        add(0,.135,1.8,2.7,.022,4.1,cream);

        // Sala: sofá, braços, apoio, mesa e TV de tubo anos 1970.
        add(7.3,.53,-2,4.7,1.05,2.0,sofa,false,true);
        add(7.3,1.2,-2.8,4.7,.75,.42,sofa);
        for(const dx of [5.15,9.45])
            add(dx,.82,-2,.42,1.35,2.15,sofa);
        add(7.2,.50,2.5,3.4,.9,1.7,wood,false,true);
        add(7.2,1.02,2.5,3.7,.13,1.95,mahogany);
        add(9.65,1.08,5.8,2.65,1.5,1.7,mahogany,false,true);
        add(9.65,2.05,5.8,2.2,1.3,.45,metal);
        add(9.65,2.1,5.56,1.9,1.02,.055,screen,true);
        add(9.65,1.32,5.15,.25,.12,.11,lamp,true);

        // Cozinha: armários, pia, fogão e azulejos retrô.
        add(-9.7,1.06,-3,2.1,2.1,7,wood,false,true);
        add(-9.65,2.2,-3,2.2,.15,7,cream);
        add(-9.55,3.6,-5.7,2,1.8,1.9,mahogany);
        add(-9.55,3.6,-.6,2,1.8,1.9,mahogany);
        add(-8.6,1.0,-6.4,1.35,1.8,1.5,metal,false,true);
        add(-8.6,1.97,-6.4,1.15,.08,1.32,0xc9d4cf);
        add(-9.7,2.28,-1.0,1,.045,1.0,0x8eadae,true);
        for(const dx of [-10.0,-9.3])for(const dz of [-1.25,-.75])
            add(dx,2.34,dz,.16,.06,.16,0x1e293b);

        // Quarto lateral: cama baixa, cobertor, travesseiros e criado-mudo.
        // Evita a entrada central, permitindo explorar a casa a pé.
        add(7.0,.43,-7.5,4.8,.65,3.5,wood,false,true);
        add(7.0,.85,-7.5,4.5,.31,3.15,cream);
        add(7.0,1.04,-8.0,4.3,.12,2.1,0x536e78);
        for(const dx of [6.05,7.95])
            add(dx,1.05,-6.22,1.45,.22,.62,0xece1ce);
        add(9.9,.64,-5.35,1.3,1.15,1.2,mahogany,false,true);
        add(9.9,1.33,-5.35,.7,.13,.65,lamp,true);

        // Mesa de jantar e cadeiras junto à parede, afastadas do save.
        add(-6.9,1.05,5.8,4.4,.15,2.7,wood,false,true);
        for(const dz of [4.1,7.55]){
            add(-7.0,.6,dz,1.4,1.1,.8,mahogany,false,true);
            add(-7.0,1.2,dz+(dz>5? .52:-.52),
                1.5,1.45,.22,mahogany);
        }

        // Escritório, armários com livros e recortes de jornal.
        for(const dx of [5.2,9.65]){
            add(dx,2.25,8.4,2.9,4.5,1.12,wood,false,true);
            for(const dy of [1.1,2.5,3.9]){
                add(dx,dy,7.8,2.7,.12,.92,mahogany);
                for(const dxx of [-.9,-.3,.35,.88])
                    add(dx+dxx,dy+.4,7.72,.25,.72,.56,
                        (dy<2?0x78926b:0x92705e));
            }
        }
        // Área da mesa de salvamento original fica no corredor central.
        add(0,2.05,4,1.8,.24,1.35,0x316950,true);
        add(0,2.35,4,.65,.18,.45,lamp,true);
        // Luminárias de teto com material emissivo, sem PointLights caros.
        for(const dz of [-6.5,0,6.5]){
            add(0,5.96,dz,1.65,.16,1.15,metal);
            add(0,5.79,dz,1.28,.10,.88,lamp,true);
        }
        if(typeof DriverSpecialStructures!=='undefined')
            DriverSpecialStructures.pack(city.cityGroup,parts,'tanner-home-rev2');
        // A mesa original de save ocupa o corredor em z+4:
        // o jogador encosta nela para usar E, mas não a atravessa.
        solid.push({minX:x-2.05,maxX:x+2.05,
            minZ:z+2.9,maxZ:z+5.1});
        city.tannerHomeFurnitureBoxes=solid;
        city.tannerHomeInteriorStats={
            pieces:parts.length,colliders:solid.length,rooms:4};
        return city.tannerHomeInteriorStats;
    }
    static blocked(city,x,z,radius=0.55){
        for(const b of city?.tannerHomeFurnitureBoxes||[]){
            if(x+radius>b.minX&&x-radius<b.maxX&&
                z+radius>b.minZ&&z-radius<b.maxZ)return true;
        }
        return false;
    }
}
