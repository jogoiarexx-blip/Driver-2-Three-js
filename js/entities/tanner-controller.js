        /**
         * ============================================================================
         * MÓDULO 4: CONTROLADOR DE JOHN TANNER A PÉ (3ª PESSOA + ANIMAÇÃO DE PASSOS)
         * ============================================================================
         */
        class TannerController {
            constructor(scene) {
                this.scene = scene;
                this.group = new THREE.Group();
                this.heading = 0;
                this.walkCycle = 0;
                this.isSitting = false;

                this.buildTannerMesh();
                this.scene.add(this.group);
                this.setVisible(false);
            }

            buildTannerMesh() {
                const jacketMat = new THREE.MeshLambertMaterial({ color: 0x451a03 }); // Jaqueta de couro marrom clássica do Tanner
                const jeansMat = new THREE.MeshLambertMaterial({ color: 0x1d4ed8 });
                const skinMat = new THREE.MeshLambertMaterial({ color: 0xfdba74 });
                const hairMat = new THREE.MeshLambertMaterial({ color: 0x27272a });

                // Torso
                this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.32), jacketMat);
                this.torso.position.y = 1.15;
                this.group.add(this.torso);

                // Cabeça + Cabelo anos 70/90
                this.head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skinMat);
                this.head.position.y = 1.72;
                const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.38), hairMat);
                hair.position.y = 0.14;
                this.head.add(hair);
                this.group.add(this.head);

                // Braços articulados
                const armGeo = new THREE.BoxGeometry(0.18, 0.62, 0.18);
                this.leftArm = new THREE.Mesh(armGeo, jacketMat);
                this.leftArm.position.set(-0.38, 1.12, 0);
                this.rightArm = new THREE.Mesh(armGeo, jacketMat);
                this.rightArm.position.set(0.38, 1.12, 0);
                this.group.add(this.leftArm, this.rightArm);

                // Pernas articuladas
                const legGeo = new THREE.BoxGeometry(0.22, 0.72, 0.22);
                this.leftLeg = new THREE.Mesh(legGeo, jeansMat);
                this.leftLeg.position.set(-0.15, 0.42, 0);
                this.rightLeg = new THREE.Mesh(legGeo, jeansMat);
                this.rightLeg.position.set(0.15, 0.42, 0);
                this.group.add(this.leftLeg, this.rightLeg);
            }

            setVisible(visible) {
                this.group.visible = visible;
            }

            setPosition(x, y, z, heading = 0) {
                this.group.position.set(x, y, z);
                this.heading = heading;
                this.group.rotation.y = heading;
            }

            toggleSitOnBench(benchPos) {
                if (this.isSitting) {
                    this.isSitting = false;
                    this.torso.position.y = 1.15;
                    this.head.position.y = 1.72;
                    this.leftLeg.rotation.x = 0;
                    this.rightLeg.rotation.x = 0;
                    return false;
                } else {
                    this.isSitting = true;
                    this.group.position.set(benchPos.x, 0.15, benchPos.z + 0.35);
                    this.torso.position.y = 0.85;
                    this.head.position.y = 1.42;
                    this.leftLeg.rotation.x = -Math.PI / 2;
                    this.rightLeg.rotation.x = -Math.PI / 2;
                    return true;
                }
            }

            update(dt, input, cityBuilder) {
                if (!this.group.visible) return;

                // Se Tanner estiver sentado no banco e o jogador tentar andar, levanta automaticamente
                if (this.isSitting) {
                    if (input.up || input.down || input.left || input.right) {
                        this.toggleSitOnBench();
                    } else {
                        return;
                    }
                }

                const turnSpeed = 3.2;
                if (input.left) this.heading += turnSpeed * dt;
                if (input.right) this.heading -= turnSpeed * dt;
                this.group.rotation.y = this.heading;

                let moveDir = 0;
                if (input.up) moveDir = 1;
                else if (input.down) moveDir = -0.65;

                const walkSpeed = (input.sprint ? 12.5 : 8.5) * moveDir;

                if (Math.abs(moveDir) > 0) {
                    const nextX = this.group.position.x + Math.sin(this.heading) * walkSpeed * dt;
                    const nextZ = this.group.position.z + Math.cos(this.heading) * walkSpeed * dt;
                    // Tanner também respeita piso inferior/plataforma:
                    // não pode subir 11m entrando pela lateral da estação.
                    const groundY = cityBuilder.getGroundHeightAt(
                        nextX,nextZ,this.group.position.y);

                    if (!cityBuilder.isPointBlocked(nextX, nextZ, 0.55, groundY)) {
                        this.group.position.x = nextX;
                        this.group.position.z = nextZ;
                        this.group.position.y = groundY;
                    }

                    // Animação dos braços e pernas correndo
                    this.walkCycle += dt * (input.sprint ? 16 : 11);
                    const swing = Math.sin(this.walkCycle) * 0.65;
                    this.leftLeg.rotation.x = swing;
                    this.rightLeg.rotation.x = -swing;
                    this.leftArm.rotation.x = -swing * 0.8;
                    this.rightArm.rotation.x = swing * 0.8;
                } else {
                    this.leftLeg.rotation.x = 0;
                    this.rightLeg.rotation.x = 0;
                    this.leftArm.rotation.x = 0;
                    this.rightArm.rotation.x = 0;
                }
            }
        }

