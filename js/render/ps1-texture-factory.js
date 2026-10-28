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

            // Fundo urbano entre ruas: nunca conter marcas amarelas.
            // A textura antiga repetia faixas em toda a cidade, inclusive
            // sob parques, edifícios e cruzamentos.
            static createAsphaltTexture() {
                return this.makeGroundTexture(
                    '#4b4c4a','#50514e','#41433f',211);
            }

            static createRoadTexture(city='chicago') {
                const palettes={
                    chicago:['#42474d','#4e545b','#393e44'],
                    havana:['#685f54','#74695b','#564e47'],
                    vegas:['#4a4648','#555055','#3c3941'],
                    rio:['#525657','#5e6160','#41484c']
                };
                const [base,light,dark]=palettes[city]||palettes.chicago;
                return this.makeGroundTexture(base,light,dark,83);
            }

            static makeGroundTexture(base,light,dark,seed=13) {
                const canvas=document.createElement('canvas');
                canvas.width=128;canvas.height=128;
                const ctx=canvas.getContext('2d');
                let s=seed>>>0;
                const rnd=()=>{
                    s=(Math.imul(1664525,s)+1013904223)>>>0;
                    return s/4294967296;
                };
                ctx.fillStyle=base;
                ctx.fillRect(0,0,128,128);
                // Manchas e grão grandes no lugar de ruído excessivo:
                // as ruas antigas pareciam um piso xadrez de quadradinhos.
                for(let i=0;i<165;i++){
                    const x=Math.floor(rnd()*128),y=Math.floor(rnd()*128);
                    ctx.globalAlpha=.07+rnd()*.14;
                    ctx.fillStyle=rnd()>.5?light:dark;
                    ctx.fillRect(x,y,1+rnd()*4,1+rnd()*5);
                }
                for(let i=0;i<6;i++){
                    ctx.globalAlpha=.08;
                    ctx.fillStyle=i%2?light:dark;
                    ctx.fillRect(rnd()*126,rnd()*126,5+rnd()*13,
                        3+rnd()*8);
                }
                ctx.globalAlpha=1;
                const tex=new THREE.CanvasTexture(canvas);
                tex.magFilter=THREE.NearestFilter;
                tex.minFilter=THREE.NearestFilter;
                tex.wrapS=THREE.RepeatWrapping;
                tex.wrapT=THREE.RepeatWrapping;
                return tex;
            }
        }

