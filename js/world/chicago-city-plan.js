/** Chicago R14 — parcelamento determinista para a cidade inteira.
 * Referência: organização dos bairros PS1 e 54 setores fornecidos.
 * Limites adaptados ao clone; ruas de 80 e percursos de campanha ainda são
 * compatibilidade temporária. Não confundir cobertura de bairros com
 * certificação geométrica das ruas da ROM.
 */
class DriverChicagoCityPlan {
    static DISTRICTS=[
        {id:'wrigleyville',name:'WRIGLEYVILLE',kind:'residential',x:-280,z:200,color:0x67e8f9},
        {id:'lincoln-park',name:'LINCOLN PARK',kind:'park',x:280,z:236,color:0x86efac},
        {id:'wicker-park',name:'WICKER PARK',kind:'residential',x:-280,z:120,color:0xf0abfc},
        {id:'ukrainian-village',name:'UKRAINIAN VILLAGE',kind:'residential',x:-280,z:-120,color:0xc4b5fd},
        {id:'goose-island',name:'GOOSE ISLAND',kind:'industrial',x:-200,z:200,color:0x94a3b8},
        {id:'gold-coast',name:'GOLD COAST',kind:'apartment',x:200,z:120,color:0xfde68a},
        {id:'navy-pier',name:'NAVY PIER',kind:'pier',x:353,z:-40,color:0x38bdf8},
        {id:'downtown',name:'DOWNTOWN / LOOP',kind:'tower',x:64,z:-65,color:0xfbbf24},
        {id:'greektown',name:'GREEKTOWN',kind:'commercial',x:-120,z:-120,color:0xf9a8d4},
        {id:'grant-park',name:'GRANT PARK',kind:'park',x:280,z:-120,color:0x4ade80},
        {id:'chinatown',name:'CHINATOWN',kind:'commercial',x:-115,z:-275,color:0xfb7185},
        {id:'prairie-ave',name:'PRAIRIE AVE',kind:'residential',x:145,z:-228,color:0xa5b4fc},
        {id:'meigs-field',name:'MEIGS FIELD',kind:'airfield',x:334,z:-290,color:0xfda4af}
    ];
    static AIRFIELD={x:342,z:-294,width:14,length:132};
    static buildLandmarks(city){
        if(city?.preset?.id!=='chicago'||city.chicagoAirfield)return;
        const a=this.AIRFIELD,parts=[
            [a.x,.065,a.z,a.width,.12,a.length,0x4c5154,false],
            [331,.066,-240,24,.12,10,0x4c5154,false],
            [331,.066,-320,24,.12,10,0x4c5154,false],
            [320,.066,-337,10,.12,34,0x4c5154,false],
            [308,.066,-350,24,.12,9,0x4c5154,false],
            [296,4,-350,14,8,14,0x78838a,false],
            [296,8.2,-350,15,.4,15,0xa6adb0,false]
        ];
        for(let z=a.z-a.length/2+8;z<a.z+a.length/2-6;z+=12)
            parts.push([a.x,.133,z,.4,.016,5,0xe1ded3,false]);
        for(const z of [a.z-a.length/2+5,a.z+a.length/2-5])
            for(const dx of [-4,-2,2,4])
                parts.push([a.x+dx,.133,z,.6,.016,4,0xe1ded3,false]);
        if(typeof DriverSpecialStructures!=='undefined')
            DriverSpecialStructures.pack(city.cityGroup,parts,'chicago-r14-meigs-airfield');
        city.buildingBoxes.push({minX:289,maxX:303,minZ:-357,maxZ:-343,
            chicagoPlanHangar:true});
        city.chicagoAirfield={...a,accesses:[{x:320,z:-240},{x:320,z:-320}],
            originalGeometryCertified:false};
    }
    static districtAt(x,z){
        let id;
        if(x>=326&&z>=-78&&z<=12)id='navy-pier';
        else if(x>=240&&z<=-240)id='meigs-field';
        else if(x>=240&&z>=80)id='lincoln-park';
        else if(x>=240&&z<=-60)id='grant-park';
        else if(x>=150&&z>0)id='gold-coast';
        else if(x<-240&&z>=160)id='wrigleyville';
        else if(x>=-240&&x<=-160&&z>=80)id='goose-island';
        else if(x<-160&&z>=0)id='wicker-park';
        else if(x<-180&&z>-220)id='ukrainian-village';
        else if(x<-80&&z>=-220&&z<0)id='greektown';
        else if(z<-220&&x<80)id='chinatown';
        else if(z<-180&&x>=80)id='prairie-ave';
        else id='downtown';
        return this.DISTRICTS.find(d=>d.id===id);
    }
    static isProtected(x,z){
        return [[-120,-120],[120,120],[200,-200],[-200,-200],
            [120,-280],[-280,200],[-40,-280],[280,-280],[-280,-280]]
            .some(p=>p[0]===x&&p[1]===z);
    }
    static allowsSidewalk(x,z){
        const coast=typeof DriverChicagoPS1Coastline!=='undefined'?
            DriverChicagoPS1Coastline:this.coast;
        // O deck do Navy Pier tem só 16.5 de largura; não autoriza
        // uma calçada quadrada de 50 sobre a água ao redor.
        for(const dx of [-25,0,25])for(const dz of [-25,0,25])
            if(coast.waterAt(x+dx,z+dz))return false;
        return true;
    }
    static random(x,z,salt=0){
        let n=Math.imul((x|0)+salt*1171,73856093)^Math.imul(z|0,19349663);
        n=Math.imul(n^(n>>>13),1274126177);
        return ((n^(n>>>16))>>>0)/4294967295;
    }
    static pilotGenerator(){
        if(typeof DriverChicagoBlockGeneratorR78!=='undefined')
            return DriverChicagoBlockGeneratorR78;
        // Node regression tests load individual CommonJS classes; browser
        // loads R78 via index.html before the city plan.
        if(typeof module!=='undefined'&&module.exports)
            return require('./chicago-block-generator-r78.js');
        return null;
    }
    static lots(x,z){
        const district=this.districtAt(x,z),kind=district.kind;
        if(['park','pier','airfield'].includes(kind))return [];
        const pilot=this.pilotGenerator()?.lots(x,z,kind);
        if(pilot)return pilot;
        const r=this.random(x,z,9),lots=[];
        // A textura principal segue o bairro: tijolo nos quarteirões
        // residenciais/industriais e pedra/aço nos prédios do Loop.
        const localPalettes={
            residential:[2,2,1,2],
            industrial:[2,1,2,1],
            commercial:[2,0,2,1],
            apartment:[1,0,1,3],
            tower:[0,3,1,0]
        };
        const add=(dx,dz,w,d,h)=>{
            const choices=localPalettes[kind]||localPalettes.residential;
            const variation=Math.floor(this.random(x+dx,z+dz,45)*choices.length);
            lots.push({x:x+dx,z:z+dz,width:w,
                depth:d,height:h,palette:choices[variation],
                kind,district:district.id,planned:true});
        };
        if(kind==='residential'){
            // Dois conjuntos de casas geminadas e um pátio atravessável.
            for(const dx of [-13.5,0,13.5]){
                add(dx,-11,11,18,9+r*7);
                add(dx,13,11,16,8+r*6);
            }
        }else if(kind==='industrial'){
            add(-11,0,20,42,8+r*5);add(13,-9,16,24,6+r*4);
        }else if(kind==='commercial'){
            for(const dx of [-14,0,14])add(dx,-10,12,22,12+r*10);
            add(0,15,38,12,8+r*6);
        }else if(kind==='apartment'){
            add(-12,0,18,40,24+r*22);add(12,4,18,32,28+r*24);
        }else{
            add(-10,-9,22,24,42+r*52);add(13,12,16,18,28+r*40);
        }
        return lots;
    }
    static addBlock(city,x,z){
        const d=this.districtAt(x,z);
        if(!city.chicagoCityPlan)city.chicagoCityPlan={
            blocks:[],byDistrict:{},lots:0,mode:'procedural-city-plan-r14',
            streetsCertified:false,missionsMigrated:false};
        const report=city.chicagoCityPlan;
        report.blocks.push({x,z,district:d.id,kind:d.kind});
        report.byDistrict[d.id]=(report.byDistrict[d.id]||0)+1;
        // R77: original PS1-era city skyline is now part of PLAYABLE Chicago.
        // Reserve entire matching parcels BEFORE any generic lot or collider,
        // so a recognizable landmark never shares space with a fake tower.
        if(typeof DriverChicagoPS1PlayableLandmarksR77!=='undefined' &&
           DriverChicagoPS1PlayableLandmarksR77.isReservedBlock(x,z)){
            DriverChicagoPS1PlayableLandmarksR77.buildBlock(city,x,z);
            return;
        }
        if(d.kind==='pier')return;
        if(d.kind==='park'){
            city.buildParkBlock(x,z);return;
        }
        if(d.kind==='airfield')return;
        const key=Math.floor((x+320)/160)+':'+Math.floor((z+360)/160);
        if(!city.districtChunks.has(key))city.districtChunks.set(key,{
            id:key,x:-240+Math.floor((x+320)/160)*160,
            z:-320+Math.floor((z+360)/160)*160,buildings:[]});
        const createdLots=[];
        for(const building of this.lots(x,z)){
            // A mesma planta define instância visível e volume físico.
            if(typeof DriverChicagoPS1Coastline!=='undefined' &&
                [[-1,-1],[-1,1],[1,-1],[1,1]].some(([sx,sz])=>
                    DriverChicagoPS1Coastline.waterAt(
                        building.x+sx*building.width/2,
                        building.z+sz*building.depth/2)))continue;
            building.palette%=city.preset.palettes.length;
            city.districtBuildings.push(building);
            city.districtChunks.get(key).buildings.push(building);
            city.buildingBoxes.push({minX:building.x-building.width/2,
                maxX:building.x+building.width/2,minZ:building.z-building.depth/2,
                maxZ:building.z+building.depth/2,chicagoPlanLot:true});
            report.lots++;
            createdLots.push(building);
        }
        if(createdLots.some(b=>b.pilotR78)){
            // Use the game's existing door/interior/exit flow; only
            // finished, dry, unblocked parcels may become actual rooms.
            const generator=this.pilotGenerator();
            const registered=generator?.registerInteriors(city,createdLots)||0;
            report.r78PilotBlocks=(report.r78PilotBlocks||0)+1;
            report.r78Frontages=(report.r78Frontages||0)+createdLots.length;
            report.r78EnterableRooms=(report.r78EnterableRooms||0)+registered;
        }
    }
    // R69: as casas residenciais já deixam um corredor central entre
    // fachadas. Antes havia asfalto visual, mas a IA não tinha essas ruas
    // no grafo R49; a largura total do asfalto não era validada.
    static verifyCourtyard(city,link) {
        if(!city||(city.preset&&city.preset.id!=='chicago')||
            !link?.from||!link?.to||
            !Number.isFinite(link.width)||link.width<3)return false;
        const {from,to}=link,dx=to.x-from.x,dz=to.z-from.z;
        const distance=Math.hypot(dx,dz);
        if(!Number.isFinite(distance)||distance<3||distance>80)return false;
        const nx=-dz/distance,nz=dx/distance;
        // Em casas geminadas, as duas bordas têm recuo estreito; testar
        // com clearance pequeno mas real, dentro dos 5,6 m de pavimento.
        const half=link.width/2-.35,steps=Math.ceil(distance/1.25);
        const ground=typeof city.getGroundHeightAt==='function'?
            (x,z)=>city.getGroundHeightAt(x,z,null,true):null;
        for(const offset of [0,-half,half]){
            let lastY=null;
            for(let i=0;i<=steps;i++){
                const t=i/steps,x=from.x+dx*t+nx*offset,
                    z=from.z+dz*t+nz*offset;
                if(!Number.isFinite(x)||!Number.isFinite(z)||
                    city.isWaterAt?.(x,z)||
                    city.isPointBlocked?.(x,z,offset===0?1.55:.25,0))
                    return false;
                if(ground){
                    const y=ground(x,z);
                    if(!Number.isFinite(y)||
                        (lastY!==null &&
                         Math.abs(y-lastY)>.45+distance/steps*.5))
                        return false;
                    lastY=y;
                }
            }
        }
        return true;
    }
    static courtyardLinks(city){
        if(!city||(city.preset&&city.preset.id!=='chicago'))return [];
        const links=[],seen=new Set();
        for(const block of city.chicagoCityPlan?.blocks||[]){
            if(block.kind!=='residential')continue;
            for(const sign of [-1,1]){
                const from={x:block.x,z:block.z+2},
                    to={x:block.x+sign*40,z:block.z+2};
                const id='residential-'+block.x+'-'+block.z+'-'+
                    (sign===1?'east':'west');
                if(seen.has(id))continue;
                const link={id,from,to,width:5.6,
                    district:block.district};
                if(!this.verifyCourtyard(city,link))continue;
                seen.add(id);links.push(link);
            }
        }
        return links;
    }
    static buildCourtyardLinks(city){
        if(city?.preset?.id!=='chicago'||!city.chicagoCityPlan)return;
        const links=this.courtyardLinks(city),vertices=[];
        // A superfície segue a mesma função consultada pelas rodas;
        // o verificador impediu água, muros e degraus em ambas as bordas.
        const height=(x,z)=>typeof city.getGroundHeightAt==='function'?
            city.getGroundHeightAt(x,z,null,true):
            (city.getSidewalkHeightAt?.(x,z)||0);
        for(const link of links){
            const {from,to,width}=link;
            const dist=Math.hypot(to.x-from.x,to.z-from.z);
            const nx=-(to.z-from.z)/dist*width/2,
                nz=(to.x-from.x)/dist*width/2;
            const segments=Math.max(1,Math.ceil(dist/2));
            const vertex=(x,z)=>vertices.push(x,height(x,z)+.018,z);
            for(let i=0;i<segments;i++){
                const t=i/segments,u=(i+1)/segments,
                    ax=from.x+(to.x-from.x)*t,
                    az=from.z+(to.z-from.z)*t,
                    bx=from.x+(to.x-from.x)*u,
                    bz=from.z+(to.z-from.z)*u;
                vertex(ax+nx,az+nz);vertex(bx+nx,bz+nz);
                vertex(ax-nx,az-nz);
                vertex(ax-nx,az-nz);vertex(bx+nx,bz+nz);
                vertex(bx-nx,bz-nz);
            }
        }
        if(vertices.length){
            const geo=new THREE.BufferGeometry();
            geo.setAttribute('position',
                new THREE.Float32BufferAttribute(vertices,3));
            geo.computeVertexNormals();
            const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({
                color:0x454a4b,side:THREE.DoubleSide}));
            mesh.name='chicago-r69-drivable-residential-service-lanes';
            mesh.userData.chicagoVisualOnly=true;
            city.cityGroup.add(mesh);
        }
        // R49 lê EXATAMENTE os mesmos links usados para gerar as malhas:
        // nenhum atalho de radar ou aresta sem superfície dirigível.
        city.chicagoCityPlan.courtyardLinks=links;
        city.chicagoCityPlan.courtyardStreetSegments=links.length;
        city.chicagoCityPlan.courtyardStreetMeters=links.reduce(
            (n,l)=>n+Math.hypot(l.to.x-l.from.x,l.to.z-l.from.z),0);
    }
    // Telhados inclinados reais nas casas de Wrigleyville e Wicker Park e
    // coberturas industriais dente-de-serra em Goose Island. A planta usa
    // exatamente as larguras/profundidades dos lotes existentes: não cria
    // caixas de 38 m sobre as casas geminadas de 11 m nem novos colisores.
    static roofPlan(buildings) {
        const result=[];
        for(const b of buildings||[]){
            if(!b?.planned ||
                !['residential','industrial'].includes(b.kind))continue;
            const {x,z,width:w,depth:d,height:h}=b;
            const base=b.baseY??.35;
            if(![x,z,w,d,h,base].every(Number.isFinite) ||
                w<7||d<7||h<5)continue;
            const r=this.random(x,z,88);
            const industrial=b.kind==='industrial';
            const strips=industrial&&w>=14?2:1;
            const rise=industrial ? .65+r*.40 : 1.65+r*1.25;
            const palette=industrial?
                [0x5d6970,0x646d6c,0x777775,0x4a5963]:
                [0x685553,0x805d56,0x545963,0x7c6256];
            for(let i=0;i<strips;i++){
                const sx=strips===2?w*.48:w*.94;
                const cx=x+(strips===2?(i===0?-w*.245:w*.245):0);
                result.push({x:cx,y:base+h+.27,z,
                    width:sx,height:rise,depth:d*.94,
                    color:palette[Math.floor(r*palette.length)],
                    kind:b.kind,lotX:x,lotZ:z});
            }
        }
        return result;
    }
    static roofGeometry() {
        // Seção triangular normalizada: duas águas + dois frontões.
        // Uma geometria para todas as casas do chunk, sem texturas novas.
        const p=[],triangle=(a,b,c)=>p.push(...a,...b,...c);
        const lf=[-.5,0,.5],lb=[-.5,0,-.5],
            rf=[.5,0,.5],rb=[.5,0,-.5],
            pf=[0,1,.5],pb=[0,1,-.5];
        triangle(lf,lb,pb);triangle(lf,pb,pf);
        triangle(rf,pb,rb);triangle(rf,pf,pb);
        triangle(lf,rf,pf);triangle(rb,lb,pb);
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',
            new THREE.Float32BufferAttribute(p,3));
        geometry.computeVertexNormals();
        return geometry;
    }
    static addRooflines(city,buildings,parent) {
        if(city?.preset?.id!=='chicago'||!parent)return 0;
        const pieces=this.roofPlan(buildings);
        if(!pieces.length)return 0;
        const mesh=new THREE.InstancedMesh(
            this.roofGeometry(),
            new THREE.MeshLambertMaterial({color:0xffffff,
                side:THREE.DoubleSide}),pieces.length);
        const dummy=new THREE.Object3D();
        for(let i=0;i<pieces.length;i++){
            const p=pieces[i];
            dummy.position.set(p.x,p.y,p.z);
            dummy.scale.set(p.width,p.height,p.depth);
            dummy.rotation.set(0,0,0);
            dummy.updateMatrix();
            mesh.setMatrixAt(i,dummy.matrix);
            mesh.setColorAt(i,new THREE.Color(p.color));
        }
        mesh.instanceMatrix.needsUpdate=true;
        if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
        mesh.frustumCulled=false; // o grupo de bairro já tem LOD/culling
        mesh.castShadow=false;
        mesh.receiveShadow=true;
        mesh.name='chicago-r68-rooflines';
        mesh.userData.chicagoVisualOnly=true;
        mesh.userData.rooflineCount=pieces.length;
        parent.add(mesh);
        return pieces.length;
    }

    static detailDistrict(city,buildings,parent){
        // Chicago PS1: janelas, cornijas e portas seguem CADA lote.
        // Não usar fachadas fixas de 38 m em prédios subdivididos de 11 m:
        // isso criava vitrines suspensas no ar e pedaços sobre a calçada.
        const parts=[],stats={lots:0,windows:0,fireEscapes:0,industrialDoors:0};
        const add=(x,y,z,w,h,d,color,light=false)=>{
            if([x,y,z,w,h,d].every(Number.isFinite)&&w>0&&h>0&&d>0)
                parts.push([x,y,z,w,h,d,color,light]);
        };
        for(const b of buildings.filter(b=>b.planned)){
            const x=b.x,z=b.z,w=b.width,d=b.depth,h=b.height,
                base=b.baseY??.35,top=base+h;
            if(![x,z,w,d,h,base].every(Number.isFinite)||w<2||d<2||h<3)
                continue;
            stats.lots++;
            const r=this.random(x,z,29);
            const industrial=b.kind==='industrial',
                residential=b.kind==='residential',
                highrise=b.kind==='tower'||b.kind==='apartment',
                commercial=b.kind==='commercial';
            const stone=industrial?0x8b8072:residential?0xb2a48e:
                highrise?0x8d9699:0xa59b8a;
            const dark=industrial?0x46525a:residential?0x453f3b:
                0x344451;
            const glass=industrial?0x42535c:residential?0x53656b:
                0x5a7180;
            const brick=residential?(r>.48?0x965744:0x794337):
                industrial?0x765547:0x76746e;
            const edgeX=x+w/2,edgeZ=z+d/2;
            const inset=.18;
            // Ornamentação rente à fachada, sem novos volumes de colisão.
            add(x,top+.12,z,w+.22,.28,d+.22,dark);
            for(const side of [-1,1]){
                add(x,base+.52,z+side*(d/2+.07),w,.72,.15,stone);
                add(x+side*(w/2+.07),base+.52,z,.15,.72,d,stone);
                add(x,top-.14,z+side*(d/2+.10),w+.25,.38,.20,stone);
                add(x+side*(w/2+.10),top-.14,z,.20,.38,d+.25,stone);
            }
            if(residential||industrial){
                add(x,top+.42,z,w*.60,.54,d*.50,brick);
                add(x,top+.74,z,w*.62,.12,d*.52,stone);
            }
            if(highrise){
                add(x,top+1.0,z,w*.66,1.8,d*.66,dark);
                if(h>52)add(x,top+2.2,z,w*.48,.7,d*.44,stone);
            }
            // Tamanho e quantidade de janelas derivados de largura/altura.
            const floors=Math.min(18,Math.max(1,Math.floor((h-5)/3.3)));
            const columns=Math.min(6,Math.max(1,Math.floor((w-1.6)/3)));
            const rowHeight=Math.min(3.3,(h-5.1)/Math.max(1,floors));
            const span=(w-1.7)/columns;
            const sizeX=Math.max(.85,Math.min(1.7,span*.60));
            const windowHeight=industrial?1.05:Math.min(1.75,rowHeight*.6);
            for(let floor=0;floor<floors;floor++){
                const y=base+4.25+floor*rowHeight;
                if(y+windowHeight/2>top-.65)break;
                if(industrial&&floor%2!==0)continue;
                for(let col=0;col<columns;col++){
                    const wx=x-w/2+.85+span*(col+.5);
                    const lit=this.random(x*11+col,z*7+floor,71)>.85;
                    for(const side of [-1,1]){
                        const wz=z+side*(d/2+.11);
                        add(wx,y,wz,sizeX,windowHeight,.12,
                            lit?0xb2a38c:glass,lit);
                        add(wx,y+windowHeight/2+.12,wz,
                            sizeX+.22,.16,.16,stone);
                    }
                    stats.windows+=2;
                }
                // Laterais: colunas independentes, sem repetir quatro
                // janelas enormes em armazéns estreitos.
                const depthColumns=Math.min(7,Math.max(1,Math.floor((d-1.5)/4.2)));
                const dz=(d-1.6)/depthColumns;
                for(let col=0;col<depthColumns;col++){
                    const wz=z-d/2+.8+dz*(col+.5);
                    for(const side of [-1,1]){
                        const wx=x+side*(w/2+.11);
                        add(wx,y,wz,.12,windowHeight,
                            Math.max(.80,Math.min(1.65,dz*.55)),glass);
                    }
                    stats.windows+=2;
                }
            }
            // Térreo com acesso e detalhes compatíveis com cada bairro.
            const front=edgeZ+.12;
            const doorX=x-w*.22;
            add(doorX,base+1.85,front,Math.min(1.95,w*.24),
                3.0,.17,dark);
            add(doorX,base+3.43,front,Math.min(2.3,w*.30),
                .19,.23,stone);
            if(industrial){
                add(x+w*.13,base+2.35,front,
                    Math.max(2.8,Math.min(w*.48,7)),4.3,.22,dark);
                for(let n=0;n<3;n++)
                    add(x+w*.13,base+1.3+n*1.05,front+.14,
                        Math.max(2.4,Math.min(w*.44,6.7)),.10,.12,stone);
                add(x+w*.13,base+4.85,front+.46,
                    Math.min(w*.65,8),.30,.70,brick);
                stats.industrialDoors++;
            }else if(commercial){
                add(x+w*.18,base+2.0,front,
                    Math.max(1.7,Math.min(w*.38,5)),2.4,.17,glass);
                add(x,base+4.1,front+.37,w*.84,.38,.8,brick);
                add(x,base+4.33,front+.42,w*.82,.17,.78,stone);
            }else if(residential){
                // Degraus e verga de pedra: tijolos típicos do oeste.
                for(let step=0;step<3;step++)
                    add(doorX,base+.10+step*.19,front+.40-step*.12,
                        Math.min(2.4,w*.3),.14,.42,stone);
                if(h>12&&w>10){
                    // Escada metálica junto à parede, sem projetar-se
                    // além dos 22 m reservados ao lote/rua.
                    const fx=x+w*.23,fw=Math.min(2.9,w*.25);
                    for(let y=base+7.2;y<top-2;y+=6.5){
                        add(fx,y,front+.34,fw,.16,.62,dark);
                        add(fx,y+.55,front+.69,fw,.10,.09,stone);
                        for(const sign of [-1,1])
                            add(fx+sign*fw/2,y+.44,front+.58,
                                .11,1.05,.10,dark);
                        stats.fireEscapes++;
                    }
                }
            }else if(highrise){
                // Faixa vertical, presente nos edifícios do Loop/Gold Coast.
                for(const offset of [-.38,.38])
                    add(x+offset*w,base+h*.50,front,
                        .27,h-.9,.16,stone);
            }
        }
        if(typeof DriverSpecialStructures!=='undefined')
            DriverSpecialStructures.pack(parent,parts,
                'chicago-r21-ps1-lot-facades');
        stats.rooflines=this.addRooflines(city,buildings,parent);
        city.chicagoPS1ParcelStyle=stats;
        return stats;
    }
}
if(typeof module!=='undefined'&&module.exports){
    DriverChicagoCityPlan.coast=require('./chicago-ps1-coastline.js');
    module.exports=DriverChicagoCityPlan;
}
