# Driver 2 — Three.js (GitHub Pages)

Recriação experimental de Driver 2 para navegador, baseada em Three.js. O projeto foi organizado em arquivos estáticos para funcionar diretamente no **GitHub Pages**, sem Node.js, npm ou compilação.

## Executar

Abra a página publicada em **https://jogoiarexx-blip.github.io/Driver-2-Three-js/**.

Para publicar pelo GitHub Pages, em **Settings > Pages**, selecione **Deploy from a branch**, **main**, pasta **/(root)**. A página inicial é `index.html`. Caso a configuração de Pages use Actions, o mesmo conteúdo estático deve ser implantado como artefato.

Para desenvolvimento local, utilize um servidor HTTP (ex.: `python -m http.server 8000` na raiz do projeto) e abra `http://localhost:8000/`.

## Estrutura de arquivos

- `index.html` — interface, HUD e scripts carregados em sequência
- `css/styles.css` — estilos do jogo
- `js/data/vfs-manifest.js` — catálogo virtual apresentado na interface original
- `js/data/city-presets.js` — configurações de Chicago, Havana, Las Vegas e Rio
- `js/audio/retro-synth-audio.js` — áudio sintetizado
- `js/render/ps1-texture-factory.js` — texturas procedurais
- `js/render/effects-manager.js` — partículas e efeitos visuais
- `js/entities/tanner-controller.js` — controle do personagem
- `js/entities/pedestrians-roadblocks.js` — pedestres e bloqueios
- `js/vehicles/driver-vehicle.js` — veículos e física
- `js/world/city-builder.js` — construção das cidades
- `js/engine/driver2-game-engine.js` — lógica do jogo e inicialização
- `driver_2_three_js_open_world_clone.html` — redirecionamento de compatibilidade para links antigos

## Notas técnicas

Os scripts do jogo são **scripts JavaScript clássicos**, não módulos ES, carregados na ordem definida no final do HTML. Isso preserva as dependências e os identificadores compartilhados da versão de arquivo único sem mudar as regras do jogo.

Todos os arquivos internos usam caminhos relativos `./`, compatíveis com a subpasta `/Driver-2-Three-js/` do GitHub Pages. As bibliotecas externas (Tailwind, Three.js, GLTFLoader e fontes) ainda precisam de conexão à internet. O catálogo `VFS_MODULES` apresentado dentro do jogo é apenas um recurso da interface original e não representa automaticamente os arquivos reais do repositório.

O arquivo HTML antigo redireciona para `index.html`. A refatoração preserva a lógica JavaScript original; melhorias futuras podem ser implementadas por subsistema.

## Melhorias inspiradas no Driver 2

- Direção esquerda/direita corrigida para o referencial do mundo, volante com suavização e esterço reduzido em velocidades altas.
- Colisões entre carros usam velocidade de aproximação real, inclusive nas batidas frontais, com intervalo anti-dano repetitivo.
- Veículos 3D da **Kenney Car Kit** (CC0), baixados sob demanda do CDN jsDelivr. O modelo procedural original permanece disponível, como fallback automático ou manual pelo botão **3D CC0 / PS1** ou tecla **M**.
- Ônibus e limusine continuam com os modelos originais, já que o pack selecionado não possui substitutos equivalentes.
- A funcionalidade de importação manual de GLB é preservada e tem prioridade sobre o pack automático.

Veja [ASSETS-CREDITS.md](ASSETS-CREDITS.md) para fonte, versão e licença de cada família de recursos. Sem internet, o jogo continua funcionando com malhas procedurais se o navegador já tiver carregado Three.js/Tailwind. O próprio Three.js ainda depende de CDN.
