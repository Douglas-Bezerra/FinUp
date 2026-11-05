# Relatório Técnico de PLN: Classificador de Intenções do Assistente Bufunfa

**Projeto:** FinUp - Controle Financeiro Multiplataforma  
**Módulo:** Assistente Virtual "Bufunfa"  
**Algoritmo:** Multinomial Naive Bayes com Suavização de Laplace (*Laplace Smoothing*)  
**Representação Textual:** Bag of Words com Unigramas e Bigramas  
**Ambiente de Execução:** Dispositivo Móvel (On-device / 100% Offline)  

---

## 1. Fundamentação Teórica

O assistente **Bufunfa** emprega o classificador probabilístico **Multinomial Naive Bayes (MNB)** para identificar a intenção financeira contida na mensagem (voz transcrita ou texto digitado) do usuário.

A probabilidade a posteriori de uma intenção $C_k$ dado o vetor de termos $\mathbf{x} = (t_1, t_2, \dots, t_n)$ é calculada pelo Teorema de Bayes:

$$P(C_k \mid \mathbf{x}) = \frac{P(C_k) \prod_{i=1}^n P(t_i \mid C_k)}{P(\mathbf{x})}$$

Como o denominador $P(\mathbf{x})$ é constante para todas as classes, a classe prevista $\hat{C}$ é obtida maximizando a verossimilhança no espaço logarítmico (para evitar *underflow numérico*):

$$\hat{C} = \arg\max_{C_k} \left[ \ln P(C_k) + \sum_{i=1}^n \ln P(t_i \mid C_k) \right]$$

### 1.1 Suavização de Laplace (Laplace Smoothing)
Para garantir que palavras não observadas durante o treino em determinada classe não zerem a probabilidade total, aplica-se a suavização com $\alpha = 1$:

$$P(t_i \mid C_k) = \frac{\text{count}(t_i, C_k) + 1}{\sum_{w \in V} \text{count}(w, C_k) + |V|}$$

Onde $|V|$ é o tamanho total do vocabulário único extraído do corpus.

---

## 2. Intenções Mapeadas no Domínio Financeiro

O modelo foi treinado para discriminar **9 intenções financeiras especializadas**:

1. **`COMPARAR_MES_ANTERIOR`**: Consultas comparativas entre o mês vigente e o mês anterior (ex: *"compara meus gastos desse mês com mês passado e diz onde gastei mais"*).
2. **`ONDE_GASTEI_MAIS`**: Identificação da categoria de despesa mais pesada do período.
3. **`ONDE_GASTEI_MENOS`**: Identificação da despesa de menor valor.
4. **`GASTO_CATEGORIA`**: Consultas pontuais por área (ex: *"quanto gastei com alimentação?"*).
5. **`CONSULTAR_SALDO`**: Consulta de liquidez geral e saldo por conta bancária.
6. **`CONSULTAR_GASTOS`**: Total acumulado de saídas no mês.
7. **`CONSULTAR_RECEITAS`**: Total acumulado de entradas/salários no mês.
8. **`SAUDE_FINANCEIRA`**: Diagnóstico consolidado de economia, taxa de poupança e sobra.
9. **`CORTAR_GASTOS`**: Recomendações e análise de cortes potenciais.

---

## 3. Métricas e Resultados Experimentais

- **Total de Exemplos de Treinamento:** 124 sentenças
- **Dimensão do Espaço Vetorial (|V|):** 515 termos (unigramas e bigramas)
- **Acurácia Global do Modelo:** **99.19%**
- **Tempo Médio de Inferência:** < 1 ms por predição (execução local em JavaScript/TypeScript)
- **Pegada de Memória:** ~178.34 KB

### Matriz de Confusão

| Intenção Real \ Predita | COMPARAR_M | ONDE_GASTE | ONDE_GASTE | GASTO_CATE | CONSULTAR_ | CONSULTAR_ | CONSULTAR_ | SAUDE_FINA | CORTAR_GAS |
|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **COMPARAR_MES_ANTERIOR** | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **ONDE_GASTEI_MAIS** | 0 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **ONDE_GASTEI_MENOS** | 0 | 0 | 16 | 0 | 0 | 0 | 0 | 0 | 0 |
| **GASTO_CATEGORIA** | 0 | 0 | 0 | 15 | 0 | 0 | 0 | 0 | 0 |
| **CONSULTAR_SALDO** | 0 | 0 | 0 | 0 | 14 | 0 | 0 | 0 | 0 |
| **CONSULTAR_GASTOS** | 0 | 0 | 0 | 1 | 0 | 10 | 0 | 0 | 0 |
| **CONSULTAR_RECEITAS** | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 0 | 0 |
| **SAUDE_FINANCEIRA** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12 | 0 |
| **CORTAR_GASTOS** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 10 |

---

## 4. Metodologia de Coleta e Validação Humana (Google Forms)

Para validar a generalização em ambiente real, o projeto adota o seguinte protocolo experimental:

1. **Fase 1 (Baseline Sintético):** Treinamento inicial com variações canônicas de vocabulário (Acurácia: 99.19%).
2. **Fase 2 (Coleta em Campo via Forms):** Disparo de formulário para amostragem de usuários com cenários situacionais sem indução léxica prévia.
3. **Fase 3 (Avaliação de Generalização):** Teste das respostas reais contra o modelo treinado para calcular Precisão, Recall e F1-Score em dados não-vistos (*out-of-distribution*).
4. **Fase 4 (Fine-Tuning Incremental):** Incorporação das respostas humanas ao `dataset.json` e re-treinamento para absorção de gírias e variações regionais.
