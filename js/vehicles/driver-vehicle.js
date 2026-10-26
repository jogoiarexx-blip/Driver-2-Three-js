        /**
         * ============================================================================
         * MÓDULO 5: ENTIDADE DE VEÍCULO & FÍSICA MUSCLE-CAR ANOS 90
         * Inclui Botão Burnout (J-Turn), Capô/Porta-Malas Deformáveis e Sirene
         * ============================================================================
         */
        class DriverVehicle {
            constructor(scene, config) {
                this.scene = scene;
                this.name = config.name || '1970 Muscle V8';
                this.color = config.color || 0xd97706;
                this.bodyStyle = config.bodyStyle || 'muscle'; // 'muscle', 'bus', 'truck', 'limo'
                this.isPolice = !!config.isPolice;
                this.isTarget = !!config.isTarget;
                this.isSecret = !!config.isSecret;
                this.maxSpeed = config.maxSpeed || 52;
                this.accel = config.accel || 28;

                this.root = new THREE.Group();
                this.chassisTilt = new THREE.Group();
                this.root.add(this.chassisTilt);

                this.x = config.x || 0;
                this.y = 0;
                this.z = config.z || 0;
                this.vy = 0;
                this.heading = config.heading || 0;
                this.speed = 0;
                this.lateralVelocity = 0;
                this.steerAngle = 0;
                this.pitchAngle = 0;
                this.rollAngle = 0;

                // Estado de Dano, Deformação e Calotas (Driver 2)
                this.damage = config.initialDamage || 0;
                this.hubcaps = 4;
                this.isDrifting = false;
                this.isBurnout = false;
                this.sirenActive = false;
                this.sirenTimer = 0;

                this.hoodPivot = null;
                this.trunkPivot = null;
                this.wheels = [];
                this.buildCarMesh();
                this.updateTransform();
                this.scene.add(this.root);
            }

            buildCarMesh() {
                while (this.chassisTilt.children.length > 0) {
                    this.chassisTilt.remove(this.chassisTilt.children[0]);
                }
                this.wheels.forEach(w => this.root.remove(w));
                this.wheels = [];

                const bodyMat = new THREE.MeshLambertMaterial({ color: this.color });
                const secondaryMat = new THREE.MeshLambertMaterial({ color: this.isPolice ? 0xf8fafc : (this.isSecret ? 0xfacc15 : 0x18181b) });
                const glassMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
                const chromeMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });

                const zScale = (this.bodyStyle === 'bus') ? 1.55 : (this.bodyStyle === 'limo' ? 1.45 : (this.bodyStyle === 'truck' ? 1.32 : 1.0));
                this.chassisTilt.scale.set(1, 1, zScale);

                // Corpo central do chassi
                const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.72, 3.3), bodyMat);
                lowerBody.position.y = 0.72;
                lowerBody.castShadow = true;
                this.chassisTilt.add(lowerBody);

                // Geometria extra para Ônibus e Caminhão Baú (Exclusivos do Driver 2!)
                if (this.bodyStyle === 'bus') {
                    const busTop = new THREE.Mesh(new THREE.BoxGeometry(2.32, 1.15, 4.9), bodyMat);
                    busTop.position.set(0, 1.55, 0);
                    const busWindows = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.55, 4.6), glassMat);
                    busWindows.position.set(0, 1.68, 0);
                    this.chassisTilt.add(busTop, busWindows);
                } else if (this.bodyStyle === 'truck') {
                    const cargoBox = new THREE.Mesh(
                        new THREE.BoxGeometry(2.48, 1.85, 3.2),
                        new THREE.MeshLambertMaterial({ color: 0xf1f5f9 })
                    );
                    cargoBox.position.set(0, 1.75, -0.85);
                    this.chassisTilt.add(cargoBox);
                }

                // CAPÔ DIANTEIRO ARTICULADO (Abre/Amassa quando o carro bate!)
                this.hoodPivot = new THREE.Group();
                this.hoodPivot.position.set(0, 0.72, 0.95);
                const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(2.33, 0.70, 1.6), bodyMat);
                hoodMesh.position.set(0, 0, 0.8);
                this.hoodPivot.add(hoodMesh);

                // Blower Supercharger cromado no capô para o Carro Secreto!
                if (this.isSecret) {
                    const blower = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.85), chromeMat);
                    blower.position.set(0, 0.45, 0.75);
                    this.hoodPivot.add(blower);
                }
                this.chassisTilt.add(this.hoodPivot);

                // PORTA-MALAS TRASEIRO ARTICULADO (Abre/Amassa quando damage > 60%)
                this.trunkPivot = new THREE.Group();
                this.trunkPivot.position.set(0, 0.72, -0.95);
                const trunkMesh = new THREE.Mesh(new THREE.BoxGeometry(2.33, 0.70, 1.6), bodyMat);
                trunkMesh.position.set(0, 0, -0.8);
                this.trunkPivot.add(trunkMesh);
                this.chassisTilt.add(this.trunkPivot);

                // Faixa esportiva ou pintura branca nas portas da polícia
                if (this.isPolice) {
                    const doorPaint = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.65, 2.1), secondaryMat);
                    doorPaint.position.set(0, 0.72, 0);
                    this.chassisTilt.add(doorPaint);
                } else {
                    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.74, 3.32), secondaryMat);
                    stripe.position.y = 0.72;
                    this.chassisTilt.add(stripe);
                }

                // Cabine / Teto
                const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 2.35), this.isPolice ? secondaryMat : bodyMat);
                cabin.position.set(0, 1.35, -0.2);
                this.chassisTilt.add(cabin);

                // Para-brisas
                const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.52, 2.42), glassMat);
                windshield.position.set(0, 1.33, -0.2);
                this.chassisTilt.add(windshield);

                // Para-choques cromados dianteiro e traseiro
                const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.25, 0.25), chromeMat);
                frontBumper.position.set(0, 0.48, 2.58);
                const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.25, 0.25), chromeMat);
                rearBumper.position.set(0, 0.48, -2.58);
                this.chassisTilt.add(frontBumper, rearBumper);

                // Faróis dianteiros e lanternas traseiras
                const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
                const taillightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
                const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), headlightMat);
                hlLeft.position.set(-0.75, 0.78, 2.55);
                const hlRight = hlLeft.clone();
                hlRight.position.x = 0.75;

                // Feixes luminosos de farol no chão (Cone translúcido estilo PS1 Noturno)
                const beamGeo = new THREE.ConeGeometry(1.9, 9.5, 8, 1, true);
                beamGeo.rotateX(Math.PI / 2);
                const beamMat = new THREE.MeshBasicMaterial({
                    color: 0xfef08a,
                    transparent: true,
                    opacity: 0.16,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });
                this.headlightBeams = new THREE.Mesh(beamGeo, beamMat);
                this.headlightBeams.position.set(0, 0.45, 7.2);
                this.chassisTilt.add(this.headlightBeams);

                const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.1), taillightMat);
                tlLeft.position.set(-0.75, 0.78, -2.55);
                const tlRight = tlLeft.clone();
                tlRight.position.x = 0.75;
                this.chassisTilt.add(hlLeft, hlRight, tlLeft, tlRight);

                // Giroflex Policial
                if (this.isPolice) {
                    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.3), chromeMat);
                    barBase.position.set(0, 1.72, -0.1);
                    this.sirenRed = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.28), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
                    this.sirenRed.position.set(-0.38, 1.78, -0.1);
                    this.sirenBlue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.28), new THREE.MeshBasicMaterial({ color: 0x2563eb }));
                    this.sirenBlue.position.set(0.38, 1.78, -0.1);
                    this.chassisTilt.add(barBase, this.sirenRed, this.sirenBlue);
                }

                // Seta indicadora acima do carro-alvo em missões
                if (this.isTarget) {
                    const coneGeo = new THREE.ConeGeometry(0.6, 1.2, 4);
                    coneGeo.rotateX(Math.PI);
                    this.targetMarker = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
                    this.targetMarker.position.set(0, 3.3, 0);
                    this.chassisTilt.add(this.targetMarker);
                }

                // 4 Rodas
                const wheelGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.36, 12);
                wheelGeo.rotateZ(Math.PI / 2);
                const tireMat = new THREE.MeshLambertMaterial({ color: 0x111827 });

                const wheelPositions = [
                    { x: -1.18, y: 0.44, z: 1.55 },
                    { x: 1.18, y: 0.44, z: 1.55 },
                    { x: -1.18, y: 0.44, z: -1.55 },
                    { x: 1.18, y: 0.44, z: -1.55 }
                ];

                wheelPositions.forEach(pos => {
                    const wMesh = new THREE.Mesh(wheelGeo, tireMat);
                    wMesh.position.set(pos.x, pos.y, pos.z);
                    this.root.add(wMesh);
                    this.wheels.push(wMesh);
                });
            }

            updatePhysics(dt, input, cityBuilder, effects, audio, isPlayer = false) {
                const forwardThrottle = input.up ? 1 : (input.down ? -1 : 0);
                const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
                const handbrake = !!input.handbrake;
                const burnoutKey = !!input.sprint; // Botão dedicado de Burnout (SHIFT / C)

                const armorFactor = this.isSecret ? 0.35 : 1.0;
                const healthFactor = Math.max(0.38, 1 - (this.damage / 140));
                const effectiveMaxSpeed = this.maxSpeed * (burnoutKey ? 1.18 : 1.0) * healthFactor;

                // 1. Aceleração e Botão Burnout Clássico
                if (forwardThrottle > 0) {
                    const burst = burnoutKey ? 1.38 : 1.0;
                    this.speed += this.accel * burst * dt;
                } else if (forwardThrottle < 0) {
                    if (this.speed > 2) {
                        this.speed -= this.accel * 1.9 * dt;
                    } else {
                        this.speed -= this.accel * 0.75 * dt;
                    }
                } else {
                    this.speed *= Math.pow(0.4, dt);
                }

                if (handbrake) {
                    this.speed *= Math.pow(0.22, dt);
                }

                this.speed = Math.max(-effectiveMaxSpeed * 0.42, Math.min(effectiveMaxSpeed, this.speed));

                // 2. Direção, Botão Burnout (J-Turn / Sobesterço) e Drift
                const speedRatio = Math.min(1, Math.abs(this.speed) / 10);
                const directionSign = this.speed >= -0.1 ? 1 : -1;
                const turnMultiplier = burnoutKey ? 3.55 : (handbrake ? 3.2 : 2.35);
                const turnRate = turnMultiplier * Math.max(burnoutKey ? 0.65 : 0, speedRatio) * directionSign;

                this.steerAngle = steerInput * 0.45;
                this.heading += steerInput * turnRate * dt;

                const centrifugal = steerInput * (this.speed / this.maxSpeed);
                if ((handbrake || burnoutKey) && Math.abs(this.speed) > 8) {
                    this.lateralVelocity = THREE.MathUtils.lerp(this.lateralVelocity, -centrifugal * 15.5, dt * 6.5);
                } else {
                    this.lateralVelocity = THREE.MathUtils.lerp(this.lateralVelocity, -centrifugal * 4.5, dt * 8);
                }

                this.isBurnout = burnoutKey && (forwardThrottle > 0 || Math.abs(steerInput) > 0);
                this.isDrifting = this.isBurnout || (handbrake && Math.abs(this.speed) > 10) || (Math.abs(centrifugal) > 0.55 && Math.abs(this.speed) > 22);

                // 3. Suspensão Macia dos Anos 90 (Body Roll & Pitch)
                const targetPitch = (forwardThrottle > 0 ? (burnoutKey ? -0.085 : -0.055) : (forwardThrottle < 0 || handbrake ? 0.075 : 0));
                const targetRoll = -centrifugal * (handbrake || burnoutKey ? 0.19 : 0.13);
                this.pitchAngle = THREE.MathUtils.lerp(this.pitchAngle, targetPitch, dt * 9);
                this.rollAngle = THREE.MathUtils.lerp(this.rollAngle, targetRoll, dt * 8);

                this.chassisTilt.rotation.x = this.pitchAngle;
                this.chassisTilt.rotation.z = this.rollAngle;

                // Deformação Visual de Lataria (Capô e Porta-Malas abrindo/amassando com o Dano)
                if (this.hoodPivot && this.trunkPivot) {
                    if (this.damage > 35) {
                        const flap = Math.min(0.55, ((this.damage - 35) / 65) * 0.45) + Math.abs(Math.sin(Date.now() * 0.015)) * (Math.abs(this.speed) * 0.002);
                        this.hoodPivot.rotation.x = -flap;
                    } else {
                        this.hoodPivot.rotation.x = 0;
                    }
                    if (this.damage > 60) {
                        this.trunkPivot.rotation.x = Math.min(0.48, ((this.damage - 60) / 40) * 0.4);
                    } else {
                        this.trunkPivot.rotation.x = 0;
                    }
                }

                // 4. Ejeção de Calotas (Easter egg clássico do Driver 2 em curvas fortes!)
                if (this.isDrifting && this.hubcaps > 0 && Math.abs(centrifugal) > 0.68 && Math.random() < 0.028) {
                    this.hubcaps--;
                    effects.ejectHubcap(
                        this.x, this.y, this.z,
                        Math.cos(this.heading) * 9 * steerInput,
                        -Math.sin(this.heading) * 9 * steerInput,
                        isPlayer ? audio : null
                    );
                }

                // 5. Deslocamento no mundo + Rampa da Ponte Levadiça
                const vx = Math.sin(this.heading) * this.speed + Math.cos(this.heading) * this.lateralVelocity;
                const vz = Math.cos(this.heading) * this.speed - Math.sin(this.heading) * this.lateralVelocity;

                const nextX = this.x + vx * dt;
                const nextZ = this.z + vz * dt;

                const groundHeight = cityBuilder.getGroundHeightAt(nextX, nextZ);

                if (this.y > groundHeight + 0.08 || this.vy > 0) {
                    this.vy -= 24.0 * dt;
                    this.y += this.vy * dt;
                    if (this.y <= groundHeight) {
                        if (this.vy < -10 && audio && isPlayer) audio.playCrash(0.6);
                        this.y = groundHeight;
                        this.vy = 0;
                    }
                } else {
                    if (groundHeight > this.y + 0.02 && this.speed > 22) {
                        this.vy = (groundHeight - this.y) * 18;
                    }
                    this.y = groundHeight;
                }

                if (!cityBuilder.isPointBlocked(nextX, nextZ, 1.55, this.y)) {
                    this.x = nextX;
                    this.z = nextZ;
                } else {
                    if (Math.abs(this.speed) > 8) {
                        this.damage = Math.min(100, this.damage + Math.abs(this.speed) * 0.32 * armorFactor);
                        if (audio && isPlayer) audio.playCrash(Math.abs(this.speed) / 30);
                        if (this.hubcaps > 0 && Math.abs(this.speed) > 24) {
                            this.hubcaps--;
                            effects.ejectHubcap(this.x, this.y, this.z, -vx * 0.4, -vz * 0.4, isPlayer ? audio : null);
                        }
                    }
                    this.speed = -this.speed * 0.42;
                }

                // 6. Marcas de Pneu no Asfalto e Fumaça de Burnout/Drift
                if (this.isDrifting && this.y < 0.3) {
                    const rearLeftX = this.x - Math.sin(this.heading) * 1.5 - Math.cos(this.heading) * 1.05;
                    const rearLeftZ = this.z - Math.cos(this.heading) * 1.5 + Math.sin(this.heading) * 1.05;
                    const rearRightX = this.x - Math.sin(this.heading) * 1.5 + Math.cos(this.heading) * 1.05;
                    const rearRightZ = this.z - Math.cos(this.heading) * 1.5 - Math.sin(this.heading) * 1.05;

                    effects.addSkidMark(rearLeftX, rearLeftZ, this.heading);
                    effects.addSkidMark(rearRightX, rearRightZ, this.heading);
                    if (Math.random() < 0.75) {
                        effects.spawnTireSmoke(rearLeftX, this.y, rearLeftZ, false);
                        effects.spawnTireSmoke(rearRightX, this.y, rearRightZ, false);
                    }
                }

                // Fumaça preta espessa no capô quando o carro tem mais de 65% de dano
                if (this.damage > 65 && Math.random() < 0.45) {
                    effects.spawnTireSmoke(
                        this.x + Math.sin(this.heading) * 1.9,
                        this.y + 0.9,
                        this.z + Math.cos(this.heading) * 1.9,
                        true
                    );
                }

                // Giroflex da polícia piscando
                if (this.isPolice && this.sirenRed && this.sirenBlue) {
                    this.sirenTimer += dt * 10;
                    if (this.sirenActive) {
                        const flash = Math.sin(this.sirenTimer) > 0;
                        this.sirenRed.material.color.setHex(flash ? 0xff1111 : 0x450a0a);
                        this.sirenBlue.material.color.setHex(!flash ? 0x3b82f6 : 0x172554);
                    } else {
                        this.sirenRed.material.color.setHex(0x7f1d1d);
                        this.sirenBlue.material.color.setHex(0x1e3a8a);
                    }
                }

                if (this.targetMarker) {
                    this.targetMarker.rotation.y += dt * 3;
                    this.targetMarker.position.y = 3.2 + Math.sin(Date.now() * 0.008) * 0.35;
                }

                this.updateTransform();
            }

            updateTransform() {
                this.root.position.set(this.x, this.y, this.z);
                this.root.rotation.y = this.heading;
                if (this.wheels.length >= 2) {
                    this.wheels[0].rotation.y = this.steerAngle;
                    this.wheels[1].rotation.y = this.steerAngle;
                }
            }
        }

