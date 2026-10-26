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

## Atualização — trânsito, cenários e celular
- IA por cruzamentos em `js/traffic/traffic-ai.js`: faixas, conversões, limite de velocidade, freada por obstáculos e perseguição policial sem atravessar prédios.
- Semáforos animados com ciclos de 24 segundos, respeitados pelos carros civis.
- O carro secreto fica estacionado; as viaturas e o tráfego civil partem de vias válidas.
- Placas 3D CC0 opcionais da Kenney e fallback para renderização procedural.
- Controles móveis com Pointer Events, cancelamento e liberação após perda de foco.
- `js/engine/gpu-resources.js`: descarte dos recursos gráficos de veículos e pedestres recriados, preservando os GLBs compartilhados em cache.

## Revisão de bairros e bloqueios (outubro/2026)

- `js/world/urban-districts.js`: alturas estáveis por cidade, variação de placas/fachadas/terraços e três lotes instanciados para os edifícios.
- Quatro paletas arquitetônicas distintas para Chicago, Havana, Las Vegas e Rio; o mapa de ruas existente foi preservado.
- Reutilização de texturas por paleta ao reconstruir as cidades, evitando a geração de uma textura nova para cada prédio.
- `js/police/roadblock-director.js`: durante perseguições com delito alto, barreiras são posicionadas adiante na malha de vias, com cooldown, distância mínima e remoção quando o perigo acaba.
- `js/entities/pedestrians-roadblocks.js`: barricadas dinâmicas têm metadados próprios e são removidas sem afetar o modo Fura-Bloqueios.
- Testes locais: `node --test tests/evolution.test.cjs`. O workflow `qa.yml` executa os mesmos testes nas alterações do repositório.

Observação: os testes de lógica não substituem uma sessão real de navegador para confirmar a aparência de materiais, partículas e performance em aparelhos diferentes.

## Revisão de física, câmera e checkpoints

- `js/physics/arcade-dynamics.js`: direção e transferência de peso recalibradas, resistência progressiva, freio/ré e colisões com impulso proporcional à massa de sedãs, ônibus, caminhões e limusines.
- `js/vehicles/driver-vehicle.js`: deslizamento junto às paredes quando houver um eixo livre; dano de parede com cooldown para evitar contagem a cada frame.
- `js/render/driver-camera-rig.js`: câmera de perseguição amortecida, campo de visão ajustado à velocidade, vista pelo capô e checagem simples de obstáculos atrás do veículo.
- `js/gameplay/checkpoint-route.js`: missões **Rota de Fuga**, **Trailblazer** e **GP Secreto** exigem passar pelos portões em sequência; apenas o próximo aparece no cenário e radar.
- `tests/driving-camera.test.cjs`: 12 testes de regressão, executados junto à suíte anterior por GitHub Actions.

**Compatibilidade:** GitHub Pages estático, scripts clássicos e assets CC0 opcionais mantidos. A verificação automática testa lógica; a qualidade visual e a física final ainda requerem partidas manuais reais em desktop/celular.
