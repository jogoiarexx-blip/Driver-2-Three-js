# Chicago Undercover — diagnóstico e plano para o mapa completo

Base examinada: repositório `main` no commit `27261a9b4f6ac0c85e35ed0480f5270e9b56a2a5` (R29). Objetivo: reconstruir a cidade procedural com a extensão e organização da Chicago de Driver 2 no PS1; depois reposicionar missões. A planta acompanha este documento em [mapa-chicago.svg](mapa-chicago.svg). Para a evidência extraída da geometria, veja [o levantamento de pavimento](../../chicago/reference-street-survey.png) e [a visualização original](../../chicago-original-preview.html).

## Diagnóstico e escala

| Item | Evidência | Interpretação |
|---|---|---|
| Referência visual | `chicago/manifest.json`: 54 setores, 1.544.872 triângulos; limites OBJ X −111,975 a −9,7521 e Z 32,0196 a 223,507 | Extensão da geometria fornecida: aproximadamente 102,22 × 191,49 unidades OBJ. Não são quilômetros certificados. |
| Projeção para o Undercover | `reference-world-r20.json`: cantos projetados X −530,89 a 339,49 e Z −218,54 a 1360,85 | A transformação uniforme existente da R15 dá escala comum. O eixo e a colocação dos bairros ainda são adaptados. |
| Terreno e limites | Terreno X −576 a 448, Z −448 a 1408; área jogável X −560 a 432, Z −432 a 1392 | Espaço reservado de 1024 × 1856 unidades e área jogável de 992 × 1824. Conter os cantos não comprova a reconstrução de ruas e bairros. |
| Ruas jogáveis | Corredores R15–R20 e ramificação R25 são reconstruções parciais baseadas na fonte | Traçados têm posicionamento adaptado; validar cada trecho com física e conexões. |
| Rede candidata | `reference-network.json`: 3.230 nós e 4.279 arestas de superfície | Pode conter calçadas, pátios e cruzamentos em níveis diferentes. Não habilitar tráfego automaticamente. |
| R28/R29 | 216 segmentos candidatos com filtros de altura/largura; R29 recupera altura local em 47, totalizando 263 para revisão; maior componente tem 3 arestas | Diagnóstico de geometria, não certificação de rua dirigível, cruzamento ou malha completa. |
| Texturas | Manifesto registra páginas 128 e 158 ausentes | Não preencher lacunas por suposição nem tratar pixel vazio como rua ou água. |
| Missões | Ainda em posições adaptadas | Mover somente após mapa e rotas estarem construídos e validados. |

Não há base para dar um percentual confiável de fidelidade total ou afirmar equivalência em quilômetros com o PS1. Tamanho espacial, cobertura jogável e semelhança topológica são métricas diferentes.

## Etapas de evolução

1. **Inventário espacial por setor.** Projetar os 54 setores com a transformação R15 única; registrar limites, ruas observadas, água, pontes, rampas, construções e evidência de origem. Gerar uma grade de cobertura reproduzível com estados: não examinado, candidato, reconstruído e validado.
2. **Alturas e classificação.** Amostrar triângulos originais e páginas do atlas por trecho; separar pavimento de rua, calçada e pátio. Resolver pontes e sobreposições por nível; registrar lacunas e incertezas. Reavaliar as 263 arestas da R29 individualmente, sem promovê-las por contagem.
3. **Malha troncal conectada.** Continuar a partir dos trechos existentes em direção ao restante do envelope, por regiões contíguas. Preservar coordenadas de origem, cruzamentos e níveis; construir asfalto e colisão a partir da mesma geometria. Só ligar à grade antiga quando a ligação tiver sido verificada.
4. **Água, relevo e infraestrutura.** Reconstruir rios e lago com máscara física correspondente ao desenho; modelar pontes e rampas por perfis de altura verificados. Não assumir que as quatro amostras de água extraídas representam a água inteira.
5. **Bairros e edifícios.** Distribuir quadras e marcos conforme a referência de cada setor, mantendo lotes e colisores fora das pistas. Distinguir marcos identificados de nomes e posições ainda hipotéticos. A base verde fora do cenário antigo continua classificada como não reconstruída até receber conteúdo.
6. **Trânsito e pedestres.** Criar grafo de direção e calçadas apenas sobre trechos construídos, com conexão e nível certificados; testar mudança de faixas, cruzamentos, bordas de água e regiões de streaming. Otimizar com LOD e orçamento de memória por setor.
7. **Missões, depois do mapa.** Mapear origem e destino de cada missão; propor posições relativas aos marcos reconstruídos. Exigir acesso a pé e de veículo, percursos completos nos dois sentidos quando aplicável, e testes dos eventos e objetivos antes de substituir os pontos atuais.
8. **Entrega e auditoria.** Manter relatório por setor com proveniência, área construída, quilômetros de via calibrados somente quando houver escala física validada, cobertura do grafo e testes reproduzidos. Publicar após regressões de Chicago e troca entre as quatro cidades.

## Critérios para considerar o mapa concluído

- Os 54 setores da referência foram inspecionados, incluindo suas lacunas conhecidas; o contorno e a escala usam uma transformação documentada e verificável.
- Todas as vias principais e ligações identificadas têm geometria, colisão, altura e conectividade conferidas contra a fonte; trechos incertos ficam explicitamente listados.
- O lago, rios, pontes e marcos relevantes são conferidos visualmente e em deslocamentos reais; o limite visível coincide com o limite físico.
- Replays cobrem extremos, conexões inter-regionais, pontes, curvas e itinerários de missão sem bloqueios indevidos, quedas, submersão ou colisões invisíveis. Testes incluem trânsito, pedestres, streaming, desempenho e troca de cidade.
- Só após esses critérios, migrar missões e testar a campanha completa. Manter uma lista de diferenças remanescentes frente ao PS1.

## Arquivos de referência

- `chicago/manifest.json`: setores e limites da fonte; `chicago/reference-world-r20.json`: envelope e transformação aplicada.
- `chicago/reference-street-survey.json` e `chicago/reference-network.json`: levantamento de pavimento e grafo candidato.
- `chicago/reference-grade-r26.json`, `reference-grade-r27.json`, `reference-layered-r28.json`, `reference-recovery-r29.json`: evidências de altura e candidatos.
- `docs/superpowers/plans/2026-10-29-chicago-full-plan.md`: histórico de implementação e testes.
- `tools/chicago-geo-audit.cjs` e testes `tests/chicago-*`: auditorias e replays existentes; consultar saída atual antes de declarar resultados novos.

## Execução R30 — inventário por setor

Primeira etapa iniciada: `tools/chicago-r30-sector-inventory.cjs` gera `chicago/sector-inventory-r30.json` e a [planta dos 54 setores projetados](setores-originais-r30.svg). Cada setor reúne limites da fonte, quatro cantos transformados, hash do setor fornecido, triângulos classificados por textura e quantidades de caixas de segmentos candidatos sobrepostas. Essas quantidades não são extensões de rua e podem contar o mesmo segmento em mais de um setor. O gerador verifica a correspondência do hash do levantamento com as entradas de grafo, recuperação R29 e curva R15. Os hashes de setores são os registrados pelo levantamento; o inventário não relê os GLBs para verificá-los.

Validação: 710 testes Node passaram, incluindo rejeição de levantamento incompatível. Os arquivos gerados são reproduzíveis byte a byte. Esta etapa não adiciona ruas jogáveis; a classificação de pavimento, construção dos setores, testes de direção e posterior mudança das missões continuam pendentes.

## Execução R31 — interseções geométricas por setor

`tools/chicago-r31-sector-candidates.cjs` cruza as polilinhas das 263 arestas de revisão R29 com os retângulos originais dos 54 setores usando interseção de segmentos. O resultado em `chicago/sector-candidates-r31.json` guarda os IDs exatos por setor, os hashes dos sete arquivos de entrada e a transformação validada contra a R30. A [planta de candidatos](candidatos-setores-r31.svg) mostra os traçados em amarelo.

O cruzamento real resultou em 316 associações entre segmentos e setores, ante 319 associações por caixas aproximadas da R30; 46 setores têm candidatos, ante 47 na aproximação anterior. As contagens podem repetir segmentos em setores sobrepostos ou adjacentes. Os candidatos continuam sem certificação de rua ou de tráfego. Na extremidade da R25 (nó 752), as alternativas 972 e 1018 permanecem em revisão: os filtros de largura/altura não autorizam considerá-las conexão validada. Não foram construídos novos trechos jogáveis ou movidas missões nesta etapa.

Validação local: 715 testes Node passaram; teste específico cobre passagens com extremos fora do setor, cantos, segmentos degenerados, lista completa e hashes. Arquivos gerados reproduzidos byte a byte.

## R35 — ligação norte jogável e correção do radar

A via R25 agora continua do nó de origem 752 ao 405 por uma cadeia rastreável de 25 arestas do grafo de superfície, com as mesmas escala e transformação R15. O novo corredor tem cerca de 325,56 unidades de extensão após a adaptação geométrica, largura de 8 e término aproximado em X=-119,34 / Z=1043,03. O traçado utiliza simplificação de tolerância 2 unidades e duas passagens de suavização para remover pequenas quinas do esqueleto que faziam o carro cortar uma curva. Os dados brutos originais continuam preservados em `chicago/reference-north-link-r35.json`; essa adaptação não certifica que o pavimento seja rua ou tenha a mesma altura do PS1. A geometria física do Undercover permanece plana e é verificada contra água e colisores antes de construir.

Foi corrigida a seleção de vias no radar: o prefixo `north-` fazia a nova ligação ser procurada entre os três braços antigos. A seleção agora discrimina aqueles três nomes, registrando também R35. A rede contém 11 corredores; prédios procedurais do sistema R32 podem acompanhar o prolongamento, respeitando o afastamento das vias.

Validação reproduzida: 724 testes Node passaram. Chromium/SwiftShader local percorreu a ligação e a emenda R25 nos dois sentidos: 2460/2462 quadros de simulação, afastamentos máximos 0,653/1,212 unidades, zero água, bloqueios, dano ou erros JavaScript. Foram amostrados 273 pontos do corredor por sentido. Para executar localmente, as mesmas versões Three r128 e GLTFLoader usadas pelo jogo foram servidas de cópias dos CDNs; fontes e Tailwind externos foram bloqueados apenas no executor local. Os testes canônicos do repositório continuam usando a página normal nos Actions; a fila remota ainda estava aguardando execução. Esta revisão amplia a área dirigível; o mapa inteiro e a migração das missões continuam pendentes.

## R36 — continuação norte até z≈1247

O corredor R35 foi continuado do nó original 405 ao nó 162 por 17 arestas conectadas da mesma referência. A R36 usa a transformação R15, a mesma simplificação de 2 unidades e duas passagens de suavização da R35. São aproximadamente 248,40 unidades novas de estrada, terminando em X≈-55,09 / Z≈1247,25. As coordenadas e alturas são adaptações do Undercover; classificação como rua e fidelidade integral ao PS1 continuam não certificadas. O radar registra 12 corredores.

Validação reproduzida: 725 testes Node passaram. Chromium/SwiftShader local, com as mesmas cópias Three/GLTFLoader utilizadas na R35, percorreu a via e a emenda R35 nos dois sentidos: 2146/2143 quadros simulados, afastamentos máximos de 1,603/1,505 unidades; zero água, bloqueios, dano ou erros JavaScript. Houve 189 pontos de corredor amostrados por sentido, incluindo a emenda. Os lotes R32 usam todas as vias construídas para manter afastamento. A revisão independente não encontrou bloqueios importantes. A publicação no Pages depende da fila externa dos Actions. O restante da cidade e as posições das missões permanecem pendentes.

## R37 — ramal até o extremo norte projetado

Foi acrescentado um ramal de aproximadamente 166 unidades a partir de um entroncamento da R36, terminando em X≈35,24 / Z≈1343,14. O final da R36 é um pequeno beco: a R37 parte do nó fonte 175 e segue 25 arestas até o nó 0, sem duplicar a aresta 226 que leva ao beco. Mantém transformação R15 e adaptação geométrica R35, com a primeira posição ajustada em aproximadamente 5,96 unidades para encaixar em um vértice da R36 e oferecer entrada gradual à curva. Um pavimento circular de raio 11 forma o entroncamento. Os lotes procedurais deixam livre esse pavimento mais uma margem. Trata-se de via adaptada de evidência de superfície; localização, classificação e altura originais não foram certificadas.

Validação: 728 testes Node passaram. Chromium/SwiftShader local, com as mesmas cópias Three r128/GLTFLoader usadas nas revisões anteriores, percorreu a aproximação R36 e o ramal nos dois sentidos: 1545/1540 quadros simulados, afastamentos máximos 2,062/1,520 unidades, zero água, bloqueios, dano, saída de faixa ou erros JavaScript. O radar registra 13 corredores. Chegar ao norte do envelope não significa que o restante da cidade esteja reconstruído: ainda faltam malhas laterais, água/relevo e bairros da referência; missões continuam nos pontos atuais.

## R38 — retorno pela lateral leste

Uma nova via de aproximadamente 472,34 unidades parte de um ponto interior da R37 em X≈24,34 / Z≈1330,91 e retorna pela lateral leste até X≈144,95 / Z≈937,47. Os dados brutos preservam 69 arestas conectadas da referência, entre os nós 0 e 501, sem repetir as arestas da R37. A rede passa a registrar 14 corredores. O pequeno trecho terminal da R37 continua disponível.

Duas adaptações foram necessárias para a condução: uma emenda cúbica de aproximadamente 29,81 unidades de corda substitui a saída com volta apertada na origem; outra aproximação de 26,02 unidades de corda suaviza a quina final, preservando a coordenada exata do destino. O restante segue a transformação R15 e a simplificação/suavização das revisões anteriores. Essas adaptações são documentadas em `js/world/chicago-east-return-r38.js`; a cadeia original permanece em `chicago/reference-east-return-r38.json`. Não há certificação de rua, altura ou colocação original do PS1, nem mudança de missões.

Validação reproduzida: 730 testes Node passaram. Chromium/SwiftShader local percorreu a aproximação R37 e a via nova nos dois sentidos: 3439/3443 quadros de simulação, afastamentos máximos 1,239/1,276 unidades, zero água, bloqueios, dano, saída de faixa ou erros JavaScript. Foram usadas cópias locais das mesmas versões CDN de Three r128/GLTFLoader, como nas revisões anteriores. A revisão independente conferiu cadeia, integração e origem; as duas correções de curva foram verificadas posteriormente nos percursos. A ocupação R32 respeita o traçado final e as colisões seguem os mesmos lotes.

## R39 — extensão leste para sul, próxima etapa da malha física

O corredor R38 deixou um extremo aberto no nó **501** da rede original de pavimento. Nesta etapa, a partir da geometria `reference-network.json` (hash de referência já registrado), foi percorrido o caminho conexo mais curto até o nó **1323**, totalizando **32 arestas novas**, **33 nós** e **41 pontos OBJ**; nenhuma aresta R37/R38 foi repetida.

A geometria extraída está preservada em `chicago/reference-southeast-r39.json`, com contraparte JavaScript para o GitHub Pages. O novo adaptador `js/world/chicago-southeast-r39.js` aplica a mesma projeção R15, simplificação de tolerância 2 e duas passagens de suavização das rotas anteriores. Seu término adaptado é aproximadamente **X=178,20 / Z=660,28**, contra **X=144,95 / Z=937,47** na saída da R38. O corredor mede aproximadamente **300 unidades do Undercover** e tem largura 8; a ligação usa o **mesmo ponto final da R38**, sem introduzir teleporte ou conexão arbitrária.

`CityBuilder` cria o pavimento apenas para Chicago, com auditoria de água e obstruções herdada do sistema de construção R15; `DriverChicagoPS1StreetNetwork` o registra como o 15.º corredor do radar, seguido do conector R22 se este for aceito. A ocupação lateral R32 considera também o corredor recém-construído, evitando lotes no asfalto. As outras cidades, missões, posições de início e trajetórias antigas não são alteradas.

**Verificação:** o teste `tests/chicago-r39-southeast.test.cjs` confere a cadeia de origem, 32 arestas únicas, encaixe exato, envelope e ausência de certificações indevidas. `tests/chicago-r39-southeast-browser.cjs` percorre a via nos dois sentidos usando física do carro, verifica água, obstáculos, dano e posição sem teleporte; workflow dedicado `chicago-r39-southeast.yml`. A verificação em navegador só deve ser declarada como aprovada se a execução do GitHub Actions concluir com sucesso. O teste R22 e os replays R35–R38 foram corrigidos para usar a quantidade atual de corredores, em vez do valor antigo 14 ou 11.

**Pendências:** conferir a classificação real de ruas e alturas nos GLBs de origem, completar os ramais laterais e os setores ainda ausentes, validar percurso contínuo com cruzamentos e tráfego, refinar a costa e só depois reposicionar missões. Esta R39 é um avanço concreto na rede conectada, **não** uma certificação do mapa completo do PS1.

**Resultado executado em GitHub Actions (`41206311120`):** 3/3 testes Node passaram; Chromium percorreu o corredor com física real nos dois sentidos, em **2.257 / 2.265 frames** simulados. Foram **201 amostras de faixa** por sentido, com zero água e zero blocos; máximos de desvio lateral **1,425 / 1,459** unidades, **zero frames fora da faixa**, zero colisões, zero dano e zero erros JS. O ponto final foi atingido dentro da tolerância de 3,7 unidades em ambos os sentidos. Essa evidência **não** certifica a classificação da via no PS1, mas confirma o comportamento físico do trecho adaptado. O workflow geral das quatro cidades ainda tem uma falha anterior no teste isolado de texturas `tests/road-surface-style.test.cjs`, distinta da nova R39.

## R40 — transversal leste conectada à R39

A malha sul-leste foi ampliada por uma rua lateral de aproximadamente **162 unidades jogáveis**, partindo do nó de pavimento **918** da R39, em direção ao nó **1006** no lado leste. A cadeia registra **32 arestas originais**, 33 nós e o hash do levantamento, sem sobrepor as arestas das rotas R35–R39. Dados preservados em `chicago/reference-east-lateral-r40.json` e `chicago/reference-east-lateral-r40.js`.

O construtor `js/world/chicago-east-lateral-r40.js` suaviza a linha da fonte na projeção R15, usa 8 unidades de largura e encaixa sua origem num vértice construído da R39 a cerca de **1,58 unidade** do nó original para impedir uma emenda desconectada. Um círculo de pavimento de raio **8** consolida a entrada; a liberação só ocorre após conferir água e colisões na área do entroncamento e ao longo da rua. A rua é exclusiva de Chicago, entra no radar como `east-lateral-r40`, e não move missões nem cria carros adicionais.

**Testes efetivamente reproduzidos:** workflow dedicado `41207326041` passou com quatro testes Node, incluindo os 32 IDs de aresta, origem, integração e bloqueio de entrada alagada. O Chromium percorreu a R40 nos dois sentidos em **1.178 e 1.174 frames** de física arcade, respectivamente, com **144 verificações de pista por sentido**. Em ambos, foram detectadas **zero ocorrências de água, bloqueios, danos, frames fora da pista ou erros JavaScript**. Desvio máximo da linha central: **0,703 e 0,580 unidade**. O entroncamento estava efetivamente presente na cena. A publicação do código é rastreável pelo histórico de deploys do GitHub Pages.

**Limitações:** a rede continua adaptada ao Undercover, sem classificação de rua ou nivelamento confirmado diretamente no PS1. A presença de 16 corredores no radar **não** demonstra mapa completo. Manter auditoria das vias laterais, cruzamentos em diferentes níveis e textura dos setores originais antes de reposicionar as missões.

## R41 — transversal oeste ligada à R39, quadras e pintura viária

A partir do nó **601** da rede original de pavimento, a nova R41 segue até o nó **571** usando **25 arestas inéditas**, 26 nós e 43 pontos de geometria OBJ original. A rota é preservada em `chicago/reference-west-lateral-r41.json` e `.js`, com hash da mesma fonte dos corredores R35–R40 e exclusão explícita de todas as arestas previamente construídas. Após a transformação uniforme R15 e a adaptação por simplificação e suavização, são **aproximadamente 256 unidades adicionais de rua** em direção oeste, com pavimento de largura 8. O extremo final está aproximadamente em X=−98,23, Z=887,74 no mundo do jogo.

**Emenda sem rua fictícia:** o nó original 601 cai entre dois vértices da R39 porque a simplificação do traçado anterior retirou pontos intermediários. Em vez de usar um vértice a mais de dez unidades de distância ou inventar um corredor, o adaptador projeta o nó sobre o segmento da R39 mais próximo, respeitando tolerância máxima de 3 unidades. Um pavimento circular de raio 8 cria a junção, condicionado a sondas de água/obstrução em 24 ângulos e 3 distâncias, além da auditoria de todo o traçado de 8 unidades do construtor base. Nenhuma ligação é liberada apenas pela coincidência visual de ruas de níveis diferentes.

**Quadras e pintura:** o gerador de lotes R32 mantém afastamento das novas ruas, só coloca prédios após verificar água, colisores e todas as vias construídas, e produz fachadas pequenas residenciais e lojas baixas ao longo da R41, marcadas como zoneamento **aproximado**, não restaurado do PS1. O lote e a caixa de colisão compartilham as dimensões físicas. A pintura central R33, em uma única malha agrupada, agora também cobre os corredores R35–R41. Esses detalhes utilizam o streaming/LOD existente.

**Testes reproduzidos:** o workflow `41214384617` executou **4/4 testes de origem** e um replay de carro nos dois sentidos, em **1.804 / 1.809 frames**. Foram **216 amostras de largura de pista** por direção, sem água, bloqueio, dano ou saída de faixa. Desvio máximo medido **0,665 / 1,866 unidade**. Após acrescentar as fachadas e marcações, o teste de lógica completo também passou na revisão do arquivo `tests/chicago-r41-blocks.test.cjs`; o workflow R41 atualizado inclui os testes de quadras e repete a direção real para evitar regressões. O mapa SVG foi atualizado com a R41.

**Limitações:** o mapa registra agora **17 corredores adaptados**; isso ainda não representa um mapa completo ou topologicamente equivalente à Chicago de PS1. A rota oeste não certifica um laço de rua com a R40: a rede original analisada não autorizou tal conclusão. Faltam mais ramais de quarteirões, altura de cruzamentos, geografia validada por setor, detalhamento da água e, por último, reposicionamento e verificação das missões. O teste global de quatro cidades é tratado separadamente de testes específicos de uma rua.

## R42 — ramal sul conectado à transversal R41

A R42 acrescenta uma continuação aproximadamente norte-sul ao conjunto de ruas adaptadas de Chicago, usando exclusivamente **8 arestas inéditas** do grafo de pavimento de referência, com **9 nós e 9 pontos OBJ**, da origem **576** ao destino **1187**. A geometria original e a proveniência são conservadas nos arquivos `chicago/reference-south-stem-r42.json` e `.js`, com SHA256 da mesma referência dos trechos anteriores. Nenhuma aresta R35–R41 é reutilizada.

**Mundo físico:** a transformação compartilhada com as adaptações anteriores coloca a rua do entorno de **X=76,8 / Z=892** até **X=87,6 / Z=700,8**, aproximadamente **200 unidades jogáveis**. Seu início original fica a **~0,59 unidade** do pavimento da R41 já simplificado. A junção usa a projeção mais próxima sobre um segmento real da R41, em vez de conectar a um vértice distante. A faixa tem largura **8**, com um disco de entroncamento de raio **8** e sondagens de água/obstrução antes da criação física da rua. A verificação do restante do corredor aproveita a checagem da construção base R15.

**Morfologia urbana e LOD:** R32 reaproveita seus lotes e colisores compatíveis com chunks para produzir casas e comércios baixos dos dois lados, apenas após eliminar trechos alagados, obstruídos e lotes que invadiriam outras pistas. A distribuição é determinística e considerada **zoneamento aproximado**, não cartografia fiel e homologada do PS1. R33 adiciona pintura central de baixo custo na malha agrupada já existente. O novo caminho `south-stem-r42` também é desenhado no radar, totalizando **18 corredores de superfície adaptados**.

**Testes efetivamente reproduzidos:** o workflow dedicado executou **4/4 testes Node** de origem da referência, integridade e proteção da junção. No Chromium foi percorrido nos dois sentidos, com **1.388 / 1.396 frames**, **297 amostras de largura de pista por sentido**, zero amostras na água, zero colisões, zero dano, zero frames fora da faixa. Desvios máximos do eixo: **1,67 / 2,05 unidades**, para largura de 8. Depois disso foram adicionados os testes das fachadas, colisores, lotes e pintura, repetindo a auditoria no pipeline dedicado. O teste inicial falhou somente por contar pontos de vértice em vez de sondar cada trecho longo; a auditoria passou a amostrar a estrada aproximadamente a cada 3 unidades.

**Pendências:** a pista é extensão adaptada ao Undercover, **não certificada como rua ou via plana do original PS1**. Esta etapa não inventa conexão transversal inexistente, não reposiciona missões e não declara o mapa completo. Próximas tarefas: consolidar ramais paralelos e quadras conectadas, validar níveis dos cruzamentos da referência, completar bairros e só então reavaliar trajetos de campanha no novo mapa.

## R43 — fechamento do primeiro circuito de quadra entre R39, R41 e R42

A R43 é uma nova transversal com extremos nos nós **799 (R42)** e **792 (R39)**, usando **sete arestas inéditas** do levantamento `chicago/reference-network.json`: `[1087,1163,1126,1125,1083,1084,1076]`. A geometria original de nove pontos, os oito nós e o identificador da fonte são preservados em `chicago/reference-cross-link-r43.json` e em seu espelho `.js`. A construção da malha é **adaptada** ao Undercover: os nós fonte são projetados ao pavimento suavizado efetivamente construído da R42 e da R39. As duas junções são pavimentadas e protegidas por sondagens de água/colisores; o comprimento da ligação é da ordem de 70 unidades do jogo.

A conectividade da fonte certifica um **ciclo de 27 arestas distintas**, concatenando **R41 (601→576), R42 (576→799), R43 (799→792) e R39 (792→601)**. Trata-se de um fechamento real no grafo de pavimentos, e não de um atalho desenhado por aproximação entre duas ruas. O modelo 3D reproduz o fechamento com as duas extremidades alinhadas a segmentos efetivos das ruas existentes, mas a correspondência com níveis, classificação e coordenadas originais do PS1 permanece sem certificação. A geometria é visualizada em `docs/chicago-evolucao/mapa-chicago.svg`.

A R43 integra o radar em `cross-link-r43`, totalizando **19 corredores adaptados**. As faixas centrais passam por R43, e o gerador de quadras R32 também cria baixas construções comerciais/residenciais na transversal. Cada lote passa pelo controle de água, obstrução, distância das vias e colisores; o novo zoneamento é aproximado, não restaurado do PS1. As missões não foram reposicionadas.

**Evidências de QA reproduzidas no GitHub Actions:** workflow `41222618661` aprovou **6 testes Node**, incluindo ciclo topológico de origem e recuo de lotes, e percurso de carro nos dois sentidos no Chromium. O veículo percorreu a via em **513 / 514 frames**, com **192 amostras de faixa** por sentido e nenhum bloqueio, dano, ponto de água ou saída da faixa. Os desvios máximos da linha central foram **0,517 / 0,638 unidade**, com as duas malhas de entroncamento efetivamente montadas. O workflow mais recente `41222748099` e o QA completo de lógica `41222748057` também foram concluídos com sucesso após a correção de um teste R42 que dependia da posição da última via na lista de pintura.

**Pendências:** o circuito está confirmado como topologia de fonte e ruas dirigíveis individualmente; uma volta completa em veículo através dos quatro entroncamentos, com conversões, ainda precisa de um replay único antes de afirmar dirigibilidade integrada do circuito sem restrições. O mapa de Chicago continua incompleto; continuar quadras, conexões a bairros e auditoria de níveis de cruzamentos, sem atribuir precisão ou missões equivalentes ao PS1 antecipadamente.

## R43 — primeira volta completa de carro homologada pelo replay (31/10/2026)

O circuito `DriverChicagoR43BlockLoop` foi incorporado a `city.chicagoR43BlockLoop` para representar uma rota fechada inteiramente sobre as linhas de centro do pavimento já construído, respeitando a sequência **R41 → R42 → R43 → R39 → início**. Mede **305,740 unidades** e contém 53 pontos de referência adaptados. As quatro junções são calculadas por projeção sobre segmentos das vias realmente renderizadas, e não por pontes fictícias ou teletransporte. O circuito está preparado para orientar futuramente tráfego, missões e auditorias, mas não muda rotas de campanha nesta revisão.

**Falha diagnosticada e corrigida:** o piloto de teste original completava o percurso, porém alargava a curva da junção R41/R42 e registrava afastamentos superiores à largura útil da pista. Reduzir quase a zero a velocidade piorou a conversão porque o modelo arcade reduz a taxa de rotação do carro em velocidades baixas. A solução foi olhar antecipadamente para o próximo trecho antes da interseção e preservar velocidade suficiente para obter resposta da direção, sem alterar artificialmente posição, rumo ou velocidade do veículo entre frames.

**Evidências reproduzidas — GitHub Actions `41223535464`:** dez testes Node aprovados; replay real de um único carro por volta, **2.518 frames no primeiro sentido e 2.530 no inverso**, quatro corredores e três junções intermediárias cruzadas, final dentro de 3,5 unidades do início e progresso superior a 98,8% do perímetro. Desvio máximo **3,289 / 2,971** unidades. **Zero frames fora da pista, colisões, dano ou água** nos dois sentidos. Testes em `tests/chicago-r43-block-loop.test.cjs` e `tests/chicago-r43-block-loop-browser.cjs`. A malha R43 continua adaptada e não é certificação de coordenadas ou elevação do PS1.

## R44 — segunda quadra fechada a oeste da R42

A R44 liga **R41 (nó fonte 574)** a **R42 (nó fonte 846)** usando dez arestas inéditas da malha de referência: `[784,825,917,950,978,1000,1064,1122,1124,1161]`, 11 nós e 16 pontos originais. O traçado de referência se transforma em aproximadamente **137 unidades de rua** no mundo do Undercover, passando próximo a **X=45..79, Z=798..892**. Os arquivos `chicago/reference-parallel-west-r44.json` e `.js` preservam o identificador da malha e as geometrias, sem reutilizar arestas R35–R43.

A R44 se conecta ao pavimento físico já suavizado da R41 e da R42 mediante projeções dos nós originais, com distâncias de adaptação de aproximadamente **1,18 e 1,63 unidade**. Os dois entroncamentos recebem pavimentação e sondagens contra colisores/água. A via está integrada ao radar, às marcações agrupadas R33 e ao sistema R32 de lotes comerciais/residenciais baixos, com recuo de todos os corredores próximos, AABBs de colisão e chunks de LOD. A rede possui agora **20 corredores adaptados**.

O segundo circuito, `DriverChicagoR44BlockLoop`, liga **R41 → R42 → R44 → início** e é armazenado em `city.chicagoR44BlockLoop`. Seus testes Node provam a continuidade física sobre asfalto dos três trechos e a conectividade de seus nós originais, sem afirmar rua, interseção em nível ou localização original certificada do PS1. Diferentemente da primeira quadra R43, **ainda falta o replay de uma volta ininterrupta deste segundo circuito**; apenas a condução individual da R44 foi certificada.

**Evidências reproduzidas — GitHub Actions `41224316314`:** **9/9 testes Node**, a R44 dirigida em dois sentidos com **1.135 / 1.123 frames**, **348 amostras de pavimento por sentido**, sem água, bloqueio, dano ou saída de pista. Desvio lateral máximo **3,449 / 3,591** unidades numa pista de largura 8. A primeira execução falhou no piloto com visualização curta das curvas; o teste passou após antecipar curvas e usar o limite correto de largura de pista. Fonte e testes: `tests/chicago-r44-parallel-west.test.cjs`, `tests/chicago-r44-block-loop.test.cjs`, `tests/chicago-r44-parallel-west-browser.cjs`.

**Limitações gerais:** rede de referência extraída dos 54 setores, porém deslocada/transformada para o mundo procedural. O total de 20 corredores **não equivale a uma Chicago PS1 completa**; a classificação de cada faixa, elevações, edifícios históricos e percursos originais de missão ainda precisam ser auditados por setor. Preservar o jogo nas quatro cidades enquanto se acrescentam quadras e conexões validáveis.
