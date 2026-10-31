/**
 * R55 — acessos rodáveis Navy Pier / Wrigley / Soldier Field.
 * Coordenadas adaptadas à Chicago procedural do clone, não à ROM.
 * Decais seguem a altura do terreno; nenhuma malha cria rua sobre água,
 * altera missões, repavimenta cruzamentos ou empurra o carro.
 */
class DriverChicagoLandmarkAccessR55 {
    static ROUTES=[
        {id:'navy-pier',name:'NAVY PIER',from:[320,-40],to:[359,-40],
            width:6.4,sign:[327,-51],signColor:0x67d9f0},
        {id:'wrigley',name:'WRIGLEY FIELD',from:[-280,240],to:[-280,222.5],
            width:6.6,sign:[-268,227],signColor:0x9dcb90},
        {id:'soldier',name:'SOLDIER FIELD',from:[280,-240],to:[280,-267],
            width:6.6,sign:[292,-254],signColor:0xf4dfac}
    ];

    static install() {
        if(this.installed||typeof DriverChicagoNeighborhoods==='undefined')return;
        this.installed=true;
        const original=DriverChicagoNeighborhoods.build;
        DriverChicagoNeighborhoods.build=function(city){
            const result=original.call(this,city);
            if(result&&city?.preset?.id==='chicago')
                DriverChicagoLandmarkAccessR55.attach(city);
            return result;
        };
        if(typeof DriverChicagoGameplay!=='undefined'){
            const previous=DriverChicagoGameplay.update;
            DriverChicagoGameplay.update=function(city,dt){
                previous.call(this,city,dt);
                DriverChicagoLandmarkAccessR55.update(city);
            };
        }
    }

    static stadiumGroundAt(city,x,z) {
        if(city?.preset?.id!=='chicago'||!Number.isFinite(x)||!Number.isFinite(z))
            return null;
        // Alturas superiores reais da malha de gramado (não da calçada).
        const w=city.chicagoStadium;
        if(w&&Math.abs(x-w.x)<=17.5&&Math.abs(z-w.z)<=17)
            return .08;
        const s=city.chicagoSoldierField;
        if(s&&Math.abs(x-s.x)<=17&&Math.abs(z-s.z)<=16)
            return .55;
        return null;
    }

    static laneCenter(route,t) {
        return {
            x:route.from[0]+(route.to[0]-route.from[0])*t,
            z:route.from[1]+(route.to[1]-route.from[1])*t
        };
    }

    static sampleRoute(city,route,clearance=1.55) {
        if(city?.preset?.id!=='chicago')return {open:false,reason:'city'};
        const length=Math.hypot(route.to[0]-route.from[0],
            route.to[1]-route.from[1]);
        const steps=Math.ceil(length/1.25),samples=[];
        for(let i=0;i<=steps;i++){
            const p=this.laneCenter(route,i/steps);
            if(city.isWaterAt?.(p.x,p.z))
                return {open:false,reason:'water',x:p.x,z:p.z};
            if(city.isPointBlocked?.(p.x,p.z,clearance,0))
                return {open:false,reason:'wall',x:p.x,z:p.z};
            samples.push(p);
        }
        return {open:true,reason:null,length,samples:samples.length};
    }

    static height(city,x,z) {
        const h=city.getGroundHeightAt?.(x,z,0,true);
        return Number.isFinite(h)?h:0;
    }

    static addLane(city,root,route) {
        const v=[],w=route.width/2;
        const dx=route.to[0]-route.from[0],
            dz=route.to[1]-route.from[1];
        const len=Math.hypot(dx,dz)||1;
        const nx=-dz/len,nz=dx/len;
        const steps=Math.ceil(len/1.5);
        const vertex=(x,z)=>{
            v.push(x,this.height(city,x,z)+.037,z);
        };
        for(let i=0;i<steps;i++){
            const a=this.laneCenter(route,i/steps);
            const b=this.laneCenter(route,(i+1)/steps);
            const al=[a.x+nx*w,a.z+nz*w],
                ar=[a.x-nx*w,a.z-nz*w];
            const bl=[b.x+nx*w,b.z+nz*w],
                br=[b.x-nx*w,b.z-nz*w];
            // A subdivisão acompanha rampas e diferenças de nível locais.
            vertex(...al);vertex(...ar);vertex(...bl);
            vertex(...ar);vertex(...br);vertex(...bl);
        }
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
        geo.computeVertexNormals();
        const mat=new THREE.MeshLambertMaterial({
            color:0x50595e,side:THREE.DoubleSide,
            polygonOffset:true,polygonOffsetFactor:-2
        });
        const road=new THREE.Mesh(geo,mat);
        road.name='r55-access-surface-'+route.id;
        road.receiveShadow=true;
        root.add(road);
        const white=new THREE.MeshBasicMaterial({
            color:0xc6cfcc,side:THREE.DoubleSide,depthWrite:false});
        const amber=new THREE.MeshBasicMaterial({
            color:0xf1c875,side:THREE.DoubleSide,depthWrite:false});
        const strips=[];
        for(const t of [.12,.28,.44,.60,.76,.92]){
            const p=this.laneCenter(route,t);
            const perp=Math.abs(dx)>Math.abs(dz);
            strips.push({
                x:p.x,z:p.z,w:perp?.48:route.width*.83,
                d:perp?route.width*.83:.48,mat:amber
            });
        }
        // Marcadores de bordo claros que não interferem na física.
        for(const t of [.05,.95]){
            const p=this.laneCenter(route,t);
            for(const side of [-1,1]){
                const x=p.x+nx*(w-.22)*side,z=p.z+nz*(w-.22)*side;
                strips.push({x,z,w:Math.abs(dx)>.1?.9:.13,
                    d:Math.abs(dz)>.1?.9:.13,mat:white});
            }
        }
        for(const strip of strips){
            const p=new THREE.Mesh(new THREE.PlaneGeometry(strip.w,strip.d),
                strip.mat);
            p.rotation.x=-Math.PI/2;
            p.position.set(strip.x,this.height(city,strip.x,strip.z)+.051,strip.z);
            p.name='r55-road-mark-'+route.id;
            root.add(p);
        }
        return {road,markCount:strips.length};
    }

    static addSign(city,root,route,lights) {
        const [x,z]=route.sign;
        if(city.isWaterAt?.(x,z)||city.isPointBlocked?.(x,z,.45,0))
            return false;
        const pole=new THREE.Mesh(new THREE.BoxGeometry(.18,3.7,.18),
            new THREE.MeshLambertMaterial({color:0x667984}));
        pole.position.set(x,1.85,z);root.add(pole);
        const backing=new THREE.Mesh(new THREE.BoxGeometry(5.8,1.45,.3),
            new THREE.MeshLambertMaterial({color:0x203b47}));
        backing.position.set(x,3.45,z);root.add(backing);
        const title=DriverChicagoNeighborhoods.label(route.name,route.signColor);
        if(title){
            title.position.set(x,3.45,z+.18);
            title.scale.set(5.55,1.32,1);
            root.add(title);
        }
        const mat=new THREE.MeshBasicMaterial({
            color:0xf3d49c,transparent:true,opacity:0,depthWrite:false});
        const strip=new THREE.Mesh(new THREE.BoxGeometry(5.4,.12,.07),mat);
        strip.position.set(x,4.27,z+.23);
        root.add(strip);lights.push(mat);
        return true;
    }

    static attach(city) {
        if(city?.preset?.id!=='chicago'||!city.chicagoStadium||
            !city.chicagoSoldierField||!city.chicagoNeighborhoods?.pier)
            return null;
        if(city.chicagoAccessR55?.root?.parent===city.cityGroup)
            return city.chicagoAccessR55;
        const root=new THREE.Group();
        root.name='chicago-landmark-access-r55';
        const lights=[],results=[];
        city.cityGroup.add(root);
        for(const route of this.ROUTES){
            const status=this.sampleRoute(city,route);
            const info={id:route.id,name:route.name,
                from:[...route.from],to:[...route.to],...status};
            if(status.open){
                const geometry=this.addLane(city,root,route);
                info.markings=geometry.markCount;
                info.sign=this.addSign(city,root,route,lights);
            }
            results.push(info);
        }
        city.chicagoAccessR55={root,results,lights,lastLevel:-1};
        this.update(city);
        return city.chicagoAccessR55;
    }

    static update(city) {
        const state=city?.chicagoAccessR55;
        if(!state||state.root.parent!==city.cityGroup)return;
        const level=Math.max(0,Math.min(1,city.chicagoNightState?.level||0));
        const q=Math.round(level*24);
        if(q===state.lastLevel)return;
        state.lastLevel=q;
        for(const light of state.lights)light.opacity=.78*q/24;
    }

    static audit(city) {
        const state=city?.chicagoAccessR55;
        return {installed:!!state?.root,
            routes:state?.results.map(r=>({
                id:r.id,open:r.open,reason:r.reason,
                distance:r.length||0,markings:r.markings||0,
                sign:!!r.sign
            }))||[],
            fieldHeights: {
                wrigley:this.stadiumGroundAt(city,-280,200),
                soldier:this.stadiumGroundAt(city,280,-280)
            },
            waterChecks:this.ROUTES.map(r=>({
                id:r.id,
                startDry:!city?.isWaterAt?.(...r.from),
                endDry:!city?.isWaterAt?.(...r.to)
            }))
        };
    }
}
DriverChicagoLandmarkAccessR55.install();
if(typeof window!=='undefined')
    window.DriverChicagoLandmarkAccessR55=DriverChicagoLandmarkAccessR55;
