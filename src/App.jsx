import "./App.scss";
import { getZ, series } from "./utils/cableUtils";
import { formatNumber } from "./utils/format";
import { useIccCalc } from "./hooks/useIccCalc";

/* ── UI PRIMITIVOS ──────────────────────────────────────── */
function Card({ children }) {
  return <div className="card">{children}</div>;
}

function SectionHeader({ number, title, sub }) {
  return (
    <div className="sec-head">
      <div className="sec-head__row">
        <div className="sec-head__num">{number}</div>
        <h3 className="sec-head__title">{title}</h3>
      </div>
      {sub && <p className="sec-head__sub">{sub}</p>}
    </div>
  );
}

/* ── RESUMEN DE PARÁMETROS ───────────────────────────────── */
function SectionTitle({ children }) {
  return <div className="sec-title">{children}</div>;
}

function SummaryTable({ children }) {
  return (
    <div className="resumen-table">
      <table>{children}</table>
    </div>
  );
}

function ParameterSummary({ data, result }) {
  const { gridKVAcc, srcResults, loadResults } = result;
  const firstSource = srcResults[0];

  return (
    <div className="rp">
      <div className="rp__header">
        <div className="rp__title">Resumen de los Parámetros</div>
      </div>

      <div className="rp__body">

        <SectionTitle>Parámetros Operador de Red</SectionTitle>
        <SummaryTable>
          <tbody>
            <tr>
              <td className="rp-td rp-td--bold rp-td--slate">Nivel de Tensión [kV]</td>
              <td className="rp-td rp-td--bold rp-td--amber">{data.grid.kV}</td>
            </tr>
            <tr>
              <td className="rp-td rp-td--slate">Corriente de Cortocircuito 3Ø [kA]</td>
              <td className="rp-td">{data.grid.Icc}</td>
            </tr>
            <tr>
              <td className="rp-td rp-td--slate">kVAcc</td>
              <td className="rp-td rp-td--bold rp-td--blue">{gridKVAcc.toFixed(2)} kVA</td>
            </tr>
          </tbody>
        </SummaryTable>

        {firstSource?.type === "transformer" && firstSource?.inCable?.enabled && (
          <>
            <SectionTitle>Acometida de Media Tensión</SectionTitle>
            <SummaryTable>
              <thead><tr>
                {["Alimentador", "Calibre", "Material", "Longitud (m)", "Z (Ω)", "kVAsc"].map(h =>
                  <th key={h} className="rp-th">{h}</th>)}
              </tr></thead>
              <tbody>
                <tr>
                  <td className="rp-td rp-td--bold">RED {data.grid.kV} kV</td>
                  <td className="rp-td">{firstSource.inCable.gauge}</td>
                  <td className="rp-td">{firstSource.inCable.material ?? "Cobre"}</td>
                  <td className="rp-td">{firstSource.inCable.len}</td>
                  <td className="rp-td">{(getZ(firstSource.inCable.type, firstSource.inCable.gauge, firstSource.inCable.material, firstSource.inCable.canal) * firstSource.inCable.len / 1000).toFixed(4)}</td>
                  <td className="rp-td rp-td--bold rp-td--blue">{firstSource.inCableKVAcc?.toFixed(2) ?? "—"}</td>
                </tr>
              </tbody>
            </SummaryTable>
          </>
        )}

        <SectionTitle>Fuentes de Alimentación</SectionTitle>
        <SummaryTable>
          <thead><tr>
            {["Descrip.", "kVA", "Un (kV)", "Z% / X''d", "kVAeq"].map(h =>
              <th key={h} className="rp-th">{h}</th>)}
          </tr></thead>
          <tbody>
            {srcResults.map(source => (
              <tr key={source.id}>
                <td className="rp-td rp-td--bold">{source.label}</td>
                <td className="rp-td">{source.kVA}</td>
                <td className="rp-td">{source.kVsec}</td>
                <td className="rp-td">{source.type === "transformer" ? `${source.zPct}%` : `X''=${source.xdpp}`}</td>
                <td className="rp-td rp-td--bold rp-td--blue">{source.equipmentKVAcc.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </SummaryTable>

        {firstSource?.outCable?.enabled && (
          <>
            <SectionTitle>Acometida de Baja Tensión</SectionTitle>
            <SummaryTable>
              <thead><tr>
                {["Alimentador", "Calibre", "Material", "Longitud (m)", "Z (Ω)", "kVAsc"].map(h =>
                  <th key={h} className="rp-th">{h}</th>)}
              </tr></thead>
              <tbody>
                <tr>
                  <td className="rp-td rp-td--bold">{firstSource.label} - TGA</td>
                  <td className="rp-td">{firstSource.outCable.gauge}</td>
                  <td className="rp-td">{firstSource.outCable.material ?? "Cobre"}</td>
                  <td className="rp-td">{firstSource.outCable.len}</td>
                  <td className="rp-td">{(getZ(firstSource.outCable.type, firstSource.outCable.gauge, firstSource.outCable.material, firstSource.outCable.canal) * firstSource.outCable.len / 1000).toFixed(4)}</td>
                  <td className="rp-td rp-td--bold rp-td--blue">{firstSource.outCableKVAcc?.toFixed(2) ?? "—"}</td>
                </tr>
              </tbody>
            </SummaryTable>
          </>
        )}

        {loadResults.some(l => l.cable?.enabled) && (
          <>
            <SectionTitle>Alimentadores de Carga</SectionTitle>
            <SummaryTable>
              <thead><tr>
                {["Circ.", "Alimentador", "Calibre", "Material", "Long (m)", "Z (Ω)", "kVAsc"].map(h =>
                  <th key={h} className="rp-th">{h}</th>)}
              </tr></thead>
              <tbody>
                {loadResults.filter(l => l.cable?.enabled).map(load => (
                  <tr key={load.id}>
                    <td className="rp-td rp-td--slate">{load.circuitNumbers?.join("-") ?? load.circuitNumber}</td>
                    <td className="rp-td rp-td--bold">TGA - {load.label}</td>
                    <td className="rp-td">{load.cable.gauge}</td>
                    <td className="rp-td">{load.cable.material ?? "Cobre"}</td>
                    <td className="rp-td">{load.cable.len}</td>
                    <td className="rp-td">{(getZ(load.cable.type, load.cable.gauge, load.cable.material, load.cable.canal) * load.cable.len / 1000).toFixed(4)}</td>
                    <td className="rp-td rp-td--bold rp-td--blue">{load.cableKVAcc?.toFixed(2) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </SummaryTable>
          </>
        )}

        {loadResults.some(l => l.loadType === "motor") && (
          <>
            <SectionTitle>Cargas Inductivas (Motores)</SectionTitle>
            <SummaryTable>
              <thead><tr>
                {["Circ.", "Tipo", "Descrip.", "Fase", "V (V)", "Carga (VA)", "HP", "X''", "kVAsc"].map(h =>
                  <th key={h} className="rp-th">{h}</th>)}
              </tr></thead>
              <tbody>
                {loadResults.filter(l => l.loadType === "motor").map((load, i) => (
                  <tr key={load.id} className={i % 2 ? "rp-tr--odd" : ""}>
                    <td className="rp-td rp-td--slate">{load.circuitNumbers?.join("-") ?? load.circuitNumber}</td>
                    <td className="rp-td rp-td--amber">{load.circuitLoadType}</td>
                    <td className="rp-td rp-td--bold">{load.label}</td>
                    <td className="rp-td">{load.circuitPhase}</td>
                    <td className="rp-td">{load.voltageKV * 1000}</td>
                    <td className="rp-td">{load.loadVA}</td>
                    <td className="rp-td rp-td--green">{load.hp.toFixed(2)}</td>
                    <td className="rp-td rp-td--amber">{load.xdpp?.toFixed(3)}</td>
                    <td className="rp-td rp-td--bold rp-td--blue">{load.motorKVAcc?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </SummaryTable>
          </>
        )}

        {loadResults.some(l => l.loadType === "resistive") && (
          <>
            <SectionTitle>Cargas Resistivas</SectionTitle>
            <SummaryTable>
              <thead><tr>
                {["Circ.", "Tipo", "Descrip.", "Fase", "V (V)", "Carga (VA)", "kVAcc conductor"].map(h =>
                  <th key={h} className="rp-th">{h}</th>)}
              </tr></thead>
              <tbody>
                {loadResults.filter(l => l.loadType === "resistive").map((load, i) => (
                  <tr key={load.id} className={i % 2 ? "rp-tr--odd" : ""}>
                    <td className="rp-td rp-td--slate">{load.circuitNumbers?.join("-") ?? load.circuitNumber}</td>
                    <td className="rp-td rp-td--amber">{load.circuitLoadType}</td>
                    <td className="rp-td rp-td--bold">{load.label}</td>
                    <td className="rp-td">{load.circuitPhase}</td>
                    <td className="rp-td">{load.voltageKV * 1000}</td>
                    <td className="rp-td">{load.loadVA}</td>
                    <td className="rp-td rp-td--bold rp-td--amber">{load.cableKVAcc?.toFixed(2) ?? "—"} kVA</td>
                  </tr>
                ))}
              </tbody>
            </SummaryTable>
          </>
        )}

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   APP
══════════════════════════════════════════════════════════════ */
export default function App() {
  const {
    jsonText, setJsonText, jsonError,
    data, view, setView,
    result, canvasRef,
    parseAndCalculate,
  } = useIccCalc();

  /* ═══ JSON INPUT ═══ */
  if (view === "json") return (
    <div className="app">
      <div className="topbar">
        <div className="topbar__title">⚡ Cálculo de Cortocircuito</div>
        <div className="topbar__sub">Método de los kVA Equivalentes</div>
      </div>

      <div className="json-content">
        <Card>
          <SectionHeader
            number="1"
            title="Datos del Proyecto Eléctrico"
            sub="Pegue el JSON generado por el sistema de diseño eléctrico. Las cargas activas se derivan automáticamente de los circuitos."
          />
          <textarea
            className="json-area"
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            spellCheck={false}
          />
          {jsonError && (
            <div className="json-error">
              <strong>Error al parsear JSON:</strong> {jsonError}
            </div>
          )}
        </Card>

        <button onClick={parseAndCalculate} className="btn-calc">
          ⚡ Calcular y Ver Diagrama Unifilar →
        </button>
      </div>
    </div>
  );

  /* ═══ RESULTS ═══ */
  const {
    srcResults, loadResults, busKVAcc, upstreamKVAcc, downstreamKVAcc,
    symmetricShortCircuitCurrent, asymmetricShortCircuitCurrent,
    asymmetricFactor, busVoltageKV, gridKVAcc,
  } = result;

  return (
    <div className="app">
      <div className="res-topbar">
        <div>
          <div className="res-topbar__title">⚡ Diagrama de kVA's de Cortocircuito</div>
          <div className="res-topbar__sub">Barra {busVoltageKV * 1000} V — Método kVA Equivalentes</div>
        </div>
        <button onClick={() => setView("json")} className="btn-back">← Editar JSON</button>
      </div>

      {/* KPI strip */}
      <div className="kpi-strip">
        {[
          { label: "kVAcc Total en Barra", value: formatNumber(busKVAcc, 1) + " kVA",                        color: "amber", sub: "Σ upstream + downstream" },
          { label: "Icc Simétrica",        value: formatNumber(symmetricShortCircuitCurrent, 0) + " A",       color: "blue",  sub: `${busVoltageKV * 1000} V` },
          { label: "Icc Asimétrica",       value: formatNumber(asymmetricShortCircuitCurrent, 0) + " A",      color: "red",   sub: `Factor ×${asymmetricFactor}` },
          { label: "Contrib. Motores",     value: formatNumber(downstreamKVAcc, 1) + " kVA",                  color: "green", sub: "Aguas abajo" },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className={`kpi-item kpi-item--${color}`}>
            <div className="kpi-item__label">{label}</div>
            <div className={`kpi-item__value kpi-item__value--${color}`}>{value}</div>
            <div className="kpi-item__sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div className="canvas-wrap">
        <canvas ref={canvasRef} />
      </div>

      {/* Tables */}
      <div className="tables-content">
        <ParameterSummary data={data} result={result} />

        <Card>
          <div className="card-section-label">Flujo Aguas Arriba → Barra</div>
          <div className="table-overflow">
            <table className="res-table">
              <thead><tr>
                {["Fuente", "kVAcc fuente", "kVAcc pasante", "kVAcc a barra"].map(h => <th key={h} className="res-th">{h}</th>)}
              </tr></thead>
              <tbody>
                <tr>
                  <td className="res-td res-td--blue">Red / Distribución</td>
                  <td className="res-td res-td--amber res-td--bold res-td--mono">{formatNumber(gridKVAcc, 1)} kVA</td>
                  <td className="res-td">—</td>
                  <td className="res-td">—</td>
                </tr>
                {srcResults.map(source => (
                  <tr key={source.id}>
                    <td className="res-td res-td--dark res-td--bold">{source.label}</td>
                    <td className="res-td res-td--mono">{formatNumber(source.equipmentKVAcc, 1)} kVA</td>
                    <td className="res-td res-td--mono">{formatNumber(source.kVAccPassingThrough, 1)} kVA</td>
                    <td className="res-td res-td--blue res-td--bold res-td--mono">{formatNumber(source.kVAccAtSourceOutput, 1)} kVA</td>
                  </tr>
                ))}
                <tr className="res-tr--total-blue">
                  <td className="res-td res-td--amber res-td--bold" colSpan={3}>Total aguas arriba</td>
                  <td className="res-td res-td--amber res-td--bold res-td--mono res-td--lg">{formatNumber(upstreamKVAcc, 1)} kVA</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {loadResults.some(l => l.loadType === "motor") && (
          <Card>
            <div className="card-section-label">Contribución Motores → Barra</div>
            <div className="table-overflow">
              <table className="res-table">
                <thead><tr>
                  {["Circ.", "Tipo", "Motor", "V (V)", "HP", "X''d", "kVAcc motor", "kVAcc cable", "kVAcc a barra", "Icc (A)"].map(h => <th key={h} className="res-th">{h}</th>)}
                </tr></thead>
                <tbody>
                  {loadResults.filter(l => l.loadType === "motor").map((load, i) => {
                    const loadVoltageKV = load.voltageKV ?? busVoltageKV;
                    return (
                      <tr key={load.id} className={i % 2 ? "res-tr--striped" : ""}>
                        <td className="res-td res-td--slate">{load.circuitNumbers?.join("-") ?? load.circuitNumber}</td>
                        <td className="res-td res-td--amber">{load.circuitLoadType}</td>
                        <td className="res-td res-td--dark res-td--bold">{load.label}</td>
                        <td className="res-td">{load.voltageKV * 1000}</td>
                        <td className="res-td">{load.hp.toFixed(2)}</td>
                        <td className="res-td res-td--amber">{load.xdpp}</td>
                        <td className="res-td res-td--mono">{formatNumber(load.motorKVAcc, 1)}</td>
                        <td className={`res-td res-td--mono${load.cableKVAcc ? "" : " res-td--light"}`}>
                          {load.cableKVAcc ? formatNumber(load.cableKVAcc, 1) : "—"}
                        </td>
                        <td className="res-td res-td--green res-td--bold res-td--mono">{formatNumber(load.kVAccContributionToBus, 2)}</td>
                        <td className="res-td res-td--mono">{formatNumber(load.kVAccContributionToBus / (Math.sqrt(3) * loadVoltageKV), 1)}</td>
                      </tr>
                    );
                  })}
                  <tr className="res-tr--total-green">
                    <td className="res-td res-td--green res-td--bold" colSpan={8}>Total aguas abajo</td>
                    <td className="res-td res-td--green res-td--bold res-td--mono res-td--lg">{formatNumber(downstreamKVAcc, 1)} kVA</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {loadResults.some(l => l.loadType === "resistive") && (
          <Card>
            <div className="card-section-label">Cargas Resistivas — kVAcc Disponible en Terminal</div>
            <div className="table-overflow">
              <table className="res-table">
                <thead><tr>
                  {["Circ.", "Tipo", "Carga", "V (V)", "kVAcc conductor", "kVAcc en terminal", "Icc terminal (A)"].map(h => <th key={h} className="res-th">{h}</th>)}
                </tr></thead>
                <tbody>
                  {loadResults.filter(l => l.loadType === "resistive").map((load, i) => {
                    const loadVoltageKV  = load.voltageKV ?? busVoltageKV;
                    const terminalKVAcc  = load.cableKVAcc ? series(upstreamKVAcc, load.cableKVAcc) : upstreamKVAcc;
                    const terminalIcc    = terminalKVAcc / (Math.sqrt(3) * loadVoltageKV);
                    return (
                      <tr key={load.id} className={i % 2 ? "res-tr--striped" : ""}>
                        <td className="res-td res-td--slate">{load.circuitNumbers?.join("-") ?? load.circuitNumber}</td>
                        <td className="res-td res-td--amber">{load.circuitLoadType}</td>
                        <td className="res-td res-td--dark res-td--bold">{load.label}</td>
                        <td className="res-td">{load.voltageKV * 1000}</td>
                        <td className={`res-td res-td--mono${load.cableKVAcc ? "" : " res-td--light"}`}>
                          {load.cableKVAcc ? formatNumber(load.cableKVAcc, 1) : "—"}
                        </td>
                        <td className="res-td res-td--amber res-td--bold res-td--mono">{formatNumber(terminalKVAcc, 1)} kVA</td>
                        <td className="res-td res-td--mono">{formatNumber(terminalIcc, 1)} A</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Final summary */}
        <div className="summary-grid">
          <div>
            <div className="summary-section__title">Composición kVAcc en barra</div>
            {[
              { label: "Contrib. upstream (fuentes)",   value: upstreamKVAcc,   color: "blue",  unit: "kVA" },
              { label: "Contrib. downstream (motores)", value: downstreamKVAcc, color: "green", unit: "kVA" },
              { label: "kVAcc TOTAL BARRA",             value: busKVAcc,        color: "amber", unit: "kVA" },
            ].map(({ label, value, color, unit }) => (
              <div key={label} className="summary-row">
                <span className="summary-row__label">{label}</span>
                <span className={`summary-row__value summary-row__value--${color}`}>{formatNumber(value, 1)} {unit}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="summary-section__title">Corrientes — Barra {busVoltageKV * 1000} V</div>
            {[
              { label: "Icc simétrica",                         value: symmetricShortCircuitCurrent,  color: "blue", unit: "A" },
              { label: `Icc asimétrica ×${asymmetricFactor}`,   value: asymmetricShortCircuitCurrent, color: "red",  unit: "A" },
            ].map(({ label, value, color, unit }) => (
              <div key={label} className="summary-row">
                <span className="summary-row__label">{label}</span>
                <span className={`summary-row__value summary-row__value--${color}`}>{formatNumber(value, 1)} {unit}</span>
              </div>
            ))}
            <div className="formula-box">
              Fórmula: Icc = kVAcc / (√3 × {busVoltageKV * 1000} V)<br />
              Factor asimétrico: {asymmetricFactor} {busVoltageKV < 0.6 ? "(sistema ≤600V)" : "(sistema >600V)"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
