const modelData = require("./model.json");

const VOCABULARIO_CONHECIDO = new Set(
    Object.keys((modelData.logLikelihoods && modelData.logLikelihoods[modelData.classes[0]]) || {})
);

const TRAVAS_OOD = {
    CONFIANCA_MINIMA: 0.70,
    MARGEM_MINIMA: 0.25,
    TAXA_OOV_MAXIMA: 0.40,
};

/**
 * Normaliza o texto removendo acentos e pontuação.
 * @param {string} texto
 * @returns {string}
 */
function normalizar(texto) {
    return String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Extrai unigramas (palavras com >1 caractere) e bigramas adjacentes.
 * @param {string} texto
 * @returns {string[]}
 */
function extrairTokens(texto) {
    const limpo = normalizar(texto);
    if (!limpo) return [];
    const palavras = limpo.split(" ").filter((p) => p.length > 1);
    const tokens = [...palavras];

    for (let i = 0; i < palavras.length - 1; i++) {
        tokens.push(`${palavras[i]}_${palavras[i + 1]}`);
    }

    return tokens;
}

/**
 * Função pura de inferência do classificador Multinomial Naive Bayes (sem regras heurísticas).
 * @param {string} texto
 * @returns {{ intencao: string, confianca: number, margem: number, taxaOOV: number, probabilidades: Record<string, number> }}
 */
function classificarNaiveBayesPuro(texto) {
    const tokens = extrairTokens(texto);
    if (tokens.length === 0) {
        return {
            intencao: "DESCONHECIDO",
            confianca: 0,
            margem: 0,
            taxaOOV: 1,
            probabilidades: {},
        };
    }

    const tokensOOV = tokens.filter((t) => !VOCABULARIO_CONHECIDO.has(t)).length;
    const taxaOOV = tokensOOV / tokens.length;

    const { classes, logPriors, logLikelihoods, tokenTotals, vocabularioSize } = modelData;
    const scores = {};

    for (const className of classes) {
        let score = Object.prototype.hasOwnProperty.call(logPriors, className)
            ? logPriors[className]
            : 0;
        const totalTokensClasse = Object.prototype.hasOwnProperty.call(tokenTotals, className)
            ? tokenTotals[className]
            : 1;
        const defaultLogProb = Math.log(1 / (totalTokensClasse + vocabularioSize));
        const classLikelihoods = Object.prototype.hasOwnProperty.call(logLikelihoods, className)
            ? logLikelihoods[className]
            : {};

        for (const token of tokens) {
            if (Object.prototype.hasOwnProperty.call(classLikelihoods, token)) {
                score += classLikelihoods[token];
            } else {
                score += defaultLogProb;
            }
        }

        scores[className] = score;
    }

    // Softmax numericamente estabilizado
    const maxScore = Math.max(...Object.values(scores));
    const expScores = {};
    let sumExp = 0;

    for (const className of classes) {
        expScores[className] = Math.exp(scores[className] - maxScore);
        sumExp += expScores[className];
    }

    const probabilidades = {};
    const ranking = [];

    for (const className of classes) {
        const prob = sumExp > 0 ? expScores[className] / sumExp : 0;
        probabilidades[className] = prob;
        ranking.push({ classe: className, prob });
    }

    ranking.sort((a, b) => b.prob - a.prob);

    const top = ranking[0] || { classe: "DESCONHECIDO", prob: 0 };
    const second = ranking[1] || { classe: "DESCONHECIDO", prob: 0 };

    return {
        intencao: top.classe,
        confianca: top.prob,
        margem: top.prob - second.prob,
        taxaOOV,
        probabilidades,
    };
}

const ROTULOS_SINAIS = {
    COMPARACAO: "Comparação",
    EXTREMOS: "Extremos",
    CATEGORIA_ESPECIFICA: "Categoria",
    SALDO: "Saldo",
    RECEITAS: "Receitas",
    SAUDE: "Saúde",
    CORTES: "Cortes",
};

/**
 * Detecta se a frase combina múltiplas intenções financeiras distintas (Multi-Intent),
 * caso em que o Naive Bayes Single-Intent responderia apenas parte do pedido.
 * Preserva perguntas puras de extremos ("onde gastei mais e onde gastei menos") como intenção única.
 * @param {string} texto
 * @returns {{ multiIntent: boolean, sinais: string[], motivo: string | null }}
 */
function detectarMultiIntent(texto) {
    const limpo = normalizar(texto);
    if (!limpo) {
        return { multiIntent: false, sinais: [], motivo: null };
    }

    const sinais = [];

    if (/\b(compar\w*|diferenca|versus|vs|em relacao ao|evolucao)\b/.test(limpo)) {
        sinais.push("COMPARACAO");
    }

    const temExtremosExplicito =
        /\b(maior gasto|menor gasto|maior despesa|menor despesa|gastei mais|gastei menos|mais gastei|menos gastei|mais pesou|mais cara|mais baixa|mais barata|torrei mais|onde mais|onde menos)\b/.test(
            limpo
        );
    const temExtremosContextual =
        /\b(onde|qual categoria|em qual|em que categoria)\b/.test(limpo) &&
        /\b(gast\w*|despes\w*|dinheiro)\b/.test(limpo) &&
        /\b(mais|maior|menos|menor)\b/.test(limpo) &&
        !/\beconomizar mais\b/.test(limpo) &&
        !/\bcortar gasto\w*\b/.test(limpo);

    if (temExtremosExplicito || temExtremosContextual) {
        sinais.push("EXTREMOS");
    }

    const temCategoriaComum =
        /\b(alimentacao|comida|mercado|supermercado|restaurante|lanche|almoco|jantar|ifood|padaria|transporte|uber|gasolina|combustivel|onibus|metro|passagem|aluguel|moradia|condominio|farmacia|remedio|medico|consulta|dentista|hospital|lazer|cinema|viagem|educacao|curso|faculdade|escola|assinatura|assinaturas|streaming|netflix|spotify|shopping)\b/.test(
            limpo
        );
    const temSaudeCategoria = /\bsaude\b/.test(limpo) && !/\bsaude financeira\b/.test(limpo);

    if (temCategoriaComum || temSaudeCategoria) {
        sinais.push("CATEGORIA_ESPECIFICA");
    }

    if (/\b(saldo|quanto tenho|quanto sobrou na conta|dinheiro disponivel)\b/.test(limpo)) {
        sinais.push("SALDO");
    }

    if (
        /\b(receita|receitas|salario|salarios|quanto ganhei|quanto recebi|total de entradas|faturei)\b/.test(
            limpo
        )
    ) {
        sinais.push("RECEITAS");
    }

    if (
        /\b(saude financeira|situacao financeira|taxa de poupanca|no azul|no vermelho|diagnostico)\b/.test(
            limpo
        )
    ) {
        sinais.push("SAUDE");
    }

    if (
        /\b(cortar gasto\w*|cortar despesa\w*|corte de gasto\w*|enxugar|reduzir custo\w*|dicas para economizar|onde posso economizar)\b/.test(
            limpo
        )
    ) {
        sinais.push("CORTES");
    }

    const temConectivoForte =
        /\b(e me diga|e diga|e diz|e me mostra|e mostra|e tambem|alem disso|e ainda)\b/.test(
            limpo
        );

    const multiIntent = sinais.length >= 2 || (temConectivoForte && sinais.length >= 1);

    let motivo = null;
    if (multiIntent) {
        if (sinais.includes("COMPARACAO")) {
            motivo = "Multi-Intent: Comparação + Detalhes";
        } else if (sinais.length >= 2) {
            const rotulos = sinais.slice(0, 2).map((s) => ROTULOS_SINAIS[s] || s);
            motivo = `Multi-Intent: ${rotulos.join(" + ")}`;
        } else {
            motivo = "Multi-Intent: Pergunta Composta";
        }
    }

    return {
        multiIntent,
        sinais,
        motivo,
    };
}

/**
 * Avalia se a predição do Naive Bayes atende às travas matemáticas para detecção OOD
 * e verifica se a frase é composta (Multi-Intent).
 * @param {{ intencao: string, confianca: number, margem: number, taxaOOV: number }} resultadoNB
 * @param {string} [texto]
 * @returns {{ aprovado: boolean, multiIntent: boolean, motivos: string[], motivoResumo: string }}
 */
function avaliarTravasOOD(resultadoNB, texto = "") {
    if (texto) {
        const analiseMulti = detectarMultiIntent(texto);
        if (analiseMulti.multiIntent && analiseMulti.motivo) {
            return {
                aprovado: false,
                multiIntent: true,
                motivos: [analiseMulti.motivo],
                motivoResumo: analiseMulti.motivo,
            };
        }
    }

    const motivos = [];

    if (!resultadoNB || resultadoNB.intencao === "DESCONHECIDO") {
        motivos.push("Entrada vazia ou sem tokens");
    } else {
        if (resultadoNB.confianca < TRAVAS_OOD.CONFIANCA_MINIMA) {
            motivos.push(`Conf ${(resultadoNB.confianca * 100).toFixed(0)}% < ${(TRAVAS_OOD.CONFIANCA_MINIMA * 100).toFixed(0)}%`);
        }
        if (resultadoNB.margem < TRAVAS_OOD.MARGEM_MINIMA) {
            motivos.push(`Margem ${(resultadoNB.margem * 100).toFixed(0)}% < ${(TRAVAS_OOD.MARGEM_MINIMA * 100).toFixed(0)}%`);
        }
        if (resultadoNB.taxaOOV > TRAVAS_OOD.TAXA_OOV_MAXIMA) {
            motivos.push(`OOV ${(resultadoNB.taxaOOV * 100).toFixed(0)}% > ${(TRAVAS_OOD.TAXA_OOV_MAXIMA * 100).toFixed(0)}%`);
        }
    }

    const aprovado = motivos.length === 0;
    const motivoResumo = aprovado
        ? "Aprovado nas travas OOD"
        : `Fallback OOD: ${motivos.join(", ")}`;

    return {
        aprovado,
        multiIntent: false,
        motivos,
        motivoResumo,
    };
}

module.exports = {
    TRAVAS_OOD,
    normalizar,
    extrairTokens,
    detectarMultiIntent,
    classificarNaiveBayesPuro,
    avaliarTravasOOD,
};
