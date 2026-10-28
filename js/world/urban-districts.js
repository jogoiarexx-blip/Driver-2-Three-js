/**
 * Variações arquitetônicas por cidade. Apenas três lotes instanciados
 * para decorar todos os edifícios, mantendo baixo custo em aparelhos móveis.
 */
class UrbanDistricts {
    static random(x, z, salt=0) {
        let n = Math.imul((x|0) + salt * 1171, 73856093) ^ Math.imul(z|0, 19349663);
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    }
    static height(city, x, z) {
        const r = this.random(x,z,3);
        // Centro de Chicago reconhecível: torres altas no Loop,
        // fábricas mais baixas na periferia; a navegação 2D não muda.
        // Curva contínua evita saltos bruscos entre quarteirões.
        const loop=Math.max(0,1-Math.hypot(x-35,z+100)/245);
        return city === 'chicago' ?
            18+r*29 + loop*(28+63*r) :
            city === 'havana' ? (
                x<=-150 ? 12+r*15 :      // Habana Vieja: arquitetura baixa
                z<=-155 && x<155 ? 20+r*30 : // Vedado: edifícios médios
                x>=160 ? 13+r*18 :      // Porto: armazéns e quadras baixas
                12+r*18                  // Centro Habana
            ) :
            city === 'vegas' ? (
                // Hotéis altos nos quarteirões da Strip x=±40/120;
                // Fremont de escala média e resorts menores na borda.
                Math.abs(x)<=125&&z>=-235&&z<=245 ?
                    32+r*45+12*Math.max(0,1-Math.abs(z)/280) :
                z<=-155 ? 19+r*30 :
                x>=155 ? 24+r*34 : 14+r*20
            ) :
            city === 'rio' ?
                // Faixa de prédios mais altos na Zona Sul, centro com
                // variação média e bairros baixos na periferia.
                (x>=155 ? 25+r*32+10*Math.max(0,1-Math.abs(z)/340) :
                    Math.abs(x)<155 ? 20+r*38 : 14+r*25) :
                16+r*32;
    }
    // Perfis de fachadas do jogo PS1: Wrigley/Downtown, Habana Vieja,
    // Strip e fachadas sombreadas da orla. Não altera vias nem colisores.
    static profile(id){
        const map={
            chicago:{style:'steel-piers',color:0x94a3b8,secondary:0x475569,
                front:[.75,16,.55],accent:[23,.75,1.3]},
            havana:{style:'colonial-balconies',color:0xe7d4ba,
                secondary:0x64748b,front:[10,.42,2.15],
                accent:[10,.9,.18]},
            vegas:{style:'casino-neon',color:0x38bdf8,
                secondary:0xf472b6,front:[3,13,.45],
                accent:[18,.6,2.0]},
            rio:{style:'coastal-brise',color:0xe2e8f0,
                secondary:0x0f766e,front:[20,.3,1.4],
                accent:[19,1.0,.28]}
        };
        return map[id]||map.chicago;
    }

    static addRegionalFacades(builder,buildings,parent) {
        if(!buildings.length)return;
        const id=builder.preset.id,profile=this.profile(id);
        // Só nos setores LOD próximos: 2 draw calls em instancing para
        // todos os prédios do setor, sem colocar modelos na rua.
        const make=(dims,color)=>new THREE.InstancedMesh(
            new THREE.BoxGeometry(...dims),
            new THREE.MeshLambertMaterial({color:0xffffff}),
            buildings.length);
        const front=make(profile.front,profile.color);
        const accent=make(profile.accent,profile.secondary);
        const dummy=new THREE.Object3D();
        for(const [i,b] of buildings.entries()){
            const phase=this.random(b.x,b.z,14);
            const hue1=new THREE.Color(profile.color);
            const hue2=new THREE.Color(profile.secondary);
            let frontX=b.x+12,frontY=6,frontZ=b.z+19.5;
            let accentX=b.x,accentY=8,accentZ=b.z+20;
            if(id==='chicago'){
                frontX=b.x+(phase>.5?13:-13);
                frontY=b.height*.47;
                frontZ=b.z+19.45;
                accentY=Math.min(b.height-.8,14);
            }else if(id==='havana'){
                frontX=b.x+(phase>.5?8:-8);
                frontY=6;
                frontZ=b.z+20.25;
                accentX=frontX;accentY=6.75;accentZ=b.z+21.2;
            }else if(id==='vegas'){
                frontX=b.x+(phase>.5?12:-12);
                frontY=Math.min(b.height*.5,18);
                frontZ=b.z+19.55;
                accentY=4.7;accentZ=b.z+21.0;
            }else{
                frontX=b.x;
                frontY=7+(Math.floor(phase*4)*3);
                frontZ=b.z+19.6;
                accentY=frontY+2.4;
                accentZ=b.z+19.5;
            }
            dummy.rotation.set(0,0,0);
            dummy.scale.set(1,id==='chicago'?
                Math.max(.6,b.height/36):1,1);
            dummy.position.set(frontX,frontY,frontZ);
            dummy.updateMatrix();
            front.setMatrixAt(i,dummy.matrix);
            dummy.scale.set(1,1,1);
            dummy.position.set(accentX,accentY,accentZ);
            dummy.updateMatrix();
            accent.setMatrixAt(i,dummy.matrix);
            front.setColorAt(i,hue1);
            accent.setColorAt(i,hue2);
        }
        for(const mesh of [front,accent]){
            mesh.instanceMatrix.needsUpdate=true;
            if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
            // Culling conservador do setor: nenhuma fachada some quando
            // a câmera gira; fora da câmera, reduz draw calls reais.
            if(typeof DriverDistrictVisibility!=='undefined')
                DriverDistrictVisibility.cull(mesh,buildings,18);
            else mesh.frustumCulled=false;
            mesh.userData.regionalStyle=profile.style;
            parent.add(mesh);
        }
    }
    static decorate(builder, buildings=builder.districtBuildings,
        parent=builder.cityGroup) {
        if (!buildings.length) return;
        const id = builder.preset.id;
        const palettes = {
            chicago:[0x64748b,0x334155,0x94a3b8,0x475569],
            havana:[0xfda4af,0xfb923c,0x5eead4,0xfde68a],
            vegas:[0x22d3ee,0xf472b6,0xc084fc,0xfacc15],
            rio:[0x38bdf8,0x34d399,0xfde047,0xfb7185]
        };
        const count=buildings.length;
        const roofs=new THREE.InstancedMesh(
            new THREE.BoxGeometry(38.4,0.75,38.4),
            new THREE.MeshLambertMaterial({color:0xffffff}),count);
        const signs=new THREE.InstancedMesh(
            new THREE.BoxGeometry(28,1.3,0.65),
            new THREE.MeshBasicMaterial({color:0xffffff}),count);
        const ornaments=new THREE.InstancedMesh(
            id==='chicago' ? new THREE.CylinderGeometry(2.3,2.3,2.4,8) :
                new THREE.BoxGeometry(3.3,1.4,3.3),
            new THREE.MeshLambertMaterial({color:0xffffff}),count);
        const obj=new THREE.Object3D();
        buildings.forEach((b,i)=>{
            const color=new THREE.Color(palettes[id][Math.floor(this.random(b.x,b.z,7)*4)]);
            obj.position.set(b.x,b.height+0.55,b.z);obj.scale.set(1,1,1);
            obj.rotation.set(0,0,0);obj.updateMatrix();roofs.setMatrixAt(i,obj.matrix);
            roofs.setColorAt(i,new THREE.Color(id==='havana'?0xe2e8f0:0x64748b));

            // Letreiros/cornijas nos comércios, afastados da pista.
            obj.position.set(b.x,id==='vegas'?8:4.8,b.z+19.25);
            obj.scale.set(0.8+this.random(b.x,b.z,2)*0.18,1,1);
            obj.updateMatrix();signs.setMatrixAt(i,obj.matrix);signs.setColorAt(i,color);

            // Caixas d'água, pequenos terraços e topos iluminados.
            obj.position.set(b.x+7,b.height+1.8,b.z-5);
            obj.scale.set(1,id==='vegas'?2.3:1,1);
            obj.updateMatrix();ornaments.setMatrixAt(i,obj.matrix);
            ornaments.setColorAt(i,color);
        });
        [roofs,signs,ornaments].forEach(mesh=>{
            mesh.instanceMatrix.needsUpdate=true;
            if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
            // Culling conservador do setor: nenhuma fachada some quando
            // a câmera gira; fora da câmera, reduz draw calls reais.
            if(typeof DriverDistrictVisibility!=='undefined')
                DriverDistrictVisibility.cull(mesh,buildings,18);
            else mesh.frustumCulled=false;
            parent.add(mesh);
        });
        this.addRegionalFacades(builder,buildings,parent);
        this.addArchitecture(builder,buildings,parent);
    }

    // Detalhes volumétricos por cidade; instâncias agrupadas em apenas duas malhas por chunk.
    // Não altera vias, volumes de colisão, interiores nem posições das missões.
    static addArchitecture(builder,buildings,parent) {
        if(!buildings.length)return;
        const city=builder.preset.id,solid=[],glowing=[];
        const theme={
            chicago:[0x64748b,0x334155,0x96a5b5,0x8ca6b8,0xffdda1],
            havana:[0xffe1bc,0x8c5e48,0xeebc8c,0x63929d,0xffe6ae],
            vegas:[0xa1a1aa,0x27213c,0xeeeeff,0x395877,0x22d3ee],
            rio:[0xe2e8f0,0x557885,0xadc1bb,0x6caec0,0xffe8a1]
        }[city]||[0x64748b,0x334155,0xa1a1aa,0x94a3b8,0xffdda1];
        const [trim,dark,edge,glass,light]=theme;
        const push=(glow,x,y,z,w,h,d,color)=>{
            if([x,y,z,w,h,d].every(Number.isFinite)&&w>0&&h>0&&d>0)
                (glow?glowing:solid).push({x,y,z,w,h,d,color});
        };
        for(const b of buildings){
            const h=Math.max(10,b.height),roof=h+.35;
            const rand=(n)=>this.random(b.x,b.z,n);
            const stories=Math.min(14,Math.max(2,Math.floor((h-2)/4.25)));
            const floorGap=(h-3.8)/stories;
            const front=19.18;
            // Embasamento e cornijas em quatro faces, não invadindo as vias.
            for(const s of [-1,1]){
                push(false,b.x,.9,b.z+s*19.12,38.1,.85,.42,dark);
                push(false,b.x,roof+.15,b.z+s*19.12,38.7,.53,.7,trim);
                push(false,b.x+s*19.12,.9,b.z,.42,.85,38.1,dark);
                push(false,b.x+s*19.12,roof+.15,b.z,.7,.53,38.7,trim);
            }
            for(let floor=0;floor<stories;floor++){
                const y=3.05+floor*floorGap;
                if(y+1.3>roof-.5)continue;
                for(let side=0;side<4;side++){
                    const frontBack=side<2,sign=side%2===0?1:-1;
                    for(let col=0;col<4;col++){
                        const offset=(col-1.5)*8.15;
                        const x=frontBack?b.x+offset:b.x+sign*front;
                        const z=frontBack?b.z+sign*front:b.z+offset;
                        const lit=rand(60+floor*17+col*3+side)>.81;
                        push(true,x,y,z,frontBack?3.1:.14,1.85,
                            frontBack?.14:3.1,lit?light:glass);
                        push(false,x,y+1.04,z,frontBack?3.55:.27,.18,
                            frontBack?.27:3.55,edge);
                        push(false,x,y-1.02,z,frontBack?3.65:.34,.16,
                            frontBack?.34:3.65,dark);
                        if(city==='havana'){
                            push(false,x+(frontBack?1.65:0),y,
                                z+(!frontBack?1.65:0),
                                frontBack?.16:.25,2.05,
                                frontBack?.25:.16,trim);
                        }
                    }
                }
                if(floor>0&&floor%3===0){
                    push(false,b.x,y-1.6,b.z+19.16,38.4,.22,.7,trim);
                    push(false,b.x,y-1.6,b.z-19.16,38.4,.22,.7,trim);
                }
            }
            // Porta, vitrine e marquise são decorativas: entradas jogáveis
            // usam edifícios especializados construídos pelo CityBuilder.
            const doorX=b.x+(rand(19)>.5?9:-9);
            push(false,doorX,2,b.z+19.23,3.4,3.8,.35,dark);
            push(true,doorX,2.1,b.z+19.48,2.4,2.5,.1,glass);
            push(false,b.x,4.75,b.z+19.5,24,.45,1.25,trim);
            if(city==='chicago'){
                // Estrutura de aço, escape de incêndio e equipamento de cobertura.
                for(const x of [-15,-7,7,15])
                    push(false,b.x+x,h/2+.35,b.z+19.25,.38,h,.52,dark);
                for(let y=8;y<roof-3;y+=8.5){
                    push(false,b.x+12.5,y,b.z+20,7,.25,1.5,trim);
                    push(false,b.x+12.5,y+.7,b.z+20.8,7,1.25,.14,dark);
                    for(const dx of [-3.1,3.1])
                        push(false,b.x+12.5+dx,y+1.1,b.z+20.5,.14,2.3,.14,edge);
                }
                push(false,b.x-10,roof+1.0,b.z-9,7,1.7,6,dark);
            } else if(city==='havana'){
                // Sacadas e platibandas coloniais com venezianas.
                for(let y=7;y<roof-1.6;y+=8.5){
                    push(false,b.x,y,b.z+19.93,23,.3,1.95,trim);
                    push(false,b.x,y+.82,b.z+20.92,23,1.2,.15,dark);
                    for(let x=-10;x<=10;x+=2.5)
                        push(false,b.x+x,y+.8,b.z+20.91,.12,1.3,.16,edge);
                }
                for(let x=-16;x<=16;x+=8)
                    push(false,b.x+x,h/2+.35,b.z+19.24,.48,h,.56,edge);
                for(let x=-16;x<=16;x+=5.33)
                    push(false,b.x+x,roof+1.12,b.z+17.6,1.2,1.5,2.5,trim);
            } else if(city==='vegas'){
                // Cassinos: frisos e marquise de neon, sem luzes dinâmicas.
                const neon=[0x22d3ee,0xf472b6,0xfacc15,0x4ade80]
                    [Math.floor(rand(27)*4)];
                for(const x of [-17.1,17.1])
                    push(true,b.x+x,h/2+.35,b.z+19.36,.4,h-1.6,.48,neon);
                push(false,b.x,6.1,b.z+20.07,27,2.8,2.1,dark);
                push(true,b.x,7.5,b.z+21.22,27.6,.3,.21,neon);
                push(true,b.x,4.75,b.z+21.22,27.6,.3,.21,neon);
                for(let x=-12;x<=12;x+=4)
                    push(true,b.x+x,6.2,b.z+21.23,.3,1.45,.19,neon);
                push(true,b.x,roof+1.15,b.z+19.4,23,.65,.55,neon);
                push(false,b.x-10,roof+1,b.z-9,9,1.6,7,dark);
            } else {
                // Rio: varandas, brises verticais e caixas d'água no terraço.
                for(let y=7.4;y<roof-1.6;y+=8.5){
                    push(false,b.x,y,b.z+19.9,25,.3,1.65,trim);
                    push(false,b.x,y+.75,b.z+20.74,25,1.2,.15,dark);
                    for(let x=-12;x<=12;x+=3)
                        push(false,b.x+x,y+.72,b.z+20.73,.13,1.25,.19,edge);
                }
                for(let x=-15;x<=15;x+=6)
                    push(false,b.x+x,h/2+.35,b.z+19.34,.3,h-2,.75,edge);
                push(false,b.x-9,roof+1.22,b.z-9,5,2,4.5,dark);
                push(false,b.x-9,roof+2.4,b.z-9,5.5,.28,5,trim);
            }
            // Platibanda da cobertura em quatro lados.
            for(const s of [-1,1]){
                push(false,b.x,roof+.47,b.z+s*18.7,37.6,.75,.44,trim);
                push(false,b.x+s*18.7,roof+.47,b.z,.44,.75,37.6,trim);
            }
        }
        // Uma draw call para os elementos sólidos e outra para vidro/neon.
        const geometry=new THREE.BoxGeometry(1,1,1);
        const cache=new Map(),colorOf=hex=>{
            if(!cache.has(hex))cache.set(hex,new THREE.Color(hex));
            return cache.get(hex);
        };
        const mount=(parts,glow)=>{
            if(!parts.length)return;
            const material=glow?
                new THREE.MeshBasicMaterial({color:0xffffff}):
                new THREE.MeshLambertMaterial({color:0xffffff});
            const mesh=new THREE.InstancedMesh(geometry,material,parts.length);
            const dummy=new THREE.Object3D();
            for(let i=0;i<parts.length;i++){
                const p=parts[i];
                dummy.position.set(p.x,p.y,p.z);
                dummy.rotation.set(0,0,0);
                dummy.scale.set(p.w,p.h,p.d);
                dummy.updateMatrix();
                mesh.setMatrixAt(i,dummy.matrix);
                mesh.setColorAt(i,colorOf(p.color));
            }
            mesh.instanceMatrix.needsUpdate=true;
            if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
            // Culling conservador do setor: nenhuma fachada some quando
            // a câmera gira; fora da câmera, reduz draw calls reais.
            if(typeof DriverDistrictVisibility!=='undefined')
                DriverDistrictVisibility.cull(mesh,buildings,18);
            else mesh.frustumCulled=false;
            mesh.castShadow=false;
            mesh.receiveShadow=false;
            mesh.name='regional-architecture-'+city+(glow?'-windows':'-solid');
            mesh.userData.architecture=true;
            parent.add(mesh);
        };
        mount(solid,false);mount(glowing,true);
    }
}
