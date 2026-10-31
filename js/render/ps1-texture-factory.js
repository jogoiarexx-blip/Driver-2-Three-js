        /**
         * ============================================================================
         * MÓDULO 2: GERADOR DE TEXTURAS PROCEDURAIS ESTILO PS1 (PIXEL ART CANVAS)
         * Cria fachadas de prédios retrô, asfalto e faixas sem precisar de imagens externas
         * ============================================================================
         */
        class PS1TextureFactory {
            static createBuildingTexture(baseHue, windowColor, city='default', paletteIndex=0) {
                if(city==='chicago')
                    return this.createChicagoFacadeTexture(baseHue,windowColor,paletteIndex);
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


            /**
             * Fachadas Chicago PS1, geradas em canvas e compartilhadas por paleta.
             * Não cria meshes nem altera lotes, colisores, ruas ou LOD.
             * 128x256 (128 KiB RGBA por paleta na GPU antes de mipmaps).
             */
            static createChicagoFacadeTexture(baseHue, windowColor, paletteIndex=0) {
                const canvas=document.createElement('canvas');
                canvas.width=128;canvas.height=256;
                const ctx=canvas.getContext('2d');
                const kind=Number(paletteIndex)|0;
                let seed=(0xC41C600+kind*0x9E3779B1)>>>0;
                const rnd=()=>{
                    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
                    return seed/4294967296;
                };
                const tower=kind===3, brick=kind===2, stone=kind===0;
                ctx.fillStyle=baseHue;
                ctx.fillRect(0,0,128,256);

                // Mancha de desgaste localizada: nada de aleatoriedade por frame.
                ctx.fillStyle=brick?'#c69b86':stone?'#bbc0bd':'#9aa7aa';
                for(let i=0;i<280;i++){
                    ctx.globalAlpha=.025+rnd()*.07;
                    ctx.fillRect(Math.floor(rnd()*128),Math.floor(rnd()*224),
                        1+Math.floor(rnd()*4),1+Math.floor(rnd()*3));
                }
                ctx.globalAlpha=1;

                if(brick){
                    // Juntas desencontradas em tijolos: fachadas de Wicker Park.
                    ctx.fillStyle='#4c302b';
                    for(let y=3;y<226;y+=8){
                        ctx.fillRect(0,y,128,1);
                        for(let x=((y/8)|0)%2?0:9;x<128;x+=18)
                            ctx.fillRect(x,y-7,1,8);
                    }
                    ctx.fillStyle='#b78b72';
                    for(let y=10;y<224;y+=46)ctx.fillRect(0,y,128,2);
                }else if(tower){
                    // Caixilhos contínuos de aço e faixas de vidro azulado.
                    ctx.fillStyle='#1c3441';
                    for(let x=0;x<128;x+=30)ctx.fillRect(x,0,3,226);
                    ctx.fillStyle='#7b8b91';
                    for(let y=0;y<225;y+=23)ctx.fillRect(0,y,128,2);
                }else{
                    // Pedra calcária/concreto: frisos e juntas largas.
                    ctx.fillStyle=stone?'#68717a':'#505b64';
                    for(let y=4;y<225;y+=24)ctx.fillRect(0,y,128,2);
                    ctx.fillStyle=stone?'#909ca2':'#707b82';
                    for(let x=0;x<128;x+=32)ctx.fillRect(x,0,2,224);
                }

                // Vãos, peitoris e reflexos discretos nas janelas.
                for(let row=0;row<9;row++)for(let col=0;col<4;col++){
                    const x=9+col*30,y=14+row*23;
                    const lit=((row*19+col*11+kind*7)%11)<3;
                    ctx.fillStyle=brick?'#46382f':tower?'#203541':'#4d4f52';
                    ctx.fillRect(x-3,y-3,22,17);
                    ctx.fillStyle=lit?windowColor:(tower?'#456879':'#354c58');
                    ctx.fillRect(x,y,16,11);
                    ctx.fillStyle=lit?'#e1d0b2':'#82a0a9';
                    ctx.globalAlpha=lit?.36:.23;
                    ctx.fillRect(x+1,y+1,5,8);
                    ctx.globalAlpha=1;
                    ctx.fillStyle=brick?'#d0ab96':stone?'#afb4b2':'#77858c';
                    ctx.fillRect(x-4,y+12,24,2);
                    ctx.fillStyle='#242f37';
                    ctx.fillRect(x+7,y,2,11);
                }

                // Cornija e térreo; evita letreiros legíveis ou dependência externa.
                ctx.fillStyle=brick?'#49342d':stone?'#687078':'#273e49';
                ctx.fillRect(0,0,128,7);
                ctx.fillStyle=brick?'#c39e89':stone?'#a1aaa9':'#6e8189';
                ctx.fillRect(0,7,128,3);
                ctx.fillStyle='#2d343a';
                ctx.fillRect(0,226,128,30);
                ctx.fillStyle=brick?'#795a43':'#657077';
                ctx.fillRect(0,226,128,4);
                for(let i=0;i<4;i++){
                    const x=4+i*31;
                    ctx.fillStyle='#263f49';
                    ctx.fillRect(x,233,25,19);
                    ctx.fillStyle='#8395a0';
                    ctx.globalAlpha=.40;
                    ctx.fillRect(x+2,235,8,15);
                    ctx.globalAlpha=1;
                    ctx.fillStyle='#879397';
                    ctx.fillRect(x+12,233,2,19);
                }
                // Toldos discretos nos bairros de tijolo.
                if(brick){
                    ctx.fillStyle='#7f3d34';ctx.fillRect(0,229,128,4);
                    ctx.fillStyle='#d0b39a';
                    for(let x=4;x<128;x+=20)ctx.fillRect(x,229,8,4);
                }
                const tex=new THREE.CanvasTexture(canvas);
                tex.name='driver2-chicago-facade-'+kind;
                tex.magFilter=THREE.NearestFilter;
                tex.minFilter=THREE.NearestMipmapNearestFilter||THREE.NearestFilter;
                tex.generateMipmaps=true;
                tex.wrapS=THREE.RepeatWrapping;
                tex.wrapT=THREE.RepeatWrapping;
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
                const tex=this.makeGroundTexture(base,light,dark,83);
                if(city==='chicago'){
                    // Rachaduras leves no asfalto, sem duplicar faixas viárias.
                    // CanvasTexture usa image; stubs de QA antigos usam canvas.
                    const canvas=tex.image||tex.canvas;
                    const ctx=canvas&&typeof canvas.getContext==='function'
                        ?canvas.getContext('2d'):null;
                    if(ctx){
                    let seed=0xC41CA5FA;
                    const rnd=()=>{
                        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
                        return seed/4294967296;
                    };
                    ctx.fillStyle='#1f242a';ctx.globalAlpha=.20;
                    for(let i=0;i<18;i++){
                        let x=rnd()*128,y=rnd()*128;
                        for(let n=0;n<3;n++){
                            ctx.fillRect(Math.floor(x),Math.floor(y),2,1);
                            x+=rnd()*5-2.5;y+=rnd()*5-2.5;
                        }
                    }
                    ctx.globalAlpha=1;
                    tex.needsUpdate=true;
                    }
                }
                return tex;
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

