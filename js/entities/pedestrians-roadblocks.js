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
                this.roadblocks = [];
                this.roadblockOfficers = [];
                this.officerTime = 0;
                this.group = new THREE.Group();
                this.scene.add(this.group);
            }

            spawnCityPedestrians() {
                // Libera geometrias e materiais dos pedestres e bloqueios anteriores.
                GPUResourceUtils.disposeSubtree(this.group);
                while (this.group.children.length > 0) {
                    this.group.remove(this.group.children[0]);
                }
                this.pedestrians = [];
                this.roadblocks = [];
                this.roadblockOfficers = [];
                this.officerTime = 0;

                const shirtColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0xa855f7, 0xec4899, 0xf8fafc];
                const skinMat = new THREE.MeshLambertMaterial({ color: 0xfdba74 });
                const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });

                // Cria 28 pedestres caminhando próximo às calçadas dos quarteirões
                for (let i = 0; i < 28; i++) {
                    const pedGroup = new THREE.Group();
                    const shirtMat = new THREE.MeshLambertMaterial({ color: shirtColors[i % shirtColors.length] });

                    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.65, 0.22), pantsMat);
                    legs.position.y = 0.35;
                    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.26), shirtMat);
                    torso.position.y = 0.95;
                    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skinMat);
                    head.position.y = 1.45;

                    pedGroup.add(legs, torso, head);

                    // Posiciona nas bordas das calçadas
                    const avenueX = [-102, -58, -22, 18, 62, 102][i % 6];
                    const posZ = -150 + (i * 11) % 300;
                    pedGroup.position.set(avenueX, 0.35, posZ);
                    this.group.add(pedGroup);

                    this.pedestrians.push({
                        mesh: pedGroup,
                        x: avenueX,
                        z: posZ,
                        dir: (i % 2 === 0) ? 1 : -1,
                        diveTimer: 0,
                        diveVx: 0,
                        diveVz: 0,
                        walkPhase: Math.random() * 10
                    });
                }
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
                const uniform = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });
                const cap = new THREE.MeshLambertMaterial({ color: 0x0f172a });
                const skin = new THREE.MeshLambertMaterial({ color: 0xe5ad84 });
                const reflector = new THREE.MeshBasicMaterial({ color: 0xfde047 });
                for (const sign of [-1, 1]) {
                    const group = new THREE.Group();
                    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.87, 0.38), uniform);
                    body.position.y = 1.12;
                    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.33), skin);
                    head.position.y = 1.76;
                    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.16, 0.4), cap);
                    hat.position.y = 2.03;
                    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.13, 0.41), reflector);
                    vest.position.y = 1.15;
                    group.add(body, head, hat, vest);
                    const legs = [];
                    for (const side of [-1, 1]) {
                        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.72, 0.25), cap);
                        leg.position.set(side * 0.17, 0.37, 0);
                        group.add(leg);
                        legs.push(leg);
                    }
                    const arms = [];
                    for (const side of [-1, 1]) {
                        const arm = new THREE.Group();
                        arm.position.set(side * 0.39, 1.42, 0);
                        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.20), uniform);
                        mesh.position.y = -0.29;
                        arm.add(mesh);
                        group.add(arm);
                        arms.push(arm);
                    }
                    // Lados da avenida, sem bloquear a pista de rolamento.
                    const along = loc.axis === 'x' ?
                        { x: loc.x, z: loc.z + sign * 12.6 } :
                        { x: loc.x + sign * 12.6, z: loc.z };
                    group.position.set(along.x, 0, along.z);
                    group.rotation.y = loc.axis === 'x' ? sign * Math.PI / 2 :
                        sign > 0 ? -Math.PI / 2 : Math.PI / 2;
                    this.group.add(group);
                    this.roadblockOfficers.push({
                        mesh: group, arms, legs, x: along.x, z: along.z,
                        axis: loc.axis, side: sign, t: sign * 0.7,
                        retreat: 0, dynamic: true
                    });
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
                    const wave = Math.sin(officer.t * 2.7);
                    // Um braço sinaliza parar; o outro oscila ligeiramente.
                    officer.arms[0].rotation.z = -0.95 + wave * 0.22;
                    officer.arms[1].rotation.z = 0.18 + wave * 0.12;
                    officer.legs[0].rotation.x = officer.retreat * 0.17;
                    officer.legs[1].rotation.x = -officer.retreat * 0.17;
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
                    GPUResourceUtils.disposeSubtree(officer.mesh);
                    officer.mesh.parent?.remove(officer.mesh);
                    return false;
                });
            }

            update(dt, vehicles, audio, playerCar = vehicles[0], onBarrierImpact = null) {
                this.updateRoadblockOfficers(dt, playerCar);
                // 1. Atualiza Pedestres e Salto de Esquiva (Dive/Dodge clássico do Driver 2)
                for (let i = 0; i < this.pedestrians.length; i++) {
                    const p = this.pedestrians[i];

                    if (p.diveTimer > 0) {
                        p.diveTimer -= dt;
                        p.x += p.diveVx * dt;
                        p.z += p.diveVz * dt;
                        p.mesh.position.set(p.x, 0.35 + Math.sin((0.7 - p.diveTimer) * 4.5) * 0.6, p.z);
                        p.mesh.rotation.z = 1.25; // Deitado no ar mergulhando!
                        if (p.diveTimer <= 0) {
                            p.mesh.rotation.z = 0;
                            p.mesh.position.y = 0.35;
                        }
                        continue;
                    }

                    // Caminhada normal na calçada
                    p.z += p.dir * 3.4 * dt;
                    if (p.z > 180) p.dir = -1;
                    if (p.z < -180) p.dir = 1;
                    p.walkPhase += dt * 7;
                    p.mesh.position.set(p.x, 0.35 + Math.abs(Math.sin(p.walkPhase)) * 0.12, p.z);
                    p.mesh.rotation.y = p.dir > 0 ? 0 : Math.PI;

                    // Verifica se algum veículo está vindo rápido na direção do pedestre
                    for (let v = 0; v < vehicles.length; v++) {
                        const car = vehicles[v];
                        if (Math.abs(car.speed) < 6) continue;
                        const dx = p.x - car.x;
                        const dz = p.z - car.z;
                        const distSq = dx * dx + dz * dz;
                        if (distSq < 38) {
                            const dist = Math.sqrt(distSq) || 1;
                            p.diveTimer = 0.7;
                            p.diveVx = (dx / dist) * 11;
                            p.diveVz = (dz / dist) * 11;
                            if (v === 0 && audio) audio.playPedestrianDodgeVoice();
                            break;
                        }
                    }
                }

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

