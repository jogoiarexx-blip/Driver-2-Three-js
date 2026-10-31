# Driver 2 Three.js — Chicago R57: orla, acessos secundários, estacionamentos e LOD

## Contexto e abrangência
Evolução da Chicago **procedural adaptada**, válida para Undercover e Passeio Livre do jogo principal. A topologia **não** é um mapa extraído nem geometricamente homologado da ROM do Driver 2 PS1. A página independente `chicago-original-drive.html` não usa essa camada.

## Resumo das mudanças reais

| Sistema | R56 | R57 |
| --- | --- | --- |
| Navy Pier | Acesso primário até o píer e radar turístico | Acesso secundário via `(320,-80) → (341,-40)`, calçadão e proteção da margem |
| Wrigley Field | Entrada central, estacionamento ausente | Acesso lateral oeste via `(-320,240) → (-280,225)`, áreas de estacionamento dos dois lados |
| Soldier Field | Entrada central, estacionamento ausente | Via secundária leste `(320,-240) → (280,-257)`, áreas de estacionamento dos dois lados |
| Parqueamento | 0 vagas dedicadas junto aos três marcos | 6 áreas, 24 vagas demarcadas no cenário de referência dos testes |
| Orla do lago | Contorno procedural e deck | 14 segmentos de guarda-corpos sólidos coincidindo com malhas visíveis e cerca de 100 m de calçadão de extensão acumulada |
| Rede viária | Grafo R49 para avenidas e R48–R53 | +14 trechos secundários **se validados na construção**, incluídos com gateways subdivididos no grafo A* |
| Renderização | Detalhes do píer/estádios sempre visíveis | LOD local com histerese 170/235 m para mobiliário novo e 190/250 m ou 210/280 m para detalhes legados R53 |
| Segurança | Colisão local do píer e arquibancadas | Guardrails novos com AABB alinhado à malha; sem parede fictícia nos estacionamentos ou nas faixas |
| Carregamento | Fontes R56 | Novo módulo carregado antes de CityBuilder, ligado ao ciclo de vida da cidade e ao atualizador LOD; versões de script atualizadas para evitar cache obsoleto |

## Arquivos
- `js/world/chicago-landmark-district-r57.js`: ruas complementares, estacionamento com vagas demarcadas, promenade, guarda-corpos, batches, LOD com carregamento tardio.
- `js/world/city-builder.js`: construção depois do restante da geografia e atualização com a posição do jogador; reset ao trocar de cidade.
- `js/traffic/chicago-mixed-navigation-r49.js`: incorpora arestas e gateways R57; acessos de serviço de mão única geométrica usam verificação central da largura realmente transitável. Não muda o teste de duas faixas da malha principal.
- `index.html`: carga do novo módulo e versionamento do cache do roteador e construtor.
- `tests/chicago-r57-landmark-district.test.cjs`: seis testes de regressão para segurança física, conectividade A*, número de vagas, ausência de duplicação e LOD.
- `.github/workflows/chicago-landmarks-qa.yml`: roda R54, R55, R56 e R57 com Node 22.

## Testes reproduzidos em ambiente simulado
- R54: 5/5
- R55: 5/5
- R56: 5/5
- R57: 6/6
- **Total: 21 verificações aprovadas em execuções isoladas com mocks de cena e roteamento.** O teste de conectividade R57 inicialmente falhou porque o roteador exigia duas faixas com afastamento de 1,7 m; a regra foi corrigida somente para essas vias secundárias. O A* depois encontrou três trajetos verificáveis entre os acessos e a rede principal.

## Política física e de desempenho
As vagas e o asfalto das vias são superfícies desenhadas, não colisores volumétricos. Os guarda-corpos são colisores AABB somente quando existe uma malha física coincidente. O cenário original de colisões continua ativo mesmo quando os detalhes decorativos desaparecem com LOD. Nenhuma mudança é aplicada a Havana, Vegas ou Rio.

O LOD de mobiliário novo é carregado apenas quando o jogador se aproxima; a troca usa histerese e no máximo uma seção a cada 160 ms. Os detalhes antigos das arquibancadas e do píer são ocultados em distância elevada, mas não o contorno da roda, os volumes físicos ou as estruturas necessárias para orientação.

## Limitações e verificação manual pendente
Os números **24 vagas, 14 trilhos/guarda-corpos e 14 segmentos de grafo** provêm de um mundo de teste simplificado, com os módulos reais principais mas sem todos os prédios/obstáculos do carregamento completo. O jogo pode legitimamente rejeitar uma vaga ou um acesso quando outras entidades os bloquearem; isso é registrado na auditoria.

**Ainda não foram executadas partidas reais em navegador WebGL**, nem verificados FPS mobile, comportamento de trânsito de NPCs nas vias novas, colisões com ônibus e vagas, transição visual de LOD e propagação GitHub Pages. A verificação remota do workflow Actions também não foi confirmada. Não tratar os testes de cena simulada como teste do gameplay inteiro.

## Diagnóstico no console
```js
DriverChicagoLandmarkDistrictR57.audit(DriverGame.city)
DriverChicagoLandmarkAccessR55.audit(DriverGame.city)
DriverChicagoLandmarkNavigationR56.audit(DriverGame)
```

A auditoria R57 expõe `approaches`, `parking`, `totalSpaces`, `shore.rails`, `graphEdges`, `lod`, `lodSwitches` e `legacyDetails`. Se alguma ligação estiver bloqueada, ela **não** será adicionada ao grafo viário.

## Próxima prioridade
Reproduzir uma partida com WebGL e gamepad, medir FPS e NPCs cruzando vias secundárias; só então dimensionar mais construções da margem, ampliar Chicago de forma coerente com as referências PS1 e refinar travessias/estacionamento de veículos maiores.
