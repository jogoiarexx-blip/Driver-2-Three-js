# Driver 2 / Chicago R56 — Replay de direção, cruzamentos e eliminação de paredes fantasmas

## Problema reproduzido
Os carros do novo trânsito R49/R50/R52/R53 recebiam pontos de navegação em cruzamentos estreitos, mas o seguidor passava ao próximo trecho **11 unidades antes de alcançar o cruzamento**. Um carro acabava cortando a esquina e atingindo o colisor de um prédio na margem oeste, mesmo quando as ruas do grafo haviam passado pela auditoria de água e edifícios.

A reprodução de referência partiu de um carro R52, com a física arcade **DriverArcadePhysics.update** e a IA real **DriverChicagoMixedTrafficR49.getInput**, sem WebGL:
- R52 no replay de 70 segundos antes de corrigir a conversão: **31 contatos**.
- Após a primeira correção de aproximação/velocidade, replay estendido de 600 segundos: **202 contatos** no entorno de x≈-310, z≈-70, colidindo com um lote do setor R53.
- Após as duas correções estruturais juntas: **zero contatos** em dez minutos.

O comportamento era reproduzível. Não foi resolvido desligando colisão, aumentando genericamente as ruas ou teleportando veículos.

## Alterações implementadas

### 1. Conversão segura em cruzamentos
- `DriverChicagoMixedNavigationR49.follow` calcula o ângulo do caminho **no próprio vértice**; curvas com mais de ~31,5° exigem aproximação a menos de 4,5 unidades do cruzamento antes da troca de segmento, em vez do raio antecipado de 11 unidades.
- Trechos retos utilizam tolerância de 8 unidades; o primeiro waypoint preserva tolerância de 11 unidades para evitar retorno ao ponto inicial.
- `follow` fornece `cornerAngle` e `cornerDistance` para a IA de velocidade sem alterar as APIs existentes de polícia ou de missão.
- `DriverChicagoMixedTrafficR49.getInput` reduz preventivamente o limite para até 6,0 unidades/s a menos de 28 unidades da curva fechada e para até 3,6 unidades/s a menos de 14 unidades. A lógica continua obedecendo trânsito à frente, sinal vermelho, pedestres e bloqueios.

### 2. Reposicionamento físico dos lotes R53
- Os oito prédios existentes e suas caixas AABB **foram preservados**.
- Casas e calçadas da margem oeste foram deslocadas do canto externo para o miolo útil entre vias: posições x=-300/-180 e z com offsets ±20, em vez de x=-304/-184 e offsets ±24.
- A geometria mantém espaço para pneus e conversão em ruas próximas ao canal. `DriverRoadGeometry.localPavementHeight` acompanha exatamente essas novas posições para evitar pé atravessando calçada.
- O ponto de contato antes reproduzível (-310,08; -70,39), com raio de 1,55 unidade, agora está livre da AABB do edifício.

### 3. Instrumentação e publicação
- O estado `chicagoMixedTrafficStatusR49.cornerBrake` sinaliza a ação preventiva.
- O F8 (ou o toque no FPS no celular) exibe quantos veículos estão reduzindo velocidade por curva estreita.
- O `index.html` recebeu novas versões dos arquivos de navegação, tráfego, rua oeste, física de calçada e telemetria para diminuir divergências de cache no GitHub Pages.

## Resultados reprodutíveis

### Replay arcade — mesmo cenário sintético e geometria/colisores dos bairros R48/R50/R52/R53

| Veículo / distrito | Tempo simulado | Distância aproximada | Contatos com água/edifícios |
|---|---:|---:|---:|
| Sedã R49 Sul | 600 s | 4.569 unidades | 0 |
| Sedã R50 Norte | 600 s | 4.270 unidades | 0 |
| Sedã R52 Goose East | 600 s | 4.317 unidades | 0 |
| Sedã R53 Oeste | 600 s | 4.648 unidades | 0 |
| **Total** | **40 minutos-carro** | **17.804 unidades** | **0** |

Cada veículo mudou de objetivo 16 a 20 vezes, sem interrupção de rota no replay.

**Teste concorrente separado:** quatro desses carros circularam ao mesmo tempo durante 300 segundos, com a lista dos demais veículos passada à IA. Cada um percorreu mais de 2.100 unidades, sem colisões com água/prédios, sem aproximações inferiores a 3,4 unidades e sem rotas bloqueadas no cenário de teste.

### Arquivos e execução
- Nova suíte `tests/chicago-r56-long-traffic-replay.test.cjs` (4 cenários: quatro replays curtos, quatro replays longos, posição das caixas de colisão/calçadas e tráfego simultâneo).
- **4/4 testes R56** e **10/10 testes anteriores R53** executados com os arquivos atuais do GitHub em um ambiente JavaScript isolado.
- **13/13 scripts JavaScript verificados com sintaxe válida.**
- Workflow existente `qa.yml` executa `node --test tests/*.test.cjs` quando houver alterações em `js/**` ou `tests/**`; o resultado completo do workflow ainda precisa ser confirmado.

## Trade-off explícito
A IA passa a frear **antes** das curvas mais fechadas. Isso reduz a velocidade média e a distância percorrida por minuto em comparação com a IA agressiva anterior, mas elimina o caso reproduzido de veículo cortando cruzamentos e tocando edifícios. Foi mantida a velocidade normal em retas.

## Limitações
- Não houve execução real de WebGL/Chromium nem direção manual de toda a cidade nesta revisão.
- O replay usa a física arcade real de aceleração/giro e os dados de água/AABB dos setores, mas simula a movimentação e a resposta às colisões em JavaScript, sem instanciar a malha GLB ou todos os agentes do motor principal.
- Não valida os FPS de um celular físico, as 16 ou mais viaturas simultâneas, nem todas as missões e regiões da Chicago original.
- Não constitui certificação de mapa integral 1:1 do Driver 2 PS1 nem prova de que o GitHub Pages terminou seu deploy.

## Próxima prioridade
Executar uma sessão real no navegador com a telemetria F8, verificar cruzamentos R53/R52 e polícia em missões, acompanhar gargalos com tráfego denso e continuar a expansão dos bairros com geometrias comprovadamente conectadas.
