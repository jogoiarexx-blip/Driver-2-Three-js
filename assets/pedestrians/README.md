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

## Pedestre masculino com pistola — integrado

O arquivo **Pedestre_Masculino_Driver2_Atirar_Com_Pistola.glb** já está no repositório e foi conferido por SHA com o arquivo enviado pelo usuário. **Não é necessário reenviar.**

- Carregado por `js/assets/driver-male-pedestrian.js`, na vaga de índice **1** do conjunto original de 28 pedestres. A vaga 0 continua feminina.
- Preserva **Walking, Running, Aim_Pistol, Shoot_Pistol e Shoot_From_Idle**. O movimento padrão usa caminhada; nas travessias usa corrida. A pistola acompanha o rig, mas o civil **não atira automaticamente**.
- Escala de **2,08 m**, origem ajustada aos pés, frente em **+Z** para acompanhar a direção da IA.
- Usa as mesmas calçadas, semáforos, IA, esquivas e colisões existentes. Mantém o procedimento de fallback se o GLB não estiver disponível.

Para conferir no navegador com o jogo iniciado:

```js
DriverGame.pedManager.malePedestrian.status()
```

O esperado é `state: 'ready'`, `active: true` e `pedestrianIndex: 1`.
