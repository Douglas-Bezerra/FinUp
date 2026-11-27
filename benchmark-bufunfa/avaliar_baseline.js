const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

const {
    classificarNaiveBayesPuro,
} = require("../mobileapp/src/services/bufunfa/naiveBayesCore.js");

const ROOT_DIR = __dirname;
const OUTPUT_DIR = path.join(ROOT_DIR, "01-baseline-naive-bayes");
const BENCHMARK_PATH = path.join(ROOT_DIR, "benchmark_perguntas.json");
const MODEL_PATH = path.join(ROOT_DIR, "..", "mobileapp", "src", "services", "bufunfa", "model.json");
const METRICS_JSON_PATH = path.join(OUTPUT_DIR, "metricas_baseline.json");
const REPORT_MD_PATH = path.join(OUTPUT_DIR, "relatorio_baseline.md");
const CHART_ACERTOS_PATH = path.join(OUTPUT_DIR, "grafico_acertos_vs_chutes.png");
const CHART_CONFIANCA_PATH = path.join(OUTPUT_DIR, "grafico_confianca_baseline.png");

const QUICKCHART_URL = "https://quickchart.io/chart";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GRUPOS_ORDEM = ["IN_DOMAIN", "FORA_ESCOPO_TEMPORAL", "CONSELHO_ABERTO"];

/**
 * Calcula a média aritmética de uma lista numérica.
 * @param {number[]} valores
 * @returns {number}
 */
function media(valores) {
    if (!valores || valores.length === 0) return 0;
    return valores.reduce((acc, v) => acc + v, 0) / valores.length;
}

/**
 * Arredonda número para quantidade fixa de casas decimais.
 * @param {number} valor
 * @param {number} casas
 * @returns {number}
 */
function round(valor, casas = 4) {
    const fator = 10 ** casas;
    return Math.round(valor * fator) / fator;
}

/**
 * Resume métricas agregadas para um subconjunto de resultados.
 * @param {Array<object>} itens
 */
function calcularEstatisticasGrupo(itens) {
    const total = itens.length;
    const acertos = itens.filter((i) => i.status === "ACERTO");
    const chutesForcados = itens.filter((i) => i.status === "CHUTE_FORCADO");
    const erros = itens.filter((i) => i.status === "ERRO_CLASSIFICACAO");

    const latencias = itens.map((i) => i.latenciaMs);

    return {
        total,
        acertos: acertos.length,
        chutesForcados: chutesForcados.length,
        errosClassificacao: erros.length,
        acuraciaPct: round(total > 0 ? (acertos.length / total) * 100 : 0, 2),
        taxaChuteForcadoPct: round(total > 0 ? (chutesForcados.length / total) * 100 : 0, 2),
        confiancaMediaPct: round(media(itens.map((i) => i.confianca)) * 100, 2),
        margemMediaPct: round(media(itens.map((i) => i.margem)) * 100, 2),
        taxaOOVMediaPct: round(media(itens.map((i) => i.taxaOOV)) * 100, 2),
        latenciaMediaMs: round(media(latencias), 4),
        latenciaMinMs: round(latencias.length ? Math.min(...latencias) : 0, 4),
        latenciaMaxMs: round(latencias.length ? Math.max(...latencias) : 0, 4),
    };
}

/**
 * Gera um gráfico PNG via API do QuickChart e valida a assinatura binária PNG.
 * @param {object} chartConfig
 * @param {string} outputPath
 */
async function gerarGraficoQuickChart(chartConfig, outputPath) {
    const payload = {
        version: "4",
        width: 900,
        height: 520,
        backgroundColor: "#ffffff",
        format: "png",
        chart: chartConfig,
    };

    const response = await fetch(QUICKCHART_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        throw new Error(`QuickChart HTTP ${response.status}: ${bodyText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
        throw new Error(`Resposta da API QuickChart para ${path.basename(outputPath)} não é um PNG válido.`);
    }

    fs.writeFileSync(outputPath, buffer);
    return buffer.length;
}

/**
 * Gera o relatório em Markdown com os resultados do baseline.
 */
function gerarRelatorioMarkdown(dados) {
    const { metadata, resumoGeral, porGrupo, comparativoAcertosVsChutes, resultados } = dados;

    const linhasTabelaGrupos = GRUPOS_ORDEM.map((grupo) => {
        const g = porGrupo[grupo];
        return `| \`${grupo}\` | ${g.total} | ${g.acertos} | ${g.chutesForcados} | ${g.errosClassificacao} | ${g.acuraciaPct.toFixed(1)}% | ${g.confiancaMediaPct.toFixed(1)}% | ${g.margemMediaPct.toFixed(1)}% | ${g.taxaOOVMediaPct.toFixed(1)}% | ${g.latenciaMediaMs.toFixed(4)} ms |`;
    }).join("\n");

    const linhasTabelaCompleta = resultados
        .map((r) => {
            const perguntaEscapada = r.pergunta.replace(/\|/g, "\\|");
            return `| ${r.id} | \`${r.grupo}\` | ${perguntaEscapada} | \`${r.intencaoEsperada}\` | \`${r.intencaoPrevista}\` | **${r.status}** | ${(r.confianca * 100).toFixed(1)}% | ${(r.margem * 100).toFixed(1)}% | ${(r.taxaOOV * 100).toFixed(1)}% | ${r.latenciaMs.toFixed(4)} ms |`;
        })
        .join("\n");

    return `# Relatório de Benchmark Baseline ("Antes") — Bufunfa Naive Bayes

**Gerado em:** ${metadata.executadoEm}  
**Modelo avaliado:** \`model.json\` v${metadata.modeloVersao} (${metadata.classes.length} classes, vocabulário de ${metadata.vocabularioSize} tokens entre unigramas e bigramas)  
**Motor:** \`classificarNaiveBayesPuro()\` (inferência Multinomial Naive Bayes + Laplace Smoothing + Softmax, sem regras heurísticas ou travas de confiança)  
**Total de perguntas avaliadas:** ${resumoGeral.total} (10 \`IN_DOMAIN\`, 10 \`FORA_ESCOPO_TEMPORAL\`, 10 \`CONSELHO_ABERTO\`)

---

## 1. Resumo Executivo

Este benchmark registra a linha de base científica (**Baseline "Antes"**) do classificador clássico Naive Bayes do assistente financeiro **Bufunfa**, antes da introdução de travas de confiança (threshold / margem / OOV) e roteamento híbrido para LLM.

- **Acurácia Global (30 perguntas):** **${resumoGeral.acuraciaGlobalPct.toFixed(1)}%** (${resumoGeral.acertos}/${resumoGeral.total} acertos)
- **Acurácia In-Domain (10 perguntas cobertas pelo modelo):** **${porGrupo.IN_DOMAIN.acuraciaPct.toFixed(1)}%** (${porGrupo.IN_DOMAIN.acertos}/${porGrupo.IN_DOMAIN.total} acertos)
- **Taxa de Chutes Forçados em Perguntas Fora de Domínio (OOD — 20 perguntas):** **${resumoGeral.taxaChuteForcadoOODPct.toFixed(1)}%** (${resumoGeral.chutesForcados}/${resumoGeral.totalOOD})
- **Erros de Classificação In-Domain:** ${resumoGeral.errosClassificacao}
- **Latência Média de Inferência:** **${resumoGeral.latenciaMediaMs.toFixed(4)} ms** (mín: ${resumoGeral.latenciaMinMs.toFixed(4)} ms | máx: ${resumoGeral.latenciaMaxMs.toFixed(4)} ms)

### Diagnóstico da Hipótese do Mundo Fechado (*Closed-World Assumption*)

Por definição matemática, um classificador Multinomial Naive Bayes com normalização *Softmax* sempre atribui 100% da massa de probabilidade entre as classes conhecidas ($\\sum_{c \\in C} P(c \\mid x) = 1$), assumindo que toda entrada pertence obrigatoriamente a uma das ${metadata.classes.length} intenções treinadas.

Como resultado direto observado neste baseline:
- Das **${resumoGeral.totalOOD} perguntas fora de domínio** (\`FORA_ESCOPO_TEMPORAL\` + \`CONSELHO_ABERTO\`), **${resumoGeral.chutesForcados}** resultaram em **\`CHUTE_FORCADO\`** — o modelo encaixou perguntas de fatura, metas, parcelas ou investimentos em intenções existentes sem conseguir sinalizar \`FALLBACK\`.
- Nos **Acertos Reais**, a confiança média foi de **${comparativoAcertosVsChutes.acertos.confiancaMediaPct.toFixed(1)}%** (margem média de **${comparativoAcertosVsChutes.acertos.margemMediaPct.toFixed(1)} p.p.** e taxa OOV média de **${comparativoAcertosVsChutes.acertos.taxaOOVMediaPct.toFixed(1)}%**).
- Nos **Chutes Forçados**, a confiança média foi de **${comparativoAcertosVsChutes.chutesForcados.confiancaMediaPct.toFixed(1)}%** (margem média de **${comparativoAcertosVsChutes.chutesForcados.margemMediaPct.toFixed(1)} p.p.** e taxa OOV média de **${comparativoAcertosVsChutes.chutesForcados.taxaOOVMediaPct.toFixed(1)}%**).

Esses números evidenciam quantitativamente por que um limiar simples apenas de confiança sofre com superconfiança do *Softmax* em tokens fora do vocabulário, justificando a combinação de **confiança + margem entre top-1/top-2 + taxa OOV** no seletor híbrido futuro.

---

## 2. Métricas por Grupo

| Grupo | Total | Acertos | Chutes Forçados | Erros Classificação | Acurácia (%) | Confiança Média (%) | Margem Média (%) | Taxa OOV Média (%) | Latência Média |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
${linhasTabelaGrupos}

---

## 3. Comparativo: Acertos Reais vs. Chutes Forçados

| Categoria do Desfecho | Quantidade | Confiança Média (%) | Margem Média (%) | Taxa OOV Média (%) |
| :--- | :---: | :---: | :---: | :---: |
| **Acertos Reais (\`ACERTO\`)** | ${comparativoAcertosVsChutes.acertos.quantidade} | ${comparativoAcertosVsChutes.acertos.confiancaMediaPct.toFixed(1)}% | ${comparativoAcertosVsChutes.acertos.margemMediaPct.toFixed(1)}% | ${comparativoAcertosVsChutes.acertos.taxaOOVMediaPct.toFixed(1)}% |
| **Chutes Forçados (\`CHUTE_FORCADO\`)** | ${comparativoAcertosVsChutes.chutesForcados.quantidade} | ${comparativoAcertosVsChutes.chutesForcados.confiancaMediaPct.toFixed(1)}% | ${comparativoAcertosVsChutes.chutesForcados.margemMediaPct.toFixed(1)}% | ${comparativoAcertosVsChutes.chutesForcados.taxaOOVMediaPct.toFixed(1)}% |

### Gráficos Gerados

![Acertos vs Chutes Forçados por Grupo](./grafico_acertos_vs_chutes.png)

![Confiança Média: Acertos Reais vs Chutes Forçados](./grafico_confianca_baseline.png)

---

## 4. Tabela Completa das 30 Perguntas Avaliadas

| ID | Grupo | Pergunta | Esperada | Prevista (NB Puro) | Status | Confiança | Margem | Taxa OOV | Latência |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
${linhasTabelaCompleta}
`;
}

async function executar() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const benchmarkData = JSON.parse(fs.readFileSync(BENCHMARK_PATH, "utf8"));
    const modelData = JSON.parse(fs.readFileSync(MODEL_PATH, "utf8"));

    // Warm-up para evitar distorção da primeira chamada JIT no V8
    classificarNaiveBayesPuro("qual meu saldo atual?");

    const resultados = benchmarkData.perguntas.map((item) => {
        const inicio = performance.now();
        const res = classificarNaiveBayesPuro(item.pergunta);
        const latenciaMs = performance.now() - inicio;

        let status = "";
        if (item.intencaoEsperada === "FALLBACK") {
            status =
                res.intencao === "DESCONHECIDO" || res.intencao === "FALLBACK"
                    ? "ACERTO"
                    : "CHUTE_FORCADO";
        } else {
            status = res.intencao === item.intencaoEsperada ? "ACERTO" : "ERRO_CLASSIFICACAO";
        }

        return {
            id: item.id,
            grupo: item.grupo,
            pergunta: item.pergunta,
            intencaoEsperada: item.intencaoEsperada,
            intencaoPrevista: res.intencao,
            status,
            confianca: round(res.confianca, 6),
            margem: round(res.margem, 6),
            taxaOOV: round(res.taxaOOV, 6),
            latenciaMs: round(latenciaMs, 4),
            probabilidades: Object.fromEntries(
                Object.entries(res.probabilidades).map(([k, v]) => [k, round(v, 6)])
            ),
        };
    });

    const porGrupo = {};
    for (const grupo of GRUPOS_ORDEM) {
        porGrupo[grupo] = calcularEstatisticasGrupo(resultados.filter((r) => r.grupo === grupo));
    }

    const acertosReais = resultados.filter((r) => r.status === "ACERTO");
    const chutesForcados = resultados.filter((r) => r.status === "CHUTE_FORCADO");
    const errosClassificacao = resultados.filter((r) => r.status === "ERRO_CLASSIFICACAO");
    const itensOOD = resultados.filter((r) => r.intencaoEsperada === "FALLBACK");
    const latencias = resultados.map((r) => r.latenciaMs);

    const resumoGeral = {
        total: resultados.length,
        totalInDomain: resultados.length - itensOOD.length,
        totalOOD: itensOOD.length,
        acertos: acertosReais.length,
        chutesForcados: chutesForcados.length,
        errosClassificacao: errosClassificacao.length,
        acuraciaGlobalPct: round((acertosReais.length / resultados.length) * 100, 2),
        taxaChuteForcadoOODPct: round(
            itensOOD.length > 0 ? (chutesForcados.length / itensOOD.length) * 100 : 0,
            2
        ),
        confiancaMediaGeralPct: round(media(resultados.map((r) => r.confianca)) * 100, 2),
        confiancaMediaAcertosPct: round(media(acertosReais.map((r) => r.confianca)) * 100, 2),
        confiancaMediaChutesForcadosPct: round(
            media(chutesForcados.map((r) => r.confianca)) * 100,
            2
        ),
        latenciaMediaMs: round(media(latencias), 4),
        latenciaMinMs: round(Math.min(...latencias), 4),
        latenciaMaxMs: round(Math.max(...latencias), 4),
    };

    const comparativoAcertosVsChutes = {
        acertos: {
            quantidade: acertosReais.length,
            confiancaMediaPct: round(media(acertosReais.map((r) => r.confianca)) * 100, 2),
            margemMediaPct: round(media(acertosReais.map((r) => r.margem)) * 100, 2),
            taxaOOVMediaPct: round(media(acertosReais.map((r) => r.taxaOOV)) * 100, 2),
        },
        chutesForcados: {
            quantidade: chutesForcados.length,
            confiancaMediaPct: round(media(chutesForcados.map((r) => r.confianca)) * 100, 2),
            margemMediaPct: round(media(chutesForcados.map((r) => r.margem)) * 100, 2),
            taxaOOVMediaPct: round(media(chutesForcados.map((r) => r.taxaOOV)) * 100, 2),
        },
    };

    const payloadFinal = {
        metadata: {
            executadoEm: new Date().toISOString(),
            modeloVersao: modelData.versao || "1.0.0",
            vocabularioSize: modelData.vocabularioSize,
            classes: modelData.classes,
            datasetVersao: benchmarkData.versao,
        },
        resumoGeral,
        porGrupo,
        comparativoAcertosVsChutes,
        resultados,
    };

    fs.writeFileSync(METRICS_JSON_PATH, JSON.stringify(payloadFinal, null, 2), "utf8");
    fs.writeFileSync(REPORT_MD_PATH, gerarRelatorioMarkdown(payloadFinal), "utf8");

    // Gráfico 1: Barras empilhadas Acertos vs Chutes Forçados vs Erros por Grupo
    const chartAcertosConfig = {
        type: "bar",
        data: {
            labels: GRUPOS_ORDEM,
            datasets: [
                {
                    label: "Acertos",
                    data: GRUPOS_ORDEM.map((g) => porGrupo[g].acertos),
                    backgroundColor: "#16a34a",
                },
                {
                    label: "Chutes Forçados",
                    data: GRUPOS_ORDEM.map((g) => porGrupo[g].chutesForcados),
                    backgroundColor: "#dc2626",
                },
                {
                    label: "Erros de Classificação",
                    data: GRUPOS_ORDEM.map((g) => porGrupo[g].errosClassificacao),
                    backgroundColor: "#f59e0b",
                },
            ],
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: "Baseline Naive Bayes — Acertos vs. Chutes Forçados por Grupo",
                    font: { size: 18 },
                },
                legend: { position: "bottom" },
            },
            scales: {
                x: { stacked: true },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    max: 10,
                    ticks: { stepSize: 2 },
                    title: { display: true, text: "Quantidade de Perguntas" },
                },
            },
        },
    };

    // Gráfico 2: Confiança Média (%) nos Acertos Reais vs Chutes Forçados
    const chartConfiancaConfig = {
        type: "bar",
        data: {
            labels: ["Acertos Reais", "Chutes Forçados (OOD)"],
            datasets: [
                {
                    label: "Confiança Média (%)",
                    data: [
                        comparativoAcertosVsChutes.acertos.confiancaMediaPct,
                        comparativoAcertosVsChutes.chutesForcados.confiancaMediaPct,
                    ],
                    backgroundColor: ["#16a34a", "#dc2626"],
                    barPercentage: 0.45,
                },
            ],
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: "Superconfiança do Naive Bayes — Acertos Reais vs. Chutes Forçados (%)",
                    font: { size: 18 },
                },
                legend: { display: false },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: "Confiança Média (%)" },
                },
            },
        },
    };

    const [bytesChart1, bytesChart2] = await Promise.all([
        gerarGraficoQuickChart(chartAcertosConfig, CHART_ACERTOS_PATH),
        gerarGraficoQuickChart(chartConfiancaConfig, CHART_CONFIANCA_PATH),
    ]);

    console.log("=== Benchmark Baseline Bufunfa (Naive Bayes Puro) ===");
    console.log(`Total avaliado: ${resumoGeral.total} perguntas`);
    console.log(
        `Acurácia Global: ${resumoGeral.acuraciaGlobalPct.toFixed(1)}% (${resumoGeral.acertos}/${resumoGeral.total})`
    );
    console.log(
        `Acurácia IN_DOMAIN: ${porGrupo.IN_DOMAIN.acuraciaPct.toFixed(1)}% (${porGrupo.IN_DOMAIN.acertos}/${porGrupo.IN_DOMAIN.total})`
    );
    console.log(
        `Chutes Forçados (OOD): ${resumoGeral.chutesForcados}/${resumoGeral.totalOOD} (${resumoGeral.taxaChuteForcadoOODPct.toFixed(1)}%)`
    );
    console.log(`Erros de Classificação (IN_DOMAIN): ${resumoGeral.errosClassificacao}`);
    console.log(
        `Confiança Média -> Acertos Reais: ${comparativoAcertosVsChutes.acertos.confiancaMediaPct.toFixed(1)}% | Chutes Forçados: ${comparativoAcertosVsChutes.chutesForcados.confiancaMediaPct.toFixed(1)}%`
    );
    console.log(
        `Margem Média    -> Acertos Reais: ${comparativoAcertosVsChutes.acertos.margemMediaPct.toFixed(1)}% | Chutes Forçados: ${comparativoAcertosVsChutes.chutesForcados.margemMediaPct.toFixed(1)}%`
    );
    console.log(
        `Taxa OOV Média  -> Acertos Reais: ${comparativoAcertosVsChutes.acertos.taxaOOVMediaPct.toFixed(1)}% | Chutes Forçados: ${comparativoAcertosVsChutes.chutesForcados.taxaOOVMediaPct.toFixed(1)}%`
    );
    console.log(`Latência Média: ${resumoGeral.latenciaMediaMs.toFixed(4)} ms`);
    console.log(`Arquivos gerados em: ${OUTPUT_DIR}`);
    console.log(`- metricas_baseline.json`);
    console.log(`- relatorio_baseline.md`);
    console.log(`- grafico_acertos_vs_chutes.png (${bytesChart1} bytes)`);
    console.log(`- grafico_confianca_baseline.png (${bytesChart2} bytes)`);
}

executar().catch((err) => {
    console.error("Erro ao executar benchmark baseline:", err);
    process.exit(1);
});
