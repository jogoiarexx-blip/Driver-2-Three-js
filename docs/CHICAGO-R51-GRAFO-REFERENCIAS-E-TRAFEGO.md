# Driver 2 — Chicago R51: navegação nos corredores de referência e QA

## Motivação
A R49/R50 ligava a grade procedural central aos 12 cruzamentos dos setores criados nas revisões anteriores, mas limitava o roteador aos eixos `-320..320`. A Chicago já possuía corredores adaptados de referências de superfície PS1 em regiões mais distantes (incluindo R39–R44), representados no radar, que continuavam fora do grafo misto.

## Mudanças reais

### Malha viária / A*
- O compilador do grafo passou a ler os corredores **já renderizados** e disponíveis em `city.chicagoPS1StreetNetwork.radarPaths`.
- Só considera `PS1-surface-reference-adapted` e conectores `topology-inferred-grid-feeder` que o construtor R22 havia aceitado; ignora traçados de radar apenas decorativos.
- Divide cada trecho existente em amostras de no máximo 16 unidades, certificando colisão e água no centro e em duas faixas laterais apropriadas à pista estreita (1,7 unidades). Segmentos anormalmente longos, degenerados ou inválidos são rejeitados.
- **Não cria ligações entre bairros distantes por proximidade visual ou linhas se cruzando.** Um cruzamento em níveis diferentes exige evidência física/topológica.
- Arredonda as chaves dos nós a 0,5 unidade, usa cache por estado de ponte, revisão da cidade, quantidade de colisores e quantidade de caminhos da referência.
- Substitui a ordenação repetida da fronteira A* por **min-heap**, e pré-indexa nós em buckets espaciais de 48 unidades.
- Guarda contagens de corredores e segmentos válidos, planejamento total, falhas e pior tempo de planejamento.

### Tráfego distante
- Novo `DriverChicagoSourceTrafficR51`, ativado apenas em Chicago e somente se o R22 já carregou as referências.
- Até **quatro sedãs/cupês adicionais**, em circuitos de referência R43/R44 existentes, desde que o ponto seja seco, sem colisor, suficientemente distante de outros carros e haja caminho A*.
- Os veículos usam a IA civil R49 e um conjunto próprio de quatro metas por circuito. O avanço agora é na ordem da via, sem inverter o sentido ao alcançar cada marco.
- O jogador, os modelos GLB, os veículos de missão, a polícia de missão, ônibus, caminhões e as outras três cidades mantêm seu comportamento anterior.

### Telemetria e HUD
- `F8` no computador mostra o overlay de diagnóstico.
- **Toque no FPS** existente na HUD para abrir ou fechar o mesmo overlay no celular, sem criar novo elemento visual.
- O painel agora exibe nós e arestas do grafo compilado, corredores/segmentos de referência aceitos, carros R51 ativos, planos A*, falhas e pior tempo de planejamento, além de FPS e indicadores preexistentes.
- O painel é atualizado aproximadamente a cada segundo, preservando o orçamento de frames do jogo.

## Testes reproduzíveis
Arquivo: `tests/chicago-r51-source-network.test.cjs`.

1. A* chega a caminhos fonte fora da grade de 320 unidades.
2. Não cria ligação entre componentes fisicamente desconectados.
3. Não atravessa água, AABB, segmentos inválidos ou linhas de radar decorativas.
4. NPCs R51 nascem em destinos transitáveis e recebem comandos de direção.
5. Os scripts estão carregados em ordem no HTML e compartilham o motor dos dois modos.
6. NPCs da referência seguem o próximo ponto no sentido correto.
7. F8 expõe falhas e custo de A*.
8. Varredura sob a estação verifica dezenas de posições do carro em nível do solo sem corrimão fantasma; Tanner mantém acesso à rampa e plataforma elevada.
9. Diagnóstico móvel usa o FPS existente e mantém o atalho de teclado.

**Status:** 9/9 cenários passaram em ambiente JavaScript isolado com os arquivos lidos do GitHub. O repositório também dispõe do workflow `node --test tests/*.test.cjs`, mas o resultado completo da Action ainda não foi confirmado.

## Limitações que não devem ser ocultadas
- A integração é de **ruas já existentes na representação adaptada do projeto**; não representa conclusão de todos os bairros de Chicago nem extração completa da topologia oficial de Driver 2 PS1.
- Quantos segmentos sobrevivem no cenário real depende dos edifícios, da água, dos limites e da ponte. Os números dos testes simulados não substituem a observação da partida.
- Não houve confirmação nesta revisão de execução em Chromium/WebGL, versão mobile, direção/colisões durante 10+ minutos ou deploy concluído do GitHub Pages.
- O roteador não conecta automaticamente pontes elevadas, camadas sobrepostas ou pistas sem uma junção construída/validada.

## Próxima prioridade
Executar replay completo em navegador para detectar desempenho em regiões distantes, investigar percursos sem ligação verificada e planejar novas ruas físicas com base em dados de referência, sem inventar geometria do jogo original.
