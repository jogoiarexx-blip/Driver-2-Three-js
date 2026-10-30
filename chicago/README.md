# Chicago original do Driver 2 (PS1)

Esta pasta fica na **raiz** do repositório, não em `assets/`.

A pasta completa do pacote `Chicago_Original_PS1_RAIZ_CHICAGO.zip` contém:

- `manifest.json`: limites e nome dos 54 setores;
- `chicago_atlas.webp`: atlas compartilhado;
- `chunks/*.glb`: 54 setores de geometria original para visualização.

O manifesto, atlas e 54 GLBs já estão publicados nesta pasta do GitHub, diretamente na raiz do projeto. Evite movê-los para `assets/chicago/`, pois o visualizador utiliza `./chicago/`. O visualizador está em [chicago-original-preview.html](../chicago-original-preview.html).

**Aviso:** esta é uma visualização técnica, não substitui a cidade jogável nem define colisores, ruas e missões do PS1.

## Solo real da geometria PS1 (baseline de navegação, NÃO malha de ruas)

Foi executada a extração de superfícies horizontais diretamente dos **54 GLBs originais** desta pasta, com `tools/chicago-ground-survey.py`.

Resultados reproduzidos: **1.544.872 triângulos** examinados; **269.865 triângulos de piso quase horizontal próximo a Y=0** e **36.203 triângulos horizontais acima desse nível (Y até 0,38)**. A máscara de piso ocupa **79.395 pixels de 411×768**, usando **0,25 unidade OBJ/pixel**; foram detectados **20 componentes conexos de pixels**, dos quais o maior tem 78.262 pixels. O percentual de 25,153% é apenas a fração de pixels ocupados **no retângulo envolvente**; NÃO é percentual dirigível nem fidelidade territorial.

A classificação é geométrica: triângulos com desnível entre vértices ≤ 0,008, distância média absoluta a Y=0 ≤ 0,028 e área projetada XZ > 0,006 unidade². Inclui calçadas, pátios e plataformas — **não habilita dirigir na Chicago original**. A topologia de ruas, rampas, pontes, água, tráfego, missões e colisores permanece pendente.

Reproduzir com Python 3 e `numpy`, `opencv-python-headless`, `Pillow`:

```sh
python3 tools/chicago-ground-survey.py --root chicago --output qa-artifacts/chicago-ground
```

Abrir `qa-artifacts/chicago-ground/chicago-ground-candidates.png` (azul = superfícies do solo; ocre = níveis baixos elevados), e comparar `ground-survey.json` gerado com a baseline `chicago/ground-survey.json`.

O workflow **Driver 2 - Auditoria de superfícies Chicago PS1** também gera o mapa e o diagnóstico como artefatos verificáveis no GitHub Actions. O próximo passo será distinguir estradas de calçadas e terrenos, calibrar escala e certificar conexões e colisões antes de migrar o jogo.

## R24 — classificação de superfície dos 4.279 segmentos candidatos

O arquivo `reference-network.json` preserva **4.279 conexões** extraídas do piso dos 54 setores. **Não é uma malha de ruas certificada**: pode incluir calçadas, pátios, plataformas e cruzamentos em diferentes alturas.

A R24 introduz a auditoria automática em `tools/chicago-r24-classify-roads.cjs`, baseada nas máscaras originais `reference-street-survey.json`. Cada aresta é examinada por amostragem transversal em 7 posições (centro, ±0,2, ±0,45 e ±0,7 unidades OBJ), considerando pavimento marcado, pavimento sem marca, grama, água, limites e comprimento.

A classificação é **forte**, **intermediária**, **revisar** ou **descartar**. Mesmo a classe forte indica somente boa evidência de pavimentação; NÃO demonstra pista dirigida, pontes niveladas ou geometria de tráfego. O relatório também agrupa segmentos conexos e prioriza os maiores corredores para inspeção manual.

Reproduzir com Node.js 22:

```sh
node --test tests/chicago-r24-road-evidence.test.cjs
node tools/chicago-r24-classify-roads.cjs qa-artifacts/chicago-r24/road-evidence.json
```

Para enxergar as classes sobre a geometria original, abra [a pré-visualização Chicago PS1](../chicago-original-preview.html) e clique em **Mostrar vias candidatas**. As linhas verdes têm evidência mais forte; ocre, intermediária; azul, revisão. É uma camada **somente visual** e opcional, sem alterar Undercover, veículos, missões ou a máscara do passeio livre.

O workflow **Driver 2 - Chicago PS1 R24 - Classificador de vias** executa a auditoria, testa o overlay no Chromium e guarda a lista completa por ID como artefato do GitHub Actions.

Próximas etapas: auditar manualmente os cruzamentos com diferenças de altura e distinguir ruas de pátios/calçadas; só então aprovar lote a lote para migração física ao Undercover.

## R25 — continuação leste/nordeste no Undercover

A R25 utiliza **três arestas consecutivas da rede superficial PS1**:
`1520 → 1437 → 1017`, conectadas pelos nós `1125 → 1100 → 1043 → 752`.
O nó 1125 coincide com a extremidade da R23. Seus pontos foram preservados em
[`reference-eastern-fork-r25.json`](reference-eastern-fork-r25.json);
o runtime utiliza a transformação R15, sem alterar as posições das missões.

O prolongamento curvo acrescenta cerca de **129 unidades da escala do clone** na região norte,
usa pavimento de 8 unidades, e passa pelo mesmo teste físico de água e colisores das vias
R15–R23. Ele aparece no minimapa do jogo.

**Limite da evidência:** a R24 classificou as arestas 1520 e 1017 como **revisar**,
e a 1437 como **intermediária**. Isso significa que o passeio original fornece
superfície pavimentada, mas a R25 é somente uma **adaptação dirigível**,
não um posicionamento homologado das faixas, calçadas ou dos níveis do PS1.
Não é correto contar esse trecho como nova rua original 100% certificada.

Reproduzir:
```sh
node --test tests/chicago-r25-eastern-fork.test.cjs
# Com Playwright, servidor local e Chromium:
node tests/chicago-r25-eastern-fork-browser.cjs
```

O workflow `Driver 2 - QA visual das quatro cidades` verifica a
dirigibilidade real, os limites da pista, os nove corredores anteriores,
a bifurcação R25 e a ausência de regressões nas quatro cidades.

## R26 — alturas verdadeiras dos 54 GLBs e conflitos de viadutos

A R26 deixa de presumir que duas superfícies próximas em X/Z se cruzam
fisicamente. `tools/chicago-r26-grade-audit.cjs` lê **1.544.872 triângulos**
dos **54 setores originais GLB** e amostra a altura Y apenas em triângulos
compatíveis com materiais de pavimento. Os resultados são cruzados com os
3.230 nós e 4.279 arestas da rede do PS1, sem alterar a malha da Chicago jogável.

Resultado reproduzido em 30/10/2026:

| Categoria de evidência | Quantidade |
| --- | ---: |
| Células com pavimento sobreposto em alturas diferentes | 596 |
| Nós com sobreposição de nível | 15 |
| Arestas com conflito de nível | 55 |
| Arestas com observação incompleta | 1.559 |
| Arestas com uma altura consistente observada | 2.665 |
| Arestas elegíveis após **duplo filtro** de altura R26 + largura/pavimento R24 | **218** |

**Atenção:** conflito de altura NÃO significa automaticamente ponte ou
viaduto. Rampas, materiais incompletos, calçadas, telhados baixos ou geometria
duplicada também podem causar conflitos. As 218 candidatas NÃO foram aprovadas
para o sistema de trânsito; necessitam inspeção do traçado real e das faixas.

Os segmentos R23 `1650` e `1557` apresentam conflito de altura.
A R25 apresenta observação de altura incompleta nas suas três arestas.
Ambas permanecem jogáveis como *adaptações* no Undercover, mas não têm
posicionamento ou nível PS1 certificados.

Para reproduzir o resultado:
```sh
node --test tests/chicago-r26-grade-guard.test.cjs
node tools/chicago-r26-grade-audit.cjs qa-artifacts/chicago-r26/grade-evidence.json
```

A lista completa de 4.279 arestas, as amostras de altura e as rotas R23/R25
estão no artefato do workflow **Driver 2 - Chicago R26 - Alturas e cruzamentos
originais PS1**. Uma versão resumida, `reference-grade-r26.json`, mantém
os 55 IDs conflitantes e os 15 nós sobrepostos disponíveis no GitHub Pages.

Na [visualização do mapa original](../chicago-original-preview.html), usar
**Mostrar conflitos de altura** para visualizar as arestas projetadas em
vermelho e os nós em laranja. O overlay é somente diagnóstico, não cria
colisores, não troca missões e não conecta ruas de alturas diferentes.

## R27 — revisão individual dos 55 alertas de desnível do PS1

A nova auditoria usa **as alturas reais dos 54 setores GLB (1.544.872 triângulos)**
para separar alertas anteriores da R26 que não podiam ser interpretados automaticamente
como viadutos. Usa uma medida da persistência da diferença de alturas no entorno,
comparando o material pavimentado em diversas células da grade original.

| Resultado reproduzível da R27 | Arestas |
| --- | ---: |
| Evidência persistente de grande separação entre camadas (diferença superior a 0,45 OBJ e repetição em células próximas) | **0** |
| Sobreposição pontual ou ambígua | **50** |
| Conflito projetado herdado de nó sem sobreposição direta na amostra da aresta | **5** |
| **Total analisado** | **55** |

**Interpretação cuidadosa:** o resultado de 0 não exclui a existência de viadutos
no jogo original — o limiar de 0,45 OBJ é apenas um filtro conservador.
Uma diferença menor pode ser uma rampa, uma calçada elevada, geometria
sobreposta, uma ponte baixa ou um artefato de extração. Por isso, **nenhum dos
55 casos foi automaticamente liberado para o trânsito ou certificado como
cruzamento no mesmo nível**.

A R23 permaneceu dirigível no Undercover, mas suas arestas **1650** e **1557**
ainda têm sobreposições locais de **0,1561** e **0,1323** unidades OBJ,
respectivamente, que não comprovam a existência de viadutos. As três arestas
da R25 permanecem com cobertura incompleta de altura. Nenhuma missão
foi migrada nem foram alterados veículos, colisões ou as outras cidades.

O arquivo [`reference-grade-r27.json`](reference-grade-r27.json) contém os
55 IDs classificados, diferenças de alturas e amostras específicas.
Na [visualização 3D da Chicago original](../chicago-original-preview.html),
usar **Revisar alertas R27**: laranja = sobreposições locais, roxo =
alertas só no nó. O controle é apenas diagnóstico.

Reprodução:
```sh
node --test tests/chicago-r27-height-overlap.test.cjs
node tools/chicago-r27-review-conflicts.cjs qa-artifacts/chicago-r27/height-review.json
```

O workflow `Driver 2 - Chicago R27 - Revisão dos 55 cruzamentos PS1` salva
o JSON detalhado, a revisão compacta e a captura de tela do Chromium. O passo
seguinte será analisar altura e textura de cada segmento de interseção,
com atenção à conectividade real de rampas e pontes, antes da migração física.

## R28 — grafo de rotas 3D separado por níveis, sem junções falsas

A R28 cria um **roteador experimental e isolado** para a Chicago original.
Ele só conecta arestas que compartilham o mesmo **ID de nó da rede PS1**:
uma interseção visual de dois segmentos em X/Z não é suficiente. Além disso,
usa os dados de pavimento da R24 e as alturas dos GLBs da R26. Nenhuma ligação
pode passar por nó com observação de altura empilhada, altura ausente, conflito
de grade ou inclinação acima do limite conservador de 8,5%.

Resultados da auditoria sobre **4.279 arestas / 3.230 nós / 54 GLBs**:

| Decisão automática | Arestas |
| --- | ---: |
| Pavimento ou largura insuficiente | 3.954 |
| Conflito, ausência ou ambiguidade de nível | 107 |
| Inclinação acima do limite R28 | 2 |
| **Candidatas restantes para inspeção de conectividade** | **216** |

As 216 candidatas formam uma rede muito fragmentada. O componente com maior
comprimento disponível contém apenas **duas arestas conectadas** (17,126
unidades OBJ). Logo, **a rede NÃO deve ser utilizada como rota de trânsito
do jogo**. A R23 tem apenas as arestas 1822 e 1777 elegíveis; a R25 não
tem arestas elegíveis pelos critérios conservadores R28, embora ambas
continuem jogáveis no Undercover como adaptações.

Reproduzir com Node 22:

```sh
node --test tests/chicago-r28-layered-routes.test.cjs
node tools/chicago-r28-layered-route-audit.cjs qa-artifacts/chicago-r28/layered-review-routes.json
```

O arquivo [`reference-layered-r28.json`](reference-layered-r28.json)
guarda os **216 IDs** e os exemplos de rotas. Na
[visualização da Chicago original](../chicago-original-preview.html),
clique **Ver rotas por nível R28** para ver essas candidatas em verde-água
e um exemplo conectado em amarelo.

Este é um grafo de diagnóstico, **não um sistema de tráfego integrado**:
não corrige automaticamente as faixas, não atribui sentidos únicos,
não modifica as missões e não homologa rampas ou viadutos. A próxima
etapa útil é investigar os limites de altura por aresta com rastros
visuais e validar um corredor contínuo individualmente antes de
inseri-lo no mapa jogável.
