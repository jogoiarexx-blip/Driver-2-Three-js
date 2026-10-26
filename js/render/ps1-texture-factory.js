        /**
         * ============================================================================
         * MÓDULO 2: GERADOR DE TEXTURAS PROCEDURAIS ESTILO PS1 (PIXEL ART CANVAS)
         * Cria fachadas de prédios retrô, asfalto e faixas sem precisar de imagens externas
         * ============================================================================
         */
        class PS1TextureFactory {
            static createBuildingTexture(baseHue, windowColor) {
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 128;
                const ctx = canvas.getContext('2d');

                // Parede de concreto/tijolo retrô
                ctx.fillStyle = baseHue;
                ctx.fillRect(0, 0, 64, 128);

                // Janelas iluminadas/apagadas estilo Chicago anos 90
                for (let y = 8; y < 116; y += 14) {
                    for (let x = 6; x < 56; x += 14) {
                        const lit = Math.random() > 0.38;
                        ctx.fillStyle = lit ? windowColor : '#1e293b';
                        ctx.fillRect(x, y, 8, 9);
                    }
                }
                // Térreo comercial
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, 116, 64, 12);

                const tex = new THREE.CanvasTexture(canvas);
                tex.magFilter = THREE.NearestFilter; // Filtro pixelado autêntico do PS1!
                tex.minFilter = THREE.NearestFilter;
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                return tex;
            }

            static createAsphaltTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 128;
                canvas.height = 128;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#262930';
                ctx.fillRect(0, 0, 128, 128);

                // Granulado de asfalto PS1
                for (let i = 0; i < 400; i++) {
                    ctx.fillStyle = Math.random() > 0.5 ? '#2e323b' : '#1e2026';
                    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
                }

                // Faixa dupla amarela central
                ctx.fillStyle = '#eab308';
                ctx.fillRect(61, 0, 2, 128);
                ctx.fillRect(65, 0, 2, 128);

                const tex = new THREE.CanvasTexture(canvas);
                tex.magFilter = THREE.NearestFilter;
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                return tex;
            }
        }

