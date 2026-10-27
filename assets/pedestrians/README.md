# Pedestre feminina animada

O jogo foi preparado para uma pedestre feminina usando o arquivo **mulher_walk.glb**.

## Instalação do arquivo binário

1. Abra esta pasta no GitHub.
2. Clique em **Add file → Upload files**.
3. Envie `mulher_walk.glb` do pacote disponibilizado no chat.
4. Clique em **Commit changes** na branch `main`.

Caminho obrigatório: `assets/pedestrians/mulher_walk.glb`.

O arquivo contém o modelo low-poly feminino otimizado, esqueleto preservado e animação `Walking_Woman`. O sistema mantém 28 pedestres com a IA original; apenas uma personagem usa o GLB. Quando o arquivo está ausente, o jogo mantém o pedestre procedural como fallback.

## Diagnóstico

Durante o jogo, abra o console e execute:

`DriverGame.pedManager.femalePedestrian.status()`

`state: 'ready'` e `active: true` confirmam que o modelo foi carregado. `state: 'missing'` indica que ainda não foi publicado no caminho acima.
