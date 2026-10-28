/**
 * Chicago R6 — extensão industrial norte de Goose Island.
 *
 * Reconstrução PROCEDURAL localizada: um segundo quarteirão industrial,
 * ligação real com a via da R4, pequeno deck sobre o canal transversal
 * em z=306.3, e saída pela avenida z=320.
 *
 * Posição não certificada contra os GLBs PS1. Não altera rios R2,
 * pontes móveis, posições de missão nem coordenadas do jogo original.
 */
class DriverChicagoGooseIslandNorthYard {
    static AXIS_X=-200;
    static START_Z=240;
    static END_Z=320;
    static BRIDGE_Z=306.3;
    static BRIDGE_HALF_WIDTH=12;
    static BRIDGE_HALF_LENGTH=10.5;
    static isChicago(city){return city?.preset?.id==='chicago';}
    static isCarvedBlock(x,z){return x===-200 && z===280;}
    static onNorthernSpine(x,z){
        return Number.isFinite(x)&&Number.isFinite(z)&&
            Math.abs(x-this.AXIS_X)<10&&
            z>=this.START_Z+2&&z<this.END_Z-3;
    }
    static isBridgeDeck(x,z){
        return Number.isFinite(x)&&Number.isFinite(z)&&
            Math.abs(x-this.AXIS_X)<=this.BRIDGE_HALF_WIDTH&&
            Math.abs(z-this.BRIDGE_Z)<=this.BRIDGE_HALF_LENGTH;
    }
    static onDrivableCorridor(city,x,z){
        if(!this.isChicago(city)||city.isWaterAt?.(x,z)||
            city.isPointBlocked?.(x,z,1.65,0))return false;
        return true;
    }
    static audit(city) {
        if(!this.isChicago(city) || 
           typeof DriverRoadGeometry==='undefined')
            return {ready:false,segments:[],unsafe:['sem verificador de ruas']};
        const segments=[
            {name:'r4-r6-link',a:{x:-196,z:235},b:{x:-196,z:268}},
            {name:'industrial-extension',a:{x:-196,z:268},b:{x:-196,z:295}},
            {name:'north-deck',a:{x:-196,z:295},b:{x:-196,z:317}},
            {name:'street-exit',a:{x:-196,z:317},b:{x:-160,z:316}}
        ].map(segment=>({
            ...segment,
            safe:DriverRoadGeometry.segmentDrivable(city,
                segment.a.x,segment.a.z,segment.b.x,segment.b.z,1.65)
        }));
        return {ready:segments.every(s=>s.safe),
            segments,unsafe:segments.filter(s=>!s.safe).map(s=>s.name)};
    }
    // R8: liberar o sentido sul apenas quando o caminhão puder cruzar
    // todo o deck e virar para oeste sem atingir água nem galpões.
    static testSouthbound(city){
        if(!this.isChicago(city) ||
            !city.chicagoGooseIslandNorthYard?.accessReady ||
            typeof DriverRoadGeometry==='undefined')return false;
        return !city.isWaterAt?.(-204,311) &&
            !city.isPointBlocked?.(-204,311,1.65,0) &&
            DriverRoadGeometry.segmentDrivable(
                city,-204,311,-204,244,1.65) &&
            DriverRoadGeometry.segmentDrivable(
                city,-204,249,-240,244,1.65);
    }
    static testCorridor(city){
        if(!this.isChicago(city))return false;
        for(let z=244;z<=316;z+=3){
            for(const x of [-204,-196])
                if(!this.onDrivableCorridor(city,x,z))return false;
        }
        return true;
    }
    static build(city){
        if(!this.isChicago(city))return null;
        if(city.chicagoGooseIslandNorthYard)return city.chicagoGooseIslandNorthYard;
        const group=new THREE.Group();
        group.name='chicago-goose-island-r6-north-industrial';
        group.userData.proceduralApproximation=true;
        group.userData.notOriginalPS1Certified=true;
        city.cityGroup.add(group);
        const roadMat=new THREE.MeshLambertMaterial({color:0x444b50});
        const metalMat=new THREE.MeshLambertMaterial({color:0x75848e});
        const asphalt=new THREE.Mesh(
            new THREE.BoxGeometry(17,.07,85),roadMat);
        asphalt.position.set(this.AXIS_X,.045,279.5);
        asphalt.name='goose-island-r6-north-asphalt';
        group.add(asphalt);
        const deck=new THREE.Mesh(
            new THREE.BoxGeometry(this.BRIDGE_HALF_WIDTH*2,.23,
                this.BRIDGE_HALF_LENGTH*2),
            new THREE.MeshLambertMaterial({color:0x4b585f})
        );
        deck.position.set(this.AXIS_X,.12,this.BRIDGE_Z);
        deck.name='goose-island-r6-north-bridge';
        deck.userData.bridgeDeck=true;
        group.add(deck);
        const rails=[];
        for(const side of [-1,1]){
            const rail=new THREE.Mesh(
                new THREE.BoxGeometry(.34,.63,
                    this.BRIDGE_HALF_LENGTH*2),
                metalMat);
            rail.position.set(this.AXIS_X+side*(this.BRIDGE_HALF_WIDTH+.65),
                .56,this.BRIDGE_Z);
            rail.name='goose-island-r6-north-guardrail';
            rail.userData.cosmeticOnly=true;
            group.add(rail);rails.push(rail);
        }
        const buildings=[];
        for(const [i,x] of [-218.5,-181.5].entries()){
            const h=i?15.4:12.8;
            const obj=new THREE.Mesh(
                new THREE.BoxGeometry(13,h,23),
                new THREE.MeshLambertMaterial({
                    color:i?0x627782:0x76675b
                })
            );
            obj.position.set(x,h/2,277.5);
            obj.name='goose-island-r6-industrial-'+(i+1);
            group.add(obj);
            const bounds={minX:x-6.5,maxX:x+6.5,
                minZ:266,maxZ:289};
            city.buildingBoxes.push(bounds);
            buildings.push(bounds);
        }
        const markings=new THREE.MeshBasicMaterial({color:0xe7d38a});
        for(let z=255;z<=297;z+=13){
            const dash=new THREE.Mesh(
                new THREE.BoxGeometry(.20,.018,5.5),markings);
            dash.position.set(this.AXIS_X,.093,z);
            dash.name='goose-island-r6-center-line';
            group.add(dash);
        }
        const result={
            mode:'procedural-r6-north-yard',
            geometryCertified:false,missionCoordsChanged:false,
            northernExtension:true,streetLength:this.END_Z-this.START_Z,
            bridgeCount:1,buildings,collidersAdded:buildings.length,
            group,deck,access:null,accessReady:false
        };
        city.chicagoGooseIslandNorthYard=result;
        result.access=this.audit(city);
        result.accessReady=result.access.ready&&this.testCorridor(city);
        return result;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoGooseIslandNorthYard;
