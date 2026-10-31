# Driver 2 — Chicago R53: ponte oeste, rede física e tráfego sem deadlock

## Objetivo
Avançar fisicamente a Chicago do projeto, conectando a margem oeste ao centro pela **ponte fixa EXISTENTE** na latitude z=-80, sem criar vias fantasmas sobre água. Integrar o novo setor em Undercover e Passeio Livre e corrigir o comportamento dos carros civis quando esperam por outros veículos, sem teleporte.

## Nova infraestrutura
- **4 células antigas de quarteirão liberadas antes de construir as novas ruas:** x=-280/-200, z=-120/-40.
- **5 eixos de via no setor**: duas ruas norte–sul, uma ligação transversal através da ponte fixa em x=-240,z=-80 e dois pequenos acessos ocidentais às avenidas existentes.
- A ponte já pertence a `DriverChicagoPS1RiverBranches`: o módulo R53 reutiliza o deck, não fabrica uma nova ponte. O braço leste do canal só tem água em z>=94; em z=-80 o prolongamento até x=-160 está em terra firme. O canal oeste em x=-240 continua bloqueando outras latitudes sem ponte.
- **6 entroncamentos**, 14 segmentos no plano do novo distrito e 8 interfaces declaradas com ruas existentes.
- **8 edifícios** com caixas AABB, **8 áreas de calçada exclusivamente no lado de terra** dos quarteirões, 96 faixas de travessia e sinalização central instanciada. Nenhuma quadra protegida de missão foi removida.
- Elevação de piso das calçadas R53 integrada a `DriverRoadGeometry.localPavementHeight` e `CityBuilder.getGroundHeightAt`. A ponte continua ao nível do asfalto.
- Adição das ruas ao minimapa com proveniência `procedural-r53-verified-west-bridge`. **Não é topologia certificada 1:1 do mapa PS1.**

## Navegação e IA de trânsito
- O A* compartilhado agora recebe os trechos da R53 somente quando a auditoria física (água, colisão, presença do sistema de pontes) declara o distrito `ready=true`.
- Quatro carros civis novos **elegíveis** para o setor oeste. Os pontos iniciais são aceitos somente quando estão secos, sem colisor, afastados de outros carros e conectados a um objetivo real.
- Corrigido o comportamento do controlador R49: quando não existe rota segura, o veículo freia, mantém sua posição, tenta novo destino após dois segundos e **não** usa o fallback genérico que poderia levá-lo a atravessar um canal.
- Carros aguardando um líder, semáforo, pedestre ou bloqueio físico não são classificados como imóveis por defeito de navegação e não recebem uma rota aleatória por terem esperado. Trânsito perpendicular distante não é confundido com veículo à frente.
- O modo Undercover e o Passeio Livre continuam usando a mesma criação de cidade e de frota; carros de missão, GLBs particulares, ônibus e caminhões preservam o controlador anterior.

## Diagnóstico R53
O painel F8 (ou toque no indicador FPS no celular) passa a informar carros na ponte oeste, veículos parados na margem oeste, rotas bloqueadas, carros aguardando trânsito ou semáforo e contagem de replanejamentos. Os números são amostrados do estado da simulação, não evidência automática de que o jogo foi conduzido manualmente.

## Comparativo — cenário de teste sintético idêntico
| Indicador | R52 | R53 |
|---|---:|---:|
| Nós transitáveis no A* | 126 | 138 |
| Arestas transitáveis no A* | 211 | 229 |
| Civis elegíveis em rotas mistas R49/R50/R52/R53 | 12 | 16 |
| Ruas construídas nesta etapa | 0 | 5 |
| Novas células de quarteirão | 0 | 4 |
| Lotes físicos com colisão criados nesta etapa | 0 | 8 |

**Status de testes:** o arquivo `tests/chicago-r53-west-canal.test.cjs` passou em **10 de 10** casos num ambiente JavaScript isolado usando os arquivos reais buscados do repositório, cobrindo ponte, água, A*, tráfego e espera, ausência de rota, piso das calçadas, telemetria e integração em ambos os modos. Sintaxe válida em 12 dos 12 módulos JavaScript verificados. Os números acima representam o cenário simulado, não uma partida real com a cidade inteira.

## Limites e pendências
- Esta entrega não certifica a geografia completa ou as dimensões exatas do Driver 2 do PS1.
- Não foi realizada sessão visual de 10+ minutos em Chromium ou celular com os novos veículos, nem medição confiável de FPS real, verificação de controles ou testes de travessia dirigindo no navegador.
- Resultado completo do workflow GitHub Actions e propagação do GitHub Pages ainda devem ser conferidos separadamente.
- Outras revisões podem estar sendo feitas simultaneamente na mesma branch. Os commits desta etapa foram limitados aos subsistemas da R53 para minimizar conflitos.

### Próxima intervenção estruturante
Reproduzir os percursos com F8, verificar colisão real e congestionamentos no cruzamento oeste, integrar vias adaptadas adicionais sem corredores imaginários e comparar bairros/monumentos com fontes verificáveis do mapa original.
