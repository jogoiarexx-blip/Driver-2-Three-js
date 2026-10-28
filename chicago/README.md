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
