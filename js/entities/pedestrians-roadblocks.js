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
            }

            clearDynamicRoadblocks() {
                const keep = [];
                for (const block of this.roadblocks) {
                    if (!block.dynamic) { keep.push(block); continue; }
                    GPUResourceUtils.disposeSubtree(block.mesh);
                    block.mesh.parent?.remove(block.mesh);
                }
                this.roadblocks = keep;
            }

            update(dt, vehicles, audio, playerCar = vehicles[0], onBarrierImpact = null) {
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
                                if (audio) audio.playCrash(0.5);
                                if (typeof onBarrierImpact === 'function') {
                                    onBarrierImpact(car, rb, Math.abs(car.speed));
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

