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
                this.sidewalkGrid = new Set();
                this.destructibleProps = [];
                this.debrisPieces=[];
                this.debrisGeometry=null;
                this.debrisMaterialCache=null;
                this.poleDebrisGeometry=null;
                this.benches = [];
                this.chicagoParks=[];
                this.rioParks=[];
                this.havanaParks=[];
                this.vegasParks=[];
                this.bridgeRaised = false;
                this.bridgeAngle = 0.14;
                this.signalClock = 0;
                this.lastSignalPhase = -1;
                this.signalBulbs = [];
                this.streetAssetCache = new Map();
                this.buildSequence = 0;
                this.safeHouseZone = {x:-120,z:-101,radius:5.5};
                this.garageParking={x:-129,z:-94,heading:0};
                this.garageExit={x:-129,z:-90,heading:0};
                this.roadExtent=320; this.worldLimit=410;
                this.trainStation=null;
                this.canalWallSegments=[];
                this.canalOpenings=[];
                this.caineBridgeClosed=false;
                this.caineBridgeGate=null;
                this.interiors=[]; this.interiorById={};
                this.missionStart=null;

                // Garagem Secreta com Portão e Interruptor a Pé (Nordeste X=120, Z=120)
                this.secretSwitchPos = { x: 102, z: 103 };
                this.secretGarageCenter = { x: 120, z: 120 };
                this.secretGateOpen = false;
                this.secretGateMesh = null;
                this.secretGateBoxIndex = -1;

                this.preset=CITY_PRESETS[presetKey] || CITY_PRESETS.chicago;
                this.ready=false;
                this.districtLOD=null;
                this.districtChunks=new Map();
                this.districtTextureCache=new Map();
                this.districtMaterialCache=new Map();
                this.lodStats=null;
                this.lodSeconds=0;
                this.roadAudit=null;
                this.waterFoamMaterial=null;
                this.coastVisuals=null;
                this.parkGeometryCache=null;
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
                this.sidewalkGrid = new Set();
                this.districtBuildings = [];
                this.districtLOD=null;
                this.districtChunks=new Map();
                this.districtTextureCache=new Map();
                this.districtMaterialCache=new Map();
                this.lodStats=null;
                this.lodSeconds=0;
                this.roadAudit=null;
                this.waterFoamMaterial=null;
                this.coastVisuals=null;
                this.parkGeometryCache=null;
                this.destructibleProps = [];
                this.debrisPieces=[];
                this.debrisGeometry=null;
                this.debrisMaterialCache=null;
                this.poleDebrisGeometry=null;
                this.benches = [];
                this.chicagoParks=[];
                this.chicagoStadium=null;
                this.chicagoBridgeClock=0;
                this.chicagoBridgeLamps=null;
                this.chicagoEastBridge=null;
                this.bridgeBellPending=false;
                this.chicagoLowerWacker=null;
                this.chicagoOverhaulStats=null;
                this.tannerHomeFurnitureBoxes=[];
                this.tannerHomeInteriorStats=null;
                this.rioParks=[];
                this.rioOverhaulStats=null;
                this.havanaParks=[];
                this.havanaOverhaulStats=null;
                this.vegasParks=[];
                this.vegasOverhaulStats=null;
                this.interiors=[]; this.interiorById={};
                this.missionStart=null;
                this.trainStation=null;
                this.garageParking={x:-129,z:-94,heading:0};
                this.garageExit={x:-129,z:-90,heading:0};
                this.canalWallSegments=[];
                this.canalOpenings=[];
                this.caineBridgeClosed=false;
                this.caineBridgeGate=null;
                this.secretGateOpen = false;
                this.homeGarageDoor=null;
                this.homeGarageDoorClosedBox=null;
                this.homeGarageDoorOpen=false;
                this.homeGarageDoorHeight=0;
                // Ao trocar de cidade, nenhum estado de ponte é herdado.
                this.bridgeRaised=false;
                this.bridgeAngle=.08;
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

                // Ruas renderizadas somente sobre a grade rodável.
                // Textura-base não contém linhas: pintura é independente.
                if(typeof DriverRoadSurface!=='undefined')
                    DriverRoadSurface.buildAsphalt(this);
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
                if(typeof DriverCoastalVisuals!=='undefined')
                    DriverCoastalVisuals.build(this);

                // Margens protegidas por paredes físicas correspondentes ao
                // desenho; aberturas reais permitem uma queda no canal.
                const wallMat=new THREE.MeshLambertMaterial({color:0x64748b});
                this.canalWallSegments=[];
                this.canalOpenings=[
                    {minX:-255,maxX:-225},{minX:225,maxX:255}
                ];
                for(const z of [34,66]){
                    for(const [x0,x1] of [
                        [-427,-255],[-225,-11.5],
                        [11.5,225],[255,427]
                    ]){
                        const wall=new THREE.Mesh(
                            new THREE.BoxGeometry(x1-x0,1.5,1.5),wallMat);
                        wall.position.set((x0+x1)/2,.75,z);
                        this.cityGroup.add(wall);
                        this.canalWallSegments.push({minX:x0,maxX:x1,z});
                    }
                }

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
                if(typeof DriverSpecialStructures!=='undefined')
                    DriverSpecialStructures.bridge(this);
                if(typeof DriverRegionalInfrastructure!=='undefined')
                    DriverRegionalInfrastructure.build(this);
                // A segunda ponte ocupa o vão leste já previsto nas muretas.
                if(this.preset.id==='chicago' &&
                    typeof DriverChicagoEastBridge!=='undefined')
                    DriverChicagoEastBridge.build(this);
                yield 'Canal, pontes e vias de acesso';

                // 4. Monumentos Exclusivos por Cidade (Rio de Janeiro: Morro do Corcovado + Cristo Redentor + Praia)
                if (this.preset.id === 'rio') {
                    this.buildRioLandmarks();
                } else if (this.preset.id === 'vegas') {
                    this.buildVegasLandmarks();
                }

                // 5. Quarteirões, Calçadas, Esconderijo e Garagem Secreta
                const sidewalkColor=typeof DriverRoadSurface!=='undefined'?
                    DriverRoadSurface.palette(this.preset.id).sidewalk:0x777a7c;
                const sidewalkMat = new THREE.MeshLambertMaterial({
                    color:sidewalkColor
                });
                const sidewalkPositions=[];
                const coords = [];
                for(let p=-320;p<=320;p+=80) coords.push(p);

                for(const [rowIndex,bx] of coords.entries()) {
                    coords.forEach(bz => {
                        if (Math.abs(bz - 50) < 35) return;
                        if (bx === 0 && bz === 0) return;

                        const blockX = bx + 40;
                        const blockZ = bz - 40;
                        if (Math.abs(blockZ - 50) < 28) return;

                        // Calçadas agrupadas em uma única draw call instanciada.
                        sidewalkPositions.push({x:blockX,z:blockZ});
                        // Grade física única para o piso elevado e para a IA.
                        // As missões e as garagens mantêm seus colliders próprios.
                        this.sidewalkGrid.add(blockX+':'+blockZ);

                        if (this.preset.id==='chicago' && blockX===-40 && blockZ===-280) {
                            this.buildChicagoStationBlock(blockX,blockZ);
                        } else if ((blockX===-280||blockX===280)&&blockZ===-280) {
                            this.buildRegionalLandmark(blockX,blockZ);
                        } else if(this.preset.id==='chicago' && blockX===280 && blockZ===-120 && typeof DriverChicagoGameplay!=='undefined'){
                            DriverChicagoGameplay.buildGrantPark(this,blockX,blockZ);
                        } else if(this.preset.id==='chicago' && blockX===-280 && blockZ===200 && typeof DriverChicagoGameplay!=='undefined'){
                            DriverChicagoGameplay.buildStadium(this,blockX,blockZ);
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
                            const h = UrbanDistricts.height(this.preset.id, blockX, blockZ);
                            const building={x:blockX,z:blockZ,height:h,palette:palIndex};
                            this.districtBuildings.push(building);
                            // Células de dois quarteirões (160 unidades).
                            const ix=Math.floor((blockX+320)/160);
                            const iz=Math.floor((blockZ+360)/160);
                            const key=ix+':'+iz;
                            if(!this.districtChunks.has(key))
                                this.districtChunks.set(key,{
                                    id:key,x:-240+ix*160,z:-320+iz*160,
                                    buildings:[]
                                });
                            this.districtChunks.get(key).buildings.push(building);

                            this.buildingBoxes.push({
                                minX: blockX - 19.2, maxX: blockX + 19.2,
                                minZ: blockZ - 19.2, maxZ: blockZ + 19.2
                            });
                        }

                        this.spawnDestructibleProp(blockX - 23, blockZ - 23, 'cone');
                        this.spawnDestructibleProp(blockX + 23, blockZ - 23, 'trash');
                        if((Math.abs(bx+bz)/80)%3===0)
                            this.spawnDestructibleProp(blockX + 23, blockZ + 23,'crate');
                        // Trechos esparsos de cerca na borda da calçada:
                        // preserva saídas de interiores/garagens e vias.
                        if((Math.abs(bx-bz)/80)%6===0 &&
                            blockX!==-120 && blockX!==120 &&
                            blockZ!==-120 && blockZ!==120)
                            this.spawnDestructibleProp(blockX-21,blockZ+22,'fence');
                    });
                    yield 'Quarteirões e edifícios '+(rowIndex+1)+'/'+coords.length;
                }
                this.buildDistrictRepresentations(sidewalkPositions,sidewalkMat);
                this.buildInteriorRooms();
                this.buildMissionStartMarker();
                DriverChicagoTrain.buildInfrastructure(this);
                if(this.preset.id==='chicago'){
                    this.buildCaineCompoundDetails();
                    // Ruas, rio, parques e viaduto depois dos bairros, sem
                    // novos colliders e com LOD preservado.
                    if(typeof DriverChicagoOverhaul!=='undefined')
                        DriverChicagoOverhaul.buildCity(this);
                    // Corredor Lower Wacker com pilares AABB reais.
                    if(typeof DriverChicagoLowerWacker!=='undefined')
                        DriverChicagoLowerWacker.build(this);
                }
                if(this.preset.id==='rio' &&
                    typeof DriverRioOverhaul!=='undefined')
                    DriverRioOverhaul.buildCity(this);
                if(this.preset.id==='havana' &&
                    typeof DriverHavanaOverhaul!=='undefined')
                    DriverHavanaOverhaul.buildCity(this);
                if(this.preset.id==='vegas' &&
                    typeof DriverVegasOverhaul!=='undefined')
                    DriverVegasOverhaul.buildCity(this);
                // Diagnóstico de conectividade, executado uma única vez
                // após o setor final (não a cada frame).
                if(typeof DriverRoadGeometry!=='undefined')
                    this.roadAudit=DriverRoadGeometry.auditNetwork(this);
                yield 'Interiores, monumentos e auditoria das ruas';
            }

            buildDistrictRepresentations(sidewalkPositions,sidewalkMat) {
                if(sidewalkPositions.length){
                    const sidewalks=new THREE.InstancedMesh(
                        new THREE.BoxGeometry(50,.35,50),
                        sidewalkMat,sidewalkPositions.length);
                    const dummy=new THREE.Object3D();
                    sidewalkPositions.forEach((p,i)=>{
                        dummy.position.set(p.x,.175,p.z);
                        dummy.updateMatrix();
                        sidewalks.setMatrixAt(i,dummy.matrix);
                    });
                    sidewalks.instanceMatrix.needsUpdate=true;
                    sidewalks.frustumCulled=false;
                    this.cityGroup.add(sidewalks);
                }

                this.buildParkAmenities();
                if(typeof DriverRoadSurface!=='undefined')
                    DriverRoadSurface.buildCurbs(this,sidewalkPositions);

                this.districtLOD=new DriverDistrictLOD({
                    nearRadius:165,farRadius:230,maxSwitches:2
                });
                this.districtBoxGeometry=new THREE.BoxGeometry(38,1,38);
                this.districtFarMaterial=new THREE.MeshLambertMaterial({
                    color:0xffffff
                });
                const dummy=new THREE.Object3D();
                for(const chunk of this.districtChunks.values()){
                    // Cada chunk possui uma esfera conservadora de todos
                    // os prédios, cobrindo varandas e telhados; o cubo base
                    // compartilhado não pode representar todas as instâncias.
                    chunk.geometry=(typeof DriverDistrictVisibility!=='undefined')?
                        DriverDistrictVisibility.makeGeometry(chunk.buildings):
                        this.districtBoxGeometry;
                    const far=new THREE.InstancedMesh(chunk.geometry,
                        this.districtFarMaterial,chunk.buildings.length);
                    for(const [i,b] of chunk.buildings.entries()){
                        dummy.position.set(b.x,b.height/2+.35,b.z);
                        dummy.scale.set(1,b.height,1);
                        dummy.rotation.set(0,0,0);
                        dummy.updateMatrix();
                        far.setMatrixAt(i,dummy.matrix);
                        far.setColorAt(i,
                            new THREE.Color(this.preset.palettes[b.palette].wall));
                    }
                    far.instanceMatrix.needsUpdate=true;
                    if(far.instanceColor)far.instanceColor.needsUpdate=true;
                    far.frustumCulled=!!chunk.geometry.boundingSphere;
                    far.name='district-far-'+chunk.id;
                    // LOD de Vegas mantém janelas mesmo com torres
                    // distantes, escondendo-as junto com o pai far.
                    if(this.preset.id==='vegas' &&
                        typeof DriverVegasOverhaul!=='undefined')
                        DriverVegasOverhaul.detailFarDistrict(
                            this,chunk.buildings,far);
                    this.cityGroup.add(far);
                    this.districtLOD.register({
                        id:chunk.id,x:chunk.x,z:chunk.z,far,
                        buildNear:()=>this.buildNearDistrict(chunk)
                    });
                }
                this.lodStats=this.districtLOD.stats();
            }

            buildNearDistrict(chunk){
                const group=new THREE.Group();
                group.name='district-detail-'+chunk.id;
                // Uma malha instanciada por paleta em vez de uma por prédio.
                const byPalette=new Map();
                for(const building of chunk.buildings){
                    if(!byPalette.has(building.palette))
                        byPalette.set(building.palette,[]);
                    byPalette.get(building.palette).push(building);
                }
                const dummy=new THREE.Object3D();
                for(const [palette,buildings] of byPalette){
                    if(!this.districtMaterialCache.has(palette)){
                        const pal=this.preset.palettes[palette];
                        const texture=PS1TextureFactory.createBuildingTexture(
                            pal.wall,pal.win);
                        this.districtTextureCache.set(palette,texture);
                        this.districtMaterialCache.set(palette,
                            new THREE.MeshLambertMaterial({map:texture}));
                    }
                    const mesh=new THREE.InstancedMesh(
                        chunk.geometry||this.districtBoxGeometry,
                        this.districtMaterialCache.get(palette),
                        buildings.length);
                    buildings.forEach((b,i)=>{
                        dummy.position.set(b.x,b.height/2+.35,b.z);
                        dummy.scale.set(1,b.height,1);
                        dummy.rotation.set(0,0,0);
                        dummy.updateMatrix();
                        mesh.setMatrixAt(i,dummy.matrix);
                    });
                    mesh.instanceMatrix.needsUpdate=true;
                    mesh.frustumCulled=!!(chunk.geometry?.boundingSphere);
                    group.add(mesh);
                }
                UrbanDistricts.decorate(this,chunk.buildings,group);
                if(this.preset.id==='chicago' &&
                    typeof DriverChicagoOverhaul!=='undefined')
                    DriverChicagoOverhaul.detailDistrict(this,
                        chunk.buildings,group);
                if(this.preset.id==='rio' &&
                    typeof DriverRioOverhaul!=='undefined')
                    DriverRioOverhaul.detailDistrict(this,
                        chunk.buildings,group);
                if(this.preset.id==='havana' &&
                    typeof DriverHavanaOverhaul!=='undefined')
                    DriverHavanaOverhaul.detailDistrict(this,
                        chunk.buildings,group);
                if(this.preset.id==='vegas' &&
                    typeof DriverVegasOverhaul!=='undefined')
                    DriverVegasOverhaul.detailDistrict(this,
                        chunk.buildings,group);
                group.visible=false;
                this.cityGroup.add(group);
                return group;
            }

            updateDistrictLOD(dt,focus,force=false) {
                if(!this.districtLOD)return null;
                this.lodSeconds+=Math.max(0,Math.min(Number(dt)||0,.05));
                if(!force && this.lodSeconds<.14)return this.lodStats;
                this.lodSeconds=0;
                this.lodStats=this.districtLOD.update(focus,{force});
                return this.lodStats;
            }

            buildRoadMarkings() {
                if(typeof DriverRoadSurface!=='undefined')
                    return DriverRoadSurface.buildMarkings(this);
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
                                x + 16 - (box.min.x + box.max.x) * 0.5 * scale,
                                0.12 - box.min.y * scale,
                                z + 16 - (box.min.z + box.max.z) * 0.5 * scale
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
                        const a=z+16>34&&z+16<66?z-16:z+16;
                        const b=z-16>34&&z-16<66?z+16:z-16;
                        locations.push({x:x+16,z:a,axis:'z'});
                        locations.push({x:x-16,z:b,axis:'x'});
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
                if(typeof DriverSpecialStructures!=='undefined')
                    DriverSpecialStructures.secretGarage(this,cx,cz);
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


            // Mobiliário e pavimentação de todos os parques em somente dois
            // batches globais. Preserva áreas de caminhada e bancos utilizáveis.
            buildParkAmenities() {
                if(!this.benches.length)return;
                const city=this.preset.id,solid=[],accents=[];
                const colors={
                    chicago:[0x9ca3af,0x475569,0x16a34a,0xfacc15],
                    havana:[0xf8d8b0,0x92400e,0x2f855a,0xfb7185],
                    vegas:[0xd9c5a0,0x57534e,0x6b8e23,0xf59e0b],
                    rio:[0xe7e5e4,0x4b5563,0x15803d,0xfbbf24]
                }[city];
                const [paving,metal,leaf,flower]=colors;
                const put=(accent,x,y,z,w,h,d,color)=>{
                    (accent?accents:solid).push({x,y,z,w,h,d,color});
                };
                for(const p of this.benches){
                    const x=p.x,z=p.z;
                    // Trilha em cruz ao nível do gramado; não cria colisores.
                    put(false,x,.465,z,35,.075,2.6,paving);
                    put(false,x,.47,z,2.6,.075,35,paving);
                    // Ripas e encosto do banco que já existe no parque.
                    put(false,x,1.38,z-.46,3.4,.78,.17,metal);
                    for(const dx of [-1.35,1.35]){
                        put(false,x+dx,.65,z+.38,.22,.65,.35,metal);
                        put(false,x+dx,1.13,z-.14,.18,.18,1.1,metal);
                    }
                    // Jardim de canto sem fechar a trilha ou a rua.
                    for(const dx of [-17,17])for(const dz of [-17,17]){
                        put(false,x+dx,.49,z+dz,3.0,.18,1.7,paving);
                        put(false,x+dx,.67,z+dz,2.6,.32,1.3,leaf);
                        for(const fx of [-.7,0,.7])
                            put(true,x+dx+fx,.87,z+dz,.22,.16,.28,flower);
                    }
                    if(city==='rio'||city==='havana'){
                        // Caminho em losangos simplificados para o visual tropical.
                        for(const dz of [-9,9])
                            put(false,x,.51,z+dz,6,.09,1.3,metal);
                    } else if(city==='vegas'){
                        for(const dx of [-8,8])
                            put(true,x+dx,.53,z,3,.07,.28,flower);
                    } else {
                        for(const dx of [-8,8])
                            put(false,x+dx,.52,z,3,.08,.22,metal);
                    }
                }
                const geometry=new THREE.BoxGeometry(1,1,1);
                for(const [parts,isAccent] of [[solid,false],[accents,true]]){
                    const mat=isAccent?
                        new THREE.MeshBasicMaterial({color:0xffffff}):
                        new THREE.MeshLambertMaterial({color:0xffffff});
                    const mesh=new THREE.InstancedMesh(geometry,mat,parts.length);
                    const dummy=new THREE.Object3D();
                    parts.forEach((p,i)=>{
                        dummy.position.set(p.x,p.y,p.z);
                        dummy.rotation.set(0,0,0);
                        dummy.scale.set(p.w,p.h,p.d);
                        dummy.updateMatrix();
                        mesh.setMatrixAt(i,dummy.matrix);
                        mesh.setColorAt(i,new THREE.Color(p.color));
                    });
                    mesh.instanceMatrix.needsUpdate=true;
                    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
                    mesh.frustumCulled=false;
                    mesh.name='park-amenities-'+city+(isAccent?'-flowers':'-paths');
                    this.cityGroup.add(mesh);
                }
            }

            buildParkBlock(cx, cz) {
                if(this.preset.id==='chicago'){
                    if(!this.chicagoParks)this.chicagoParks=[];
                    this.chicagoParks.push({x:cx,z:cz});
                }
                if(this.preset.id==='rio'){
                    if(!this.rioParks)this.rioParks=[];
                    this.rioParks.push({x:cx,z:cz});
                }
                if(this.preset.id==='havana'){
                    if(!this.havanaParks)this.havanaParks=[];
                    this.havanaParks.push({x:cx,z:cz});
                }
                if(this.preset.id==='vegas'){
                    if(!this.vegasParks)this.vegasParks=[];
                    this.vegasParks.push({x:cx,z:cz});
                }
                const grass = new THREE.Mesh(
                    new THREE.BoxGeometry(44, 0.42, 44),
                    new THREE.MeshLambertMaterial({ color: this.preset.parkColor })
                );
                grass.position.set(cx, 0.21, cz);
                this.cityGroup.add(grass);

                const tropical=this.preset.id==='rio'||
                    this.preset.id==='havana';
                const desert=this.preset.id==='vegas';
                // Mesmas geometrias e materiais usados em todos os parques
                // da cidade; troca de cidade libera os recursos normalmente.
                if(!this.parkGeometryCache){
                    this.parkGeometryCache={
                        trunkGeo:new THREE.CylinderGeometry(
                            desert?.45:.35,desert?.53:.55,
                            desert?4.5:tropical?5.5:3.5,6),
                        crownGeo:desert?
                            new THREE.BoxGeometry(2.6,.58,.72):
                            new THREE.ConeGeometry(
                                tropical?3.8:3.2,tropical?3.0:6.5,7),
                        trunkMat:new THREE.MeshLambertMaterial({
                            color:desert?0x4a7c49:0x78350f}),
                        leafMat:new THREE.MeshLambertMaterial({
                            color:desert?0x629c59:
                                this.preset.id==='rio'?0x15803d:
                                tropical?0x339a5e:0x176338
                        })
                    };
                }
                const cache=this.parkGeometryCache;
                for(let i=-1;i<=1;i+=2){
                    for(let j=-1;j<=1;j+=2){
                        const tx=cx+i*12,tz=cz+j*12;
                        const trunk=new THREE.Mesh(cache.trunkGeo,cache.trunkMat);
                        trunk.position.set(tx,desert?2.3:tropical?2.8:1.9,tz);
                        const crown=new THREE.Mesh(cache.crownGeo,cache.leafMat);
                        crown.position.set(tx,desert?4.1:tropical?6.0:5.5,tz);
                        this.cityGroup.add(trunk,crown);
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

            toggleHomeGarageDoor(){
                if(!this.homeGarageDoor)return false;
                this.homeGarageDoorOpen=!this.homeGarageDoorOpen;
                const boxes=this.buildingBoxes;
                const idx=boxes.indexOf(this.homeGarageDoorClosedBox);
                if(this.homeGarageDoorOpen&&idx>=0)boxes.splice(idx,1);
                if(!this.homeGarageDoorOpen&&idx<0)
                    boxes.push(this.homeGarageDoorClosedBox);
                // Invalida o índice espacial quando a barreira muda.
                if(this._spatialCollisions)this._spatialCollisions.boxes=null;
                return this.homeGarageDoorOpen;
            }

            buildSafeHouseBlock(cx, cz) {
                // A garagem ocupa a ala esquerda do próprio imóvel.
                // Substitui o antigo bloco maciço por paredes com abertura frontal.
                const masonry=new THREE.MeshLambertMaterial({color:0x57534e});
                const trim=new THREE.MeshLambertMaterial({color:0x7c2d12});
                const wall=(x,y,z,w,h,d,mat=masonry,collide=true)=>{
                    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
                    mesh.position.set(x,y,z);mesh.receiveShadow=true;
                    this.cityGroup.add(mesh);
                    if(collide)this.buildingBoxes.push({
                        minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
                    return mesh;
                };
                wall(cx,7.2,cz-15,30,14,.7);
                wall(cx-15,7.2,cz,.7,14,30);
                wall(cx+15,7.2,cz,.7,14,30);
                // Abertura para garagem com 8m de largura na fachada sul.
                wall(cx-14,7.2,cz+15,2,14,.65);
                wall(cx+5,7.2,cz+15,20,14,.65);
                // Viga SOBRE a entrada: não pode entrar em AABBs 2D!
                // Antes era um colisor invisível apesar de ficar a 7..14 m.
                wall(cx-9,10.5,cz+15,8,7,.65,masonry,false);
                wall(cx,14.7,cz,32,1.2,32,trim,false);
                // Divisória entre garagem e parte residencial.
                wall(cx-4.7,3.3,cz+7.5,.5,6.6,14);
                wall(cx-9,3.1,cz+.45,8,6.2,.45);
                wall(cx-9,.11,cz+8,8,.2,13.5,
                    new THREE.MeshLambertMaterial({color:0x64748b}),false);
                for(const dz of [3,8,12]){
                    const stripe=wall(cx-9,.235,cz+dz,5,.02,.17,
                        new THREE.MeshBasicMaterial({color:0xfde68a}),false);
                }
                // Iluminação e estrutura de interiores com custo baixo.
                for(const dz of [3.5,10.5]){
                    wall(cx-9,5.9,cz+dz,4,.12,.3,
                        new THREE.MeshBasicMaterial({color:0xfff3bd}),false);
                }
                for(const sign of [-1,1]){
                    wall(cx+sign*8.2,7,cz+15.4,3.8,2.7,.12,
                        new THREE.MeshBasicMaterial({color:0x93c5fd}),false);
                }

                const zoneGeo = new THREE.CylinderGeometry(4.5, 4.5, 0.3, 16);
                const zoneMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.75 });
                this.safeHouseBeacon = new THREE.Mesh(zoneGeo, zoneMat);
                this.safeHouseBeacon.position.set(cx, 0.4, cz + 19);
                this.cityGroup.add(this.safeHouseBeacon);
                this.safeHouseZone = { x: cx, z: cz + 19, radius: 5.5 };
                this.garageParking={x:cx-9,z:cz+9,heading:0};
                this.garageExit={x:cx-9,z:cz+22,heading:0};
                this.homeGarageDoorOpen=false;
                this.homeGarageDoorHeight=0;
                this.homeGarageDoor=wall(cx-9,2.25,cz+15.15,7.8,4.5,.24,
                    new THREE.MeshLambertMaterial({color:0x475569}),false);
                this.homeGarageDoorClosedBox={
                    minX:cx-13,maxX:cx-5,minZ:cz+14.9,maxZ:cz+15.5
                };
                this.buildingBoxes.push(this.homeGarageDoorClosedBox);
                // Trilhos verticais e luminária da porta basculante.
                for(const dx of [-13,-5])
                    wall(cx+dx,2.35,cz+15.25,.23,4.7,.4,trim,false);
                wall(cx-9,4.85,cz+15.4,5,.22,.18,
                    new THREE.MeshBasicMaterial({color:0x34d399}),false);
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
                if(typeof DriverSpecialStructures!=='undefined')
                    DriverSpecialStructures.safeHouse(this,cx,cz);
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
                this.buildRegionalLandmarkDetails(cx,cz,west);
                if(id==='chicago' &&
                    typeof DriverChicagoOverhaul!=='undefined')
                    DriverChicagoOverhaul.detailLandmark(this,cx,cz);
                if(id==='rio' &&
                    typeof DriverRioOverhaul!=='undefined')
                    DriverRioOverhaul.detailLandmark(this,cx,cz);
                if(id==='havana' &&
                    typeof DriverHavanaOverhaul!=='undefined')
                    DriverHavanaOverhaul.detailLandmark(this,cx,cz);
                if(id==='vegas' &&
                    typeof DriverVegasOverhaul!=='undefined')
                    DriverVegasOverhaul.detailLandmark(this,cx,cz);
            }


            // Refinamento dos marcos urbanos dos quatro mapas.
            // Detalhes são somente visuais e preservam os colisores e caminhos.
            buildRegionalLandmarkDetails(cx,cz,west) {
                const city=this.preset.id;
                const opaque=[],light=[];
                const add=(glow,x,y,z,w,h,d,color)=>{
                    if([x,y,z,w,h,d].every(Number.isFinite)&&w>0&&h>0&&d>0)
                        (glow?light:opaque).push({x,y,z,w,h,d,color});
                };
                if(city==='chicago') {
                    if(west){
                        // Estádio: grades, pilares e placa sobre a entrada.
                        for(let x=-15;x<=15;x+=6){
                            add(false,cx+x,4,cz+20.6,.55,8,.5,0x334155);
                            add(false,cx+x,4,cz-20.6,.55,8,.5,0x334155);
                        }
                        for(let z=-12;z<=12;z+=6) {
                            add(false,cx+20.6,4,cz+z,.5,8,.55,0x334155);
                            add(false,cx-20.6,4,cz+z,.5,8,.55,0x334155);
                        }
                        add(false,cx,9.1,cz+20.1,21,1,.9,0x166534);
                        add(true,cx,9.2,cz+20.66,18,.25,.16,0xffe8a3);
                    }else{
                        // Armazéns do píer: portas de carga e platibanda.
                        for(const dx of [-13,0,13]){
                            add(false,cx+dx,6.75,cz,11,.65,16,0x475569);
                            add(false,cx+dx,2.6,cz+7.68,5.4,4.8,.24,0x334155);
                            add(true,cx+dx,3.6,cz+7.86,4.3,.65,.12,0xa5b4c5);
                            for(const offset of [-3.3,3.3])
                                add(false,cx+dx+offset,4.4,cz+7.82,.28,4.6,.35,0xe2e8f0);
                        }
                    }
                } else if(city==='havana') {
                    if(west){
                        // Capitolio: cornija trabalhada, molduras e frisos.
                        add(false,cx,11.5,cz,34,.85,27,0xffedd5);
                        for(const x of [-10,-5,0,5,10]){
                            add(true,cx+x,7.2,cz+12.78,2.8,2.6,.16,0x9cb6c5);
                            add(false,cx+x,8.6,cz+12.94,3.4,.25,.35,0xfff1ce);
                        }
                        add(false,cx,15.1,cz-2,19,.55,17,0xd6c7b0);
                    }else{
                        // Monumento: base, patamares e detalhes verticais.
                        for(const y of [.55,1.15,2.2])
                            add(false,cx,y,cz,15-y*1.4,.35,15-y*1.4,0xf5e4cf);
                        for(const z of [-1.8,1.8])
                            add(true,cx,20,cz+z,.6,9,.24,0xffe8a3);
                    }
                } else if(city==='vegas') {
                    // Fachadas de cassinos, janelas iluminadas e marquise.
                    const neon=west?0xec4899:0x22d3ee;
                    const height=west?43:34;
                    for(let y=10;y<height-3;y+=4.8){
                        for(let x=-10;x<=10;x+=5){
                            add(true,cx+x,y,cz+14.72,2.9,2.3,.15,
                                (Math.round(y+x)%3===0)?0xffe3a3:0x6c82a2);
                            add(false,cx+x,y+1.35,cz+14.9,3.25,.2,.35,0xd1d5db);
                        }
                    }
                    add(false,cx,5.5,cz+16.2,29,2.2,2.7,0x322345);
                    add(true,cx,6.65,cz+17.65,29.4,.35,.22,neon);
                    add(true,cx,4.35,cz+17.65,29.4,.35,.22,neon);
                    for(const x of [-14.4,14.4])
                        add(true,cx+x,height/2,cz+14.8,.43,height-1,.42,neon);
                } else if(west) {
                    // Praça litorânea: piso decorativo, floreiras e bordas.
                    for(const x of [-17,17]){
                        add(false,cx+x,.55,cz,1,.45,34,0xeee4c8);
                        add(false,cx+x,1.05,cz-15,5,.85,3,0x4c8b60);
                    }
                    add(false,cx,.52,cz+15,35,.16,3,0xf0ddae);
                } else {
                    // Mercado do Rio: lojas, toldos e telhado com platibanda.
                    for(const x of [-11,-3.7,3.7,11]){
                        add(true,cx+x,3.8,cz+10.69,4.8,3.7,.19,0x79b1b7);
                        add(false,cx+x,6.2,cz+11.2,5.4,.55,1.25,0xb45309);
                        add(false,cx+x,1.9,cz+10.93,.25,3.7,.35,0xe7d8b2);
                    }
                    add(false,cx,8.7,cz,35,.62,24,0x9f4137);
                }
                if(!opaque.length&&!light.length)return;
                const geo=new THREE.BoxGeometry(1,1,1),colors=new Map();
                const colorOf=c=>{
                    if(!colors.has(c))colors.set(c,new THREE.Color(c));
                    return colors.get(c);
                };
                for(const [items,glow] of [[opaque,false],[light,true]]){
                    if(!items.length)continue;
                    const mat=glow?
                        new THREE.MeshBasicMaterial({color:0xffffff}):
                        new THREE.MeshLambertMaterial({color:0xffffff});
                    const mesh=new THREE.InstancedMesh(geo,mat,items.length);
                    const d=new THREE.Object3D();
                    items.forEach((p,i)=>{
                        d.position.set(p.x,p.y,p.z);d.scale.set(p.w,p.h,p.d);
                        d.rotation.set(0,0,0);d.updateMatrix();
                        mesh.setMatrixAt(i,d.matrix);
                        mesh.setColorAt(i,colorOf(p.color));
                    });
                    mesh.instanceMatrix.needsUpdate=true;
                    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
                    mesh.frustumCulled=false;
                    mesh.name='landmark-detail-'+city+(glow?'-glass':'-solid');
                    this.cityGroup.add(mesh);
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
                if(typeof DriverSpecialStructures!=='undefined')
                    DriverSpecialStructures.station(this,cx,cz);
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
                if(typeof DriverSpecialStructures!=='undefined')
                    DriverSpecialStructures.caineCompound(this);
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
                if(typeof DriverSpecialStructures!=='undefined')
                    DriverSpecialStructures.warehouse(this,cx,cz);
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
                if(typeof DriverSpecialStructures!=='undefined')
                    DriverSpecialStructures.store(this,cx,cz,id);
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
                        // Mesa de save mantida no local original, sem
                        // móveis antigos sobrepondo os cômodos aprimorados.
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
                    if(typeof DriverSpecialStructures!=='undefined')
                        DriverSpecialStructures.interior(this,place);
                    if(home&&typeof DriverTannerHomeInterior!=='undefined')
                        DriverTannerHomeInterior.build(this,place);
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
                } else if(type==='crate'){
                    mesh=new THREE.Mesh(
                        new THREE.BoxGeometry(1.45,1.05,1.45),
                        new THREE.MeshLambertMaterial({color:0x9a6538})
                    );
                    mesh.position.set(x,.53,z);
                }else if(type==='fence'){
                    mesh=new THREE.Group();
                    const fenceMat=new THREE.MeshLambertMaterial({color:0x737f8d});
                    const railGeo=new THREE.BoxGeometry(5,.16,.16);
                    const postGeo=new THREE.BoxGeometry(.19,1.65,.19);
                    for(const y of [.65,1.27]){
                        const rail=new THREE.Mesh(railGeo,fenceMat);
                        rail.position.y=y;mesh.add(rail);
                    }
                    for(const offset of [-2.4,2.4]){
                        const post=new THREE.Mesh(postGeo,fenceMat);
                        post.position.set(offset,.83,0);mesh.add(post);
                    }
                    mesh.position.set(x,0,z);
                }else{
                    mesh = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.5, 0.45, 1.2, 8),
                        new THREE.MeshLambertMaterial({ color: 0x64748b })
                    );
                    mesh.position.set(x, 0.6, z);
                }
                this.cityGroup.add(mesh);
                this.destructibleProps.push({
                    mesh, type, x, z, vx:0, vy:0, vz:0, hit:false
                });
            }

            shatterProp(prop,impactSpeed){
                if(!prop || prop.shattered)return false;
                prop.shattered=true;
                if(prop.type==='pole'){
                    DriverStreetFurniture.hidePole(prop);
                } else if(prop.mesh) {
                    prop.mesh.visible=false;
                }
                const count=prop.type==='pole'?3:
                    prop.type==='fence'?5:prop.type==='crate'?6:4;
                const color=prop.type==='crate'?0xa36f42:
                    prop.type==='cone'?0xf97316:0x64748b;
                if(!this.debrisGeometry)
                    this.debrisGeometry=new THREE.BoxGeometry(.25,.25,.25);
                if(!this.debrisMaterialCache)
                    this.debrisMaterialCache=new Map();
                if(!this.debrisMaterialCache.has(color))
                    this.debrisMaterialCache.set(color,
                        new THREE.MeshLambertMaterial({color}));
                const material=this.debrisMaterialCache.get(color);
                if(prop.type==='pole'&&!this.poleDebrisGeometry)
                    this.poleDebrisGeometry=new THREE.CylinderGeometry(.12,.16,2.5,6);
                for(let i=0;i<count;i++){
                    // Orçamento de objetos de detrito: não acumular centenas
                    // de malhas após destruir postes e cercas seguidos.
                    if(this.debrisPieces.length>=140)break;
                    const geo=prop.type==='pole' && i<2 ?
                        this.poleDebrisGeometry : this.debrisGeometry;
                    const part=new THREE.Mesh(geo,material);
                    part.position.set(prop.x,prop.type==='pole'?2.3:.7,prop.z);
                    part.rotation.z=prop.type==='pole'?0.14:0;
                    const angle=Math.PI*2*i/count;
                    const boost=1+Math.min(2,impactSpeed/22);
                    this.cityGroup.add(part);
                    this.debrisPieces.push({
                        mesh:part,vx:Math.cos(angle)*boost*2,
                        vy:3+i*.45,vz:Math.sin(angle)*boost*2,
                        life:prop.type==='pole'?3.8:2.5
                    });
                }
                return true;
            }

            toggleBridge() {
                this.bridgeRaised = !this.bridgeRaised;
                // Uma notificação por acionamento, seja tecla B ou ciclo de 90s.
                if(this.preset.id==='chicago')
                    this.bridgeBellPending=true;
                return this.bridgeRaised;
            }

            update(dt, vehicles, onPropHitCallback, focusPosition=null) {
                this.signalClock += dt;
                if(typeof DriverChicagoGameplay!=='undefined'){
                    DriverChicagoGameplay.updateBridge(this,dt);
                    DriverChicagoGameplay.update(this,dt);
                }
                this.refreshTrafficLights();
                if(typeof DriverCoastalVisuals!=='undefined')
                    DriverCoastalVisuals.update(this,dt,focusPosition);
                if(this.caineBridgeGate)
                    this.caineBridgeGate.visible=!!this.caineBridgeClosed;
                const targetAngle = this.bridgeRaised ? THREE.MathUtils.degToRad(38) : 0.08;
                this.bridgeAngle = THREE.MathUtils.lerp(this.bridgeAngle, targetAngle, dt * 2.5);
                if (this.bridgeSouthLeaf && this.bridgeNorthLeaf) {
                    this.bridgeSouthLeaf.rotation.x = -this.bridgeAngle;
                    this.bridgeNorthLeaf.rotation.x = this.bridgeAngle;
                }
                if(typeof DriverChicagoEastBridge!=='undefined')
                    DriverChicagoEastBridge.update(this,dt);

                // Elevação da porta da garagem residencial.
                if(this.homeGarageDoor){
                    const height=this.homeGarageDoorOpen?4.65:0;
                    this.homeGarageDoorHeight=THREE.MathUtils.damp(
                        this.homeGarageDoorHeight||0,height,7,dt);
                    this.homeGarageDoor.position.y=2.25+this.homeGarageDoorHeight;
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
                            // Colisão por segmento: carros rápidos não pulam
                            // por cima do objeto entre dois frames de física.
                            const ax=Number.isFinite(car.prevX)?car.prevX:car.x;
                            const az=Number.isFinite(car.prevZ)?car.prevZ:car.z;
                            const vx=car.x-ax,vz=car.z-az;
                            const len2=vx*vx+vz*vz;
                            const t=len2>0?Math.max(0,Math.min(1,
                                ((p.x-ax)*vx+(p.z-az)*vz)/len2)):1;
                            const dx=(ax+vx*t)-p.x;
                            const dz=(az+vz*t)-p.z;
                            const impact=Math.abs(car.speed);
                            const radiusSq=p.type==='fence'?12.25:
                                p.type==='pole'?5.1:4.2;
                            if(dx*dx+dz*dz<radiusSq &&
                                impact>(p.type==='pole'?6:3)){
                                p.hit=true;
                                p.vx=Math.sin(car.heading)*impact*1.1+
                                    (Math.random()-.5)*6;
                                p.vz=Math.cos(car.heading)*impact*1.1+
                                    (Math.random()-.5)*6;
                                p.vy=6+Math.random()*5;
                                if(impact>14 || p.type==='crate' ||
                                    p.type==='pole' || p.type==='fence')
                                    this.shatterProp(p,impact);
                                if(p.type==='crate' || p.type==='pole' ||
                                    p.type==='fence'){
                                    const factor=p.type==='pole'?.69:
                                        p.type==='fence'?.84:.92;
                                    car.speed*=factor;
                                    const severity=p.type==='pole'?.18:
                                        p.type==='fence'?.09:.045;
                                    car.damage=Math.min(100,(car.damage||0)+
                                        Math.min(p.type==='pole'?9:4,
                                            impact*severity));
                                    if(typeof DriverVehicleCollisions!=='undefined' &&
                                        typeof DriverVehicleCollisions.recordZone==='function'){
                                        const nx=p.x-car.x,nz=p.z-car.z;
                                        const len=Math.hypot(nx,nz);
                                        const dirX=len>.01?nx/len:Math.sin(car.heading);
                                        const dirZ=len>.01?nz/len:Math.cos(car.heading);
                                        DriverVehicleCollisions.recordZone(
                                            car,dirX,dirZ,impact*severity);
                                    }
                                }
                                if(onPropHitCallback)
                                    onPropHitCallback(car,p,impact);
                                break;
                            }
                        }
                    } else if(!p.shattered){
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
                for(let i=this.debrisPieces.length-1;i>=0;i--){
                    const d=this.debrisPieces[i];
                    d.life-=dt;
                    if(d.life<=0){
                        this.cityGroup.remove(d.mesh);
                        this.debrisPieces.splice(i,1);
                        continue;
                    }
                    d.vy-=18*dt;
                    d.mesh.position.x+=d.vx*dt;
                    d.mesh.position.y=Math.max(.14,
                        d.mesh.position.y+d.vy*dt);
                    d.mesh.position.z+=d.vz*dt;
                    d.mesh.rotation.x+=dt*8;
                    d.mesh.rotation.y+=dt*6;
                    if(d.mesh.position.y<=.15){
                        d.vy=Math.abs(d.vy)*.22;
                        d.vx*=.85;d.vz*=.85;
                    }
                }
            }

            isWaterAt(x,z){
                // O segundo tabuleiro impede que a pista seja tratada como água.
                if(typeof DriverChicagoEastBridge!=='undefined' &&
                    DriverChicagoEastBridge.isDeckLocation(this,x,z))return false;
                return z>34.85&&z<65.15&&Math.abs(x)>12.25;
            }

            buildMissionStartMarker(){
                const city=this.preset.id;
                // Marcadores de campanha por cidade, inclusive Vegas e Rio.
                const places={
                    chicago:{x:-64,z:-144,type:'story_tipoff'},
                    havana:{x:16,z:-224,type:'story_havana_lead'},
                    vegas:{x:-64,z:-144,type:'story_vegas_ambulance'},
                    rio:{x:16,z:-224,type:'story_rio_barge'}
                };
                const place=places[city];
                if(!place)return;
                const mat=new THREE.MeshBasicMaterial({
                    color:0x22c55e,transparent:true,opacity:.78,
                    depthWrite:false
                });
                const ring=new THREE.Mesh(
                    new THREE.TorusGeometry(2.7,.26,5,16),mat);
                ring.rotation.x=Math.PI/2;
                ring.position.set(place.x,.55,place.z);
                this.cityGroup.add(ring);
                const arrow=new THREE.Mesh(
                    new THREE.ConeGeometry(.9,1.7,6),
                    new THREE.MeshBasicMaterial({color:0xfde047}));
                arrow.rotation.x=Math.PI;
                arrow.position.set(place.x,3.3,place.z);
                this.cityGroup.add(arrow);
                this.missionStart={...place,ring,arrow};
            }

            // Calçadas 50x50 com tampo em y=.35. Consultas O(1), sem
            // percorrer dezenas de caixas a cada frame ou criar colisores
            // verticais que bloqueariam acessos de garagens e missões.
            sidewalkCell(x,z) {
                if(!Number.isFinite(x)||!Number.isFinite(z))return null;
                const cx=Math.round((x-40)/80)*80+40;
                const cz=Math.round((z+40)/80)*80-40;
                return this.sidewalkGrid?.has(cx+':'+cz) ? {x:cx,z:cz} : null;
            }

            isOnSidewalk(x,z,radius=0) {
                const cell=this.sidewalkCell(x,z);
                const clear=25-Math.max(0,Number(radius)||0);
                return !!cell&&clear>=0&&
                    Math.abs(x-cell.x)<=clear&&
                    Math.abs(z-cell.z)<=clear;
            }

            getSidewalkHeightAt(x,z) {
                const cell=this.sidewalkCell(x,z);
                if(!cell)return 0;
                const edge=25-Math.max(Math.abs(x-cell.x),Math.abs(z-cell.z));
                if(edge<=0)return 0;
                // Borda suavizada (0.9m) para a suspensão subir sem teleporte.
                // A partir de 0.9m para dentro, o chão acompanha y=.35.
                return .35*Math.min(1,edge/.9);
            }

            getGroundHeightAt(x,z,referenceY=null) {
                if(this.trainStation){
                    const ramp=this.trainStation.ramp,p=this.trainStation.platform;
                    // Eixo da rampa é estreito. Suavizar a borda evita
                    // degrau de 8m quando o carro passa junto ao corrimão.
                    if(x>=ramp.minX-1&&x<=ramp.maxX+1 &&
                        z<=ramp.startZ&&z>=ramp.endZ){
                        const distance=Math.min(x-(ramp.minX-1),
                            ramp.maxX+1-x);
                        const lateral=Math.min(1,Math.max(0,distance/1.3));
                        const fraction=Math.min(1,Math.max(0,
                            (ramp.startZ-z)/(ramp.startZ-ramp.endZ)));
                        return p.height*fraction*lateral;
                    }
                    if(x>=p.minX&&x<=p.maxX &&
                        z>=p.minZ&&z<=p.maxZ){
                        // A plataforma está a 11,3m do solo. Veículos
                        // passando por baixo não podem teleportar para cima.
                        if(Number.isFinite(referenceY) &&
                            referenceY<p.height-2.5)return 0;
                        return p.height;
                    }
                }
                if(typeof DriverRegionalInfrastructure!=='undefined'){
                    const regionalRamp=DriverRegionalInfrastructure.rampHeight(
                        this,x,z);
                    if(regionalRamp>0)return regionalRamp;
                }
                // Mesmo ângulo de pivô visual e físico da nova ponte.
                if(typeof DriverChicagoEastBridge!=='undefined'){
                    const deck=DriverChicagoEastBridge.deckHeight(this,x,z);
                    if(deck!==null)return deck;
                }
                if(Math.abs(x)<11.2&&z>=34&&z<=66){
                    const distFromEdge=Math.min(z-34,66-z);
                    return .15+Math.sin(this.bridgeAngle)*distFromEdge;
                }
                // Leito profundo sob a superfície aquática, não o mesmo
                // asfalto plano de y=0: o carro pode cair e submergir.
                if(typeof this.isWaterAt==='function' &&
                    this.isWaterAt(x,z))return -4.0;
                // Mantém compatibilidade com cenários isolados dos testes
                // que chamam esta rotina com uma superfície simulada.
                return typeof this.getSidewalkHeightAt==='function'?
                    this.getSidewalkHeightAt(x,z):0;
            }

            isPointBlocked(x, z, radius = 1.2, y = 0) {
                if (this.interiorArea(x,z,radius)){
                    // Dentro de casa, testar somente os móveis sólidos.
                    // As paredes exteriores pertencem ao mundo externo.
                    return typeof DriverTannerHomeInterior!=='undefined' &&
                        DriverTannerHomeInterior.blocked(this,x,z,radius);
                }
                if(typeof DriverChicagoEastBridge!=='undefined' &&
                    DriverChicagoEastBridge.railBlocked(this,x,z,radius,y))
                    return true;
                if(this.caineBridgeClosed && Math.abs(x)<11+radius &&
                    z+radius>49.5 && z-radius<52.5)return true;
                if (Math.abs(x)>this.worldLimit || Math.abs(z)>this.worldLimit)return true;
                // Corrimãos físicos somente no volume desenhado, com
                // alturas locais coerentes com a rampa e não com o chão.
                if(this.trainStation){
                    const r=this.trainStation.ramp;
                    if(z>=r.endZ+1&&z<=r.startZ-1){
                        const slope=(r.startZ-z)/(r.startZ-r.endZ);
                        const top=this.trainStation.platform.height*slope;
                        if(y<top+1.0&&y>=top-2.0){
                            for(const rx of [-17.2,-10.8])
                                if(Math.abs(x-rx)<radius+.12)return true;
                        }
                    }
                }
                // Só existem barreiras onde o muro visível realmente existe.
                if(y<1.8&&y>=-1.5){
                    for(const segment of this.canalWallSegments||[]){
                        if(Math.abs(z-segment.z)<.75+radius &&
                            x>=segment.minX-radius&&x<=segment.maxX+radius)
                            return true;
                    }
                }

                // Exact AABB queries within the current 80m grid,
                // including neighboring blocks, without removing colliders.
                if(typeof DriverSpatialCollisionGrid!=='undefined'){
                    if(!this._spatialCollisions)
                        this._spatialCollisions=new DriverSpatialCollisionGrid();
                    return this._spatialCollisions.blocked(
                        this.buildingBoxes,x,z,radius);
                }
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

