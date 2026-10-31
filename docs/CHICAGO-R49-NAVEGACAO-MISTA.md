# Chicago R49 — rede viária mista e navegação entre bairros

## Problema que a R49 resolve
Antes, a IA urbana explorava principalmente a grade de ruas a cada 80 unidades. Os seis cruzamentos secundários criados na R48 funcionavam para circuitos locais, mas as outras rotas não os utilizavam como parte da malha geral.

## Alterações reais
- Novo roteador A* DriverChicagoMixedNavigationR49, com 97 nós e 163 arestas aprovadas em um **cenário de teste sintético** (o total no mapa real varia conforme água e colisores).
- As dez conexões R48 dividem os trechos correspondentes da malha antiga em subsegmentos; não há conexões fictícias atravessando quarteirões.
- As arestas são verificadas no centro e nas duas faixas paralelas, com checagem de água/edifícios e bloqueio da ponte central quando levantada.
- Cache por cidade, invalidado ao mudar o estado da ponte, a sequência de construção ou a quantidade de colisores.
- Planejamento de rota ao trocar de objetivo/região, com recuperação após bloqueio e sem teleporte.
- Quatro sedãs civis R49 adicionais trafegam por destinos diferentes da cidade (ponto a ponto); cinco sedãs/cupês civis existentes de Chicago foram habilitados para tentar a nova IA e usam o roteamento antigo como fallback caso necessário.
- Viaturas sem visão direta do jogador passam a tentar a rede mista em buscas, preservando a navegação R48/grade antiga como fallback.
- As missões roteirizadas, o tráfego de Goose Island, os circuitos R43/R44/R48, os ônibus/caminhões e as outras cidades mantêm seus sistemas anteriores.

## Integração
- index.html: carrega navegação R49 após RoadGeometry e antes da engine; carrega trânsito R49 antes de TrafficAI.
- TrafficAI.getInput: escolhe o novo controlador apenas para civis sinalizados e consulta o grafo na busca policial sem linha de visão.
- Driver2GameEngine.spawnAllVehicles: identifica os civis elegíveis e cria até quatro veículos adicionais depois dos circuitos R48.
- Undercover e Passeio Livre compartilham o mesmo CityBuilder e spawnAllVehicles.

## Testes e limites
Arquivo novo: tests/chicago-r49-mixed-navigation.test.cjs (seis cenários).
A lógica foi exercitada também diretamente sobre os arquivos do GitHub em um ambiente JavaScript de teste: **6/6 verificações passaram** depois da correção do export de RoadGeometry.
Os testes cobrem ligação das vias, A*, replanejamento, ponte, obstáculo, comportamento de NPCs e carregamento por script.

Não há comprovação de partida completa no Chromium ou celular, de perseguição real por dez minutos, de desempenho/FPS, de deploy concluído do GitHub Pages, ou de equivalência 1:1 com o mapa de Driver 2 de PS1. GitHub Actions deve executar a suíte Node completa; a aprovação final precisa ser conferida separadamente.

## Pendências R50
1. Reproduzir longos percursos reais em navegador com HUD de telemetria (NPC bloqueado, replanejamento, tempos de frame).
2. Expandir rotas mistas para mais setores adaptados da fonte PS1, verificando continuidade física e semáforos.
3. Testar bloqueios policiais/desvios em campanha e a pé, inclusive pontes levantadas e áreas de missão.
