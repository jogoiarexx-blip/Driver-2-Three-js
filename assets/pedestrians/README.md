# Personagens GLB do usuário — Driver 2 Three.js

O jogo usa **28 vagas lógicas reutilizáveis** para humanos e cães (sem NPCs
procedurais). Há agora **15 modelos GLB cadastrados**: os cinco originais
e dez adições, incluindo **duas crianças** e **três cachorros**.

| Modelo | Tipo | Altura visual alvo |
| --- | --- | --- |
| menina.glb | criança | 1,27 m |
| menino.glb | criança | 1,32 m |
| pastor alemao.glb | cachorro maior | 0,87 m |
| mailou.glb | cachorro menor | 0,59 m |
| cachorro 3.glb | cachorro menor | 0,54 m |
| homem velho.glb | idoso | 1,80 m |
| assets/velho 2.glb | idoso | 1,79 m |
| velho cauvo.glb | idoso | 1,78 m |
| mulher de saia.glb | adulta | 1,96 m |
| pedestre_feminina_4_CORRIGIDA_FINAL.glb | adulta | 1,97 m |

Os cinco originais continuam: mulher_walk, Pedestre_Masculino_Driver2,
mendingo, mulher 2 e mulher 3. As alturas são definidas pelo bounding box
vertical do modelo (a proporção vem da escala integral do GLB) e o ponto mais
baixo encosta na calçada. Os três cães reutilizam o sistema de movimentação
das calçadas, sem adicionarem colisores nem missões.

## Carregamento e animações

Os GLBs são carregados tanto no **UNDERCOVER** (entrada e missão ativa)
quanto no **TAKE A RIDE**, usando as mesmas 28 vagas. As duas crianças e
os três cachorros têm prioridade no carregamento para aparecerem
rapidamente também quando a campanha começa, sem aguardar todos os adultos.

Os GLBs são carregados durante a partida e reutilizados entre cidades.
Os novos modelos são carregados **sequencialmente**, e cada GLB disponível
preenche suas vagas assim que chega. As demais vagas usam cópias
independentes de GLBs já prontos, compartilhando geometria e texturas.

Para os novos modelos, o adaptador procura animações Walking, Walk, Andar,
Trot ou Locomotion, depois Running/Idle e, se necessário, usa uma pose
estática (o personagem aparece mas sem passos articulados). Isso protege
o jogo contra GLBs sem animações padronizadas. Os modelos originais
preservam suas animações e comportamento anteriores.

Nenhum corpo humano ou animal gerado proceduralmente é usado como fallback.
Se todos os GLBs falharem, a vaga fica invisível.

## Verificação pelo console

Após iniciar Chicago ou outra cidade, execute:

```js
DriverGame.pedManager.uploadedCrowd.status()
DriverGame.pedManager.variantPedestrians.status()
```

Verifique `loadedModels` (alvo: 15), `filledSlots` (alvo: 28),
`speciesCount` (pelo menos 2 crianças e 3 cachorros com todos os modelos
carregados), `proceduralCivilians` (sempre 0), `models[].error`
e `staticPose` de cada novo asset. Durante o carregamento, `loadedModels`
sobe progressivamente; falhas de rede podem reduzir a variedade.

As vagas são redistribuídas em todas as cidades. A IA de semáforos,
esquiva e travessia, o mapa e as missões continuam inalterados.

## Para adicionar um novo GLB

1. Subir o GLB para `assets/pedestrians/`.
2. Cadastrar um `id`, `url`, `pedestrianIndex` exclusivo, `height`,
   `species` (adult, child, dog) e, se quiser, `walkSpeed` em
   `js/assets/driver-pedestrian-variants.js`.
3. Rodar `node --test tests/pedestrian-variants.test.cjs` e publicar.

Não é possível descobrir automaticamente os novos GLBs em GitHub Pages,
que não permite listagem estática de diretório.
