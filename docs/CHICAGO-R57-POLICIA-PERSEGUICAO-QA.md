# Driver 2 — R57 | Polícia, travessias estreitas e diagnóstico de tráfego

Data: 31/10/2026. Revisão sobre o repositório `jogoiarexx-blip/Driver-2-Three-js`.

## Contexto e problema reproduzido
A R56 eliminou os contatos dos **quatro carros civis** em replays sintéticos prolongados. Isso não garantia que a **polícia em perseguição** tivesse o mesmo comportamento. O controlador policial legado chegou a tentar atravessar curvas com limites de velocidade superiores aos de carros civis, especialmente quando perdia a visão direta de Tanner e passava a usar o grafo de ruas mistas.

Uma viatura iniciando na área `(-116,236)`, apontada ao sul, procurando Tanner em `(120,-120)`, atingia um prédio R52 próximo a `(-103,228)` após cerca de 1,45 segundos no replay original, gerando **124 contatos ao longo de 85 segundos simulados**. Outros cenários de perseguição longa também apresentaram contatos em esquinas e pontes.

A primeira tentativa de reduzir globalmente a velocidade da polícia foi **rejeitada** nos testes, pois melhorou alguns trajetos mas piorou outros. O ajuste final é regional, não um limite universal para todas as perseguições.

## Código implementado

### Segurança de perseguição — `js/traffic/traffic-ai.js`
- Para **viaturas não roteirizadas** procurando Tanner **sem linha de visão**, registra-se a orientação retornada por `DriverChicagoMixedNavigationR49.follow`, quando o grafo de Chicago está construído.
- Em ruas estreitas da R52 Goose East (setor aproximado `x=-142..-22, z=150..310`), aplica-se limite extra antes das curvas fechadas: até 12 unidades/s na aproximação, até 6,2 a menos de 28 unidades do ponto e até 3,8 a menos de 14 unidades; grande desvio angular também reduz até 5,2.
- **Fora da R52**, preserva-se o limite original de perseguição, evitando novos contatos que surgiram ao aplicar o freio globalmente.
- Quando o grafo misto existe mas não oferece rota segura (água, ponte ou obstáculo), a viatura **não substitui a busca pelo roteamento antigo da grade de 80 unidades**, que poderia levar a um atalho falso. Ela freia e aguarda o próximo planejamento; o temporizador de marcha a ré não é ativado nessa condição.
- Policiais com linha de visão, perseguições cinematográficas e carros de missão preservam os controles anteriores. As outras cidades não recebem limites da R52.

### Telemetria — `js/engine/driver-traffic-telemetry-r50.js`
O painel F8, ou o toque no indicador de FPS no celular, passou a distinguir:
- Viaturas procurando Tanner por rotas mistas;
- Viaturas sem rota segura;
- Viaturas que freiam preventivamente em curvas estreitas.

### Publicação
O HTML foi atualizado com parâmetros de versão `chicago-police-r57` e `r57-police` para carregar a nova lógica e a telemetria sem depender de cache anterior.

## Testes realizados

### Reproduzidos com código real em JS isolado
Arquivo novo: `tests/chicago-r57-police-search.test.cjs` (6 cenários):
1. Viatura sem visão direta percorre o trecho inicial problemático da R52 por 14 segundos sem bater no primeiro prédio; percorreu aproximadamente 253 unidades no ensaio reproduzido.
2. Respeita a distância de um carro civil parado diretamente à frente.
3. Com grafo bloqueado, não acelera para um atalho de grade nem atravessa obstáculo.
4. Perseguição com contato visual e missão roteirizada permanecem fora do limite especial R57.
5. Scripts e diagnóstico conectados no HTML e no motor de jogo.
6. Fila com quatro veículos civis: a viatura mantém distância física durante três segundos de atualizações repetidas.

**Resultado:** 6/6 testes R57 aprovados.

Regressões das revisões anteriores, executadas novamente sobre os arquivos atuais:
- `tests/chicago-r53-west-canal.test.cjs`: **10/10**.
- `tests/chicago-r56-long-traffic-replay.test.cjs`: **4/4**.

**Total confirmado nessas três suítes: 20/20**, mais validação de sintaxe em **13/13 módulos JS**. A automação GitHub Actions existe e executa `node --test tests/*.test.cjs`, porém não é correto declarar que a suíte geral passou enquanto o resultado remoto não estiver disponível.

## Antes/depois e limitações

| Componente | Situação anterior | R57 |
|---|---|---|
| Viatura sem visão na esquina R52 problemática | Colidia precocemente | Replay inicial de 14 s sem contato |
| Viatura procurando Tanner sem passagem segura | Possível fallback ao grafo antigo | Para e mantém o caminho misto como fonte de verdade |
| Frenagem policial | Predominantemente baseada no ângulo e velocidade geral | Limite contextual para setor R52 sem afetar os demais |
| F8 para busca policial | Sem distinção por motivo | Contadores de busca, rota bloqueada e frenagem |
| Missões e visibilidade direta | Lógica existente | Preservada |

**Não está concluído:** testes de busca policial de vários minutos **ainda detectaram contatos em alguns cenários**, sobretudo fora do setor R52; a R57 não permite afirmar que todas as colisões policiais de Chicago foram eliminadas. Tampouco foi executada uma sessão gráfica/WebGL completa ou medido FPS real em celular, nem confirmada a finalização do deploy do GitHub Pages.

## Próximas prioridades
1. Reproduzir perseguições com vários policiais e tráfego simultâneo, documentando pontos de impacto e origem do bloqueio.
2. Corrigir no roteador as viradas em U e os pontos ultrapassados sem regredir os replays civis R56.
3. Validar o mapa em navegador real e prosseguir na construção das ruas ainda incompletas de Chicago, preservando os recursos e missões do jogo.
