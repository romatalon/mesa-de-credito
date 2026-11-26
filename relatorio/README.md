# Relatório de Crédito (versão GitHub Pages)

App que monta relatórios de crédito de companhias abertas (dados da CVM e da SEC) no estilo "atualização de resultados": números e ratios, cenários com chance e rampa, análise em caixas de texto, spread justo e exportação em PDF e PowerPoint.

Esta cópia roda fora do claude.ai:
- os botões do Claude abrem um pedido para copiar e colar numa conversa do Claude (sem chave de API);
- a análise fica salva no navegador (localStorage);
- PDF e PowerPoint baixam direto pelo navegador;
- buscar notícias e ler links pelo navegador do app Claude não funcionam aqui: cole o texto no anexo.

Dados: demonstrações da CVM (DFP 2020 a 2025 e ITR 2026, ver `fontes.json`), SEC companyfacts (`s40.json`), ANBIMA e Banco Central (`oficial.json`, `titulos.json`).
