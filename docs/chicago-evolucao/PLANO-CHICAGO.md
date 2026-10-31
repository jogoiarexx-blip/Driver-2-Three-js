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
