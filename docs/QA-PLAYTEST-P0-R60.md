# R60 — Playtest automatizado do Driver 2 (Game Forge + evidências de QA)

## Objetivo

Incorporar metodologia de [Game Forge](https://github.com/npmiaman/game-forge) para ensaio controlado no navegador com capturas de tela e monitor de erros, combinada aos critérios de qualidade de evidências e rastreamento de falhas de [Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios). O código foi **adaptado ao Driver 2**, não incorpora automação de terceiros no runtime nem requer chave de API.

## Como executar

```bash
npm install --no-save --no-audit --no-fund playwright@1.56.1
npx playwright install chromium
python3 -m http.server 4173
# outro terminal
DRIVER_QA_URL=http://127.0.0.1:4173/ node tests/playtest-gameforge-p0.cjs
```

O workflow `.github/workflows/gameforge-playtest.yml` roda em PR, push nos arquivos críticos e por `workflow_dispatch`.

## O que é testado de verdade

| Caso | Controle e condição | Evidência |
|---|---|---|
| Início da partida | menu real `DriverBoot.start('ride')` | screenshot inicial, cidade, modo, frota |
| Direção do carro | tecla W até deslocamento real, tecla D até mudança de orientação | coordenadas antes/depois, dano, submersão, screenshot |
| Saída do carro | tecla E, esperar animação finalizar | modo `on_foot`, Tanner visível, screenshot |
| Caminhada | tecla W até deslocamento de Tanner | distância, coordenadas e screenshot |
| Persistência | `homeSave.write(capture(game))` no localStorage real, reload completo, `loadHomeGame()` | cidades, posições e quantidade dos veículos restaurados |
| Rampa ferroviária | `updatePhysics` real com steps controlados, sem direção por teclado nessa etapa | altura máxima, água, colisões, dano, deslocamento e screenshot |

**Única fixture artificial:** posicionamento inicial do carro em rua conhecida, antes de iniciar o ensaio. Não reposicionar/teleportar durante a etapa de condução por teclado. A repetição da estação usa um cenário separado com `updatePhysics` por passo; não é prova de direção humana.

O relatório `qa-artifacts/gameforge-driver2-evidence.json` registra **etapa, duração, estado antes/depois, screenshot, página/console, falha, etapa da falha**. Os PNGs são preservados na execução CI, inclusive em erro. Verificar o artefato e não somente o status SUCCESS.

## Correção real descoberta — limite de 32 carros no save

**Antes (R59):** `DriverHomeSave.capture()` serializava a frota toda, mas `DriverHomeSave.valid()` aceitava no máximo 32 veículos. Em Chicago com 43 carros, `write()` retornava falso, impedindo salvar. Também impedia recuperar a frota inteira.

**Depois (R60):** limite explícito de 128 veículos, conservando a validação de JSON, versão, cidade, missão, posições finitas e limite de 60 KB na leitura. `tests/city-home-save.test.cjs` testa 43 veículos, índice do jogador e dano persistidos e recusa 129. O browser deve confirmar `write → reload → loadHomeGame` em origem real.

## Critérios de aprovação — sem falsos certificados

- **E2:** 0 falhas em Node 22 e 24, incluindo save de 43 carros e rampa.
- **E3:** suite de navegador completa **SUCCESS**; capturas e JSON inspecionados, sem `pageerror` não tratado.
- **E4:** usuário humano percorre as missões, valida A/D, controle e objetivos completos; script de teclado fornece **evidência automatizada complementar**, não substitui E4 humano.
- **E5:** testes de FPS/memória na GPU de PC e Android real; SwiftShader na CI não é benchmark de hardware.
- Não marcar **P0-07**, **P0-09**, **P0-10** como completamente certificados antes dos gates aplicáveis.
- As 15 missões e 43 veículos simultâneos não são certificados por um único smoke. Não alegar que o mapa Chicago PS1 foi reproduzido 1:1.

### Onde investigar ao falhar

1. Abrir JSON e achar `failure.step` e o último `steps[].state`.
2. Comparar screenshot anterior e `gameforge-FAIL-*.png`.
3. Reproduzir **mesma condição** em runner local/GitHub; não relaxar asserções para mascarar travamento real.
4. Registrar classificação: defeito de jogo, mock, expectativa obsoleta, ambiente SwiftShader, timing ou falha de evidência.
5. Corrigir o produto e refazer antes/depois; E2/E3 de novo.

**Status comprovado:** [Actions R60 #41261823989](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41261823989) PASS nas oito etapas; [Node #41261823994](https://github.com/jogoiarexx-blip/Driver-2-Three-js/actions/runs/41261823994) 944/944 em Node 22 e 24. No replay rail, z=-218 até z=-251,27, altura 0, água/dano/bloqueio 0. Resta confirmar o workflow visual integral e critérios humanos/dispositivo. Referência: [PR #35](https://github.com/jogoiarexx-blip/Driver-2-Three-js/pull/35).
