import { useState } from "react";
import "./App.scss";
import { getZ, series } from "./utils/cableUtils";
import { formatNumber } from "./utils/format";
import { useIccCalc } from "./hooks/useIccCalc";

/* ── UI PRIMITIVOS ──────────────────────────────────────── */
function Card({ children }) {
  return <div className="card">{children}</div>;
}

/* ── DRAWER NO MODAL DEL RESUMEN ─────────────────────────── */
// Panel lateral deslizante con un "handle" persistente para mostrar/ocultar.
// No es modal: no hay backdrop ni bloqueo del canvas mientras está abierto.
function SummaryDrawer({ open, onToggle, children }) {
  return (
    <aside className={`res-aside${open ? " res-aside--open" : ""}`}>
      <button
        type="button"
        className="res-aside__handle"
        onClick={onToggle}
        aria-expanded={open}
        title={open ? "Ocultar resumen" : "Mostrar resumen"}
      >
        <span className="res-aside__handle-arrow">{open ? "›" : "‹"}</span>
        <span className="res-aside__handle-label">Resumen</span>
      </button>
      <div className="res-aside__content">{children}</div>
    </aside>
  );
}



/* ── KPIs DE LA BARRA PRINCIPAL ──────────────────────────── */
// Tres indicadores destacados (kVAcc, Icc simétrica, Icc asimétrica)
// referidos únicamente a la barra principal.
function BusKpis({ busKVAcc, symmetricIcc, asymmetricFactor }) {
  return (
    <div className="kpis">
      <div className="kpi kpi--amber">
        <div className="kpi__value">{formatNumber(busKVAcc, 2)}</div>
        <div className="kpi__label">kVAcc en barra</div>
      </div>
      <div className="kpi kpi--blue">
        <div className="kpi__value">{formatNumber(symmetricIcc / 1000, 2)}</div>
        <div className="kpi__label">Icc simétrica [kA]</div>
      </div>
      <div className="kpi kpi--red">
        <div className="kpi__value">{formatNumber(symmetricIcc * asymmetricFactor / 1000, 2)}</div>
        <div className="kpi__label">Icc asimétrica ×{asymmetricFactor} [kA]</div>
      </div>
    </div>
  );
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
// eslint-disable-next-line no-unused-vars
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
              ...(firstSource.inCable.parallel > 1 ? [{ label: "Cond./fase", value: firstSource.inCable.parallel }] : []),
              { label: "Z (Ω)", value: (getZ(firstSource.inCable.type, firstSource.inCable.gauge, firstSource.inCable.material, firstSource.inCable.canal) * firstSource.inCable.len / 1000 / (firstSource.inCable.parallel ?? 1)).toFixed(4) },
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
              ...(firstSource.outCable.parallel > 1 ? [{ label: "Cond./fase", value: firstSource.outCable.parallel }] : []),
              { label: "Z (Ω)", value: (getZ(firstSource.outCable.type, firstSource.outCable.gauge, firstSource.outCable.material, firstSource.outCable.canal) * firstSource.outCable.len / 1000 / (firstSource.outCable.parallel ?? 1)).toFixed(4) },
              { label: "kVAcc cable", value: firstSource.outCableKVAcc?.toFixed(2) ?? "—", color: "blue" },
              { label: "kVAcc a barra", value: `${firstSource.kVAccAtSourceOutput.toFixed(2)} kVA`, bold: true, color: "blue" },
              { label: "Icc en barra (A)", value: `${(firstSource.kVAccAtSourceOutput / (Math.sqrt(3) * firstSource.kVsec)).toFixed(2)} A`, bold: true, color: "amber" },
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
                ...(load.cable.parallel > 1 ? [{ label: "Cond./fase", value: load.cable.parallel }] : []),
                { label: "Z (Ω)", value: (getZ(load.cable.type, load.cable.gauge, load.cable.material, load.cable.canal) * load.cable.len / 1000 / (load.cable.parallel ?? 1)).toFixed(4) },
                { label: "kVAcc cable", value: load.cableKVAcc?.toFixed(2) ?? "—", color: "blue" },
                { label: "kVAcc terminal", value: `${terminalKVAcc.toFixed(2)} kVA`, bold: true, color: "blue" },
                { label: "Icc terminal (A)", value: `${terminalIcc.toFixed(2)} A`, bold: true, color: "amber" },
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
                { label: "Icc terminal (A)", value: `${terminalIcc.toFixed(2)} A`, bold: true, color: "amber" },
              ];
            })} />
          </>
        )}

      </div>
    </div>
  );
}

/* ── RESUMEN UNIFICADO: BARRA PRINCIPAL ──────────────────── */
function UnifiedMainSummary({ data, result }) {
  const { gridKVAcc, srcResults, mainBusKVAcc, mainBusUpstreamKVAcc, mainBusDownstreamKVAcc, mainBusIcc, mainAsymmetricFactor } = result;
  const tr = srcResults[0];

  return (
    <Card>
      <div className="card-section-label">Barra Principal</div>

      <KVTable rows={[
        { type: "header", label: "Operador de Red" },
        { label: "Nivel de Tensión [kV]", value: data.grid.kV, bold: true, color: "amber" },
        { label: "Corriente Cortocircuito 3Ø [kA]", value: data.grid.Icc },
        { label: "kVAcc red", value: `${gridKVAcc.toFixed(2)} kVA`, bold: true, color: "blue" },

        ...(tr.inCable?.enabled && tr.inCableKVAcc != null ? [
          { type: "header", label: "Acometida de Media Tensión" },
          { label: "Calibre", value: tr.inCable.gauge },
          { label: "Material", value: tr.inCable.material ?? "Cobre" },
          { label: "Longitud (m)", value: tr.inCable.len },
          ...(tr.inCable.parallel > 1 ? [{ label: "Cond./fase", value: tr.inCable.parallel }] : []),
          { label: "kVAcc cable", value: tr.inCableKVAcc.toFixed(2), color: "blue" },
          { label: "kVAcc entrada eq.", value: `${tr.kVAccAtSourceInput.toFixed(2)} kVA`, bold: true, color: "blue" },
        ] : []),

        { type: "header", label: "Transformador" },
        { label: "kVA nominal", value: tr.kVA },
        { label: "Un (kV)", value: tr.kVsec },
        { label: "Impedancia Z%", value: `${tr.zPct}%` },
        { label: "kVAcc equipo", value: tr.equipmentKVAcc.toFixed(2), color: "blue" },
        { label: "kVAcc pasante", value: `${tr.kVAccPassingThrough.toFixed(2)} kVA`, bold: true, color: "blue" },

        ...(tr.outCable?.enabled && tr.outCableKVAcc != null ? [
          { type: "header", label: "Alimentador Principal" },
          { label: "Calibre", value: tr.outCable.gauge },
          { label: "Material", value: tr.outCable.material ?? "Cobre" },
          { label: "Longitud (m)", value: tr.outCable.len },
          ...(tr.outCable.parallel > 1 ? [{ label: "Cond./fase", value: tr.outCable.parallel }] : []),
          { label: "kVAcc alimentador", value: tr.outCableKVAcc.toFixed(2), color: "blue" },
        ] : []),

        { type: "header", label: "Barra Principal" },
        { label: "kVAcc aguas arriba", value: `${formatNumber(mainBusUpstreamKVAcc, 2)} kVA`, color: "blue" },
        { label: "kVAcc motores", value: `${formatNumber(mainBusDownstreamKVAcc, 2)} kVA`, color: "green" },
        { type: "total", label: "kVAcc en barra", value: `${formatNumber(mainBusKVAcc, 2)} kVA`, color: "amber" },
        { type: "total", label: "Icc simétrica", value: `${formatNumber(mainBusIcc / 1000, 2)} kA`, color: "blue" },
        { type: "total", label: `Icc asimétrica ×${mainAsymmetricFactor}`, value: `${formatNumber(mainBusIcc * mainAsymmetricFactor / 1000, 2)} kA`, color: "red" },
      ]} />
    </Card>
  );
}

/* ── RESUMEN UNIFICADO: SECCIÓN POR TABLERO ──────────────── */
function TableroSummary({ tablero }) {
  const {
    name, feeder, feederKVAcc, upstreamAtBus, loadResults,
    busKVAcc, downstreamKVAcc, busVoltageKV,
    symmetricShortCircuitCurrent, asymmetricShortCircuitCurrent, asymmetricFactor,
  } = tablero;

  return (
    <Card>
      <div className="card-section-label">{name}</div>

      <KVTable rows={[
        ...(feeder?.enabled && feederKVAcc != null ? [
          { type: "header", label: "Alimentador del Tablero" },
          { label: "Calibre", value: feeder.gauge },
          { label: "Material", value: feeder.material ?? "Cobre" },
          { label: "Longitud (m)", value: feeder.len },
          ...(feeder.parallel > 1 ? [{ label: "Cond./fase", value: feeder.parallel }] : []),
          { label: "kVAcc alimentador", value: feederKVAcc.toFixed(2), color: "blue" },
        ] : []),

        { type: "header", label: "Barra del Tablero" },
        { label: "kVAcc aguas arriba", value: `${formatNumber(upstreamAtBus, 2)} kVA`, color: "blue" },
        { label: "kVAcc motores", value: `${formatNumber(downstreamKVAcc, 2)} kVA`, color: "green" },
        { type: "total", label: "kVAcc en barra", value: `${formatNumber(busKVAcc, 2)} kVA`, color: "amber" },
        { type: "total", label: "Icc simétrica", value: `${formatNumber(symmetricShortCircuitCurrent / 1000, 2)} kA`, color: "blue" },
        { type: "total", label: `Icc asimétrica ×${asymmetricFactor}`, value: `${formatNumber(asymmetricShortCircuitCurrent / 1000, 2)} kA`, color: "red" },

        ...loadResults.flatMap(load => {
          const vKV = load.voltageKV ?? busVoltageKV;
          const terminalUpstream = load.cableKVAcc ? series(upstreamAtBus, load.cableKVAcc) : upstreamAtBus;
          const terminalIcc = (terminalUpstream + (load.motorKVAcc ?? 0)) / (Math.sqrt(3) * vKV);
          return [
            { type: "header", label: `Circ. ${load.circuitNumbers?.join("-") ?? load.circuitNumber} — ${load.label}` },
            { label: "Tipo", value: load.circuitLoadType, color: "amber" },
            { label: "Calibre", value: load.cable.gauge },
            { label: "Longitud (m)", value: load.cable.len },
            { label: "kVAcc Ramal", value: load.cableKVAcc ? `${formatNumber(load.cableKVAcc, 2)} kVA` : "—", color: "blue" },
            ...(load.loadType === "inducción" ? [
              { label: "Potencia (HP)", value: load.hp.toFixed(2), color: "green" },
              { label: "kVAcc motor", value: load.motorKVAcc.toFixed(2), color: "green" },
            ] : []),
            { label: "Icc terminal (kA)", value: `${formatNumber(terminalIcc / 1000, 2)} kA`, bold: true, color: "amber" },
            { label: `Icc asimétrica ×${asymmetricFactor} (kA)`, value: `${formatNumber(terminalIcc * asymmetricFactor / 1000, 2)} kA`, bold: true, color: "red" },
          ];
        }),
      ]} />
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════════
   APP
══════════════════════════════════════════════════════════════ */
export default function App() {
  const {
    jsonText, setJsonText, jsonError,
    mode, unified, tableroResults, activeTab,
    view, canvasRef,
    parseAndCalculate,
  } = useIccCalc();

  const [resumenOpen, setResumenOpen] = useState(true);
  const toggleResumen = () => setResumenOpen(o => !o);

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

  /* ═══ RESULTS — UNIFICADO (varios tableros) ═══ */
  if (mode === "unified" && unified) {
    const { data, result } = unified;

    return (
      <div className="app app--results">
        <div className="res-body">
          <div className="res-main">
            <div className="canvas-wrap">
              <canvas ref={canvasRef} />
            </div>
          </div>

          <SummaryDrawer open={resumenOpen} onToggle={toggleResumen}>
            <BusKpis
              busKVAcc={result.mainBusKVAcc}
              symmetricIcc={result.mainBusIcc}
              asymmetricFactor={result.mainAsymmetricFactor}
            />
            <UnifiedMainSummary data={data} result={result} />
            {result.tableros.map(tablero => (
              <TableroSummary key={tablero.id} tablero={tablero} />
            ))}
          </SummaryDrawer>
        </div>
      </div>
    );
  }

  /* ═══ RESULTS — INDIVIDUAL (un tablero) ═══ */
  const activeTablero = tableroResults[activeTab] ?? tableroResults[0];
  if (!activeTablero) return null;
  const { data, result } = activeTablero;

  const {
    srcResults, loadResults, busKVAcc, upstreamKVAcc, downstreamKVAcc,
    symmetricShortCircuitCurrent, asymmetricShortCircuitCurrent,
    asymmetricFactor, busVoltageKV, gridKVAcc,
  } = result;
  const firstSource = srcResults[0];

  return (
    <div className="app app--results">
      <div className="res-body">
        {/* Canvas — 70% */}
        <div className="res-main">
          <div className="canvas-wrap">
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* Aside — drawer no modal */}
        <SummaryDrawer open={resumenOpen} onToggle={toggleResumen}>
          <BusKpis
            busKVAcc={busKVAcc}
            symmetricIcc={symmetricShortCircuitCurrent}
            asymmetricFactor={asymmetricFactor}
          />
          <Card>
            <div className="card-section-label">Resumen de Cortocircuito</div>
            <KVTable rows={[
              { type: "header", label: "Operador de Red" },
              { label: "Nivel de Tensión [kV]", value: data.grid.kV, bold: true, color: "amber" },
              { label: "Corriente Cortocircuito 3Ø [kA]", value: data.grid.Icc },
              { label: "kVAcc red", value: `${gridKVAcc.toFixed(2)} kVA`, bold: true, color: "blue" },

              ...(firstSource?.inCable?.enabled && firstSource.inCableKVAcc != null ? [
                { type: "header", label: "Acometida de Media Tensión" },
                { label: "Calibre", value: firstSource.inCable.gauge },
                { label: "Material", value: firstSource.inCable.material ?? "Cobre" },
                { label: "Longitud (m)", value: firstSource.inCable.len },
                ...(firstSource.inCable.parallel > 1 ? [{ label: "Cond./fase", value: firstSource.inCable.parallel }] : []),
                { label: "kVAcc cable", value: firstSource.inCableKVAcc.toFixed(2), color: "blue" },
                { label: "kVAcc entrada eq.", value: `${firstSource.kVAccAtSourceInput.toFixed(2)} kVA`, bold: true, color: "blue" },
              ] : []),

              ...srcResults.flatMap(source => [
                { type: "header", label: source.type === "transformer" ? "Transformador" : source.label },
                { label: "kVA nominal", value: source.kVA },
                { label: "Un (kV)", value: source.kVsec },
                {
                  label: source.type === "transformer" ? "Impedancia Z%" : "X''d",
                  value: source.type === "transformer" ? `${source.zPct}%` : source.xdpp,
                },
                { label: "kVAcc equipo", value: source.equipmentKVAcc.toFixed(2), color: "blue" },
                { label: "kVAcc pasante", value: `${source.kVAccPassingThrough.toFixed(2)} kVA`, bold: true, color: "blue" },
              ]),

              ...(firstSource?.outCable?.enabled && firstSource.outCableKVAcc != null ? [
                { type: "header", label: "Alimentador Principal" },
                { label: "Calibre", value: firstSource.outCable.gauge },
                { label: "Material", value: firstSource.outCable.material ?? "Cobre" },
                { label: "Longitud (m)", value: firstSource.outCable.len },
                ...(firstSource.outCable.parallel > 1 ? [{ label: "Cond./fase", value: firstSource.outCable.parallel }] : []),
                { label: "kVAcc alimentador", value: firstSource.outCableKVAcc.toFixed(2), color: "blue" },
              ] : []),

              { type: "header", label: "Barra" },
              { label: "kVAcc aguas arriba", value: `${formatNumber(upstreamKVAcc, 2)} kVA`, color: "blue" },
              { label: "kVAcc motores", value: `${formatNumber(downstreamKVAcc, 2)} kVA`, color: "green" },
              { type: "total", label: "kVAcc en barra", value: `${formatNumber(busKVAcc, 2)} kVA`, color: "amber" },
              { type: "total", label: "Icc simétrica", value: `${formatNumber(symmetricShortCircuitCurrent / 1000, 2)} kA`, color: "blue" },
              { type: "total", label: `Icc asimétrica ×${asymmetricFactor}`, value: `${formatNumber(asymmetricShortCircuitCurrent / 1000, 2)} kA`, color: "red" },

              ...loadResults.flatMap(load => {
                const vKV = load.voltageKV ?? busVoltageKV;
                const terminalUpstream = load.cableKVAcc ? series(upstreamKVAcc, load.cableKVAcc) : upstreamKVAcc;
                const terminalIcc = (terminalUpstream + (load.motorKVAcc ?? 0)) / (Math.sqrt(3) * vKV);
                return [
                  { type: "header", label: `Circ. ${load.circuitNumbers?.join("-") ?? load.circuitNumber} — ${load.label}` },
                  { label: "Tipo", value: load.circuitLoadType, color: "amber" },
                  { label: "Calibre", value: load.cable.gauge },
                  { label: "Longitud (m)", value: load.cable.len },
                  { label: "kVAcc Ramal", value: load.cableKVAcc ? `${formatNumber(load.cableKVAcc, 2)} kVA` : "—", color: "blue" },
                  ...(load.loadType === "inducción" ? [
                    { label: "Potencia (HP)", value: load.hp.toFixed(2), color: "green" },
                    { label: "kVAcc motor", value: load.motorKVAcc.toFixed(2), color: "green" },
                  ] : []),
                  { label: "Icc terminal (kA)", value: `${formatNumber(terminalIcc / 1000, 2)} kA`, bold: true, color: "amber" },
                  { label: `Icc asimétrica ×${asymmetricFactor} (kA)`, value: `${formatNumber(terminalIcc * asymmetricFactor / 1000, 2)} kA`, bold: true, color: "red" },
                ];
              }),
            ]} />
          </Card>
        </SummaryDrawer>
      </div>
    </div>
  );
}
