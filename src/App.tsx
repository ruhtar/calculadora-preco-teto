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


export default function App() {
  const [rows, setRows] = useState<Row[]>(
    DEFAULT_TICKERS.map(createRowWithTicker)
  );

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

  return (
    <div className="container">
      <h1 className="text-2xl font-bold text-center mb-6">
        Calculadora de Preço Teto
      </h1>

      <table className="w-full border border-slate-700">
        <thead className="bg-purple-600">
          <tr>
            {[
              "Ticker da Ação",
              "Preço atual (R$)",
              "LPA atual (R$)",
              "Payout médio (%)",
              "CAGR Lucros médio (%)",
              "DY desejado (%)",
              "Tempo da previsão (anos)",
              "LPA Futuro (R$)",
              "Dividendo futuro (R$)",
              "Preço Teto (R$)",
              "Margem de segurança (%)"
            ].map((h) => (
              <th key={h} className="p-2 border">
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="text-center">
              <td>
                <input
                  className="bg-black w-full"
                  value={row.ticker}
                  onChange={(e) =>
                    updateRow(i, { ticker: e.target.value })
                  }
                  onBlur={() => fetchStockData(i, row.ticker)}
                />
              </td>

              {(["preco", "lpa", "payout", "cagr", "dy", "tempo"] as (keyof Row)[]).map(
                (field) => (
                  <td key={field}>
                    <input
                      className="bg-black w-full"
                      value={row[field]}
                      onChange={(e) => {
                        updateRow(i, { [field]: e.target.value });
                        calcular(i);
                      }}
                    />
                  </td>
                )
              )}

              <td>{row.lpaFuturo}</td>
              <td>{row.dividendo}</td>
              <td>{row.precoTeto}</td>
              <td className="text-green-400 font-bold">{row.margem}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={addRow}
        className="mt-4 px-4 py-2 bg-green-500 text-black font-bold"
      >
        Adicionar Linha
      </button>
    </div>
  );
}


function parseBR(value: string) {
  return Number(value.replace(",", "."));
}