        /**
         * ============================================================================
         * MÓDULO 0: VIRTUAL FILE SYSTEM (VFS) & MANIFESTO DE ASSETS DA INTERNET
         * Contém o código-fonte documentado dos módulos e arquivos GitHub para download.
         * ============================================================================
         */
        const VFS_MODULES = {
            'README.md': `# 🚓 Driver 2: Back on the Streets — Three.js Open World Edition

Recriação web em **Three.js (WebGL)** homenageando o clássico *Driver 2: Back on the Streets* (Reflections Interactive, 2000).

## ✨ Funcionalidades Implementadas
- **4 Cidades Clássicas**: Chicago (ponte basculante), Havana (prédios coloniais e carros anos 50), Las Vegas (cassinos neon noturnos) e Rio de Janeiro (Morro do Corcovado + Cristo Redentor e praia costeira).
- **Transição Veículo / A Pé com John Tanner (\`E\` / \`ENTER\`)**: Saia do carro, caminhe pela cidade, sente nos bancos de praça, plante explosivos C4, acione o interruptor da **Garagem Secreta** ou roube outros carros (incluindo Ônibus, Caminhão Baú, Limusine e Viaturas Policiais).
- **12 Modos de Jogo**: *Take a Ride*, *6 Missões Undercover* (Perseguição, Checkpoints, Entrega sob Fogo, Stealth Tail, Sabotagem C4 e Sequestro de Carga), *Survival*, *Trailblazer*, *Fura-Bloqueios*, *Mountain Pass GP* e *Quick Chase*.
- **Física Muscle-Car Anos 90**: Botão dedicado de *Burnout / J-Turn* (\`SHIFT\` / \`C\`), freio de mão (\`ESPAÇO\`), deformação visual de capô/porta-malas e as clássicas **4 calotas que voam nas curvas**.
- **Film Director Mode (\`R\`)**: Replay com câmeras de tripé na calçada, câmera de calota (*Wheel Cam*) e helicóptero.
- **Clima Dinâmico (\`N\`)**: Dia, Entardecer, Noite e Tempestade com Chuva 3D.

## 🚀 Como Rodar ou Publicar no GitHub Pages
Não requer etapa de build! Basta abrir o arquivo \`index.html\` em qualquer navegador moderno ou ativar o **GitHub Pages** na branch \`main\`.
`,
            '.github/workflows/deploy.yml': `name: Deploy Driver 2 Three.js to GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`,
            'package.json': `{
  "name": "driver2-threejs-edition",
  "version": "2.0.0",
  "description": "Driver 2: Back on the Streets Open World Remake in Three.js",
  "main": "index.html",
  "scripts": {
    "start": "npx serve ."
  },
  "keywords": ["driver2", "threejs", "webgl", "ps1", "open-world", "car-game"],
  "license": "MIT"
}`,
            'assets/AssetManifest.json': `{
  "project": "Driver 2: Back on the Streets - Complete Three.js Remake",
  "cities": ["Chicago (USA)", "Havana (Cuba)", "Las Vegas (USA)", "Rio de Janeiro (Brazil)"],
  "modes": ["Take a Ride", "Undercover Missions (1-6)", "Survival", "Trailblazer", "Roadblock Gauntlet", "Mountain Pass GP", "Quick Chase", "Film Director Replay"],
  "referenceRepositories": [
    {
      "name": "OpenDriver2 (Reverse Engineered PS1 Engine Reference)",
      "url": "https://github.com/OpenDriver2/OpenDriver2",
      "usage": "Física de Burnout/Slip-Angle, 4 Cidades, Garagens Secretas com Interruptor e Film Director"
    },
    {
      "name": "Khronos Group glTF Sample Models CDN",
      "url": "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/",
      "usage": "Modelos .GLB remotos carregáveis em tempo real via THREE.GLTFLoader"
    }
  ]
}`,
            'world/CityPresets.js': `/**
 * world/CityPresets.js
 * Define as paletas, atmosfera, monumentos (Ponte de Chicago, Cristo Redentor no Rio,
 * Cassinos Neon de Vegas, Havana Colonial) e carros secretos das 4 cidades do Driver 2.
 */
export const CITY_PRESETS = {
    chicago: { name: 'CHICAGO', sky: 0x1e293b, fog: 0.0040, copName: 'CHICAGO PD', secretCar: 'WRIGLEY HOT ROD V8' },
    havana:  { name: 'HAVANA',  sky: 0x7c2d12, fog: 0.0035, copName: 'POLICIA NACIONAL', secretCar: 'HAVANA MINI ROSA 59' },
    vegas:   { name: 'LAS VEGAS', sky: 0x090514, fog: 0.0038, copName: 'LVMPD CRUISER', secretCar: 'VEGAS NITRO CUSTOM' },
    rio:     { name: 'RIO DE JANEIRO', sky: 0x0369a1, fog: 0.0032, copName: 'PMERJ VIATURA', secretCar: 'COPACABANA TURBO V8' }
};`,
            'missions/DrivingGames.js': `/**
 * missions/DrivingGames.js
 * Gerencia os Modos Clássicos do Driver 2:
 * - Take a Ride (Passeio Livre + Caça ao Carro Secreto)
 * - Undercover 1: Perseguir a Testemunha (Destruir o carro de Caine)
 * - Undercover 2: Rota de Fuga (4 Checkpoints + Esconderijo)
 * - Undercover 3: Entrega sob Fogo (Carro já avariado + Felony 90%)
 * - Survival: 4 Viaturas ultra-agressivas com força gravitacional extra
 * - Trailblazer: Trilha de 10 totens luminosos (+4s por totem derrubado)
 */`,
            'engine/VehiclePhysics.js': `/**
 * engine/VehiclePhysics.js
 * Física autêntica anos 90 com botão dedicado de Burnout (SHIFT/C):
 * - Destracionamento imediato das rodas traseiras para giros J-Turn / 180º
 * - Deformação visual progressiva: capô dianteiro e porta-malas amassam/abrem quando damage > 45%
 * - Ejeção das 4 calotas (hubcaps) com som metálico no asfalto
 * - Sirene/Buzina acionável (H): viaturas roubadas abrem caminho no trânsito civil!
 */`,
            'entities/TannerController.js': `/**
 * entities/TannerController.js
 * Controla John Tanner a pé:
 * - Permite entrar/roubar qualquer veículo civil, policial ou secreto (E / Enter)
 * - Aciona interruptores de parede (Wall Switches) para abrir portões de Garagens Secretas
 */`,
            'entities/PedestrianSystem.js': `/**
 * entities/PedestrianSystem.js
 * Pedestres das calçadas com IA clássica do Driver 2 (Reflections, 2000):
 * - Caminham pelas calçadas das 4 cidades
 * - Nunca são atropelados: quando um carro se aproxima em alta velocidade,
 *   executam um salto lateral dramático (Dive/Dodge) com som de susto!
 * - Também gerencia os Bloqueios Policiais (Roadblocks) com cavaletes e viaturas.
 */`,
            'director/FilmDirector.js': `/**
 * director/FilmDirector.js
 * Gravador de Replay Circular (Últimos 15 segundos @ 60 FPS):
 * - Armazena matrizes de posição/rotação/inclinação do jogador e veículos próximos
 * - Câmeras Clássicas: Trackside Tripod Cam (acompanha da calçada), Wheel Cam (calota),
 *   Helicopter Cam (aérea) e Hood Cam (capô)
 */`,
            'audio/SoundEngine.js': `/**
 * audio/SoundEngine.js
 * Sintetizador Web Audio API completo:
 * - Ronco V8 modulado por RPM e Burnout
 * - Cantar de pneu em derrapagens, buzina dupla e sirene policial Wail/Yelp
 * - Som metálico agudo de calota quicando e batidas de lataria
 */`
        };

