# Driver 2 Three.js — Chicago R55: acessos aos marcos urbanos

## Escopo concluído
Evolução estrutural da R54 para os três marcos existentes na **Chicago procedural** dos modos Undercover e Take a Ride principais. A página de Chicago Original (mapa PS1 importado) não foi modificada.

## Diferenças verificáveis R54 → R55

| Tema | R54 | R55 |
| --- | --- | --- |
| Navy Pier | Deck, rampa e colisores, sem traçado de acesso | Conexão visual dirigível desde o eixo x=320 ao ponto de desembarque x=359, com piso de cor madeira e marcas de rota |
| Wrigley Field | Estádio, portão, carro secreto e arquibancadas | Corredor da rua z=240 até a entrada z=222.5, sinalização e terreno do gramado fisicamente alinhado a y=0.08 |
| Soldier Field | Estádio com gramado y=0.55 e arquibancadas | Corredor da rua z=-240 até a entrada z=-267, sinalização e altura física y=0.55 |
| Colisões | Guarda-corpos, quiosques, bases e stands | Mais 3 colisores finos nas bases de postes; vias só são desenhadas quando o trajeto central passa na verificação de água + paredes |
| Pintura | Não havia faixas para os acessos | Marcas direcionais e faixas instanciadas em 2 lotes por acesso, normais voltadas para cima |
| Noite | Roda-gigante e estádios iluminados | Placas de entrada respondem ao mesmo nível noturno, sem PointLight adicional |
| Diagnóstico | `DriverChicagoPierStadiumR53.audit(city)` | `DriverChicagoLandmarkAccessR55.audit(city)` relata corredores, altura dos campos e checagem hídrica |

## Traçados (unidades do mundo procedural)
- Navy Pier: `(320,-40) → (359,-40)`; a rota termina antes dos suportes físicos da roda.
- Wrigley Field: `(-280,240) → (-280,222.5)`; o trajeto externo está livre, mas **o portão do estádio permanece fechado até o jogador abri-lo pelo mecanismo original**.
- Soldier Field: `(280,-240) → (280,-267)`; acesso central aberto entre as arquibancadas.

Esses traçados estão sincronizados com a malha 80m usada pelo jogo atual e **não foram extraídos geometricamente da ROM original do PS1**.

## Implementação
- `js/world/chicago-landmark-access-r55.js` (novo): construção de vias de acesso com alturas amostradas do mundo, placas, testes de percurso, atualização noturna e auditoria.
- `js/world/city-builder.js`: alturas internas dos campos e limpeza de estado entre cidades.
- `index.html`: integração do módulo antes do construtor principal.
- `tests/chicago-r55-landmark-access.test.cjs` (novo): cinco regressões usando os módulos reais sobre um Three.js de cena simulado.
- `.github/workflows/chicago-landmarks-qa.yml`: agora executa as suites R54 e R55 em Node 22.

## Testes reproduzidos
Os 5 testes R55 passaram em uma execução isolada dos módulos atuais: (1) três acessos livres com malhas de normal vertical correta; (2) alturas do gramado e da rampa; (3) abertura do portão Wrigley; (4) colisores de postes sem fechar as vias; (5) atualização noturna, ausência de duplicação e compatibilidade com R54. O conjunto R54 havia passado na revisão anterior. O workflow Node 22 foi atualizado, mas seu resultado remoto ainda requer confirmação.

## O que ainda precisa ser medido jogando
Verificar no navegador WebGL a geometria da passagem desde as avenidas, sombra e reflexos no cais, colisão com ônibus/caminhões largos, interação a pé junto às placas, carros policiais nas conexões e FPS móvel. **O teste de cena simulada não equivale a jogar o game real**. A publicação do GitHub Pages não foi confirmada externamente, apenas os commits na main.

## Auditoria no console
```js
DriverChicagoLandmarkAccessR55.audit(DriverGame.city)
DriverChicagoPierStadiumR53.audit(DriverGame.city)
```
Esperado na Chicago procedural: `installed:true`, `routes.length:3`, todas rotas `open:true` em build padrão, gramados `0.08` e `0.55`, roda `bulbs:48`, portão preservado. Se algum trecho estiver bloqueado por novos módulos posteriores, o auditor reportará `reason:'wall'` ou `reason:'water'`.

## Próximas prioridades
- Validar o build efetivamente publicado usando navegador com WebGL e controles, sobretudo entrada e saída do píer.
- Integrar marcos no mapa/minimapa com seleção e rotas do jogador sem mover missões.
- Melhorar LOD dos objetos do píer, placas e estádios quando distantes.
