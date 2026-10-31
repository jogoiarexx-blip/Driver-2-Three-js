# Driver 2 — Chicago R52: Goose Island ↔ malha central

## Objetivo
Construir ruas físicas úteis, em vez de prolongar apenas a geometria decorativa, e permitir que carros civis e a navegação A* atravessem os bairros pela ponte **já existente** na via z=240.

## Entrega implementada

### Infraestrutura física
- Quatro quarteirões anteriores foram liberados de edifícios/calçadas antigos: `x=-120,-40`, `z=200,280`.
- Cinco eixos reais de ruas: três vias leste-oeste (z=200,240,280) e duas norte-sul (x=-120,-40). **760 unidades de eixo viário novo ou revestido**, com o trecho da ponte preexistente distinguido da construção nova.
- Seis cruzamentos de bairro; 18 segmentos no grafo do novo distrito e 10 interfaces planejadas, incluindo acesso à avenida x=0, duas saídas norte-sul e a passagem sobre o canal.
- Ponte de z=240: **reaproveitado** o deck fixo gerado pelo `DriverChicagoPS1RiverBranches` em `x=-160,z=240`. Não se inventou ponte em z=200/280.
- Reaproveitamento da via industrial de Goose Island em x=-200, entre z=160 e z=320, sujeito à auditoria de água/colisão. Sem teleporte e sem alteração dos checkpoints das missões.
- Oito prédios baixos com caixas AABB, 16 quadrantes de calçada, 96 faixas de travessia e seis postes em instâncias baratas, sem luzes dinâmicas.
- Calçadas encurtadas no eixo z perto da rua transversal z=240, deixando a pista efetivamente livre. A altura física do piso acompanha os blocos elevados nos distritos R48, R50 e R52, reduzindo pés atravessando a calçada.
- Novas vias incorporadas ao minimapa usando a proveniência `procedural-r52-bridge-road`, sem se declararem ruas originais certificadas do PS1.

### IA e tráfego
- O roteador misto incorpora 18 segmentos R52 à navegação existente, que inclui grade procedural, setores R48/R50 e corredores de referências PS1 adaptados.
- Quatro novos carros civis **elegíveis** para percorrer o setor R52 e o outro lado de Goose Island quando seus spawn points e rotas forem válidos, com as mesmas regras de trânsito/limite de velocidade do R49.
- O Undercover e o Passeio Livre usam a mesma construção de cidade e geração de veículos. Missões roteirizadas, GLBs, ônibus, caminhões e outras cidades não tiveram seus itinerários substituídos.
- Quando a ponte ou outra passagem tiver água/colisão, o setor é marcado `ready=false` no relatório e não entra na navegação nem no tráfego específico, evitando circular por trechos falsos.

### Diagnóstico
- O F8, também acionável tocando no FPS no celular, exibe número de ruas R52, carros na zona da ponte e NPCs parados nessa região, além de métricas já existentes de FPS e A*.

## Antes/depois — MESMO ambiente de teste sintético

| Subsistema | R51 | R52 |
|---|---:|---:|
| Nós do grafo navegável | 113 | 126 |
| Arestas transitáveis | 187 | 211 |
| Nós de cruzamentos secundários declarados | 12 | 18 |
| Interfaces com vias existentes declaradas | 20 | 30 |
| Carros civis de rotas mistas elegíveis | 8 | 12 |
| Ruas do novo setor | 0 | 5 |
| Quadras liberadas no novo setor | 0 | 4 |
| Postes instanciados no novo setor | 0 | 6 |

**Importante:** os números são reproduzidos com o modelo de água dos canais e colisores locais em uma cidade sintética. O ambiente real pode rejeitar ruas e spawns por colisões de missões, edificações ou outras geometria pré-existentes. O estado de `ready` e a telemetria informam o que ficou realmente acessível.

## Testes
O arquivo `tests/chicago-r52-goose-east-bridge.test.cjs` verifica oito cenários: recorte de quadras, geometria/colisores/postes, ponte existente e rotas, rejeição de ponte bloqueada, geração de tráfego, elevação real das calçadas, telemetria e integração compartilhada nos dois modos.

- **8/8 cenários passaram** em execução JavaScript com arquivos reais lidos do GitHub e simulação da geometria/colisores.
- **11/11 arquivos JavaScript analisados tiveram sintaxe válida**.
- Suítes históricas `tests/*.test.cjs`, execução WebGL em Chromium, trânsito por 10+ minutos, FPS real em celular e finalização do deploy do GitHub Pages **ainda não foram confirmados** nesta revisão.

## Pendências estruturais
1. Executar o jogo num navegador real, atravessar ambas as pontes de Goose Island e verificar os carros sob a estação, sem falsos saltos ou paredes.
2. Medir e corrigir congestionamentos e rotas bloqueadas usando o F8, em especial no encontro do tráfego industrial com o corredor z=240.
3. Expandir os setores remanescentes com evidência de geometria e escala do Driver 2 PS1; não assumir que quadras procedurais equivalem ao mapa completo.
