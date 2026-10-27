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
                this.signalClock = 0;
                this.lastSignalPhase = -1;
                this.signalBulbs = [];
                this.streetAssetCache = new Map();
                this.buildSequence = 0;
                this.safeHouseZone = { x: -120, z: -120, radius: 9 };
                this.roadExtent=320; this.worldLimit=410;
                this.interiors=[]; this.interiorById={};

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
                this.buildSequence++;

                // Libera recursos WebGL da cidade anterior: sem vazar memória ao alternar cidades.
                const geometries = new Set();
                const materials = new Set();
                const textures = new Set();
                this.cityGroup.traverse(obj => {
                    // Não destrua geometrias compartilhadas com o cache de modelos CC0.
                    if (obj.userData && obj.userData.cc0SharedAsset) return;
                    if (obj.geometry) geometries.add(obj.geometry);
                    if (obj.material) {
                        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                        mats.forEach(mat => materials.add(mat));
                    }
                });
                materials.forEach(mat => {
                    Object.values(mat).forEach(value => {
                        if (value && value.isTexture) textures.add(value);
                    });
                });
                textures.forEach(texture => texture.dispose());
                materials.forEach(material => material.dispose());
                geometries.forEach(geometry => geometry.dispose());
                this.cityGroup.clear();
                this.buildingBoxes = [];
                this.districtBuildings = [];
                this.destructibleProps = [];
                this.benches = [];
                this.interiors=[]; this.interiorById={};
                this.secretGateOpen = false;
                this.signalClock = 0;
                this.lastSignalPhase = -1;

                this.buildEnvironment();
            }

            buildEnvironment() {
                const asphTex = PS1TextureFactory.createAsphaltTexture();
                asphTex.repeat.set(64, 64);

                // 1. Base de Asfalto da Cidade
                const groundGeo = new THREE.PlaneGeometry(840, 840);
                groundGeo.rotateX(-Math.PI / 2);
                const groundMat = new THREE.MeshLambertMaterial({ map: asphTex });
                const ground = new THREE.Mesh(groundGeo, groundMat);
                this.cityGroup.add(ground);

                // Faixas centrais instanciadas: baixa contagem de draw calls, sem texturas extras.
                this.buildRoadMarkings();
                DriverStreetFurniture.build(this);
                this.buildTrafficLights();
                this.decorateStreetsWithCC0();

                // 2. Canal Central (Rio Chicago / Baía de Havana / Canal da Orla do Rio)
                const riverGeo = new THREE.PlaneGeometry(840, 32);
                riverGeo.rotateX(-Math.PI / 2);
                const riverMat = new THREE.MeshBasicMaterial({ color: this.preset.waterColor });
                const river = new THREE.Mesh(riverGeo, riverMat);
                river.position.set(0, 0.06, 50);
                this.cityGroup.add(river);

                // Muretas nas margens do canal
                const wallMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
                const leftWall1 = new THREE.Mesh(new THREE.BoxGeometry(415, 1.5, 1.5), wallMat);
                leftWall1.position.set(-219, 0.75, 34);
                const leftWall2 = leftWall1.clone();
                leftWall2.position.z = 66;
                const rightWall1 = new THREE.Mesh(new THREE.BoxGeometry(415, 1.5, 1.5), wallMat);
                rightWall1.position.set(219, 0.75, 34);
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
                const buildingTextures = new Map();
                const coords = [];
                for(let p=-320;p<=320;p+=80) coords.push(p);

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
                        } else if (blockX===200 && blockZ===-200) {
                            this.buildEnterableWarehouse(blockX,blockZ);
                        } else if ((blockX + blockZ) % 160 === 0) {
                            this.buildParkBlock(blockX, blockZ);
                        } else {
                            const palIndex = Math.floor(UrbanDistricts.random(blockX, blockZ, 9) * this.preset.palettes.length);
                            const pal = this.preset.palettes[palIndex];
                            if (!buildingTextures.has(palIndex)) {
                                buildingTextures.set(palIndex, PS1TextureFactory.createBuildingTexture(pal.wall, pal.win));
                            }
                            const bTex = buildingTextures.get(palIndex);
                            const h = UrbanDistricts.height(this.preset.id, blockX, blockZ);
                            const bMat = new THREE.MeshLambertMaterial({ map: bTex });
                            const bMesh = new THREE.Mesh(new THREE.BoxGeometry(38, h, 38), bMat);
                            bMesh.position.set(blockX, h / 2 + 0.35, blockZ);
                            this.cityGroup.add(bMesh);
                            this.districtBuildings.push({ x: blockX, z: blockZ, height: h });

                            this.buildingBoxes.push({
                                minX: blockX - 19.2, maxX: blockX + 19.2,
                                minZ: blockZ - 19.2, maxZ: blockZ + 19.2
                            });
                        }

                        this.spawnDestructibleProp(blockX - 23, blockZ - 23, 'cone');
                        this.spawnDestructibleProp(blockX + 23, blockZ - 23, 'trash');
                    });
                });
                UrbanDistricts.decorate(this);
                this.buildInteriorRooms();
            }

            buildRoadMarkings() {
                const positions = [];
                // Os centros das avenidas seguem o espaçamento entre os quarteirões.
                // Interrompe as marcas no canal para evitar faixas pintadas sobre água.
                for (let road = -320; road <= 320; road += 80) {
                    for (let along = -392; along <= 392; along += 12) {
                        if (along < 34 || along > 66) {
                            positions.push([road, along, 0]);
                        }
                        positions.push([along, road, Math.PI * 0.5]);
                    }
                }

                const geometry = new THREE.PlaneGeometry(0.14, 3.6);
                geometry.rotateX(-Math.PI * 0.5);
                const material = new THREE.MeshBasicMaterial({
                    color: this.preset.id === 'vegas' ? 0xd4c08b : 0xc5af70,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                    polygonOffset: true,
                    polygonOffsetFactor: -1
                });
                const stripes = new THREE.InstancedMesh(geometry, material, positions.length);
                const dummy = new THREE.Object3D();
                positions.forEach(([x, z, angle], i) => {
                    dummy.position.set(x, 0.075, z);
                    dummy.rotation.set(0, angle, 0);
                    dummy.updateMatrix();
                    stripes.setMatrixAt(i, dummy.matrix);
                });
                stripes.instanceMatrix.needsUpdate = true;
                stripes.frustumCulled = false;
                this.cityGroup.add(stripes);
            }

            // 50 semáforos em 25 cruzamentos; apenas 5 lotes instanciados.
            // Dez placas CC0 da Kenney City Kit (Roads); sem dependência para a física.
            decorateStreetsWithCC0() {
                if (!THREE.GLTFLoader) return;
                const name = 'road-sign-stop.glb';
                if (!this.streetAssetCache.has(name)) {
                    const uri = 'https://cdn.jsdelivr.net/gh/Hidencod/tge-assets@7be9b573bc74f32ed766b44b3f46550d02ca83b5/packs/city-kit-roads/' + name;
                    this.streetAssetCache.set(name, new Promise(resolve => {
                        new THREE.GLTFLoader().load(uri,
                            gltf => resolve(gltf.scene), undefined,
                            () => resolve(null));
                    }));
                }
                const generation = this.buildSequence;
                this.streetAssetCache.get(name).then(original => {
                    if (!original || generation !== this.buildSequence) return;
                    for (let x = -320; x <= 320; x += 80) {
                        for (const z of [-80, 80]) {
                            const clone = original.clone(true);
                            const box = new THREE.Box3().setFromObject(clone);
                            const size = box.getSize(new THREE.Vector3());
                            const scale = 3 / Math.max(0.01, size.x, size.y, size.z);
                            clone.scale.setScalar(scale);
                            clone.position.set(
                                x + 12 - (box.min.x + box.max.x) * 0.5 * scale,
                                0.12 - box.min.y * scale,
                                z + 12 - (box.min.z + box.max.z) * 0.5 * scale
                            );
                            clone.traverse(obj => {
                                if (obj.isMesh) {
                                    obj.userData.cc0SharedAsset = true;
                                    obj.castShadow = false;
                                }
                            });
                            this.cityGroup.add(clone);
                        }
                    }
                });
            }

            buildTrafficLights() {
                const locations = [];
                for (let x = -320; x <= 320; x += 80) {
                    for (let z = -320; z <= 320; z += 80) {
                        locations.push({ x: x + 11, z: z + 11, axis: 'z' });
                        locations.push({ x: x - 11, z: z - 11, axis: 'x' });
                    }
                }
                const count = locations.length;
                const poles = new THREE.InstancedMesh(
                    new THREE.CylinderGeometry(0.12, 0.16, 4.2, 6),
                    new THREE.MeshLambertMaterial({ color: 0x475569 }), count
                );
                const housings = new THREE.InstancedMesh(
                    new THREE.BoxGeometry(0.62, 1.28, 0.48),
                    new THREE.MeshLambertMaterial({ color: 0x161b25 }), count
                );
                const bulbColors = [0xef4444, 0xf59e0b, 0x22c55e];
                const bulbs = bulbColors.map(() => new THREE.InstancedMesh(
                    new THREE.SphereGeometry(0.20, 7, 5),
                    new THREE.MeshBasicMaterial({ color: 0xffffff }), count
                ));
                const mat = new THREE.Matrix4();
                locations.forEach((loc, i) => {
                    poles.setMatrixAt(i, mat.makeTranslation(loc.x, 2.1, loc.z));
                    housings.setMatrixAt(i, mat.makeTranslation(loc.x, 3.65, loc.z));
                    bulbs.forEach((bulb, k) => {
                        bulb.setMatrixAt(i, mat.makeTranslation(loc.x, 4.05 - k * 0.4, loc.z + 0.30));
                    });
                });
                poles.instanceMatrix.needsUpdate = true;
                housings.instanceMatrix.needsUpdate = true;
                bulbs.forEach(b => { b.instanceMatrix.needsUpdate = true; });
                this.signalBulbs = bulbs;
                this.signalPositions = locations;
                this.cityGroup.add(poles, housings, ...bulbs);
                this.refreshTrafficLights(true);
            }

            getTrafficPhase() {
                return this.signalClock % 24;
            }

            isTrafficGreen(axis) {
                const phase = this.getTrafficPhase();
                return axis === 'z' ? phase < 10 : (phase >= 12 && phase < 22);
            }

            refreshTrafficLights(force = false) {
                const phase = this.getTrafficPhase();
                const step = phase < 10 ? 0 : phase < 12 ? 1 : phase < 22 ? 2 : 3;
                if (step === this.lastSignalPhase && !force) return;
                this.lastSignalPhase = step;
                const bright = [new THREE.Color(0xff3333), new THREE.Color(0xffbd43), new THREE.Color(0x3bfa78)];
                const dim = new THREE.Color(0x292d33);
                this.signalPositions.forEach((loc, i) => {
                    const activeColor = loc.axis === 'z' ? (step === 0 ? 2 : step === 1 ? 1 : 0) :
                        (step === 2 ? 2 : step === 3 ? 1 : 0);
                    this.signalBulbs.forEach((bulb, index) => {
                        bulb.setColorAt(i, index === activeColor ? bright[index] : dim);
                    });
                });
                this.signalBulbs.forEach(bulb => {
                    if (bulb.instanceColor) bulb.instanceColor.needsUpdate = true;
                });
            }

            buildRioLandmarks() {
                // Morro do Corcovado ao fundo norte (Z = -210) com a estátua do Cristo Redentor
                const hillMat = new THREE.MeshLambertMaterial({ color: 0x14532d });
                const hill = new THREE.Mesh(new THREE.ConeGeometry(55, 78, 8), hillMat);
                hill.position.set(0, 39, -395);
                this.cityGroup.add(hill);

                // Pedestal e Cristo Redentor de braços abertos olhando para a cidade
                const statueMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
                const pedestal = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 6), new THREE.MeshLambertMaterial({ color: 0x64748b }));
                pedestal.position.set(0, 79, -395);
                const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 18, 3.2), statueMat);
                body.position.set(0, 91, -395);
                const arms = new THREE.Mesh(new THREE.BoxGeometry(19, 3.0, 2.6), statueMat);
                arms.position.set(0, 95, -395);
                const head = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.8, 3.2), statueMat);
                head.position.set(0, 101.5, -395);
                this.cityGroup.add(pedestal, body, arms, head);

                // Faixa de Areia de Copacabana na lateral Leste (X = 230)
                const sand = new THREE.Mesh(new THREE.PlaneGeometry(36, 800), new THREE.MeshBasicMaterial({ color: 0xfde047 }));
                sand.rotateX(-Math.PI / 2);
                sand.position.set(399, 0.08, 0);
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
                const door=new THREE.Mesh(new THREE.BoxGeometry(3.3,4.1,0.4),
                    new THREE.MeshLambertMaterial({color:0x16a34a}));
                door.position.set(cx,2.2,cz+15.2);
                this.cityGroup.add(door);
                this.interiors.push({
                    id:'home',name:'Casa de Tanner',kind:'home',
                    door:{x:cx,z:cz+19},inside:{x:1000,z:0}
                });
            }


            buildEnterableWarehouse(cx,cz) {
                const shell=new THREE.Mesh(new THREE.BoxGeometry(34,15,33),
                    new THREE.MeshLambertMaterial({color:0x64748b}));
                shell.position.set(cx,7.7,cz);this.cityGroup.add(shell);
                this.buildingBoxes.push({
                    minX:cx-17,maxX:cx+17,minZ:cz-16.5,maxZ:cz+16.5
                });
                const entrance=new THREE.Mesh(new THREE.BoxGeometry(4.4,5,0.5),
                    new THREE.MeshBasicMaterial({color:0x0ea5e9}));
                entrance.position.set(cx,2.6,cz+16.9);
                this.cityGroup.add(entrance);
                this.interiors.push({
                    id:'warehouse',name:'Depósito abandonado',kind:'warehouse',
                    door:{x:cx,z:cz+21},inside:{x:1050,z:0}
                });
            }

            buildInteriorRooms() {
                const make=(x,y,z,w,h,d,color)=>{
                    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
                        new THREE.MeshLambertMaterial({color}));
                    mesh.position.set(x,y,z);this.cityGroup.add(mesh);
                };
                for (const place of this.interiors) {
                    const x=place.inside.x,z=place.inside.z;
                    const home=place.id==='home';
                    make(x,-0.14,z,24,0.28,22,home?0x665243:0x334155);
                    make(x,3.3,z+10.8,24,6.6,0.6,home?0xd6c5a5:0x64748b);
                    make(x-11.8,3.3,z,0.6,6.6,22,home?0xb5a48d:0x475569);
                    make(x+11.8,3.3,z,0.6,6.6,22,home?0xb5a48d:0x475569);
                    make(x-6.7,3.3,z-10.8,10,6.6,0.6,home?0xd6c5a5:0x64748b);
                    make(x+6.7,3.3,z-10.8,10,6.6,0.6,home?0xd6c5a5:0x64748b);
                    make(x,6.4,z,24,0.35,22,home?0x9a8667:0x1e293b);
                    if (home) {
                        make(x-6.8,0.8,z+2,6,1.6,3.2,0x854d0e);
                        make(x+6,1,z+5.4,6,2,2,0x334155);
                        make(x,0.8,z+4,4,1.6,2.2,0x92400e);
                        make(x,1.65,z+4,2.2,0.25,1.0,0x166534);
                        place.savePoint={x,z:z+4};
                    } else {
                        for(const dx of [-6,0,6])
                            make(x+dx,1,z+3,3.3,2,3.3,0x78350f);
                    }
                    place.exit={x,z:z-8.8};
                }
            }

            interiorAt(x,z) {
                return this.interiors.find(p=>
                    Math.hypot(x-p.door.x,z-p.door.z)<6)||null;
            }

            interiorArea(x,z,radius=0.55) {
                const place=this.interiors.find(p=>
                    Math.abs(x-p.inside.x)<12.5&&Math.abs(z-p.inside.z)<11.5);
                if(!place)return false;
                return Math.abs(x-place.inside.x)+radius<11.4 &&
                    Math.abs(z-place.inside.z)+radius<10.4;
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
                this.signalClock += dt;
                this.refreshTrafficLights();
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
                if (this.interiorArea(x,z,radius))return false;
                if (Math.abs(x)>this.worldLimit || Math.abs(z)>this.worldLimit)return true;
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

