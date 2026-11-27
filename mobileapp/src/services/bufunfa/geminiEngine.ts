import type {
    CategoriaGasto,
    ContextoFinanceiroBufunfa,
    ResumoCaixinha,
    ResumoCartaoCredito,
    ResumoMesAnterior,
    ResumoMesHistorico,
    ResumoOrcamentoMes,
    ResumoParcelamento,
    ResumoRecorrencia,
    ResumoTransacaoRecente,
} from "./bufunfaService";

export interface TurnoHistorico {
    role: "user" | "model";
    text: string;
}

export interface ContaAnonimizada {
    nome: string;
    saldoAtual: number;
    tipoConta: string;
}

export interface ContextoFinanceiroAnonimizado {
    saldoTotal: number;
    contas: ContaAnonimizada[];
    receitasMes: number;
    despesasMes: number;
    saldoLiquidoMes: number;
    taxaPoupanca: number;
    despesasPorCategoria: CategoriaGasto[];
    maiorGastoCategoria: CategoriaGasto | null;
    menorGastoCategoria: CategoriaGasto | null;
    totalTransacoesMes: number;
    mesReferencia: string;
    mesAnterior: ResumoMesAnterior | null;
    cartoesCredito: ResumoCartaoCredito[];
    caixinhas: ResumoCaixinha[];
    totalCaixinhas: number;
    parcelamentosAtivos: ResumoParcelamento[];
    contasFixasRecorrentes: ResumoRecorrencia[];
    orcamentosMes: ResumoOrcamentoMes[];
    historicoMensal: ResumoMesHistorico[];
    ultimasTransacoes: ResumoTransacaoRecente[];
}

export interface RespostaGemini {
    texto: string;
    tokensPrompt?: number;
    tokensResposta?: number;
    tokensTotal?: number;
}

const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_ENDPOINT_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TIMEOUT_MS = 20000;
const JANELA_HISTORICO_MAX = 6;

const SYSTEM_INSTRUCTION = `Você é o Bufunfa, assistente financeiro pessoal do aplicativo FinUp.
Responda em português do Brasil, como um assessor financeiro amigável, claro e direto.

O JSON financeiro anonimizado enviado contém a visão completa das finanças do usuário:
• contas (corrente, poupança, investimento, etc.), receitas/despesas do mês atual e mês anterior;
• cartoesCredito (limiteTotal, limiteUtilizado, limiteDisponivel, faturaAtual, diaFechamento, diaVencimento, bandeiras e faturas);
• caixinhas e totalCaixinhas;
• parcelamentosAtivos, contasFixasRecorrentes e orcamentosMes;
• historicoMensal (últimos 6 meses) e ultimasTransacoes (até 20 lançamentos recentes).

REGRAS ESTRITAS DE PROMPT GROUNDING (FIDELIDADE AOS DADOS):
1. Use EXCLUSIVAMENTE os números, nomes de contas/cartões, categorias e lançamentos presentes no JSON financeiro anonimizado enviado na mensagem do usuário.
2. NUNCA invente saldos, cartões, limites, transações, valores de faturas, datas ou meses que não estejam no JSON.
3. Formate todos os valores monetários no padrão brasileiro (ex: R$ 1.234,56).
4. Quando o usuário perguntar sobre comprar ou parcelar algo e quiser saber qual cartão usar (ex: "qual cartão tem limite para comprar X?"), analise TODOS os cartões em cartoesCredito comparando o valor total da compra com o limiteDisponivel de cada cartão, informe quais comportam ou não a compra, e alerte caso a parcela comprometa o saldoLiquidoMes ou as contasFixasRecorrentes.
5. Se alguma lista estiver vazia (ex: cartoesCredito: [] ou caixinhas: []) ou um dado específico solicitado não estiver no JSON, informe com naturalidade e transparência sem inventar valores.
6. Para perguntas abertas de planejamento, simulações matemáticas ou investimentos, apresente o raciocínio objetivo utilizando os números reais do contexto quando útil, destacando que sugestões de investimento têm caráter educativo.
7. Seja conciso (use tópicos curtos quando ajudar na leitura no celular).
8. NUNCA use sintaxe Markdown como \`###\`, \`**\`, \`*\`, \`---\` ou tabelas. Formate a resposta usando apenas texto limpo, quebras de linha, marcadores simples (•) e emojis discretos para títulos.`;

/**
 * Remove eventual sintaxe Markdown residual da resposta para exibição limpa em <Text> puro.
 */
export function limparMarkdown(texto: string): string {
    return texto
        .replace(/```[a-zA-Z]*\r?\n?/g, "")
        .replace(/```/g, "")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^\s*[-*_]{3,}\s*$/gm, "")
        .replace(/^\s*[-*]\s+/gm, "• ")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/__([^_]+)__/g, "$1")
        .replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,!?;:]|$)/g, "$1$2")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/**
 * Remove dados pessoais identificáveis (nome do usuário e IDs das contas) antes de enviar à nuvem (LGPD).
 */
export function anonimizarContexto(
    contexto: ContextoFinanceiroBufunfa
): ContextoFinanceiroAnonimizado {
    return {
        saldoTotal: contexto.saldoTotal,
        contas: contexto.contas.map((c) => ({
            nome: c.nome,
            saldoAtual: c.saldoAtual,
            tipoConta: c.tipoConta,
        })),
        receitasMes: contexto.receitasMes,
        despesasMes: contexto.despesasMes,
        saldoLiquidoMes: contexto.saldoLiquidoMes,
        taxaPoupanca: contexto.taxaPoupanca,
        despesasPorCategoria: contexto.despesasPorCategoria.map((d) => ({ ...d })),
        maiorGastoCategoria: contexto.maiorGastoCategoria
            ? { ...contexto.maiorGastoCategoria }
            : null,
        menorGastoCategoria: contexto.menorGastoCategoria
            ? { ...contexto.menorGastoCategoria }
            : null,
        totalTransacoesMes: contexto.totalTransacoesMes,
        mesReferencia: contexto.mesReferencia,
        mesAnterior: contexto.mesAnterior
            ? {
                  ...contexto.mesAnterior,
                  despesasPorCategoria: contexto.mesAnterior.despesasPorCategoria.map((d) => ({ ...d })),
                  maiorGasto: contexto.mesAnterior.maiorGasto
                      ? { ...contexto.mesAnterior.maiorGasto }
                      : null,
                  menorGasto: contexto.mesAnterior.menorGasto
                      ? { ...contexto.mesAnterior.menorGasto }
                      : null,
              }
            : null,
        cartoesCredito: (contexto.cartoesCredito || []).map((c) => ({
            ...c,
            bandeiras: c.bandeiras.map((b) => ({ ...b })),
            faturas: c.faturas.map((f) => ({ ...f })),
        })),
        caixinhas: (contexto.caixinhas || []).map((cx) => ({ ...cx })),
        totalCaixinhas: contexto.totalCaixinhas ?? 0,
        parcelamentosAtivos: (contexto.parcelamentosAtivos || []).map((p) => ({ ...p })),
        contasFixasRecorrentes: (contexto.contasFixasRecorrentes || []).map((r) => ({ ...r })),
        orcamentosMes: (contexto.orcamentosMes || []).map((o) => ({ ...o })),
        historicoMensal: (contexto.historicoMensal || []).map((h) => ({ ...h })),
        ultimasTransacoes: (contexto.ultimasTransacoes || []).map((t) => ({ ...t })),
    };
}

/**
 * Higieniza o histórico recente respeitando janela deslizante e alternância de papéis exigida pela API Gemini.
 */
function montarConteudosGemini(
    pergunta: string,
    contexto: ContextoFinanceiroBufunfa | null,
    historico: TurnoHistorico[]
): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
    const recentes = historico
        .filter((t) => Boolean(t && t.text && t.text.trim()))
        .slice(-JANELA_HISTORICO_MAX);

    const normalizados: TurnoHistorico[] = [];
    for (const turno of recentes) {
        if (normalizados.length === 0 && turno.role !== "user") {
            continue;
        }
        const ultimo = normalizados[normalizados.length - 1];
        if (ultimo && ultimo.role === turno.role) {
            ultimo.text = `${ultimo.text}\n${turno.text.trim()}`;
        } else {
            normalizados.push({ role: turno.role, text: turno.text.trim() });
        }
    }

    const contextoJson = contexto
        ? JSON.stringify(anonimizarContexto(contexto), null, 2)
        : "Contexto financeiro ainda não carregado (usuário sem resumo disponível no momento).";

    const promptAtual = [
        "Contexto financeiro anonimizado (JSON):",
        "```json",
        contextoJson,
        "```",
        "",
        `Pergunta do usuário: ${pergunta.trim()}`,
    ].join("\n");

    const contents = normalizados.map((t) => ({
        role: t.role,
        parts: [{ text: t.text }],
    }));

    const ultimo = contents[contents.length - 1];
    if (ultimo && ultimo.role === "user") {
        ultimo.parts[0].text = `${ultimo.parts[0].text}\n\n${promptAtual}`;
    } else {
        contents.push({
            role: "user",
            parts: [{ text: promptAtual }],
        });
    }

    return contents;
}

/**
 * Consulta a API Gemini 2.5 Flash com contexto financeiro anonimizado e grounding estrito.
 */
export async function consultarGemini(
    pergunta: string,
    contexto: ContextoFinanceiroBufunfa | null,
    historico: TurnoHistorico[] = [],
    apiKeyOverride?: string
): Promise<RespostaGemini> {
    const apiKey = (apiKeyOverride ?? process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "").trim();
    if (!apiKey) {
        throw new Error("EXPO_PUBLIC_GEMINI_API_KEY não configurada no ambiente.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(`${GEMINI_ENDPOINT_BASE}?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            signal: controller.signal,
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: SYSTEM_INSTRUCTION }],
                },
                contents: montarConteudosGemini(pergunta, contexto, historico),
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 800,
                },
            }),
        });

        if (!response.ok) {
            const erroCorpo = await response.text().catch(() => "");
            throw new Error(`Gemini API HTTP ${response.status}: ${erroCorpo.slice(0, 200)}`);
        }

        const data = await response.json();
        const parts: Array<{ text?: string }> = data?.candidates?.[0]?.content?.parts || [];
        const textoBruto = parts
            .map((p) => p.text || "")
            .join("")
            .trim();
        const texto = limparMarkdown(textoBruto);

        if (!texto) {
            throw new Error("Gemini API retornou resposta vazia.");
        }

        const usage = data?.usageMetadata;
        return {
            texto,
            tokensPrompt: typeof usage?.promptTokenCount === "number" ? usage.promptTokenCount : undefined,
            tokensResposta:
                typeof usage?.candidatesTokenCount === "number"
                    ? usage.candidatesTokenCount
                    : undefined,
            tokensTotal: typeof usage?.totalTokenCount === "number" ? usage.totalTokenCount : undefined,
        };
    } finally {
        clearTimeout(timeoutId);
    }
}
