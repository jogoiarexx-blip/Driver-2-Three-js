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

## Expansão urbana, interiores, casa e salvamento (outubro/2026)

- Grade ampliada de **5×5 para 9×9 quarteirões** (81 posições-base); asfalto, sinalização, trânsito, limites do mapa e canal acompanham a expansão. Geometrias instanciadas continuam em poucos lotes. As dimensões representam uma expansão procedural inspirada nas cidades do Driver 2, **não um mapa idêntico/extraído da versão PS1**.
- Melhorias de ambientação para Chicago (estádio e píer), Havana (capitólio e praça), Las Vegas (hotéis de neon) e Rio (praça e mercado), usando geometria low-poly original.
- A **casa de Tanner** (sudoeste, entrada verde) e um **depósito** (x=200,z=-200, porta azul) permitem entrar a pé usando **E/Enter**, explorar salas 3D e sair pela porta. Na casa, aproxime-se da **mesa verde** e use **F/E** ou botão **SALVAR**.
- Save real em `localStorage`, com versão e validação: cidade, clima, missão, checkpoints, estado do carro/danos, Tanner, garagem secreta e histórico de missões concluídas. O botão **CARREGAR** fica no menu de missões. O save fica neste navegador/origem e pode se perder caso os dados do navegador sejam apagados.
- Modo história Chicago: **Surveillance Tip Off** (ir ao carro de Jones e entrar nele) e **Chase the Witness** (acompanhar sedã azul em vez de destruí-lo). Os objetivos seguem a estrutura das duas primeiras missões, mas percurso, tempo e posicionamento são adaptações. As restantes missões originais ainda não foram reconstruídas.
- Testes automatizados em `tests/city-home-save.test.cjs` verificam persistência, erro de armazenamento, cidades, zonas caminháveis, interfaces e progressão.

**Limitação:** ainda é necessário validar uma partida visual completa no browser, testar o save entre sessões reais e conferir desempenho em celulares com pouca memória. O navegador deve permitir armazenamento local.

### Navegação no mundo ampliado

- Use **MAPA GERAL** ou tecla **G** para reduzir o zoom do radar e encontrar pontos mais distantes. Dentro de um prédio, o minimapa mostra um esquema do cômodo, com mesa e saída.
- A polícia reconhece os limites da nova área urbana ao calcular interceptações.
- Estilos e nomes de locais clássicos servem de referência, mas o traçado das ruas e a sequência da história ainda não são reproduções 1:1 do PS1.

## Chicago 03 — Train Pursuit (trem elevado e estação)

- Nova missão de história, com 120 s de limite, baseada em **Train Pursuit**, a terceira missão de Driver 2. Siga o trem e não fique mais de 132 metros distante por mais de 6 segundos. Na estação, saia do carro e suba pela **rampa cinza à esquerda dos trilhos**; a chegada só conta quando Tanner alcança a plataforma elevada a pé.
- Trem low-poly original de três carros, janelas, rodas e faróis. Linha elevada atravessa Chicago, incluindo a região do canal; utiliza instancing para dormentes e pilares. A estação tem rampa caminhável a 11,3 metros de altitude, e recebe indicação no radar.
- O estado do trem (posição, chegada, tempo e perda de contato) faz parte do save doméstico em localStorage.
- O percurso é **uma adaptação retificada do traçado original do PS1**, ainda sem o circuito com bifurcações real. A missão ainda não é um port fiel 1:1 de Driver 2; os modelos são criações leves compatíveis com Three.js r128.
- Execute testes: `node --test tests/*.test.cjs`. Um teste automatizado da física do trem e da rampa não substitui uma partida manual e inspeção do WebGL no browser.

## Chicago 04 — Tailing the Drop (outubro/2026)

- A quarta missão clássica agora está no menu Chicago: seguir discretamente o sedã vermelho do brasileiro até o depósito, **sem bater no alvo**. Seu objetivo é manter a distância na **barra de proximidade** (zona verde), evitando aproximação excessiva e perda do alvo.
- Suspeita cresce quando Tanner fica a menos de 18 unidades e se reduz quando volta à faixa segura; distância superior a 100 unidades eleva o risco de perder o contato. Distâncias, tempo e percurso são ajustes de jogabilidade, não os valores exatos do PS1.
- O suspeito usa **sete trechos pré-definidos**, velocidade e curvas físicas e respeita os semáforos. Não recebe a posição do jogador como destino. A chegada ao depósito conclui a missão se a vigilância permaneceu discreta. O radar existente indica o alvo vermelho.
- A cidade de Chicago ganhou **lanchonete retrô** (-200,-200) e **oficina** (120,-280) com portas verdes acessíveis a pé, cômodos decorados, mobília low-poly e saída para a rua. A casa e seu salvamento permanecem independentes.
- Save doméstico guarda também checkpoint do sedã, suspeita, distância perdida e tempo de seguimento. Coordenadas de salas ampliadas são suportadas.
- `tests/tailing-drop.test.cjs` prova a lógica furtiva, persistência, semáforos e uma simulação completa do sedã pela malha da cidade sem colisões de edifícios.
- **Ainda não é uma reconstrução exata** da missão PS1: o trajeto e os valores de tolerância foram adaptados à malha procedural. Os testes são lógicos/headless, não uma sessão jogada visualmente no navegador.

## Chicago 05 — Escape to the Safe House (revisão outubro de 2026)

- Missão da campanha original: comece cercado pela polícia (delito 92%), perca contato visual e dirija até o marcador da casa segura no sudoeste. Uma volta à casa a pé também é aceita, mas não é obrigatório coletar checkpoints artificiais. A missão se conclui ao parar o carro dentro do alcance do marcador após despistar a polícia, ou entrar em casa depois da fuga.
- Lógica de fuga: um policial precisa estar dentro de 95 unidades **e ter linha de visão** para manter contato; o delito deve ficar abaixo de 32%, com 5,5 segundos sem observação. O retorno de uma viatura à linha de visão interrompe o progresso. Esses limiares foram adaptados para o mapa procedural, não extraídos do PS1.
- Frota reposicionada no começo para uma perseguição imediata em Chicago. O diretor de bloqueios existente continua ativo; o bairro da casa segura e sua entrada são reutilizados.
- HUD central indica fase, distância até a casa, delito e tempo sem contato. A garagem, interiores, salvamento na mesa verde, mapa geral e anteriores missões permanecem disponíveis.
- O progresso da fase de fuga é guardado no `localStorage` pelo sistema de save da casa. `tests/chicago-safehouse.test.cjs` testa perseguição, visibilidade, vitória/derrota, carregamento, integração e interfaces.

**Diferenças em relação ao Driver 2 do PS1:** geometria urbana, patrulha, perseguição e tempos são recriações próprias, ainda sem garantia de equivalência 1:1. Os testes Node validam regras e estruturas, mas não substituem jogar a missão inteira em navegador real.


## Chicago 06 — Chase the Intruder

A missão segue a sequência da história de Driver 2 (PS1), mas adapta ruas, tempos e
pátio ao nosso mapa 9×9. Tanner começa no beco próximo à casa, entra no esportivo
preto usando E e segue o carro cinza do invasor pelas avenidas. Se ficar a mais
de 150 unidades por seis segundos, perde a perseguição. Chegando ao depósito,
deve parar junto do carro fugitivo; uma van amarela fecha a saída, e a missão
termina após uma breve cena. A rota do carro foi simulada com a física do projeto
sem atravessar edifícios nem cruzar o canal fora da ponte. O pátio ganhou
asfalto próprio, contêineres, grades e iluminação leve.

O estado da perseguição e os seus checkpoints de rota entram no save da casa de
Tanner. Testes: `node --test tests/*.test.cjs`, incluindo
`tests/chicago-intruder.test.cjs`. A rota e a sequência são aproximações próprias;
não há ainda validação completa em navegador/WebGL ou fidelidade de mapa 1:1.

## Chicago 07 — Caine's Compound

- Depois de alcançar o invasor, Tanner começa dentro do depósito e sai pela
porta usando E. Um carro amarelo espera do lado de fora; entre nele para fugir.
- Duas vans inimigas surgem no complexo e tentam perseguir Tanner pelo tráfego
já existente. Evite a colisão e alcance a ponte ao centro do mapa.
- Ao se aproximar da ponte levadiça, uma contagem de **19 segundos** é ativada.
A travessia leva até o arco verde na margem norte. Se o prazo acabar,
a cancela aparece e a travessia passa a bloquear fisicamente o carro.
- O depósito recebeu muros de concreto, grades, contêineres e marcação verde
de saída, sem bloquear a porta de entrada ou o carro estacionado.
- Save doméstico inclui fase, vans, ponte e tempo restante. Alterar missões
reinicia os obstáculos exclusivos desta campanha.
- A geometria e a rota são adaptações originais de Chicago, **não uma extração
do mapa do PS1**. Testes em `tests/chicago-caine.test.cjs` verificam fases,
contagem, travessia e colisões. Uma partida manual completa no navegador ainda
deve ser validada.


## Chicago 08 — Leaving Chicago (encerramento do capítulo)

- Missão baseada no objetivo original **Get to the train**, duração de **3:30**,
com chuva noturna e carros da máfia brasileira atacando Tanner durante a viagem.
O jogador sai de Wicker Park (ponto -240,160) e segue até a estação Randolph
(próxima a x=0,z=-240), onde encontra Jones e encerra o capítulo.
- IA de máfia persegue sem sirene e não depende de nível de delito. São três
carros específicos, criados apenas nessa missão. Um ator low-poly representa
Tobias Jones na calçada e um marcador verde sinaliza o local do encontro.
- É preciso chegar dirigindo e **parar** no marcador da estação para concluir.
Ao vencer, o botão **SEGUIR PARA HAVANA** troca para a cidade de Havana em
passeio livre. A missão Havana 09 ainda será construída.
- Progressão, estado do encontro e capítulo concluído são reconhecidos pelo
save da casa. O save continua no mesmo navegador/origem e requer interação
com a mesa verde; não é feito automaticamente.
- Testes específicos em `tests/chicago-leaving.test.cjs` cobrem cronômetro,
reunião, derrota, progressão para Havana, trânsito da máfia e uma simulação
do trajeto com física e colisões até a estação.

**Limites:** mapa e percurso são originais/adaptados e não cópia do traçado
PS1. A IA e a física são testadas de forma automatizada, mas a partida completa
em WebGL e o desempenho em aparelhos móveis exigem validação no navegador.

## Checkpoint de capítulo e dirigibilidade com chuva (outubro/2026)

- A vitória real de **Leaving Chicago** grava um checkpoint de desbloqueio
  independente do save manual da casa. Ao recarregar a página, **CONTINUAR
  CAPÍTULO 2 • HAVANA** aparece no menu de missões. Não é preciso voltar à
  casa em Chicago depois de vencer a etapa 08.
- Saves manuais antigos que já possuíam `story_leaving` concluída podem
  recuperar automaticamente esse desbloqueio. O conteúdo do save da casa
  não é modificado pelo checkpoint separado.
- Havana abre com a introdução ao capítulo 2 em passeio livre. A missão
  **Follow Up the Lead (09)** permanece pendente de implementação, de modo
  que não se confunda a mudança de cenário com uma missão jogável.
- Na chuva, os veículos têm menor aderência lateral e demoram mais para
  estabilizar derrapagens. Física seca permanece inalterada.
- O novo arquivo `js/gameplay/chapter-progress.js` e os testes
  `tests/chicago-chapters.test.cjs` mantêm o sistema modular e compatível
  com GitHub Pages; sem dependências adicionais.


## Menu principal e carregamento real de cidades (REV menu/loading — outubro/2026)

- O jogo abre no **menu principal** sem iniciar a simulação WebGL. Modos:
  **Undercover**, **Take a Ride**, **Load Game**, **Driving Games** e **Options**.
  Take a Ride permite selecionar Chicago, Havana, Las Vegas ou Rio.
  Esc ou o botão **MENU** abre o menu durante a partida e pausa a simulação.
- O novo loader mostra **progresso das operações executadas**, não uma barra
  com tempo aleatório: inicialização da cena, construção em 12 fases da cidade
  (infraestrutura + canal + nove fileiras de quarteirões + interiores),
  preparação da frota, carregamento opcional real de GLB com `GLTFLoader` e
  `renderer.compile`/render para pré-aquecer os materiais/shaders.
- O mapa é criado em etapas com `requestAnimationFrame` entre fileiras.
  Isso permite atualizar a barra e reduz períodos longos de interface sem
  resposta. As telas de cidade continuam procedurais, sem baixar 4 mapas do
  PlayStation e sem criar cópias simultâneas das quatro cidades na memória.
- Os assets externos Kenney CC0 não são obrigatórios. Cada modelo recebe até
  **4,5 segundos** nesta etapa: caso não carregue, fica a malha low-poly
  procedural existente e a tela informa o fallback. O cache dos modelos
  continua podendo completar o download posteriormente.
- A transição Chicago → Havana e os botões de mudança de cidade no HUD usam
  o loader progressivo. O carregamento da partida também pode reconstruir a
  cidade salva sem bloquear a interface por uma operação única.
- Opções do menu: modelos 3D CC0, efeito visual PS1 e redução das animações
  da interface. Preferências ficam no armazenamento local, separadas do save.
- Novos módulos: `js/ui/driver-load-scheduler.js` e
  `js/ui/driver-boot-flow.js`. Testes: `tests/menu-loading.test.cjs`.
  Sem bundler; compatível com hospedagem estática GitHub Pages.

**Limitações:** o loader não mostra percentuais de bytes para downloads de GLB:
sua etapa conta arquivos realmente resolvidos pelo carregador (ou que
esgotaram o prazo e receberam fallback), e a geração procedural é medida por
lotes concluídos. Não prepara antecipadamente **as quatro cidades completas**,
pois isso repetiria consumo de CPU e GPU sem necessidade; constrói a cidade
selecionada e reutiliza o cache de modelos compartilháveis. Falta validar
visualmente o menu/tempo de carregamento nos diferentes navegadores.


## Streaming de detalhe por bairros e LOD (outubro/2026)

- Chicago, Havana, Las Vegas e Rio passam a dividir os edifícios residenciais
  em **células de 160 × 160 unidades**. A versão distante conserva a silhueta,
  em lotes `THREE.InstancedMesh` com cores sólidas por fachada.
- Ao se aproximar, o jogo cria *sob demanda* os prédios texturizados (agrupados
  por paleta) e as três camadas de detalhes de arquitetura. Os detalhes são
  mantidos em cache no bairro durante a partida e apenas alternam visibilidade
  depois disso, eliminando reconstruções repetidas.
- A mudança entre versões leve e detalhada tem **histerese**, com limites
  independentes para entrar/sair, e orçamento padrão de **2 bairros por ciclo
  de atualização** (aproximadamente a cada 140 ms). Isso reduz os estouros
  de trabalho por quadro e evita oscilações visuais nas transições.
- Calçadas agora são um único lote instanciado, em vez de várias malhas
  individuais. Os prédios próximos também são instanciados por material.
- **Colisão e missões não mudam**: caixas de bloqueio ficam no construtor da
  cidade, não nos componentes gráficos LOD. Estruturas especiais (ponte,
  estação de Chicago, interiores/casa, garagem, depósitos e monumentos)
  continuam visíveis e operantes.
- O carregamento inicial prepara os bairros próximos **antes** da compilação
  dos shaders e da primeira imagem jogável. Um indicador de bairros
  carregados aparece na aba de arquitetura/assets, sem acrescentar ruído ao HUD.
- Novo módulo isolado `js/world/district-lod.js`. Verificações de
  carregamento, orçamento por frame, histerese, falha de GPU e geometria
  instanciada em `tests/district-streaming.test.cjs`.

**Limites e próximos passos:** esta revisão faz streaming de *detalhe de
renderização*, não download incremental de quatro mapas nem descarte total dos
dados de um bairro visitado. As colisões e metadados são construídos uma vez
por cidade para assegurar jogabilidade consistente. Texturas reutilizadas
continuam em cache até trocar de cidade. O ganho efetivo de FPS/draw calls
precisa de medição em navegador/placa de vídeo real; as provas automatizadas
validam a lógica de LOD, não um benchmark WebGL completo.


## Havana 09 — Follow Up the Lead (campanha do capítulo 2)

- A opção **SEGUIR PARA HAVANA** após Chicago 08 abre o *loading real*
  de Havana e inicia a primeira missão jogável do capítulo 2.
  O botão **HAVANA 09 — FOLLOW UP THE LEAD** também aparece na Central de
  Modos após a liberação da campanha. O passeio livre nas quatro cidades
  continua independente da progressão narrativa.
- Um intermediário dirige um **sedã verde** pelas ruas de Havana
  num percurso próprio, ligando avenidas, canal/ponte e a região dos cais.
  O carro é controlado pela física/IA já existente, usando uma rota
  `scriptedDrive` de 12 pontos. Não é uma extração dos dados do jogo PS1.
- **Objetivo:** segui-lo discretamente entre 16 e 125 metros e confirmar
  o ponto de encontro. O jogador falha se perder contato por tempo
  prolongado, permanecer perto demais, destruir o veículo suspeito ou
  esgotar o cronômetro. Choques contra o alvo aumentam o alerta.
- O HUD mostra a distância, o alerta do suspeito, a margem para perda de
  contato e o avanço da rota. O radar destaca o alvo em amarelo e o
  destino em verde, sem interferir nas missões anteriores.
- A vitória em Havana 09 grava um checkpoint de capítulo separado
  (`driver2-three-chapter-v1`, compatível com registros anteriores).
  O save manual da casa também aceita `story_havana_lead`, incluindo
  índice do percurso e contadores do diretor. Saves anteriores continuam
  válidos e não são sobrescritos pela conquista.
- Arquivos principais: `js/gameplay/havana-lead.js`,
  `js/engine/driver2-game-engine.js`,
  `js/gameplay/chapter-progress.js`, `js/gameplay/home-save.js`,
  `index.html`. Testes de regressão: `tests/havana-lead.test.cjs`.

**Limites:** cenário e missão são uma adaptação do projeto e não
reproduzem o mapa/cinemáticas/dados do Driver 2 original. Testes lógicos
verificam timers, estados, persistência e progressão de rota; teste
visual e jogabilidade prolongada em navegador real permanecem pendentes.
