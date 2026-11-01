# DRIVER 2 THREE.JS — AUDITORIA MESTRA E CHECKLIST VIVO

**Estado da auditoria:** 31/10/2026 • **base analisada:** main, commit 82323c47189cd7f99bc8ae11e28ceea22f200f2d (R58).  
**Documento canônico e permanente:** AUDITORIA-MESTRA-DRIVER2.md, raiz do repositório.  
**Escopo:** Undercover, Passeio Livre, Chicago PS1 experimental, Havana, Las Vegas, Rio, campanha, IA, colisões, GLBs, animações, renderização, áudio, desempenho, mobile, saves, QA, arquitetura e publicação.

> **REGRA DE USO:** A partir de cada revisão, consultar os P0 abertos, escolher uma causa estrutural, reproduzir ANTES, aplicar correção, executar testes DEPOIS, registrar evidência e atualizar este arquivo no mesmo commit. Não trocar [ ] por [x] com base apenas em código presente ou teste simulado. Preservar tarefas concluídas como histórico, não simplesmente apagá-las.

### R61 — Sprint P0 NPC-03 — 31/10/2026 (E2/E3 em validação)

**Base:** main `f49e297` R60. Implementação no [PR #36](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/36).

- **Causa identificada 1 — ciclo de vida GLB:** `DriverUploadedPedestrianCrowd.detach()` só removia o contêiner e limpava `AnimationMixer`. Depois o gerenciador chamava `GPUResourceUtils.disposeSubtree` no grupo já sem os clones; os `Skeleton` individuais com possíveis `boneTexture` não recebiam `dispose()`. R61 agora descarta exatamente uma vez os esqueletos **clonados**, conservando geometria, material, textura e rigs das fontes compartilhadas.
- **Causa identificada 2 — policial com rig errado:** em `attachOfficer()`, fallback era `available()[0]`. Como o loader prioriza crianças e cães, antes do adulto GLB carregar um oficial de bloqueio podia virar criança/cão. R61 filtra `species==='adult'` e só vincula quando houver modelo adulto. O rig masculino continua prioritário quando presente.
- **E2 novo:** testes de 28 vagas × quatro gerações (trocas de mapa), descarte de skeletons sem duplicação, fonte preservada, policiais sem crianças/cães na fila, adulto alternativo e masculino; validação total Node 22/24 via GitHub Actions.
- **E3 planejado:** executar `visual-qa.yml` integral porque agora o workflow inclui `driver-uploaded-pedestrian-crowd.js` nos caminhos de acionamento. Não alegar ausência de vazamento após horas no Android sem medição E5.
- **Não alterar:** as alturas específicas dos três cães, dos dois modelos infantis, a representação das 28 vagas, as missões ou colisores de Chicago.
- **Pendências independentes:** MAP-05, CAR-04, P0-10 (E4 humano e E5 hardware) permanecem abertos; NPC-03 só deve ser marcado concluído após Node e smoke visual sem regressões.

### R60 — Evidência visual integral confirmada

- **E3 workflow completo APROVADO:** [GitHub Actions #41261882349](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41261882349), **55 etapas SUCCESS**; sequência de Chicago, Undercover, R45, rios, pontes, dez modos e smoke das quatro cidades.
- **E3 smoke separado:** [#41261882213](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41261882213) SUCCESS.
- **E3 Game Forge teclado/save/rampa:** [#41262121040](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41262121040) SUCCESS, oito etapas, cinco capturas/JSON após correção da câmera física.
- **P0-07 e P0-09 certificados na cobertura automatizada disponível; P0-10 NÃO certificado em E4/E5.** Não afirmar 15/15 missões humanas, 43 carros em tráfego real simultâneo ou desempenho mobile comprovado.

### R60 — P0 Playtest E3 (01/11/2026, revisão em PR #35)

**Base anterior:** main R59 `58e664a`. **Comparativo real:** R59 942/942 testes Node e dois P0 não certificados em browser; R60 944/944 em **Node 22 e Node 24** ([Actions #41261823994](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41261823994)). Novo [playtest Game Forge #41261823989](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41261823989) **SUCCESS** em Chromium real, com passos/screenshot/JSON.

- **P0-07 [TREM] E2 + E3 direcionado APROVADO:** 23 passos físicos no mesmo motor do player, carro em `(-14,-218)` avançou até `z=-251,27`, altura máxima `0`, nenhum colisor bloqueante, água ou dano na estação. Travessia não prova todas as bordas, cruzamentos ou missões completas.
- **GAME-09 [SAVE] BUG P0 REAL CORRIGIDO:** `DriverHomeSave.valid()` restringia a 32 veículos, rejeitando saves legítimos com 43 carros. R60 limita a 128 e testa 43/129. Segundo defeito: `loadHomeGame()` começava com 42 carros e Wrigley era criado posteriormente; salvamento do 43º carro não era aplicado. Agora a restauração aguarda esse spawn e reaplica dano/estado, com teste Node de posição/dano/índice do jogador e prova no navegador de dano **33** no carro tardio após reload. Sem modificar os controles nem acelerar a física.
- **Playtest baseado em Game Forge, evidências estilo Claude Code Game Studios:** `tests/playtest-gameforge-p0.cjs` inicia menu de verdade, dirige com W, vira com D, sai com E, caminha com W, grava e recarrega `localStorage`, repete a rampa via física e gera screenshots + JSON de etapas, duração, estado, erros e falhas. [Protocolo detalhado](docs/QA-PLAYTEST-P0-R60.md).
- **P0-09 [VISUAL] em certificação integral:** R59 CI vermelho devido à heurística de FPS de SwiftShader que equiparava 6 frames lentos a renderização travada; R60 amplia orçamento de amostra para 14 s, tolera FPS baixo registrando insuficiência e só classifica ausência prolongada de frames como erro. Aprovou o playtest direcionado; workflow visual completo deve concluir antes de marcar P0-09 como finalizado.
- **P0-10 [RELEASE] AINDA ABERTO:** evidência E3 com teclas é automatizada, **não jogabilidade humana E4**, nem desempenho E5 de GPU/Android ou campanha 15/15. Não rotular jogo de `100% COMPLETO` ou `ESTÁVEL CERTIFICADO` apenas com Node/Pages.
- **Escopo não coberto nesta revisão:** 43 veículos simultâneos em tráfego real, 15 missões humanas completas, Android, FPS em GPU real, Gamepads, cobertura de todos os níveis do PS1.

### R59 — 31/10/2026 — Sprint A P0 (Node e smoke das quatro cidades aprovados)

**Base:** main a7d501a7; revisão preparada em branch `fix/driver2-r59-p0-qa`. Branch de integração `fix/driver2-r59-p0-qa`, [PR #34](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/34). Evidência E2 confirmada para Node 22 e 24; E3/E4/E5 continuam condicionadas a teste específico.

- **ANTES (E2 remoto):** execução 41253703197 — 920/940 testes passaram, 20 falharam. Execução visual 41253690079 interrompida em crosswalk (7 instâncias de batch versus 5 esperadas).
- **P0-02:** mock R52 atualizado com `CylinderGeometry`, que o mapa já usa de verdade.
- **P0-03:** `DriverArcadePhysics` exporta a mesma classe estática para Node CommonJS, mantendo o contrato global no browser. Replays R56/R57 deixam de falhar antes de rodar por falta da API.
- **P0-04:** fechar a porta fixa o ângulo em `+0`, eliminando `-0` sem mexer na curva de abertura nem em ângulos válidos.
- **P0-05:** os testes passam a inspecionar *sete batches efetivos*: uma zebra, quatro componentes instanciados dos postes e duas placas regionais; verificam 162 registros destrutíveis e ausência de sombras dinâmicas.
- **P0-06:** fixture de 28 vagas separa os 26 adultos das duas vagas infantis reservadas; novo teste cobre GLBs infantis indisponíveis e chegada posterior, sem criar crianças falsas a partir de adultos.
- **P0-07:** teste da estação passa a verificar a política atual: rampa elevada pedonal, carro continua no asfalto inferior sem impulso vertical e com deslocamento; teste independente preserva progressão de altura pedonal.
- **P0-08:** teste de ordem/cache usa a chave válida R58 do Tanner, sem reverter o cache-busting em produção.
- **P0-01 CONCLUÍDO E2:** 942/942 testes Node 22 e 942/942 Node 24, ambos **SUCCESS** no [workflow 41260600150](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41260600150). Comparativo: 920/940 e 20 falhas (R58) → 942/942 e 0 falhas (R59), incluindo regressão de saída do carro a 4 FPS.
- **P0-09 AINDA ABERTO:** primeira sequência Chromium R59 [41258524559](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41258524559) avançou além da pavimentação e verificou GLBs/cães, mas identificou teste R22 com contagem antiga de 21 ruas para radar que agora contém 36 (a direção física pelo acesso teve 0 água, 0 colisões, 0 danos). Corrigido **validando IDs PS1, acessos, integridade e ausência de duplicação**, sem subtrair ruas; reexecução [41258717291](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41258717291) avançou até R45 e encontrou falso congestionamento provocado por 35 NPCs congelados fora do replay; correção e evidência na seção seguinte.
- **P0-09 / R45 E3 PARCIAL APROVADO:** [workflow focado 41259174215](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41259174215): 8/8 NPCs R43/R44/R48 percorreram entre 462 e 818 unidades em 4200 frames cada; cada um fez 1 a 2 voltas, sem água, bloqueios, danos ou parada prolongada. O teste anterior de 2 NPCs passava 8 veículos mas mantinha os outros 35 congelados como falsos obstáculos; o novo replay passa à IA apenas os 8 veículos efetivamente integrados fisicamente, sem esconder colisões entre eles. A frota de 43 carros simultâneos **não** foi reproduzida; execução [41259195099](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41259195099) avançou até o último smoke, revelando transição lenta; o smoke isolado subsequente passou, mas a nova [execução integral 41260596484](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41260596484) permanece pendente de resultado.
- **P0-10 AINDA ABERTO:** E4 gameplay por controles, ciclo save→reload e E5 FPS/memória/Android não foram homologados; publicação ≠ estabilidade.
- **P0 extra — saída do carro em baixa taxa de quadros (motor):** antes, o temporizador das dobradiças/entrada de Tanner consumia o mesmo delta físico de 50 ms por frame, alongando uma animação de 1,2 s quando o WebGL rodava lentamente. Depois, `driver2-game-engine.js` fornece `transitionDt` de relógio real limitado a 250 ms para `DriverVehicleMount` e `DriverPoliceDoorRig`, sem alterar o passo de física. Teste novo simula 4 FPS e confirma transição para `on_foot`.
- **E3 smoke isolado APROVADO:** [execução 41260600145](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41260600145) confirmou entrar/sair, caminhada, interiores e cenas em Chicago/Havana/Las Vegas/Rio. Corrigidos dois falsos bloqueios de harness: caminhada não deveria ser exigida em apenas 400 ms sem um frame, e amostragem de FPS em SwiftShader não deve aguardar incondicionalmente 90 frames; agora mede movimento efetivo e até 10 segundos de frames, registra amostras reais e falha se o renderizador parar.
- **E5 NÃO CERTIFICADO:** amostras headless software Chromium: Chicago 1,6 FPS (1208 draw calls), Havana 1,7, Vegas 1,3, Rio 1,6. Esses números indicam uma limitação do renderizador por software e **não** medem o jogo em GPU/Android reais. Há 1,4–1,9 milhão de triângulos amostrados nesse ambiente; medir hardware real e otimizar LOD/draw calls continua aberto.
- **Impacto esperado:** expor falhas físicas que estavam mascaradas pelos erros de import; preservar as quatro cidades, IA, 28 vagas, carros e campanha. FPS, memória, partidas completas e Android: **não medidos** nesta revisão.

## 0. Legenda e critérios de evidência

- **[x] IMPLEMENTADO** = há evidência concreta no código/arquivo, mas isso **não** significa funcionalidade plenamente validada.
- **[ ] PENDENTE** = requisito incompleto, falha identificada ou validação não feita.
- **[ ] CERTIFICAR** = a implementação existe, porém ainda necessita prova exigida.
- **P0 bloqueante**, **P1 prioridade alta**, **P2 evolução planejada**, **P3 acabamento**.
- **E0 inventário:** arquivo existe; **E1 estático:** código/dados inspecionados; **E2 teste lógico:** Node concluído com sucesso; **E3 teste visual:** Chromium e screenshots/trace; **E4 jogabilidade:** percurso real por controles; **E5 performance:** FPS, memória, rede e dispositivo.
- A cada release registrar SHA, data, modo, cidade, hardware/viewport, FPS p50/p95, travamentos, save reaberto, rotas e eventos realmente jogados. Sem esses dados: **NÃO CERTIFICADO**.
- Dados de tamanho são **bytes no Git**, não tamanho inicial transferido por navegador nem memória GPU. Cenários sintéticos não representam automaticamente a cidade montada inteira.

## 1. Resumo executivo — onde estamos

**Veredito:** protótipo open-world robusto em recursos e regressões, mas **não jogo completo nem mapa Chicago 1:1 certificado**. Conservar o que funciona; QA lógico R59 passou 942/942 no Node 22 e 24, enquanto o QA visual e a integração do Chicago original continuam eixos prioritários. Refatorar os arquivos de motor gigantes **gradualmente**, sem reescrever o jogo inteiro.

### Indicadores apurados no repositório

| Indicador | Evidência | Interpretação |
| --- | ---: | --- |
| Entradas na árvore Git (incluindo diretórios) | 567 | organização cresceu |
| Arquivos versionados | 535 | base grande para projeto estático |
| Tamanho bruto dos arquivos | 385,93 MiB | não é tamanho de download inicial |
| JS próprios (js/) | 139 arquivos / 1,31 MiB | boa separação parcial |
| Arquivos na pasta tests/ | 184 | 128 terminam em .test.cjs |
| Workflows GitHub | 27 | automação extensa, manutenção complexa |
| Assets (assets/) | 279,26 MiB | maior oportunidade de compressão/streaming |
| Chicago (chicago/) | 103,67 MiB | 54 GLBs visuais somam 100,97 MiB |
| Motor principal | js/engine/driver2-game-engine.js ~199 KiB | **acoplamento excessivo** |
| Construção das cidades | js/world/city-builder.js ~120 KiB | outro gargalo estrutural |
| Scripts HTML | 152, dos quais 149 locais | todos os 149 caminhos locais consultados existem; custo de parse/ordem |
| Campanha declarada | 8 Chicago + 1 Havana + 3 Vegas + 3 Rio | **15 etapas descritas no fluxo**, não 15 partidas certificadas |
| Original PS1 visual | 54 GLBs, 1.544.872 triângulos | visual presente, sem colisores/ruas de produção homologados |
| QA lógica R58 → R59 | **920/940 → 942/942** | **Node 22/24 verde** — run 41260600150, R59 |
| QA visual R58 → R59 | R58: pavimentação; primeira R59: radar R22 antigo | Reexecução Chromium 41258717291 **a verificar** |
| Deploy Pages para R58 | **sucesso** no SHA 82323c47189c | publicação ≠ QA ou jogabilidade |

Fontes diretas: GitHub Git tree main, README.md, chicago/manifest.json, chicago/drive-mask.json, chicago/ground-survey.json, js/gameplay/campaign-flow.js, .github/workflows/*.yml.  
Links de referência dos workflows:  
- QA geral (920/940): https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41253703197  
- QA de GLBs/veículos: https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41253703198  
- QA visual: https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41253690079  
- Deploy Pages concluído (R58): https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41253743232

### Matriz honesta de maturidade

| Subsistema | O que está bom | O que não está certificado / problema real | Avaliação |
| --- | --- | --- | --- |
| Motor de direção | física arcade, ré, drift, danos por zona, replay de IA | missões reais, choques em rampas, gameplay prolongado | **Parcial** |
| Chicago Undercover | pontes, bairros físicos, ruas R15–R57, circuitos e tráfego misto | grande parte inferida/adaptada, conexões/nivelamentos e bairros restantes | **Incompleto** |
| Chicago original PS1 | pacote visual, atlas, máscara experimental e viewer dirigível | sem rede 3D completa, colisões, missões, certificação de ruas | **Pesquisa/experimental** |
| Campanha | fluxo por capítulos, 15 entradas declaradas, checkpoints | concluir todas as missões jogando, falha/retry e saves reais | **Parcial** |
| Polícia e tráfego | sinais, busca, linha de visão, bloqueios, rotas civis | batidas policiais longas e QA da estação ainda não homologados | **Parcial** |
| Carros/moto | GLBs, física, portas R58, animações Tanner/IK | portas e rodas de GLBs monolíticos, moto visual e regressão Node | **Parcial** |
| Pedestres/animais | variedade GLB, cães/crianças, calçadas, ações | escalas/rigs reais, navegação e 28 vagas sem QA verde | **Parcial** |
| Gráficos | ciclo dia/noite, sol/lua, chuva, materiais e luzes | z-fighting, iluminação uniforme, serrilhado GLB, custo GPU medido | **Parcial** |
| LOD/desempenho | LOD por distrito, instancing, caches e pré-load | budgets de GLB, FPS p95, picos de GPU/memória, mobile fraco | **Parcial** |
| HUD/mapa/controles | radar, zoom, objetivos, controles mobile, F8 | testes em telas reais, contraste e poluição visual | **Parcial** |
| Áudio | motor sintético, efeitos e feedback | velocidade/volume/loop, aceleração, áudio mobile e repetição | **Pendente de homologação** |
| Save/progresso | localStorage e versão/validação | rodada completa save→reload→retomar em cada missão/cidade | **Parcial** |
| Arquitetura | muitos módulos já separados | motor ~199 KiB, CityBuilder 120 KiB, dependências globais, 149 JS | **Dívida alta** |
| QA/CI | 941/941 de lógica em Node 22/24 | QA visual E3, direção real E4 e dispositivos E5 ainda sem certificação completa | **Parcial — P0** |

---

## 2. P0 — CONDIÇÕES BLOQUEANTES ANTES DE NOVA EXPANSÃO

**Regra:** correção de regressão comprovada tem preferência sobre novos edifícios, texturas, veículos e missões.

- [x] **P0-01 [QA] RESTABELECER A SUÍTE VERDE [E2 — Node 22/24 942/942, run 41260600150]:** executar node --test tests/*.test.cjs em Node 22/24, classificar separadamente falha do produto x falha de teste/mock x expectativa obsoleta; corrigir sem simplesmente apagar as asserções. Evidência obrigatória: workflow Actions SUCCESS e total recontado.
- [x] **P0-02 [R52/Three.js] [E2]** mocks usados nos testes do distrito não possuem THREE.CylinderGeometry (5 cenários da R52 falham). Corrigir ambiente de testes e conferir novamente as ruas/colliders.
- [x] **P0-03 [R56/R57/física] [E2]** testes importam um Physics.update que não existe na forma exportada em CommonJS (5 casos). Tornar harness compatível com API real e repetir os replays em Node. A aprovação anterior em contexto V8 concatenado não é certificação Node.
- [x] **P0-04 [R58] [E2]** asserção da porta compara 0 com -0 via assert.strictEqual: classificar se é só representação numérica, corrigir no teste ou na saída sem mascarar ângulos não nulos.
- [x] **P0-05 [PAVIMENTO E MOBILIÁRIO] [E2]** corrigir/investigar testes de quantidade/instâncias de faixas e postes, travessias na água e preservação de elementos destrutíveis. Não “atualizar números esperados” sem medir a cena montada.
- [x] **P0-06 [PEDESTRES GLB] [E2]** três falhas de simulação das 28 vagas, contingência de carregamento GLB e limpeza de clones/GPU: diferenciar teste desatualizado de vazamento real.
- [x] **P0-07 [TREM] [E2+E3, run 41261823989]** rampa pedonal e passagem rodoviária inferior verificadas no motor real: deslocamento até z=-251,27, sem salto, bloqueio, água nem dano. Limites e restantes trechos permanecem sob CAR-04/MAP-05.
- [x] **P0-08 [CACHE] [E2]** teste antigo procura versão swim-retarget-r1 do Tanner; conferir se só o cache-busting R58 mudou ou se há regressão de ordem/retargeting.
- [x] **P0-09 [VISUAL] [E3 — 55 passos SUCCESS, run 41261882349]** workflow visual integral concluiu incluindo Chicago R22–R45, Goose Island, rios/pontes, dez modos e quatro cidades. O crosswalk foi corrigido na R59; a R60 deixou de tratar seis frames lentos no SwiftShader como crash. Baixo FPS permanece problema de medição E5, não certificação de GPU/Android.
- [ ] **P0-10 [RELEASE]** R60: lógica 944/944, playtest E3 com teclado/save/reload e workflow visual integral (55 etapas) aprovados. **Ainda faltam** missões/campanha por jogador humano E4, desempenho/memória E5 em GPU real/Android, mapa/setores P0 remanescentes e critérios de release antes do selo ESTÁVEL.

### Causas observadas nos logs (não confundir hipóteses com fatos)
- O job de lógica mais recente deste levantamento registrou 20 falhas, incluindo CylinderGeometry ausente, Physics.update indisponível, comparação -0/0, expectativas de contagem de faixas/postes, clima/rig e pedestrian GLB.
- O QA visual parou em crosswalks/pavimentação; **não há comprovação de que o restante dos passos posteriores daquele workflow passou**.
- O job de veículos enviados também falhou porque executa toda a suíte Node; isso **não significa necessariamente** que o GLB da moto ou do caminhão não carrega no jogo.
- Os runs acima são anteriores ou contemporâneos ao commit R58; a documentação posterior não disparou automaticamente a suíte principal. É obrigatório reexecutar após correções.

**Critério P0 concluído:** 0 falhas no QA Node, visual smoke com trace/screenshot em Chrome, bugs reais reproduzidos/corrigidos, sem regressão de campanha ou saves.

---

## 3. Chicago — o quanto falta de verdade?

**NÃO há percentual numérico defensável.** O mapa de referência visual e a cidade Undercover atual são representações distintas; misturar “54 chunks presentes”, “trechos procedurais” e “ruas PS1 certificadas” em uma só porcentagem seria enganoso.

### Evidência de escala
- O pacote fornecido tem **54 GLBs visuais / 1.544.872 triângulos / atlas 2048**; manifesto informa visualOnly=true, collisionReady=false, roadTopologyReady=false. Duas páginas de material **128/158** faltam e há 79 grupos de faces afetados.
- Bounds originais OBJ: X **-111,975 a -9,7521**, Z **32,0196 a 223,507**. Calibração R3, escala 5,1: projeção **521,337 × 976,586** unidades. Grade Undercover legada: **640 × 640**; proporção/dimensões diferentes. Esse comparativo NÃO representa porcentagem concluída.
- A análise ground-survey identifica **20 componentes de superfícies**, 79.395 pixels rastrados como piso e preenchimento 25,153%; também inclui calçadas, pátios e telhados baixos. laneNetworkCertified=false; vehicleCollisionCertified=false; playableCoveragePercent=null.
- A drive-mask do Passeio Livre PS1 tem 49.387 pixels seguros e componente maior com 37.513, mas groundCertified=false, roadCertified=false, missionLocationsMigrated=false.
- A referência de ruas tem **4.279 arestas candidatas**, não 4.279 vias aprovadas. Auditoria R29 obteve **263 arestas candidatas à revisão**, não certificação do sistema de trânsito.
- Undercover possui circuitos adaptados com ensaios e regiões físicas R15–R57; ainda há trechos de bairro, margens e missões que usam coordenadas adaptadas, não originais. O viewer PS1 e a cidade dirigível experimental não substituem automaticamente o mundo Undercover.

### Checklist da conclusão de Chicago

- [x] **MAP-01 [E1]** 54 chunks GLB do pacote de referência + atlas carregáveis como recursos do repositório.
- [x] **MAP-02 [E1]** arquivos de máscara, altura, classificação e grafo de fonte preservados.
- [x] **MAP-03 [E1/E2 histórico]** ruas adaptadas e dois circuitos R43/R44 documentados com testes direcionados.
- [x] **MAP-04 [E1]** bairros adicionais, estádio/Wrigley, píer/Navy Pier, lago, canais, ponte e trem possuem implementação.
- [ ] **MAP-05 P0** certificar níveis e colisões das ruas que já estão no Undercover; eliminar água invisível, cruzamentos sem piso e rampas falsas.
- [ ] **MAP-06 P1** montar um **inventário por setor PS1**: presente no original, desenhado, piso dirigível, colisão, água, semáforos, pedestres, trânsito, missão e teste E4. Registrar contagem real de setores homologados.
- [ ] **MAP-07 P1** construir ruas **contínuas** faltantes, com calçadas, acessos e lotes, em vez de apenas prolongar o radar ou o envelope do mundo.
- [ ] **MAP-08 P1** validar topologia do rio, canais e todas as travessias por altura; cruzamento elevado só conecta no mesmo nível.
- [ ] **MAP-09 P1** completar a ocupação dos bairros e sua distribuição correta: quarteirões, densidade, edifícios, garagens, parques, postos e depósitos.
- [ ] **MAP-10 P1** reconstruir píer e áreas portuárias/estádio com acessos reais, barreiras e colisores verificados.
- [ ] **MAP-11 P1** mapear coordenadas/escala com transformação documentada, sem esticar carros, pedestres, pontes ou esconder trechos improvisados.
- [ ] **MAP-12 P1** migrar objetivos e rotas das **oito missões Chicago** de uma vez por vez, somente após a rua de destino ser certificada.
- [ ] **MAP-13 P1** completar grafo dirigível, mão de direção, faixas e trânsito civil/policial nas ruas já construídas.
- [ ] **MAP-14 P1** minmapa/radar igual ao terreno realmente dirigível; nunca usar rua visual não aberta como trajeto.
- [ ] **MAP-15 P1** percorrer cada conexão em ambos os sentidos por física real, com roda e carroceria no pavimento, zero bloqueio/água/dano falso.
- [ ] **MAP-16 P1** criar roteiro de estrada de 30–60 minutos ligando principais bairros e pontos turísticos; salvar trace e distância.
- [ ] **MAP-17 P2** comparar texturas, fachadas, silhueta urbana e largura de ruas com referência da geometria original.
- [ ] **MAP-18 CERTIFICAR** publicar cobertura territorial jogável com numerador/denominador auditados por setor, antes de declarar “Chicago 100%”.
- [ ] **MAP-19 CERTIFICAR** 8/8 missões Chicago completas no mapa revisado, sem teleportes, com fail/retry e save.
- [ ] **MAP-20 CERTIFICAR** nenhuma dependência de ruas decorativas, escalas inferidas sem nota, níveis falsamente conectados ou colisores invisíveis.

**Sequência recomendada:** P0 dos testes → rede de ruas seguras → acesso aos bairros/monumentos → paisagem/lotes → posição das missões → QA de campanha → fidelidade visual. **Não** há base para prometer um prazo ou porcentagem exata neste momento.

---

## 4. Gameplay e campanha

### O que já existe
- [x] **GAME-01** quatro presets: Chicago, Havana, Las Vegas e Rio.
- [x] **GAME-02** modos Passeio Livre, Undercover e atividades arcade conforme menus/código.
- [x] **GAME-03** fluxo de capítulos: **8 Chicago, 1 Havana, 3 Vegas, 3 Rio**; checkpoints de capítulo e derrota vs. vitória.
- [x] **GAME-04** sistema de missão com objetivos, marcadores, perseguições, perseguição de trem, fuga, roubo, C4, garagem e interiores.
- [x] **GAME-05** salvar estado do veículo, localização, missões e progresso em localStorage com validação básica.

### Pendências obrigatórias
- [ ] **GAME-06 P1** jogar **cada missão completa** do início à vitória, por controles reais; gravar evidência de sucesso e falha.
- [ ] **GAME-07 P1** verificar mudança Chicago→Havana→Vegas→Rio sem estado antigo, missão quebrada ou itens de cidade anterior.
- [ ] **GAME-08 P1** repetir missão após derrota, checkpoint intermediário, troca de veículo e mudança de cidade.
- [ ] **GAME-09 P1** testar localStorage em Chrome desktop e Android: salvar, recarregar, restaurar, importar versão velha e corrupção deliberada.
- [ ] **GAME-10 P1** comparar ritmo do jogo: física, objetivos, dificuldade, perseguições e variedade, sem inventar fidelidade às 40+ missões do PS1.
- [ ] **GAME-11 P2** feedback de objetivo curto e específico (mapa, minimapa, distância, texto e som) em vez de textos excessivos.
- [ ] **GAME-12 P2** mapear as atividades secundárias, recompensa, repetição e qualidade de replays; confirmar que não quebram progresso principal.
- [ ] **GAME-13 CERTIFICAR** continuar save de cada fase antes, durante e após missão; só marcar completo com vídeo/trace.

---

## 5. Veículos, controles, colisões e animações

- [x] **CAR-01** carros civis, polícia, veículos especiais e moto com física arcade, danos e efeitos.
- [x] **CAR-02** modelo procedural como fallback, GLBs locais/CC0, pintura, luzes, rodas básicas e sistema de pivôs quando presentes.
- [x] **CAR-03** R58 adicionou portas articuladas em carros procedurais, montagem de moto e ajustes de IK.
- [ ] **CAR-04 P0** resolver rampa do trem, colisão corpo/rodas e falsos impactos em cruzamentos.
- [ ] **CAR-05 P1** auditar todos os GLBs de carro: escala, orientação, 4 rodas reais, eixo de direção, portas, materiais, luzes, malha duplicada.
- [ ] **CAR-06 P1** animar **as portas dos GLBs reais** com pivôs de geometria válidos; não recortar triângulos cegamente (bordas serrilhadas).
- [ ] **CAR-07 P1** revisar moto GLB monolítica: separar e nomear rodas, guidão, suspensão/garfo, mãos/pedaleiras, banco e rider; física não deve depender do visual.
- [ ] **CAR-08 P1** validar Tanner entrando/saindo dos dois lados em carro e moto, em vaga apertada e junto a parede.
- [ ] **CAR-09 P1** testar 30 ciclos entrar→dirigir→sair, trocar PS1↔GLB e mudar de cidade sem duplicar malha ou perder controles.
- [ ] **CAR-10 P1** polícia: ensaio de 10 minutos com várias viaturas, bloqueios, semáforos, carros civis e visão perdida; evitar U-turns e colisões repetidas.
- [ ] **CAR-11 P2** pneus/suspensão/roll por inclinação, freios, faróis e dano coerentes com visual e colisões.
- [ ] **CAR-12 P2** validar gamepads PC/PlayStation/Xbox e teclas A/D, câmera, E, J, pausar e controles touch.
- [ ] **CAR-13 CERTIFICAR** trajetória em piso/plataforma, rampas, água, becos e tráfego denso sem jitter, teleporte ou colisão fantasmas.

---

## 6. Pedestres, cães, crianças e animações

- [x] **NPC-01** há modelos GLB variados, incl. idosos, crianças, mulheres, homens e cães, além de sistema de distribuição.
- [x] **NPC-02** existe infraestrutura de calçadas, travessias, reações e limpeza de recursos.
- [ ] **NPC-03 P0 [R61 implementação em verificação]** corrigidos no PR #36 o descarte de skeletons clonados em trocas de mapa e a seleção exclusiva de adultos para policiais GLB. Testes novos cobrem 4 gerações de 28 vagas; exigir CI E2/E3 verde antes de encerrar.
- [ ] **NPC-04 P1** validar tamanho real de cada criança e cão; pastor-alemão maior, demais cães menores, sem gigantes.
- [ ] **NPC-05 P1** revisar foot IK/solo, animações com rigs diferentes, pés atravessando a calçada e deslizamento.
- [ ] **NPC-06 P1** garantir pedestres e cães **em Undercover e Passeio Livre**, com spawn verificável e distribuição proporcional.
- [ ] **NPC-07 P1** comportamento no tráfego, sem andar na água, atravessar parede, aparecer dentro de carro ou impedir missão.
- [ ] **NPC-08 P2** variedade de idle, andar, correr, susto e desvio do jogador/carro (sem movimento robótico sincronizado).
- [ ] **NPC-09 CERTIFICAR** dois minutos observando cada tipo de NPC em Chrome/Android, com contagem de carregados, escala e animações.

---

## 7. Texturas, iluminação, clima, mapa visual e áudio

- [x] **VIS-01** texturas de calçada/asfalto, materiais urbanos, fachada comercial e paletas por cidade.
- [x] **VIS-02** ciclo sol/lua ~15 min, luzes noturnas, chuva/pavimento molhado, sombras falsas e LOD em bairros.
- [x] **VIS-03** anti-aliasing solicitado no WebGL; R58 ajustou o teto de DPR (1,85 desktop; 1,5 touch).
- [x] **VIS-04** áudio de motor e efeitos sintéticos já integrados; há feedback de impactos e efeitos visuais.
- [ ] **VIS-05 P1** fotografar e comparar pontos fixos Chicago de manhã/tarde/noite/chuva; auditar material, textura repetida, z-fighting e sombras.
- [ ] **VIS-06 P1** corrigir itens “serrilhados” identificando se o defeito é pixelização, falta de MSAA, normal de malha, triangulação do GLB ou textura baixa. Não aumentar DPR cegamente.
- [ ] **VIS-07 P1** inventariar texturas por resolução, bytes e material; padronizar mipmaps, filtro anisotrópico, compressão e atlas por categoria.
- [ ] **VIS-08 P1** medir GPU/CPU do ciclo dia/noite, chuva, faróis, água e reflexos em desktop e telefone básico.
- [ ] **VIS-09 P2** melhorar fachada, interior, terreno, vegetação e placas sem exagerar brilho ou iluminação dinâmica.
- [ ] **VIS-10 P2** definir padrão de mixagem do áudio: volume geral, motor, colisão, sirene, cidade, chuva e mute; testar interrupção e retomada.
- [ ] **VIS-11 CERTIFICAR** vídeo comparativo dos quatro horários em cada cidade, sem flicker, popping, objetos invisíveis ou queda brusca de FPS.

---

## 8. Performance, memória, carregamento e mobile

### Diagnóstico
Existem carregamento progressivo por tarefas, shader precompile, LOD por bairro, objetos instanciados, redução de texturas GLB >1024 e limpeza de recursos GPU. Isso é **bom desenho inicial**. Mas os limites de custo e resultados p95 não foram certificados em dispositivos reais.

Assets particularmente grandes: caminhonete velha 24,74 MiB; barco 20,50; caminhonete nova 19,81; moto GLB 18,50; vários pedestres entre 11 e 16 MiB. Somente os 54 setores Chicago já somam ~101 MiB em bytes de arquivo. **Não presumir download dos 386 MiB ao iniciar**: o jogo tem carregamento diferido; medir waterfall antes de afirmar isso.

- [ ] **PERF-01 P1** perfis Chrome Performance/Memory/Network: menu, loading, 5 min parado, 10 min dirigindo e após três trocas de cidade.
- [ ] **PERF-02 P1** medição em celular real fraco, médio e desktop: FPS p50/p95, travamentos acima de 50/100 ms, MB JS heap, texturas e draw calls.
- [ ] **PERF-03 P1** metas iniciais sugeridas (AJUSTAR após baseline): desktop p95 frametime até 25 ms; Android intermediário p95 até 50 ms; nenhum leak cumulativo após trocar cidades 3×.
- [ ] **PERF-04 P1** GLBs: inventário de triângulos por veículo/NPC, compactação Draco/Meshopt **após validar suporte e cadeia de carregamento**, texturas WebP/KTX2 quando compatível, LOD de modelo e limitações por plataforma.
- [ ] **PERF-05 P1** tornar o pacote visual Chicago original streaming por chunk com limite de memória e descarte visível; nunca instanciar 1,54M triângulos sem budget e medição.
- [ ] **PERF-06 P1** verificar se troca de cidade libera geometrias, materiais, texturas, mixer de animações e clones sem liberar recursos compartilhados.
- [ ] **PERF-07 P1** investigar tempo de parsing/ordem dos **149 scripts locais**; juntar módulos por build simples e testável somente quando eliminar risco de dependências globais.
- [ ] **PERF-08 P2** política de LOD: faixas, histerese, instancing, distância das árvores, iluminação, pedestres e veículos, sem popping perceptível.
- [ ] **PERF-09 P2** progressão do loading mede trabalho real; testar no 3G/lento, perda de internet e cancelamento.
- [ ] **PERF-10 CERTIFICAR** planilha de medições por release, não “60 FPS” ou “otimizado” sem resultados instrumentados.

---

## 9. Refatoração e limpeza — SIM, precisamos mexer nos arquivos

**Não reescrever tudo nem misturar com outros projetos.** A estrutura já tem módulos corretos; o problema são os arquivos centrais superdimensionados, o HTML e a duplicidade de versões/planos/testes. Fazer mudanças pequenas com regressões.

- [ ] **ARCH-01 P1** dividir js/engine/driver2-game-engine.js (~199 KiB): ciclo principal, estado/missão, entrada do jogador, HUD, carregamento, cidade e tráfego. Extrair por interface, uma responsabilidade por PR.
- [ ] **ARCH-02 P1** dividir js/world/city-builder.js (~120 KiB): construção por distrito, água/pontes, colisores, props, lifecycle e estatísticas.
- [ ] **ARCH-03 P1** separar completamente cena visual, física, IA e estado de campanha; minimizar variáveis globais e acoplamento à ordem de scripts.
- [ ] **ARCH-04 P1** versionar contratos de save e criar migração automática em vez de manter somente versões estritas.
- [ ] **ARCH-05 P1** centralizar catálogo de veículos/GLBs, pesos, texturas, escalas e licenças. Validar links e limites de memória.
- [ ] **ARCH-06 P1** centralizar configuração de qualidade (low/medium/high/auto), DPR, sombras, pedestres, draw distance e orçamento de LOD.
- [ ] **ARCH-07 P1** revisar compatibilidade de testes Node: export real, mocks Three.js completos, sem testes que só passam por concatenação no mesmo contexto.
- [ ] **ARCH-08 P1** colocar QA de lógica/visual/GLB em status único de release; reduzir sobreposição dos 27 workflows sem perder cobertura.
- [ ] **ARCH-09 P2** remover HTML legado/duplicações **somente após** provar referências e preservar URLs de compatibilidade e histórico.
- [ ] **ARCH-10 P2** atualizar README de 106 KB e relatórios de revisões para um índice curto + docs separados, mantendo o histórico recuperável.
- [ ] **ARCH-11 P2** configurar padrão de formatação/lint, versionamento de assets, validação de sintaxe e pipeline reproduzível.
- [ ] **ARCH-12 CERTIFICAR** comparar entrada/salida, save, quatro cidades, missão, carregamento e FPS ANTES/DEPOIS de cada extração.

---

## 10. Critérios de aceite permanente (Definition of Done)

Para declarar uma funcionalidade como **PRONTA**, cumprir todos os pontos aplicáveis:

- [ ] **DONE-01** problema descrito com passos reproduzíveis, versão SHA e comportamento esperado.
- [ ] **DONE-02** teste vermelho ANTES da correção, ou limitação documentada se não reproduzível.
- [ ] **DONE-03** correção implementada no subsistema dono, sem “gambiarra” ou remoção de colisões legítimas.
- [ ] **DONE-04** suíte Node relevante + QA Node completo **verde**.
- [ ] **DONE-05** smoke Chromium/Playwright com screenshot ou vídeo, sem erro JS fatal.
- [ ] **DONE-06** sessão jogável com controles, sem travamento, teleporte ou estado incorreto.
- [ ] **DONE-07** reabrir save e trocar cidade; regressão de missão e GLB testada quando aplicável.
- [ ] **DONE-08** medir FPS, stutter, memória e downloads quando modifica renderização/assets.
- [ ] **DONE-09** commit em main e deploy Pages **confirmado por run concluído**, não por suposição.
- [ ] **DONE-10** atualizar esta auditoria: item encerrado, evidência, impacto, regressões e próximos problemas.

### Matrizes mínimas de teste

| Cenário | Desktop Chrome | Android Chrome | Save/reload | Gravação/trace |
| --- | --- | --- | --- | --- |
| Chicago Undercover | [ ] | [ ] | [ ] | [ ] |
| Chicago Free Ride | [ ] | [ ] | [ ] | [ ] |
| Chicago PS1 experimental | [ ] | [ ] | n/a | [ ] |
| Havana | [ ] | [ ] | [ ] | [ ] |
| Las Vegas | [ ] | [ ] | [ ] | [ ] |
| Rio | [ ] | [ ] | [ ] | [ ] |
| Carro GLB, carro procedural e moto | [ ] | [ ] | [ ] | [ ] |
| Missões principais, vitória/derrota | [ ] | [ ] | [ ] | [ ] |
| Polícia + pedestres/cães + trânsito denso | [ ] | [ ] | [ ] | [ ] |
| Dia/noite + chuva + troca de cidade 3× | [ ] | [ ] | [ ] | [ ] |

---

## 11. Ordem de execução recomendada, sem desviar

**Sprint A — Confiabilidade (P0)**: QA 20 falhas e visual vermelho; confirmar colisão da estação e GLBs. Nada de adicionar bairro novo enquanto os gates estiverem vermelhos.  
**Sprint B — Usabilidade/veículos (P1)**: completar portas e moto GLB, 30 ciclos de entrada e saída, policiais sem colisão, controles e save.  
**Sprint C — Chicago transitável (P1)**: catálogo de setores da fonte + grafo físico com altura real + travessias + testes bidirecionais.  
**Sprint D — Migração de campanha (P1)**: realocar uma missão por vez ao mapa homologado, completar 8/8 Chicago e capítulos restantes.  
**Sprint E — Performance (P1)**: GLBs, GPU lifecycle, carregamento, LOD, FPS medido em celular. Executar perfis em paralelo aos sprints.  
**Sprint F — Fidelidade visual (P2/P3)**: fachadas, sinais, texturas, estética e áudio, com capturas antes/depois.

**Próxima ação recomendada e objetiva:** concluir a execução visual 41258717291, registrar evidências de percurso e save em navegador e só depois avaliar o gate de estabilidade; a recuperação da suíte Node R52/R56/R57 já tem evidência E2.

---

## 12. Registro obrigatório de cada revisão — COPIAR para o topo após executar

### Revisão: R__ — AAAA-MM-DD — SHA: ______
- Responsável/objetivo:
- Cidade/modo/área:
- Itens deste checklist: 
- Problema reproduzido ANTES:
- Mudanças reais (arquivos e efeito):
- Testes Node: ___/___ (workflow e SHA):
- Testes Chromium E3: ____ (run, evidência):
- Partidas humanas E4: ____ (missões, minutos, checkpoints):
- FPS/memória/tempo de carga ANTES→DEPOIS (dispositivos):
- Deploy Pages: concluído? URL/run:
- Funcionalidades preservadas/regressões:
- Bugs abertos e severidade:
- Itens marcados [x] com evidências:
- Próxima prioridade estrutural:

### Histórico base
- **31/10/2026 — R58 / 82323c47:** portas e moto com testes isolados próprios; QA geral remoto mais recente **920/940 com 20 falhas**, visual **falhou**, GitHub Pages **implantado**. Nenhuma certificação de mapa 100%, campanha zerada ou desempenho de celular.
- Manter relatórios anteriores em docs/ e docs/chicago-evolucao/. **Este arquivo é o índice canônico de status**; relatórios de revisão são evidência complementar.

## 13. Referências e auditoria reproduzível

- Jogo: https://jogoiarexx-blip.github.io/Driver-2-Three-js/
- Código: https://github.com/jogoiarexx-blip/Driver-2-Three-js
- Chicago antiga e evidência: chicago/README.md; chicago/manifest.json; chicago/ground-survey.json; chicago/drive-mask.json; chicago/ps1-footprint-calibration-r3.json.
- Plano de expansão original: docs/chicago-evolucao/PLANO-CHICAGO.md.
- Revisões R48–R58: docs/ e testes correspondentes.
- Principais sistemas: js/engine/driver2-game-engine.js; js/world/city-builder.js; js/physics/; js/traffic/; js/entities/; js/gameplay/; js/render/; js/assets/; js/ui/.
- Workflow QA: .github/workflows/qa.yml; QA visual: .github/workflows/visual-qa.yml; recursos GPU: .github/workflows/gpu-regression.yml.
- Diagnóstico inicial: inspeção da árvore Git completa, manifests e arquivos de código, conferência de 149 scripts locais contra a árvore (nenhum ausente), leitura de logs dos jobs falhados. **Não houve execução manual completa do jogo em WebGL nesta auditoria.**
