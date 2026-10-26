        /**
         * ============================================================================
         * MÓDULO 6: CONSTRUTOR DAS 4 CIDADES (CHICAGO, HAVANA, LAS VEGAS, RIO)
         * Inclui Ponte Levadiça, Cristo Redentor no Rio, Cassinos em Vegas e Garagem Secreta
         * ============================================================================
         */
        class CityBuilder {
            constructor(scene, presetKey = 'chicago') {
                this.scene = scene;
                this.cityGroup = new THREE.Group();
                this.scene.add(this.cityGroup);

                this.buildingBoxes = [];
                this.destructibleProps = [];
                this.benches = [];
                this.bridgeRaised = false;
                this.bridgeAngle = 0.14;
                this.safeHouseZone = { x: -120, z: -120, radius: 9 };

                // Garagem Secreta com Portão e Interruptor a Pé (Nordeste X=120, Z=120)
                this.secretSwitchPos = { x: 102, z: 103 };
                this.secretGarageCenter = { x: 120, z: 120 };
                this.secretGateOpen = false;
                this.secretGateMesh = null;
                this.secretGateBoxIndex = -1;

                this.loadCityPreset(presetKey);
            }

            loadCityPreset(presetKey) {
                this.preset = CITY_PRESETS[presetKey] || CITY_PRESETS.chicago;

                // Limpa geometria anterior da cidade
                while (this.cityGroup.children.length > 0) {
                    this.cityGroup.remove(this.cityGroup.children[0]);
                }
                this.buildingBoxes = [];
                this.destructibleProps = [];
                this.benches = [];
                this.secretGateOpen = false;

                this.buildEnvironment();
            }

            buildEnvironment() {
                const asphTex = PS1TextureFactory.createAsphaltTexture();
                asphTex.repeat.set(36, 36);

                // 1. Base de Asfalto da Cidade
                const groundGeo = new THREE.PlaneGeometry(520, 520);
                groundGeo.rotateX(-Math.PI / 2);
                const groundMat = new THREE.MeshLambertMaterial({ map: asphTex });
                const ground = new THREE.Mesh(groundGeo, groundMat);
                this.cityGroup.add(ground);

                // 2. Canal Central (Rio Chicago / Baía de Havana / Canal da Orla do Rio)
                const riverGeo = new THREE.PlaneGeometry(520, 32);
                riverGeo.rotateX(-Math.PI / 2);
                const riverMat = new THREE.MeshBasicMaterial({ color: this.preset.waterColor });
                const river = new THREE.Mesh(riverGeo, riverMat);
                river.position.set(0, 0.06, 50);
                this.cityGroup.add(river);

                // Muretas nas margens do canal
                const wallMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
                const leftWall1 = new THREE.Mesh(new THREE.BoxGeometry(230, 1.5, 1.5), wallMat);
                leftWall1.position.set(-130, 0.75, 34);
                const leftWall2 = leftWall1.clone();
                leftWall2.position.z = 66;
                const rightWall1 = new THREE.Mesh(new THREE.BoxGeometry(230, 1.5, 1.5), wallMat);
                rightWall1.position.set(130, 0.75, 34);
                const rightWall2 = rightWall1.clone();
                rightWall2.position.z = 66;
                this.cityGroup.add(leftWall1, leftWall2, rightWall1, rightWall2);

                // 3. Ponte Basculante Central (X = 0, Z = 34..66)
                const bridgeMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
                const trussColor = this.preset.id === 'vegas' ? 0xd946ef : (this.preset.id === 'rio' ? 0x059669 : 0x991b1b);
                const trussMat = new THREE.MeshLambertMaterial({ color: trussColor });

                this.bridgeSouthLeaf = new THREE.Group();
                this.bridgeSouthLeaf.position.set(0, 0.1, 34);
                const deckS = new THREE.Mesh(new THREE.BoxGeometry(22, 0.5, 16), bridgeMat);
                deckS.position.set(0, 0, 8);
                const railS1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 16), trussMat);
                railS1.position.set(-10.5, 1.1, 8);
                const railS2 = railS1.clone();
                railS2.position.x = 10.5;
                this.bridgeSouthLeaf.add(deckS, railS1, railS2);

                this.bridgeNorthLeaf = new THREE.Group();
                this.bridgeNorthLeaf.position.set(0, 0.1, 66);
                const deckN = new THREE.Mesh(new THREE.BoxGeometry(22, 0.5, 16), bridgeMat);
                deckN.position.set(0, 0, -8);
                const railN1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 16), trussMat);
                railN1.position.set(-10.5, 1.1, -8);
                const railN2 = railN1.clone();
                railN2.position.x = 10.5;
                this.bridgeNorthLeaf.add(deckN, railN1, railN2);

                this.cityGroup.add(this.bridgeSouthLeaf, this.bridgeNorthLeaf);

                // 4. Monumentos Exclusivos por Cidade (Rio de Janeiro: Morro do Corcovado + Cristo Redentor + Praia)
                if (this.preset.id === 'rio') {
                    this.buildRioLandmarks();
                } else if (this.preset.id === 'vegas') {
                    this.buildVegasLandmarks();
                }

                // 5. Quarteirões, Calçadas, Esconderijo e Garagem Secreta
                const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x52525b });
                const coords = [-160, -80, 0, 80, 160];

                coords.forEach(bx => {
                    coords.forEach(bz => {
                        if (Math.abs(bz - 50) < 35) return;
                        if (bx === 0 && bz === 0) return;

                        const blockX = bx + 40;
                        const blockZ = bz - 40;
                        if (Math.abs(blockZ - 50) < 28) return;

                        const sw = new THREE.Mesh(new THREE.BoxGeometry(50, 0.35, 50), sidewalkMat);
                        sw.position.set(blockX, 0.175, blockZ);
                        this.cityGroup.add(sw);

                        if (blockX === -120 && blockZ === -120) {
                            this.buildSafeHouseBlock(blockX, blockZ);
                        } else if (blockX === 120 && blockZ === 120) {
                            this.buildSecretGarageCompound(blockX, blockZ);
                        } else if ((blockX + blockZ) % 160 === 0) {
                            this.buildParkBlock(blockX, blockZ);
                        } else {
                            const pal = this.preset.palettes[Math.floor(Math.random() * this.preset.palettes.length)];
                            const bTex = PS1TextureFactory.createBuildingTexture(pal.wall, pal.win);
                            const isHavana = this.preset.id === 'havana';
                            const h = isHavana ? (14 + Math.random() * 18) : (24 + Math.random() * 44);
                            const bMat = new THREE.MeshLambertMaterial({ map: bTex });
                            const bMesh = new THREE.Mesh(new THREE.BoxGeometry(38, h, 38), bMat);
                            bMesh.position.set(blockX, h / 2 + 0.35, blockZ);
                            this.cityGroup.add(bMesh);

                            this.buildingBoxes.push({
                                minX: blockX - 19.2, maxX: blockX + 19.2,
                                minZ: blockZ - 19.2, maxZ: blockZ + 19.2
                            });
                        }

                        this.spawnDestructibleProp(blockX - 23, blockZ - 23, 'cone');
                        this.spawnDestructibleProp(blockX + 23, blockZ - 23, 'trash');
                    });
                });
            }

            buildRioLandmarks() {
                // Morro do Corcovado ao fundo norte (Z = -210) com a estátua do Cristo Redentor
                const hillMat = new THREE.MeshLambertMaterial({ color: 0x14532d });
                const hill = new THREE.Mesh(new THREE.ConeGeometry(55, 78, 8), hillMat);
                hill.position.set(0, 39, -215);
                this.cityGroup.add(hill);

                // Pedestal e Cristo Redentor de braços abertos olhando para a cidade
                const statueMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
                const pedestal = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 6), new THREE.MeshLambertMaterial({ color: 0x64748b }));
                pedestal.position.set(0, 79, -215);
                const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 18, 3.2), statueMat);
                body.position.set(0, 91, -215);
                const arms = new THREE.Mesh(new THREE.BoxGeometry(19, 3.0, 2.6), statueMat);
                arms.position.set(0, 95, -215);
                const head = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.8, 3.2), statueMat);
                head.position.set(0, 101.5, -215);
                this.cityGroup.add(pedestal, body, arms, head);

                // Faixa de Areia de Copacabana na lateral Leste (X = 230)
                const sand = new THREE.Mesh(new THREE.PlaneGeometry(36, 480), new THREE.MeshBasicMaterial({ color: 0xfde047 }));
                sand.rotateX(-Math.PI / 2);
                sand.position.set(230, 0.08, 0);
                this.cityGroup.add(sand);
            }

            buildVegasLandmarks() {
                // Arcos Neon Brilhantes sobre a Strip central (X = 0)
                const neonColors = [0xf43f5e, 0x38bdf8, 0xfacc15, 0xa855f7];
                [-120, -40, 110].forEach((zPos, idx) => {
                    const archMat = new THREE.MeshBasicMaterial({ color: neonColors[idx % neonColors.length] });
                    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 16, 1.2), archMat);
                    leftPillar.position.set(-14, 8, zPos);
                    const rightPillar = leftPillar.clone();
                    rightPillar.position.x = 14;
                    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(30, 2.2, 1.5), archMat);
                    topBeam.position.set(0, 16, zPos);
                    this.cityGroup.add(leftPillar, rightPillar, topBeam);
                });
            }

            buildSecretGarageCompound(cx, cz) {
                // Pátio Secreto murado com portão sul acionado por interruptor a pé!
                const wallMat = new THREE.MeshLambertMaterial({ color: 0x312e81 });
                // Parede Norte, Leste e Oeste
                const wNorth = new THREE.Mesh(new THREE.BoxGeometry(36, 9, 2), wallMat);
                wNorth.position.set(cx, 4.5, cz + 17);
                const wWest = new THREE.Mesh(new THREE.BoxGeometry(2, 9, 36), wallMat);
                wWest.position.set(cx - 17, 4.5, cz);
                const wEast = new THREE.Mesh(new THREE.BoxGeometry(2, 9, 36), wallMat);
                wEast.position.set(cx + 17, 4.5, cz);
                this.cityGroup.add(wNorth, wWest, wEast);

                // Colisões das 3 paredes fixas
                this.buildingBoxes.push(
                    { minX: cx - 18, maxX: cx + 18, minZ: cz + 15.5, maxZ: cz + 18.5 },
                    { minX: cx - 18.5, maxX: cx - 15.5, minZ: cz - 18, maxZ: cz + 18 },
                    { minX: cx + 15.5, maxX: cx + 18.5, minZ: cz - 18, maxZ: cz + 18 }
                );

                // Portão Sul Móvel (Abre quando Tanner ativa o interruptor)
                const gateMat = new THREE.MeshLambertMaterial({ color: 0xa855f7 });
                this.secretGateMesh = new THREE.Mesh(new THREE.BoxGeometry(32, 8.5, 1.8), gateMat);
                this.secretGateMesh.position.set(cx, 4.25, cz - 17);
                this.cityGroup.add(this.secretGateMesh);

                this.secretGateBoxIndex = this.buildingBoxes.length;
                this.buildingBoxes.push({
                    minX: cx - 16.5, maxX: cx + 16.5,
                    minZ: cz - 18.2, maxZ: cz - 15.8
                });

                // Interruptor de Parede (Wall Switch) piscante na esquina sudoeste do pátio
                const switchPedestal = new THREE.Mesh(
                    new THREE.BoxGeometry(1.2, 2.2, 1.2),
                    new THREE.MeshLambertMaterial({ color: 0x1e293b })
                );
                switchPedestal.position.set(cx - 18, 1.1, cz - 17);
                this.switchLight = new THREE.Mesh(
                    new THREE.BoxGeometry(0.6, 0.6, 0.6),
                    new THREE.MeshBasicMaterial({ color: 0xd946ef })
                );
                this.switchLight.position.set(cx - 18, 2.4, cz - 17);
                this.cityGroup.add(switchPedestal, this.switchLight);

                this.secretSwitchPos = { x: cx - 18, z: cz - 17 };
                this.secretGarageCenter = { x: cx, z: cz };
            }

            unlockSecretGate() {
                if (this.secretGateOpen) return false;
                this.secretGateOpen = true;
                if (this.switchLight) this.switchLight.material.color.setHex(0x10b981);
                // Remove a caixa de colisão do portão para permitir a passagem
                if (this.secretGateBoxIndex >= 0 && this.buildingBoxes[this.secretGateBoxIndex]) {
                    this.buildingBoxes[this.secretGateBoxIndex] = { minX: 9999, maxX: 9999, minZ: 9999, maxZ: 9999 };
                }
                return true;
            }

            buildParkBlock(cx, cz) {
                const grass = new THREE.Mesh(
                    new THREE.BoxGeometry(44, 0.42, 44),
                    new THREE.MeshLambertMaterial({ color: this.preset.parkColor })
                );
                grass.position.set(cx, 0.21, cz);
                this.cityGroup.add(grass);

                const isTropical = (this.preset.id === 'havana' || this.preset.id === 'rio' || this.preset.id === 'vegas');
                const trunkMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
                const leafMat = new THREE.MeshLambertMaterial({ color: 0x15803d });

                for (let i = -1; i <= 1; i += 2) {
                    for (let j = -1; j <= 1; j += 2) {
                        const tx = cx + i * 12;
                        const tz = cz + j * 12;
                        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, isTropical ? 5.5 : 3.5, 6), trunkMat);
                        trunk.position.set(tx, isTropical ? 2.8 : 1.9, tz);
                        const crown = new THREE.Mesh(
                            new THREE.ConeGeometry(isTropical ? 3.8 : 3.2, isTropical ? 3.2 : 6.5, 7),
                            leafMat
                        );
                        crown.position.set(tx, isTropical ? 6.0 : 5.5, tz);
                        this.cityGroup.add(trunk, crown);
                    }
                }

                const bench = new THREE.Mesh(
                    new THREE.BoxGeometry(3.2, 0.8, 1.1),
                    new THREE.MeshLambertMaterial({ color: 0x78350f })
                );
                bench.position.set(cx, 0.7, cz);
                this.cityGroup.add(bench);
                this.benches.push({ x: cx, z: cz });
            }

            buildSafeHouseBlock(cx, cz) {
                const garage = new THREE.Mesh(
                    new THREE.BoxGeometry(30, 14, 30),
                    new THREE.MeshLambertMaterial({ color: 0x3f3f46 })
                );
                garage.position.set(cx, 7.2, cz);
                this.cityGroup.add(garage);

                this.buildingBoxes.push({
                    minX: cx - 15, maxX: cx + 15,
                    minZ: cz - 15, maxZ: cz + 15
                });

                const zoneGeo = new THREE.CylinderGeometry(4.5, 4.5, 0.3, 16);
                const zoneMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.75 });
                this.safeHouseBeacon = new THREE.Mesh(zoneGeo, zoneMat);
                this.safeHouseBeacon.position.set(cx, 0.4, cz + 19);
                this.cityGroup.add(this.safeHouseBeacon);
                this.safeHouseZone = { x: cx, z: cz + 19, radius: 5.5 };
            }

            spawnDestructibleProp(x, z, type) {
                let mesh;
                if (type === 'cone') {
                    mesh = new THREE.Mesh(
                        new THREE.ConeGeometry(0.45, 1.15, 6),
                        new THREE.MeshLambertMaterial({ color: 0xf97316 })
                    );
                    mesh.position.set(x, 0.6, z);
                } else {
                    mesh = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.5, 0.45, 1.2, 8),
                        new THREE.MeshLambertMaterial({ color: 0x64748b })
                    );
                    mesh.position.set(x, 0.6, z);
                }
                this.cityGroup.add(mesh);
                this.destructibleProps.push({
                    mesh, x, z, vx: 0, vy: 0, vz: 0, hit: false
                });
            }

            toggleBridge() {
                this.bridgeRaised = !this.bridgeRaised;
                return this.bridgeRaised;
            }

            update(dt, vehicles, onPropHitCallback) {
                const targetAngle = this.bridgeRaised ? 0.32 : 0.08;
                this.bridgeAngle = THREE.MathUtils.lerp(this.bridgeAngle, targetAngle, dt * 2.5);
                if (this.bridgeSouthLeaf && this.bridgeNorthLeaf) {
                    this.bridgeSouthLeaf.rotation.x = -this.bridgeAngle;
                    this.bridgeNorthLeaf.rotation.x = this.bridgeAngle;
                }

                // Anima abertura do portão da Garagem Secreta
                if (this.secretGateOpen && this.secretGateMesh && this.secretGateMesh.position.y > -4.5) {
                    this.secretGateMesh.position.y -= 6.5 * dt;
                }

                for (let i = 0; i < this.destructibleProps.length; i++) {
                    const p = this.destructibleProps[i];
                    if (!p.hit) {
                        for (let v = 0; v < vehicles.length; v++) {
                            const car = vehicles[v];
                            const dx = car.x - p.x;
                            const dz = car.z - p.z;
                            if (dx * dx + dz * dz < 4.2 && Math.abs(car.speed) > 3) {
                                p.hit = true;
                                p.vx = Math.sin(car.heading) * Math.abs(car.speed) * 1.1 + (Math.random() - 0.5) * 6;
                                p.vz = Math.cos(car.heading) * Math.abs(car.speed) * 1.1 + (Math.random() - 0.5) * 6;
                                p.vy = 6 + Math.random() * 5;
                                if (onPropHitCallback && v === 0) onPropHitCallback();
                                break;
                            }
                        }
                    } else {
                        p.vy -= 18 * dt;
                        p.mesh.position.x += p.vx * dt;
                        p.mesh.position.y += p.vy * dt;
                        p.mesh.position.z += p.vz * dt;
                        p.mesh.rotation.x += 6 * dt;
                        p.mesh.rotation.z += 5 * dt;

                        if (p.mesh.position.y < 0.45) {
                            p.mesh.position.y = 0.45;
                            p.vy = -p.vy * 0.4;
                            p.vx *= 0.8;
                            p.vz *= 0.8;
                        }
                    }
                }
            }

            getGroundHeightAt(x, z) {
                if (Math.abs(x) < 11.2 && z >= 34 && z <= 66) {
                    const distFromEdge = Math.min(z - 34, 66 - z);
                    return 0.15 + Math.sin(this.bridgeAngle) * distFromEdge;
                }
                return 0;
            }

            isPointBlocked(x, z, radius = 1.2, y = 0) {
                if (Math.abs(x) > 245 || Math.abs(z) > 245) return true;
                if (z > 33.5 && z < 66.5 && Math.abs(x) >= 11.0 && y < 1.8) return true;

                for (let i = 0; i < this.buildingBoxes.length; i++) {
                    const b = this.buildingBoxes[i];
                    if (x + radius > b.minX && x - radius < b.maxX &&
                        z + radius > b.minZ && z - radius < b.maxZ) {
                        return true;
                    }
                }
                return false;
            }
        }

