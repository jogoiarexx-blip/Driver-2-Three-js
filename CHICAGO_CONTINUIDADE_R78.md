# CHICAGO — PLANO-MESTRE DE CONTINUIDADE (Driver 2 Three.js)

> **Documento vivo de retomada.** Atualize este arquivo **na mesma PR de toda revisão futura**. Assim, quando a conversa acabar, basta enviar este MD à próxima sessão e pedir para continuar a próxima etapa.  
> Projeto: [Driver-2-Three-js](https://github.com/jogoiarexx-blip/Driver-2-Three-js) · Jogo: [GitHub Pages](https://jogoiarexx-blip.github.io/Driver-2-Three-js/)  
> Referências técnicas: `AUDITORIA-MESTRA-DRIVER2.md`, `chicago/README.md`.  
> **Atualizado:** 2026-11-03 — R82 em desenvolvimento, PR #58. **PR R78:** [#54](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/54) (integrada). **PR R79:** [#55](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/55) (integrada).

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
| **R79** | **CONCLUÍDA em `main`** — PR #55, merge `1c5e8d38` | 2 travessas Downtown dirigíveis (320 un.), 8 polígonos orientados às ruas com 40 lotes R78; **não certificado como traçado PS1** |\n| **R80** | **CONCLUÍDA em `main`** — PR #56, merge `a0d82aaf` | 66 guarda-corpos físicos, 66 trechos de passeio, 10 pontes fixas, 11 fachadas; basculantes preservadas |\n| **R81** | **CONCLUÍDA em `main`** — PR #57, merge `0fc10af8` | 2 pátios dirigíveis, 4 rotas para caminhões, 4 colisores de carga, 4 galpões detalhados e um escritório jogável |\n| **R82** | **Em desenvolvimento — PR #58** | 3 salas conectadas com colisão física e renderização sob demanda (um andar) |\n| R83+ | **Planejadas** | Portas interativas, escadas reais e geografia PS1 verificada |

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

**PR:** [#58](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/58) · **Branch:** `chicago-r82-modular-interiors-live-collision-lazy`. Estado deste checkpoint: código e testes criados, **confirmar CI e merge** antes de marcar concluído.

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
- **Atenção:** são interiores **modulares de um pavimento**; não alegar múltiplos pisos, escadas físicas, sistemas de porta animada ou coordenadas ROM certificadas. Esses itens são **pendências futuras**.

**Arquivos desta etapa:** `js/world/chicago-modular-interiors-r82.js`, `js/world/city-builder.js`, `js/engine/driver2-game-engine.js`, `js/world/chicago-goose-industrial-r81.js`, `index.html`, `tests/chicago-r82-modular-interiors.test.cjs`, `tests/chicago-r82-playable-browser.cjs`, `tests/chicago-r81-playable-browser.cjs`, `.github/workflows/chicago-r82.yml`.

**Aceite antes do merge:**
- [ ] Três blueprints (três áreas cada), com divisórias AABB reais e duas passagens acessíveis a pé, sem erro de script.
- [ ] Entrada/saída `E` funcionando nos três ambientes, e os grupos de malha aparecem somente **durante** a visita e desaparecem ao sair.
- [ ] `isPointBlocked` impede atravessar paredes/móveis mas permite portas laterais, spawn e saída.
- [ ] Casa do Tanner preservada (inclui mesa save); R81 escritório, R80 66 guarda-corpos, R79 16 segmentos, R78 86 construções/2 interiores, R77 4 marcos preservados.
- [ ] Testes Node, regressões e Chromium aprovado com captura **dentro de um ambiente**, PR mesclado e publicação GitHub Pages separadamente verificada.

**Próxima etapa R83:** estender o sistema para mais interiores com **portas interativas**, fases distintas, escadas e alturas físicas apenas onde houver navegação/colisão segura; seguir aproximando geografia PS1 por malhas verificadas, sem confundir aproximação com a ROM.

### R82 — interiores modulares completos
- Converter `shell-planned` escolhidos em **interiores parciais reais**: hall, balcão e 1–2 salas.
- Em pontos de missão, criar interiores **completos**: cômodos, portas, escadas, pavimentos, objetos e física.
- Ligar exterior → porta → interior → saída sem teleportes indevidos ou áreas invisíveis.
- Renderizar interiores **sob demanda**; liberar recursos ao sair sem apagar estado relevante.
- Testar teclado/controle/celular, save/load, missão ativa e reentrada.

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
