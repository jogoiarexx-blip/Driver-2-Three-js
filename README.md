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


## Direção, pintura GLB e colisões — atualização outubro/2026

- **A e D do jogador invertidos em relação ao comportamento anterior**
  conforme solicitado, sem trocar os sinais usados internamente pela IA de
  tráfego: os veículos automáticos continuam seguindo suas rotas normalmente.
- **Curvas rápidas:** um `fastCorner` na física ativa a derrapagem e o áudio
  de pneu mesmo sem acionar SHIFT. Fumaça com malha arredondada, marcas no
  asfalto e emissões reguladas para não depender de 30/60 FPS. As partículas
  liberam o material GPU ao desaparecer.
- **Mais destruição no cenário:** caixas de madeira nos cantos de alguns
  quarteirões, fragmentos lançados com impulso, tempo de vida limitado,
  redução moderada de velocidade e dano no carro. Também afeta cones e
  latas de lixo atingidos com força suficiente. Detecção contínua aproximada
  de colisão usando segmento entre posição anterior/atual para evitar que um
  veículo rápido atravesse o objeto em um único quadro.
- **Carro fornecido pelo usuário:** loader específico para
  `assets/vehicles/carro_driver2_otimizado.glb` com correção de orientação
  X→Z, escala proporcional ao chassi, carros com pintura variável, shader
  aplicado ao atlas verde-oliva com tentativa de preservar pneus, vidros e
  lanternas. Utiliza a mesma geometria/textura e clona somente materiais.
  O carro é usado prioritariamente nos veículos comuns estilo *muscle*
  (incluindo o jogador), sem substituir polícia, veículos pesados e alvos.
- O menu e HUD possuem botão **Importar meu carro GLB** e seletor de
  **cor da carroceria de Tanner**. Arquivos escolhidos são importados por
  `GLTFLoader.parse` e guardados em IndexedDB quando disponível; o
  armazenamento do navegador pode não persistir em navegação privada.
  Modelo inválido ou indisponível mantém a carroceria alternativa.
- O GLB binário original acompanha um pacote ZIP separado para colocação
  no caminho esperado do projeto. **O commit de código por si só não contém
  o arquivo GLB:** a API de escrita GitHub disponível no ambiente não recebe
  diretamente o arquivo binário do upload local. Para distribuição automática
  a qualquer visitante do GitHub Pages, faça commit de
  `assets/vehicles/carro_driver2_otimizado.glb` no repositório. Na ausência
  desse arquivo, o botão de importação local já permite usar o modelo na sua
  sessão e salva uma cópia no navegador (quando permitido).
- Testes: `tests/driver-custom-car-and-destruction.test.cjs`. A suíte Node
  testa sinais de direção, fumaça, colisões varridas e integração de arquivos.
  Não substitui validação visual no browser.


## Postes, cercas e deformação direcional (revisão subsequente)

- Postes de iluminação continuam agrupados em `InstancedMesh` para baixo
  custo gráfico, mas cada posição possui um registro de colisão independente.
  Em impacto suficientemente rápido o poste e a luminária daquela posição
  são ocultados por matriz da instância, sem esconder postes vizinhos.
  Uma geometria quebrada cai com fragmentos temporários.
- Cerca metálica curta junto a algumas calçadas, com rails/postes próprios.
  Pode quebrar ao bater; caixas e cones continuam destrutíveis.
- Detecção por segmento `(prevX, prevZ) -> (x, z)` aplicada também a
  postes/cercas, diminuindo atravessamentos em alta velocidade. O impacto
  reduz a velocidade, causa pequeno dano e registra o lado atingido.
  Objetos leves não se tornam paredes invisíveis permanentes.
- Partículas de fragmentos têm limite global por cidade (140) e tempo de
  vida. Ao trocar de cidade as instâncias, colisões e detritos são
  reinicializados pela rotina já existente. Não há peças caídas permanentes.
- A estrutura existente `VehicleDamageFX` reage agora **progressivamente**
  ao dano de frente, traseira, esquerda e direita: para-choques se deslocam/
  inclinam, painéis laterais se abrem e capô/porta-malas ficam desalinhados.
  As deformações gráficas não alteram o tamanho do collider, inclusive em
  modelos GLB. Danos salvos continuam usando `damageZones`.
- Efeitos de impacto (faíscas, áudio e tremor) são ligados ao carro
  controlado; colisões de NPCs ainda derrubam elementos do cenário, mas não
  penalizam o jogador por engano.
- Testes de regressão em `tests/street-destruction-damage.test.cjs`:
  instanciamento, ocultação individual, batidas rápidas/lentas, orçamento de
  detritos, danos por região e compatibilidade com a física existente.

**Não incluso:** destruição estrutural de prédios, deformação de vértices
internos do GLB ou persistência de cada poste quebrado ao sair da cidade.
A verificação de FPS/jogabilidade em navegador continua necessária.


## Colisões contínuas e peças soltas — próxima revisão

- **Carro × carro a alta velocidade:** o resolvedor agora calcula o
  primeiro contato entre os deslocamentos anteriores e atuais usando a
  posição relativa dos dois veículos (swept-circle). Isso impede alguns
  atravessamentos quando os centros se cruzam entre quadros. O sistema
  preserva a separação por massa, danos por região e cooldown anteriores.
- **Proteções:** sem colisões retroativas em teletransportes (mudanças de
  fase/cidade), trajetórias paralelas afastadas, carros em alturas diferentes
  ou recuo para dentro das paredes. Se faltam posições anteriores, continua
  usando o método discreto tradicional.
- **Peças soltas:** impactos suficientemente fortes fazem para-choques
  (dianteiro/traseiro) e painéis laterais desprenderem. Cada parte é ejetada
  uma única vez por região e carro; recebe velocidade, gravidade e quique.
  Até 40 fragmentos simultâneos, com material descartado ao expirar.
- **Carros procedurais:** o para-choque original é ocultado e sua peça
  destacada é criada no mundo. **GLB personalizado:** usa fragmentos
  simplificados com pintura semelhante; não remove malhas reais internas nem
  reescreve o atlas/texturas da carroceria importada. Marcadores de dano
  local continuam acompanhando o chassi sem alterar o collider.
- **Missões/salvamento:** saves antigos mantêm compatibilidade. Os novos
  campos `breakawayFlags` persistem quais regiões já perderam peças.
  Não há repetição infinita de detritos após carregar um save.
- **Integração:** paredes geram as peças no veículo; colisões entre carros
  propagam o impacto aos dois envolvidos, enquanto o som/HUD de Tanner
  continuam exclusivos do jogador.
- **Testes:** `tests/high-speed-breakaways.test.cjs` verifica
  atravessamentos, colisões legítimas, parede, teleporte, cooldown,
  peça única por região, limite de memória e salvamento.

Limitações: física simplificada por círculos, não há caixas orientadas
de colisão nem deformação de vértices de um GLB externo. Os testes de Node
não substituem validar carros atravessando cruzamentos no navegador.


## REV URBANA — auditoria de jogabilidade e persistência (27/10/2026)

### Correções implementadas
- **Curb alignment**: postes de iluminação, semáforos e sinalizações
  instalados a 16 unidades do eixo da rua (largura 12 + recuo 4).
  O canal tem tratamento próprio para não deixar postes na água. A
  especificação de eixos da cidade ficou isolada em
  `js/world/road-geometry.js`, incluindo validador de saídas de garagem.
- **Canal**: os muros visuais e seus colisores foram divididos em
  segmentos coincidentes. Aberturas reais nas coordenadas X
  `[-255,-225]` e `[225,255]` permitem queda no canal.
  Fora da ponte central, a água passa a ter profundidade lógica `-4`,
  sem barreiras invisíveis dentro do canal.
- **Rampa ferroviária de Chicago**: a função de altura suaviza a
  borda lateral e a física impede entrar por degraus impossíveis;
  transições subíveis seguem o contato com o solo sem gerar impulso
  `vy = diferença_de_altura × 18`. Gravidade, queda, aterrissagens e
  saltos em situações legítimas continuam previstos na física.
- **Água/recuperação**: veículos sem proteção na margem podem afundar,
  gerar respingos e retornar a uma posição seca anterior após a
  submersão. Não é um sistema completo de flutuação de carro/barco.
- **Casa e garagem**: estacionamento verde na casa de Tanner,
  armazenamento local independente e versionado de até 5 veículos,
  seletor de retirada, pintura e identidade mantidas. Saída ocupada
  bloqueia a retirada. Use `P` parado na vaga para guardar, `O` para
  abrir a lista, `T` para indicar a casa. A garagem completa está
  disponível em Chicago, e as outras cidades preservam passeio livre.
- **Navegação/missões**: ícones `⌂`, `P` e `!` no radar/mapa
  ampliado; marcadores 3D em calçadas para início de Chicago 01 e
  Havana 09, com `J` para ativar ao se aproximar. O status indica
  disponível/ativo/concluído conforme o progresso existente.
- **Persistência da campanha**: a garagem usa a chave separada
  `driver2-tanner-garage-v1`, sem regravar o save antigo da casa.

### Limitações e pendências
- O GLB **carro_driver2_otimizado.glb** foi analisado e validado como GLB
  2.0 (uma malha e uma textura JPEG). Seu caminho de carregamento é
  `assets/vehicles/carro_driver2_otimizado.glb`, com importação local
  e correção de rotação já existentes. O binário não faz parte do
  repositório GitHub: para que ele carregue automaticamente para
  *todos os visitantes*, é obrigatório colocar o arquivo nesta pasta
  e fazer commit pelo GitHub. Alternativamente, use o botão Importar
  GLB dentro do jogo, com armazenamento local IndexedDB quando disponível.
- A garagem registra preferência por GLB, mas se o arquivo não estiver
  disponível ela mantém o carro alternativo; não salva malhas de
  terceiros no `localStorage`.
- Nenhuma cidade é uma reprodução geométrica 1:1 do mapa PS1. A
  arquitetura e pontos de referência procedurais continuam em evolução.
- Marcadores completos e transições automáticas das missões além de
  Chicago 01 / Havana 09 ainda precisam de implementação adicional.
- Testes de Node usam réplicas matemáticas/objetos Three.js simulados;
  NÃO equivalem a dirigir 30 minutos em navegador real.

### Entrega ZIP
- O GitHub oferece o **Source code (ZIP)** diretamente do branch
  `main`. O workflow `deliverable-package.yml` também publica o
  pacote da fonte como artefato para cada revisão.
- Para ter o modelo GLB no ZIP final, inclua
  `assets/vehicles/carro_driver2_otimizado.glb` antes de empacotar.
  Sem esse binário, o importador local continua sendo a opção.


## Revisão GLB publicado — carregamento robusto (27/10/2026)

O arquivo `assets/vehicles/carro_driver2_otimizado.glb` **agora faz
parte do repositório**, adicionado pelo usuário no commit `1744a9f`
(1.592.952 bytes; SHA-256
`b692342cd53f519fe39c48c24e62f9f9ef6d9aa65e2be02884aaa50a9e80ae4f`).

### O que mudou

- O carregador prioriza **o GLB publicado no GitHub Pages** em vez de
  antigas versões do carro importadas para IndexedDB. Caso o site não
  consiga baixar o arquivo, tenta o modelo armazenado localmente.
- Uma nova importação manual ainda tem prioridade imediata na sessão,
  aplicando o novo arquivo aos veículos já personalizados sem criar
  sobreposição de dois modelos.
- Erros de download não deixam uma `Promise(null)` permanente: um
  carregamento posterior pode recuperar o GLB.
- O boot espera até 6,5 s pelo GLB principal, aplicando modelo e
  pintura **antes** de preparar shaders. Modelos CC0 auxiliares ainda
  possuem fallback sem impedir a partida.
- O substituidor retorna sucesso/falha de maneira explícita e somente
  marca o veículo como customizado quando o modelo foi aceito.
- Marcadores das missões Chicago 01 e Havana 09 deslocados para as
  calçadas em `(-64,-144)` e `(16,-224)`, fora das faixas de direção.
- Novos testes automáticos verificam o GLB **real do repositório**
  (bytes, glTF 2, textura, dimensões e SHA-256), prioridade de fonte,
  orientação do carro, reimportação, fallback offline e retry.

### Ainda não certificado

Os testes em Node e o deploy do Pages não equivalem a completar uma
missão dirigindo no navegador. A malha GLB precisa de inspeção visual
de alinhamento das rodas, textura e FPS em uma sessão longa.
A versão nova não altera a campanha, os saves de Tanner ou o
conjunto de colisores de prédios. O modelo em si é compartilhado;
sua pintura é individual por veículo.


## REV colisores orientados + diagnóstico das rodas GLB (27/10/2026)

Esta revisão preserva `FORWARD=+Z` da física (não inverte
acelerador, marcha à ré, volante, câmera nem faróis) e a rotação
visual do GLB de `+Math.PI/2` aprovada na revisão `fd99645`.

### Problemas concretos corrigidos
- O detector anterior representava cada veículo como **um círculo**.
  Ônibus, caminhões e limusines usavam o mesmo raio 4,5m, o que
  provocava colisões invisíveis entre veículos paralelos e não
  representava a extensão longitudinal.
- O novo `DriverVehicleCollisions.orientedContact()` compara quatro
  eixos de caixas OBB em 2D (SAT) e usa largura/comprimento por
  categoria: muscle 2,45×5,15m, caminhão 2,65×6,8m,
  ônibus 2,72×8m, limusine 2,48×7,47m. A separação considera
  massa e usa a normal de aproximação para atribuir dano por lado.
- A detecção de alta velocidade usa agora `sweptOrientedContact()`,
  SAT temporal contínuo no intervalo entre frames, preservando
  proteção contra teleporte, interseção entre andares e barreiras
  próximas. O método legado de raio continua presente para clientes
  antigos, sem governar o contato real.
- O GLB atual contém **um único nó/uma única malha**
  `Carro_Driver2_Carroceria_E_Detalhes`, portanto suas quatro rodas
  não podem ser esterçadas independentemente **sem separar a malha**.
  O novo `DriverVehicleWheelRig` reconhece rodas por nome em GLBs
  futuros que as exponham em quatro malhas e usa pivôs reais
  (giro e esterçamento). Para o GLB atual **não desenha rodas extras**:
  registra quatro pontos de contato como referência para diagnósticos.
- O rig aceita calibração de posições `wheelRig.anchors` em
  `new DriverVehicle(scene,{...,wheelRig:{anchors:[...]}})`.
- Tecla **I** durante o jogo alterna diagnóstico de colisão:
  contorno amarelo da caixa física, eixo de orientação, seta verde
  (+Z frente) e quatro pontos azulados de rodas. O HUD informa
  se as rodas são independentes ou integradas à malha.
- A garagem e as campanhas seguem com chaves de save e lógica
  anteriores. O modelo GLB e a pintura foram mantidos.

### Verificação e escopo
Novos testes cobrem OBB para sedan/ônibus/caminhão/limusine,
trajetórias cruzadas e paralelas, choque rápido por varredura,
altura das pistas, eixo frontal, validação dos dados do GLB,
ausência de roda duplicada e atualização de pivô em malhas separadas.
Testes Node são validações **lógicas**, não substituem testes
interativos em navegador com mouse/teclado/gamepad.

**Ainda pendente:** separar efetivamente a geometria da roda no GLB
atual; testes jogados nas quatro cidades, rampas, água e garagem;
avanços gerais de IA de pedestres, regiões inéditas e LOD. Não foram
produzidas medições confiáveis de FPS ou draw calls antes/depois.


## REV Rede viária / rampa / garagem de Tanner (27/10/2026)

### Implementado
- `DriverRoadGeometry.segmentDrivable()` amostra o corredor inteiro
  entre pontos a intervalos de até três unidades e rejeita cruzamentos
  por água, muros, edifícios e bloqueios físicos. A IA consulta o
  validador em `getRoute` e em `chooseNext`: **o destino livre já não
  é suficiente para autorizar uma rota através do canal**.
- `DriverRoadGeometry.auditNetwork()` verifica conexões nas avenidas
  principais em grade de 80 unidades. Executada uma vez após a cidade
  ser montada, guarda o resultado em `city.roadAudit`. Na geometria
  lógica atual com ponte central, existem 81 nós acessíveis. A
  auditoria não declara caminhos em ruas secundárias ainda não criadas.
- Carros e Tanner passam a fornecer sua **altura atual** ao consultar a
  plataforma ferroviária: um carro que circula no solo sob a plataforma
  elevada de Chicago deixa de ser lançado instantaneamente para o topo
  (11,3m). A geometria da rampa continua inclinada, com corrimãos
  físicos onde os corrimãos visuais realmente aparecem.
- Casa de Tanner ganha um **abrigo externo dirigível**: teto, paredes
  laterais, parede do fundo e frente aberta, respeitando a vaga já
  existente. Apenas as paredes visíveis têm colisores; saída conferida
  contra veículos e prédios. Guardar carros exige passeio livre e
  estacionamento, para não desativar a frota de uma missão ativa.
  O jogador não assume uma viatura por engano ao estacionar.
- O sistema de save versão 1 e o banco de garagem separado continuam
  compatíveis. O GLB e os controles não foram modificados.

### Escopo e verificação
Novos testes automatizados verificam: malha de 81 cruzamentos,
desconexão caso a ponte fique bloqueada, recusa de ruas inundadas,
IA evitando atravessar canal, colisões de corrimãos, acesso à vaga e
saída desocupada, não-teleporte para a plataforma e preservação dos
módulos de missão. **Ainda exigem teste jogado no navegador** as
transições visuais da rampa, direção por vários minutos e acesso
real ao estacionamento com GLB. O abrigo é uma estrutura externa
dirigível, não um interior completo com portas animadas.


## REV Cidades com fachadas regionais / calçadas vivas — 27/10/2026

Nesta revisão foram preservados os quatro cenários, save e campanha,
complementando `UrbanDistricts` **somente nos LODs próximos**. As
referências urbanas são interpretações low-poly do Driver 2 original,
não reprodução 1:1 de quarteirões reais.

- **Chicago**: pilastras metálicas altas e frisos horizontais de prédios
  downtown, sem alterar a geometria viária nem os marcos Wrigley/Píer.
- **Havana**: sacadas coloniais e guarda-corpos junto às fachadas,
  mantendo paleta quente e edifícios baixos.
- **Las Vegas**: letreiros verticais de neon e marquises baixas na
  arquitetura da Strip, sem adicionar fontes dinâmicas de luz.
- **Rio de Janeiro**: brises e sombreamentos nas fachadas urbanas,
  preservando marcos e vegetação tropical já existentes.

`UrbanDistricts.addRegionalFacades()` emprega **duas novas malhas
instanciadas por setor próximo** (além das três já existentes). LOD
distante continua exibindo as silhuetas anteriores e não instancia
fachadas até a aproximação. As cores variam por cidade.

### Pedestres e otimização

- Novo `js/entities/pedestrian-sidewalk-nav.js` com rotas fechadas
  ao redor de quarteirões, selecionando locais livres de vias, água e
  caixas dos prédios. Pedestres deixam de avançar em linha reta
  ignorando cruzamentos.
- Animações simples de braços e pernas na caminhada; quando carro
  rápido se aproxima, agacham/esquivam **na mesma calçada**, sem salto
  físico para o asfalto. Continuam compatíveis com vozes de esquiva.
- 28 personagens reutilizados, com materiais/geometrias compartilhados;
  pedestres além de 235m não são renderizados nem atualizados a cada
  quadro; até três atores distantes são reaproveitados por ciclo ao
  dirigir para outro bairro. Não geramos novos NPCs ao dirigir.
- Bloqueios e policiais existentes conservados. No futuro: faixas de
  travessia seguras com semáforos, entrada em comércios, pedestres
  com desvio completo e hierarquias de animação detalhadas.

### Testes e limites

`tests/city-facades-pedestrians.test.cjs` valida quatro estilos,
instancing por setor, segurança de caminhos, esquiva, curvas, pooling,
ordem de carregamento e preservação de LOD. Ainda é necessária uma
sessão em navegador para inspecionar cenários e pedestres em movimento;
não há medição real de FPS antes/depois ou confirmação de quatro mapas
fielmente reproduzidos. O conteúdo não modifica rotas de missões.


## REV Travessias semaforizadas / orlas regionais (27/10/2026)

### Pedestres (implementado)
- O módulo `DriverPedestrianSidewalks` continua usando o passeio em anéis
  no entorno dos quarteirões, mas agora pode atravessar para um
  **quarteirão vizinho** pelas quatro direções. Usa o mesmo ciclo de
  24 segundos dos semáforos existentes: trânsito Z verde 0–10s,
  trânsito X verde 12–22s. Só inicia a travessia quando os carros do
  eixo correspondente estão no vermelho e ainda há tempo para completar
  os 34 metros entre as duas calçadas.
- Antes de entrar na pista, valida o corredor inteiro contra muros,
  água e construções, exige quarteirão existente e verifica os veículos
  em posições atuais e previstas. Após iniciar, conclui a travessia sem
  parar no meio da rua devido à mudança de sinal.
- Pedestres continuam reutilizando **somente 28 personagens**. A
  animação de caminhada também é usada durante a travessia. A esquiva
  permanece na calçada, e o código não mexe nas rotas de missões.

### Vegetação / litoral (implementado)
- Adicionado `js/world/coastal-visuals.js`: o acabamento de água
  usa uma faixa de espuma estática instanciada com transparência
  animada lentamente, sem novas luzes, colisores ou shaders externos.
  A superfície de água original permanece a `y=0.06`.
- Três malhas instanciadas adicionais compõem a faixa costeira e
  vegetação/defensas, conforme a região: **Chicago**, cais industrial;
  **Havana**, areia e palmeiras; **Las Vegas**, margem desértica e cactos;
  **Rio**, areia clara e palmeiras tropicais. O conjunto usa **quatro
  lotes instanciados** e oito plantas/balizadores por cidade; a ponte e
  as ruas permanecem livres.
- Parques compartilham geometria/material entre seus elementos e
  **Las Vegas usa cactos**, não árvores tropicais. Geometrias são
  descartadas ao trocar de cidade, usando o sistema de limpeza WebGL.

### Limites importantes
- Este é um acabamento procedural leve, **não são praias navegáveis ou
  uma reconstrução geográfica** do litoral das cidades do Driver 2
  original. Pedestres ainda não possuem pathfinding completo ou
  semáforos próprios interativos; os ciclos existentes controlam suas
  travessias.
- Novos testes cobrem fases, veículos em cruzamentos, continuidade da
  passagem, obstáculos, estilos regionais, contagem de instâncias,
  zonas de segurança e carregamento. Testes automatizados não
  certificam a experiência visual ou FPS em navegador.


## REV: Pedestres animados, respeito à faixa e LOD costeiro (27/10/2026)

- **Pedestres:** movimento de pernas e braços com passada adaptativa (corrida ao atravessar, caminhada normal, postura de espera, inclinação de esquiva). A animação não altera a posição física do pedestre nem a lógica de segurança no passeio.
- **Tráfego civil:** compartilha somente os pedestres que **já estão atravessando** com a IA do trânsito; esta freia se um pedestre estiver à frente na faixa. O motorista jogador, os percursos roteirizados e as perseguições não recebem controles automáticos novos.
- **Travessias:** ao aguardar no semáforo, um canto conta uma vez só; a previsão de carros leva em conta posições nos próximos 2,4 segundos e continua recusando obstruções.
- **Vegetação costeira LOD:** duas malhas adicionais de baixa complexidade (caule e copa) para silhuetas distantes, com troca por instância, histerese de 145/220 unidades e atualização a cada ~0,38 segundos. O orçamento de vegetação não cria novas malhas a cada frame, permanecendo em seis lotes instanciados no máximo entre espuma, faixa costeira e vegetação próxima/distante. Para a cena atual há oito plantas/balizadores por cidade.
- **Compatibilidade:** controles, GLB de carro, colisões, saves e missões preservados. O foco de câmera/jogador é passado ao gerenciador costeiro sem mudar a física da água.
- **Testes:** incluídos cenários de freada pela IA, liberação da faixa, variação de passada, contador do semáforo, nível LOD próximo/distante, histerese e ausência de novas malhas durante a atualização. O GitHub Actions executa também os testes de regressão anteriores.

**Limitações:** o LOD não modifica texturas nem a qualidade gráfica dos carros; não há medição de FPS em navegador, nem gameplay completo certificado. A vegetação ainda é procedural e os pedestres não usam modelos com rig complexo.


## REV Viatura personalizada + portas articuladas (27/10/2026)

### Arquivo de veículo
- Coloque a versão preparada do GLB em **`assets/vehicles/police.glb`**.
  A partir desta revisão, o carregador prefere esse arquivo local à
  viatura genérica CC0. Caso o arquivo não esteja publicado, a viatura
  alternativa continua funcionando sem bloquear o jogo.
- O GLB fornecido possuía **1 malha, 47.630 triângulos, 0 animações**.
  O utilitário `rig_police_glb.py` separa **as duas portas dianteiras**
  em malhas próprias com dobradiças: esquerda `police_left_door_hinge`
  e direita `police_right_door_hinge`, preservando os materiais,
  UVs e as imagens originais.
- Alternativamente, `DriverPoliceDoorRig.splitOriginal()` executa uma
  separação por triângulos no navegador quando ainda é usado o GLB
  monolítico original, sem duplicar a carroceria, geometria de rodas
  ou pintura. Os recortes aproximados por triângulos podem ter bordas
  irregulares, especialmente dependendo do modelo de origem.
- O carro policial usa **a mesma adaptação de escala/orientação +90°**
  do carro de Tanner, o sistema de rodagem `DriverVehicleWheelRig`,
  volumes físicos, danos, faróis e sirene já existentes. A pintura
  policial original do atlas é preservada, sem recoloração forçada.

### Entrada e saída (E/Enter)
- Quando Tanner se aproxima de uma viatura equipada com porta
  articulada, a entrada e saída são transições de **1,35 segundos**:
  a porta esquerda abre por 0,38s, permanece aberta por 0,55s e fecha
  por 0,42s; Tanner passa a dirigir somente após o fechamento.
- Repetir E durante a transição é ignorado. Volante/IA da viatura e
  movimentação de Tanner são suspensos durante a animação.
  Reiniciar missão ou trocar cidade cancela a transição sem executar
  efeitos atrasados.
- Outros veículos preservam o comportamento atual e suas animações
  não são modificadas por esta revisão.

### Testes e limites
- `tests/police-glb-door-rig.test.cjs` valida abertura, pausa,
  fechamento e callback único, cancelamento, geometria monolítica,
  fallback seguro e integração dos módulos.
- Os testes automáticos validam código; a **orientação da frente do
  GLB e o acabamento das dobradiças precisam ser conferidos na
  execução visual**. Com material monolítico, o recorte das portas é
  aproximado e não cria interior 3D detalhado nem animação de Tanner
  sentado. Os bancos e interior podem ser evoluídos numa etapa futura.

**Atenção à entrega:** alterações de código podem ser publicadas
separadamente. Até `assets/vehicles/police.glb` existir no GitHub,
o Pages manterá a viatura genérica. Para publicar o modelo,
extraia `Police-GLB-Preparado.zip` na raiz e envie o arquivo
`assets/vehicles/police.glb` ao repositório.


### Atualização — viatura enviada como `car police.glb` (27/10/2026)

A viatura **já foi publicada pelo usuário** no GitHub em
`assets/vehicles/car police.glb` (6.680.428 bytes, blob
`c9bfac99169f2cc695d9efd90310f15801b8ec71`).
É o GLB preparado, com `police_left_door_hinge`,
`police_right_door_hinge` e três malhas separadas.

A partir desta revisão o carregador usa o caminho URL-encoded
`./assets/vehicles/car%20police.glb` em vez do antigo
`./assets/vehicles/police.glb`. O arquivo **não precisa ser reenviado
ou renomeado**. O suporte de entrada/saída com porta, faróis, sirene,
colisões e danos continua integrado. O botão M (PS1/3D) também
cancela e limpa o estado do rig policial antes de reconstruir o
modelo procedural, permitindo recarregá-lo após reativar 3D.

A suíte possui teste de regressão que lê o GLB real e verifica
o cabeçalho, os nós de ambas as dobradiças, as malhas independentes e
a presença de imagens e texturas incorporadas. Ainda é preciso testar
visualmente a abertura das portas dentro do navegador; isso não se
conclui a partir do teste de arquivos.


## REV — Entrar no carro GLB de Tanner + campanha fluida + HUD minimalista (27/10/2026)

### Diagnóstico e correções aplicadas
- **Antes:** `carro_driver2_otimizado.glb` recebia carroceria/pintura,
  mas não gerava dobradiças. A entrada/saída pela tecla E era
  instantânea. **Agora:** o mesmo `DriverPoliceDoorRig` serve ao
  GLB de Tanner e à viatura. A malha única do carro de Tanner é
  separada em dois painéis por índices de triângulos na faixa
  `X=-0,50..0,16`; a textura e vértices originais são
  reaproveitados. Os dois lados possuem pivôs; a porta do
  motorista abre, Tanner se aproxima, entra e a porta fecha.
  A saída repete a transição inversa. Nenhum carro duplicado é
  desenhado. Fallback para entrada instantânea caso não exista
  região de porta detectável. O comando E não interfere em freio,
  volante nem colisões.
- **Antes:** escolher UNDERCOVER no menu já inicializava
  `story_tipoff`. **Agora:** o modo entra no passeio livre de
  Chicago, mostrando o objetivo apenas como aviso transitório.
  As missões passam a ser iniciadas deliberadamente pelo
  marcador verde do mapa (tecla **J**). A ordem de oito missões
  de Chicago fica controlada por `DriverCampaignFlow.next`.
  A seleção por menu de missões ainda funciona.
- **Antes:** toda vitória ou derrota bloqueava a simulação com a
  tela central `JOGAR NOVAMENTE / PASSEIO LIVRE`. **Agora:**
  `triggerEndScreen` registra o resultado, recompensa avanços
  verdadeiros da campanha e retorna ao passeio livre **sem
  recriar a frota ou teleportar Tanner**. O resultado aparece
  como notificação discreta temporária. O marcador disponibiliza
  a próxima missão; derrotas não são registradas como concluídas.
  O desbloqueio persistente de Havana permanece igual.
- **HUD:** durante o jogo, só o botão **☰ MENU** permanece
  na barra superior. Damage/felony, controles de cidade/clima,
  barra de telemetria do topo e cabeçalho de missão deixam de
  ficar permanentemente sobre a cena. Radar/velocímetro e
  ações contextuais necessários à jogabilidade permanecem.
  Modos, Assets, Replay, áudio, câmera, faróis, zoom e rota
  foram movidos (mesmos IDs/listeners) para **MENU → OPTIONS**.
  O menu também oferece clima. Missões ativas exibem uma linha
  curta de contexto e cronômetro, não um painel grande.
- **Compatibilidade:** mantidos `DriverChapterProgress`,
  `DriverHomeSave`, áudio, gamepads, sirene e colisões.
  Ao alternar 3D/PS1, cancela pivôs GLB pendentes e remove
  referências às antigas dobradiças.

### Verificações e limitações
- Novo teste `tests/driver-natural-campaign-hud.test.cjs` cobre
  progressão em ordem, não conclusão após derrota, leitura da
  geometria GLB original, integração das dobradiças, carregamento
  de scripts, menu e ausência do bloqueio por tela de vitória.
- **Ainda necessário:** teste visual em navegador real para
  checar qualidade do recorte da porta na carroceria original.
  A extração automática por triângulos cria uma porta funcional,
  mas não substitui rig manual com batentes e interior detalhado.
  As missões preservam seus roteiros simplificados próprios;
  esta revisão não pretende certificá-las como réplicas fiéis
  da história completa do Driver 2 original nem medir FPS.


## REV HUD essencial + porta do motorista + velocímetro 1990 (27/10/2026)

### Correções solicitadas após a revisão minimalista
- O **HUD voltou a mostrar DANO, DELITO e CLIMA** durante a
  condução, no bloco esquerdo compacto. Os quatro botões
  DIA/TARDE/NOITE/CHUVA e o indicador `weather-badge` mantêm
  os eventos e funções anteriores. A troca de cidade e as
  ferramentas auxiliares continuam no MENU, deixando apenas
  o botão MENU na parte superior direita.
- A entrada de Tanner no `carro_driver2_otimizado.glb` foi
  invertida para o painel com dobradiça **direita na orientação
  local do GLB**. Essa é a porta de motorista observada pelo
  usuário: a anterior selecionava a de passageiro.
  A viatura `car police.glb` mantém sua dobradiça própria.
  `DriverPoliceDoorRig.standPoint()` concentra o cálculo da
  posição lateral de entrada, aproximação e saída, com respeito
  a `vehicle.heading`. Ambos os lados fecham ao terminar ou
  cancelar a animação, inclusive após alternar PS1/3D.
- **Velocímetro estilo anos 90** substitui o antigo painel
  retangular de dígitos: instrumento analógico de 0 a 220 km/h,
  com mostrador escuro, numerais creme, ponteiro cor de
  cobre, odômetro digital, indicador de marcha P/D/R,
  giro aproximado e estado da sirene/derrapagem.
  Mantém os IDs do HUD e a leitura física de velocidade
  `Math.abs(playerCar.speed)*3.4`. O ponteiro gira entre
  -130° e +130° e limita o extremo da escala a 220 km/h;
  velocímetro é instrumento visual, não altera a física.
  Compacta o painel em telefones.
- Novo `tests/retro-speedometer-driver-door.test.cjs`
  valida o lado do motorista em quatro orientações,
  rotação de ambas as dobradiças, callbacks, HUD restaurado,
  marcações, movimento do ponteiro e a posição lateral
  compartilhada com a animação.

**Limitações:** os testes são de lógica, carregamento e
integração DOM; ainda é necessário jogar no navegador para
avaliar visualmente o acabamento das portas no GLB e o layout
do painel em resoluções menores. Nenhum FPS foi medido.
