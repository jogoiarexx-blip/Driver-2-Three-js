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
