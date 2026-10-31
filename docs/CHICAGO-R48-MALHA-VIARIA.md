# Chicago R48 — expansão viária entre bairros

## Entrega
A Chicago procedural de Undercover e Take a Ride ganhou um setor conectivo ao sul do canal. É uma expansão jogável aproximada, **não** uma reprodução certificada da escala e geometria do Driver 2 do PS1.

### Componentes incorporados
- Seis células de quarteirão liberadas antecipadamente: x=40/120/200, z=-120/-40.
- Cinco corredores: dois leste-oeste de 240 unidades e três norte-sul de 160, total de 960 unidades de eixo de via (sem contar a grade anterior).
- Seis cruzamentos internos, sete ligações entre cruzamentos e dez saídas para a malha antiga em x=0/240 e z=-160/0.
- 24 quadrantes de calçada, 12 edifícios de pequeno porte com colisores fora das faixas; marcações e travessias usam InstancedMesh.
- Quatro trajetos civis, dois internos e dois utilizando avenidas antigas, com seis carros novos e controle de distância/velocidade.
- Cinco ruas exibidas no radar sem substituir os caminhos pré-existentes.

### Integração
Os dois modos de Chicago utilizam o mesmo construtor de cidade e a mesma rotina de geração de frota. O setor é esculpido antes dos prédios e montado depois dos corredores anteriores. Somente veículos civis marcados como r48 recebem a IA especial; viaturas, veículos de missão, outras cidades, saves e modelos GLB personalizados continuam usando suas regras existentes.

### Validação
O módulo verifica água e colisões ao longo dos 17 segmentos e não habilita os trajetos do novo setor se a rede estiver bloqueada. O teste automatizado de regressão confirma topologia, conectividade, travessias, colisores, circuitos civis, integração e radar. Executar: node --test tests/*.test.cjs.

Os testes de lógica não substituem direção real em navegador, inspeção visual, medições de desempenho e validação do GitHub Pages. Os novos corredores não são chamados de estradas originais certificadas do PS1.

### Próximos trabalhos estruturais
1. Replay real de trânsito/pedestres e análise de colisões com GLBs em desktop e celular.
2. Roteamento da polícia usando o grafo misto (grade de 80 + ruas secundárias).
3. Expansão bairro a bairro com landmarks, escala e malha viária comparados às fontes originais.
