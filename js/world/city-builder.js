        /**
         * ============================================================================
         * MÓDULO 6: CONSTRUTOR DAS 4 CIDADES (CHICAGO, HAVANA, LAS VEGAS, RIO)
         * Inclui Ponte Levadiça, Cristo Redentor no Rio, Cassinos em Vegas e Garagem Secreta
         * ============================================================================
         */
        class CityBuilder {
            constructor(scene, presetKey = 'chicago', buildNow = true) {
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
                this.trainStation=null;
                this.caineBridgeClosed=false;
                this.caineBridgeGate=null;
                this.interiors=[]; this.interiorById={};

                // Garagem Secreta com Portão e Interruptor a Pé (Nordeste X=120, Z=120)
                this.secretSwitchPos = { x: 102, z: 103 };
                this.secretGarageCenter = { x: 120, z: 120 };
                this.secretGateOpen = false;
                this.secretGateMesh = null;
                this.secretGateBoxIndex = -1;

                this.preset=CITY_PRESETS[presetKey] || CITY_PRESETS.chicago;
                this.ready=false;
                if(buildNow)this.loadCityPreset(presetKey);
            }

            loadCityPreset(presetKey) {
                this.resetCityForPreset(presetKey);
                this.buildEnvironment();
                this.ready=true;
            }

            async loadCityPresetProgressive(presetKey, onProgress=()=>{}) {
                this.resetCityForPreset(presetKey);
                const total=12; // infraestrutura, canal, nove fileiras, detalhes
                let done=0;
                for(const stage of this.buildEnvironmentStages()){
                    done++;
                    onProgress(Math.min(1,done/total),stage);
                    await new Promise(resolve=>requestAnimationFrame(resolve));
                }
                this.ready=true;
                onProgress(1,'Cidade construída com sucesso');
            }

            resetCityForPreset(presetKey) {
                this.ready=false;
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
                this.trainStation=null;
                this.caineBridgeClosed=false;
                this.caineBridgeGate=null;
                this.secretGateOpen = false;
                this.signalClock = 0;
                this.lastSignalPhase = -1;

            }

            buildEnvironment() {
                for(const _stage of this.buildEnvironmentStages()){}
            }

            *buildEnvironmentStages() {
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
                yield 'Asfalto, ruas, sinalização e semáforos';

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
                yield 'Canal, pontes e vias de acesso';

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

                for(const [rowIndex,bx] of coords.entries()) {
                    coords.forEach(bz => {
                        if (Math.abs(bz - 50) < 35) return;
                        if (bx === 0 && bz === 0) return;

                        const blockX = bx + 40;
                        const blockZ = bz - 40;
                        if (Math.abs(blockZ - 50) < 28) return;

                        const sw = new THREE.Mesh(new THREE.BoxGeometry(50, 0.35, 50), sidewalkMat);
                        sw.position.set(blockX, 0.175, blockZ);
                        this.cityGroup.add(sw);

                        if (this.preset.id==='chicago' && blockX===-40 && blockZ===-280) {
                            this.buildChicagoStationBlock(blockX,blockZ);
                        } else if ((blockX===-280||blockX===280)&&blockZ===-280) {
                            this.buildRegionalLandmark(blockX,blockZ);
                        } else if (blockX === -120 && blockZ === -120) {
                            this.buildSafeHouseBlock(blockX, blockZ);
                        } else if (blockX === 120 && blockZ === 120) {
                            this.buildSecretGarageCompound(blockX, blockZ);
                        } else if (blockX===200 && blockZ===-200) {
                            this.buildEnterableWarehouse(blockX,blockZ);
                        } else if (this.preset.id==='chicago' &&
                            blockX===-200 && blockZ===-200) {
                            this.buildEnterableStore(blockX,blockZ,'diner');
                        } else if (this.preset.id==='chicago' &&
                            blockX===120 && blockZ===-280) {
                            this.buildEnterableStore(blockX,blockZ,'garage');
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
                    yield 'Quarteirões e edifícios '+(rowIndex+1)+'/'+coords.length;
                }
                UrbanDistricts.decorate(this);
                this.buildInteriorRooms();
                DriverChicagoTrain.buildInfrastructure(this);
                if(this.preset.id==='chicago')this.buildCaineCompoundDetails();
                yield 'Interiores, monumentos e objetos do cenário';
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
                // Telhado e janelas reais no lugar do antigo bloco cinza.
                const roof=new THREE.Mesh(new THREE.BoxGeometry(32,1.2,32),
                    new THREE.MeshLambertMaterial({color:0x7c2d12}));
                roof.position.set(cx,14.7,cz);this.cityGroup.add(roof);
                for(const sign of [-1,1]) {
                    const windowPane=new THREE.Mesh(
                        new THREE.BoxGeometry(3.8,2.7,0.25),
                        new THREE.MeshBasicMaterial({color:0x93c5fd}));
                    windowPane.position.set(cx+sign*8.2,7,cz+15.15);
                    this.cityGroup.add(windowPane);
                }

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
                // Varanda, entrada sombreada e caminho de carros para identificar
                // o endereço mesmo à noite. Decoração de baixo custo.
                const porchMat=new THREE.MeshLambertMaterial({color:0x78716c});
                const walkway=new THREE.Mesh(new THREE.BoxGeometry(10,.16,13),
                    porchMat);
                walkway.position.set(cx,.1,cz+23.6);
                this.cityGroup.add(walkway);
                const awning=new THREE.Mesh(new THREE.BoxGeometry(9,.55,5),
                    new THREE.MeshLambertMaterial({color:0x166534}));
                awning.position.set(cx,4.55,cz+17.5);
                this.cityGroup.add(awning);
                for(const dx of [-3.65,3.65]){
                    const column=new THREE.Mesh(new THREE.BoxGeometry(.35,4.15,.35),
                        porchMat);
                    column.position.set(cx+dx,2.18,cz+19.5);
                    this.cityGroup.add(column);
                }
                const mailbox=new THREE.Mesh(new THREE.BoxGeometry(.8,1.4,.85),
                    new THREE.MeshLambertMaterial({color:0x334155}));
                mailbox.position.set(cx+7.5,.72,cz+22);
                this.cityGroup.add(mailbox);
                const address=new THREE.Mesh(new THREE.BoxGeometry(2.3,.6,.1),
                    new THREE.MeshBasicMaterial({color:0xfde68a}));
                address.position.set(cx,5.6,cz+15.35);
                this.cityGroup.add(address);
                this.interiors.push({
                    id:'home',name:'Casa de Tanner',kind:'home',
                    door:{x:cx,z:cz+19},inside:{x:1000,z:0}
                });
            }



            buildRegionalLandmark(cx,cz) {
                // Dois quarteirões memoráveis por cidade, usando malhas
                // simples para o cenário continuar leve no celular.
                const id=this.preset.id, west=cx<0;
                const make=(shape,geometry,color,x,y,z)=>{
                    const mesh=new THREE.Mesh(geometry,
                        new THREE.MeshLambertMaterial({color}));
                    mesh.position.set(x,y,z);this.cityGroup.add(mesh);
                    return mesh;
                };
                const box=(w,h,d,color,x,y,z)=>make('box',
                    new THREE.BoxGeometry(w,h,d),color,x,y,z);
                const dome=(radius,height,color,x,y,z)=>make('dome',
                    new THREE.SphereGeometry(radius,10,7),color,x,y,z);
                const column=(radius,height,color,x,y,z)=>make('column',
                    new THREE.CylinderGeometry(radius,radius,height,7),color,x,y,z);
                // Pisos e pátios visitáveis; não bloqueiam a circulação.
                box(45,0.36,45,id==='rio'?0xfde68a:0x64748b,cx,0.18,cz);
                if(id==='chicago') {
                    if(west) {
                        // Estádio inspirado em Wrigley Field.
                        box(38,0.28,37,0x15803d,cx,0.40,cz);
                        for(const sign of [-1,1]) {
                            box(38,7,3,0x94a3b8,cx,3.5,cz+sign*19);
                            box(3,7,38,0x94a3b8,cx+sign*19,3.5,cz);
                        }
                        box(14,8,0.6,0x166534,cx,11,cz-18.5);
                    }else{
                        // Píer urbano e galpões da orla.
                        for(let i=-1;i<=1;i++)box(10,6,15,0x94a3b8,
                            cx+i*13,3.4,cz);
                        for(const x of [cx-16,cx+16])
                            column(0.3,7,0x334155,x,3.5,cz+15);
                    }
                }else if(id==='havana'){
                    if(west) {
                        // Fachada cívica inspirada no Capitolio de Havana.
                        box(32,11,25,0xfde68a,cx,5.7,cz);
                        for(let x=-12;x<=12;x+=6)
                            column(0.8,10,0xffedd5,cx+x,6,cz+13.5);
                        dome(8,9,0xe2e8f0,cx,19,cz-2);
                    }else{
                        // Praça de la Revolución: pátio e monumento.
                        column(3,27,0xd4d4d8,cx,13.5,cz);
                        box(12,2,12,0xe5e7eb,cx,1.0,cz);
                        for(const x of [-16,16])
                            column(0.8,7,0x7c2d12,cx+x,3.5,cz+10);
                    }
                }else if(id==='vegas'){
                    const neon=west?0xec4899:0x22d3ee;
                    box(31,west?43:34,29,0x334155,cx,west?21.5:17,cz);
                    for(const x of [-12,0,12]){
                        box(3,25,0.7,neon,cx+x,14,cz+15);
                    }
                    box(25,2,1,0xfacc15,cx,7,cz+16);
                    dome(10,6,west?0x9333ea:0x0891b2,cx,west?44:36,cz);
                }else{
                    if(west){
                        // Praça litorânea arborizada do Rio de Janeiro.
                        box(42,0.35,38,0x16a34a,cx,0.45,cz);
                        for(const x of [-13,13]){
                            column(0.6,8,0x92400e,cx+x,4.5,cz);
                            dome(4,4,0x166534,cx+x,9,cz);
                        }
                        box(14,3,9,0xfef3c7,cx,1.8,cz+10);
                    }else{
                        // Mercado de bairro e praça com coreto.
                        box(32,7,21,0xfef08a,cx,3.6,cz);
                        box(34,1.3,24,0xef4444,cx,7.8,cz);
                        for(const x of [-12,12])
                            column(0.45,7,0x334155,cx+x,3.5,cz+15);
                    }
                }
            }

            buildChicagoStationBlock(cx,cz) {
                const stone=new THREE.MeshLambertMaterial({color:0x854d0e});
                const roofMat=new THREE.MeshLambertMaterial({color:0x334155});
                const shell=new THREE.Mesh(new THREE.BoxGeometry(20,13,25),stone);
                shell.position.set(cx-8,6.7,cz-3);this.cityGroup.add(shell);
                this.buildingBoxes.push({
                    minX:cx-18.2,maxX:cx+2.2,
                    minZ:cz-16,maxZ:cz+10
                });
                const roof=new THREE.Mesh(new THREE.BoxGeometry(23,1.1,29),roofMat);
                roof.position.set(cx-8,13.7,cz-3);this.cityGroup.add(roof);
                const p=DriverChicagoTrain.PLATFORM;
                const platform=new THREE.Mesh(new THREE.BoxGeometry(17,0.48,36),
                    new THREE.MeshLambertMaterial({color:0xd6d3d1}));
                platform.position.set(p.x,p.height-0.24,p.z-4);
                this.cityGroup.add(platform);
                const edge=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.15,36),
                    new THREE.MeshBasicMaterial({color:0xfacc15}));
                edge.position.set(-6.1,p.height+0.02,p.z-4);
                this.cityGroup.add(edge);
                const rampLength=29,incline=Math.atan2(p.height,rampLength);
                const ramp=new THREE.Mesh(new THREE.BoxGeometry(6,0.32,
                    Math.hypot(rampLength,p.height)),
                    new THREE.MeshLambertMaterial({color:0x9ca3af}));
                ramp.rotation.x=incline;
                ramp.position.set(-14,p.height/2,-231.5);
                this.cityGroup.add(ramp);
                for(const x of [-17.2,-10.8]){
                    const rail=new THREE.Mesh(new THREE.BoxGeometry(.16,.36,
                        Math.hypot(rampLength,p.height)),
                        roofMat);
                    rail.rotation.x=incline;
                    rail.position.set(x,p.height/2+0.55,-231.5);
                    this.cityGroup.add(rail);
                }
                const sign=new THREE.Mesh(new THREE.BoxGeometry(7.5,1.15,0.3),
                    new THREE.MeshBasicMaterial({color:0x16a34a}));
                sign.position.set(-14,14.2,-252);
                this.cityGroup.add(sign);
                this.trainStation={
                    ramp:{minX:-17,maxX:-11,startZ:-217,endZ:-246},
                    platform:{...p},groundEntrance:{x:-14,z:-216}
                };
            }

            onTrainPlatform(pos) {
                return this.preset.id==='chicago' &&
                    DriverChicagoTrain.onPlatform(pos);
            }

            buildCaineCompoundDetails() {
                // Pátio fortificado em volta do depósito já acessível.
                // Colisores adicionais ficam longe do acesso viário x=240.
                const steel=new THREE.MeshLambertMaterial({color:0x475569});
                const concrete=new THREE.MeshLambertMaterial({color:0x78716c});
                const crate=new THREE.MeshLambertMaterial({color:0x92400e});
                const paint=new THREE.MeshBasicMaterial({color:0x22c55e});
                const add=(w,h,d,x,y,z,material)=>{
                    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
                    mesh.position.set(x,y,z);
                    this.cityGroup.add(mesh);
                    return mesh;
                };
                for(const [x,z,w,d] of [
                    [178,-230,.45,30],[222,-230,.45,30],
                    [200,-246,45,.45],[170,-215,.45,18]
                ]){
                    add(w,5.2,d,x,2.6,z,concrete);
                    this.buildingBoxes.push({
                        minX:x-w/2,maxX:x+w/2,
                        minZ:z-d/2,maxZ:z+d/2
                    });
                }
                // Corredor de acesso do armazém (sem bloqueio físico).
                for(const x of [186,214]){
                    add(2.2,3,3.2,x,1.5,-172,crate);
                }
                for(const x of [183,217]){
                    const container=add(6.2,4,13,x,2,-241,steel);
                    container.rotation.y=0.15*(x===183?-1:1);
                }
                add(6,1.1,.5,200,6.5,-183,paint);
                // Seta luminosa na saída após a ponte; visível do carro.
                add(18,.38,1.3,0,5,95,steel);
                for(const x of [-6,0,6])
                    add(3,1,.3,x,5.4,95,paint);
                // Barra levadiça que só aparece quando termina a contagem.
                this.caineBridgeGate=add(17,2.4,1.5,0,1.35,51,
                    new THREE.MeshLambertMaterial({color:0xdc2626}));
                this.caineBridgeGate.visible=false;
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
                // Pátio industrial acessível: asfalto gasto, grades laterais
                // e contêineres afastados da rota do suspeito (x=200,z=-160).
                const apron=new THREE.Mesh(new THREE.BoxGeometry(48,.20,26),
                    new THREE.MeshLambertMaterial({color:0x52525b}));
                apron.position.set(cx,.11,cz+38);
                this.cityGroup.add(apron);
                const fenceMat=new THREE.MeshLambertMaterial({color:0x64748b});
                for(const side of [-1,1]){
                    const fence=new THREE.Mesh(new THREE.BoxGeometry(.32,3.8,22),
                        fenceMat);
                    fence.position.set(cx+side*24,1.95,cz+38);
                    this.cityGroup.add(fence);
                    for(const rz of [cz+31,cz+46]){
                        const cargo=new THREE.Mesh(new THREE.BoxGeometry(4,2.8,4),
                            new THREE.MeshLambertMaterial({
                                color:side<0?0x92400e:0x14532d
                            }));
                        cargo.position.set(cx+side*20,1.48,rz);
                        this.cityGroup.add(cargo);
                    }
                }
                const yardLamp=new THREE.Mesh(new THREE.BoxGeometry(0.45,5,0.45),
                    new THREE.MeshLambertMaterial({color:0x334155}));
                yardLamp.position.set(cx+21,2.6,cz+43);
                const yardLight=new THREE.Mesh(new THREE.BoxGeometry(1.3,.3,.9),
                    new THREE.MeshBasicMaterial({color:0xfde68a}));
                yardLight.position.set(cx+21,5.1,cz+43);
                this.cityGroup.add(yardLamp,yardLight);
                this.interiors.push({
                    id:'warehouse',name:'Depósito abandonado',kind:'warehouse',
                    door:{x:cx,z:cz+21},inside:{x:1050,z:0}
                });
            }

            buildEnterableStore(cx,cz,id) {
                const diner=id==='diner';
                const baseMat=new THREE.MeshLambertMaterial({
                    color:diner?0x7c2d12:0x475569
                });
                const shell=new THREE.Mesh(new THREE.BoxGeometry(36,12,30),baseMat);
                shell.position.set(cx,6.2,cz);
                this.cityGroup.add(shell);
                this.buildingBoxes.push({
                    minX:cx-18,maxX:cx+18,minZ:cz-15,maxZ:cz+15
                });
                const awning=new THREE.Mesh(new THREE.BoxGeometry(36,1.4,3.4),
                    new THREE.MeshLambertMaterial({
                        color:diner?0xef4444:0xeab308
                    }));
                awning.position.set(cx,5.3,cz+16.2);
                this.cityGroup.add(awning);
                const sign=new THREE.Mesh(new THREE.BoxGeometry(22,2.2,0.7),
                    new THREE.MeshBasicMaterial({
                        color:diner?0xffedd5:0x93c5fd
                    }));
                sign.position.set(cx,9.4,cz+15.4);
                this.cityGroup.add(sign);
                for(const side of [-1,1]){
                    const glass=new THREE.Mesh(new THREE.BoxGeometry(7,3,0.25),
                        new THREE.MeshBasicMaterial({color:0x38bdf8}));
                    glass.position.set(cx+side*12,2.6,cz+15.2);
                    this.cityGroup.add(glass);
                }
                const door=new THREE.Mesh(new THREE.BoxGeometry(3.5,4,0.27),
                    new THREE.MeshLambertMaterial({color:0x16a34a}));
                door.position.set(cx,2.2,cz+15.3);
                this.cityGroup.add(door);
                this.interiors.push({
                    id,name:diner?'Lanchonete de Chicago':'Oficina mecânica',
                    kind:id,door:{x:cx,z:cz+19.5},
                    inside:{x:diner?1120:1180,z:0}
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
                    } else if(place.kind==='diner'){
                        // Balcão central, banquetas e mesas de uma lanchonete 70s.
                        make(x,1,z+4.2,15,2,2.2,0x92400e);
                        make(x,2.2,z+4.2,14,.2,2.2,0xffedd5);
                        for(const offset of [-7,0,7]){
                            make(x+offset,.7,z-1,3,1.4,3,0x991b1b);
                            make(x+offset,.5,z-5,3,1,2.2,0x78350f);
                        }
                    } else if(place.kind==='garage'){
                        // Bancada, prateleiras, carroceria e ferramentas.
                        make(x-6,1.3,z+5,8,2.6,2,0x334155);
                        make(x+4,.55,z+2,5.5,1.1,9,0x64748b);
                        make(x+4,1.15,z+2,4,0.3,7,0xfacc15);
                        for(const offset of [-3,0,3])
                            make(x-8,2.1,z+offset,1,0.35,1.2,0xf97316);
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
                if(this.caineBridgeGate)
                    this.caineBridgeGate.visible=!!this.caineBridgeClosed;
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
                if(this.trainStation){
                    const ramp=this.trainStation.ramp,p=this.trainStation.platform;
                    if(x>=p.minX&&x<=p.maxX &&
                        z>=p.minZ&&z<=p.maxZ)return p.height;
                    if(x>=ramp.minX&&x<=ramp.maxX &&
                        z<=ramp.startZ&&z>=ramp.endZ) {
                        return p.height*(ramp.startZ-z)/(ramp.startZ-ramp.endZ);
                    }
                }
                if (Math.abs(x) < 11.2 && z >= 34 && z <= 66) {
                    const distFromEdge = Math.min(z - 34, 66 - z);
                    return 0.15 + Math.sin(this.bridgeAngle) * distFromEdge;
                }
                return 0;
            }

            isPointBlocked(x, z, radius = 1.2, y = 0) {
                if (this.interiorArea(x,z,radius))return false;
                if(this.caineBridgeClosed && Math.abs(x)<11+radius &&
                    z+radius>49.5 && z-radius<52.5)return true;
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

