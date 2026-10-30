# Ônibus escolar do usuário — Driver 2 Three.js

## Integração de carroceria

O veículo `ÔNIBUS URBANO V8` foi substituído por `ÔNIBUS ESCOLAR`.
A lógica original foi preservada: `bodyStyle: 'bus'`, física arcade,
colisor de **2,72 m × 8,00 m**, aceleração, freios, tráfego, missões
e possibilidade de entrar/sair. Não é criado um segundo ônibus.

A carroceria vem exclusivamente do arquivo enviado pelo usuário:

`assets/vehicles/onibus escolar.glb`

O carregamento está configurado em `js/assets/uploaded-vehicles.js` pelo
identificador `school-bus`. O arquivo deve estar nesse caminho exato,
inclusive o espaço no nome, para que o GitHub Pages encontre o GLB.
A aplicação roda em hospedagem estática, sem listagem automática de pastas.

### Situação do binário

**Pendente de inclusão do GLB no GitHub.** A integração no JS foi publicada,
mas o conector do GitHub não permite transmitir diretamente o upload binário
recebido no chat. O usuário precisa usar `Add file → Upload files` dentro
de `assets/vehicles/` e enviar o GLB otimizado disponibilizado no chat,
renomeado para `onibus escolar.glb`, ou o original com esse nome.

Até que o arquivo esteja publicado, o ônibus original conserva a
carroceria procedural para que o jogo nunca tenha um veículo invisível.

### Ajuste de escala

O modelo enviado tem dimensão aproximada `0,954 × 0,418 × 0,426` no sistema
de coordenadas original (X é comprimento, Y altura, Z largura).
O adaptador rotaciona 90 graus para alinhar o comprimento a Z, depois ajusta
X/Y/Z separadamente a **2,72 × 3,45 × 8,00 m**. Ele centraliza a base ao
piso preservando as rodas desenhadas na textura e toda a malha original.
Não inventa novas rodas, animações, materiais nem colliders.

### Diagnóstico do navegador

Depois de abrir o jogo e iniciar uma partida:

```js
const g = DriverGame;
const bus = g.vehicles.find(v => v.uploadedModel === 'school-bus');
console.log(g.freeVehicleAssets.uploaded.states['school-bus']);
console.log(bus?.name, bus?._uploadedCustomModel,
            DriverVehicleCollisions.dimensions(bus));
```

Depois da instalação, a situação esperada é `ready`,
`school-bus` e comprimento físico `8`.

O modelo é carregado uma vez e reutilizado ao mudar de cidade.
Para alternar modos `GLB/PS1`, use o botão de modelos existente.

### Testes

- `node --test tests/uploaded-vehicles.test.cjs` confirma identidade,
  integração, garagem e física do ônibus.
- O teste do binário é explicitamente ignorado até que o GLB exista
  na pasta. Após o upload, esse teste passa a executar.
- `node tests/uploaded-vehicles-browser.cjs` testa o navegador quando
  o ambiente Playwright estiver preparado.
