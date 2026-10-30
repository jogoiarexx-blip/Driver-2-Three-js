        /**
         * ============================================================================
         * MÓDULO 4.5: SISTEMA DE PEDESTRES QUE SALTAM NA CALÇADA & BLOQUEIOS POLICIAIS
         * No Driver 2 original, pedestres sempre saltam para o lado (Dive/Dodge)!
         * ============================================================================
         */
        class PedestrianAndRoadblockManager {
            constructor(scene) {
                this.scene = scene;
                this.pedestrians = [];
                this.femalePedestrian = typeof DriverFemalePedestrian==='function'?
                    new DriverFemalePedestrian(this):null;
                this.malePedestrian=typeof DriverMalePedestrian==='function'?
                    new DriverMalePedestrian(this):null;
                this.variantPedestrians=typeof DriverPedestrianVariants==='function'?
                    new DriverPedestrianVariants(this):null;
                this.uploadedCrowd=typeof DriverUploadedPedestrianCrowd==='function'?
                    new DriverUploadedPedestrianCrowd(this):null;
                this.roadblocks = [];
                this.roadblockOfficers = [];
                this.officerTime = 0;
                this.group = new THREE.Group();
                this.scene.add(this.group);
            }

            spawnCityPedestrians(city=null,focus={x:0,z:-20}) {
                // Uma única frota de 28 personagens e sem animações
                // exigindo esqueleto/CPU em personagens distantes.
                // Preserva o rig GLB antes da limpeza dos objetos da cidade anterior.
                this.uploadedCrowd?.release();
                this.femalePedestrian?.release();
                this.malePedestrian?.release();
                this.variantPedestrians?.release();
                GPUResourceUtils.disposeSubtree(this.group);
                while(this.group.children.length>0)
                    this.group.remove(this.group.children[0]);
                this.pedestrians=[];
                this.roadblocks=[];
                this.roadblockOfficers=[];
                this.officerTime=0;
                this.city=city;
                if(city)city.activePedestrianCrossings=[];
                this.pedestrianClock=0;

                const blocks=typeof DriverPedestrianSidewalks!=='undefined'?
                    DriverPedestrianSidewalks.pick(city,focus,28):[];
                this.pedestrianBlocks=blocks;
                for(let i=0;i<28;i++){
                    const block=blocks[i]||{x:40+(i%4)*80,z:-200+Math.floor(i/4)*80};
                    const route=typeof DriverPedestrianSidewalks!=='undefined'?
                        DriverPedestrianSidewalks.route(block):[
                            {x:block.x-23,z:block.z-23},
                            {x:block.x+23,z:block.z-23},
                            {x:block.x+23,z:block.z+23},
                            {x:block.x-23,z:block.z+23}
                        ];
                    const edge=i%4,t=.16+(i%3)*.16;
                    const p0=route[edge],p1=route[(edge+1)%4];
                    const x=p0.x+(p1.x-p0.x)*t;
                    const z=p0.z+(p1.z-p0.z)*t;
                    const pedGroup=new THREE.Group();
                    // Apenas o contêiner lógico; os visuais são GLBs carregados.
                    // Ficar vazio durante carregamento é intencional.
                    const surface=city?.getSidewalkHeightAt?.(x,z) ?? .35;
                    pedGroup.position.set(x,surface,z);
                    this.group.add(pedGroup);
                    this.pedestrians.push({
                        mesh:pedGroup,x,z,route,block,nextCorner:(edge+1)%4,
                        walkSpeed:2.2+(i%5)*.22,
                        waitTimer:0,diveTimer:0,diveVx:0,diveVz:0,
                        walkPhase:i*.9,dir:i%2?1:-1,arms:[],legs:[],
                        visualClock:i*.37,stepRate:0,lookClock:0,
                        crossing:null,waitingCrossingPlan:null,
                        walkCorners:0,signalWaitElapsed:0,
                        sleepTick:0,visibleTime:0
                    });
                }
                // As cinco fontes usam suas vagas originais; o restante é
                // clonado com rig independente, nunca um humano procedural.
                // O catálogo vai preenchendo as vagas conforme cada GLB chega.
                const populate=()=>this.uploadedCrowd?.fill();
                this.femalePedestrian?.attachToFirst();
                this.femalePedestrian?.load().then(populate);
                this.malePedestrian?.attachToPedestrian();
                this.malePedestrian?.load().then(populate);
                this.variantPedestrians?.attach();
                this.variantPedestrians?.load().then(populate);
                populate();
            }

            recycleDistantPedestrians(focus,dt){
                this.pedestrianClock=(this.pedestrianClock||0)+Math.max(0,dt);
                if(this.pedestrianClock<1.1||
                    typeof DriverPedestrianSidewalks==='undefined')return 0;
                this.pedestrianClock=0;
                if(!Number.isFinite(focus?.x)||!Number.isFinite(focus?.z))
                    return 0;
                // Mantém somente 28 meshes, realocando alguns que já
                // estão fora da câmera para bairros próximos do jogador.
                const candidates=DriverPedestrianSidewalks.pick(
                    this.city,focus,28).filter(b=>{
                        const d=Math.hypot(b.x-focus.x,b.z-focus.z);
                        return d>95&&d<205;
                    });
                if(!candidates.length)return 0;
                let changed=0;
                for(const p of this.pedestrians){
                    if(changed>=3)break;
                    if(Math.hypot(p.x-focus.x,p.z-focus.z)<260)continue;
                    const block=candidates[
                        (this.relocationCursor||0)%candidates.length
                    ];
                    this.relocationCursor=(this.relocationCursor||0)+1;
                    const route=DriverPedestrianSidewalks.route(block);
                    const edge=(this.relocationCursor+p.nextCorner)%4;
                    const start=DriverPedestrianSidewalks.point(route,edge,.2);
                    if(!DriverPedestrianSidewalks.permitted(this.city,
                        start.x,start.z))continue;
                    p.block=block;p.route=route;
                    p.nextCorner=(edge+1)%4;
                    p.x=start.x;p.z=start.z;
                    p.waitTimer=.8;p.diveTimer=0;
                    p.crossing=null;p.waitingCrossingPlan=null;
                    p.walkCorners=0;p.signalWaitElapsed=0;
                    p.mesh.position.set(p.x,
                        this.city?.getSidewalkHeightAt?.(p.x,p.z) ?? .35,p.z);
                    p.mesh.visible=false;
                    changed++;
                }
                return changed;
            }

            spawnPoliceRoadblocks(preset, options = {}) {
                // Missão Fura-Bloqueios mantém as posições fixas.
                // Em perseguições comuns, o diretor fornece posições dinâmicas.
                const dynamic = !!options.dynamic;
                const barrierLocations = options.locations || [
                    { x: 0, z: -60 },
                    { x: -80, z: 10 },
                    { x: 80, z: -30 }
                ];

                const sawhorseMat = new THREE.MeshLambertMaterial({ color: 0xf97316 });
                const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
                const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

                barrierLocations.forEach(loc => {
                    const offsets = dynamic ? [-4, 0, 4] : [-6, -2, 2, 6];
                    for (const offset of offsets) {
                        const barrier = new THREE.Group();
                        const beam = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.35, 0.35), sawhorseMat);
                        beam.position.y = 0.85;
                        const topStripe = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.15, 0.38), stripeMat);
                        topStripe.position.y = 0.85;
                        const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.6), sawhorseMat);
                        leg1.position.set(-1.1, 0.45, 0);
                        const leg2 = leg1.clone();
                        leg2.position.x = 1.1;
                        barrier.add(beam, topStripe, leg1, leg2);
                        // Baliza piscante sem PointLight: mantém leveza no celular.
                        const beacon = new THREE.Mesh(
                            new THREE.BoxGeometry(0.30, 0.30, 0.30), beaconMat
                        );
                        beacon.position.set(0, 1.18, 0);
                        barrier.add(beacon);

                        barrier.position.set(
                            loc.x + (loc.axis === 'x' ? 0 : offset),
                            0,
                            loc.z + (loc.axis === 'x' ? offset : 0)
                        );
                        if (loc.axis === 'x') barrier.rotation.y = Math.PI * 0.5;
                        this.group.add(barrier);

                        this.roadblocks.push({
                            mesh: barrier,
                            x: barrier.position.x,
                            z: barrier.position.z,
                            dynamic,
                            arming: dynamic ? 1.25 : 0,
                            beacon, warningStripe: topStripe,
                            blinkClock: 0,
                            vy: 0, vx: 0, vz: 0,
                            smashed: false
                        });
                    }
                });
                // Dois agentes nas calçadas laterais, fora da faixa de rolagem.
                if (dynamic) barrierLocations.forEach(loc => this.spawnRoadblockOfficers(loc));
            }

            spawnRoadblockOfficers(loc) {
                // Agentes também usam os GLBs do usuário, sem corpos em caixas.
                for (const sign of [-1, 1]) {
                    const group = new THREE.Group();
                    const arms = [], legs = [];
                    // Lados da avenida, sem bloquear a pista de rolamento.
                    const along = loc.axis === 'x' ?
                        { x: loc.x, z: loc.z + sign * 12.6 } :
                        { x: loc.x + sign * 12.6, z: loc.z };
                    group.position.set(along.x, 0, along.z);
                    group.rotation.y = loc.axis === 'x' ? sign * Math.PI / 2 :
                        sign > 0 ? -Math.PI / 2 : Math.PI / 2;
                    this.group.add(group);
                    const officer={
                        mesh: group, arms, legs, x: along.x, z: along.z,
                        axis: loc.axis, side: sign, t: sign * 0.7,
                        retreat: 0, dynamic: true
                    };
                    this.roadblockOfficers.push(officer);
                    this.uploadedCrowd?.attachOfficer(officer);
                }
            }

            updateRoadblockOfficers(dt, playerCar) {
                this.officerTime += Math.max(0, dt);
                for (const officer of this.roadblockOfficers) {
                    const dx = (playerCar?.x ?? Infinity) - officer.x;
                    const dz = (playerCar?.z ?? Infinity) - officer.z;
                    const near = Math.hypot(dx, dz) < 20;
                    officer.retreat += ((near ? 1 : 0) - officer.retreat) *
                        Math.min(1, dt * 5);
                    const away = officer.side * officer.retreat * 2.0;
                    officer.mesh.position.x = officer.x +
                        (officer.axis === 'z' ? away : 0);
                    officer.mesh.position.z = officer.z +
                        (officer.axis === 'x' ? away : 0);
                    officer.t += dt * 3;
                    // O sinal de parar é animado pelos ossos do GLB.
                    this.uploadedCrowd?.animateOfficer(officer,dt);
                }
            }

            clearDynamicRoadblocks() {
                const keep = [];
                for (const block of this.roadblocks) {
                    if (!block.dynamic) { keep.push(block); continue; }
                    GPUResourceUtils.disposeSubtree(block.mesh);
                    block.mesh.parent?.remove(block.mesh);
                }
                this.roadblocks = keep;
                this.roadblockOfficers = this.roadblockOfficers.filter(officer => {
                    if (!officer.dynamic) return true;
                    this.uploadedCrowd?.releaseOfficer(officer);
                    GPUResourceUtils.disposeSubtree(officer.mesh);
                    officer.mesh.parent?.remove(officer.mesh);
                    return false;
                });
            }

            update(dt, vehicles, audio, playerCar = vehicles[0],
                onBarrierImpact = null, focusPosition = null) {
                this.updateRoadblockOfficers(dt, playerCar);
                // Pedestres percorrem o contorno das calçadas em vez de
                // marchar em linhas retas cruzando vias sem observar tráfego.
                // Fora do raio de renderização, pula atualizações frequentes.
                const focus=focusPosition||
                    (playerCar?{x:playerCar.x,z:playerCar.z}:
                    vehicles?.[0]||{x:0,z:-20});
                this.recycleDistantPedestrians(focus,dt);
                for(const p of this.pedestrians){
                    const dist=Math.hypot(p.x-focus.x,p.z-focus.z);
                    p.mesh.visible=dist<235;
                    if(!p.mesh.visible){
                        p.sleepTick=(p.sleepTick||0)+dt;
                        if(p.sleepTick<.5)continue;
                        p.sleepTick=0;
                        continue;
                    }
                    const state=typeof DriverPedestrianSidewalks!=='undefined'?
                        DriverPedestrianSidewalks.step(p,dt,this.city,vehicles):
                        {state:'walk',dx:0,dz:p.dir};
                    if(state.newDodge && playerCar && audio)
                        audio.playPedestrianDodgeVoice?.();
                    const moving=state.state==='walk'||state.state==='crossing';
                    const crossing=state.state==='crossing';
                    const targetRate=moving?(crossing?12.0:7.0):0;
                    p.stepRate=(p.stepRate||0)+
                        (targetRate-(p.stepRate||0))*Math.min(1,dt*8);
                    p.walkPhase+=dt*p.stepRate;
                    p.visualClock=(p.visualClock||0)+dt;
                    if((state.dx||state.dz)&&moving)
                        p.mesh.rotation.y=Math.atan2(state.dx,state.dz);
                    if(p.glbFemale)
                        this.femalePedestrian?.update(p,dt,moving,crossing);
                    if(p.glbMale)
                        this.malePedestrian?.update(p,dt,moving,crossing);
                    if(p.glbVariant)
                        this.variantPedestrians?.update(p,dt,moving,crossing);
                    if(p.glbCrowd)
                        this.uploadedCrowd?.update(p,dt,moving,crossing,dist);
                    // Antecipação na passada, leve inclinação ao correr.
                    // A esquiva não altera a posição ou a colisão.
                    p.mesh.rotation.z=state.state==='dodge'?
                        .42*(p.dodgeSide||1):crossing?
                        Math.sin(p.walkPhase)*.055:0;
                    if(state.state==='signal_wait'){
                        p.mesh.rotation.y+=
                            Math.sin(p.visualClock*1.15)*dt*.34;
                    }
                    // Os pés acompanham o piso: y=.35 no passeio e
                    // descem para y=0 durante a travessia. O rig GLB
                    // já traz o balanço de caminhada: sem bob artificial.
                    const pavement=this.city?.getSidewalkHeightAt?.(p.x,p.z) ?? .35;
                    p.mesh.position.set(p.x,pavement,p.z);
                }

                // Publica apenas travessias ativas. A IA civil enxerga
                // esta lista sem lançar raios contra todos os pedestres.
                if(this.city)this.city.activePedestrianCrossings=
                    this.pedestrians.filter(p=>p.crossing&&
                        p.mesh.visible);
                // 2. Atualiza Barricadas Policiais Destrutíveis
                // Vários cavaletes podem cair no mesmo frame; só gera um
                // áudio/evento de impacto por veículo, evitando som duplicado.
                const impactedVehicles = new Set();
                for (let i = 0; i < this.roadblocks.length; i++) {
                    const rb = this.roadblocks[i];
                    if (!rb.smashed) {
                        rb.arming = Math.max(0, (rb.arming || 0) - dt);
                        rb.blinkClock = (rb.blinkClock || 0) + dt;
                        if (rb.beacon) {
                            rb.beacon.visible = !rb.dynamic ||
                                Math.floor(rb.blinkClock * (rb.arming>0?8:3)) % 2 === 0;
                        }
                        // Só o veículo dirigido pelo jogador destrói barricadas.
                        // Viaturas da IA não podem eliminar seu próprio bloqueio
                        // nem concluir a missão Fura-Bloqueios no lugar de Tanner.
                        for (const car of vehicles) {
                            if (car !== playerCar || rb.arming > 0) continue;
                            const dx = car.x - rb.x;
                            const dz = car.z - rb.z;
                            if (dx * dx + dz * dz < 5.5 && Math.abs(car.speed) > 4) {
                                rb.smashed = true;
                                rb.vx = Math.sin(car.heading) * Math.abs(car.speed) * 1.15 + (Math.random() - 0.5) * 8;
                                rb.vz = Math.cos(car.heading) * Math.abs(car.speed) * 1.15 + (Math.random() - 0.5) * 8;
                                rb.vy = 7 + Math.random() * 5;
                                if (!impactedVehicles.has(car)) {
                                    impactedVehicles.add(car);
                                    if (audio) audio.playCrash(0.5);
                                    if (typeof onBarrierImpact === 'function') {
                                        onBarrierImpact(car, rb, Math.abs(car.speed));
                                    }
                                }
                                break;
                            }
                        }
                    } else if (rb.mesh.position.y >= 0) {
                        rb.vy -= 20 * dt;
                        rb.mesh.position.x += rb.vx * dt;
                        rb.mesh.position.y += rb.vy * dt;
                        rb.mesh.position.z += rb.vz * dt;
                        rb.mesh.rotation.x += 8 * dt;
                        rb.mesh.rotation.z += 6 * dt;
                        if (rb.mesh.position.y < 0.2) {
                            rb.mesh.position.y = 0.2;
                            rb.vy = -rb.vy * 0.35;
                            rb.vx *= 0.75;
                            rb.vz *= 0.75;
                        }
                    }
                }
            }
        }

