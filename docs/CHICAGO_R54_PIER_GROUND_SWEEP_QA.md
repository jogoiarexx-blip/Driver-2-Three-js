# Driver 2 Three.js — Chicago R54

## Problema confirmado na R53 (análise estática e regressão)
A malha de madeira do Navy Pier tem superfície em `y=0.54`, mas `CityBuilder.getGroundHeightAt()` não retornava essa altura. Carros ficavam com rodas atravessando a malha. Uma caixa visual na entrada em `x=333` atravessava toda a faixa em `y≈1`, sem colisor. E o veículo só testava a colisão na posição **final**, podendo atravessar objetos estreitos em um frame com deslocamento grande.

## Alterações R54
- `js/world/chicago-neighborhoods.js`: rampa física/visual de `x=320` até `x=327` e malha de entrada conectada ao deck (`y=0.54`); viga antiga em altura baixa substituída por marquise a `y=4.55`.
- `js/world/city-builder.js`: `getGroundHeightAt()` usa `DriverChicagoPierStadiumR53.deckHeightAt(x,z)` somente em Chicago, antes da máscara aquática. Resultados: `(320,-40)=>0`, `(323.5,-40)=>0.27`, `(327,-40)=>0.54`, `(379,-40)=>0.54`.
- `js/world/chicago-pier-stadium-r53.js`: dois pilares sólidos na entrada, sem bloquear o corredor central; `needsSweep()`, `pathBlocked()`, `deckHeightAt()`; auditoria da altura do píer e de abertura da passagem.
- `js/vehicles/driver-vehicle.js`: amostragens intermediárias no deslocamento do carro nas proximidades do Navy Pier, Wrigley Field e Soldier Field. Fora das três regiões o código mantém a checagem anterior, evitando alterar o custo global da física.
- `tests/chicago-r54-physics.test.cjs`: 5 testes de regressão (sem dependências externas) com as fontes reais e cena Three.js simulada.
- `.github/workflows/chicago-landmarks-qa.yml`: executa `node --test tests/chicago-r54-physics.test.cjs` após mudanças relevantes.

## Resultado dos testes
Cinco verificações passaram: altura e inclinação, colisão de guarda-corpos/pilares, prevenção contra atravessamento rápido, iluminação/giro da roda, preservação do campo e portão do estádio, ausência de duplicações ao chamar a construção repetidamente. As fontes `CityBuilder`, `DriverVehicle` e `DriverChicagoPierStadiumR53` passaram análise de sintaxe.

## Restrições
Os testes foram reproduzidos com objetos Three.js simulados, sem renderização WebGL. **Ainda falta uma partida de navegador** para validar visualmente a suspensão, o ângulo da rampa, a iluminação à noite, a colisão real com ônibus, o portão de Wrigley e o FPS em dispositivos móveis. Não declarar esses cenários como aprovados antes de reproduzi-los.

## Modo coberto
Esta revisão altera **Undercover e Passeio Livre do jogo principal**; a página independente `chicago-original-drive.html` mantém um conjunto diferente de arquivos e não recebe automaticamente os marcos procedurais da R54.

## Auditoria in-game
No console após entrar em Chicago:
```js
DriverChicagoPierStadiumR53.audit(DriverGame.city)
```
Esperado: `bulbs:48`, `seats:84`, `visibleColliderCount:13`, `rampHeightAtMiddle:0.27`, `platformHeight:0.54`, `gatePreserved:true`, `pierDry:true`.
