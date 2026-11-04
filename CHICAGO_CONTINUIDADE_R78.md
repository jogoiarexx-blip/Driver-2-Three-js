# CHICAGO — PLANO-MESTRE DE CONTINUIDADE (Driver 2 Three.js)

> **Documento vivo de retomada.** Atualize este arquivo **na mesma PR de toda revisão futura**. Assim, quando a conversa acabar, basta enviar este MD à próxima sessão e pedir para continuar a próxima etapa.  
> Projeto: [Driver-2-Three-js](https://github.com/jogoiarexx-blip/Driver-2-Three-js) · Jogo: [GitHub Pages](https://jogoiarexx-blip.github.io/Driver-2-Three-js/)  
> Referências técnicas: `AUDITORIA-MESTRA-DRIVER2.md`, `chicago/README.md`.  
> **Atualizado:** 2026-11-03 — R82 integrada (CI final ainda precisa ser conferido), próxima R83. **PR R78:** [#54](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/54) (integrada). **PR R79:** [#55](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/55) (integrada).

## 0. Missão do projeto — não perder o objetivo

**Refazer progressivamente a Chicago jogável para lembrar a Chicago de Driver 2 no PS1.** O objetivo é fidelidade em **ruas, bairros, estruturas, pontes, margens, cruzamentos, quarteirões, marcos urbanos, altura e interatividade**, não apenas melhorar a aparência da textura.

A cidade desejada deve conter:

1. **Ruas contínuas e coerentes com a referência PS1**, com pontes e acessos no lugar correto. Não inventar asfalto sobre água ou sobre prédios.
2. **Quarteirões reais**: ruas → polígonos de quadra → lotes → casas geminadas/comércio/prédios em sequência → becos e pátios.
3. **Construções de três níveis**: `facade-only` (exterior fechado), `shell-planned` (fachada preparada, **ainda não visitável**) e `full` (porta real, cenário interno e saída funcionando).
4. **Interiores completos em pontos importantes** e parciais em alguns estabelecimentos; usar LOD para não carregar tudo em todos os prédios.
5. **Jogo preservado**: carro, pedestre, polícia, missões, saves, colisores, trânsito, 4 cidades, garagem do Tanner, Wrigley, Soldier Field e Navy Pier não podem regredir.

**A Chicago atual ainda NÃO equivale ao mapa PS1:** parte da cidade é uma reconstrução procedural compatível com uma grade herdada de **80 unidades**. Os GLBs originais e as análises R14–R76 são fontes de investigação; **não declarar uma nova rua PS1** sem certificar geometria, conectividade, água, altura, colisão e navegação.

## 1. Estado / baseline de implementação

| Revisão | Estado conhecido | Entrega |
|---|---|---|
| R69 | Integrada anteriormente | Becos residenciais com pavimento e ligações de IA verificadas |
| R71–R76 | Integradas anteriormente | Auditorias dos GLBs PS1, UV, materiais, triângulos e separação de superfícies |
| **R77** | **Integrada à `main`** (commit `6ba99579`, PR #53) | Chicago **jogável**: Sears Tower, Marina City, Merchandise Mart, Water Tower, placas de ruas e faixas; testes Chromium |
| **R78** | **CONCLUÍDA em `main`** — PR #54, merge `19ce23e2` | 9 quadras-piloto, **86 lotes em sequência**, fachadas diferenciadas, 2 interiores com entrada/saída real testadas |
| **R79** | **CONCLUÍDA em `main`** — PR #55, merge `1c5e8d38` | 2 travessas Downtown dirigíveis (320 un.), 8 polígonos orientados às ruas com 40 lotes R78; **não certificado como traçado PS1** |\n| **R80** | **CONCLUÍDA em `main`** — PR #56, merge `a0d82aaf` | 66 guarda-corpos físicos, 66 trechos de passeio, 10 pontes fixas, 11 fachadas; basculantes preservadas |\n| **R81** | **CONCLUÍDA em `main`** — PR #57, merge `0fc10af8` | 2 pátios dirigíveis, 4 rotas para caminhões, 4 colisores de carga, 4 galpões detalhados e um escritório jogável |\n| **R82** | **Integrada à `main`** — PR #58, merge `749545f5` | 3 interiores de um andar com salas, paredes e móveis físicos, carga/descarrega de GPU; saves reconhecem os IDs |\n| R83+ | **Planejadas** | Portas interativas, escadas reais e geografia PS1 verificada |

**Prova de conclusão:** uma revisão só muda para `CONCLUÍDA` quando seu código estiver em `main`, CI verde e, quando afetar a cidade jogável, o teste Chromium comprovar a entrada real no game. GitHub Pages pode demorar depois do merge; verificar o deploy separadamente.

### Checkpoint R78 — 03/11/2026: teste real aprovado e integração concluída

- **PR mesclada:** [#54](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/54), commit de merge `19ce23e2a6db71828e65765996f4a0b40a20d038`.
- **CI R78 aprovada:** [workflow 41636459274](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41636459274): **26 testes Node aprovados**, sem falhas, e Chromium iniciando o **jogo real**.
- **QA de lógica:** [workflow 41636459123](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41636459123) aprovado.
- Evidência do navegador: `city.chicagoCityPlan.r78PilotBlocks=9`, `r78Frontages=86`, `r78EnterableRooms=2`; as duas entradas respondem a `interiorAt` e o motor confirma `enterInterior`/`leaveInterior`. Os quatro interiores existentes e os marcos R77 continuam presentes.
- **GitHub Pages:** deploy pós-merge deve ser conferido em [Actions](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/workflows/pages/pages-build-deployment) antes de declarar publicado em produção.
- A próxima revisão de conteúdo é **R79 — ruas e quadras PS1 de Downtown**. Não iniciar outra auditoria isolada sem conexão com o jogo jogável.

## 2. Arquivos fundamentais e responsabilidades

| Arquivo | Papel atual / cuidado |
|---|---|
| `index.html` | Ordem dos scripts da aplicação; R78 deve carregar **antes** de `chicago-city-plan.js` |
| `js/world/city-builder.js` | Construtor principal das quatro cidades, grade herdada, física, arranjo de lotes, LOD e construção de interiores |
| `js/world/chicago-city-plan.js` | Decide o bairro, distribui lotes e adiciona **os mesmos footprints** aos objetos e às caixas AABB |
| **`js/world/chicago-block-generator-r78.js`** | **Novo:** seleciona pilotos, subdivide frentes sequenciais, classifica fachada/planejado/interior real, anota portas e adiciona detalhes agrupados de LOD |
| `js/world/chicago-ps1-playable-landmarks-r77.js` | Quatro pontos urbanos reconhecíveis. **Não sobrepor com quadras novas** |
| `js/world/chicago-ps1-coastline.js` e `js/world/chicago-ps1-river-branches.js` | Água, margem, pontes e restrições físicas |
| `js/world/chicago-ps1-street-network-r22.js` | Ruas de referência PS1 / integração de trechos verificáveis |
| `js/world/chicago-landmark-district-r57.js` | Acessos e estacionamento com verificação de piso e borda |
| `js/traffic/chicago-mixed-navigation-r49.js` | Grafo de rotas; **não adicionar aresta sem asfalto/colisão conferidos** |
| `js/engine/driver2-game-engine.js` | `enterInterior`, `leaveInterior` e tecla de interação. R78 reutiliza essas rotinas |
| `chicago/chunks/*.glb`, `chicago/chicago_atlas.webp` | Ativos originais da fonte PS1; **não confundir posição OBJ com coordenada jogável** |
| `chicago-original-preview.html`, `chicago-seam-r75.html`, `chicago-geometry-r76.html` | Ferramentas de inspeção — **não são o mapa jogável** |
| `tests/chicago-r78-sequential-blocks.test.cjs` | Regressão de lotes, AABBs, interiores, corredores e invariantes |
| `tests/chicago-r78-playable-browser.cjs` | Inicializa o jogo real e testa duas portas, retorno e colisões |
| `.github/workflows/chicago-r78.yml` | CI do pacote R78; publica evidências do navegador |

**Regra de integração:** não criar objetos visuais isolados sobre a grade existente. Ou o quarteirão antigo é **substituído antes dos colisores**, ou a intervenção é apenas decorativa, sem simular terreno transitável.

## 3. Entrega R78 — primeira geração de quarteirões contíguos

### 3.1 Nove blocos-piloto no mundo jogável

São **posições provisórias da cidade procedural**, escolhidas para preservar a topologia atual. NÃO são coordenadas extraídas do PS1:

| Área de teste | Centro X, Z | Padrão | Interiores |
|---|---|---|---|
| Ukrainian Village | `-280, -200` | Casas geminadas em duas frentes | Fachada + preparação |
| Prairie Avenue | `120, -200` | Casas residenciais em sequência | Fachada + preparação |
| Downtown / Loop | `-40, -40` | Comércio e prédios contínuos | **Loja no Loop (visitável)** |
| Greektown / Loop oeste | `-120, -40` | Prédios comerciais em sequência | Fachada + preparação |
| Downtown / Loop | `-40, -200` | Prédios de miolo de quadra | Fachada + preparação |
| Downtown / Loop | `40, -200` | Comércio e prédios em sequência | Fachada + preparação |
| Greektown / Sul | `-120, -200` | Fachadas comerciais contíguas | Fachada + preparação |
| River North | `-40, 120` | Prédios próximos ao rio | Fachada + preparação |
| Goose Island | `-200, 120` | Galpões e docas | **Depósito de Goose Island (visitável)** |

**Justificativa da revisão de coordenadas:** um teste real de Chromium comprovou que a malha de ruas do projeto já reserva muitos blocos da grade para R15/R35/R48 e outras passagens; os pilotos anteriores não eram gerados. Esta lista foi escolhida **a partir dos blocos efetivamente construídos pelo `CityBuilder` no jogo**, sem apagar ruas de referência, prédios R77 ou locais protegidos. A CI R78 deve confirmar que todos os nove são construídos, secos e com acesso.

**Resultado planejado:** 8 quadras × 10 construções + 1 quadra industrial × 6 = **86 construções**. Em vez de um prédio genérico no centro, há **duas fileiras de fachadas**, intervalos de aproximadamente 0,18–0,34 unidades entre lotes e uma passagem central **sem colisores**, preservando o espaço necessário para futuros becos.

As mesmas dimensões são usadas em instâncias/LOD e colisão: `b.width`, `b.depth`, `b.x`, `b.z`. Não criar edifício sem caixa correspondente, nem caixa maior que o edifício físico.

### 3.2 Níveis de interior e estado real

| Tipo de lote | Aparece por fora? | Possui entrada utilizável? | Situação R78 |
|---|---|---|---|
| `facade-only` | Sim | **Não** | Parede externa + janelas/porta visual |
| `shell-planned` | Sim | **Ainda não** | Reserva para hall/loja da revisão R82; **não anunciar como visitável** |
| `full` | Sim | **Sim, se registrado e testado** | Dois locais R78 que reutilizam a lógica `city.interiors` e interação do jogador |

As novas salas são `r78-loop-shop` (interior em X=1300) e `r78-goose-warehouse` (X=1360), em zona técnica interna da cena, separadas entre si e das salas atuais. As portas ficam do lado norte; `leaveInterior()` retorna a `door.z + 4`. A entrada deve estar **fora da AABB do prédio, fora da água e sem obstáculos**. O cenário interno de R78 reutiliza a sala genérica do `CityBuilder.buildInteriorRooms()`: **é visitável, mas não é ainda um interior autoral com múltiplos andares.**

**Salas anteriores que devem continuar acessíveis:** casa do Tanner, lanchonete, oficina, armazém já existente. Não mover suas coordenadas para encaixar uma fachada.

### 3.3 Performance e renderização

- Geometria externa continua usando o `districtChunks`, um far LOD por chunk e um near LOD instanciado por paleta.
- R78 acrescenta cornijas, portas, vitrines e molduras **somente quando o chunk próximo for materializado**, agrupadas por `DriverSpecialStructures.pack`.
- Não criar `PointLight` por janela, nem um `Mesh` por pequena decoração em todos os frames.
- O plano de lotes é determinista: mesmo centro e perfil = mesmas posições, alturas e portas, em reload.
- Sem alteração de taxas de spawn, missão, tráfego e IA; não editar as outras três cidades.

## 4. Regras de mundo e integridade — nunca violar

1. **Água e ponte:** usar `city.isWaterAt`, alturas e a geometria da travessia. Nenhum imóvel/rua no rio ou sobre o lago.
2. **Colisão = geometria:** uma parede sólida visível deve ter AABB compatível; um corredor de serviço não pode ter AABB invisível. Não abrir um corredor apenas visual e chamá-lo de rua.
3. **Interiores:** a porta do edifício deve ser alcançável a pé; o ponto de retorno deve ficar fora do volume bloqueado. Para `shell-planned`, não criar gatilho de interação.
4. **R77:** preservar Sears Tower, Marina City, Merchandise Mart, Water Tower, Navy Pier, Wrigley Field, Soldier Field, Meigs Field e a orientação do minimapa.
5. **Missões:** não mover Tanner, garagens, gatilhos, checkpoints e trajetos até que haja teste para cada reposicionamento.
6. **Mapa original PS1:** R75 e R76 mostraram o problema do corredor 3445: mudança de atlas em superfícies horizontais **não comprova** pista de automóveis. Necessário levantamento geométrico E1–E5 antes de habilitar novo segmento.
7. **Tráfego/polícia:** grafo e pavimento devem nascer da **mesma fonte de pontos**. Sem aresta fantasma sobre canal, parede ou trecho sem estrada.
8. **Largura de fachada:** o bloco atual tem calçada nominal de 50×50 e centro a 40 unidades do eixo da rua; deixar recuo seguro. A grade 80 é compatibilidade **temporária**, não padrão para sempre.
9. **Ativos:** conservar o atlas, os GLBs PS1 e a proveniência dos arquivos. Não sobrescrever a fonte para ocultar discrepâncias.

## 5. Plano de migração por regiões (não executar tudo de uma vez)

### R78 — quarteirões-piloto e portas
**Alvo:** completar o primeiro conjunto de quadras sequenciais na Chicago jogável.  
**Critério de aceite:** 86 lotes em 9 quadras, colisor/visual sincronizados, duas salas com `E`/saída funcionando, corredores centrais livres, sem erro JavaScript, teste das outras cidades, CI e screenshot.

### R79 — Início da substituição da grade: ruas reais no jogo (03/11/2026)

**PR:** [#55](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/55), branch `chicago-r79-downtown-corridors-block-polygons`. **CONCLUÍDA E INTEGRADA** em `main` no commit `1c5e8d389c5276f4183c85d22e265fa4213d680a`.

**Entregas implantadas na branch:**
- Novo `js/world/chicago-downtown-corridors-r79.js` ativa duas travessas reais **fora das linhas de 80 unidades**, uma em `z≈-40` de `x=-160` a `0`, outra em `z≈-200` de `x=-80` a `80`, ambas com leve curvatura; extensão total **320 unidades**, 16 subsegmentos × 20 unidades e faixa de **5,6 unidades**.
- Cada trecho tem inspeção de **largura completa e cotas** em intervalos de até 1,25 unidade. Água, paredes, falta de piso e degraus perigosos **reprovam o corredor inteiro**. Somente os corredores aprovados geram a malha de pavimento 3D sobre `getGroundHeightAt`, marcas centrais e arestas no grafo `js/traffic/chicago-mixed-navigation-r49.js`.
- Pontos de entrada em `x=-160,-80,0,80` se ligam às avenidas existentes por gateways, dividindo a malha antiga nos acessos: não criar caminho fantasma que a IA não possa dirigir.
- Quatro blocos R78 — `(-120,-40)`, `(-40,-40)`, `(-40,-200)` e `(40,-200)` — passam a ter dois **polígonos de frente de rua** cada, totalizando oito polígonos para os **mesmos 40 lotes** construídos. As paredes e AABBs não são movidas nem duplicadas; esses polígonos são a primeira definição explícita de quarteirão a partir da rua.
- Diagnóstico em `city.chicagoDowntownR79` com `connectedCorridors`, `connectedSegments`, `rejected`, `matchedBuildings`, `polygonCells` e booleans de certificação honesta.
- Testes `tests/chicago-r79-downtown-streets.test.cjs` e `tests/chicago-r79-downtown-browser.cjs`; workflow `.github/workflows/chicago-r79.yml` captura o jogo real, exercita caminho da IA e deixa relatório/screenshot em artefato.

**Limitação explícita:** esse par de travessas são **ruas novas de transição alinhadas à grade jogável**, não coordenadas identificadas da ROM. O sistema de referências R15–R76 inspeciona a geometria original PS1, mas **não homologou esses segmentos como a posição exata de Downtown no mapa PS1**. Nenhuma área de missão, spawns, pontes, altura original ou bairro completo foi deslocado. A grade 80 **permanece** nos corredores antigos até haver substituição validada.

**Checkpoint de validação R79 (03/11/2026):**
- **CI do projeto:** [workflow de lógica 41664238806](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41664238806) — concluída com sucesso.
- **CI específica + navegador:** [workflow 41664238719](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41664238719) — **29 testes Node aprovados**, teste Chromium aprovado, sem exceções JavaScript detectadas.
- No jogo real: **2 corredores / 16 segmentos aceitos / 0 rejeitados**, pavimento e marcas 3D presentes; **16/16 segmentos conectados ao grafo de navegação**, duas rotas inteiras planejadas e dirigíveis (9 pontos cada); **8 polígonos / 40 fachadas** compatíveis com as construções e colisores existentes.
- R78 manteve **86 lotes e 2 interiores visitáveis**, R77 **4 marcos**, casa do Tanner, Wrigley Field e ponte preservadas. QA em arquivo `qa-artifacts/chicago-r79/downtown-game.json` e captura `live-downtown.png` no artefato do workflow.
- As cotas encontradas no centro variam entre **0 e 0,35** na grade de calçadas herdada: piso renderizado acompanha `getGroundHeightAt`. Alisamento de transições e calibração PS1 permanecem pendentes, sem declarar certeza falsa.
- **GitHub Pages:** verificar deploy pós-merge antes de marcar publicado no site.

**Aceite para marcar R79 concluída:** 16/16 segmentos contínuos e acessíveis no R49, oito polígonos válidos com 40 imóveis, asfalto no jogo real, 86 lotes e dois interiores R78 preservados, quatro marcos R77, proteção contra água/colisão/altura, CI geral e Chromium verdes, merge na `main` e conferência do Pages.

**Etapa seguinte (R80):** calibrar a rede do **Chicago River e pontes** com ligações reais, proteção de água, edificações voltadas ao rio e teste de direção/IA com ponte levantada ou abaixada. O alinhamento fiel PS1 exige localizar as fontes originais antes de mover qualquer missão.

### R79 — Downtown: ruas PS1 e polígonos de quadra
**Não iniciar sem o aceite R78.**

- Identificar as ruas originais do **Downtown/Loop** nos dados PS1, guardar IDs/tiles e transformação OBJ → jogável em arquivo versionado.
- Medir eixo, largura, declividade, conexão, água e cruzamentos. Marcar cada trecho `source-certified`, `procedural-compatible` ou `unverified`.
- Introduzir uma **representação de corredor dirigida por polilinhas**, com verificação de área livre, altura e AABB antes de remover uma única calçada antiga.
- Construir **polígonos de quarteirão entre corredores**, e não retângulos fixos 80×80, em uma pequena área primeiro.
- Repartir os polígonos em lotes orientados para a via real. Reaproveitar `facadeStyle`/LOD da R78; manter limites de lote fechados sem invadir a faixa de carros.
- Teste de direção em todos os sentidos, radar, colisão, pedestres, polícia e pelo menos uma missão da região. **Rollback se a rota não existir.**

### R80 — Chicago River: margens físicas, fachadas e pontes (03/11/2026)

**Estado:** **CONCLUÍDA E INTEGRADA** no PR [#56](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/56), commit `a0d82aafc3b2c674d13dcbe1b113662a3e5f7ef9`; testes R80 e QA de lógica aprovados na branch final.

A R80 altera a **Chicago jogável** de fato, e não somente o visualizador da ROM:

- **Guarda-corpos físicos nas margens**: `js/world/chicago-riverfront-r80.js` reproduz os centros das barras já desenhadas pela R2 nas duas ramificações do Chicago River (`x=-240`, `x=-160`), com caixas AABB alinhadas ao volume VISÍVEL. Abordagens das **10 pontes fixas** são excluídas com folga; a camada é ativada **depois** das pontes, R53, R78, R79 e outros edifícios, e rejeita qualquer segmento que invada rio, prédio ou diferença de piso inválida.
- **Passeios públicos secos** junto ao guarda-corpo: placas estreitas com cota de `getGroundHeightAt`, somente em regiões verificadas secas e sem AABBs, sem emitir novos segmentos de tráfego para IA e sem fingir ser rua certificada do PS1.
- **Detalhes de pontes fixas**: perfis e pilaretes agrupados por `DriverSpecialStructures.pack`, em alinhamento com os decks R2 existentes; **nenhuma ponte inventada**, nenhum tabuleiro móvel trocado ou gerador de asfalto sobre água.
- **Fachadas para o rio**: estruturas **realmente existentes** nas quadras R78 e R14 adjacentes aos canais recebem janelas e molduras voltadas à água. Se os oito edifícios R53 tiverem sido construídos, também recebem ornamentos; **no teste real R53 estava inativa**, portanto o código NÃO inventa aqueles prédios. A execução Chromium identificou **11 fachadas efetivamente adicionadas** (8 em imóveis R78 e 3 em imóveis R14). Não há AABBs adicionais nas fachadas.
- **Duas pontes levadiças centrais** (`x=0` e `x=240`) mantêm movimento e rampa visual/física existentes; o grafo `js/traffic/chicago-mixed-navigation-r49.js` precisa invalidar rotas quando os tabuleiros estão elevados, enquanto a ponte fixa `x=-240,z=-80` continua utilizável.
- **NÃO equivale ao traçado PS1 homologado**. Todo o rio R2 é aproximação procedural; a R80 adiciona integridade física e legibilidade da área, não muda coordenadas de missões, pontes ou POIs originais.

**Testes exigidos antes do merge:** `tests/chicago-r80-riverfront.test.cjs` e `tests/chicago-r80-riverfront-browser.cjs` + R2/R53/R79/R78/R69/R77. O browser deve detectar margens secas com colisão real, 10 pontes fixas, 8+ fachadas sobre prédios preexistentes, navegação pela ponte oeste, alteração de grafo ao erguer as basculantes e nenhum erro JS. Workflow: `.github/workflows/chicago-r80.yml`.

**Checkpoint de verificação R80 — 03/11/2026**
- PR [#56](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/56), merge `a0d82aafc3b2c674d13dcbe1b113662a3e5f7ef9`.
- [CI R80 41671592572](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41671592572): **43 testes Node aprovados**, sem falhas; Chromium iniciou a **Chicago jogável**, verificou os dois estados das pontes móveis, os guarda-corpos, a rota de IA e os quatro marcos urbanos, sem erro JS.
- [QA de lógica geral 41671592703](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41671592703): aprovada na mesma revisão.
- **Resultado físico real:** 66 barreiras AABB em locais secos, correspondentes às peças visuais preexistentes da R2; 66 passeios secos; **8 posições reprovadas** por não satisfazerem as condições de segurança; **10 pontes fixas preservadas com 240 detalhes leves**.
- **Arquitetura:** 11 fachadas **sobre prédios já construídos** (8 pertencentes à R78, 3 à R14). R53 não estava ativa na sessão real, portanto nenhuma de suas oito estruturas foi inventada. 0 novos segmentos de trânsito, 0 novas pontes.
- **Rotas:** IA fecha travessias nas basculantes x=0 e x=240 quando erguidas; reabre ao abaixar; a ponte fixa oeste usa rota verificada de **3 pontos**, sem colisão; grafo invalida o cache ao mudar estado.
- **Regressão:** R79 mantém 2 corredores / 16 trechos; R78 mantém 86 imóveis e 2 salas utilizáveis; R77 mantém 4 marcos; casa do Tanner, Wrigley Field e Lower Wacker presentes.
- **Evidências:** artefato `chicago-r80-live-riverfront-bridges` em GitHub Actions, com `riverfront-game.json` e captura `riverfront-game.png`. **Pages:** conferir workflow de deploy mais recente antes de declarar atualizado no site.
- **Geografia PS1:** canal e margens R2 são reconstrução procedural. Não afirmar equivalência de coordenadas originais da ROM sem evidência específica. **Próxima R81: Goose Island industrial.**

**R81 foi implementada e integrada no PR #57.** Consulte a seção R81 acima. A revisão seguinte é a **R82 — interiores modulares completos**, mantendo a exigência de coordenadas PS1 comprovadas antes de realocar o cenário.

### R80 — escopo planejado original (histórico; entrega final documentada acima)
- Corrigir margens e acessos com base no rio e pontes da fonte PS1; **não tratar água como asfalto**.
- Preservar a lógica da ponte levadiça e da ponte leste; checar grade de altura (sobre/sob viaduto).
- Substituir blocos genéricos por fachadas voltadas para o rio, acessos pedonais e docas onde couber.
- Teste em ambos os lados das pontes e rotas alternativas com a ponte aberta/fechada.

### R81 — Implementação industrial de Goose Island (03/11/2026)

**PR:** [#57](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/57) • **estado:** **CONCLUÍDA E INTEGRADA** na `main` no commit `0fc10af819bc3c17759bafd02a047971956acc4a`.

- **Dois pátios de carga realmente dirigíveis**, `(-218,250)` e `(-182,250)`, com piso físico em plano seco e cotas acompanhadas por `getGroundHeightAt`. Ligados ao eixo industrial existente `x=-200` por **quatro segmentos concretos de navegação**, incluindo o acesso na **ponte fixa da R2 em (-160,240)**. Não há ponte nova nem asfalto fingido sobre os canais.
- **Verificação fail-safe:** inspecionar todo o retângulo do pátio e três faixas de cada segmento; água, AABB, erro de piso ou mudança brusca de altura cancelam TODOS os pátios e arestas, sem caminhos sem asfalto. Grafo R49 invalida cache quando as rotas R81 mudam.
- **Galpões existentes R4/R6**: quatro frentes industriais são detalhadas com portões, janelas e perfis agrupados, **sem substituir os edifícios nem suas colisões originais**.
- **Carga real:** pilhas de mercadorias com caixas AABB correspondentes às geometrias visíveis, mantidas fora das rotas de veículos; não criar paredes invisíveis.
- **Escritório parcial e visitável** dentro de um galpão R78 em `(-200,120)`: porta física em área seca, espaço `r81-goose-yard-office` (`inside: (1440,0)`) registrado **antes** de `buildInteriorRooms()`, com mobiliário próprio; o sistema existente da tecla de interação / entrada / saída continua sendo usado. O depósito integral R78 continua funcionando.
- **Cautela:** as ruas, os galpões e o rio continuam aproximações da Chicago jogável; posições originais da ROM **NÃO certificadas**. Missões, spawns, garagens, outros bairros e outras cidades não são alterados.

**Arquivos:** `js/world/chicago-goose-industrial-r81.js`, `js/world/city-builder.js`, `js/traffic/chicago-mixed-navigation-r49.js`, `index.html`, `tests/chicago-r81-industrial-yards.test.cjs`, `tests/chicago-r81-playable-browser.cjs`, `.github/workflows/chicago-r81.yml`.

**Aceite:** 2 pátios com 4 links na IA e nenhuma superfície inundada, pelo menos 4 AABBs de carga visível, quatro frentes industriais R4/R6, uma sala adicional com interação/saída real, R80 (66 barreiras), R79 (16 segmentos), R78 (86 lotes/2 salas) e R77 (4 marcos), CI e Chromium sem erros, PR integrado. Registrar a execução no MD ao concluir.

**Checkpoint de integração R81 — 03/11/2026**

- PR **[#57](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/57)** mesclada no commit `0fc10af819bc3c17759bafd02a047971956acc4a`.
- [**CI específica 41674936224**](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41674936224) aprovada: **44 testes Node passaram**, além de um teste Chromium no game completo. [**QA lógica 41674936179**](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41674936179) também aprovada na branch integrada.
- **Jogo real:** `ready=true`; dois pátios em `(-218,250)` e `(-182,250)`; quatro arestas físicas ligadas ao grafo R49 `4/4`; quatro pilhas de carga com AABB e visual; 4 galpões reais decorados com 30 peças leves. A água continua ativa fora da ponte fixa: `(-160,200)` é água; `(-160,240)` é travessia seca.
- **Interior real adicional:** `r81-goose-yard-office`, porta em `(-214.2467,143.9)`, interior técnico `(1440,0)`, **10 móveis**, entrada e saída `enterInterior`/`leaveInterior` aprovadas. É um **escritório parcial**, NÃO edifício completo de vários andares.
- **Regressão:** R80 66 barras, R79 2 corredores/16 segmentos, R78 86 lotes/2 interiores, R77 4 marcos, Tanner e estádio preservados.
- **Evidências:** artefato `chicago-r81-goose-industrial-game` do workflow, arquivos `goose-game.json` e `goose-island-game.png`. Confirmar deploy Pages à parte.
- **Limites:** novas áreas industriais são procedurais com validação de água, cotas e colisões; não existem coordenadas homologadas PS1 para esses novos pátios.

**Próxima R82:** evolução de interiores modulares (hall, galpões navegáveis, escadas/cômodos) com carregamento sob demanda e colisão interna; em paralelo, seguir trabalhando a geografia PS1 somente com evidências OBJ verificáveis.

### R81 — Goose Island: área industrial
- Fazer rede real de pátios, galpões sequenciais, becos de serviço e docas compatíveis com o mapa.
- Construir alguns galpões com **interior parcial** e pelo menos um com interior completo, com acesso físico legítimo.
- Testar veículos grandes e perseguições: larguras de curva, acesso à ilha, colisão em canal e caminhão.

### R82 — Chicago: interiores modulares reais (03/11/2026)

**PR:** [#58](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/58) · **Integrada à `main`** por squash commit `749545f566ac9b1094ebad3c29ae9a26d1828c75`. **Validação:** as primeiras duas execuções R82 passaram; no momento do merge, o workflow do último commit (saves/HUD) ainda estava na fila e precisa ser conferido. Não alegar CI final aprovado sem checar.

**Objetivo:** substituir salas genéricas com móveis atravessáveis por interiores arquitetônicos realmente navegáveis com a mesma geometria para render e colisão.

**Três interiores preexistentes melhorados (não criar entradas/teleportes novos):**
1. `r78-loop-shop` — loja, estoque lateral, balcão de atendimento e corredor.
2. `r78-goose-warehouse` — armazém, depósito, oficina e corredor com paletes colidíveis.
3. `r81-goose-yard-office` — escritório industrial parcial com arquivo, estação de trabalho e corredor.

**Planta e física:**
- Cada ambiente usa o mesmo recinto original de **24×22 unidades** e divide o piso em **três áreas**: sala oeste, corredor central e sala leste. Duas divisórias em x=±3,8 possuem **aberturas reais de 4,0 unidades** em z≈0. O jogador pode atravessar; portas não são desenhos sobre parede maciça.
- AABB é calculada diretamente da **mesma peça** que compõe a malha visível: paredes divididas e itens sólidos como armários, balcões, paletes, arquivo, prateleiras. Uma parede sem AABB ou uma AABB invisível é proibida.
- `CityBuilder.isPointBlocked` consulta as colisões R82 **somente quando a posição pertence ao ambiente modular**; a casa do Tanner conserva `DriverTannerHomeInterior.blocked` com seus móveis e mesa de save.
- Área de spawn (centro, z=-6), área da saída (centro, z=-8,8) e as duas portas laterais permanecem livres em todas as salas.
- **Render sob demanda**: `DriverChicagoModularInteriorsR82.prepare(city)` registra apenas pequenas plantas em memória ao construir a cidade; `enter(city,place)` cria o grupo visual batched do único interior ativo; `leave(city,place)` remove e descarrega as instâncias/material/geometry. O player usa o mesmo `GameEngine.enterInterior/leaveInterior`, portanto a tecla de interação original é preservada.
- O velho mobiliário apenas decorativo do escritório R81 é evitado quando R82 está disponível, para não sobrepor o mobiliário colidível da R82. O teste histórico R81 aceita tanto o fallback antigo quanto a versão modular.
- **Save/load com backward compatibility**: `js/gameplay/home-save.js` aceita os três IDs de interiores novos sem mudar o número da versão, a chave de armazenamento ou o formato anterior. `GameEngine.loadHomeGame` reconstitui a malha visual do interior restaurado e descarta a antiga se o checkpoint aponta para outro cômodo; não deixar sala salva sem render nem malha de sala anterior ocupando GPU.
- **Atenção:** são interiores **modulares de um pavimento**; não alegar múltiplos pisos, escadas físicas, sistemas de porta animada ou coordenadas ROM certificadas. Esses itens são **pendências futuras**.

**Arquivos desta etapa:** `js/world/chicago-modular-interiors-r82.js`, `js/world/city-builder.js`, `js/engine/driver2-game-engine.js`, `js/world/chicago-goose-industrial-r81.js`, `js/gameplay/home-save.js`, `index.html`, `tests/chicago-r82-modular-interiors.test.cjs`, `tests/chicago-r82-playable-browser.cjs`, `tests/chicago-r81-playable-browser.cjs`, `.github/workflows/chicago-r82.yml`.

**Aceite antes do merge:**
- [ ] Três blueprints (três áreas cada), com divisórias AABB reais e duas passagens acessíveis a pé, sem erro de script.
- [ ] Entrada/saída `E` funcionando nos três ambientes, e os grupos de malha aparecem somente **durante** a visita e desaparecem ao sair.
- [ ] `isPointBlocked` impede atravessar paredes/móveis mas permite portas laterais, spawn e saída.
- [ ] Casa do Tanner preservada (inclui mesa save); R81 escritório, R80 66 guarda-corpos, R79 16 segmentos, R78 86 construções/2 interiores, R77 4 marcos preservados.
- [ ] Testes Node, regressões e Chromium aprovado com captura **dentro de um ambiente**, PR mesclado e publicação GitHub Pages separadamente verificada.

**Checkpoint de integração R82 — 03/11/2026**

- **PR #58:** [código integrado](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/58), SHA de merge `749545f566ac9b1094ebad3c29ae9a26d1828c75`.
- **Teste principal pré-merge validado:** [workflow 41679524779](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41679524779) — **33 testes Node aprovados** (incluem R77–R81) e Chromium aprovando 3 entradas/saídas. [workflow 41679619884](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41679619884) também aprovou a R82 principal.
- **Resultados reais do jogo:** 3 blueprints criados, 3 zonas conectadas por recinto, 2 portas abertas por sala, 9–11 caixas físicas por sala, **3 carregamentos e 3 descarregamentos**, no máximo **um ambiente adicional em GPU** de cada vez. 0 erros de página detectados.
- **Regressões:** Tanner continua com 13 caixas de mobiliário; R81 4 arestas e escritório, R80 66 barreiras, R79 16 trechos/2 corredores, R78 86 imóveis/2 entradas, R77 4 referências.
- **Hotfix posterior ao teste principal:** `js/gameplay/home-save.js` aceita os IDs dos três cômodos mantendo chave e versão do save. O motor remonta a sala salva ao carregar, limpa a anterior, e mostra uma mensagem de exploração adequada em ambientes não residenciais.
- **Validação final da versão mesclada:** workflows R82/R81/QA do último commit ainda estavam **na fila** no momento de integração. Checar [Actions](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions) e corrigir qualquer falha antes de declarar R82 totalmente homologada. **GitHub Pages** também precisa concluir o deploy do último SHA.
- **Captura:** `modular-warehouse-inside.png` no artefato `chicago-r82-real-modular-interiors` de [41679524779](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41679524779); mostra a arquitetura real, antes do ajuste da mensagem de HUD.
- **Não finalizado:** escadas físicas, andares superiores, portas animadas e posições PS1 da ROM; seguir somente com implementação verificável e segurança do jogador.

**Próxima etapa R83:** estender o sistema para mais interiores com **portas interativas**, fases distintas, escadas e alturas físicas apenas onde houver navegação/colisão segura; seguir aproximando geografia PS1 por malhas verificadas, sem confundir aproximação com a ROM.

### R82 — interiores modulares completos
- Converter `shell-planned` escolhidos em **interiores parciais reais**: hall, balcão e 1–2 salas.
- Em pontos de missão, criar interiores **completos**: cômodos, portas, escadas, pavimentos, objetos e física.
- Ligar exterior → porta → interior → saída sem teleportes indevidos ou áreas invisíveis.
- Renderizar interiores **sob demanda**; liberar recursos ao sair sem apagar estado relevante.
- Testar teclado/controle/celular, save/load, missão ativa e reentrada.

### R83 — Portas internas, dois novos prédios acessíveis e escada física (03/11/2026)

**Estado final:** R83 INTEGRADA à `main` pela [PR #59](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/59), squash commit `8c9ac35515fc3873cc5e2034df8e415ce6999cf4`. [CI R83 41827174305](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41827174305) verde: testes Node e Chromium do jogo real, correção de Tanner invisível no teste e compatibilidade de `showSaveStatus` em mock antigo. QA de lógica [41827174238](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41827174238) verde; saves P1 [41827174245](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41827174245) verdes. GitHub Pages deve ser conferido separadamente.

- **Dois lotes de fachada R78 `shell-planned`** deixam de ser decorativos e passam a ser acessíveis: `r83-loop-mezzanine` (bloco `-40,-200`, interior off-world `830,0`) e `r83-ukrainian-house` (bloco `-280,-200`, interior `900,0`). Os lotes, ruas e footprints externos não mudam. São acessos a pé no mesmo E/SAIR utilizado pelos demais prédios, só registrados se a entrada e a calçada de retorno estiverem secas e desobstruídas.
- **Portas internas operáveis por E/controles existentes**, duas por interior. A porta fechada possui volume visual de 3,58×3,2 unidades e AABB física correspondente; aberta recolhe visualmente a folha para o lado da divisória e libera exatamente a mesma passagem. Fechamento é bloqueado se Tanner estiver no batente. HUD mostra ABRIR/FECHAR quando Tanner está próximo.
- **Escada piloto real no escritório**, 12 pisos físicos sequenciais de 0,3 m (extensão de 0,625 m cada) conduzindo a um **mezanino de y=3,6**. `getGroundHeightAt` retorna a altura exata do degrau/plataforma; Tanner só vence cotas compatíveis por atualização (máximo 0,43 m de subida e 0,75 m de descida); saltos laterais para o nível superior e quedas sem saída são proibidos. Guarda-corpos e divisórias são malha sólida + colisões com cotas; os degraus são superfícies físicas de apoio, não barreiras AABB.
- **Renderização sob demanda**: a planta de colisão fica em memória, mas as geometrias instanciadas de apenas um interior R83 ativo são carregadas ao entrar e descarregadas/dispostas ao sair. R82 e R83 fecham o ambiente anterior ao abrir outro. Apenas marcadores leves de entrada permanecem na fachada. Custo por frame fora da sala limitado ao pequeno desvio de verificação em Chicago; não adicionar renderização permanente a todas as casas.
- **Save v2 retrocompatível**: whitelist ampliada para IDs R83, campo opcional `interiorDoors` registra estados das portas; saves antigos sem o campo seguem válidos e `loadHomeGame` recupera malhas do interior restaurado.
- **Limites:** o segundo nível é **um mezanino piloto**, não um prédio completo com múltiplos pavimentos. Nem os dois endereços externos nem a tipologia de seus interiores foram certificados pela geometria original do PS1. Não criar promessas de mapa 1:1. Outras cidades, missões, veículos, pontes e água permanecem nas rotas anteriores.

**Arquivos:** `js/world/chicago-accessible-interiors-r83.js`, `js/world/city-builder.js`, `js/entities/tanner-controller.js`, `js/engine/driver2-game-engine.js`, `js/gameplay/home-save.js`, `index.html`, `tests/chicago-r83-accessible-stairs.test.cjs`, `tests/chicago-r83-playable-browser.cjs`, `.github/workflows/chicago-r83.yml`, este MD.

**Teste antes do merge:** registrar 2/2 salas reais, abrir/fechar ambas as portas com colisão dinâmica, subir 12 degraus a pé com y≈3,6, rejeitar subida lateral de 3,6, 1 sala com GPU ativa, zero geometrias remanescentes depois da saída, 3 salas R82, 86 lotes R78, tráfego R79 (16 trechos), rio R80 (66 barras), R81 (4 conexões), Tanner/save preservados; guardar artefato de screenshot dentro do mezanino. Se falhar, corrigir e repetir.

**Próxima R84 após QA:** ampliar plantas com unidades interiores por quarteirão e transições verticais mais longas, validar FPS/memória em celular real e conferir posições PS1 antes de afirmar fidelidade cartográfica.

### R84 — Mais edifícios e dois patamares com física real (04/11/2026)

**Estado:** R84 CONCLUÍDA E INTEGRADA à `main` pela [PR #60](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/60), squash commit `e47340c4518029dc2cc39acb9ac30a6c2bba5328`. [Workflow R84 41828696248](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41828696248) verde: **78 testes Node**, Chromium no jogo completo e screenshot da plataforma superior. Merge e GitHub Pages devem ser confirmados separadamente.

- **2 novas entradas reais em shell já existente** nos 86 lotes R78: `r84-greektown-loft` (bloco -120,-200, interior x=660) e `r84-prairie-office` (bloco 40,-200, interior x=720). Só registra lote `shell-planned` com porta e retorno secos, livres de obstáculos. Continua com entrada E original e sem criar estrada, ponte, quarteirão ou mudar missão.
- **Planta arquitetônica enxuta**: divisória com vão físico e uma porta que abre/fecha por E e bloqueia de verdade quando fechada; móveis colidíveis em todas as salas. Um interior de um pavimento e um loft vertical experimental.
- **Escada longa** com **24 degraus de 0,30**, até 7,2 unidades, com patamar lateral intermediário a 3,6 e plataforma superior a 7,2. Altura de cada degrau vem da própria malha; `getGroundHeightAt` e `TannerController.update` respeitam o limite físico de +0,43/-0,75 de cota por movimento. Proíbe subir por fora, atravessar guarda-corpo, teleportar entre pisos ou ficar sobre piso invisível. O shell visual da sala é elevado para 10,4, sem teto cruzando a escada.
- **Custo móvel controlado**: 42 peças de blueprint no loft piloto (sem GLB/texturas enormes), até 45 por recinto; geometria detalhada instanciada somente durante a visita, descartada ao sair. R82, R83 e R84 descarregam a sala anterior e mantêm no máximo um ambiente detalhado em GPU. Área externa usa rejeição espacial rápida para ignorar cálculos interiores.
- **Save v2 preservado**: mesmos `localStorage` e formato base; ID R84 na whitelist, `interiorDoors` opcional também para R84 e reconciliação do layout carregado. Casa do Tanner preservada.
- **QA exigido**: 2/2 entradas físicas na cidade real, porta E aberta/fechada com AABB correspondente, subida a pé de 24 degraus até y=7,2 sem travar, patamar y=3,6, 0 geometrias R84 persistentes após saída, status R83 2/R82 3/R81 4 links/R80 66 grades/R79 16 rotas/R78 86 lotes, screenshot na plataforma, sem erros JS. Testes de celular real/FPS preciso permanecem **pendentes**; o CI controla orçamento geométrico, não inventa medição de 60 FPS.
- **Limite factual**: esses lotes não têm coordenadas interiores certificadas pela ROM do PS1; a plataforma superior é piloto de navegação vertical, **não** um prédio completo de 3 andares.

**Arquivos:** `js/world/chicago-vertical-interiors-r84.js`, `js/world/city-builder.js`, `js/entities/tanner-controller.js`, `js/engine/driver2-game-engine.js`, `js/world/chicago-modular-interiors-r82.js`, `js/world/chicago-accessible-interiors-r83.js`, `js/gameplay/home-save.js`, `index.html`, `tests/chicago-r84-vertical-interiors.test.cjs`, `tests/chicago-r84-playable-browser.cjs`, `.github/workflows/chicago-r84.yml`.

**Evidência real R84 — 04/11/2026:** dois blueprints e duas entradas E válidas em lotes R78 reais (`r78--120--200-1-1`, `r78-40--200-1-1`); um layout visual por vez; 2 carregamentos e 2 descarregamentos. Loft com 42 peças/13 AABBs, segundo escritório com 10 peças/7 AABBs. Subida automática do Tanner: `maxY=7.2`, `finalY=7.2`, `finalZ=8.12`, `stalled=0`. Patamar intermediário 3,6; entrada no pavimento inferior continua y=0; salto lateral impossível. R83=2, R82=3, R81=4 links, R80=66 grades, R79=16 vias, R78=86 lotes. Screenshot e JSON no artefato `chicago-r84-vertical-real-game`. **Isso não é benchmark de FPS em celular físico.**

**Próxima R85 após R84 integrada:** navegação com obstáculos pequenos e portas por cômodo, testes de framerate/streaming em dispositivos móveis reais, e só depois expansão vertical maior.

### R85 — Portas por cômodo, colisão por varredura e QA mobile (04/11/2026)

**Estado:** R85 INTEGRADA à `main` pela [PR #61](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/61), squash commit `9238abcb99aeb17419cd400aa29334574e468288`. [R85 workflow 41843776906](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41843776906) verde: **85 testes Node, falhas 0**, R84 Chromium de regressão e R85 Chromium touch de ponta a ponta. Confirmar merge e Pages separadamente.

- **Nenhum novo lote, rua ou prédio**: as 2 plantas R84 agora possuem **2 portas internas funcionais cada**, com partição e vão reais. O escritório ganhou duas peças de mobília pequenas com geometria + AABB de colisão; no loft a pequena caixa do patamar, antes somente visual, ganha AABB exatamente igual à malha. 45 peças instanciáveis no loft e 15 no escritório.
- **Física R85 só a pé e dentro de R83/R84**: `DriverChicagoIndoorNavigationR85.move` percorre toda a distância em passos máximos de 0,22 unidade, aplicando as colisões e a altura real em **cada subpasso**. Impede atravessar móveis pequenos, portas fechadas ou divisórias a 12,5 unidades/s ou com queda momentânea de FPS. Se encostar, pode deslizar lateralmente após testar fisicamente cada eixo. O limite de subpassos é 24 por atualização, com distância total limitada a 5,28 unidades; fora de Chicago e fora dos interiores a implementação antiga não sofre alteração.
- **Portas pelo E e pelo botão toque existente AÇÃO (E)**, mesmo fluxo de entrada/saída e de save v2 da R84 (a lista de estados de portas já aceita comprimento maior sem migrar save antigo). Não alterar missões, IA externa, pontes, água, trânsito ou veículos. Somente 1 sala detalhada R82/R83/R84 ativa em GPU.
- **Teste navegável verdadeiro**: sair do spawn do loft, abrir a porta à direita, contornar o guarda-corpo, alcançar a base da escada e subir 24 degraus até `y=7.2` sem teletransporte. Verificar não atravessar porta fechada nem obstáculo menor que 1 m ao correr.
- **Simulação mobile**: Chromium touch em viewport 390×844 e DPR=2 usa o próprio botão HTML `touch-action` para entrar, abrir as portas e sair. Registra capturas e p50/p95 do tempo entre quadros (`requestAnimationFrame`) em `qa-artifacts/chicago-r85`. Medição **não corresponde ao FPS garantido em Android/iPhone físico**. Após a primeira rodada, o Chromium SwiftShader revelou ~300–317 ms medianos e p95 550–600 ms, portanto **não** declarar fluidez a 60 FPS.
- **Otimização R85 baseada nesse diagnóstico**: resolução adaptativa somente em aparelhos touch e enquanto Tanner explora o interior: inicia em DPR até 1,5, reduz a 1,0 apenas se a média de quadros reais por 3 s cair abaixo de 24 FPS, e só retorna a 1,5 após manter mais de 48 FPS. Não há mudança no mapa/colisão nem no DPR de desktop; sair do prédio restaura a resolução normal. A HUD FPS deixa de usar o `dt` de física limitado a 50ms (que superestimava o FPS quando estava lento) e passa a contar o intervalo real. O CI registra `currentDpr`/`scaleChanges` para comparar sem inventar resultados.
- **Validação obrigatória**: Node R77–R85, navegador R84 completo, navegador R85 mobile; mesmo número de 86 lotes R78, 2 interiores R83, 3 R82; manter save/campanha. A auditoria PS1 original continua sem certificar plantas interiores.

**Arquivos:** `js/world/chicago-indoor-navigation-r85.js`, `js/world/chicago-vertical-interiors-r84.js`, `js/entities/tanner-controller.js`, `js/engine/driver2-game-engine.js`, `index.html`, `tests/chicago-r85-door-sweep.test.cjs`, `tests/chicago-r85-mobile-browser.cjs`, `.github/workflows/chicago-r85.yml`, este MD.

**Evidência R85 no jogo real (04/11/2026):** 2 interiores aprimorados com 2 portas cada, blueprint loft 45 peças/16 AABBs e office 15 peças/11 AABBs; ambas as portas novas abriram por toque `AÇÃO (E)`; ambas as entradas/saídas concluídas e descarregadas; 1 grupo de GPU ativo por vez; subida sem travamento pelo caminho a pé desde a porta até y=7,2, após 24 degraus. Sem erros JS. Emulação Chromium 390×844 DPR2 com SwiftShader: após resolução adaptativa `currentDpr=1`, `r85BudgetMode=reduced`, p50 loft **316,6ms** e office **300ms**, p95 583,3ms e 333,3ms. **Esse software render não fornece FPS de Android/iPhone; não certificar fluidez de 60 FPS ou ganho universal**. Relatório e screenshots em `chicago-r85-rooms-mobile-emulation`.

**R86 sugerida:** melhorar orientação do jogador dentro das salas (placas/iluminação e trilha para a escada), ampliar testes de colisão para interiores R82 e medir FPS real em celulares antes de afirmar um número.

### R86 — Coerência da campanha, vinhetas das fases e animação real do Tanner (04/11/2026)

**Estado:** R86 INTEGRADA à `main` pela [PR #62](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/62), squash SHA `8c46040e9201bf013d8a832b464a1e0fc821fefc`. [Workflow 41875587293](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41875587293): **192 testes Node aprovados**, navegador Chromium sem erros JS, screenshots da abertura/etapa/desfecho. Merge e GitHub Pages verificados separadamente.

- **Campanha inteira revisada para apresentação coerente:** 8 missões de Chicago, 1 de Havana, 3 de Las Vegas, 3 do Rio (**15 entradas**, mesma sequência `DriverCampaignFlow` preservada). `DriverCampaignScenesR86` define uma ligação contextual curta entre pistas, objetivo atual e próximo ato em português, com títulos de capítulo. Não reescreve história como se fosse a ROM PS1; é adaptação do jogo atual.
- **Cenas de abertura melhoradas, sem vídeo fictício:** a vinheta original de **5 segundos** continua pausando simulação/missões durante a abertura. 0–2s: título do ato; 2–3,15s: contexto da cena com **travelling leve da câmera real na rua**; 3,15–5s: objetivo da missão vindo do diretor/guia. O jogo não teleporta atores nem cria cópias de carros para a cena.
- **Transições entre objetivos verdadeiros:** cartões curtos e não bloqueantes observam `DriverChicagoMissionGuidance.snapshot` (Chicago) e `DriverHavanaLead` / `DriverRegionalMissions` (outras cidades). Mudam somente quando a **etapa real** muda (ex.: fugir após plantar C4, entregar o segundo veículo, encontro nos cais), não piscam a cada variação de distância ou cronômetro. Resultado de falha/vitória é apresentado separadamente, sem alterar `missionActive`, checkpoints, pontuação ou save.
- **Tanner ganha animação coerente com movimento físico:** `playModelAnimation('run')` escolhe o clip de corrida existente no GLB, caso haja. Sem clip de corrida, o clip de caminhada acelera suavemente a taxa de reprodução até 1,45×; ao caminhar, volta a 1×, com a transição já existente. Quando colide e não sai do lugar, o personagem usa *idle*, em vez de correr contra parede sem deslocamento. Nado e transições de veículo mantidos.
- **Física, IA e modos livres preservados:** nada modifica condições de vitória, temporizadores, scripts de inimigos, ROM/ruas, trafego, portas R85 ou veículo. Camada visual pequena e sob demanda: um elemento DOM reutilizado para as transições, sem GLB ou textura nova, sem loops de timer paralelos.
- **QA obrigatório:** teste unitário de continuidade dos 15 atos, progressão real de fase regional e Chicago, animação GLB com e sem `run`, bloqueio do personagem, intro de 5 segundos, integração engine, regressões narrativas/veículos/R85, browser Chromium do jogo real com screenshot da cena de rua e do resultado. Só integrar e publicar após verde.

**Arquivos:** `js/gameplay/campaign-scenes-r86.js`, `js/gameplay/mission-briefing.js`, `js/engine/driver2-game-engine.js`, `js/entities/tanner-controller.js`, `index.html`, `tests/driver-r86-campaign-scenes.test.cjs`, `tests/driver-r86-scenes-browser.cjs`, `.github/workflows/driver-r86-campaign-scenes.yml`, este documento.

**Evidência concreta de jogo (04/11/2026):** Na sessão Chromium de Chicago o jogo carregou 15 roteiros R86, iniciou `story_tipoff` com a vinheta `ATO I • CHICAGO / 01 • VIGILÂNCIA` e travelling da câmera real (`panDx=0,142`, `panDy=0,045`); objetivo atual `story_tipoff:enter` exibiu `ENTRE NO SEU CARRO`. Falha manual da interface de QA manteve `story_tipoff` desbloqueada para repetição sem marcá-la concluída; vitória manual da mesma interface marcou `story_tipoff` e apontou `story_witness` como próxima. Nenhum erro `pageerror`. A validação de desfechos exercita o endpoint de missão, **não afirma ter dirigido manualmente as 15 missões**. Screenshot e JSON no artefato `driver-r86-campaign-cinematics`. Os efeitos são cards e câmera do game real, **não animação de personagens NPC em vídeo**.

**Próxima R87 sugerida:** cenas roteirizadas com poses de NPCs reais e eventuais zooms por missão, usando os modelos existentes e sem alterar gatilhos; teste visual de cada missão por cidade e ajustes específicos à IA de alvo. **Sem criar vídeos ou prometer 3D cinematic completo sem evidência.**

### R83+ — extensão e acabamento
- Migrar bairros restantes com rede PS1, trânsito, pedestres, bairros e marcos.
- Depois, trabalhar texturas, iluminação, LOD, áudio e desempenho: **visual sem geografia correta não resolve a Chicago**.

## 6. QA: comandos e evidências exigidos

Com um checkout Node 22, na raiz do repositório:

```bash
node --check js/world/chicago-block-generator-r78.js
node --check js/world/chicago-city-plan.js
node --test tests/chicago-r78-sequential-blocks.test.cjs tests/chicago-city-plan.test.cjs tests/chicago-r69-courtyard-network.test.cjs tests/chicago-r77-playable-landmarks.test.cjs
```

Teste completo de navegador: `.github/workflows/chicago-r78.yml` inicia um servidor local, abre a aplicação em Chromium e executa `tests/chicago-r78-playable-browser.cjs`. **Não basta testar uma página auxiliar**: é preciso ver `DriverGame.city` e as portas da cidade real.

Checklist de aceite:

- [x] 9 quadras e 86 lotes reais no jogo.
- [ ] Casas/prédios sem intervalos enormes; duas frentes contínuas e beco livre.
- [x] 2 interiores R78 com entrada e saída verificadas pelo motor.
- [ ] Fachadas sem portas falsas que prometam acesso.
- [ ] Nenhum prédio/paredão dentro de asfalto, ponte ou água.
- [ ] Quatro marcos R77 preservados; Tanner, missões, Wrigley e Soldier preservados.
- [ ] Radar, IA e rota de pedestres continuam sem falso atalho.
- [ ] Rio, Havana, Las Vegas continuam funcionando.
- [x] CI de lógica e CI R78 verdes.
- [ ] GitHub Pages concluiu deploy da revisão.
- [x] Foto real do jogo e relatório QA associados à PR.

**Regra de publicação:** não marcar como concluído se um teste falhar ou ficar apenas na branch. Se houver falha, registrar a causa exata aqui e corrigir antes do merge.

## 7. Como continuar quando esta conversa acabar

Copie este pedido junto com o arquivo MD:

> **Continue o projeto `jogoiarexx-blip/Driver-2-Three-js` usando `CHICAGO_CONTINUIDADE_R78.md` como plano-mestre. Confira a branch `main`, os PRs e os workflows atuais. Não recomece nem repita auditorias já resolvidas. Faça a próxima revisão pendente indicada na seção 5 (R82: interiores modulares, após a R81 integrada), com mudanças reais no jogo jogável, testes automáticos e Chromium. Preserve missões, água, colisões, tráfego e as outras cidades. Ao terminar, atualize o próprio MD com o que mudou, bugs restantes, links e a etapa seguinte.**

Se você disser apenas **“próxima”**, a referência é a **primeira revisão ainda não concluída na seção 5**.

## 8. Registro de mudanças obrigatório (acrescentar a cada PR)

Copie e preencha para qualquer revisão futura:

```markdown
### Rxx — Título (data)
- **Estado:** PLANEJADA / EM ANDAMENTO / CI APROVADA / MESCLADA / PAGES PUBLICADA
- **Objetivo real no jogo:** ...
- **Arquivos alterados:** ...
- **Coordenadas/IDs PS1 usados e fonte:** ...
- **Quarteirões/ruas/interiores adicionados:** ...
- **Colisão/IA/missões afetadas:** ...
- **Testes + links dos workflows:** ...
- **Screenshot do jogo real:** ...
- **PR:** ... | **Merge SHA:** ... | **Pages:** ...
- **Limitações e problemas:** ...
- **Próxima tarefa única e precisa:** ...
```

---

**Regra final:** manter **este MD na raiz do GitHub** e atualizá-lo a cada versão para não perder o rumo. Quando houver conflito entre o histórico da conversa e o código executável, **a branch `main`, os testes e as evidências reais do jogo prevalecem**.
