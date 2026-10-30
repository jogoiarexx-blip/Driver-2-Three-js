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
