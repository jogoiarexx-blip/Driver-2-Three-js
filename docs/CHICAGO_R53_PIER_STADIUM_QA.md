# Chicago R53 — Navy Pier, roda-gigante e estádios

## Objetivo
Corrigir o Navy Pier e seus obstáculos, animar a roda-gigante com iluminação noturna e aproximar os estádios do mapa de Chicago de Driver 2 (PS1), sem mudar missões, navegação nem estradas funcionais.

## O que foi implementado
- Navy Pier preserva o deck (aprox. x=327..411, z=-48..-32), a entrada livre por oeste e a máscara seca já usada pela física.
- Guarda-corpos e fechamento de extremidade com colisores AABB iguais aos elementos visíveis; bases da roda-gigante e três quiosques também possuem colisores.
- Roda-gigante existente preservada, com aros duplos, 48 lâmpadas instanciadas, giro contínuo e dez cabines visualmente niveladas ao horizonte.
- Luzes noturnas com intensidade derivada de DriverChicagoNightLights, sem um PointLight individual por lâmpada.
- Wrigley Field, em (-280,200): 84 peças de arquibancadas instanciadas, três AABBs seguindo o volume das arquibancadas, iluminação, placar e letreiro TICKETS. Portão, carro secreto e abertura a pé intactos.
- Soldier Field, em (280,-280): gramado, arquibancadas, entrada aberta, placar, torres de luz e colisões apenas nas estruturas reais. Situa-se a oeste da área Meigs Field.
- O antigo estádio decorativo deslocado em (-280,-280) foi substituído por um entreposto ferroviário, evitando duplicação do Wrigley.
- Limpeza dos estados de céu/noturno e dos pontos turísticos ao trocar ou recarregar a cidade.

## Arquivos
- `js/world/chicago-pier-stadium-r53.js`: módulo novo de decoração, física, animação e relatório `DriverChicagoPierStadiumR53.audit(city)`.
- `js/world/city-builder.js`: Soldier Field, depósitos ferroviários e reinicialização de estados.
- `js/world/chicago-overhaul.js`: detalhes urbanos corretos de cada marco.
- `index.html`: carrega o novo módulo antes da criação da cidade.

## Verificações reproduzidas
Passaram validação sintática dos três scripts, ordem de carregamento no HTML e smoke test em uma cena Three.js simulada:
1. O caminho central do píer não está bloqueado por um AABB novo.
2. Os guarda-corpos, a extremidade e as bases retornam colisões nos pontos previstos.
3. O campo central do Wrigley não fica bloqueado, mas suas arquibancadas ficam.
4. Há 48 lâmpadas e 84 segmentos de arquibancada instanciados.
5. A roda-gigante avança em cada passo de animação e as cabines permanecem verticais.
6. A intensidade dos materiais aumenta à noite.
7. O segundo build da mesma cidade não duplica os colisores.
8. O portão original continua referenciado e o deck continua marcado como seco.

## Validação manual pendente no navegador
Testar colisão real com veículos de diferentes larguras em velocidade, caminhada junto ao portão do estádio, entrada na arquibancada e incidência visual de luzes à noite; verificar GPU/framerate em aparelhos móveis. Os testes automatizados de geometria não substituem jogar e renderizar no browser.

## Limite de fidelidade
As posições de marcos são coordenadas **aproximadas** na cidade procedural do Undercover e Passeio Livre do jogo principal. Não há confirmação de equivalência geométrica exata da ROM do PS1. A página separada `chicago-original-drive.html` continua independente desta atualização.

## Teste no console do navegador
```js
DriverChicagoPierStadiumR53.audit(DriverGame.city)
```
Esperado na cidade Chicago construída: `installed: true`, `seats: 84`, `bulbs: 48`, `visibleColliderCount: 11`, `pierDry: true`, `gatePreserved: true`, `soldierFieldAt: [280, -280]`.
