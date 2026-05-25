import "./App.scss";
import { getZ, series } from "./utils/cableUtils";
import { formatNumber } from "./utils/format";
import { useIccCalc } from "./hooks/useIccCalc";

/* ── UI PRIMITIVOS ──────────────────────────────────────── */
function Card({ children }) {
  return <div className="card">{children}</div>;
}



/* ── KV TABLE ────────────────────────────────────────────── */
function SectionTitle({ children }) {
  return <div className="sec-title">{children}</div>;
}

function KVTable({ rows }) {
  return (
    <div className="kv-table">
      <table>
        <tbody>
          {rows.map((row, i) => {
            if (row.type === "header") {
              return (
                <tr key={i}>
                  <td className="kv-td kv-td--header" colSpan={2}>{row.label}</td>
                </tr>
              );
            }
            if (row.type === "total") {
              return (
                <tr key={i} className={`kv-tr--total${row.color ? `-${row.color}` : ""}`}>
                  <td className={`kv-td kv-td--label kv-td--bold${row.color ? ` kv-td--${row.color}` : ""}`}>{row.label}</td>
                  <td className={`kv-td kv-td--value kv-td--bold${row.color ? ` kv-td--${row.color}` : ""}`}>{row.value}</td>
                </tr>
              );
            }
            return (
              <tr key={i}>
                <td className="kv-td kv-td--label">{row.label}</td>
                <td className={[
                  "kv-td kv-td--value",
                  row.color ? `kv-td--${row.color}` : "",
                  row.bold ? "kv-td--bold" : "",
                ].filter(Boolean).join(" ")}>{row.value}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── RESUMEN DE PARÁMETROS ───────────────────────────────── */
function ParameterSummary({ data, result }) {
  const { gridKVAcc, srcResults, loadResults, upstreamKVAcc, busVoltageKV } = result;
  const firstSource = srcResults[0];

  return (
    <div className="rp">
      <div className="rp__header">
        <div className="rp__title">Resumen de los Parámetros</div>
      </div>

      <div className="rp__body">

        <SectionTitle>Parámetros Operador de Red</SectionTitle>
        <KVTable rows={[
          { label: "Nivel de Tensión [kV]", value: data.grid.kV, bold: true, color: "amber" },
          { label: "Corriente Cortocircuito 3Ø [kA]", value: data.grid.Icc },
          { label: "kVAcc red", value: `${gridKVAcc.toFixed(2)} kVA`, bold: true, color: "blue" },
        ]} />

        {firstSource?.type === "transformer" && firstSource?.inCable?.enabled && (
          <>
            <SectionTitle>Acometida de Media Tensión</SectionTitle>
            <KVTable rows={[
              { label: "Alimentador", value: `RED ${data.grid.kV} kV`, bold: true },
              { label: "Calibre", value: firstSource.inCable.gauge },
              { label: "Material", value: firstSource.inCable.material ?? "Cobre" },
              { label: "Longitud (m)", value: firstSource.inCable.len },
              { label: "Z (Ω)", value: (getZ(firstSource.inCable.type, firstSource.inCable.gauge, firstSource.inCable.material, firstSource.inCable.canal) * firstSource.inCable.len / 1000).toFixed(4) },
              { label: "kVAcc cable", value: firstSource.inCableKVAcc?.toFixed(2) ?? "—", color: "blue" },
              { label: "kVAcc entrada eq.", value: `${firstSource.kVAccAtSourceInput?.toFixed(2) ?? "—"} kVA`, bold: true, color: "blue" },
            ]} />
          </>
        )}

        <SectionTitle>Fuentes de Alimentación</SectionTitle>
        <KVTable rows={srcResults.flatMap(source => [
          ...(srcResults.length > 1 ? [{ type: "header", label: source.label }] : []),
          { label: "kVA nominal", value: source.kVA },
          { label: "Un (kV)", value: source.kVsec },
          {
            label: source.type === "transformer" ? "Impedancia Z%" : "X''d",
            value: source.type === "transformer" ? `${source.zPct}%` : source.xdpp
          },
          { label: "kVAcc equipo", value: source.equipmentKVAcc.toFixed(2), color: "blue" },
          { label: "kVAcc pasante", value: source.kVAccPassingThrough.toFixed(2), color: "blue" },
          { label: "kVAcc a barra", value: `${source.kVAccAtSourceOutput.toFixed(2)} kVA`, bold: true, color: "blue" },
        ])} />

        {firstSource?.outCable?.enabled && (
          <>
            <SectionTitle>Acometida de Baja Tensión</SectionTitle>
            <KVTable rows={[
              { label: "Alimentador", value: `${firstSource.label} – TGA`, bold: true },
              { label: "Calibre", value: firstSource.outCable.gauge },
              { label: "Material", value: firstSource.outCable.material ?? "Cobre" },
              { label: "Longitud (m)", value: firstSource.outCable.len },
              { label: "Z (Ω)", value: (getZ(firstSource.outCable.type, firstSource.outCable.gauge, firstSource.outCable.material, firstSource.outCable.canal) * firstSource.outCable.len / 1000).toFixed(4) },
              { label: "kVAcc cable", value: firstSource.outCableKVAcc?.toFixed(2) ?? "—", color: "blue" },
              { label: "kVAcc a barra", value: `${firstSource.kVAccAtSourceOutput.toFixed(2)} kVA`, bold: true, color: "blue" },
              { label: "Icc en barra (A)", value: `${(firstSource.kVAccAtSourceOutput / (Math.sqrt(3) * firstSource.kVsec)).toFixed(1)} A`, bold: true, color: "amber" },
            ]} />
          </>
        )}

        {loadResults.some(l => l.cable?.enabled) && (
          <>
            <SectionTitle>Alimentadores de Carga</SectionTitle>
            <KVTable rows={loadResults.filter(l => l.cable?.enabled).flatMap(load => {
              const vKV = load.voltageKV ?? busVoltageKV;
              const terminalKVAcc = load.cableKVAcc ? series(upstreamKVAcc, load.cableKVAcc) : upstreamKVAcc;
              const terminalIcc = terminalKVAcc / (Math.sqrt(3) * vKV);
              return [
                { type: "header", label: `Circ. ${load.circuitNumbers?.join("-") ?? load.circuitNumber} — ${load.label}` },
                { label: "Calibre", value: load.cable.gauge },
                { label: "Material", value: load.cable.material ?? "Cobre" },
                { label: "Longitud (m)", value: load.cable.len },
                { label: "Z (Ω)", value: (getZ(load.cable.type, load.cable.gauge, load.cable.material, load.cable.canal) * load.cable.len / 1000).toFixed(4) },
                { label: "kVAcc cable", value: load.cableKVAcc?.toFixed(2) ?? "—", color: "blue" },
                { label: "kVAcc terminal", value: `${terminalKVAcc.toFixed(2)} kVA`, bold: true, color: "blue" },
                { label: "Icc terminal (A)", value: `${terminalIcc.toFixed(1)} A`, bold: true, color: "amber" },
              ];
            })} />
          </>
        )}

        {loadResults.some(l => l.loadType === "inducción") && (
          <>
            <SectionTitle>Cargas Inductivas (Motores)</SectionTitle>
            <KVTable rows={loadResults.filter(l => l.loadType === "inducción").flatMap(load => [
              { type: "header", label: `Circ. ${load.circuitNumbers?.join("-") ?? load.circuitNumber} — ${load.label}` },
              { label: "Tipo", value: load.circuitLoadType, color: "amber" },
              { label: "Fase", value: load.circuitPhase },
              { label: "Tensión (V)", value: load.voltageKV * 1000 },
              { label: "Carga (VA)", value: load.loadVA },
              { label: "Potencia (HP)", value: load.hp.toFixed(2), color: "green" },
              { label: "X''d", value: load.xdpp?.toFixed(3), color: "amber" },
              { label: "kVAcc motor", value: load.motorKVAcc?.toFixed(2) ?? "—", color: "blue" },
              { label: "kVAcc a barra", value: `${load.kVAccContributionToBus?.toFixed(2) ?? "—"} kVA`, bold: true, color: "green" },
            ])} />
          </>
        )}

        {loadResults.some(l => l.loadType === "resistive") && (
          <>
            <SectionTitle>Cargas Resistivas</SectionTitle>
            <KVTable rows={loadResults.filter(l => l.loadType === "resistive").flatMap(load => {
              const vKV = load.voltageKV ?? busVoltageKV;
              const terminalKVAcc = load.cableKVAcc ? series(upstreamKVAcc, load.cableKVAcc) : upstreamKVAcc;
              const terminalIcc = terminalKVAcc / (Math.sqrt(3) * vKV);
              return [
                { type: "header", label: `Circ. ${load.circuitNumbers?.join("-") ?? load.circuitNumber} — ${load.label}` },
                { label: "Tipo", value: load.circuitLoadType, color: "amber" },
                { label: "Fase", value: load.circuitPhase },
                { label: "Tensión (V)", value: load.voltageKV * 1000 },
                { label: "Carga (VA)", value: load.loadVA },
                { label: "kVAcc conductor", value: load.cableKVAcc?.toFixed(2) ?? "—", color: "amber" },
                { label: "kVAcc terminal", value: `${terminalKVAcc.toFixed(2)} kVA`, bold: true, color: "amber" },
                { label: "Icc terminal (A)", value: `${terminalIcc.toFixed(1)} A`, bold: true, color: "amber" },
              ];
            })} />
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
    tableroResults, activeTab, setActiveTab,
    view, canvasRef,
    parseAndCalculate,
  } = useIccCalc();

  /* ═══ JSON INPUT ═══ */
  if (view === "json") return (
    <div className="app">
      <div className="json-content">
        <Card>

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
  const activeTablero = tableroResults[activeTab] ?? tableroResults[0];
  if (!activeTablero) return null;
  const { data, result } = activeTablero;

  const {
    srcResults, loadResults, busKVAcc, upstreamKVAcc, downstreamKVAcc,
    symmetricShortCircuitCurrent, asymmetricShortCircuitCurrent,
    asymmetricFactor, busVoltageKV, gridKVAcc,
  } = result;

  return (
    <div className="app app--results">
      <div className="tabs-bar">
        {tableroResults.map((t, i) => (
          <button
            key={t.id}
            className={`tab-btn${i === activeTab ? " tab-btn--active" : ""}`}
            onClick={() => setActiveTab(i)}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="res-body">
        {/* Canvas — 70% */}
        <div className="res-main">
          <div className="kpi-strip">
            {[
              { label: "kVAcc Total en Barra", value: formatNumber(busKVAcc, 1) + " kVA", color: "amber" },
              { label: "Icc Simétrica", value: formatNumber(symmetricShortCircuitCurrent, 0) + " A", color: "blue" },
              { label: "Icc Asimétrica", value: formatNumber(asymmetricShortCircuitCurrent, 0) + " A", color: "red" },
              { label: "Contrib. Motores", value: formatNumber(downstreamKVAcc, 1) + " kVA", color: "green" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`kpi-item kpi-item--${color}`}>
                <div className="kpi-item__label">{label}</div>
                <div className={`kpi-item__value kpi-item__value--${color}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="canvas-wrap">
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* Aside — 30% */}
        <aside className="res-aside">
          <ParameterSummary data={data} result={result} />

          <Card>
            <div className="card-section-label">Flujo Aguas Arriba → Barra</div>
            <KVTable rows={[
              { label: "Red / Distribución — kVAcc", value: `${formatNumber(gridKVAcc, 1)} kVA`, bold: true, color: "amber" },
              ...srcResults.flatMap(source => {
                const cable = source.inCable?.enabled ? source.inCable
                  : source.outCable?.enabled ? source.outCable : null;
                const rows = [{ type: "header", label: source.label }];
                if (cable) rows.push(
                  { label: "Calibre", value: cable.gauge },
                  { label: "Material", value: cable.material ?? "Cobre" },
                  { label: "Longitud (m)", value: cable.len },
                  { label: "Z (Ω)", value: (getZ(cable.type, cable.gauge, cable.material, cable.canal) * cable.len / 1000).toFixed(4) },
                );
                rows.push(
                  { label: "kVAcc fuente", value: `${formatNumber(source.equipmentKVAcc, 1)} kVA`, color: "blue" },
                  { label: "kVAcc pasante", value: `${formatNumber(source.kVAccPassingThrough, 1)} kVA`, color: "blue" },
                  { label: "kVAcc a barra", value: `${formatNumber(source.kVAccAtSourceOutput, 1)} kVA`, bold: true, color: "blue" },
                );
                return rows;
              }),
              { type: "total", label: "Total aguas arriba", value: `${formatNumber(upstreamKVAcc, 1)} kVA`, color: "amber" },
            ]} />
          </Card>

          {loadResults.some(l => l.loadType === "inducción") && (
            <Card>
              <div className="card-section-label">Contribución Motores → Barra</div>
              <KVTable rows={[
                ...loadResults.filter(l => l.loadType === "inducción").flatMap(load => {
                  const vKV = load.voltageKV ?? busVoltageKV;
                  const icc = load.kVAccContributionToBus / (Math.sqrt(3) * vKV);
                  return [
                    { type: "header", label: `Circ. ${load.circuitNumbers?.join("-") ?? load.circuitNumber} — ${load.label}` },
                    { label: "Tipo", value: load.circuitLoadType, color: "amber" },
                    { label: "Tensión (V)", value: load.voltageKV * 1000 },
                    { label: "Potencia (HP)", value: load.hp.toFixed(2), color: "green" },
                    { label: "X''d", value: load.xdpp, color: "amber" },
                    { label: "kVAcc motor", value: `${formatNumber(load.motorKVAcc, 1)} kVA`, color: "blue" },
                    { label: "kVAcc cable", value: load.cableKVAcc ? `${formatNumber(load.cableKVAcc, 1)} kVA` : "—", color: "blue" },
                    { label: "kVAcc a barra", value: `${formatNumber(load.kVAccContributionToBus, 2)} kVA`, bold: true, color: "green" },
                    { label: "Icc (A)", value: `${formatNumber(icc, 1)} A`, bold: true, color: "green" },
                  ];
                }),
                { type: "total", label: "Total aguas abajo", value: `${formatNumber(downstreamKVAcc, 1)} kVA`, color: "green" },
              ]} />
            </Card>
          )}

          {loadResults.some(l => l.loadType === "resistive") && (
            <Card>
              <div className="card-section-label">Cargas Resistivas — kVAcc en Terminal</div>
              <KVTable rows={loadResults.filter(l => l.loadType === "resistive").flatMap(load => {
                const vKV = load.voltageKV ?? busVoltageKV;
                const terminalKVAcc = load.cableKVAcc ? series(upstreamKVAcc, load.cableKVAcc) : upstreamKVAcc;
                const terminalIcc = terminalKVAcc / (Math.sqrt(3) * vKV);
                return [
                  { type: "header", label: `Circ. ${load.circuitNumbers?.join("-") ?? load.circuitNumber} — ${load.label}` },
                  { label: "Tipo", value: load.circuitLoadType, color: "amber" },
                  { label: "Tensión (V)", value: load.voltageKV * 1000 },
                  { label: "kVAcc conductor", value: load.cableKVAcc ? `${formatNumber(load.cableKVAcc, 1)} kVA` : "—", color: "amber" },
                  { label: "kVAcc terminal", value: `${formatNumber(terminalKVAcc, 1)} kVA`, bold: true, color: "amber" },
                  { label: "Icc terminal (A)", value: `${formatNumber(terminalIcc, 1)} A`, bold: true, color: "amber" },
                ];
              })} />
            </Card>
          )}

          <div className="summary-grid">
            <div>
              <div className="summary-section__title">Composición kVAcc en barra</div>
              {[
                { label: "Contrib. upstream (fuentes)", value: upstreamKVAcc, color: "blue", unit: "kVA" },
                { label: "Contrib. downstream (motores)", value: downstreamKVAcc, color: "green", unit: "kVA" },
                { label: "kVAcc TOTAL BARRA", value: busKVAcc, color: "amber", unit: "kVA" },
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
                { label: "Icc simétrica", value: symmetricShortCircuitCurrent, color: "blue", unit: "A" },
                { label: `Icc asimétrica ×${asymmetricFactor}`, value: asymmetricShortCircuitCurrent, color: "red", unit: "A" },
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
        </aside>
      </div>
    </div>
  );
}
