/**
 * R53 - Navy Pier e Wrigley Field. Complemento incremental para Chicago.
 * A geometria visível é a fonte dos AABBs: nada de paredes invisíveis.
 * Luzes instanciadas, sem PointLight por lâmpada, compatível com Three r128.
 */
class DriverChicagoPierStadiumR53 {
    static install() {
        if (this.installed || typeof DriverChicagoNeighborhoods === 'undefined' ||
            typeof DriverChicagoGameplay === 'undefined') return;
        this.installed = true;
        const originalBuild = DriverChicagoNeighborhoods.build;
        DriverChicagoNeighborhoods.build = function(city) {
            const result = originalBuild.call(this, city);
            if (result && city?.preset?.id === 'chicago')
                DriverChicagoPierStadiumR53.attach(city);
            return result;
        };
        const originalUpdate = DriverChicagoGameplay.update;
        DriverChicagoGameplay.update = function(city, dt) {
            originalUpdate.call(this, city, dt);
            DriverChicagoPierStadiumR53.update(city, dt);
        };
    }

    // R54: geométrica da madeira: y=.54 na plataforma, rampa linear
    // desde a avenida x=320. Evita rodas afundadas e subida abrupta.
    static deckHeightAt(x,z) {
        if(!Number.isFinite(x)||!Number.isFinite(z))return null;
        const lateral=Math.abs(z+40);
        if(x>=320&&x<327&&lateral<=7.1)
            return .54*(x-320)/7;
        if(x>=327&&x<=411&&lateral<=7.8)return .54;
        return null;
    }

    // R54: só amostrar trajetória no entorno dos obstáculos dos estádios
    // e do píer. Evita atravessar guarda-corpos em quedas temporárias de FPS.
    static needsSweep(city,x0,z0,x1,z1) {
        if(city?.preset?.id!=='chicago')return false;
        const near=(x,z)=>
            (x>=310&&x<=416&&z>=-58&&z<=-22) ||
            (x>=-322&&x<=-235&&z>=158&&z<=243) ||
            (x>=236&&x<=322&&z>=-324&&z<=-236);
        return near(x0,z0)||near(x1,z1);
    }

    static pathBlocked(city,x0,z0,x1,z1,radius=1.55,y=0) {
        const distance=Math.hypot(x1-x0,z1-z0);
        const steps=Math.max(1,Math.min(28,Math.ceil(distance/1.1)));
        for(let i=1;i<=steps;i++){
            const t=i/steps;
            if(city.isPointBlocked(x0+(x1-x0)*t,
                z0+(z1-z0)*t,radius,y))return true;
        }
        return false;
    }

    static material(hex, glow = false) {
        return glow
            ? new THREE.MeshBasicMaterial({color: hex, transparent: true, opacity: .08, depthWrite: false})
            : new THREE.MeshLambertMaterial({color: hex});
    }

    static box(parent, name, x, y, z, w, h, d, mat) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.name = name;
        mesh.position.set(x, y, z);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
    }

    static solid(city, state, name, x, y, z, w, h, d, mat) {
        const mesh = this.box(state.root, name, x, y, z, w, h, d, mat);
        const aabb = {
            minX: x - w / 2, maxX: x + w / 2,
            minZ: z - d / 2, maxZ: z + d / 2,
            chicagoR53: name
        };
        city.buildingBoxes.push(aabb);
        state.colliders.push(aabb);
        return mesh;
    }

    static collider(city, state, name, x, z, w, d) {
        // As arquibancadas instanciadas já são a geometria visível.
        const aabb={minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,
            chicagoR53:name};
        city.buildingBoxes.push(aabb);
        state.colliders.push(aabb);
    }

    static instances(parent, name, segments, mat) {
        if (!segments.length) return null;
        const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), mat, segments.length);
        mesh.name = name;
        const d = new THREE.Object3D();
        segments.forEach((p,i) => {
            d.position.set(p[0],p[1],p[2]);
            d.scale.set(p[3],p[4],p[5]);
            d.updateMatrix();
            mesh.setMatrixAt(i,d.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.frustumCulled = false;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
    }

    static attach(city) {
        const neighborhood = city.chicagoNeighborhoods;
        const pier = neighborhood?.pier;
        const stadium = city.chicagoStadium;
        if (!pier?.wheel || !stadium) return;
        if (city._pierStadiumR53?.root?.parent === city.cityGroup) return;
        const root = new THREE.Group();
        root.name = 'chicago-pier-stadium-r53';
        city.cityGroup.add(root);
        const state = {root, wheel:pier.wheel, cabins:[], night:[], colliders:[],
            pier: pier, stadium, bulbs:0, seats:0, lastNight:-1};
        const metal = this.material(0x4f6573);
        const steel = this.material(0xaab8c1);
        const timber = this.material(0x97775b);
        const warm = this.material(0xffd48a, true);
        const cyan = this.material(0x57d9ef, true);
        state.night.push(warm, cyan);

        // Deck: os trilhos visíveis são sólidos, com entrada livre pelo oeste.
        // A borda final impede que um carro atravesse a estrutura de madeira.
        for (const side of [-1,1]) {
            const edgeZ = -40 + side * 7.05;
            this.solid(city,state,'pier-side-guard-'+side,
                371,1.05,edgeZ,75,1.55,.35,steel);
            const segments=[];
            for (let x=337; x<=405; x+=8) {
                segments.push([x,1.75,edgeZ,.16,.85,.16]);
                segments.push([x,.30,edgeZ,.25,.38,.35]);
            }
            this.instances(root,'pier-guard-posts-'+side,segments,metal);
        }
        this.solid(city,state,'pier-eastern-end',
            409.9,1.05,-40,.48,1.5,14.2,steel);
        // Dois montantes no alinhamento da marquise, em vez de antiga
        // barra baixa que atravessava o carro visualmente.
        for(const side of [-1,1])
            this.solid(city,state,'pier-entry-post-'+side,
                333,2.26,-40+side*6.95,.58,4.52,.58,metal);
        // Madeira, parafusos e faixas de passagem são decorativos, nunca AABBs.
        const planks=[];
        for(let x=332;x<=406;x+=1.65)
            planks.push([x,.567,-40,.075,.028,13.8]);
        this.instances(root,'pier-plank-joints',planks,timber);
        const walkway=[];
        for(let x=334;x<=406;x+=5)
            for(const side of [-1,1])
                walkway.push([x,.589,-40+side*3.1,1.6,.018,.07]);
        this.instances(root,'pier-walkway-marks',walkway,steel);

        // Duas bases físicas, alinhadas aos suportes já desenhados.
        for (const x of [373.8,384.2]) {
            this.solid(city,state,'wheel-footing-'+x,
                x,.52,-41,2.35,1.04,2.35,metal);
            this.box(root,'wheel-anchor-bolt',x,1.07,-41,
                1.5,.12,1.5,steel);
        }
        // Quiosques afastados do eixo central, colisores iguais ao volume visível.
        const kiosks=[
            [349,-44.15,0x8a463b],[397,-35.85,0x3f6676],
            [404,-44.15,0x7c6644]
        ];
        for(const [x,z,color] of kiosks) {
            const wall=this.material(color);
            this.solid(city,state,'pier-kiosk-'+x,
                x,1.55,z,3.2,2.75,2.5,wall);
            this.box(root,'pier-kiosk-roof',x,3.05,z,4.0,.34,3.35,metal);
            this.box(root,'pier-kiosk-window',x,2.03,z+(z<-40?1.255:-1.255),
                2.1,.9,.04,steel);
            const sign=this.box(root,'pier-kiosk-sign',x,2.95,
                z+(z<-40?1.36:-1.36),2.65,.24,.09,warm);
            state.night.push(sign.material);
        }

        // Roda já existente continua sendo a mesma: adicionamos dois aros,
        // lâmpadas instanciadas, cabines com teto e rotação real.
        const wheel = pier.wheel;
        const ringMat=this.material(0xd6e2e5);
        for(const z of [-1.15,1.15]) {
            const outer=new THREE.Mesh(
                new THREE.TorusGeometry(10.2,.16,5,56),ringMat);
            outer.position.z=z;
            outer.name='pier-wheel-secondary-rim';
            wheel.add(outer);
            const glow=new THREE.Mesh(
                new THREE.TorusGeometry(10.26,.065,4,64),
                z<0?warm:cyan);
            glow.position.z=z*1.05;
            wheel.add(glow);
        }
        const gondolas=wheel.children.filter(m =>
            m.isMesh && m.geometry?.type==='BoxGeometry' &&
            Math.hypot(m.position.x,m.position.y)>9.1);
        const roofMaterial=this.material(0xf0dfb4);
        for(const cabin of gondolas) {
            const roof=this.box(cabin,'gondola-roof',0,1.02,0,2.25,.22,1.85,roofMaterial);
            roof.receiveShadow=false;
            this.box(cabin,'gondola-window',0,.20,.816,1.48,.60,.035,metal);
        }
        state.cabins=gondolas;
        const dummy=new THREE.Object3D();
        const sphere=new THREE.SphereGeometry(.17,5,4);
        for(let parity=0;parity<2;parity++){
            const batch=new THREE.InstancedMesh(sphere,parity?cyan:warm,24);
            batch.name='pier-night-bulbs-'+parity;
            for(let i=0;i<24;i++){
                const theta=(i*2+parity)*Math.PI/24;
                dummy.position.set(Math.cos(theta)*10.25,
                    Math.sin(theta)*10.25, parity?1.33:-1.33);
                dummy.scale.set(1,1,1);
                dummy.updateMatrix();
                batch.setMatrixAt(i,dummy.matrix);
            }
            batch.instanceMatrix.needsUpdate=true;
            batch.frustumCulled=false;
            wheel.add(batch);
            state.bulbs+=24;
        }
        // Luz de piso: placas transparentes, sem dezenas de PointLights.
        const poolMat=new THREE.MeshBasicMaterial({
            color:0xffd5a1,transparent:true,opacity:0,depthWrite:false,
            side:THREE.DoubleSide
        });
        state.night.push(poolMat);
        for(const x of [344,370,398]) {
            const pool=new THREE.Mesh(new THREE.CircleGeometry(3.4,12),poolMat);
            pool.rotation.x=-Math.PI/2;
            pool.position.set(x,.592,-40);
            pool.name='pier-night-light-pool';
            root.add(pool);
        }

        // Wrigley Field no lote já reservado em (-280,200):
        // arquibancadas com um só draw call e colisores na sua base real.
        const {x:sx,z:sz}=stadium;
        const seatSegments=[];
        for(let row=0;row<4;row++){
            for(let p=-12;p<=12;p+=4) {
                const h=1.0+row*.70;
                seatSegments.push([sx+p,h,sz-13.7-row*1.25,3.75,.30,1.14]);
                for(const sign of [-1,1])
                    seatSegments.push([sx+sign*(13.7+row*1.25),h,sz+p,
                        1.14,.30,3.75]);
            }
        }
        this.instances(root,'wrigley-bleachers',seatSegments,
            this.material(0x738389));
        state.seats=seatSegments.length;
        // O campo é acessível; a colisão das arquibancadas não cobre o gramado.
        for(const side of [-1,1])
            this.collider(city,state,'wrigley-side-stands-'+side,
                sx+side*15.575,sz,4.9,27.75);
        this.collider(city,state,'wrigley-back-stands',
            sx,sz-15.575,27.75,4.9);
        const paint=this.material(0xede9d1);
        for(const side of [-1,1]){
            const foul=this.box(root,'wrigley-foul-line',
                sx+side*6.9,.16,sz+1.0,16.5,.055,.12,paint);
            foul.rotation.y=side*.73;
            this.box(root,'wrigley-foul-pole',sx+side*12,5.5,sz-12,
                .18,11,.18,this.material(0xf4dc66));
        }
        this.box(root,'wrigley-home-plate',sx,.165,sz+8.1,
            1.3,.035,1.3,paint).rotation.y=Math.PI/4;
        const green=this.material(0x1c5b44);
        this.box(root,'wrigley-scoreboard',sx,10.1,sz-19.1,
            13.4,4.8,.65,green);
        const scoreGlow=this.box(root,'wrigley-score-lights',sx,10.8,sz-19.53,
            10.5,.3,.08,warm);
        state.night.push(scoreGlow.material);
        for(const side of [-1,1]){
            const towerX=sx+side*22,towerZ=sz-20;
            this.box(root,'wrigley-light-tower',towerX,8,towerZ,
                .45,16,.45,metal);
            for(let i=0;i<4;i++){
                const lamp=this.box(root,'wrigley-floodlight',towerX+(i-1.5)*.65,
                    15.5,towerZ, .55,.60,.45,cyan);
                state.night.push(lamp.material);
            }
        }
        const tickets=DriverChicagoNeighborhoods.label('TICKETS',0xfacc15);
        if(tickets) {
            tickets.position.set(sx+30,4.9,sz+25);
            tickets.scale.set(8,1.9,1);
            root.add(tickets);
        }
        // O segundo estádio do mapa original fica ao sul do Museum Campus.
        // Seu volume e seus colliders são construídos no CityBuilder.
        const soldier=city.chicagoSoldierField;
        if(soldier){
            const label=DriverChicagoNeighborhoods.label('SOLDIER FIELD',0xfde68a);
            if(label){
                label.position.set(soldier.x,8.9,soldier.z-19.55);
                label.scale.set(14,3.1,1);
                root.add(label);
            }
        }
        city._pierStadiumR53=state;
        neighborhood.pier.enhanced=true;
        neighborhood.pier.colliders=state.colliders.filter(b =>
            b.chicagoR53.startsWith('pier-') || b.chicagoR53.startsWith('wheel-')).length;
        neighborhood.stadium={x:sx,z:sz,enhanced:true,seats:state.seats};
        if(city._spatialCollisions)city._spatialCollisions.boxes=null;
    }

    static update(city,dt) {
        const s=city?._pierStadiumR53;
        if(!s || s.root.parent!==city.cityGroup)return;
        const delta=Math.max(0,Math.min(.08,Number(dt)||0));
        s.wheel.rotation.z=(s.wheel.rotation.z+delta*.092)%(2*Math.PI);
        // Cabines permanecem verticais durante o giro.
        for(const cabin of s.cabins) cabin.rotation.z=-s.wheel.rotation.z;
        const level=city.chicagoNightState?.level || 0;
        const night=Math.max(0,Math.min(1,level));
        const quant=Math.round(night*32);
        if(quant!==s.lastNight) {
            s.lastNight=quant;
            for(const mat of new Set(s.night))
                mat.opacity=mat.color?.getHex?.()===0xffd5a1?
                    .20*night : .08+.85*night;
        }
    }

    static audit(city) {
        const s=city?._pierStadiumR53;
        return {installed:!!s,stadiumAt:city?.chicagoStadium?
            [city.chicagoStadium.x,city.chicagoStadium.z]:null,
            wheel:!!s?.wheel,seats:s?.seats||0,bulbs:s?.bulbs||0,
            visibleColliderCount:s?.colliders.length||0,
            rampHeightAtStart:this.deckHeightAt(320,-40),
            rampHeightAtMiddle:this.deckHeightAt(323.5,-40),
            platformHeight:this.deckHeightAt(379,-40),
            entranceClear:s ? !s.colliders.some(box=>379>box.minX &&
                379<box.maxX&&-40>box.minZ&&-40<box.maxZ) : null,
            gatePreserved:!!city?.chicagoStadium?.gate,
            soldierFieldAt:city?.chicagoSoldierField?
                [city.chicagoSoldierField.x,city.chicagoSoldierField.z]:null,
            pierDry:typeof DriverChicagoPS1Coastline!=='undefined'?
                !DriverChicagoPS1Coastline.waterAt(379,-40):null};
    }
}
DriverChicagoPierStadiumR53.install();
if(typeof window!=='undefined')window.DriverChicagoPierStadiumR53=DriverChicagoPierStadiumR53;
