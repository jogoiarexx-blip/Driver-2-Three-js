# Pedestres personalizados — Driver 2 Three.js

## Estado atual: somente modelos enviados pelo usuário

Os civis não utilizam mais corpos gerados com caixas/cores procedurais. A
cidade conserva **28 vagas lógicas** de pedestres e a IA de calçadas, curvas,
esquiva, travessia e semáforo existente.

**Fontes GLB carregadas uma única vez:**
1. `mulher_walk.glb` (vaga original 0).
2. `Pedestre_Masculino_Driver2_Atirar_Com_Pistola.glb` (vaga original 1).
3. `mendingo.glb` (vaga original 2).
4. `mulher 2.glb` (vaga original 3).
5. `mulher 3.glb` (vaga original 4).

As outras **23 vagas** recebem cópias com esqueleto e animação independentes,
mas compartilham os mesmos buffers de geometria, materiais e texturas.
As cópias respeitam a altura dos modelos originais com pequena variação de
escala, animação de caminhada, corrida se disponível, pausa e LOD de animação.

Os agentes posicionados nos bloqueios também reutilizam GLBs do catálogo
(preferencialmente o homem com pistola). A IA policial de perseguição e os
cavaletes não foram alterados.

## Carregamento e falhas

- Os arquivos são requisitados conforme a partida inicia, e não no menu.
- Se um GLB ainda não carregou, sua vaga pode receber temporariamente um
  **outro GLB enviado pelo usuário** que já esteja pronto.
- Se nenhum GLB puder carregar, a vaga fica **invisível**, sem gerar um
  personagem procedural como substituto.
- A troca de cidade libera os rigs clonados antes de descartar as malhas de
  cidade. Os cinco templates seguem em cache e são reutilizados.
- O contador de pedestres continua em 28, sem multiplicar agentes da IA.

No console do navegador, depois de iniciar a partida:

```js
DriverGame.pedManager.uploadedCrowd.status()
```

Confira `loadedModels` (ideal: 5), `filledSlots` (ideal: 28),
`waitingSlots` (ideal: 0) e `proceduralCivilians` (sempre 0).

## Como adicionar novos modelos no futuro

1. Envie o arquivo `.glb` animado para esta pasta.
2. Acrescente uma definição em
   `js/assets/driver-pedestrian-variants.js`, usando
   `pedestrianIndex` novo (5, 6, 7 etc., no máximo 27).
3. Informe `url`, `id`, `height` e `walkName`. Se o modelo tiver
   `Running`, a travessia também usará a animação.
4. Publique o commit. O sistema redistribuirá automaticamente as vagas
   restantes entre todos os GLBs cadastrados.

Sem as definições, o GitHub Pages não consegue descobrir arquivos novos
automaticamente, pois a hospedagem estática não expõe a listagem da pasta.

Testes: `node --test tests/uploaded-pedestrian-crowd.test.cjs`,
`node --test tests/male-pedestrian-glb.test.cjs` e o workflow de QA.
