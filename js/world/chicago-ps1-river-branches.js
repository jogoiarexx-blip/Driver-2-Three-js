/**
 * Driver 2 Chicago PS1 — R2 geografia hidrográfica procedural.
 *
 * Reconstrução APROXIMADA, calibrada à malha procedural de 80 unidades.
 * North Branch / South Branch / Goose Island e pontes estáticas transversais.
 * Objetivos, spawns, garagens, trem e pontes levadiças existentes não mudam.
 *
 * O corredor x=-240 substitui uma rua longitudinal por água; x=-160 cria
 * o canal paralelo de Goose Island ao norte. Ruas transversais z=80n
 * ganham decks completos e continuam trafegáveis. Fora das travessias
 * a água atua fisicamente via CityBuilder.isWaterAt / getGroundHeightAt.
 */
class DriverChicagoPS1RiverBranches {
    static WEST_X=-240;
    static EAST_X=-160;
    static HALF_WIDTH=11.9;
    static SOUTH_START=-324;
    static NORTH_END=306;
    static ISLAND_START=94;
    static ISLAND_END=306;
    static BRIDGES_WEST=[-320,-240,-160,-80,0,80,160,240];
    static BRIDGES_EAST=[160,240];
    static BRIDGE_HALF_Z=13;
    static isChicago(city){return city?.preset?.id==='chicago';}
    static insideBand(v,min,max){return v>=min&&v<=max;}
    static isBridge(x,z){
        if(!Number.isFinite(x)||!Number.isFinite(z))return false;
        const halfX=this.HALF_WIDTH+2.5;
        const west=Math.abs(x-this.WEST_X)<=halfX &&
            this.BRIDGES_WEST.some(v=>Math.abs(z-v)<=this.BRIDGE_HALF_Z);
        const east=Math.abs(x-this.EAST_X)<=halfX &&
            this.BRIDGES_EAST.some(v=>Math.abs(z-v)<=this.BRIDGE_HALF_Z);
        return west||east;
    }
    static waterAt(x,z){
        if(!Number.isFinite(x)||!Number.isFinite(z))return false;
        // Um único deck não cobre o canal principal z=34..66:
        // preserva a interseção com a água da Chicago anterior.
        if(this.isBridge(x,z))return false;
        const primary=Math.abs(x-this.WEST_X)<this.HALF_WIDTH &&
            this.insideBand(z,this.SOUTH_START,this.NORTH_END);
        const other=Math.abs(x-this.EAST_X)<this.HALF_WIDTH &&
            this.insideBand(z,this.ISLAND_START,this.ISLAND_END);
        // Ligação de Goose Island: faixa estreita no intervalo de
        // 3m entre as ruas z=80/320 e os quarteirões z=120/280.
        // Assim não cobre a via nem a calçada existente.
        const connector=this.insideBand(x,this.WEST_X,this.EAST_X) &&
            (Math.abs(z-93.5)<1.1||Math.abs(z-306.3)<1.1);
        return primary||other||connector;
    }
    static wetRectangle(vertices,cx,cz,width,length){
        const x0=cx-width/2,x1=cx+width/2;
        const z0=cz-length/2,z1=cz+length/2;
        // +Y para o material exibir água acima do asfalto (.02).
        for(const p of [
            [x0,z0],[x1,z0],[x0,z1],
            [x1,z0],[x1,z1],[x0,z1]
        ])vertices.push(p[0],.089,p[1]);
    }
    static buildWater(city){
        const vertices=[];
        const width=this.HALF_WIDTH*2;
        this.wetRectangle(vertices,this.WEST_X,
            (this.SOUTH_START+this.NORTH_END)/2,
            width,this.NORTH_END-this.SOUTH_START);
        this.wetRectangle(vertices,this.EAST_X,
            (this.ISLAND_START+this.ISLAND_END)/2,
            width,this.ISLAND_END-this.ISLAND_START);
        for(const z of [93.5,306.3])
            this.wetRectangle(vertices,(this.WEST_X+this.EAST_X)/2,
                z,this.EAST_X-this.WEST_X,2.2);
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',
            new THREE.Float32BufferAttribute(vertices,3));
        geometry.computeVertexNormals();
        const water=new THREE.Mesh(geometry,
            new THREE.MeshBasicMaterial({
                color:0x286479,side:THREE.DoubleSide,
                transparent:true,opacity:.98,depthWrite:true
            }));
        water.name='chicago-ps1-branches-r2-water';
        water.userData.collidersCreated=0;
        water.userData.proceduralApproximation=true;
        city.cityGroup.add(water);
        return water;
    }
    static buildDecks(city){
        const pieces=[];
        const add=(x,z)=>{
            // Deck acima da malha azul, mas baixo o suficiente para que
            // os pneus (y=0) não flutuem nem precisem de rampa fictícia.
            const deck=new THREE.Mesh(
                new THREE.BoxGeometry(this.HALF_WIDTH*2+6,.11,
                    this.BRIDGE_HALF_Z*2+1),
                new THREE.MeshLambertMaterial({color:0x4b535a}));
            deck.position.set(x,.058,z);
            deck.name='chicago-ps1-r2-bridge-'+x+'-'+z;
            deck.userData.chicagoFixedBridge=true;
            city.cityGroup.add(deck);pieces.push(deck);
            // Guarda-corpos fora da faixa útil para não ocupar as duas
            // faixas do eixo leste-oeste (z ±4).
            for(const side of [-1,1]){
                const rail=new THREE.Mesh(
                    new THREE.BoxGeometry(this.HALF_WIDTH*2+6,.46,.32),
                    new THREE.MeshLambertMaterial({color:0x77828a}));
                rail.position.set(x,.56,z+side*(this.BRIDGE_HALF_Z+1.1));
                rail.name='chicago-ps1-r2-bridge-rail';
                rail.userData.cosmeticOnly=true;
                city.cityGroup.add(rail);
                pieces.push(rail);
            }
        };
        for(const z of this.BRIDGES_WEST)add(this.WEST_X,z);
        for(const z of this.BRIDGES_EAST)add(this.EAST_X,z);
        return {bridges:this.BRIDGES_WEST.length+this.BRIDGES_EAST.length,
            meshes:pieces.length,bridgeMeshes:pieces};
    }
    static buildBanks(city){
        if(typeof DriverSpecialStructures==='undefined')return 0;
        // Barras à margem das duas faixas norte-sul. As seções sobre
        // decks não recebem barreiras, preservando vias de acesso.
        const parts=[];
        const channel=(x,lower,upper)=>{
            for(let z=lower+8;z<upper;z+=12){
                if(this.isBridge(x,z)||this.isBridge(x,z+6))continue;
                for(const side of [-1,1])
                    parts.push([x+side*(this.HALF_WIDTH+.5),
                        .30,z, .26,.58,10,0x8e9a9b,false]);
            }
        };
        channel(this.WEST_X,this.SOUTH_START,this.NORTH_END);
        channel(this.EAST_X,this.ISLAND_START,this.ISLAND_END);
        DriverSpecialStructures.pack(city.cityGroup,parts,
            'chicago-ps1-r2-riverbanks');
        return parts.length;
    }
    static build(city){
        if(!this.isChicago(city))return null;
        if(city.chicagoPS1RiverBranches)return city.chicagoPS1RiverBranches;
        const before=city.buildingBoxes?.length||0;
        const water=this.buildWater(city),decks=this.buildDecks(city);
        const banks=this.buildBanks(city);
        const result={
            water,riverSegments:4,
            bridgeCount:decks.bridges,bridgeMeshes:decks.bridgeMeshes,
            bankSegments:banks,
            northBranch:true,southBranch:true,gooseIsland:true,
            generatedColliders:(city.buildingBoxes?.length||0)-before,
            mode:'procedural-r2-unverified-PS1-topology'
        };
        city.chicagoPS1RiverBranches=result;
        return result;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoPS1RiverBranches;
