import { useEffect, useState } from "react";

//https://www.youtube.com/watch?v=dq7yGk64AG0&t=1113s
// Fiz os cálculos baseado nesse vídeo!

const API_BASE = "https://brapi.dev/api/quote/";
const API_KEY = import.meta.env.VITE_API_KEY as string;

const DEFAULT_TICKERS = [
  "BBAS3",
  "PETR4",
  "CXSE3",
  "BBSE3",
  "CMIG4",
  "VALE3",
  "TAEE3"
];

type Row = {
  ticker: string;
  preco: string;
  lpa: string;
  payout: string;
  cagr: string;
  dy: string;
  tempo: string;
  lpaFuturo: string;
  dividendo: string;
  precoTeto: string;
  margem: string;
};


const STOCK_PRESETS: Record<string, { payout: string; cagr: string }> = {
  BBAS3: { payout: "37.45", cagr: "6.82" },
  PETR4: { payout: "65.05", cagr: "34.91" },
  CXSE3: { payout: "56.82", cagr: "6.01" },
  BBSE3: { payout: "84.58", cagr: "6.19" },
  CMIG4: { payout: "70.26", cagr: "8.77" },
  VALE3: { payout: "51.29", cagr: "6.60" },
  TAEE3: { payout: "75.52", cagr: "7.26" }
};

function createRowWithTicker(ticker: string): Row {
  return {
    ...createEmptyRow(),
    ticker
  };
}

type WarningLevel = "warning" | "attention" | null;

type WarningResult = {
  cagr: WarningLevel;
  payout: WarningLevel;
  dy: WarningLevel;
  tempo: WarningLevel;
  lpa: WarningLevel;
  margem: WarningLevel;
  precoTetoRatio: WarningLevel;
  precoTetoRatioMessage?: string;
};

function getFieldWarnings(row: Row): WarningResult {
  const cagr = Number(row.cagr);
  const payout = Number(row.payout);
  const dy = Number(row.dy);
  const tempo = Number(row.tempo);
  const lpa = parseBR(row.lpa);
  const margem = parseFloat(row.margem);
  const preco = parseBR(row.preco);
  const precoTeto = parseBR(row.precoTeto);

  const warnings: WarningResult = {
    cagr: null,
    payout: null,
    dy: null,
    tempo: null,
    lpa: null,
    margem: null,
    precoTetoRatio: null
  };

  // 1. CAGR Validation
  if (!isNaN(cagr)) {
    if (cagr > 25) warnings.cagr = "attention";
    else if (cagr > 15) warnings.cagr = "attention";
    else if (cagr > 10) warnings.cagr = "warning";
  }

  // 2. Payout Validation
  if (!isNaN(payout)) {
    if (payout > 100) warnings.payout = "attention";
    else if (payout > 80) warnings.payout = "warning";
    else if (payout < 30) warnings.payout = "warning";
  }

  // 3. DY Validation
  if (!isNaN(dy)) {
    if (dy < 4) warnings.dy = "attention";
    else if (dy < 6) warnings.dy = "warning";
    else if (dy > 12) warnings.dy = "warning";
  }

  // 4. Tempo Validation
  if (!isNaN(tempo)) {
    if (tempo > 10) warnings.tempo = "attention";
    else if (tempo >= 6) warnings.tempo = "warning";
    else if (tempo < 3) warnings.tempo = "warning";
  }

  // 5. LPA Validation
  if (!isNaN(lpa) && lpa <= 0) {
    warnings.lpa = "attention";
  }

  // 6. Margem Validation
  if (!isNaN(margem) && row.margem !== "-") {
    if (margem > 100) warnings.margem = "attention";
    else if (margem > 50) warnings.margem = "warning";
  }

  // 7. Relação Preço Teto vs Preço Atual
  if (!isNaN(preco) && !isNaN(precoTeto) && preco > 0) {
    const ratio = precoTeto / preco;
    if (!isNaN(ratio)) {
      if (ratio > 3) {
        warnings.precoTetoRatio = "attention";
        warnings.precoTetoRatioMessage = `Preço teto é ${ratio.toFixed(1)}x o preço atual`;
      } else if (ratio > 2) {
        warnings.precoTetoRatio = "warning";
        warnings.precoTetoRatioMessage = `Preço teto é ${ratio.toFixed(1)}x o preço atual`;
      }
    }
  }

  return warnings;
}

type WarningField = Exclude<keyof WarningResult, "precoTetoRatioMessage">;

function getWarningTooltip(
  field: WarningField,
  warnings: WarningResult
): string | null {
    const messages: Record<
      WarningField,
      Partial<Record<Exclude<WarningLevel, null>, string>>
    > = {
    cagr: {
      warning: "Crescimento otimista. Difícil sustentar esse ritmo a longo prazo",
      attention: "Crescimento provavelmente irrealista. Verifique as premissas",
    },
    payout: {
      warning: "Empresa distribui muita parte dos lucros. Menos reinvestimento",
      attention: "Payout > 100%: modelo insustentável. Verifique os dados",
    },
    dy: {
      warning: "DY baixo. Pode inflar preço teto",
      attention: "DY muito baixo. Forte distorção no cálculo",
    },
    tempo: {
      warning: "Horizonte longo aumenta incerteza",
      attention: "Previsão muito longa. Alta chance de erro",
    },
    lpa: {
      attention: "LPA negativo ou zero. Modelo perde validade",
    },
    margem: {
      warning: "Margem alta pode indicar premissas otimistas",
      attention: "Margem > 100%. Provável distorção",
    },
    precoTetoRatio: {
      warning: "Preço teto 2–3x maior que o atual",
      attention: "Preço teto muito acima (>3x). Revise premissas",
    }
  };

  const level = warnings[field];

  if (level !== "warning" && level !== "attention") {
    return null;
  }

  return messages[field]?.[level] ?? null;
}

function getWarningClass(warningLevel: WarningLevel): string {
  if (warningLevel === "attention") return "field-attention";
  if (warningLevel === "warning") return "field-warning";
  return "";
}

function createEmptyRow(): Row {
  return {
    ticker: "",
    preco: "",
    lpa: "",
    payout: "", //Payout: muda ~1 vez por ano (às vezes trimestral, mas anual é o padrão relevante)
    cagr: "", //CAGR: muda ~a cada 3–5 anos (é uma métrica de longo prazo)
    tempo: "3",
    dy: "8",
    lpaFuturo: "-",
    dividendo: "-",
    precoTeto: "-",
    margem: "-"
  };
}

const COLUMN_KEYS: (keyof Row)[] = [
  "ticker",
  "preco",
  "lpa",
  "payout",
  "cagr",
  "dy",
  "tempo",
  "lpaFuturo",
  "dividendo",
  "precoTeto",
  "margem"
];

export default function App() {
  const [rows, setRows] = useState<Row[]>(
    DEFAULT_TICKERS.map(createRowWithTicker)
  );
  const [sortBy, setSortBy] = useState<keyof Row | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  async function fetchStockData(index: number, ticker: string) {
    if (!ticker) return;

    try {
      const preset = STOCK_PRESETS[ticker.toUpperCase()];

      const res = await fetch(
        `${API_BASE}${ticker}?modules=summaryProfile&token=${API_KEY}`
      );

      const data = await res.json();
      const stock = data?.results?.[0];
      if (!stock) return;

      updateRow(index, {
        preco: stock.regularMarketPrice?.toFixed(2) ?? "",
        lpa: stock.earningsPerShare?.toFixed(2) ?? "",
        payout: preset?.payout ?? "",
        cagr: preset?.cagr ?? ""
      });

      setTimeout(() => calcular(index), 0);
    } catch (err) {
      console.error("Erro ao buscar API:", err);
    }
  }
  useEffect(() => {
    rows.forEach((row, index) => {
      if (row.ticker) {
        fetchStockData(index, row.ticker);
      }
    });
  }, []);


  function updateRow(index: number, newData: Partial<Row>) {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...newData };
      return updated;
    });
  }

  function calcular(index: number) {
    setRows((prev) => {
      const updated = [...prev];
      const row = updated[index];

      const preco = parseBR(row.preco);
      const lpa = parseBR(row.lpa);
      const payout = Number(row.payout) / 100;
      const cagr = Number(row.cagr) / 100;
      const dyDesejado = Number(row.dy) / 100;
      const tempo = Number(row.tempo);

      if (
        isNaN(preco) ||
        isNaN(lpa) ||
        isNaN(payout) ||
        isNaN(cagr) ||
        isNaN(dyDesejado) ||
        isNaN(tempo)
      ) {
        return prev;
      }

      const lpaFuturo = lpa * Math.pow(1 + cagr, tempo);
      const dividendoFuturo = lpaFuturo * payout;
      const precoTeto = dividendoFuturo / dyDesejado;
      const margem = ((precoTeto - preco) / preco) * 100;

      updated[index] = {
        ...row,
        lpaFuturo: lpaFuturo.toFixed(2),
        dividendo: dividendoFuturo.toFixed(2),
        precoTeto: precoTeto.toFixed(2),
        margem: margem.toFixed(2) + "%"
      };

      return updated;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow()]);
  }

  function handleSort(column: keyof Row) {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  }

  function parseValue(value: string): number {
    // Remove símbolos como % e espaços
    const cleaned = value.replace(/%/g, '').trim();
    return parseBR(cleaned);
  }

  function getSortedRows() {
    if (!sortBy) return rows;

    const sorted = [...rows].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      // Tenta converter para número
      const aNum = parseValue(aVal);
      const bNum = parseValue(bVal);

      // eslint-disable-next-line no-useless-assignment
      let comparison = 0;

      if (!isNaN(aNum) && !isNaN(bNum)) {
        comparison = aNum - bNum;
      } else {
        // Comparação como string
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }

  const columnLabels: Record<keyof Row, string> = {
    ticker: "Ticker da Ação",
    preco: "Preço atual (R$)",
    lpa: "LPA atual (R$)",
    payout: "Payout médio (%)",
    cagr: "CAGR Lucros médio (%)",
    dy: "DY desejado (%)",
    tempo: "Tempo da previsão (anos)",
    lpaFuturo: "LPA Futuro (R$)",
    dividendo: "Dividendo futuro (R$)",
    precoTeto: "Preço Teto (R$)",
    margem: "Margem de segurança (%)"
  };

  return (
    <div className="container">
      <div>
        <h1>Calculadora de Preço Teto</h1>
        <p className="subtitle">
          Calcule o preço máximo que você deve pagar por uma ação com base em sua estratégia de dividendos
        </p>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {COLUMN_KEYS.map((key) => (
                <th key={key} className="sortable-header" onClick={() => handleSort(key)}>
                  <span className="header-content">
                    {columnLabels[key]}
                    {sortBy === key && (
                      <span className={`sort-indicator ${sortOrder}`}>
                        {sortOrder === 'asc' ? ' ▲' : ' ▼'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {getSortedRows().map((row, i) => {
              const warnings = getFieldWarnings(row);
              return (
                <tr key={i}>
                  <td>
                    <input
                      type="text"
                      value={row.ticker}
                      onChange={(e) => {
                        const originalIndex = rows.indexOf(row);
                        updateRow(originalIndex, { ticker: e.target.value });
                      }}
                      onBlur={(e) => {
                        const originalIndex = rows.indexOf(row);
                        fetchStockData(originalIndex, e.target.value);
                      }}
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      value={row.preco}
                      onChange={(e) => {
                        const originalIndex = rows.indexOf(row);
                        updateRow(originalIndex, { preco: e.target.value });
                        calcular(originalIndex);
                      }}
                    />
                  </td>

                  <td>
                    <div className={`input-wrapper ${getWarningClass(warnings.lpa)}`} data-tooltip={getWarningTooltip("lpa", warnings) || undefined}>
                      <input
                        type="text"
                        value={row.lpa}
                        onChange={(e) => {
                          const originalIndex = rows.indexOf(row);
                          updateRow(originalIndex, { lpa: e.target.value });
                          calcular(originalIndex);
                        }}
                      />
                      {warnings.lpa && <span className="warning-icon">⚠️</span>}
                    </div>
                  </td>

                  <td>
                    <div className={`input-wrapper ${getWarningClass(warnings.payout)}`} data-tooltip={getWarningTooltip("payout", warnings) || undefined}>
                      <input
                        type="text"
                        value={row.payout}
                        onChange={(e) => {
                          const originalIndex = rows.indexOf(row);
                          updateRow(originalIndex, { payout: e.target.value });
                          calcular(originalIndex);
                        }}
                      />
                      {warnings.payout && <span className="warning-icon">⚠️</span>}
                    </div>
                  </td>

                  <td>
                    <div className={`input-wrapper ${getWarningClass(warnings.cagr)}`} data-tooltip={getWarningTooltip("cagr", warnings) || undefined}>
                      <input
                        type="text"
                        value={row.cagr}
                        onChange={(e) => {
                          const originalIndex = rows.indexOf(row);
                          updateRow(originalIndex, { cagr: e.target.value });
                          calcular(originalIndex);
                        }}
                      />
                      {warnings.cagr && <span className="warning-icon">⚠️</span>}
                    </div>
                  </td>

                  <td>
                    <div className={`input-wrapper ${getWarningClass(warnings.dy)}`} data-tooltip={getWarningTooltip("dy", warnings) || undefined}>
                      <input
                        type="text"
                        value={row.dy}
                        onChange={(e) => {
                          const originalIndex = rows.indexOf(row);
                          updateRow(originalIndex, { dy: e.target.value });
                          calcular(originalIndex);
                        }}
                      />
                      {warnings.dy && <span className="warning-icon">⚠️</span>}
                    </div>
                  </td>

                  <td>
                    <div className={`input-wrapper ${getWarningClass(warnings.tempo)}`} data-tooltip={getWarningTooltip("tempo", warnings) || undefined}>
                      <input
                        type="text"
                        value={row.tempo}
                        onChange={(e) => {
                          const originalIndex = rows.indexOf(row);
                          updateRow(originalIndex, { tempo: e.target.value });
                          calcular(originalIndex);
                        }}
                      />
                      {warnings.tempo && <span className="warning-icon">⚠️</span>}
                    </div>
                  </td>

                  <td>{row.lpaFuturo}</td>
                  <td>{row.dividendo}</td>

                  <td>
                    <div className={getWarningClass(warnings.precoTetoRatio)}>
                      <span title={warnings.precoTetoRatioMessage || ""}>{row.precoTeto}</span>
                      {warnings.precoTetoRatio && <span className="warning-icon">⚠️</span>}
                    </div>
                  </td>

                  <td className={
                    row.margem === "-"
                      ? "margin-empty"
                      : parseFloat(row.margem) >= 0
                        ? "margin-positive"
                        : "margin-negative"
                  }>
                    <div className={getWarningClass(warnings.margem)}>
                      <span title={getWarningTooltip("margem", warnings) || ""}>{row.margem}</span>
                      {warnings.margem && <span className="warning-icon">⚠️</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="button-container">
        <button onClick={addRow}>+ Adicionar Linha</button>
      </div>

      <div className="glossary">
        <h2>📚 Glossário de Campos</h2>
        <div className="glossary-grid">

          <div className="glossary-item">
            <strong>Preço atual (R$)</strong>
            <p>
              Preço de negociação da ação no momento. 
              <br />
              ⚠️ Pode oscilar no curto prazo sem refletir valor real.
            </p>
          </div>

          <div className="glossary-item">
            <strong>LPA atual (R$)</strong>
            <p>
              Lucro por ação da empresa.
              <br />
              ✅ Ideal usar média de alguns anos.
              <br />
              ⚠️ Evite usar LPA de anos atípicos (lucro inflado ou prejuízo pontual).
            </p>
          </div>

          <div className="glossary-item">
            <strong>Payout médio (%)</strong>
            <p>
              Percentual do lucro distribuído como dividendos.
              <br />
              📊 Faixa comum: 40% – 80%
              <br />
              ⚠️ Acima de 100% pode indicar distribuição insustentável
              <br />
              💡 Empresas elétricas e seguradoras costumam ter payout mais alto
            </p>
          </div>

          <div className="glossary-item">
            <strong>CAGR Lucros médio (%)</strong>
            <p>
              Crescimento médio anual dos lucros.
              <br />
              📊 Conservador: 3% – 8%
              <br />
              📊 Moderado: 8% – 12%
              <br />
              ⚠️ Acima de 15% tende a ser difícil de sustentar no longo prazo
              <br />
              ❗ Valores muito altos inflacionam fortemente o preço teto
            </p>
          </div>

          <div className="glossary-item">
            <strong>DY desejado (%)</strong>
            <p>
              Retorno em dividendos que você exige.
              <br />
              📊 Comum: 6% – 10%
              <br />
              💡 Quanto maior o DY exigido → menor será o preço teto
              <br />
              ⚠️ DY muito baixo pode fazer você pagar caro na ação
            </p>
          </div>

          <div className="glossary-item">
            <strong>Tempo da previsão (anos)</strong>
            <p>
              Horizonte de projeção dos lucros.
              <br />
              📊 3 anos → conservador
              <br />
              📊 5 anos → equilibrado (recomendado)
              <br />
              ⚠️ Mais de 10 anos aumenta muito a incerteza
              <br />
              ❗ Tempo alto + CAGR alto = distorção forte
            </p>
          </div>

          <div className="glossary-item">
            <strong>LPA Futuro (R$)</strong>
            <p>
              Lucro projetado com base no CAGR.
              <br />
              ⚠️ Cresce exponencialmente com o tempo
              <br />
              ❗ Sensível a erros no CAGR
            </p>
          </div>

          <div className="glossary-item">
            <strong>Dividendo futuro (R$)</strong>
            <p>
              Estimativa de dividendos por ação.
              <br />
              💡 Depende diretamente do payout
              <br />
              ⚠️ Pode ser instável em empresas cíclicas
            </p>
          </div>

          <div className="glossary-item">
            <strong>Preço Teto (R$)</strong>
            <p>
              Valor máximo que você deveria pagar pela ação.
              <br />
              💡 Baseado no retorno desejado (DY)
              <br />
              ⚠️ Altamente sensível ao CAGR e payout
              <br />
              ❗ Pode inflar facilmente com premissas otimistas
            </p>
          </div>

          <div className="glossary-item">
            <strong>Margem de segurança (%)</strong>
            <p>
              Diferença entre o preço atual e o preço teto.
              <br />
              📊 Positivo → potencial oportunidade
              <br />
              📊 Negativo → ação pode estar cara
              <br />
              ⚠️ Não garante lucro, apenas indica desconto teórico
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}


function parseBR(value: string) {
  return Number(value.replace(",", "."));
}