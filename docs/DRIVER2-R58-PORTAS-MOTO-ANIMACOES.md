# Driver 2 — R58: animações de veículos, portas e motocicleta

Data: 31/10/2026. Arquivos atualizados diretamente na branch `main` do repositório `jogoiarexx-blip/Driver-2-Three-js`.

## Problemas encontrados no código antes da revisão

1. Carros procedurais possuíam chassi, teto e rodas, mas **nenhum objeto de porta com dobradiça**. As transições de entrada/saída do Tanner simulavam apenas a passagem para o banco; a porta não abria.
2. A sequência de entrada congelava ou escondia o ator nos últimos quadros. Na moto, faltavam fases finais contínuas de encaixe ao assento.
3. A motocicleta nativa tinha apenas chassi em caixa e duas rodas: não apresentava guidão animado, tanque, banco, garfo, motor ou apoios.
4. A pose de montar a moto **não espelhava a perna de acordo com o lado de aproximação**.
5. Se o GLB real de Tanner ainda não tinha carregado, o piloto de emergência da moto não aparecia depois da entrada. E, na saída, havia risco de mostrar piloto provisório e Tanner juntos.
6. Os alvos do IK de mãos e pés precisavam respeitar diferenças entre a motocicleta procedural e a moto GLB carregada.
7. A malha WebGL já pedia `antialias: true`, mas o renderizador limitava o DPR a 1.5 tanto no desktop quanto no celular. Portas GLB articuladas usavam interpolação linear e mudavam de velocidade abruptamente no início/fim da abertura.

## Mudanças implementadas

### Portas e entrada nos carros
- Novo módulo `js/vehicles/driver-vehicle-doors-r58.js`: duas portas com pivô, painéis e vidro, maçaneta e indicação escura do vão; disponível para carrocerias **procedurais comuns** (não motos, ônibus ou caminhões).
- Curva smoothstep: porta inicia a abertura nos 27% iniciais da animação, permanece aberta durante a passagem e fecha de modo suave nos 22% finais. Ângulo máximo ~1.12 rad (64°).
- `DriverVehicleMount` atualiza o pivô sincronizado ao estado de entrar/sair e o fecha sempre ao concluir a transição.
- Tanner continua visível até completar o deslocamento pela porta; não muda de estado para `driving` antes do último quadro.
- Portas GLB que **já têm pivôs reais** usam o `DriverPoliceDoorRig` existente, agora com abertura/fechamento suavizados, sem manipular a física do carro. Não substituir malhas importadas com painéis incompatíveis.

### Motocicleta
- Carroceria procedural com tanque, banco, motor, escapamento, pedaleiras, guidão, garfo dianteiro e farol; direção visual acoplada ao ângulo de esterçamento, sem alterar o collider.
- Ao montar Tanner na moto real, a posição local do grupo sobe 0.22 unidade para alinhar o quadril com o banco. O ponto de interpolação de entrada e saída usa a mesma altura.
- Braço/perna de montagem espelhados pelo lado de entrada. Pose e transição de assento continuam sendo atualizadas até o fim.
- Alvos da IK compatíveis com ambos os tipos: moto básica (guidão em 1.47, z=.74; pedaleira em y=.67) e **moto GLB unificada** (valores próprios preservados do rig anterior, para evitar regressão).
- Se o GLB de Tanner demora a carregar, aparece um piloto provisório. Quando o modelo real chega, o sistema tenta montá-lo e esconde o provisório após sucesso. Na saída, esconde o provisório no início da animação e limpa o estado pendente.

### Nitidez/serrilhado
- O renderizador continua usando MSAA onde o contexto WebGL oferecer suporte (`antialias: true`).
- DPR máximo de 1.85 no desktop e 1.5 em tela de toque para melhorar os contornos em monitores sem aumentar indiscriminadamente o consumo da GPU em celulares.
- Easing nas portas GLB evita paradas angulares bruscas, mas **não repara topologia serrilhada de arquivos GLB** previamente cortados em triângulos.

## Testes confirmados
Novo arquivo: `tests/driver-r58-vehicle-animations.test.cjs`.

A verificação isolada em JavaScript executou **10/10 cenários aprovados**:
- abertura das duas portas, suavidade e fechamento exato;
- entrada e saída com transição completa sem controle prematuro;
- montagem da motocicleta com guiador articulado;
- piloto de fallback visível e sua remoção após desmontagem;
- montagem do Tanner GLB após carregamento tardio;
- pose da perna espelhada para ambos os lados;
- porta GLB existente com interpolação suave;
- ordem dos scripts, antialiasing e versões de cache;
- altura do banco e alvos IK separados para moto procedural/importada.

**7/7 módulos JS inspecionados** passaram pela compilação sintática de V8. Os testes não foram executados numa partida WebGL/Chromium completa e não comprovam qualidade visual em todos os GLBs.

## Antes / depois

| Área | Antes | Depois (R58) |
|---|---|---|
| Porta de carro procedural | Não existia peça articulada | Dobradiças e abertura gradual dos dois lados |
| Entrada/saída | Ator poderia desaparecer/congelar cedo | Movimento contínuo até a passagem pelo banco |
| Porta GLB com rig nativo | Interpolação linear | Suavização na abertura e no fechamento |
| Moto procedural | Caixa + duas rodas | Tanque, assento, guidão, garfo, motor, pedaleiras e escapamento |
| Perna usada para montar | Lado único | Espelhamento conforme o lado de entrada |
| Montagem real quando GLB atrasa | Piloto não visível ou duplicação temporária | Fallback e substituição controlada |
| Posição do Tanner na moto | y=0 | y=0.22, sincronizado com o ponto de entrada |
| DPR máximo desktop | 1.5 | 1.85, sem elevar o limite mobile |

## Pendências reais
- A moto importada `moto-otimizada.glb` é uma malha unificada. Para animar fisicamente seu guidão, rodas e suspensão **dentro do próprio GLB** é necessário possuir partes/pivôs identificáveis ou separar o modelo em componentes. A R58 melhora a pose, montagem e a compatibilidade do piloto, mas não certifica um rig de guidão real no GLB original.
- Portas de **outros carros GLB sem pivôs existentes** não se tornam articuladas apenas com este módulo: evitar cortes automáticos grosseiros que criariam novas bordas serrilhadas. A nova porta funcional é para o modelo procedural; modelos importados com rig continuam usando o mecanismo de porta próprio.
- Ainda faltam testes visuais em Chromium e no celular, verificação de clipes Mixamo reais, 30 ciclos entrar/sair consecutivos, FPS real e certificado de deploy GitHub Pages.
- Não houve mudanças na física do motor, persistência, save, rotas da campanha nem na lógica das missões.

## Próxima prioridade
Auditar os nomes de ossos/partes nos GLBs de veículos importados e da moto, criar pivôs reais onde houver malhas separadas, eliminar cortes de portas de triângulos em modelos unificados e validar as transições com personagem/veículo num navegador real.
