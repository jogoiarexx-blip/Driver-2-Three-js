# Auditoria transversal R67 — Driver 2 Three.js

**Data:** 02/11/2026  
**Branch:** `fix/r67-repository-stability-gpu-loading`  
**Escopo examinado:** motor, construção/streaming de cidades, limpeza GPU, frota GLB, carregamento, menu, controles, garagem/save, tráfego, QA e organização do projeto.  
**Limite:** esta revisão não equivale à inspeção individual de cada malha ou ao encerramento do mapa Chicago 1:1. Manter os status da auditoria mestra e indicar níveis de evidência.

## Problemas concretos encontrados e correções

| Prioridade | Problema E1 (código anterior) | Mudança implementada | Risco mitigado |
| --- | --- | --- | --- |
| P0/PERF-06 | `CityBuilder.resetCityForPreset` usava `traverse(callback)` com `return` ao encontrar `cc0SharedAsset`; o `return` **não cancela a visita aos filhos**. Um root compartilhado como o barco podia ter suas texturas/meshes descartadas enquanto o template ainda estava em cache. | Delegar ao `GPUResourceUtils.disposeSubtree`, que propaga a proteção aos descendentes. Fallback de teste também percorre a árvore com flag herdada. | Corrupção de GLB, textura desaparecendo após trocar cidade e uso desnecessário de GPU. |
| P0/GAME-07 | `loadCityPresetProgressive` não verificava se outro carregamento havia substituído o mapa enquanto aguardava o próximo frame. | Snapshot `buildSequence` por geração; aborta com erro explícito antes de continuar/validar `ready` se a cidade mudou. | Construção antiga contaminando mundo novo após cancelamento/troca. |
| P1/CAR-05 | `loadLocalGLB` revogava a URL temporária apenas em sucesso; `onError` não liberava; um GLB inválido podia ser anunciado como aplicado mesmo quando `applyCC0Model` falhava. | Revogação em sucesso, erro e exceções; validação explícita `.glb`, indicação de falha sem marcar `_userCustomModel`, nome mantido se rejeitado. O loader de URL externa também evita falso sucesso. | Blob URL retida e feedback enganoso após importação. |
| P1/PERF-07 | O motor chamava `renderer.setSize` antes de `setPixelRatio`, podendo alocar/reconfigurar o framebuffer duas vezes na largada. | DPR definido antes do primeiro `setSize`, mantendo os limites existentes de qualidade. | Menor custo de inicialização sem alterar texturas e gráficos. |
| P1/ARCH-06 | Checkbox `models=false` chamava `FreeVehicleAssets.toggle()`, que sempre ativa os GLBs e limpa o cache. Repetir o menu com o checkbox desmarcado podia disparar re-download/redecorar. | Checkbox tem semântica clara de **pré-carregar GLBs** (desmarcado: carregar durante a partida), nunca trocar para carros de caixas. `applySettings` só reabilita uma biblioteca realmente inativa sem invocar `toggle`. | Tráfego 3D consistente, menos operações de cache e downloads involuntários. |
| P1/PERF-01 | O laço `animate()` seguia renderizando, atualizando física e IA mesmo com a aba oculta, desperdiçando CPU/GPU e potencialmente desregulando o Δt após retorno. | Quando `document.hidden` estiver ativo, pula GPU/física/IA e rebasa `lastTime`, voltando normalmente quando visível. | Menos trabalho em abas minimizadas e nenhuma simulação acumulada no retorno. |
| P1/ARCH-11 | Links locais do `index.html` e ordem de dependências não tinham um gate R67 dedicado. | Teste Node confere todos os caminhos locais, duplicações e ordem de `gpu-resources` → `city-builder` → motor. Versionamento de URLs dos 3 scripts alterados evita receber JS antigo por cache do navegador. | Erro 404 de script, carregamento duplicado ou cliente desatualizado após Pages. |

## Arquitetura e custos que permanecem em aberto

A auditoria mestra anterior registra **~535 arquivos**, **~139 módulos JavaScript em `js/`**, **~149 scripts locais no HTML** e um volume expressivo de GLBs, sobretudo o pacote visual original Chicago. Esses números são uma **referência histórica da auditoria**: validar o inventário e os bytes atuais antes de usar como medição nova.

- **MAP-05/MAP-06/MAP-07:** Chicago ainda precisa de rede de ruas por altura, inventário de setores originais, continuidade física e integração de missões. Não declarar 1:1 com o PS1.
- **GAME-06/GAME-09/P0-10:** testes por lógica e navegador não substituem completar todas as missões com jogador humano, checkpoints, save/reload e fail/retry em hardware real.
- **CAR-05 a CAR-09:** auditar rodas, direção, pivôs de portas, GLBs monolíticos e ciclos prolongados de entrar/sair; as limusines reutilizam GLB existente.
- **NPC-05 a NPC-09:** testar animações/escala/colisões de crianças, adultos e cães na sessão real.
- **VIS-05 a VIS-09:** fachadas e silhueta Chicago, LOD dos prédios próximos, iluminação e fotos do mesmo ponto em dia/noite/chuva.
- **PERF-01 a PERF-06:** medir FPS p95, quadros longos, VRAM, `renderer.info.memory` e trânsito com GLBs de grande porte após múltiplas trocas de cidade. É prematuro afirmar melhoria percentual de FPS ou ausência de leak apenas por teste de descartes.
- **ARCH-01/02/08:** dividir gradualmente os dois arquivos gigantes e consolidar checks visuais; não migrar arquitetura, servidor, build ou saves num único PR.

## Testes e rastreabilidade

- **E1:** código anterior lido diretamente no GitHub, com defeitos acima reproduzíveis por controle de fluxo.
- **E2:** `tests/r67-city-lifecycle.test.cjs`, `tests/r67-glb-import-lifecycle.test.cjs`, `tests/r67-model-preload-setting.test.cjs`, `tests/r67-entrypoint-integrity.test.cjs`; mais `node --test tests/*.test.cjs` em Node 22 e 24.
- **E3:** verificar build/boot real no Chromium, mudança de cidade, GLB de barco retornando a Chicago com material íntegro, carro do jogador, trânsito/van e save. Também seguir os jobs Chicago/regressões e R66.
- **E4/E5:** jogador humano, Android e GPU real ainda pendentes, inclusive se o CI concluir com sucesso.

## Critério de integração

Só mesclar após corrigir falhas novas da suíte, preservar R66 e documentar o resultado de cada workflow. Cache-busting não é prova de deploy; registrar run do Pages após a integração.
