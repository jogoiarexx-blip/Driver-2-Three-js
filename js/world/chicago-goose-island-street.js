/**
 * Chicago Undercover R4 — primeiro trecho NÃO alinhado à grade de 80.
 * Pequena rua norte-sul no interior de Goose Island, conectando z=160/240
 * entre os dois canais procedurais da R2. Constrói asfalto, lotes industriais,
 * bordas e colisores reais; não desloca missões nem assume equivalência
 * geométrica certificada com a ROM/OBJ PS1.
 */
class DriverChicagoGooseIslandStreet {
    static AXIS_X=-200;
    static SOUTH_Z=160;
    static NORTH_Z=240;
    static ROAD_HALF=8.5;
    static isChicago(city){return city?.preset?.id==='chicago';}
    static isCarvedBlock(x,z){
        return x===-200&&z===200;
    }
    static isOnSpine(x,z) {
        return Number.isFinite(x)&&Number.isFinite(z) &&
            Math.abs(x-this.AXIS_X)<=this.ROAD_HALF+2 &&
            z>=this.SOUTH_Z+3&&z<=this.NORTH_Z-3;
    }
    static lanePosition(sign,z){
        return {x:this.AXIS_X+(sign>=0?4:-4),z};
    }

    // R5: conexões auditáveis, da avenida oeste à via industrial e à
    // ponte norte leste. São corredores reais da física do clone, não
    // marcadores soltos nem alegação de ruas certificadas na ROM.
    static accessSegments(){
        return [
            {id:'bridge-west',from:{x:-276,z:156},to:{x:-200,z:156}},
            {id:'turn-island',from:{x:-200,z:156},to:{x:-196,z:185}},
            {id:'spine-north',from:{x:-196,z:185},to:{x:-196,z:236}},
            {id:'bridge-east-north',from:{x:-196,z:236},to:{x:-160,z:236}}
        ];
    }
    static auditAccess(city){
        if(!this.isChicago(city) ||
           typeof DriverRoadGeometry==='undefined')return {
            ready:false,links:[],unsafe:['sem geometria viária']
        };
        const links=this.accessSegments().map(segment=>({
            ...segment,
            safe:DriverRoadGeometry.segmentDrivable(city,
                segment.from.x,segment.from.z,
                segment.to.x,segment.to.z,1.55)
        }));
        return {ready:links.every(link=>link.safe),
            links,unsafe:links.filter(link=>!link.safe).map(link=>link.id)};
    }
    static planVisitorEntry(city,car){
        if(!this.isChicago(city) || !car?.gooseIslandVisitor ||
           car.scriptedDrive || !city?.chicagoGooseIslandStreet ||
           !Number.isFinite(car.x) || !Number.isFinite(car.z) ||
           !Number.isFinite(car.heading))return null;
        // Um visitante chega do oeste pela ponte de z=160. Converter
        // apenas quando estiver fisicamente próximo ao cruzamento.
        if(Math.abs(car.x-this.AXIS_X)>10 ||
           Math.abs(car.z-(this.SOUTH_Z-4))>8 ||
           Math.sin(car.heading)<.55)return null;
        if(!city.chicagoGooseIslandStreet.access?.ready)return null;
        const destination={x:-196,z:185};
        if(!DriverRoadGeometry.segmentDrivable(city,car.x,car.z,
            destination.x,destination.z,1.55))return null;
        return {axis:'z',sign:1,road:this.AXIS_X,
            target:destination,isIslandSpine:true,
            islandPhase:'entry',islandApproach:false,
            islandVisitComplete:false};
    }
    static testCorridor(city){
        if(!this.isChicago(city))return false;
        for(let z=this.SOUTH_Z+4;z<=this.NORTH_Z-4;z+=4){
            for(const x of [this.AXIS_X-5,this.AXIS_X+5]){
                if(city.isWaterAt?.(x,z) ||
                    city.isPointBlocked?.(x,z,1.55,0))return false;
            }
        }
        return true;
    }
    static build(city){
        if(!this.isChicago(city))return null;
        if(city.chicagoGooseIslandStreet)return city.chicagoGooseIslandStreet;
        const group=new THREE.Group();
        group.name='chicago-goose-island-r4-local-arterial';
        group.userData.chicagoApproximation=true;
        group.userData.notPS1Certified=true;
        city.cityGroup.add(group);

        const road=new THREE.Mesh(
            new THREE.BoxGeometry(this.ROAD_HALF*2,.07,
                this.NORTH_Z-this.SOUTH_Z+7),
            new THREE.MeshLambertMaterial({color:0x43474a})
        );
        road.position.set(this.AXIS_X,.05,
            (this.SOUTH_Z+this.NORTH_Z)/2);
        road.name='goose-island-r4-asphalt';
        group.add(road);
        const lineMat=new THREE.MeshBasicMaterial({color:0xd5b96d});
        for(let z=this.SOUTH_Z+19;z<this.NORTH_Z-17;z+=12){
            const line=new THREE.Mesh(
                new THREE.BoxGeometry(.21,.014,5.7),lineMat);
            line.position.set(this.AXIS_X,.096,z);
            line.name='goose-island-r4-divider';
            group.add(line);
        }
        const curbMaterial=new THREE.MeshLambertMaterial({color:0x8d959a});
        for(const side of [-1,1]){
            const curb=new THREE.Mesh(
                new THREE.BoxGeometry(.55,.2,63),curbMaterial);
            curb.position.set(this.AXIS_X+
                side*(this.ROAD_HALF+1.35),.1,200);
            curb.name='goose-island-r4-curb';
            group.add(curb);
        }
        const buildings=[];
        const floors=[{minX:-225,maxX:-212},{minX:-188,maxX:-175}];
        const palettes=[0x66534d,0x60696d];
        for(const [i,lot] of floors.entries()){
            const x=(lot.minX+lot.maxX)/2,w=lot.maxX-lot.minX;
            const height=i?13.5:11.8;
            const building=new THREE.Mesh(
                new THREE.BoxGeometry(w,height,40),
                new THREE.MeshLambertMaterial({color:palettes[i]})
            );
            building.position.set(x,height/2,200);
            building.name='goose-island-r4-warehouse-'+(i+1);
            group.add(building);
            const box={minX:lot.minX,maxX:lot.maxX,
                minZ:180,maxZ:220};
            city.buildingBoxes.push(box);
            buildings.push(box);
        }
        const result={
            mode:'procedural-r4-island-street',
            localRoad:true,originalGeometryCertified:false,
            length:this.NORTH_Z-this.SOUTH_Z,
            asphalt:road,meshCount:group.children.length,
            buildings,collidersAdded:buildings.length,
            betweenCanals:true,aiRouting:true,group,
            access:null
        };
        city.chicagoGooseIslandStreet=result;
        result.access=this.auditAccess(city);
        result.accessReady=result.access.ready;
        return result;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoGooseIslandStreet;
