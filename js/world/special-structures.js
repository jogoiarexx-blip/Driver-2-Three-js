/**
 * Driver 2 — estruturas especiais, edição 2026.
 * Decoração sem colisores: todos os volumes de física e zonas de missão
 * continuam sob responsabilidade do CityBuilder.
 * Duas malhas instanciadas por estrutura (metal/concreto e luz/vidro).
 */
class DriverSpecialStructures {
    static palette(city) {
        return ({
            chicago:{steel:0x48596c,trim:0xa9b9c9,glass:0x6d93ad,light:0xfce6a3,roof:0x343e50,accent:0x9a3a36},
            havana:{steel:0x936b56,trim:0xffe5b5,glass:0x83bac0,light:0xffe6b4,roof:0x9b4d3e,accent:0x379f8c},
            vegas:{steel:0x34334f,trim:0xb8b6d5,glass:0x446080,light:0x22d3ee,roof:0x25243e,accent:0xe879f9},
            rio:{steel:0x56737c,trim:0xe4e9e8,glass:0x7eb7cc,light:0xffdfa2,roof:0x667d83,accent:0x159b82}
        })[city]||{steel:0x475569,trim:0xe2e8f0,glass:0x6d93ad,light:0xffe6a3,roof:0x334155,accent:0x10b981};
    }
    static pack(parent,parts,name) {
        if(!parent||!parts.length)return [];
        const batches=[[],[]];
        for(const part of parts) {
            const [x,y,z,w,h,d,color,glow]=part;
            if([x,y,z,w,h,d].every(Number.isFinite)&&w>0&&h>0&&d>0)
                batches[glow?1:0].push(part);
        }
        // Borda conservadora de TODAS as instâncias no espaço local do pai.
        // Three.js r128 não calcula a esfera de InstancedMesh automaticamente:
        // com bbox do cubo unitário, o frustum culling ocultaria detalhes visíveis.
        const all=batches[0].concat(batches[1]);
        const mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];
        for(const [x,y,z,w,h,d] of all){
            const lo=[x-w/2,y-h/2,z-d/2],hi=[x+w/2,y+h/2,z+d/2];
            for(let k=0;k<3;k++){
                mins[k]=Math.min(mins[k],lo[k]);
                maxs[k]=Math.max(maxs[k],hi[k]);
            }
        }
        const useBounds=typeof THREE.Sphere==='function' &&
            typeof THREE.Vector3==='function' && all.length>0;
        const geometry=new THREE.BoxGeometry(1,1,1),meshes=[];
        if(useBounds){
            const center=new THREE.Vector3(
                (mins[0]+maxs[0])/2,(mins[1]+maxs[1])/2,
                (mins[2]+maxs[2])/2
            );
            const radius=Math.hypot(maxs[0]-mins[0],maxs[1]-mins[1],
                maxs[2]-mins[2])/2+1;
            geometry.boundingSphere=new THREE.Sphere(center,radius);
        }
        for(let channel=0;channel<2;channel++){
            const entries=batches[channel];
            if(!entries.length)continue;
            const material=channel?
                new THREE.MeshBasicMaterial({color:0xffffff}):
                new THREE.MeshLambertMaterial({color:0xffffff});
            const mesh=new THREE.InstancedMesh(geometry,material,entries.length);
            const d=new THREE.Object3D(),colors=new Map();
            entries.forEach((part,i)=>{
                const [x,y,z,w,h,depth,color]=part;
                d.position.set(x,y,z);d.rotation.set(0,0,0);
                d.scale.set(w,h,depth);d.updateMatrix();
                mesh.setMatrixAt(i,d.matrix);
                if(!colors.has(color))colors.set(color,new THREE.Color(color));
                mesh.setColorAt(i,colors.get(color));
            });
            mesh.instanceMatrix.needsUpdate=true;
            if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
            mesh.name=name+(channel?'-lighting':'-structure');
            // Correto também para interiores distantes e folhas móveis da
            // ponte: uma esfera local acompanha a matriz de cada pai.
            mesh.frustumCulled=useBounds;
            mesh.castShadow=false;mesh.receiveShadow=false;
            mesh.userData.specialStructure=true;
            parent.add(mesh);meshes.push(mesh);
        }
        return meshes;
    }
    static bridge(city) {
        const t=this.palette(city.preset.id);
        const leaves=[
            {group:city.bridgeSouthLeaf,sign:1},
            {group:city.bridgeNorthLeaf,sign:-1}
        ];
        for(const {group,sign} of leaves){
            if(!group)return;
            const p=[],add=(x,y,z,w,h,d,c,lit=false)=>p.push([x,y,z,w,h,d,c,lit]);
            // Referência local: pivô z=0 e tabuleiro de z=0 até 16.
            // Os detalhes acompanham a abertura da folha.
            for(let i=1;i<=7;i++){
                const z=sign*i*2;
                add(0,-.38,z,19,.14,.24,t.steel);
                // Faixas embutidas no tabuleiro, nenhuma parede na pista.
                add(-.2,.268,z,13,.025,.055,t.trim);
            }
            for(const s of [-1,1]){
                const x=s*10.55;
                add(x,2.45,sign*8,.19,.25,15.4,t.trim);
                add(x,3.15,sign*8,.24,.25,15.4,t.steel);
                for(let i=1;i<=4;i++){
                    const z=sign*(1.5+i*3);
                    add(x,2.7,z,.28,1.8,.25,t.steel);
                }
                add(x,1.1,sign*.9,1.0,2.4,1.4,t.roof);
                add(x,2.75,sign*15.4,.62,.38,.4,t.accent,true);
            }
            // Junta de dilatação na ponta, sem obstrução sólida para carros.
            add(0,.272,sign*15.55,18.6,.025,.11,t.roof);
            this.pack(group,p,'bridge-leaf');
        }
        // Pilares e painéis laterais no apoio, fora da largura da via.
        const anchor=[];
        for(const z of [33,67])for(const x of [-13.6,13.6]){
            anchor.push([x,1.7,z,1.2,3.4,1.6,t.steel,false]);
            anchor.push([x,3.45,z,1.5,.35,1.9,t.trim,false]);
            anchor.push([x,3.83,z,.7,.22,.18,t.light,true]);
        }
        this.pack(city.cityGroup,anchor,'bridge-abutments');
    }
    static safeHouse(city,cx,cz){
        const t=this.palette(city.preset.id),p=[];
        const x=cx-9,z=cz+8;
        // Detalhes internos da garagem integrada; a cobertura é a casa.
        for(const offset of [-3.8,3.8])
            p.push([x+offset,4.45,z, .21,.30,13.3,t.trim,false]);
        for(const dz of [-5.5,0,5.5])
            p.push([x,4.5,z+dz,7.5,.25,.24,t.roof,false]);
        for(const offset of [-3.8,3.8]){
            p.push([x+offset,.245,z, .18,.025,7,t.trim,false]);
            p.push([x+offset,4.75,z+7.17,.45,.35,.26,t.light,true]);
        }
        p.push([x,4.9,z+7.4,4.5,.25,.15,t.accent,true]);
        p.push([x,3.18,z-6.7,5,.55,.18,t.steel,false]);
        this.pack(city.cityGroup,p,'home-garage');
    }
    static secretGarage(city,cx,cz){
        const t=this.palette(city.preset.id),p=[];
        // Cimalha, sapatas e reforços na face externa dos três muros.
        for(const s of [-1,1]){
            p.push([cx+s*17,9.1,cz,.7,.48,36,t.trim,false]);
            p.push([cx+s*17,2,cz,2.2,4.0,.45,t.roof,false]);
            p.push([cx+s*14.6,9.4,cz-17,2.5,.85,1.5,t.trim,false]);
            p.push([cx+s*16.9,6.4,cz-16.4,.2,4.3,.2,t.light,true]);
        }
        p.push([cx,9.2,cz+17,36,.45,1.8,t.trim,false]);
        p.push([cx,9.45,cz-17,32,.45,2,t.steel,false]); // acima do vão
        // Pavimento e guia central achatados, não bloqueiam passagem.
        for(const s of [-1,1])
            p.push([cx+s*6,.09,cz-7,.15,.03,17,t.trim,false]);
        // Entrada, placa e interruptor permanecem nas posições antigas.
        p.push([cx,9.83,cz-17.9,10,.55,.2,t.accent,true]);
        this.pack(city.cityGroup,p,'secret-garage');
        if(city.secretGateMesh){
            // Acrescentar ripas AO portão móvel. As posições são locais.
            const gate=[];
            for(let x=-15;x<=15;x+=1.5)
                gate.push([x,0,-.93,.12,7.6,.12,t.trim,false]);
            for(const y of [-3.45,3.45])
                gate.push([0,y,-.94,30.8,.2,.14,t.steel,false]);
            for(const x of [-11.25,-3.75,3.75,11.25])
                gate.push([x,0,-1.01,1.8,.24,.12,t.accent,true]);
            this.pack(city.secretGateMesh,gate,'secret-moving-gate');
        }
    }
    static warehouse(city,cx,cz){
        const t=this.palette(city.preset.id),p=[];
        // Galpão: telhado serrilhado, contraventamentos e claraboias.
        for(const z of [-13,-6,1,8,14]){
            p.push([cx,15.35,cz+z,34.8,.45,.42,t.roof,false]);
            p.push([cx,15.63,cz+z,12,.04,.12,t.glass,true]);
        }
        for(const side of [-1,1]){
            const x=cx+side*17.12;
            for(let z=-12;z<=12;z+=6)
                p.push([x,7.5,cz+z,.3,14.7,.45,t.trim,false]);
            // Tubulações elevadas nas laterais, não atravessam a rota.
            p.push([cx+side*15.3,13.8,cz,.35,.45,31,t.steel,false]);
            // Vitrines altas e ripas no frontal: corredor central intacto.
            for(const k of [8,13]){
                p.push([cx+side*k,9.5,cz+16.62,3.3,2.5,.18,t.glass,true]);
                p.push([cx+side*k,11,cz+16.85,4,.26,.25,t.trim,false]);
            }
        }
        // Trama visual na porta existente, sem mudar seu gatilho.
        for(const x of [-2.3,2.3])
            p.push([cx+x,2.7,cz+17.14,.16,5.5,.2,t.trim,false]);
        p.push([cx,5.7,cz+17.2,5.3,.3,.32,t.accent,false]);
        // Vaga de carga indicada no piso, sem acrescentar collider.
        for(const x of [-7,7])
            p.push([cx+x,.225,cz+30,.16,.025,16,t.light,true]);
        this.pack(city.cityGroup,p,'warehouse-exterior');
    }
    static store(city,cx,cz,id) {
        const t=this.palette(city.preset.id),diner=id==='diner',p=[];
        for(const side of [-1,1]){
            const x=cx+side*12;
            p.push([x,4.25,cz+15.38,8,.24,.38,t.trim,false]);
            for(const dx of [-3.75,3.75])
                p.push([x+dx,2.65,cz+15.45,.2,3.3,.3,t.steel,false]);
            p.push([x,1.08,cz+15.45,7.9,.2,.3,t.roof,false]);
            p.push([cx+side*17.9,6.2,cz,.6,12,.7,t.trim,false]);
        }
        p.push([cx,12.4,cz,36.6,.7,30.8,t.roof,false]);
        if(diner){
            // Diner americano: linha de neon sob marquise e vitrine.
            p.push([cx,4.5,cz+17.6,34,.22,.28,t.accent,true]);
            for(let x=-15;x<=15;x+=5)
                p.push([cx+x,9.4,cz+15.83,.3,1.7,.17,t.light,true]);
            p.push([cx,3.8,cz+16.8,4.8,.25,.4,t.steel,false]);
        }else{
            // Oficina: painéis ondulados, trilhos de portão e caixa luminosa.
            for(let y=2;y<=9;y+=.85)
                p.push([cx+10.5,y,cz+15.22,10.7,.14,.2,t.steel,false]);
            p.push([cx-8,6.2,cz+17.2,12,1,.25,t.accent,true]);
            for(const x of [-15.7,-5.3])
                p.push([cx+x,5.4,cz+15.28,.24,9.8,.2,t.trim,false]);
        }
        // Não cobrir o portal funcional x=centro.
        this.pack(city.cityGroup,p,'store-'+id);
    }
    static interior(city,place) {
        const t=this.palette(city.preset.id),x=place.inside.x,z=place.inside.z;
        const p=[],home=place.id==='home';
        // Iluminação e sancas nas paredes, fora do trajeto central.
        for(const side of [-1,1]){
            p.push([x+side*11.3,5.7,z, .35,.24,20,t.trim,false]);
            for(const dz of [-6,0,6])
                p.push([x+side*10.9,3.7,z+dz,.15,1.45,2.6,
                    home?t.accent:t.glass,true]);
        }
        for(const dz of [-6.5,0,6.5]){
            p.push([x,6.15,z+dz,9.2,.12,.32,t.trim,false]);
            p.push([x,6.03,z+dz,3.2,.14,.36,t.light,true]);
        }
        // O corredor central e o spawn do jogador (x,z-6) ficam livres.
        if(home){
            // Piso, quadros, estante e luminárias de mesa.
            p.push([x,.032,z,21.7,.035,19.7,0x9c8066,false]);
            for(const side of [-1,1]){
                p.push([x+side*9.3,2.4,z+4,.35,3.4,3.3,0x74543a,false]);
                p.push([x+side*9.1,2.6,z+4,.4,1.8,1.8,t.glass,true]);
            }
            p.push([x,1.75,z+4,2.3,.16,1.1,t.light,true]);
        }else if(place.kind==='warehouse'){
            for(const side of [-1,1]){
                // Estantes fixadas nas paredes e caixas, longe do centro.
                for(const y of [1.2,2.7,4.2])
                    p.push([x+side*9.2,y,z+2.7,3.5,.26,11,t.steel,false]);
                for(const dz of [-2,3,7])
                    p.push([x+side*9.3,3.8,z+dz,2.5,1.6,2.2,t.roof,false]);
            }
            p.push([x,5.5,z+10.4,12,1,.15,t.accent,false]);
        }else if(place.kind==='diner'){
            p.push([x,2.75,z+4.7,14,.2,.42,t.light,true]);
            for(const side of [-1,1]){
                p.push([x+side*10.9,2.8,z, .24,3,8,t.accent,false]);
                for(const dz of [-3,1.5,6])
                    p.push([x+side*10.7,3,z+dz,.12,1.4,2,t.glass,true]);
            }
        }else{
            // Oficina: bancadas laterais, elevador simbólico e painéis.
            for(const side of [-1,1]){
                p.push([x+side*9.8,1.8,z+2.7,2.1,.2,9,t.steel,false]);
                p.push([x+side*9.7,3.4,z+3, .2,2.6,5,t.accent,false]);
            }
            for(const dz of [0,5])
                p.push([x+7.3,3.8,z+dz,1.0,.25,.7,t.light,true]);
        }
        this.pack(city.cityGroup,p,'interior-'+place.id);
    }
    static station(city,cx,cz) {
        const t=this.palette(city.preset.id),p=[];
        const buildingX=cx-8,buildingZ=cz-3;
        for(const dx of [-8.5,-4,1,5.5]){
            p.push([buildingX+dx,7.5,buildingZ+12.65,2.4,2.6,.25,t.glass,true]);
            p.push([buildingX+dx,9,buildingZ+12.8,2.8,.2,.31,t.trim,false]);
        }
        p.push([buildingX,14.5,buildingZ,23.2,.6,29.4,t.roof,false]);
        p.push([buildingX,11.1,buildingZ+12.65,17,.5,.6,t.trim,false]);
        this.pack(city.cityGroup,p,'chicago-station');
    }
    static caineCompound(city) {
        const t=this.palette(city.preset.id),p=[];
        // Ripas laterais do contêiner e sinalização que não altera o pátio.
        for(const x of [183,217]){
            for(let z=-245;z<=-237;z+=1.65)
                p.push([x+(x<200?-3.13:3.13),2,z,.15,3.3,.16,t.trim,false]);
            p.push([x,4.18,-241,6.5,.4,13.4,t.roof,false]);
        }
        for(const z of [-241,-230]){
            p.push([200,5.2,z,40,.37,.5,t.trim,false]);
        }
        p.push([200,6.2,-183,10,.3,.42,t.accent,true]);
        this.pack(city.cityGroup,p,'caine-compound');
    }
}
