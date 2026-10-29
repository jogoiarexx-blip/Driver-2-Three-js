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
    static lots(x,z){
        const district=this.districtAt(x,z),kind=district.kind;
        if(['park','pier','airfield'].includes(kind))return [];
        const r=this.random(x,z,9),lots=[];
        const add=(dx,dz,w,d,h)=>lots.push({x:x+dx,z:z+dz,width:w,
            depth:d,height:h,palette:Math.floor(r*4)%4,
            kind,district:district.id,planned:true});
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
        if(d.kind==='pier')return;
        if(d.kind==='park'){
            city.buildParkBlock(x,z);return;
        }
        if(d.kind==='airfield')return;
        const key=Math.floor((x+320)/160)+':'+Math.floor((z+360)/160);
        if(!city.districtChunks.has(key))city.districtChunks.set(key,{
            id:key,x:-240+Math.floor((x+320)/160)*160,
            z:-320+Math.floor((z+360)/160)*160,buildings:[]});
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
        }
    }
    static courtyardLinks(city){
        const links=[];
        for(const block of city.chicagoCityPlan?.blocks||[]){
            if(block.kind!=='residential')continue;
            for(const sign of [-1,1]){
                const from={x:block.x,z:block.z+2},to={x:block.x+sign*40,z:block.z+2};
                let safe=true;
                for(let step=0;step<=20;step++){
                    const x=from.x+(to.x-from.x)*step/20,z=from.z;
                    if(city.isWaterAt?.(x,z)||city.isPointBlocked?.(x,z,1.7,0)){
                        safe=false;break;
                    }
                }
                if(safe)links.push({from,to,width:5.6,district:block.district});
            }
        }
        return links;
    }
    static buildCourtyardLinks(city){
        if(city?.preset?.id!=='chicago'||!city.chicagoCityPlan)return;
        const links=this.courtyardLinks(city),vertices=[];
        // O asfalto segue o mesmo piso elevado consultado pela suspensão.
        for(const link of links)for(let i=0;i<20;i++){
            const ax=link.from.x+(link.to.x-link.from.x)*i/20;
            const bx=link.from.x+(link.to.x-link.from.x)*(i+1)/20;
            const z=link.from.z,h=link.width/2;
            for(const [x,zz] of [[ax,z-h],[bx,z-h],[ax,z+h],
                [bx,z-h],[bx,z+h],[ax,z+h]])
                vertices.push(x,(city.getSidewalkHeightAt?.(x,zz)||0)+.018,zz);
        }
        if(vertices.length){
            const geo=new THREE.BufferGeometry();
            geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
            geo.computeVertexNormals();
            const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({
                color:0x454a4b,side:THREE.DoubleSide}));
            mesh.name='chicago-r14-residential-service-lanes';
            city.cityGroup.add(mesh);
        }
        city.chicagoCityPlan.courtyardLinks=links;
    }
    static detailDistrict(city,buildings,parent){
        const parts=[];
        for(const b of buildings.filter(b=>b.planned)){
            const top=b.height+(b.baseY??.35),front=b.z+b.depth/2;
            parts.push([b.x,top+.12,b.z,b.width+.3,.24,b.depth+.3,0x4e5256,false]);
            parts.push([b.x,3.5,front+.12,b.width,.3,.25,
                b.kind==='commercial'?0x8c3834:0xb0aaa0,false]);
            if(b.kind==='industrial'){
                parts.push([b.x,2,front+.16,b.width*.52,3.5,.22,0x52616b,false]);
                parts.push([b.x-3,top+1.2,b.z,2,2.4,2,0x746354,false]);
            }else if(b.kind==='residential'){
                parts.push([b.x,1.35,front+.15,1.5,2.6,.25,0x604637,false]);
            }else if(b.kind==='tower'){
                parts.push([b.x,top+1.7,b.z,b.width*.65,3,b.depth*.65,0x465361,false]);
            }
        }
        if(typeof DriverSpecialStructures!=='undefined')
            DriverSpecialStructures.pack(parent,parts,'chicago-r14-parcel-details');
    }
}
if(typeof module!=='undefined'&&module.exports){
    DriverChicagoCityPlan.coast=require('./chicago-ps1-coastline.js');
    module.exports=DriverChicagoCityPlan;
}
