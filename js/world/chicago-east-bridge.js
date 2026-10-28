/**
 * Segunda ponte basculante de Chicago (eixo X=240).
 * Montagem modular em grupos filhos: render da folha e física compartilham
 * o mesmo pivô em Z=34/66 e o MESMO ângulo da ponte central.
 * AABB lateral só existe na altura do corrimão; não bloqueia a pista.
 */
class DriverChicagoEastBridge {
    static X=240;
    static SOUTH=34;
    static NORTH=66;
    static HALF_WIDTH=10.25;
    static SPAN=16;
    static MAX_ANGLE=38*Math.PI/180;

    static valid(city) {
        return !!city && city.preset?.id==='chicago';
    }
    static isDeckLocation(city,x,z,extra=0){
        return this.valid(city)&&Number.isFinite(x)&&Number.isFinite(z)&&
            Math.abs(x-this.X)<=this.HALF_WIDTH+extra &&
            z>=this.SOUTH&&z<=this.NORTH;
    }
    static deckHeight(city,x,z){
        if(!this.isDeckLocation(city,x,z))return null;
        const angle=Math.max(0,Math.min(this.MAX_ANGLE,city.bridgeAngle||0));
        const distance=Math.min(z-this.SOUTH,this.NORTH-z);
        return .15+Math.sin(angle)*distance;
    }
    static railBlocked(city,x,z,radius=1.2,y=0){
        if(!this.isDeckLocation(city,x,z,radius))return false;
        const side=Math.abs(x-this.X);
        if(side+radius<this.HALF_WIDTH)return false;
        if(side-radius>this.HALF_WIDTH+.7)return false;
        const h=this.deckHeight(city,this.X,z);
        return Number.isFinite(h) && y>=h-1.6 && y<=h+3.1;
    }
    /** Calcula o impulso vertical ao cruzar a ponta da folha inclinada.
     * A chamada acontece antes da integração de vy na física arcade.
     * Sem teleporte nem alteração de posição horizontal.
     */
    static jumpVelocity(city,fromX,fromZ,toX,toZ,speed,y){
        if(!this.valid(city)||!Number.isFinite(speed))return 0;
        const angle=city.bridgeAngle||0;
        if(angle<10*Math.PI/180 || angle>30*Math.PI/180 ||
            Math.abs(speed)<22)return 0;
        if((fromZ-50)*(toZ-50)>0 || Math.abs(toZ-fromZ)<.0001)
            return 0;
        for(const x of [0,this.X]){
            if(Math.abs(toX-x)>8.0 || Math.abs(fromX-x)>8.0)continue;
            const h=.15+Math.sin(angle)*Math.min(
                Math.max(0,fromZ-this.SOUTH),
                Math.max(0,this.NORTH-fromZ));
            if(!Number.isFinite(y)||Math.abs(y-h)>1.85)continue;
            return Math.min(11.0,Math.max(5.2,
                Math.abs(speed)*Math.sin(angle)*.36));
        }
        return 0;
    }
    static isJumpCamera(city,pos,car){
        return this.valid(city)&&pos&&car &&
            Math.abs(car.vy||0)>1.0 &&
            pos.y>.4 && pos.z>28 && pos.z<73 &&
            (Math.abs(pos.x)<12||Math.abs(pos.x-this.X)<12);
    }

    static build(city){
        if(!this.valid(city))return;
        const steel=new THREE.MeshLambertMaterial({color:0x465362});
        const deckMat=new THREE.MeshLambertMaterial({color:0x575f6b});
        const lampMat=new THREE.MeshBasicMaterial({color:0x491410});
        const leaves=[];
        for(const south of [true,false]){
            const pivot=new THREE.Group();
            pivot.name='chicago-east-bascule-'+(south?'south':'north');
            const sign=south?1:-1;
            pivot.position.set(this.X,.1,south?this.SOUTH:this.NORTH);
            const center=sign*8;
            const road=new THREE.Mesh(
                new THREE.BoxGeometry(22,.5,16),deckMat);
            road.position.set(0,0,center);
            pivot.add(road);
            // Corrimãos e perfis treliçados acompanhando a folha.
            const details=[];
            for(const side of [-1,1]){
                details.push([side*10.55,1.12,center,.65,2.25,16,
                    0x49576a,false]);
                details.push([side*10.5,2.45,center,.22,.22,16,
                    0xa7b9c9,false]);
                for(let i=1;i<=7;i++){
                    const z=sign*(i*2);
                    details.push([side*10.55,2.65,z,.35,2,.35,
                        0x415269,false]);
                    details.push([side*10.55,3.57,z,.85,.25,1.65,
                        0xa7b9c9,false]);
                }
            }
            // Marcas longitudinais que não obstruem os pneus.
            for(let i=1;i<15;i+=3)
                details.push([0,.271,sign*i,.22,.03,1.25,
                    0xf3dda1,false]);
            if(typeof DriverSpecialStructures!=='undefined')
                DriverSpecialStructures.pack(pivot,details,
                    'chicago-east-bridge-truss');
            else {
                for(const x of [-10.55,10.55]){
                    const side=new THREE.Mesh(
                        new THREE.BoxGeometry(.65,2.25,16),steel);
                    side.position.set(x,1.12,center);
                    pivot.add(side);
                }
            }
            city.cityGroup.add(pivot);
            leaves.push(pivot);
        }

        // Avisos em ambas as cabeceiras, sem novos PointLights.
        const beacons=[];
        for(const z of [31.5,68.5])
            for(const dx of [-13,13]){
                const bulb=new THREE.Mesh(
                    new THREE.BoxGeometry(.8,.75,.65),lampMat.clone());
                bulb.position.set(this.X+dx,3.1,z);
                city.cityGroup.add(bulb);
                beacons.push(bulb);
            }
        // Conecta visualmente às faixas de rua; sem collider transversal.
        for(const z of [29.5,70.5]){
            const approach=new THREE.Mesh(
                new THREE.BoxGeometry(22,.12,8),deckMat);
            approach.position.set(this.X,.09,z);
            city.cityGroup.add(approach);
        }
        city.chicagoEastBridge={
            x:this.X,south:leaves[0],north:leaves[1],beacons,
            clock:0,angle:city.bridgeAngle||0
        };
    }
    static update(city,dt){
        const state=city?.chicagoEastBridge;
        if(!state)return;
        const angle=Math.max(0,Math.min(this.MAX_ANGLE,city.bridgeAngle||0));
        state.angle=angle;
        state.south.rotation.x=-angle;
        state.north.rotation.x=angle;
        const flash=Math.floor((city.signalClock||0)*3)%2===0;
        const lit=angle>10*Math.PI/180 && flash;
        for(const bulb of state.beacons)
            bulb.material.color.setHex(lit?0xff2222:0x491410);
    }
}
