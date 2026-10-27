/**
 * Las Vegas 2.0 — Strip, Downtown, resorts, fachadas e deserto.
 *
 * Melhorias visuais sem criar colisores nem modificar circulação,
 * semáforos, missão, ponte, veículos ou interiores existentes.
 * Próximo: o gerenciador DriverDistrictLOD cria 1-2 lotes por setor.
 * Distante: silhuetas leves, renderização instanciada sem PointLights.
 */
class DriverVegasOverhaul {
    static isVegas(city){return city?.preset?.id==='vegas';}

    static districtKind(x,z){
        // Grid jogável estilizado, não um mapa geográfico preciso.
        if(Math.abs(x)<=125&&z>=-235&&z<=245)return 'strip';
        if(z<=-155)return 'downtown';
        if(x>=155)return 'resort';
        return 'residential';
    }

    static glyphs(){
        // Fonte pixel 5x7 para letreiros originais; sem fontes externas.
        return {
            'A':['01110','10001','10001','11111','10001','10001','10001'],
            'B':['11110','10001','10001','11110','10001','10001','11110'],
            'C':['01111','10000','10000','10000','10000','10000','01111'],
            'D':['11110','10001','10001','10001','10001','10001','11110'],
            'E':['11111','10000','10000','11110','10000','10000','11111'],
            'G':['01111','10000','10000','10111','10001','10001','01111'],
            'H':['10001','10001','10001','11111','10001','10001','10001'],
            'I':['11111','00100','00100','00100','00100','00100','11111'],
            'L':['10000','10000','10000','10000','10000','10000','11111'],
            'M':['10001','11011','10101','10101','10001','10001','10001'],
            'N':['10001','11001','10101','10011','10001','10001','10001'],
            'O':['01110','10001','10001','10001','10001','10001','01110'],
            'R':['11110','10001','10001','11110','10100','10010','10001'],
            'S':['01111','10000','10000','01110','00001','00001','11110'],
            'T':['11111','00100','00100','00100','00100','00100','00100'],
            'V':['10001','10001','10001','10001','10001','01010','00100'],
            ' ':['00000','00000','00000','00000','00000','00000','00000']
        };
    }

    static pixelSign(parts,word,x,y,z,scale,color,orientation='front'){
        const glyphs=this.glyphs();
        const letterWidth=6*scale, full=(word.length*6-1)*scale;
        for(let i=0;i<word.length;i++){
            const glyph=glyphs[word[i]]||glyphs[' '];
            for(let row=0;row<7;row++){
                for(let col=0;col<5;col++){
                    if(glyph[row][col]!=='1')continue;
                    const horiz=(i*letterWidth+col*scale-full/2);
                    const vertical=(3-row)*scale;
                    if(orientation==='side'){
                        parts.push([x,y+vertical,z+horiz,
                            .16,scale*.82,scale*.79,color,true]);
                    }else{
                        parts.push([x+horiz,y+vertical,z,
                            scale*.79,scale*.82,.16,color,true]);
                    }
                }
            }
        }
        return parts;
    }

    static detailDistrict(city,buildings,parent){
        if(!this.isVegas(city)||!buildings?.length)return [];
        const parts=[],add=(x,y,z,w,h,d,c,glow=false)=>{
            if([x,y,z,w,h,d].every(Number.isFinite)&&
                w>0&&h>0&&d>0)
                parts.push([x,y,z,w,h,d,c,glow]);
        };
        const colors=[0x16d8e5,0xf760bd,0xffd66e,0xa58bfa,0x78e2ac];
        for(const b of buildings){
            const {x,z}=b,h=b.height,roof=h+.35;
            const kind=this.districtKind(x,z);
            const seed=UrbanDistricts.random(x,z,71);
            const primary=colors[Math.floor(seed*colors.length)];
            const secondary=colors[(Math.floor(seed*colors.length)+2)%colors.length];
            const face=z+19.47;
            if(kind==='strip'){
                // Cassinos e hotéis da Strip: cortina de vidro, marquise
                // dupla, frisos verticais e letreiro visível da avenida.
                for(let y=9.5;y<h-2;y+=5.8){
                    add(x,y,face+.16,35,.21,.35,0x6d7b98);
                    for(let dx=-14;dx<=14;dx+=7)
                        add(x+dx,y+1.9,face+.20,3.1,2.9,.22,0x4d7994);
                }
                for(const dx of [-16,16]){
                    add(x+dx,h*.51,face+.18,.42,h-1,.48,primary,true);
                }
                add(x,5.8,face+1.28,34,.54,3.1,0x37314b);
                for(const yy of [4.0,7.55])
                    add(x,yy,face+2.93,34,.18,.25,primary,true);
                add(x,roof+.75,z-1,33,1.1,32,0x444460);
                add(x,roof+2.0,z-12,24,.8,7,0x666c86);
                add(x,roof+2.55,z-12,24,.18,7,secondary,true);
                // A fachada lateral do prédio x=±40 olha para a
                // avenida principal (Strip em x=0).
                if(Math.abs(x)<=50){
                    const sideX=x>0?x-19.54:x+19.54;
                    for(let y=10;y<h-1;y+=7.8){
                        add(sideX,y,z, .28,.28,33,secondary,true);
                        for(const dz of [-11,-5,1,7,13]){
                            add(sideX,y-2.9,z+dz,.25,4.7,2.1,0x537b97);
                        }
                    }
                    // Signagem na parede, sem invadir a via.
                    const signY=Math.max(11,Math.min(h-5,20));
                    this.pixelSign(parts,'CASINO',sideX+(x>0?-.19:.19),
                        signY,z,.40,primary,'side');
                }
            }else if(kind==='downtown'){
                // Cassinos compactos da Fremont, telhas, alpendres e
                // marquises luminosas mais próximas do pedestre.
                add(x,roof+.6,z-3,34,.7,29,0x5d4359);
                add(x,5.8,face+1.16,35,.56,2.7,0x3c3049);
                for(const y of [4.15,7.5])
                    add(x,y,face+2.49,34,.16,.22,primary,true);
                for(const dx of [-14,-7,0,7,14]){
                    add(x+dx,2.7,face+.26,.25,5.1,.32,0xb08a83);
                    add(x+dx,6.0,face+2.0,1.1,.4,.3,secondary,true);
                }
                this.pixelSign(parts,'VEGAS',x,12.5,face+.61,
                    .58,primary);
                for(const dx of [-11,11])
                    add(x+dx,h*.55,face,.25,h-.9,.5,0x947b8c);
            }else if(kind==='resort'){
                // Resorts com fachadas claras, varandas e cobertura.
                for(let y=8;y<h-2;y+=6.2){
                    add(x,y,face+.50,30,.28,1.1,0xe1c9ab);
                    add(x,y+.72,face+1.07,30,1.15,.16,0x677c8c);
                    for(const dx of [-12,-6,0,6,12])
                        add(x+dx,y+.73,face+1.06,.15,1.18,.18,
                            0xbbcbd0);
                }
                add(x,roof+1,z,31,1.3,30,0xcab79f);
                for(const dx of [-9,9])
                    add(x+dx,roof+2.1,z-10,4.6,1.8,4,0x7f8897);
                add(x,5.5,face+1.1,32,.48,2.3,0x424052);
                add(x,4.55,face+2.28,32,.19,.22,primary,true);
            }else{
                // Subúrbios do Nevada: casas/lojas menores e tons de
                // deserto. Os prédios base mantêm os colliders originais.
                for(const dx of [-14,-5,5,14]){
                    add(x+dx,3.1,face+.12,7.8,4.1,.21,0x736b67);
                    add(x+dx,5.38,face+.38,8,.38,.72,0xb1a28f);
                }
                for(let y=9;y<h-1;y+=8){
                    add(x,y,face+.10,35,.34,.4,0x8a7572);
                }
                add(x,roof+.65,z,34,.82,32,0x806b61);
                add(x-8,roof+1.65,z-9,4.0,1.8,4,0x66606b);
            }
        }
        return DriverSpecialStructures.pack(parent,parts,'vegas-district');
    }

    static detailFarDistrict(city,buildings,parent){
        if(!this.isVegas(city)||!buildings?.length)return [];
        const p=[],add=(x,y,z,w,h,d,c)=>{
            if([x,y,z,w,h,d].every(Number.isFinite)&&
                w>0&&h>0&&d>0)p.push([x,y,z,w,h,d,c,true]);
        };
        for(const b of buildings){
            const {x,z}=b,h=b.height;
            const kind=this.districtKind(x,z);
            // Janelas econômicas no LOD distante: sem textura nova,
            // com apenas UM lote de emissão por setor. O objeto filho
            // fica invisível sempre que seu pai FAR vira invisível.
            const rows=Math.min(kind==='strip'?9:5,
                Math.floor((h-5)/7.2));
            const warm=kind==='downtown'?0xe0bb92:0xf2c991;
            const cool=kind==='strip'?0x83b4c8:0x8ca7bd;
            for(let row=0;row<rows;row++){
                const y=5+row*7.2;
                for(const dx of [-12.3,-4.2,4.2,12.3]){
                    add(x+dx,y,z+19.16,2.65,1.65,.13,
                        (row+Math.round(dx))%4===0?warm:cool);
                }
                // Lateral dos hotéis da Strip: vista principal a partir
                // do centro da avenida x=0, para não exibir paredões.
                if(kind==='strip'){
                    const sx=x+(x>=0?-19.16:19.16);
                    for(const dz of [-12.3,-4.2,4.2,12.3])
                        add(sx,y,z+dz,.13,1.65,2.65,
                            (row+Math.round(dz))%4===0?warm:cool);
                }
            }
            if(rows>0){
                add(x,h+.47,z+19.18,34,.20,.18,0xd3a0bc);
                if(kind==='strip')
                    add(x+(x>=0?-19.17:19.17),h+.47,z,
                        .18,.20,34,0x7acbda);
            }
        }
        return DriverSpecialStructures.pack(parent,p,
            'vegas-far-skyline-windows');
    }

    static buildStrip(city){
        if(!this.isVegas(city))return [];
        const p=[],add=(...v)=>p.push(v);
        // Eixo viário norte/sul x=0; não há obstáculos novos no
        // asfalto. Balizadores embutidos a y=.06 e fachadas laterais.
        for(let z=-305;z<=305;z+=16){
            for(const x of [-11.7,11.7])
                add(x,.078,z,.15,.035,4.1,0x88739b,true);
            if(Math.abs(z)<=225){
                for(const x of [-13.15,13.15])
                    add(x,.078,z,.07,.027,6.0,0xd3a2a8,false);
            }
        }
        // Motivos luminosos nos arcos que já existiam. Só acima
        // da pista; nenhuma coluna extra bloqueia a direção.
        for(const [i,z] of [-120,-40,110].entries()){
            const color=[0xffb45d,0x39dbe6,0xed75cb][i];
            for(const x of [-13.6,13.6]){
                add(x,11.2,z,.29,7.0,.29,color,true);
                add(x,15.1,z,.55,.23,.55,0xffd98d,true);
            }
            for(const yy of [16.7,17.5]){
                add(0,yy,z,26.4,.20,.23,color,true);
            }
        }
        // Faixa de pedestres/ingressos visual nos canteiros, apenas
        // marcas rasas. Evita o spawn da garagem e do player.
        for(const z of [-205,-45,195]){
            for(const x of [-23.8,23.8]){
                add(x,.42,z,2.25,.042,19,0x988e92,false);
                add(x,.46,z,1.9,.025,6.7,0xbcb4ab,false);
            }
        }
        return DriverSpecialStructures.pack(city.cityGroup,p,'vegas-strip');
    }

    static buildStreetResorts(city){
        if(!this.isVegas(city))return [];
        const p=[],add=(...v)=>p.push(v);
        // Palmeiras e entradas luminosas nas calçadas laterais da Strip:
        // x≈19 fora da faixa de rolamento (x<=12), sem collider.
        for(let z=-265;z<=265;z+=80){
            for(const side of [-1,1]){
                const x=side*18.5;
                for(const dz of [-12,12]){
                    add(x,2.2,z+dz,.46,4.4,.46,0x7a5d48,false);
                    add(x,4.52,z+dz,3.7,.35,2.35,0x317d5b,false);
                    add(x,4.65,z+dz,2.3,.26,3.8,0x478861,false);
                    add(x,4.83,z+dz,3.1,.20,1.45,0x306f55,false);
                }
                add(x,2.0,z,.26,4.0,.26,0x625767,false);
                add(x,4.12,z,.73,.27,.73,0xffce80,true);
            }
        }
        return DriverSpecialStructures.pack(city.cityGroup,p,
            'vegas-strip-streets');
    }

    static buildDesert(city){
        if(!this.isVegas(city))return [];
        // Montanhas baixas e mesas do Mojave fora de +/-410.
        const peaks=[
            [-486,-355,76,84],[-519,-160,95,105],[-470,90,62,69],
            [-515,312,87,90],[470,-330,94,91],
            [497,-90,63,77],[506,215,99,105],
            [-280,480,70,88],[110,490,65,78]
        ];
        const d=new THREE.Object3D(),meshes=[];
        for(const [color,scale] of [[0x66546a,1],[0x96736e,.65]]){
            const mesh=new THREE.InstancedMesh(
                new THREE.ConeGeometry(1,1,6),
                new THREE.MeshLambertMaterial({color}),peaks.length);
            for(const [i,[x,z,h,w]] of peaks.entries()){
                d.position.set(x+(scale===1?0:8),h*scale/2,z-8);
                d.rotation.set(0,0,0);
                d.scale.set(w*scale,h*scale,w*.64*scale);
                d.updateMatrix();
                mesh.setMatrixAt(i,d.matrix);
            }
            mesh.instanceMatrix.needsUpdate=true;
            mesh.frustumCulled=false;
            mesh.castShadow=false;
            mesh.name='vegas-desert-mountains';
            city.cityGroup.add(mesh);meshes.push(mesh);
        }
        return meshes;
    }

    static buildParks(city){
        if(!this.isVegas(city))return [];
        const p=[],add=(...v)=>p.push(v);
        for(const {x,z} of city.vegasParks||[]){
            // Jardins irrigados, floreiras e luzes solares em um único
            // conjunto, preservando o banco e a rota do centro.
            for(const dx of [-16,16]){
                for(const dz of [-16,16]){
                    add(x+dx,.58,z+dz,4.2,.24,4.2,0xc5ac82,false);
                    add(x+dx,.81,z+dz,3.6,.23,3.6,0x3b8064,false);
                    add(x+dx,1.00,z+dz,2.8,.15,2.8,0x46956a,false);
                }
                add(x+dx,1.55,z+8,.27,2.5,.27,0x6b6063,false);
                add(x+dx,2.83,z+8,.8,.25,.8,0xe1c27a,true);
            }
            for(const dz of [-11,11])
                add(x,.5,z+dz,33,.05,1.1,0xd0b08d,false);
        }
        return DriverSpecialStructures.pack(city.cityGroup,p,
            'vegas-resort-gardens');
    }

    static detailLandmark(city,cx,cz){
        if(!this.isVegas(city))return [];
        const west=cx<0,parts=[],add=(...v)=>parts.push(v);
        const baseH=west?43:34;
        // O cassino/hotel já está construído; adicionar entrada,
        // marquises e topo sem deslocar a porta nem a praça.
        add(cx,4.8,cz+15.6,30,.55,2.1,0x37334b,false);
        for(const yy of [3.45,6.04])
            add(cx,yy,cz+16.75,29,.20,.22,
                west?0xf354bb:0x36d9e2,true);
        for(const dx of [-13,13]){
            add(cx+dx,baseH*.52,cz+15.1,.34,baseH-.8,.28,
                west?0xff8ad3:0x7ad8e6,true);
        }
        for(let y=11;y<baseH-3;y+=4.9){
            for(const dx of [-9,-3,3,9]){
                add(cx+dx,y,cz+14.86,3.4,2.6,.24,0x48637e,false);
                add(cx+dx,y+1.45,cz+15.02,3.8,.19,.3,0xa6b1b7,false);
            }
        }
        const sign=west?'CASINO':'HOTEL';
        // Letras do letreiro original em pixels, em uma única malha.
        add(cx,baseH+7,cz+9,25,8,.5,0x303046,false);
        this.pixelSign(parts,sign,cx,baseH+7,cz+9.35,
            .78,west?0xf773c4:0x51e5f2);
        for(const dz of [-11,11]){
            add(cx,baseH+1.15,cz+dz,30,.68,4.3,
                west?0x71648c:0x647992,false);
            add(cx,baseH+1.59,cz+dz,31,.16,4.4,
                0xeac780,true);
        }
        return DriverSpecialStructures.pack(city.cityGroup,parts,
            west?'vegas-casino-landmark':'vegas-hotel-landmark');
    }

    static buildAttractions(city){
        if(!this.isVegas(city))return [];
        const pieces=[],add=(...args)=>pieces.push(args);
        // Silhueta inspirada na torre de observação STRAT, além
        // de x=-410; não obstrui a avenida nem a IA de tráfego.
        const tx=-438,tz=-175;
        add(tx,51,tz,4.8,102,4.8,0x858194,false);
        for(const y of [18,41,65,89])
            add(tx,y,tz,7.2,.48,7.2,0x5f6178,false);
        add(tx,103.8,tz,13,4.2,13,0x7e8297,false);
        add(tx,107.1,tz,20,2.1,20,0xbbb1ae,false);
        add(tx,109,tz,15,.6,15,0xe5b875,true);
        add(tx,113.2,tz,15,7.6,15,0x5b5479,false);
        add(tx,117.2,tz,19,.6,19,0xb2a9bb,false);
        add(tx,123,tz,.8,11,.8,0xb3c1c7,false);
        add(tx,129,tz,1.4,.9,1.4,0xedc47b,true);

        // High Roller estilizado: um anel de um único mesh, 20 cabines
        // instanciadas, estrutura afastada da área dirigível.
        const cx=432,cz=146,cy=66,rad=25;
        add(cx,25,cz,3.5,50,3.5,0x687d8e,false);
        add(cx,48,cz-14,.7,25,.7,0x8390a3,false);
        add(cx,48,cz+14,.7,25,.7,0x8390a3,false);
        add(cx,66,cz,4.8,4.8,4.8,0xdfd6c2,false);
        for(let i=0;i<20;i++){
            const a=i*Math.PI/10;
            const z=cz+Math.cos(a)*rad,y=cy+Math.sin(a)*rad;
            add(cx,y,z,3.3,2.5,2.7,0x8295a8,false);
            add(cx-1.85,y,z,.17,1.7,1.55,
                i%2?0xffcb80:0x76d3ec,true);
        }
        const results=DriverSpecialStructures.pack(city.cityGroup,pieces,
            'vegas-iconic-attractions');
        const wheel=new THREE.Mesh(
            new THREE.TorusGeometry(rad,1.1,6,40),
            new THREE.MeshLambertMaterial({color:0xc7cad6}));
        wheel.rotation.y=Math.PI/2;
        wheel.position.set(cx,cy,cz);
        wheel.name='vegas-high-roller-outline';
        wheel.castShadow=false;
        city.cityGroup.add(wheel);
        results.push(wheel);

        // Pirâmide estilizada em um setor do horizonte sul,
        // sem mover o terreno/colisão. Modelo autoral geométrico.
        const pyramid=new THREE.Mesh(
            new THREE.ConeGeometry(35,64,4),
            new THREE.MeshLambertMaterial({color:0x454455}));
        pyramid.position.set(195,32,446);
        pyramid.rotation.y=Math.PI/4;
        pyramid.castShadow=false;
        pyramid.name='vegas-pyramid-backdrop';
        city.cityGroup.add(pyramid);
        results.push(pyramid);
        return results;
    }

    static buildCity(city){
        if(!this.isVegas(city))return;
        this.buildStrip(city);
        this.buildStreetResorts(city);
        this.buildDesert(city);
        this.buildParks(city);
        this.buildAttractions(city);
        city.vegasOverhaulStats={
            version:2,
            districts:'strip/downtown/resort/residential',
            parks:(city.vegasParks||[]).length,
            neonSigns:true,strip:true,desert:true,
            addedColliders:0,externalAssets:0,pointLights:0
        };
    }
}
