# Driver 2 Three.js — Relatório técnico da revisão urbana

Revisão: 3999ec766f5e317c8fb64d1352d05f3aa92a4f55 (27/10/2026)
Site: https://jogoiarexx-blip.github.io/Driver-2-Three-js/
Fonte: https://github.com/jogoiarexx-blip/Driver-2-Three-js/archive/3999ec766f5e317c8fb64d1352d05f3aa92a4f55.zip

## Correções implementadas e verificações

1. Mobiliário viário: afastamento de 16 unidades dos eixos das ruas para postes e semáforos; reposicionamento de placas e contorno do canal. Criado js/world/road-geometry.js.
2. Canal: colisores segmentados coincidentes com as muretas visíveis, aberturas nas margens e água com profundidade lógica -4. Carro pode cair, gerar respingos e ser recuperado para a última posição seca.
3. Estação: elimina impulso vy proporcional à diferença brusca de terreno; limita degraus impassáveis e conserva saltos em saídas elevadas com impulso limitado.
4. Tanner: vaga da garagem junto à casa, 5 posições persistentes em localStorage (chave driver2-tanner-garage-v1), saída checada para colisões; atalhos P (guardar), O (abrir), T (rota casa).
5. Navegação: marcadores 3D das missões Chicago 01 e Havana 09; ativação J por proximidade, ícones de casa/garagem/missão no radar e mapa ampliado.
6. Sistema anterior preservado: missões, cidades, frota, carregamento progressivo, LOD, dança das peças, etc.

## Arquivos principais

- js/world/road-geometry.js (novo)
- js/world/street-furniture.js
- js/world/city-builder.js
- js/vehicles/driver-vehicle.js
- js/render/effects-manager.js
- js/gameplay/tanner-garage.js (novo)
- js/engine/driver2-game-engine.js
- index.html
- tests/urban-water-garage.test.cjs (novo)
- tests/city-home-save.test.cjs, tests/chicago-caine.test.cjs
- .github/workflows/deliverable-package.yml (novo)
- README.md

## Testes realmente executados

- JavaScript: sintaxe verificada para os arquivos alterados.
- GitHub Actions 'Driver 2 — QA de lógica': SUCCESS na revisão 3999ec7 (run 40559113206).
- GitHub Pages: SUCCESS na revisão 3999ec7 (run 40559114324).
- Workflow ZIP: SUCCESS na revisão 3999ec7 (run 40559113153), produzindo artefato Driver2-ThreeJS-FONTE.
- Testes Node para posicionamento, margens, rampa, água, garagem, indicadores e integração.
- Inspeção binária local do GLB fornecido: GLB 2.0, 1 mesh, 1 material e 1 textura JPEG embutida.

## Não verificado ou não implementado completamente

- Não houve teste completo de pilotagem visual em Chrome real por todas as quatro cidades.
- Não foram reproduzidas todas as ruas originais do Driver 2; cenários continuam adaptações procedurais.
- Demais pontos de missão, além de Chicago 01 e Havana 09, não receberam todos os ícones/acionamentos.
- Sistema da garagem não representa visualmente um interior 3D dirigível; é uma vaga externa funcional.
- Veículos GLB usam peças de dano estilizadas, sem deformação por vértices.
- O modelo binário GLB NÃO foi enviado ao GitHub nesta revisão; precisa ser colocado em assets/vehicles/carro_driver2_otimizado.glb e commitado, ou importado localmente no menu do jogo.
- Otimização longa de desempenho e validação visual de z-fighting/flicker pendentes.

## Como obter o projeto completo com o carro

1. Baixe o ZIP da fonte GitHub correspondente à revisão 3999ec7 (link acima) ou o ZIP na execução do workflow de entrega.
2. Extraia em uma pasta Driver2-ThreeJS.
3. Extraia o arquivo deste pacote na raiz dessa pasta, preservando assets/vehicles/carro_driver2_otimizado.glb.
4. Compacte a pasta resultante em ZIP. Este é o pacote integral fonte + GLB.
5. Para publicar no GitHub Pages, envie também assets/vehicles/carro_driver2_otimizado.glb para o repositório; caso contrário use o botão IMPORTAR GLB no jogo.


---

## REV OBB / rodas GLB / diagnóstico — 27/10/2026

**Antes:** colisão por discos com raios 3,6/4,5m; veículos longos
causavam impactos falsos. GLB monolítico, sem rodas independentes,
nem visualização integrada da caixa de colisão.

**Depois:** SAT para retângulos orientados e sweep contínuo com
intervalos temporais; massas e danos preservados. Novo módulo
`js/vehicles/vehicle-wheel-rig.js` para detectar quatro rodas
independentes quando existirem. Para o modelo atual, mostra
pontos de contato mas não sobrepõe pneus artificiais. Diagnóstico
visual via tecla I.

**Modificados:** `js/physics/vehicle-collisions.js`,
`js/vehicles/vehicle-wheel-rig.js` (novo),
`js/vehicles/driver-vehicle.js`, `js/render/vehicle-visuals.js`,
`js/assets/free-vehicle-library.js`,
`js/engine/driver2-game-engine.js`, `index.html`,
`tests/obb-glb-wheel-diagnostics.test.cjs`, README.

**A verificar em browser:** alinhamento gráfico do volume OBB,
comportamento do ônibus no tráfego, travessias entre pistas,
framerate, rodas e câmera no GLB. Campanhas não foram alteradas.
**Pendente crítico:** wheel meshes do GLB original não são separadas.


---

## REV 2026-10-27 — Rede viária / rampa ferroviária / garagem

**Causa da IA atravessar canal:** `chooseNext()` verificava somente
`isPointBlocked(nextX,nextZ)` no destino da rua. A água ficava no meio
do segmento e não entrava na decisão da IA.

**Correção:** amostragem contínua de faixas até o próximo cruzamento,
rejeitando muros e água. Auditoria BFS das ruas principais (81 nós
lógicos; ponte central é ligação indispensável). O algoritmo mantém
semaforização, perseguição e rotas de missão já existentes.

**Causa do salto para a ferrovia:** `getGroundHeightAt()` devolvia o
topo da plataforma (11,3m) só com base em x/z, independentemente de
carro/pedestre estar no piso inferior.

**Correção:** altura de referência opcional e piso superior elegível
somente quando o ator já está próximo da altura da plataforma; corrimãos
receberam colisores que acompanham a elevação real da rampa.

**Garagem:** construção de cobertura e três paredes físicas em
torno da vaga externa, mantendo a entrada frontal aberta. Carros só
podem ser guardados no passeio livre e a retirada recusa saída ocupada.

**Arquivos:** `js/world/road-geometry.js`,
`js/traffic/traffic-ai.js`, `js/world/city-builder.js`,
`js/entities/tanner-controller.js`, `js/vehicles/driver-vehicle.js`,
`js/engine/driver2-game-engine.js`,
`tests/road-rail-garage-network.test.cjs`, README e este relatório.

**Limites:** inspeção real de jogo, interiores de garagem animados,
geometria viária secundária, pedestres inteligentes, ondas e sombras
ficam para próximas revisões. Sem alegação de ganho de FPS.


---

## REV regionalização urbana e IA de pedestres — 27/10/2026

**Diagnóstico:** `UrbanDistricts.decorate()` adicionava os mesmos
três tipos de detalhe em todas as cidades e trocava somente cor. Os
28 pedestres se moviam no eixo Z arbitrariamente, atravessando
cruzamentos e podendo sair das calçadas ao esquivar-se.

**Mudanças:** `js/world/urban-districts.js` recebeu `profile()` e
`addRegionalFacades()`, com pares de `InstancedMesh` por bairro
quando o LOD próximo está ativo. Chicago (pilastras), Havana (sacadas),
Vegas (neon), Rio (brises). Novo
`js/entities/pedestrian-sidewalk-nav.js`, ligado a
`js/entities/pedestrians-roadblocks.js` e
`js/engine/driver2-game-engine.js`, define caminhos de contorno,
evita rua/água/prédios, esquiva local e reciclagem de até 3 atores
fora do foco por período. `index.html` carrega o módulo antes do
consumidor. 28 atores, sem criar grupos extras no streaming.

**Testes:** `tests/city-facades-pedestrians.test.cjs` e testes de
regressão da frota, campanhas, colisões, módulos de LOD e bloqueios
policiais. Validar em GitHub Actions e verificar visualmente no jogo.

**Pendências:** travessias legais nos semáforos, florestas/vegetação
mais detalhadas, prédios únicos, bairros reais com ruas próprias,
eventos comerciais e medição WebGL/FPS. A versão não afirma um mapa
geográfico 1:1 do original.


---

## REV travessias e cenário costeiro — 27/10/2026

**Antes:** os pedestres nunca cruzavam entre quadras; toda caminhada
ocorria em torno do mesmo quarteirão. A água era um plano colorido
único e as margens não possuíam elementos ambientais exclusivos. Os
parques de Las Vegas reutilizavam vegetação tropical.

**Depois:**
- `js/entities/pedestrian-sidewalk-nav.js`: planejamento da travessia
  de 34m em corredores amostrados, usando ciclos do semáforo da
  cidade, margem de segurança temporal, detecção de veículos e
  término garantido da passagem. Respeita a mesma física de água e
  os obstáculos existentes, sem adicionar colisores.
- `js/entities/pedestrians-roadblocks.js`: animação de caminhada
  também durante a passagem entre quadras e estado de travessia
  reiniciado ao reutilizar atores.
- `js/world/coastal-visuals.js` (novo): quatro lotes de
  `InstancedMesh` com espuma, solo costeiro e oito plantas/
  balizadores por cidade; estilo tropical, caribenho, deserto ou
  industrial. Só a opacidade de material muda ao longo do tempo.
- `js/world/city-builder.js`: inicializa/limpa o módulo costeiro,
  compartilha geometrias em parques e substitui árvores tropicais
  genéricas de Las Vegas por cactos.
- `index.html`: script costeiro inserido na ordem de dependências.
- `tests/signal-crosswalk-coast.test.cjs`: travessias, sinais,
  barreiras, veículos, quatro regiões, orla e disposição dos lotes.

**Ainda pendente:** testes jogados com pedestres, desempenho real,
faixas semaforizadas por cruzamento, colisão individual entre
pedestres e carros, geografia costeira 1:1, malhas de praia com
declives e ondas físicas. Sem medição de FPS.


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
