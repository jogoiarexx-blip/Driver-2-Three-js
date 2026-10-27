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

## Revisão: Veículos e Missão 7 — 2026-10-26

- `js/render/vehicle-visuals.js`: faróis e lanternas de freio funcionais sem luzes dinâmicas pesadas; carroceria e rodas com microanimações de suspensão.
- `js/vehicles/driver-vehicle.js`: grupo de iluminação persistente ao substituir carro procedural por GLB Kenney ou GLB manual. A importação de um segundo GLB personalizado também funciona sem ser sobrescrita pelo carregamento automático.
- Controle **L / 💡 ON-OFF** para ligar e desligar os faróis (também utilizável no celular).
- Clima noturno/chuvoso acende automaticamente os faróis dos veículos recém-criados e presentes.
- `js/traffic/traffic-ai.js`: velocidade recalculada de acordo com a intensidade da curva, desaceleração na aproximação de cruzamentos e três veículos civis adicionais.
- **Missão 7 — Dossiês do Cartel**: reúna três provas na sequência, despiste a polícia até delito abaixo de 25 e entre **a pé** no esconderijo antes do tempo terminar.
- `tests/vehicle-and-mission.test.cjs`: 10 testes automatizados de iluminação, suspensão, curvas e sequência de missão, adicionados à suíte GitHub Actions.

Os arquivos JavaScript são scripts clássicos e continuam compatíveis com GitHub Pages sem bundler. Assets Kenney continuam opcionais, com fallback procedural.

## Atualização: danos visuais, perseguição em formação e ruas — REV atual

- `js/render/vehicle-damage-fx.js`: marcas de colisão em quatro níveis (20%, 38%, 64%, 85%) com arranhões, chapas amassadas, vidro trincado e capô desencaixado. O mesmo conjunto decorativo permanece sobre o GLB ao trocar de modelo.
- `js/police/pursuit-tactics.js`: quatro viaturas podem exercer os papéis de perseguidor, flanqueador direito, flanqueador esquerdo e interceptador mais à frente. Caso o ponto de interceptação atravesse edifícios, a IA continua usando ruas e alvos seguros.
- `js/world/street-furniture.js`: 500 faixas curtas de travessia, 50 postes e 50 luminárias em **3 lotes instanciados**, sem criar luzes WebGL adicionais.
- `tests/damage-police-streets.test.cjs`: 10 verificações reproduzíveis integradas ao GitHub Actions, além das 31 verificações anteriores. Os testes que isolam a IA e os veículos agora carregam suas dependências explicitamente.
- A simulação física, as missões já existentes, as opções PS1/GLB e o deploy estático foram preservados.

**Validação:** GitHub Actions certifica sintaxe/algoritmos, mas não comprova uma partida completa nem substitui testes visuais em navegador desktop e smartphone.

## Revisão — colisões inteligentes e Missão 8 (outubro/2026)

- `js/physics/vehicle-collisions.js`: separação entre carrocerias ponderada pela massa, com verificação das caixas de colisão dos prédios; dano por par com intervalo de 480 ms e prevenção de travamento quando os centros coincidem.
- `js/engine/driver2-game-engine.js`: polícia não aumenta automaticamente o delito do jogador ao bater nele; somente aproximação ativa do jogador contabiliza infração ao atingir uma viatura. A colisão preserva o sistema de lataria danificada.
- `js/gameplay/pursuit-chapter.js`: **Missão 8: Cerco à Meia-Noite**, com três atos (24 segundos de sobrevivência à perseguição, três portões de fuga ordenados e chegada a pé ao esconderijo com delito abaixo de 35%). Uma tomada aérea curta abre a sequência sem interromper os controles.
- `tests/pursuit-and-collisions.test.cjs`: 15 testes reprodutíveis para impactos, limites de edifícios, justiça nas multas, mudanças de fase, ordens de checkpoints e ligações do HTML.

Execute localmente: `node --test tests/*.test.cjs`. Os testes de lógica não substituem partidas completas no navegador nem validam fidelidade ao Driver 2 original.


## Revisão — bloqueios inteligentes, impactos e HUD compacto

- \`js/police/roadblock-director.js\`: valida vagas livres antes de instalar barricadas, não instala bloqueios atrás do carro e oferece distância/estado para o aviso do HUD; desativa barreiras quando Tanner abandona o veículo.
- \`js/entities/pedestrians-roadblocks.js\`: bloqueio dinâmico aguarda 1,25 segundo de montagem com balizas piscantes. Apenas o carro conduzido pelo jogador destrói as barreiras; os policiais não podem furar os próprios bloqueios nem concluir a missão por Tanner.
- Colidir com barricadas agora causa leve dano físico, desaceleração, faíscas e retorno visual.
- \`js/render/impact-feedback.js\`: tremor de câmera e flash temporário após colisões, com intensidade amortecida e respeito a "movimento reduzido".
- \`js/render/effects-manager.js\`: **pool fixo de 22 faíscas** reutilizáveis, sem alocar geometrias a cada batida.
- HUD móvel: objetivos resumidos em duas linhas com botão de expansão; cidades/clima recolhíveis, progresso dos atos e aviso de bloqueio à frente. Os controles para dirigir continuam visíveis.
- \`tests/roadblock-feedback-mobile.test.cjs\`: 15 testes reproduzíveis para bloqueios, simulação de armar/destruir, feedback, pool de faíscas e estrutura da interface.

Os testes Node exercitam lógica e não substituem testes de partida/colisões em um navegador real.

- Carros civis e viaturas agora freiam antes de barricadas intactas; quando as barreiras são destruídas, a perseguição pode continuar. Dois testes adicionais cobrem essa navegação.


## Revisão — agentes nos bloqueios, busca policial e danos fortes

- Duas figuras policiais low-poly passam a sinalizar no acostamento de cada bloqueio dinâmico. Animações de braço e recuo em aproximação, sem criar física ou luzes adicionais. Os atores são destruídos junto com o bloqueio e não aparecem no modo Fura-Bloqueios.
- A IA policial deixa de receber posição exata continuamente atrás dos edifícios. Guarda o último avistamento durante alguns segundos e recebe coordenadas aproximadas por rádio com intervalos. Viaturas retomam a busca pela malha de ruas, preservando a formação das quatro viaturas.
- Dano visual avançado: para-choque amassado a partir de 72%, motor superaquecido com brilho de material a partir de 85%. Fumaça do motor passa a usar probabilidade proporcional ao delta de tempo, preservando comportamento em 30/60 FPS.
- Testes adicionais verificam posicionamento/recuo dos policiais, limpeza de atores, memória policial, expiração de rádio e efeitos de danos críticos. Permanecem preservadas as missões e opções de carro PS1 ou GLB.

O GitHub Actions avalia testes lógicos de Node; a validação visual completa em navegador real continua sendo uma etapa separada.

## Revisão — batidas direcionais e manobras policiais em perseguições

- Danos em quatro zonas independentes (frontal, traseira, esquerda e direita) calculados pela direção do contato no referencial do veículo, acumulados até 100 por zona. Batidas em paredes também são classificadas.
- Nova geometria low-poly de porta e para-choque danificados é ligada apenas na área afetada; os efeitos funcionam igualmente no modelo procedural e no GLB porque permanecem no grupo visual do veículo.
- Manobras de flanqueamento e interceptação estão habilitadas somente para viaturas com visão direta, felony alto, velocidade suficiente e trajetória sem prédios. Não há teletransporte; a IA escolhe pontos adiante e freia antecipadamente durante um corte de caminho.
- Adicionados 18 testes de regressão para lados do contato, veículos rotacionados, ré, acúmulo de danos, visibilidade e táticas. A validação automatizada não é equivalente a uma partida completa no navegador.
