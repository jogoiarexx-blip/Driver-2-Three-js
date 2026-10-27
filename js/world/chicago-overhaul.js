/**
 * Chicago 2.0 — bairros, Riverwalk, estrutura do 'L', parques e silhuetas.
 * Camada exclusivamente visual, sem alterar física, colisores, missões
 * ou o caminho móvel da ponte levadiça. Three.js r128, sem assets remotos.
 *
 * Tudo usa DriverSpecialStructures.pack: até duas draw calls por área/LOD.
 * Edifícios distantes continuam usando o LOD original; detalhes só são
 * gerados quando o setor se aproxima do jogador.
 */
class DriverChicagoOverhaul {
    static isChicago(city) {
        return city?.preset?.id==='chicago';
    }

    static districtKind(x,z) {
        // Núcleo vertical próximo ao eixo do 'L', bairros de tijolos
        // no oeste e armazéns perto da margem industrial.
        const d=Math.hypot(x-35,z+100);
        if(d<175 && x<155)return 'loop';
        if(x>=155 || z>=115 || (z<=-195 && x>=75))return 'industrial';
        return 'brick';
    }

    static detailDistrict(city,buildings,parent) {
        if(!this.isChicago(city)||!buildings?.length)return [];
        const P=[],add=(x,y,z,w,h,d,c,light=false)=>{
            if([x,y,z,w,h,d].every(Number.isFinite)&&
                w>0&&h>0&&d>0)P.push([x,y,z,w,h,d,c,light]);
        };
        for(const b of buildings){
            const x=b.x,z=b.z,h=b.height,roof=h+.5;
            const kind=this.districtKind(x,z);
            // Mantém ornamentos dentro do recuo viário (edifício ±19.2 m).
            if(kind==='loop'){
                // Faixas de granito e aço, pórticos verticais e coroas
                // no estilo dos edifícios comerciais do Chicago Loop.
                for(const dx of [-15.9,-8,0,8,15.9])
                    add(x+dx,h*.50,z+19.51,.22,h-.9,.38,0xb1b6b5);
                for(const y of [5.4,9.8,Math.min(h-1.2,16.0)]){
                    if(y>=h-1)continue;
                    add(x,y,z+19.6,34,.22,.4,0x879aab);
                }
                add(x,roof+.9,z-2,29,1.0,29,0x424e60);
                for(const dx of [-12,12]){
                    add(x+dx,roof+2.0,z-9,3.0,1.6,3.0,0x556377);
                    add(x+dx,roof+3.5,z-9,.6,1.8,.6,0xd5c8ae);
                }
                if(h>76){
                    // Duas antenas de aço no topo da torre, sem colisão.
                    for(const dx of [-7,7]){
                        add(x+dx,roof+5.8,z-3,.42,8,.42,0x9caab7);
                        add(x+dx,roof+9.55,z-3,1,.7,1,0xf7d4a0,true);
                    }
                }
            }else if(kind==='industrial'){
                // Tijolos gastos, portões de carga, tubos e chaminés.
                add(x,h*.50,z+19.45,35,.4,.25,0x6b3c35);
                for(const dx of [-10,0,10]){
                    add(x+dx,3.2,z+19.49,7,5.7,.25,0x3d5262);
                    for(const dy of [1.3,2.2,3.1,4.0,4.9])
                        add(x+dx,dy,z+19.67,6.5,.09,.12,0x9faab5);
                    add(x+dx,6.4,z+19.62,8.3,.55,.4,0x7f493b);
                }
                add(x-11,roof+2.5,z-9,4,4,4,0x7c4b43);
                add(x-11,roof+4.8,z-9,4.8,.3,4.8,0xaca59a);
                for(const dx of [8,14]){
                    add(x+dx,roof+2.1,z-11,2.2,3.7,2.2,0x50545d);
                    add(x+dx,roof+4.05,z-11,2.5,.24,2.5,0x977464);
                }
            }else{
                // Fachadas de tijolo do oeste: entradas, lintéis de pedra,
                // varanda compacta e tanque d'água no terraço.
                add(x,4.7,z+19.49,33,.48,.6,0xa18b7d);
                for(const dx of [-13.5,-4.5,4.5,13.5]){
                    add(x+dx,h*.50,z+19.42,.35,h-.9,.37,0x845644);
                    add(x+dx,7.2,z+19.61,6.0,.3,.44,0xbdaba0);
                }
                for(const y of [9.0,17.5,26.0]){
                    if(y>=h-2.5)continue;
                    add(x+12.0,y,z+20.1,7.0,.25,1.3,0x525e69);
                    add(x+12.0,y+.85,z+20.78,7.0,.16,.15,0x909eab);
                    for(const dx of [-3.15,3.15])
                        add(x+12+dx,y+.75,z+20.75,.17,1.6,.18,0x525e69);
                }
                add(x-9,roof+1.65,z-10,5,2.7,5,0x815d4a);
                add(x-9,roof+3.10,z-10,5.5,.25,5.5,0xa8a39b);
            }
            // Térreo em escala humana: molduras, vitrines e sinalização.
            add(x-1.5,3.5,z+19.55,34,.3,.43,
                kind==='industrial'?0x6f534b:0x6e7b8d);
            for(const dx of [-15,-9,9,15]){
                add(x+dx,2.1,z+19.49,3.8,2.5,.16,
                    kind==='brick'?0x92aaba:0x6d91a7,true);
            }
            // Evita sinalizadores soltos que confundem com itens de missão.
        }
        // Janelas autoiluminadas já são desenhadas pelo UrbanDistricts:
        // mesclar este reforço arquitetônico em UM só lote Lambert por
        // chunk corta as draw calls do reforço pela metade sem perder LOD.
        P.forEach(part=>{part[7]=false;});
        return DriverSpecialStructures.pack(parent,P,'chicago-district');
    }

    static buildRiverfront(city) {
        if(!this.isChicago(city))return [];
        const parts=[],push=(...p)=>parts.push(p);
        // Margens ao longo do canal físico em z=34..66. Vãos onde
        // a ponte e acessos passam ficam sem guarda-corpo extra.
        for(let x=-280;x<=280;x+=80){
            for(const z of [32.75,67.25]){
                push(x,.18,z,35,.13,2.65,0x64748b,false); // pedras da margem
                push(x,1.24,z,35,.15,.20,0x9ba7ae,false);
                push(x,.50,z,35,.19,.35,0x4b5563,false);
                for(const dx of [-16,-8,0,8,16]){
                    push(x+dx,.98,z,.18,1.95,.22,0x526071,false);
                    push(x+dx,2.05,z,.45,.18,.4,0xe5c994,true);
                }
                // Calçamento de pedra em faixas planas, sem escadas
                // que impeçam a passagem de Tanner.
                for(const dx of [-12,0,12])
                    push(x+dx,.13,z+(z<50?-2.2:2.2),10,.055,.22,
                        0xa6a6a1,false);
            }
        }
        // Cabeceiras da ponte, pilares e marcas de aviso ficam fora do
        // leito dirigível x ±11.2 e não adicionam colisores.
        for(const z of [32.5,67.5]){
            for(const x of [-13.5,13.5]){
                push(x,2.6,z,1.4,5.2,1.4,0x576777,false);
                push(x,5.35,z,1.8,.38,1.8,0xd3a65b,false);
                push(x,5.58,z,.7,.36,.35,0xfde68a,true);
            }
        }
        return DriverSpecialStructures.pack(city.cityGroup,parts,'chicago-riverwalk');
    }

    static buildRail(city) {
        if(!this.isChicago(city))return [];
        const parts=[],push=(...p)=>parts.push(p);
        // As estruturas originais deixam altura livre > 7m para
        // circulação dos carros. Detalhes ficam acima, sem collider novo.
        for(const x of [-3.55,3.55]){
            push(x,10.74,0,.38,.66,562,0x605a55,false);
            push(x,11.14,0,.16,.13,562,0xa38c73,false);
        }
        for(let z=-271;z<=270;z+=32){
            // Travessas e diagonais do viaduto. Não tocar o trilho nem
            // a rampa da estação perto de z=-231.
            push(0,9.12,z,7.2,.35,.52,0x6b7278,false);
            for(const x of [-3.5,3.5]){
                push(x,8.65,z,.28,3.0,.28,0x616b76,false);
                push(x,10.25,z+2,.37,.19,4,0x9b6c4b,false);
            }
            for(const dx of [-1.8,1.8])
                push(dx,9.5,z+4,.28,1.1,.25,0x777f85,false);
        }
        // Reforços sob as duas pistas ao longo do centro urbano.
        for(let z=-260;z<=260;z+=12){
            for(const x of [-2.95,2.95]){
                push(x,10.38,z,.30,.2,1.4,0x414b55,false);
                push(x,10.58,z,.36,.19,.18,0xb6aa98,false);
            }
        }
        return DriverSpecialStructures.pack(city.cityGroup,parts,'chicago-elevated-steel');
    }

    static detailLandmark(city,cx,cz) {
        if(!this.isChicago(city))return [];
        const west=cx<0,parts=[];
        const add=(...p)=>parts.push(p);
        if(west) {
            // Estádio inspirado em Wrigley: arquibancada ao redor do
            // gramado, vigas de fachada e placar verde com iluminação.
            for(const s of [-1,1]){
                for(let row=0;row<4;row++){
                    const z=cz+s*(15.6+row*1.18);
                    add(cx,1.65+row*.80,z,29,.33,1.12,
                        row%2?0x7f8b91:0x6a7983,false);
                }
                for(const x of [-17,17]){
                    add(cx+x,9,cz+s*18.5,.6,3,.7,0x4b5563,false);
                    add(cx+x,10.6,cz+s*18.5,1.1,.28,.85,0xe5c991,true);
                }
            }
            for(let x=-17;x<=17;x+=4){
                add(cx+x,7.4,cz-18.8,.35,2.4,.35,0xb4bbc0,false);
            }
            add(cx,10.1,cz-19.1,16.8,5.5,.7,0x135f40,false);
            add(cx,11.5,cz-19.52,12,.45,.1,0xfef3c7,true);
            add(cx,9.2,cz-19.52,12,.32,.1,0xe5c991,true);
        } else {
            // Píer industrial: caixotes, guindastes baixos, trilhos de
            // carga e janelas para quebrar os antigos blocos genéricos.
            for(const x of [cx-13,cx,cx+13]) {
                for(const y of [3,5.0]) {
                    add(x,y,cz+7.78,7.5,.14,.26,0x8998a6,false);
                }
                for(const dx of [-4,4]){
                    add(x+dx,3.6,cz-7.4,.24,6.4,.45,0x4f5865,false);
                }
                add(x,7.10,cz,11,.4,17,0x57606a,false);
            }
            for(const x of [cx-18,cx+18]){
                add(x,5.3,cz-11,.65,10,.65,0x717b86,false);
                add(x,10.35,cz-8,1.0,.6,7,0xa1adb5,false);
                add(x,6.35,cz-4.8,.35,7,.35,0x6a7280,false);
                add(x,10.2,cz-4.1,.9,.5,.9,0xf1c86d,true);
            }
            for(const x of [cx-8,cx+8]){
                add(x,.72,cz+13,5.4,1.0,3.2,0x8f6651,false);
                add(x,1.34,cz+13,5.8,.24,3.6,0xaab4bc,false);
            }
        }
        return DriverSpecialStructures.pack(city.cityGroup,parts,
            west?'chicago-wrigley-field':'chicago-industrial-pier');
    }

    static buildParks(city) {
        if(!this.isChicago(city))return [];
        const parks=city.chicagoParks||[],parts=[];
        const add=(...p)=>parts.push(p);
        // Nunca adicionar obstáculos no centro dos parques: o banco
        // existente usa a mesma área e pode ser acionado por Tanner.
        for(const {x,z} of parks){
            for(const s of [-1,1]){
                // Caminho baixo e calçada interna de parque (topo grama .42).
                add(x+s*18,.455,z,2.5,.065,32,0xb4b3a7,false);
                add(x,.455,z+s*18,32,.065,2.5,0xb4b3a7,false);
                for(const d of [-17,17]){
                    add(x+d,.69,z+s*19,3.2,.48,1.2,0x686459,false);
                    add(x+d,1.15,z+s*19,2.4,.4,.75,0x406448,false);
                }
            }
            for(const dx of [-17,17]){
                add(x+dx,1.15,z+8,.22,1.85,.22,0x424f5d,false);
                add(x+dx,2.13,z+8,.65,.24,.65,0xf5d7a0,true);
            }
        }
        return DriverSpecialStructures.pack(city.cityGroup,parts,'chicago-park-paths');
    }

    static detailTrain(train) {
        if(!train?.group)return [];
        const parts=[],add=(...x)=>parts.push(x);
        // Acabamento no trem da missão: carros articulados,
        // guarnições, portas, linha vermelha e caixas no telhado.
        // Coordenadas locais: seguem o grupo animado do trem, sem
        // mudar sua rota, velocidade ou detecção de plataforma.
        for(let car=0;car<3;car++){
            const z=car*11.9;
            for(const side of [-1,1]){
                const x=side*1.72;
                add(x,1.55,z-0.2,.10,1.35,2.05,0x6e7a88,false);
                for(const dz of [-1.12,.72]){
                    add(x+side*.055,2.2,z+dz,.10,2.6,.13,
                        0xdde5e7,false);
                }
                add(x+side*.055,3.45,z-.2,.12,.16,2.3,
                    0xb3c4cc,false);
                add(x+side*.08,1.23,z,.14,.2,10.2,0x973f42,false);
                for(const dz of [-4.75,4.75])
                    add(x+side*.1,2.6,z+dz,.20,.18,.19,
                        0xf7e7b7,true);
            }
            for(const dz of [-3.2,0,3.2]){
                add(0,4.55,z+dz,1.55,.22,1.3,0x556575,false);
                add(0,4.71,z+dz,.95,.10,.9,0x9aa9b6,false);
            }
            // Cabos e engates entre os vagões.
            if(car<2){
                add(0,1.0,z+5.9,.75,.42,1.75,0x444b55,false);
                add(0,2.0,z+5.8,2.8,.14,.20,0x303946,false);
            }
        }
        return DriverSpecialStructures.pack(train.group,parts,
            'chicago-el-train');
    }

    static buildCity(city) {
        if(!this.isChicago(city))return;
        this.buildRiverfront(city);
        this.buildRail(city);
        this.buildParks(city);
        city.chicagoOverhaulStats={
            version:2,districts:'loop/brick/industrial',
            parks:(city.chicagoParks||[]).length,
            riverSegments:16,railSupports:17,
            addedColliders:0
        };
    }
}
