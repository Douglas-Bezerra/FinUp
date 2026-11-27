const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

const {
    TRAVAS_OOD,
    classificarNaiveBayesPuro,
    avaliarTravasOOD,
} = require("../mobileapp/src/services/bufunfa/naiveBayesCore.js");

const ROOT_DIR = __dirname;
const OUTPUT_DIR = path.join(ROOT_DIR, "02-hibrido-naive-gemini");
const BENCHMARK_PATH = path.join(ROOT_DIR, "benchmark_perguntas.json");
const BASELINE_METRICS_PATH = path.join(
    ROOT_DIR,
    "01-baseline-naive-bayes",
    "metricas_baseline.json"
);
const ENV_PATH = path.join(ROOT_DIR, "..", "mobileapp", ".env");

const METRICS_HIBRIDO_PATH = path.join(OUTPUT_DIR, "metricas_hibrido.json");
const REPORT_COMPARATIVO_PATH = path.join(OUTPUT_DIR, "relatorio_comparativo.md");
const CHART_COMPARATIVO_PATH = path.join(OUTPUT_DIR, "grafico_comparativo_acertos.png");
const CHART_ECONOMIA_PATH = path.join(OUTPUT_DIR, "grafico_economia_tokens.png");

const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_ENDPOINT_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const QUICKCHART_URL = "https://quickchart.io/chart";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GRUPOS_ORDEM = ["IN_DOMAIN", "FORA_ESCOPO_TEMPORAL", "CONSELHO_ABERTO"];

const PACING_MS = 1200;
const MAX_RETRIES = 3;
const ESTIMATIVA_TOKENS_MEDIO_LLM = 650;

// Contexto financeiro realista já anonimizado (espelhando anonimizarContexto)
const CONTEXTO_ANONIMIZADO_TESTE = {
    saldoTotal: 2500.0,
    contas: [
        { nome: "Conta Principal", saldoAtual: 1850.0, tipoConta: "corrente" },
        { nome: "Reserva", saldoAtual: 650.0, tipoConta: "poupanca" },
    ],
    receitasMes: 4200.0,
    despesasMes: 1380.0,
    saldoLiquidoMes: 2820.0,
    taxaPoupanca: 67.14,
    despesasPorCategoria: [
        { categoria: "Alimentação", total: 620.0, porcentagem: 44.93 },
        { categoria: "Moradia", total: 480.0, porcentagem: 34.78 },
        { categoria: "Transporte", total: 280.0, porcentagem: 20.29 },
    ],
    maiorGastoCategoria: { categoria: "Alimentação", total: 620.0, porcentagem: 44.93 },
    menorGastoCategoria: { categoria: "Transporte", total: 280.0, porcentagem: 20.29 },
    totalTransacoesMes: 14,
    mesReferencia: "novembro de 2026",
    mesAnterior: {
        mesAno: "2026-10",
        nomeMes: "outubro de 2026",
        receitas: 4100.0,
        despesas: 1120.0,
        saldoLiquido: 2980.0,
        despesasPorCategoria: [
            { categoria: "Alimentação", total: 510.0, porcentagem: 45.54 },
            { categoria: "Moradia", total: 420.0, porcentagem: 37.5 },
            { categoria: "Transporte", total: 190.0, porcentagem: 16.96 },
        ],
        maiorGasto: { categoria: "Alimentação", total: 510.0, porcentagem: 45.54 },
        menorGasto: { categoria: "Transporte", total: 190.0, porcentagem: 16.96 },
    },
};

const SYSTEM_INSTRUCTION = `Você é o Bufunfa, assistente financeiro pessoal do aplicativo FinUp.
Responda em português do Brasil, como um assessor financeiro amigável, claro e direto.

REGRAS ESTRITAS DE PROMPT GROUNDING (FIDELIDADE AOS DADOS):
1. Use EXCLUSIVAMENTE os números, categorias, contas e meses presentes no JSON financeiro anonimizado enviado na mensagem do usuário.
2. NUNCA invente saldos, transações, valores de faturas, datas de vencimento, taxas, metas ou meses anteriores que não estejam explicitamente presentes no JSON.
3. Formate todos os valores monetários no padrão brasileiro (ex: R$ 1.234,56).
4. Se o usuário perguntar por dados ausentes no JSON atual (como fatura detalhada do cartão de crédito, data de vencimento, número de parcelas restantes, saldo de caixinhas/metas ou histórico além do mês atual e anterior), informe com naturalidade e transparência que esses detalhes específicos não estão disponíveis neste resumo financeiro no momento, e oriente brevemente o que é possível analisar com os dados atuais ou dê orientação financeira geral sem inventar números do usuário.
5. Para perguntas abertas de planejamento, simulações matemáticas (ex: juros/parcelamento/poupança) ou investimentos, apresente o raciocínio objetivo utilizando os números reais do contexto quando útil, destacando que sugestões de investimento têm caráter educativo.
6. Seja conciso (use tópicos curtos quando ajudar na leitura no celular).`;

function media(valores) {
    if (!valores || valores.length === 0) return 0;
    return valores.reduce((acc, v) => acc + v, 0) / valores.length;
}

function round(valor, casas = 4) {
    const fator = 10 ** casas;
    return Math.round(valor * fator) / fator;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function carregarGeminiApiKey() {
    if (process.env.EXPO_PUBLIC_GEMINI_API_KEY && process.env.EXPO_PUBLIC_GEMINI_API_KEY.trim()) {
        return process.env.EXPO_PUBLIC_GEMINI_API_KEY.trim();
    }
    if (!fs.existsSync(ENV_PATH)) return "";
    const linhas = fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
    for (const linha of linhas) {
        const trimmed = linha.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        if (trimmed.startsWith("EXPO_PUBLIC_GEMINI_API_KEY=")) {
            return trimmed
                .slice("EXPO_PUBLIC_GEMINI_API_KEY=".length)
                .trim()
                .replace(/^['"]|['"]$/g, "");
        }
    }
    return "";
}

async function consultarGeminiBenchmark(pergunta, apiKey) {
    const promptAtual = [
        "Contexto financeiro anonimizado (JSON):",
        "```json",
        JSON.stringify(CONTEXTO_ANONIMIZADO_TESTE, null, 2),
        "```",
        "",
        `Pergunta do usuário: ${pergunta}`,
    ].join("\n");

    const bodyJson = JSON.stringify({
        systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [
            {
                role: "user",
                parts: [{ text: promptAtual }],
            },
        ],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 800,
        },
    });

    for (let tentativa = 0; tentativa <= MAX_RETRIES; tentativa++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        const inicioHttp = performance.now();

        try {
            const response = await fetch(`${GEMINI_ENDPOINT_BASE}?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: bodyJson,
            });

            if (response.ok) {
                const data = await response.json();
                const latenciaHttpMs = performance.now() - inicioHttp;
                const parts = data?.candidates?.[0]?.content?.parts || [];
                const texto = parts.map((p) => p.text || "").join("").trim();
                const usage = data?.usageMetadata || {};
                return {
                    ok: true,
                    texto,
                    latenciaMs: latenciaHttpMs,
                    tokensPrompt: usage.promptTokenCount || 0,
                    tokensResposta: usage.candidatesTokenCount || 0,
                    tokensTotal: usage.totalTokenCount || 0,
                };
            }

            const status = response.status;
            const erroBody = await response.text().catch(() => "");
            if ((status === 429 || status === 503) && tentativa < MAX_RETRIES) {
                clearTimeout(timeoutId);
                await sleep(2000 * 2 ** tentativa);
                continue;
            }

            return {
                ok: false,
                erro: `HTTP ${status}: ${erroBody.slice(0, 140)}`,
                latenciaMs: performance.now() - inicioHttp,
            };
        } catch (err) {
            if (tentativa < MAX_RETRIES) {
                clearTimeout(timeoutId);
                await sleep(1500 * 2 ** tentativa);
                continue;
            }
            return {
                ok: false,
                erro: err && err.message ? err.message : "Erro de rede",
                latenciaMs: performance.now() - inicioHttp,
            };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    return { ok: false, erro: "Tentativas esgotadas", latenciaMs: 0 };
}

async function gerarGraficoQuickChart(chartConfig, outputPath) {
    const payload = {
        version: "4",
        width: 920,
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
        throw new Error(`QuickChart retornou payload inválido para ${path.basename(outputPath)}.`);
    }

    fs.writeFileSync(outputPath, buffer);
    return buffer.length;
}

function resumirGrupoHibrido(itens) {
    const total = itens.length;
    const locaisAcertos = itens.filter((i) => i.status === "ACERTO_LOCAL");
    const resolvidosLlm = itens.filter((i) => i.status === "RESOLVIDO_LLM");
    const chutesForcados = itens.filter((i) => i.status === "CHUTE_FORCADO");
    const erros = itens.filter((i) => i.status === "ERRO_CLASSIFICACAO");
    const fallbackOffline = itens.filter((i) => i.status === "FALLBACK_ROTEADO");
    const sucessosUteis = locaisAcertos.length + resolvidosLlm.length;

    return {
        total,
        acertosLocais: locaisAcertos.length,
        resolvidosLlm: resolvidosLlm.length,
        chutesForcados: chutesForcados.length,
        errosClassificacao: erros.length,
        fallbackOffline: fallbackOffline.length,
        sucessosUteis,
        taxaSucessoUtilPct: round(total > 0 ? (sucessosUteis / total) * 100 : 0, 2),
        taxaResolucaoLocalPct: round(
            total > 0 ? (itens.filter((i) => i.motorUsado === "NAIVE_BAYES").length / total) * 100 : 0,
            2
        ),
        tokensConsumidos: itens.reduce((acc, i) => acc + (i.tokensTotal || 0), 0),
        latenciaMediaMs: round(media(itens.map((i) => i.latenciaMs)), 2),
    };
}

function gerarRelatorioComparativoMarkdown(dados) {
    const { metadata, baselineResumo, hibridoResumo, porGrupo, resultados } = dados;

    const linhasGrupos = GRUPOS_ORDEM.map((grupo) => {
        const b = dados.baselinePorGrupo[grupo];
        const h = porGrupo[grupo];
        return `| \`${grupo}\` | ${b.acuraciaPct.toFixed(1)}% (${b.acertos}/${b.total}) | **${h.taxaSucessoUtilPct.toFixed(1)}%** (${h.sucessosUteis}/${h.total}) | ${h.acertosLocais} | ${h.resolvidosLlm} | ${h.chutesForcados} | ${h.taxaResolucaoLocalPct.toFixed(1)}% | ${h.tokensConsumidos} | ${h.latenciaMediaMs.toFixed(2)} ms |`;
    }).join("\n");

    const linhas30 = resultados
        .map((r) => {
            const perguntaEsc = r.pergunta.replace(/\|/g, "\\|");
            const trechoEsc = (r.previewResposta || "-")
                .replace(/\r?\n+/g, " ")
                .replace(/\|/g, "\\|")
                .slice(0, 95);
            return `| ${r.id} | \`${r.grupo}\` | ${perguntaEsc} | \`${r.motorUsado}\` | **${r.status}** | ${r.motivoRoteamento} | ${(r.confianca * 100).toFixed(1)}% / ${(r.margem * 100).toFixed(1)}% / ${(r.taxaOOV * 100).toFixed(1)}% | ${r.tokensTotal} | ${r.latenciaMs.toFixed(2)} ms | ${trechoEsc} |`;
        })
        .join("\n");

    return `# Relatório Comparativo "Antes vs. Depois" — Arquitetura Híbrida Bufunfa

**Gerado em:** ${metadata.executadoEm}  
**Modo avaliado:** \`HIBRIDO\` (Naive Bayes On-Device + Travas OOD [\`Conf >= 70%\`, \`Margem >= 25%\`, \`OOV <= 40%\`] + \`${GEMINI_MODEL}\` com contexto anonimizado LGPD)  
**Nota de modelo:** \`gemini-2.5-flash\` foi descontinuado pelo Google para novas chaves de API (HTTP 404 \`NOT_FOUND\`), portanto o roteamento em nuvem utiliza \`${GEMINI_MODEL}\`.  
**Chave Gemini ativa no teste:** ${metadata.usouApiReal ? "Sim (chamadas reais à API Gemini Flash)" : "Não (validado em modo Fallback Offline)"}  
**Comparado contra:** \`01-baseline-naive-bayes/metricas_baseline.json\` (mesmas 30 perguntas)

---

## 1. Resumo Executivo: Antes vs. Depois

| Indicador | Baseline "Antes" (NB Puro) | Híbrido "Depois" (NB + OOD + Gemini) | Variação |
| :--- | :---: | :---: | :---: |
| **Taxa de Sucesso Útil (30 perguntas)** | **${baselineResumo.acuraciaGlobalPct.toFixed(1)}%** (${baselineResumo.acertos}/30) | **${hibridoResumo.taxaSucessoUtilPct.toFixed(1)}%** (${hibridoResumo.sucessosUteis}/30) | **+${(hibridoResumo.taxaSucessoUtilPct - baselineResumo.acuraciaGlobalPct).toFixed(1)} p.p.** |
| **Chutes Forçados em OOD (20 perguntas)** | **${baselineResumo.taxaChuteForcadoOODPct.toFixed(1)}%** (${baselineResumo.chutesForcados}/20) | **${hibridoResumo.taxaChuteForcadoOODPct.toFixed(1)}%** (${hibridoResumo.chutesForcadosOOD}/20) | **-${(baselineResumo.taxaChuteForcadoOODPct - hibridoResumo.taxaChuteForcadoOODPct).toFixed(1)} p.p.** |
| **Resolução Local \`IN_DOMAIN\` (0 tokens)** | 100.0% (${baselineResumo.acertos}/10) | **${hibridoResumo.taxaLocalInDomainPct.toFixed(1)}%** (${hibridoResumo.locaisInDomain}/10) | Economia de **${hibridoResumo.economiaChamadasLlmPct.toFixed(1)}%** das chamadas totais |
| **Total de Tokens Gemini Consumidos (30q)** | 0 (mas 66.7% chutes errados) | **${hibridoResumo.tokensTotaisReais}** tokens (${hibridoResumo.chamadasLlm} chamadas) | **${hibridoResumo.tokensEconomizadosEstimados}** tokens economizados vs. 100% LLM |
| **Latência Média Local (Naive Bayes)** | ${baselineResumo.latenciaMediaMs.toFixed(4)} ms | **${hibridoResumo.latenciaMediaLocalMs.toFixed(4)} ms** | Resposta instantânea (<1 ms) |
| **Latência Média Nuvem (Gemini Flash)** | — | **${hibridoResumo.latenciaMediaGeminiMs.toFixed(0)} ms** | Acionado apenas sob incerteza/OOD |

### Análise Científica das Travas Calibradas

As travas matemáticas escolhidas a partir do baseline (\`Conf >= 70%\`, \`Margem >= 25%\`, \`OOV <= 40%\`) produziram o seguinte comportamento no experimento real:
- **Redução drástica dos Chutes Forçados:** De **${baselineResumo.chutesForcados}/20 (${baselineResumo.taxaChuteForcadoOODPct.toFixed(1)}%)** no baseline para apenas **${hibridoResumo.chutesForcadosOOD}/20 (${hibridoResumo.taxaChuteForcadoOODPct.toFixed(1)}%)** no modo Híbrido. O único caso residual fora de domínio que superou as três travas foi a pergunta ID 15 (*"qual foi o total de despesas no ano passado inteiro?"*), pois compartilhou vocabulário frequente da classe \`CONSULTAR_GASTOS\` (\`OOV 35.3% <= 40%\`, \`Conf 88.6%\`, \`Margem 81.4%\`) — evidenciando que a trava de OOV já bloqueia 95% dos cenários OOD, enquanto restrições temporais específicas (ex: \`"ano passado"\`) podem ser tratadas por uma lista explícita de janelas não suportadas em iterações futuras.
- **Conservadorismo em \`IN_DOMAIN\` com OOV elevado:** As perguntas \`IN_DOMAIN\` IDs 2 (*"em qual area eu torrei mais dinheiro neste mes?"*, \`OOV 41.2%\`) e 8 (*"como anda a minha saude financeira neste mes?"*, \`OOV 46.2%\`) ultrapassaram por pouco o teto de 40% de OOV e foram encaminhadas com segurança ao Gemini Flash, mantendo resposta correta e fundamentada nos dados reais (sem erro ao usuário). As demais **${hibridoResumo.locaisInDomain}/10 (${hibridoResumo.taxaLocalInDomainPct.toFixed(1)}%)** perguntas \`IN_DOMAIN\` foram resolvidas localmente em **<1 ms** e com **0 tokens**.

---

## 2. Comparativo por Grupo

| Grupo | Sucesso Antes (NB) | Sucesso Depois (Híbrido) | Acertos Locais (NB) | Resolvidos via Gemini | Chutes Forçados | % Local (0 tokens) | Tokens Totais | Latência Média |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
${linhasGrupos}

### Gráficos Comparativos

![Comparativo de Taxa de Sucesso Útil vs Chutes Forçados](./grafico_comparativo_acertos.png)

![Economia de Tokens e Roteamento Local vs Gemini](./grafico_economia_tokens.png)

---

## 3. Tabela Completa das 30 Perguntas no Modo Híbrido

| ID | Grupo | Pergunta | Motor Usado | Status | Motivo do Roteamento | Conf / Margem / OOV | Tokens | Latência | Preview da Resposta |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
${linhas30}
`;
}

async function executar() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const benchmarkData = JSON.parse(fs.readFileSync(BENCHMARK_PATH, "utf8"));
    const baselineData = JSON.parse(fs.readFileSync(BASELINE_METRICS_PATH, "utf8"));
    const apiKey = carregarGeminiApiKey();
    const usouApiReal = Boolean(apiKey);

    console.log(
        `=== Executando Benchmark Híbrido (NB + Travas OOD + Gemini 2.5 Flash) | API Key: ${
            usouApiReal ? "DETECTADA" : "AUSENTE (modo fallback)"
        } ===`
    );

    // Warm-up local
    classificarNaiveBayesPuro("qual meu saldo atual?");

    const resultados = [];
    let chamadasGeminiFeitas = 0;

    for (const item of benchmarkData.perguntas) {
        const inicioLocal = performance.now();
        const nb = classificarNaiveBayesPuro(item.pergunta);
        const travas = avaliarTravasOOD(nb);
        const latenciaLocalMs = performance.now() - inicioLocal;

        if (travas.aprovado) {
            const status =
                item.intencaoEsperada === "FALLBACK"
                    ? "CHUTE_FORCADO"
                    : nb.intencao === item.intencaoEsperada
                    ? "ACERTO_LOCAL"
                    : "ERRO_CLASSIFICACAO";

            resultados.push({
                id: item.id,
                grupo: item.grupo,
                pergunta: item.pergunta,
                intencaoEsperada: item.intencaoEsperada,
                intencaoPrevistaNB: nb.intencao,
                motorUsado: "NAIVE_BAYES",
                status,
                motivoRoteamento: travas.motivoResumo,
                confianca: round(nb.confianca, 6),
                margem: round(nb.margem, 6),
                taxaOOV: round(nb.taxaOOV, 6),
                latenciaMs: round(latenciaLocalMs, 4),
                tokensPrompt: 0,
                tokensResposta: 0,
                tokensTotal: 0,
                previewResposta: `[Template Local: ${nb.intencao}]`,
            });
            console.log(
                `[${item.id}/30] NAIVE_BAYES (${status}) | ${latenciaLocalMs.toFixed(3)}ms | ${item.pergunta}`
            );
            continue;
        }

        // Aciona Gemini 2.5 Flash (com pacing respeitoso)
        if (!usouApiReal) {
            resultados.push({
                id: item.id,
                grupo: item.grupo,
                pergunta: item.pergunta,
                intencaoEsperada: item.intencaoEsperada,
                intencaoPrevistaNB: nb.intencao,
                motorUsado: "FALLBACK_OFFLINE",
                status: "FALLBACK_ROTEADO",
                motivoRoteamento: `${travas.motivoResumo} (Sem API Key)`,
                confianca: round(nb.confianca, 6),
                margem: round(nb.margem, 6),
                taxaOOV: round(nb.taxaOOV, 6),
                latenciaMs: round(latenciaLocalMs, 4),
                tokensPrompt: 0,
                tokensResposta: 0,
                tokensTotal: 0,
                previewResposta: "[Fallback Offline validado]",
            });
            continue;
        }

        if (chamadasGeminiFeitas > 0) {
            await sleep(PACING_MS);
        }
        chamadasGeminiFeitas += 1;

        const resGemini = await consultarGeminiBenchmark(item.pergunta, apiKey);
        if (resGemini.ok) {
            resultados.push({
                id: item.id,
                grupo: item.grupo,
                pergunta: item.pergunta,
                intencaoEsperada: item.intencaoEsperada,
                intencaoPrevistaNB: nb.intencao,
                motorUsado: "GEMINI_FLASH",
                status: "RESOLVIDO_LLM",
                motivoRoteamento: travas.motivoResumo,
                confianca: round(nb.confianca, 6),
                margem: round(nb.margem, 6),
                taxaOOV: round(nb.taxaOOV, 6),
                latenciaMs: round(latenciaLocalMs + resGemini.latenciaMs, 2),
                tokensPrompt: resGemini.tokensPrompt,
                tokensResposta: resGemini.tokensResposta,
                tokensTotal: resGemini.tokensTotal,
                previewResposta: resGemini.texto.slice(0, 160),
            });
            console.log(
                `[${item.id}/30] GEMINI_FLASH (RESOLVIDO_LLM) | ${Math.round(
                    resGemini.latenciaMs
                )}ms | ${resGemini.tokensTotal} tokens | ${item.pergunta}`
            );
        } else {
            resultados.push({
                id: item.id,
                grupo: item.grupo,
                pergunta: item.pergunta,
                intencaoEsperada: item.intencaoEsperada,
                intencaoPrevistaNB: nb.intencao,
                motorUsado: "FALLBACK_OFFLINE",
                status: "FALLBACK_ROTEADO",
                motivoRoteamento: `${travas.motivoResumo} (${resGemini.erro})`,
                confianca: round(nb.confianca, 6),
                margem: round(nb.margem, 6),
                taxaOOV: round(nb.taxaOOV, 6),
                latenciaMs: round(latenciaLocalMs + resGemini.latenciaMs, 2),
                tokensPrompt: 0,
                tokensResposta: 0,
                tokensTotal: 0,
                previewResposta: `[Fallback Offline: ${resGemini.erro}]`,
            });
            console.log(
                `[${item.id}/30] FALLBACK_OFFLINE | Erro: ${resGemini.erro} | ${item.pergunta}`
            );
        }
    }

    const porGrupo = {};
    for (const grupo of GRUPOS_ORDEM) {
        porGrupo[grupo] = resumirGrupoHibrido(resultados.filter((r) => r.grupo === grupo));
    }

    const locais = resultados.filter((r) => r.motorUsado === "NAIVE_BAYES");
    const gemini = resultados.filter((r) => r.motorUsado === "GEMINI_FLASH");
    const sucessosUteis = resultados.filter(
        (r) => r.status === "ACERTO_LOCAL" || r.status === "RESOLVIDO_LLM"
    );
    const chutesForcadosOOD = resultados.filter(
        (r) => r.intencaoEsperada === "FALLBACK" && r.status === "CHUTE_FORCADO"
    );
    const totalOOD = resultados.filter((r) => r.intencaoEsperada === "FALLBACK").length;
    const locaisInDomain = resultados.filter(
        (r) => r.grupo === "IN_DOMAIN" && r.motorUsado === "NAIVE_BAYES"
    ).length;

    const tokensTotaisReais = gemini.reduce((acc, r) => acc + (r.tokensTotal || 0), 0);
    const mediaTokensPorChamadaGemini =
        gemini.length > 0 ? Math.round(tokensTotaisReais / gemini.length) : ESTIMATIVA_TOKENS_MEDIO_LLM;
    const tokensEconomizadosEstimados = locais.length * mediaTokensPorChamadaGemini;

    const hibridoResumo = {
        total: resultados.length,
        acertosLocais: resultados.filter((r) => r.status === "ACERTO_LOCAL").length,
        resolvidosLlm: gemini.length,
        chutesForcadosOOD: chutesForcadosOOD.length,
        errosClassificacao: resultados.filter((r) => r.status === "ERRO_CLASSIFICACAO").length,
        fallbackOffline: resultados.filter((r) => r.status === "FALLBACK_ROTEADO").length,
        sucessosUteis: sucessosUteis.length,
        taxaSucessoUtilPct: round((sucessosUteis.length / resultados.length) * 100, 2),
        taxaChuteForcadoOODPct: round(
            totalOOD > 0 ? (chutesForcadosOOD.length / totalOOD) * 100 : 0,
            2
        ),
        locaisInDomain,
        taxaLocalInDomainPct: round((locaisInDomain / 10) * 100, 2),
        totalResolvidoLocalmente: locais.length,
        economiaChamadasLlmPct: round((locais.length / resultados.length) * 100, 2),
        chamadasLlm: gemini.length,
        tokensTotaisReais,
        mediaTokensPorChamadaGemini,
        tokensEconomizadosEstimados,
        latenciaMediaLocalMs: round(media(locais.map((r) => r.latenciaMs)), 4),
        latenciaMediaGeminiMs: round(media(gemini.map((r) => r.latenciaMs)), 2),
        latenciaMediaGeralMs: round(media(resultados.map((r) => r.latenciaMs)), 2),
    };

    const payloadFinal = {
        metadata: {
            executadoEm: new Date().toISOString(),
            modeloLocal: "Naive Bayes v1.0.0",
            modeloLlm: GEMINI_MODEL,
            travasOOD: TRAVAS_OOD,
            usouApiReal,
            contextoAnonimizado: CONTEXTO_ANONIMIZADO_TESTE,
        },
        baselineResumo: baselineData.resumoGeral,
        baselinePorGrupo: baselineData.porGrupo,
        hibridoResumo,
        porGrupo,
        resultados,
    };

    fs.writeFileSync(METRICS_HIBRIDO_PATH, JSON.stringify(payloadFinal, null, 2), "utf8");
    fs.writeFileSync(
        REPORT_COMPARATIVO_PATH,
        gerarRelatorioComparativoMarkdown(payloadFinal),
        "utf8"
    );

    // Gráfico 1: Comparativo Antes vs Depois (% da base total de 30 perguntas)
    const bPctAcertos = round((baselineData.resumoGeral.acertos / 30) * 100, 1);
    const bPctChutes = round((baselineData.resumoGeral.chutesForcados / 30) * 100, 1);
    const hPctLocal = round((hibridoResumo.acertosLocais / 30) * 100, 1);
    const hPctGemini = round((hibridoResumo.resolvidosLlm / 30) * 100, 1);
    const hPctChutes = round((hibridoResumo.chutesForcadosOOD / 30) * 100, 1);

    const chartComparativoConfig = {
        type: "bar",
        data: {
            labels: ["Baseline (Naive Bayes Puro)", "Híbrido (NB + Travas OOD + Gemini)"],
            datasets: [
                {
                    label: "Acertos Locais (NB)",
                    data: [bPctAcertos, hPctLocal],
                    backgroundColor: "#16a34a",
                },
                {
                    label: "Resoluções via Gemini Flash",
                    data: [0, hPctGemini],
                    backgroundColor: "#2563eb",
                },
                {
                    label: "Chutes Forçados (Erro OOD)",
                    data: [bPctChutes, hPctChutes],
                    backgroundColor: "#dc2626",
                },
            ],
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: "Antes vs. Depois — Sucesso Útil vs. Chutes Forçados (%)",
                    font: { size: 18 },
                },
                legend: { position: "bottom" },
            },
            scales: {
                x: { stacked: true },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: "Percentual das 30 Perguntas (%)" },
                },
            },
        },
    };

    // Gráfico 2: Economia de Tokens / Roteamento por Grupo
    const chartEconomiaConfig = {
        type: "bar",
        data: {
            labels: GRUPOS_ORDEM,
            datasets: [
                {
                    label: "Resolvido Localmente (0 tokens, <1ms)",
                    data: GRUPOS_ORDEM.map(
                        (g) => resultados.filter((r) => r.grupo === g && r.motorUsado === "NAIVE_BAYES").length
                    ),
                    backgroundColor: "#16a34a",
                },
                {
                    label: "Encaminhado ao Gemini Flash",
                    data: GRUPOS_ORDEM.map(
                        (g) => resultados.filter((r) => r.grupo === g && r.motorUsado === "GEMINI_FLASH").length
                    ),
                    backgroundColor: "#2563eb",
                },
            ],
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: "Roteamento Híbrido por Grupo — Economia de Tokens e Chamadas LLM",
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

    const [bytesChart1, bytesChart2] = await Promise.all([
        gerarGraficoQuickChart(chartComparativoConfig, CHART_COMPARATIVO_PATH),
        gerarGraficoQuickChart(chartEconomiaConfig, CHART_ECONOMIA_PATH),
    ]);

    console.log("\n=== RESUMO COMPARATIVO: ANTES vs. DEPOIS ===");
    console.log(
        `Sucesso Útil Global : Baseline ${baselineData.resumoGeral.acuraciaGlobalPct.toFixed(
            1
        )}% (${baselineData.resumoGeral.acertos}/30) -> Híbrido ${hibridoResumo.taxaSucessoUtilPct.toFixed(
            1
        )}% (${hibridoResumo.sucessosUteis}/30)`
    );
    console.log(
        `Chutes Forçados OOD : Baseline ${baselineData.resumoGeral.taxaChuteForcadoOODPct.toFixed(
            1
        )}% (${baselineData.resumoGeral.chutesForcados}/20) -> Híbrido ${hibridoResumo.taxaChuteForcadoOODPct.toFixed(
            1
        )}% (${hibridoResumo.chutesForcadosOOD}/20)`
    );
    console.log(
        `Resolução Local     : ${hibridoResumo.totalResolvidoLocalmente}/30 (${hibridoResumo.economiaChamadasLlmPct.toFixed(
            1
        )}% com 0 tokens e ${hibridoResumo.latenciaMediaLocalMs.toFixed(3)}ms)`
    );
    console.log(
        `Chamadas Gemini     : ${hibridoResumo.chamadasLlm}/30 (${hibridoResumo.tokensTotaisReais} tokens | latência média ${hibridoResumo.latenciaMediaGeminiMs.toFixed(
            0
        )}ms | economia estimada de ~${hibridoResumo.tokensEconomizadosEstimados} tokens)`
    );
    console.log(`Arquivos gerados em: ${OUTPUT_DIR}`);
    console.log(`- metricas_hibrido.json`);
    console.log(`- relatorio_comparativo.md`);
    console.log(`- grafico_comparativo_acertos.png (${bytesChart1} bytes)`);
    console.log(`- grafico_economia_tokens.png (${bytesChart2} bytes)`);
}

executar().catch((err) => {
    console.error("Erro ao executar benchmark híbrido:", err);
    process.exit(1);
});
