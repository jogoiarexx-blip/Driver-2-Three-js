/**
 * Havana 2.0 — Habana Vieja, Centro Habana, Vedado, Malecón e porto.
 *
 * Somente camada visual. O canal, as missões, os colliders, os
 * spawns, os semáforos e as travessias preservam sua lógica.
 * Lotes próximos são carregados pelo DriverDistrictLOD existente.
 * Three.js r128, sem requisições externas e sem luzes dinâmicas.
 */
class DriverHavanaOverhaul {
    static isHavana(city){return city?.preset?.id==='havana';}

    // A grade do game é uma interpretação jogável da capital, não
    // reproduz coordenadas geográficas de seus bairros reais.
    static districtKind(x,z){
        if(x>=160 || (z>=115&&x>=-80))return 'puerto';
        if(x<=-150)return 'vieja';
        if(z<=-155)return 'vedado';
        return 'centro';
    }

    static detailDistrict(city,buildings,parent){
        if(!this.isHavana(city)||!buildings?.length)return [];
        const parts=[],add=(x,y,z,w,h,d,color)=>{
            if([x,y,z,w,h,d].every(Number.isFinite)&&
                w>0&&h>0&&d>0)parts.push([x,y,z,w,h,d,color,false]);
        };
        for(const b of buildings){
            const {x,z}=b,h=b.height,roof=h+.35;
            const kind=this.districtKind(x,z);
            // A fachada original usa ±19.2. Um balanço de até 1.1 m
            // fica sobre a própria calçada, fora da pista ±12.
            const front=z+19.40;
            const shade=UrbanDistricts.random(x,z,81);
            if(kind==='vieja'){
                // Arcadas espanholas: pilares e frisos na fachada frontal.
                // Os arcos são sugestões visuais, sem bloqueio funcional.
                for(const dx of [-14,-7,0,7,14]){
                    add(x+dx,2.8,front+.13,.7,5.5,.65,0xe7cb9e);
                    add(x+dx,5.65,front+.25,1.45,.38,.78,0xb9a17d);
                }
                for(const dx of [-10.5,-3.5,3.5,10.5]){
                    add(x+dx,5.62,front+.27,6.8,.38,.82,0xe8d4b5);
                    add(x+dx,4.55,front+.34,5.2,.24,.5,0x9f876e);
                    // Peças de textura/azulejo desbotado nas pilastras.
                    add(x+dx,1.28,front+.52,3.9,.55,.16,0x9abbb7);
                }
                for(let y=8.5;y<h-1.5;y+=7.0){
                    add(x,y,front+.61,26,.26,1.16,0xc9ae87);
                    add(x,y+.71,front+1.19,26,1.16,.16,0x3f5052);
                    for(let dx=-12;dx<=12;dx+=2.4)
                        add(x+dx,y+.72,front+1.19,.11,1.15,.18,0x5a5a51);
                }
                add(x,roof+.75,z,34,.9,34,0x9c684f);
                // Platibanda e venezianas no pavimento baixo.
                for(const dx of [-15,-5,5,15])
                    add(x+dx,7.15,front+.31,3.25,1.15,.20,0x587f82);
            }else if(kind==='centro'){
                // Centro Habana: prédios de estuque e sacadas de ferro,
                // portas altas, marcas de reforma e art déco tardio.
                for(const dx of [-13,-4.5,4.5,13]){
                    add(x+dx,3.15,front+.15,6,4.55,.24,
                        shade>.53?0x71928b:0xa57e62);
                    add(x+dx,5.52,front+.47,6.3,.38,.82,0xe1ceaa);
                }
                for(let y=8.2;y<h-1.6;y+=6.8){
                    add(x,y,front+.64,29,.26,1.3,0xe2c99a);
                    add(x,y+.82,front+1.27,29,1.28,.15,0x4e6162);
                    for(let dx=-14;dx<=14;dx+=2)
                        add(x+dx,y+.76,front+1.24,.10,1.35,.18,0x6c6660);
                }
                for(const dx of [-16.8,16.8])
                    add(x+dx,h*.52,front+.18,.36,h-.5,.44,0xdfbd8c);
                add(x,roof+.75,z,35,.85,33,0x9a7461);
                add(x-12,roof+1.9,z-9,5,2.0,4.5,0x8b6c58);
            }else if(kind==='vedado'){
                // Vedado: fachadas de meados do século XX, marquises,
                // cobogós, brises e apartamentos com sacadas rasas.
                for(let y=7.9;y<h-1.7;y+=6.5){
                    add(x,y,front+.63,32,.25,1.25,0xd7cbb4);
                    add(x,y+.66,front+1.23,32,.97,.17,0x647a76);
                    for(const dx of [-14,-7,0,7,14])
                        add(x+dx,y+.7,front+1.23,.17,1.06,.19,0xa9b4a1);
                }
                for(const dx of [-16.2,16.2])
                    add(x+dx,h*.52,front+.1,.5,h-1,.50,0x9ca7a0);
                add(x,5.52,front+.6,29,.45,1.30,0xb7bea8);
                add(x,roof+.70,z-2,34,.80,30,0xa7a89a);
                for(const dx of [-9,9]){
                    add(x+dx,roof+2.0,z-9,4.3,2.2,4.3,0x7e8b85);
                    add(x+dx,roof+3.18,z-9,4.8,.22,4.8,0xd3d0c2);
                }
            }else{
                // Porto e zona industrial: depósitos antigos,
                // telhas avermelhadas, portões de carga, contraventamento.
                for(const dx of [-12,0,12]){
                    add(x+dx,3.1,front+.2,7.9,5.4,.25,0x657679);
                    for(let y=1;y<5.7;y+=.85)
                        add(x+dx,y,front+.37,7.65,.13,.17,0x9c9989);
                    add(x+dx,5.98,front+.35,8.4,.55,.56,0xc28c69);
                }
                for(const dx of [-16,16])
                    add(x+dx,h*.50,front+.12,.45,h-.7,.46,0x997259);
                add(x,roof+.72,z,35,.70,34,0x9b604d);
                for(const dx of [-8,8]){
                    add(x+dx,roof+1.65,z-9,3.2,2.5,3.2,0x716b62);
                    add(x+dx,roof+3.02,z-9,3.6,.22,3.6,0xc5ae94);
                }
            }
            // Peitoris baixos ajudam a revelar o tamanho das janelas.
            for(const dx of [-12,-4,4,12]){
                add(x+dx,6.15,front+.42,5.2,.18,.45,0xd6c19b);
            }
        }
        // Uma draw call extra por setor; vidro e luz vêm do UrbanDistricts.
        return DriverSpecialStructures.pack(parent,parts,'havana-district');
    }

    static buildMalecon(city){
        if(!this.isHavana(city))return [];
        const parts=[],add=(...p)=>parts.push(p);
        // O canal do jogo (z=34..66) representa a orla estilizada.
        // Guardas e bancos somente junto às bordas existentes, longe do
        // vão da ponte móvel (|x|<14) e das entradas de água ±240.
        for(const z of [32.65,67.35]){
            for(let x=-380;x<=380;x+=20){
                if(Math.abs(x)<28 || (Math.abs(x)>215&&Math.abs(x)<265))
                    continue;
                // Calçada de pedra plana; nenhuma nova parede física.
                add(x,.115,z<50?z-1.4:z+1.4,18,.045,1.05,
                    0xd3bb9d,false);
                add(x,.92,z,.28,1.85,.32,0xc5ad91,false);
                add(x,1.91,z,.42,.19,.4,0x8e8677,false);
                add(x+9.5,1.24,z,18,.15,.20,0xbab5a8,false);
                // A borda continua visualmente permeável nas aberturas.
                if(x%40===0){
                    add(x,2.22,z,.42,.36,.38,0xf4d4a8,false);
                }
            }
        }
        // Padrão de pedras da faixa do cais em trechos afastados da ponte.
        for(const x of [-280,-200,-120,120,200,280]){
            for(const z of [29.7,70.3]){
                add(x,.145,z,32,.035,1.9,0xc5a783,false);
                for(let dx=-12;dx<=12;dx+=8)
                    add(x+dx,.171,z,6,.025,.12,0x8c806f,false);
            }
        }
        return DriverSpecialStructures.pack(city.cityGroup,parts,
            'havana-malecon');
    }

    static buildHarbor(city){
        if(!this.isHavana(city))return [];
        const parts=[],add=(...p)=>parts.push(p);
        // Porto do canal: guindastes decorativos sobre a margem sul
        // z=26, fora de avenidas (z=0 e z=80) e dos marcos do mapa.
        // Nenhum collider ou obstáculo funcional.
        for(const [x,z] of [[-274,26],[274,26]]){
            // Só elementos altos; não esconder veículos na avenida.
            for(const dx of [-8,8]){
                add(x+dx,6.9,z,.52,13.5,.52,0x7d796e,false);
                add(x+dx,13.7,z,1.65,.36,1.65,0xc3a784,false);
            }
            add(x,13.4,z,18,.54,1.25,0x827d72,false);
            add(x+2.1,10.9,z+3.5,.55,5,.55,0x8d8674,false);
            add(x+2.1,8.3,z+4.8,1.1,.45,1.1,0xe0ba71,false);
        }
        // Mar aberto na borda do mapa: só cenário, x<-430, não
        // confundir com a área navegável nem alterar isWaterAt().
        const sea=new THREE.Mesh(
            new THREE.PlaneGeometry(170,760),
            new THREE.MeshBasicMaterial({color:0x227e92,
                transparent:true,opacity:.91,
                depthWrite:false,side:THREE.DoubleSide}));
        sea.rotation.x=-Math.PI/2;
        sea.position.set(-502,.045,0);
        sea.name='havana-sea-backdrop';
        city.cityGroup.add(sea);
        return DriverSpecialStructures.pack(city.cityGroup,parts,
            'havana-harbor-cranes');
    }

    static buildPaseo(city){
        if(!this.isHavana(city))return [];
        const parts=[],add=(...p)=>parts.push(p);
        for(const {x,z} of city.havanaParks||[]){
            // Plaza Vieja/Paseo: mosaicos, canteiros e palmeiras compactas
            // nos cantos, preservando banco e corredor central.
            for(const dx of [-15.5,15.5])for(const dz of [-15.5,15.5]){
                add(x+dx,.50,z+dz,5,.14,5,0xe3c9a4,false);
                add(x+dx,.70,z+dz,4.4,.25,4.4,0x397b4d,false);
                add(x+dx,1.02,z+dz,3.4,.25,3.4,0x518e59,false);
                // Vasos e canteiros no limite do parque, sem obstáculos
                // no centro ou na calçada rodável.
            }
            for(const dz of [-11,11]){
                add(x,.48,z+dz,29,.07,.48,0xefdec0,false);
                for(const dx of [-13,13]){
                    add(x+dx,1.35,z+dz,.23,1.85,.23,0x756c5b,false);
                    add(x+dx,2.34,z+dz,.66,.22,.65,0xf7dba9,false);
                }
            }
            for(const dx of [-10,10])
                add(x+dx,.48,z,1.15,.05,30,0xd4c19d,false);
        }
        return DriverSpecialStructures.pack(city.cityGroup,parts,
            'havana-park-arcades');
    }

    static detailLandmark(city,cx,cz){
        if(!this.isHavana(city))return [];
        const parts=[],add=(...p)=>parts.push(p);
        if(cx<0){
            // Capitólio: frisos, degraus e detalhes dos pórticos.
            // A cúpula e as colunas principais já existem.
            for(const y of [10.9,12.1,13.4]){
                add(cx,y,cz+11.8,34,.30,.85,0xf3dfbd,false);
            }
            for(const dx of [-15,-9,-3,3,9,15]){
                add(cx+dx,8.6,cz+13.78,.4,6.1,.36,0xe7d4b2,false);
                add(cx+dx,11.82,cz+13.9,2.2,.32,.7,0xc7af86,false);
                add(cx+dx,2.4,cz+13.9,2.1,.18,.65,0x9f947d,false);
            }
            for(const z of [-9,-3,3]){
                add(cx,21.4,cz+z,12.8,.34,.28,0xc5b8a1,false);
            }
            add(cx,23.8,cz-2,10.5,.52,10.5,0xd2c7b6,false);
            add(cx,24.7,cz-2,7.2,.35,7.2,0xe1d6c4,false);
            for(let i=0;i<12;i++){
                const angle=i*Math.PI/6;
                const x=cx+7.9*Math.cos(angle);
                const z=cz-2+7.9*Math.sin(angle);
                add(x,24.3,z,.40,1.15,.40,0xbba98d,false);
            }
            // Pequenas luminárias sobre a fachada, sem PointLights.
            for(const dx of [-11,11])
                add(cx+dx,8.4,cz+14.3,.6,.55,.22,0xffd39b,true);
        }else{
            // Praça da Revolução: pedestal, frisos e luminárias.
            for(const y of [.5,1.25,2.1]){
                const s=19-y*1.7;
                add(cx,y,cz,s,.26,s,0xd4c5ad,false);
            }
            for(const dx of [-13,13]){
                add(cx+dx,1.8,cz+10,1.1,3.0,1.1,0xa28f7b,false);
                add(cx+dx,3.4,cz+10,1.35,.38,1.35,0xebd7ba,false);
            }
            for(const dz of [-1.6,1.6]){
                add(cx,19,cz+dz,.8,8,.28,0xc6bdad,false);
            }
            for(const dx of [-14,14]){
                add(cx+dx,1.1,cz-11,3,.80,3,0x6c8c67,false);
            }
        }
        return DriverSpecialStructures.pack(city.cityGroup,parts,
            cx<0?'havana-capitolio':'havana-revolucion');
    }

    static buildCity(city){
        if(!this.isHavana(city))return;
        this.buildMalecon(city);
        this.buildHarbor(city);
        this.buildPaseo(city);
        city.havanaOverhaulStats={
            version:2,
            districts:'vieja/centro/vedado/puerto',
            parks:(city.havanaParks||[]).length,
            addedColliders:0,externalAssets:0,
            malecon:true,harbor:true,
            namedLandmarks:['Capitolio','Plaza de la Revolucion']
        };
    }
}
