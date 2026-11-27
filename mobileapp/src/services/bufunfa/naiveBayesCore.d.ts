export interface ResultadoNaiveBayesPuro {
    intencao: string;
    confianca: number;
    margem: number;
    taxaOOV: number;
    probabilidades: Record<string, number>;
}

export function normalizar(texto: string): string;
export function extrairTokens(texto: string): string[];
export function classificarNaiveBayesPuro(texto: string): ResultadoNaiveBayesPuro;
