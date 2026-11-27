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

/**
 * Avalia se a predição do Naive Bayes atende às travas matemáticas para detecção OOD.
 * @param {{ intencao: string, confianca: number, margem: number, taxaOOV: number }} resultadoNB
 * @returns {{ aprovado: boolean, motivos: string[], motivoResumo: string }}
 */
function avaliarTravasOOD(resultadoNB) {
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
        motivos,
        motivoResumo,
    };
}

module.exports = {
    TRAVAS_OOD,
    normalizar,
    extrairTokens,
    classificarNaiveBayesPuro,
    avaliarTravasOOD,
};
