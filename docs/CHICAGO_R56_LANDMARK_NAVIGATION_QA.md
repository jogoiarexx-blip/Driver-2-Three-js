# Driver 2 Three.js — Chicago R56: radar e navegação aos marcos urbanos

## Entrega
Integrar Navy Pier, Wrigley Field e Soldier Field ao **radar do jogo principal**, mantendo HUD discreta e sem alterar checkpoints, missões, pontes, física, frota ou saves.

## R55 → R56
| Subsistema | R55 | R56 |
|---|---|---|
| Navy Pier, Wrigley, Soldier | 3 corredores com superfícies, placas e auditoria | Três destinos selecionáveis em botão **LOCAIS**; marcadores P/W/S no radar |
| Navegação | Auditoria local dos acessos | Planejamento opcional no grafo `DriverChicagoMixedNavigationR49`, validando também a entrada R55 |
| Radar | Missões, garagem, trânsito, rios, PS1 | Linha ciano segmentada **somente** quando a rota completa é validada |
| Sem rota | Não havia indicação específica | Mensagem «Sem caminho rodável confirmado» ou «Acesso bloqueado», sem inventar linha reta |
| HUD mobile | Radar e controles existentes | Menu compacto sobreposto, não ocupa outra coluna e fecha após escolher destino |
| Missões | Marcadores de campanha e Undercover existentes | A rota turística fica suspensa durante missão/interior/replay, sem alterar sua navegação |
| CPU/roteador | Tráfego e perseguições compartilham a malha | Reutiliza A* existente; cache evita replanejar todo frame, recalcula após deslocamento/ponte/build |
| Alternar cidades | Estado do mapa por cidade | Seleção descartada em cidades diferentes, sem destinos de Chicago em Havana/Vegas/Rio |

## Implementação
- `js/ui/chicago-landmark-navigation-r56.js` — selecionador, `plan`, `drawRadar`, atualização e auditoria.
- `js/engine/driver2-game-engine.js` — instalação e hooks do radar, HUD e mudança de cidade.
- `index.html` — controles LOCAIS e opções, carregamento em ordem antes do motor.
- `css/styles.css` — estilos responsivos, sem aumento permanente de informação sobre a tela.
- `tests/chicago-r56-landmark-navigation.test.cjs` — cinco regressões com fonte real do novo módulo e dependências viárias simuladas.
- `.github/workflows/chicago-landmarks-qa.yml` — executa suites R54, R55 e R56.

## Comportamento e limites
- Destinos: `navy-pier` P, `wrigley` W, `soldier` S.
- A linha é desenhada na mesma matriz do radar (espelhamento X e rotação do carro), **nunca** sobre o mapa sem verificação.
- O alvo da navegação é o **acesso externo** do estádio, não o campo interno. Wrigley exige abrir seu portão na interação já existente.
- A distância textual é **em linha reta**, não um ETA nem comprimento rodoviário certificado.
- Escolher a rota turística desativa apenas a seta opcional para casa; o jogador pode reativar a casa sem perder a missão.
- As coordenadas continuam aproximadas, no mundo procedural. Não atribuir fidelidade de escala ao mapa PS1.
- A página independente `chicago-original-drive.html` não usa este radar e não recebeu a atualização.

## Testes reproduzidos neste chat
5 testes passaram em execução de JavaScript com DOM e roteador simulados: seleção; bloqueios sem caminho falso; prioridade de missão/casa/mudança de cidade; desenho de radar; não repetir A* parado. As suites R54 e R55 passaram isoladamente anteriormente.

## Pendências reais
**Ainda não há validação visual WebGL/jogabilidade nem confirmação externa do GitHub Pages.** Verificar em navegador e celular: legenda legível, seleção por toque, atualização de trajetos com ponte elevada, rotas longas completas, desempenho, enquadramento do radar e retorno à navegação de missões. Sem planejar uma linha se a malha não conectar o destino.

## Auditoria em execução
```js
DriverChicagoLandmarkNavigationR56.audit(DriverGame)
DriverChicagoLandmarkAccessR55.audit(DriverGame.city)
```
`routeAvailable:true` só deve aparecer quando o planejador comprovar ligação viária e acesso R55.
