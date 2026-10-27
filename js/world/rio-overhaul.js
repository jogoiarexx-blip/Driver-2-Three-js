/**
 * Rio de Janeiro 2.0 — Copacabana, Corcovado, morros, bairros e parques.
 * Geometria decorativa sem colisores. Não muda missões, travessias,
 * garagem, física, nem o canal/ponte que o jogo usa para dirigir.
 * Three.js r128, sem novos downloads/recursos externos.
 */
class DriverRioOverhaul {
    static isRio(city){return city?.preset?.id==='rio';}
    static districtKind(x,z){
        // Litoral leste, centro comercial, bairros residenciais e
        // galerias do oeste. Sem associar identidade social a um bairro.
        if(x>=165)return 'orla';
        if(Math.abs(x)<155&&z<115&&z>-270)return 'centro';
        if(x<=-155)return 'residencial';
        return 'comercio';
    }
    static detailDistrict(city,buildings,parent){
        if(!this.isRio(city)||!buildings?.length)return [];
        const parts=[],add=(x,y,z,w,h,d,color)=>{
            if([x,y,z,w,h,d].every(Number.isFinite)&&w>0&&h>0&&d>0)
                parts.push([x,y,z,w,h,d,color,false]);
        };
        for(const b of buildings){
            const x=b.x,z=b.z,h=b.height,roof=h+.35;
            const kind=this.districtKind(x,z);
            const side=z+19.42;
            if(kind==='orla'){
                // Apartamentos e hotéis da zona sul, com varandas,
                // brises, tetos claros e fachadas de cerâmica.
                for(let y=7.4;y<h-2;y+=5.8){
                    add(x,y,side+.60,30,.24,1.16,0xe7ddc5);
                    add(x,y+.70,side+1.14,30,1.05,.16,0x668b99);
                    for(const dx of [-12,-6,0,6,12])
                        add(x+dx,y+.71,side+1.13,.14,1.05,.18,0xd5e3df);
                }
                for(const dx of [-16.1,16.1])
                    add(x+dx,h*.5,side,.5,h-1,.45,0x7c9da3);
                add(x,roof+.85,z-7,28,1.3,21,0xd9d7c9);
                for(const dx of [-8,7]){
                    add(x+dx,roof+2.2,z-7,4.0,1.7,4.0,0x718990);
                    add(x+dx,roof+3.18,z-7,4.45,.24,4.45,0xe9ece8);
                }
            }else if(kind==='centro'){
                // Centro com frisos, coberturas em degraus e brises.
                for(const dx of [-15,-10,-5,0,5,10,15]){
                    add(x+dx,h*.51,side,.26,h-2,.40,
                        (dx%10===0)?0xd1c5ae:0x7795a2);
                }
                for(const y of [6.1,11.2,16.3]){
                    if(y<h-1.4)add(x,y,side+.08,36,.34,.4,0xb7a48e);
                }
                add(x,roof+.75,z,32,1.05,32,0xaab7b8);
                for(const dx of [-9,9]){
                    add(x+dx,roof+1.75,z-8,5,1.7,4,0x687f8c);
                    add(x+dx,roof+2.77,z-8,5.6,.22,4.5,0xe0ded4);
                }
            }else if(kind==='residencial'){
                // Fachadas menores, varandas, venezianas e telhados
                // terracota. Nenhum obstáculo novo na calçada.
                for(let y=7.0;y<h-2;y+=7.6){
                    add(x,y,side+.54,26,.28,1.16,0xe8c6a0);
                    add(x,y+.68,side+1.09,26,1.0,.12,0x596b74);
                    for(const dx of [-12,-6,0,6,12])
                        add(x+dx,y+.72,side+1.08,.13,1.05,.18,0xe6dfc7);
                }
                for(const dx of [-15,-7,7,15]){
                    add(x+dx,3.0,side+.08,3.1,4.7,.16,0x7f9a9e);
                    add(x+dx,5.7,side+.21,3.6,.22,.33,0xc98460);
                }
                add(x,roof+.87,z,36,.65,34,0x9d7668);
            }else{
                // Lojas e galerias: marquises, portas e toldos coloridos.
                for(const dx of [-13,-4.5,4.5,13]){
                    add(x+dx,3.1,side+.12,6.8,4.1,.19,0x719ca2);
                    add(x+dx,5.4,side+.48,7.2,.52,1.08,
                        dx>0?0xc58b5e:0x429188);
                    add(x+dx,2.0,side+.24,.26,3.7,.34,0xe4d9c4);
                }
                for(let y=10;y<h-2;y+=7){
                    add(x,y,side+.15,35,.26,.52,0xb6b1a4);
                }
                add(x,roof+.78,z-5,30,1.0,26,0x81978a);
            }
            // Fachada comum para pedestres, sem placas de missões falsas.
            add(x,4.9,side+.40,32,.34,.72,0xc5b4a0);
        }
        // Apenas um lote por setor LOD próximo. Janelas emissivas e
        // texturas básicas continuam sob responsabilidade de UrbanDistricts.
        return DriverSpecialStructures.pack(parent,parts,'rio-district');
    }
    static buildOcean(city){
        if(!this.isRio(city))return [];
        // A praia original é x=381..417. Água cênica exclusivamente
        // FORA do limite rodável (x>=420), sem mudança em isWaterAt().
        const mat=new THREE.MeshBasicMaterial({
            color:0x087eaa,side:THREE.DoubleSide,
            depthWrite:false,transparent:true,opacity:.92
        });
        const ocean=new THREE.Mesh(new THREE.PlaneGeometry(175,835),mat);
        ocean.rotation.x=-Math.PI/2;
        ocean.position.set(506,.052,0);
        ocean.name='rio-ocean-backdrop';
        city.cityGroup.add(ocean);
        const parts=[],add=(...p)=>parts.push(p);
        // Cristas rasas de espuma; nunca deixam a faixa de areia.
        for(let z=-376;z<=376;z+=12){
            const shift=Math.sin(z*.023)*1.35;
            for(const x of [417.6,427.4,446]){
                add(x+shift,.093,z,1.0,.026,8.5,
                    x<420?0xe6faf2:0x77d1d8,false);
            }
        }
        return DriverSpecialStructures.pack(city.cityGroup,parts,
            'rio-sea-foam');
    }
    static buildCopacabana(city){
        if(!this.isRio(city))return [];
        const parts=[],add=(...p)=>parts.push(p);
        // Mosaico preto e branco inspirado no calçadão de Burle Marx.
        // Sobrepõe a areia já existente, sem levantar uma barreira.
        add(387.0,.093,0,11,.03,788,0xe4ddd0,false);
        add(381.8,.113,0,.3,.025,788,0x435d60,false);
        add(392.3,.113,0,.26,.025,788,0x435d60,false);
        for(let z=-385;z<=385;z+=3.6){
            const offset=2.3*Math.sin(z*.053);
            add(387.0+offset,.123,z,3.6,.028,3.35,0x343d44,false);
            // Segunda onda defasada, dentro do passeio de 11m.
            add(387.0-2.3*Math.sin(z*.053+.95),.127,z,1.1,.025,3.1,
                0x81908c,false);
        }
        // Quiosques, guarda-sóis e mobiliário baixo somente na areia
        // x>=398; não invadem rotas dos blocos centrais.
        const roofs=[0x12a39b,0xf0c969,0x3379a3,0xd55d55];
        for(let z=-332,i=0;z<=334;z+=92,i++){
            const x=402+(i%2)*4;
            add(x,1.15,z,6.3,2.2,4.7,0xdec7a6,false);
            add(x,2.50,z,7.2,.43,5.5,roofs[i%roofs.length],false);
            add(x,2.95,z,5.4,.35,3.7,0xf8e8bb,false);
            add(x,1.2,z+5.5,4.2,.20,1.3,0xa97850,false);
            for(const dx of [-2.1,2.1])
                add(x+dx,.7,z+5.5,.18,1.2,.25,0x7b6656,false);
            // Sombra visual em areia, sem collider.
            add(x,.111,z+8.5,5,.025,4.5,0xdecbb0,false);
            add(x,2.2,z+8.5,.22,4.2,.22,0x8b7056,false);
            add(x,4.1,z+8.5,5.6,.23,5.6,roofs[(i+2)%roofs.length],false);
        }
        // Palmeiras na faixa livre entre quiosques.
        for(let z=-366,i=0;z<=367;z+=31,i++){
            if(Math.abs(z)<30)continue;
            const x=397.7+((i%3)-1)*1.25;
            add(x,2.2,z,.55,4.4,.55,0x806448,false);
            add(x,4.52,z,4.6,.38,3.2,0x2d8f50,false);
            add(x,4.66,z,3.1,.34,5.0,0x3e9b51,false);
            add(x,4.78,z,4.0,.24,1.75,0x206d42,false);
        }
        return DriverSpecialStructures.pack(city.cityGroup,parts,
            'rio-copacabana-promenade');
    }
    static buildMountains(city){
        if(!this.isRio(city))return [];
        // Morros além da borda jogável (x<-410), usados como horizonte.
        // A baixa contagem de cones evita cenas pesadas em mobile.
        const positions=[
            [-474,-302,88,72],[-508,-170,108,88],[-451,-45,68,59],
            [-499,87,126,84],[-460,223,81,69],[-493,346,98,72],
            [-160,-487,82,66],[135,-492,91,71],[-300,-478,74,63]
        ];
        const near=new THREE.InstancedMesh(
            new THREE.ConeGeometry(1,1,9),
            new THREE.MeshLambertMaterial({color:0x285d45}),
            positions.length);
        const ridges=new THREE.InstancedMesh(
            new THREE.ConeGeometry(1,1,7),
            new THREE.MeshLambertMaterial({color:0x457760}),
            positions.length);
        const d=new THREE.Object3D();
        for(let i=0;i<positions.length;i++){
            const [x,z,h,r]=positions[i];
            d.position.set(x,h/2,z);
            d.scale.set(r,h,r);
            d.rotation.set(0,0,0);
            d.updateMatrix();
            near.setMatrixAt(i,d.matrix);
            d.position.set(x+8,h*.64,z-7);
            d.scale.set(r*.44,h*.56,r*.45);
            d.updateMatrix();
            ridges.setMatrixAt(i,d.matrix);
        }
        for(const mesh of [near,ridges]){
            mesh.instanceMatrix.needsUpdate=true;
            mesh.frustumCulled=false;
            mesh.castShadow=false;
            mesh.receiveShadow=false;
            mesh.name='rio-mountains-backdrop';
            city.cityGroup.add(mesh);
        }
        // Pão de Açúcar estilizado em primeiro plano distante;
        // não é uma reprodução topográfica do local real.
        const sugar=new THREE.Mesh(
            new THREE.ConeGeometry(43,112,11),
            new THREE.MeshLambertMaterial({color:0x7c8b75}));
        sugar.position.set(-455,56,-244);
        sugar.name='rio-sugarloaf-silhouette';
        city.cityGroup.add(sugar);
        return [near,ridges,sugar];
    }
    static buildCorcovadoDetails(city){
        if(!this.isRio(city))return [];
        const parts=[],add=(...p)=>parts.push(p);
        const z=-395;
        // Plataforma do mirante sobre o morro existente. A estátua
        // original permanece, com base, manto e braços mais definidos.
        for(const [w,y,h,color] of [
            [22,77.4,.7,0x888d84],[17,78.1,.48,0xc9c6b9],
            [12,78.8,.55,0xa9a99f],[7.3,83.15,.4,0xd3d3cc]
        ])add(0,y,z,w,h,w,color,false);
        for(const x of [-10.5,10.5])for(const dz of [-10.5,10.5]){
            add(x,78.8,z+dz,.65,1.75,.65,0xc2bdad,false);
            add(x,79.72,z+dz,1.1,.22,1.1,0xf5f0e2,false);
        }
        // Manto e mangas criam uma silhueta mais legível ao longe.
        for(const dx of [-2.9,2.9]){
            add(dx,87.5,z+.4,1.1,9.7,3.0,0xdde4df,false);
            add(dx*2.1,95,z+.05,6,.85,2.85,0xe9ece9,false);
        }
        add(0,92.6,z+1.73,2.9,12.8,.36,0xd3d8d4,false);
        add(0,102.7,z+1.4,3.3,1.45,.34,0xf4f4ee,false);
        add(0,103.7,z-.25,2.1,.24,1.65,0xf4f3ed,false);
        add(0,79.85,z+5,7,.16,.8,0xf1e7c8,false);
        // Arvoredo distante sobre a encosta, sem bloquear jogabilidade.
        for(let i=0;i<28;i++){
            const angle=i*2.39996,r=20+(i%5)*5.7;
            const x=Math.cos(angle)*r, dz=Math.sin(angle)*r;
            const y=78*(1-r/55);
            add(x,y+1.5,z+dz,.35,3,.36,0x7e6048,false);
            add(x,y+3.75,z+dz,3.0,2.6,2.7,0x25643f,false);
        }
        return DriverSpecialStructures.pack(city.cityGroup,parts,
            'rio-corcovado-statue');
    }
    static buildParks(city){
        if(!this.isRio(city))return [];
        const parts=[],add=(...p)=>parts.push(p);
        for(const {x,z} of city.rioParks||[]){
            // Bancos e pisos já existem: somente floreiras e mosaicos
            // nos cantos, não cobrir o acesso central.
            for(const dx of [-15,15])for(const dz of [-15,15]){
                add(x+dx,.51,z+dz,4.2,.16,4.2,0xe4d7b9,false);
                add(x+dx,.75,z+dz,3.7,.42,3.7,0x2d7f4b,false);
                add(x+dx,1.1,z+dz,2.2,.26,2.2,0x489858,false);
            }
            for(const dz of [-10,10]){
                add(x,.49,z+dz,21,.07,.42,0xf6e6c9,false);
                add(x,.50,z+dz+1,21,.06,.2,0x70857b,false);
            }
        }
        return DriverSpecialStructures.pack(city.cityGroup,parts,
            'rio-park-mosaic');
    }
    static detailLandmark(city,cx,cz){
        if(!this.isRio(city))return [];
        const parts=[],add=(...p)=>parts.push(p);
        if(cx<0){
            // Praça da zona sul: mosaico, floreiras, bancos e canteiro.
            for(let x=-17;x<=17;x+=3.5){
                add(cx+x,.65,cz+14,1.65,.07,2.1,
                    (Math.round(x)%2===0)?0x333f44:0xe3d9b9,false);
            }
            for(const dz of [-13,13]){
                add(cx,.69,cz+dz,33,.12,1.0,0xf3e6ca,false);
                for(const dx of [-12,12]){
                    add(cx+dx,1.1,cz+dz,5,.85,2.4,0x807b66,false);
                    add(cx+dx,1.7,cz+dz,4.5,.28,2,0x3d8756,false);
                }
            }
        }else{
            // Mercado carioca: painéis, boxes e toldos em sequência.
            const awnings=[0x148a86,0xe6b866,0xc6534d,0x2679a4];
            for(const [i,dx] of [-11,-3.7,3.7,11].entries()){
                add(cx+dx,5.15,cz+12,6,.38,2.1,
                    awnings[i],false);
                add(cx+dx,5.45,cz+12.9,6.1,.2,.7,
                    0xe6ddc7,false);
                for(const ix of [-2.4,2.4])
                    add(cx+dx+ix,2.4,cz+11.7,.19,4.2,.32,
                        0x697c7b,false);
            }
            add(cx,8.9,cz,36,.45,24,0x9d6350,false);
            add(cx,9.2,cz+12,27,.35,.6,0xf0ca77,false);
        }
        return DriverSpecialStructures.pack(city.cityGroup,parts,
            'rio-landmark');
    }
    static buildCity(city){
        if(!this.isRio(city))return;
        this.buildOcean(city);
        this.buildCopacabana(city);
        this.buildMountains(city);
        this.buildCorcovadoDetails(city);
        this.buildParks(city);
        city.rioOverhaulStats={
            version:2,skyline:'orla/centro/residencial/comercio',
            parkCount:(city.rioParks||[]).length,
            addedColliders:0,backdropSea:true,corcovado:true,
            downloadAssets:0
        };
    }
}
