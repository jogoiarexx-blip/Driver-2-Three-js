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
