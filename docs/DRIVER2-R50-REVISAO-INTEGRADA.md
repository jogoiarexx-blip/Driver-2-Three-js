# Driver 2 — Revisão R50 integrada (31/10/2026)

## Objetivo
Corrigir o defeito da estação, dar acabamento à interface e ao cenário, melhorar a água, expandir a conectividade de Chicago e instrumentar diagnóstico de desempenho.

## Alterações implementadas

### HUD
- Velocímetro mantém ponteiro analógico e leitura km/h, mas agora é **somente um círculo**, sem bloco retangular de câmbio, RPM e nome do carro.
- IDs existentes permanecem no DOM para compatibilidade da engine e não aparecerem erros de JavaScript.
- Barras de dano/delito, objetivos, radar e controles mobile foram preservados; painéis menores e transparentes para melhor leitura.

### Estação ferroviária
- `CityBuilder.getGroundHeightAt(x,z,referenceY,forVehicle)` distingue o piso usado por carros daquele usado por Tanner.
- Carros continuam no solo sob a plataforma e na zona da rampa pedonal.
- Corrimãos da subida seguem com colisão para o pedestre, mas não se transformam em paredes invisíveis para carros.
- Nove marcas de piso antiderrapante são renderizadas com **um** InstancedMesh na própria rampa.
- Não foram alterados o terminal, o trem ou os checkpoints.

### Textura d'água
- Canvas procedural de **96 × 96 pixels** feito uma vez por carregamento, compartilhado pelo rio principal, pelos braços de Goose Island e pela costa do Lago Michigan.
- Ondulações por deslocamento suave das coordenadas da textura; sem render target, reflexo em tempo real ou carregamento de imagem.
- Textura recriada depois de reconstruir a cidade, evitando referenciar dados gráficos já liberados.

### Postes e semáforos
- Postes ganharam pedestal e braço de luminária em lotes instanciados, preservando a possibilidade de derrubá-los.
- Semáforos ganharam base e viseira com baixo custo adicional; cores e ciclos anteriores foram mantidos.
- Não há novas PointLights por poste ou semáforo.

### Geografia e ruas
- Novo setor **R50 North River**, ao norte do canal, com 6 quadras liberadas, 5 eixos viários, 6 cruzamentos, 10 conexões com as avenidas existentes, 24 quadrantes de calçada e 12 edifícios com colisores.
- O novo setor soma **960 unidades de eixo de via** aos 960 do setor R48, com 10 corredores e 20 acessos à malha antiga, considerando os dois setores.
- O roteador A* de Chicago (R49) foi ampliado para incluir os cruzamentos do setor R50, conectando os setores norte e sul pelas travessias existentes.
- Até 4 novos carros civis adicionais podem ser criados na zona norte. Junto aos 4 da R49 sul, são até 8 carros adicionais usando destinos variáveis; o total real depende dos testes de segurança dos pontos de geração.
- As novas ruas aparecem no minimapa. Não alteramos os waypoints das missões e mantivemos os assets GLB.
- **Importante:** isto **não termina a reprodução de toda Chicago do PS1**, porque ainda existem bairros e geometrias de referência não homologados nem integrados em escala 1:1. O projeto continua utilizando a malha procedural adaptada.

### Telemetria
- Pressione **F8** no jogo para abrir/fechar o painel opcional.
- Exibe FPS médio do intervalo, tempo médio/pior de frame, quadros acima de 45 ms, quantidade de veículos e NPCs, veículos sinalizados na R49, possíveis congestionamentos, aumentos de dano e carros acima do solo na área da estação.
- Amostragem a cada ~1s, sem leitura do WebGL nem transferência para a rede.
- Carros parados são **indicadores de possível problema**, não uma prova de travamento permanente; sem replay visual a classificação ainda pode incluir espera por tráfego.

## Verificações e limites
- Verificações sintáticas dos arquivos JavaScript principais: aprovadas.
- R50: 8 testes de lógica adicionados, cobrindo topologia, caminhos norte–sul, frota, piso da estação, telemetria, interface, textura e postes.
- A execução isolada passou com um ambiente simulado; a textura também foi testada com canvas simulado e provada a reutilização/recriação.
- Na simulação, a malha combinada R48+R50 formou 113 nós e 190 conexões; esses números não são garantia dos números em uma partida real.
- **Ainda não foi executada uma sessão completa de navegador com controles reais e análise visual**; a página do GitHub Pages e o resultado final da Action de QA não puderam ser confirmados desta sessão.

## Pendências
1. Jogo real no Chromium e celular: circular sob a estação, entrar no trem a pé e repetir passagem 20 vezes.
2. Testar 10+ minutos de IA de trânsito e perseguição, com F8 e captura de picos de frame.
3. Validar colisões e renderização dos setores R48/R50 contra modelos e obstáculos de missões.
4. Continuar digitalização/comparação do traçado PS1 para concluir o mapa sem declarar fidelidade inexistente.
