import "./App.scss";
import { CABLE_TYPES } from "./utils/cableParams";
import { getZ, getGauges } from "./utils/cableUtils";
import { formatNumber } from "./utils/format";
import { useIccCalc } from "./hooks/useIccCalc";

/* ── PRIMITIVOS DE UI ──────────────────────────────────────── */
function FormInput({ value, onChange, type = "number", min, step, placeholder }) {
  return (
    <input
      type={type} value={value} placeholder={placeholder} min={min} step={step ?? "any"}
      className="inp"
      onChange={e => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
    />
  );
}

function SelectInput({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="sel">
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>{optionLabel}</option>
      ))}
    </select>
  );
}

function FormField({ label, children }) {
  return (
    <div className="fld">
      <span className="fld__label">{label}</span>
      {children}
    </div>
  );
}

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

function CableForm({ cable, onChange }) {
  const isACSR = cable.type === "ACSR";
  const cableTypeOptions = Object.entries(CABLE_TYPES).map(([typeValue, typeLabel]) => [typeValue, typeLabel]);
  const materials    = ["Cobre", "Aluminio"];
  const conduitTypes = ["PVC", "Acero"];
  const selectedMaterial = cable.material ?? "Cobre";
  const selectedConduit  = cable.canal ?? "PVC";
  const gauges = getGauges(cable.type, selectedMaterial, selectedConduit);

  const updateCable = (patch) => {
    const updatedCable = { ...cable, ...patch };
    const availableGauges = getGauges(updatedCable.type, updatedCable.material ?? selectedMaterial, updatedCable.canal ?? selectedConduit);
    if (!availableGauges.includes(String(updatedCable.gauge))) updatedCable.gauge = availableGauges[0] ?? updatedCable.gauge;
    onChange(updatedCable);
  };

  const impedancePerKm = cable.enabled ? getZ(cable.type, cable.gauge, selectedMaterial, selectedConduit) : 0;
  const totalImpedance = cable.enabled ? (impedancePerKm * (cable.len / 1000)) : 0;

  return (
    <div className="cable-frm">
      <label className={`cable-frm__toggle${cable.enabled ? " cable-frm__toggle--open" : ""}`}>
        <input type="checkbox" checked={cable.enabled} onChange={e => updateCable({ enabled: e.target.checked })} />
        Incluir cable alimentador
      </label>
      {cable.enabled && <>
        <div className={`cable-frm__grid${isACSR ? " cable-frm__grid--acsr" : ""}`}>
          <FormField label="Tipo">
            <SelectInput value={cable.type} onChange={v => updateCable({ type: v })} options={cableTypeOptions} />
          </FormField>
          {!isACSR && <FormField label="Material">
            <SelectInput value={selectedMaterial} onChange={v => updateCable({ material: v })} options={materials.map(material => [material, material])} />
          </FormField>}
          {!isACSR && <FormField label="Canalización">
            <SelectInput value={selectedConduit} onChange={v => updateCable({ canal: v })} options={conduitTypes.map(conduit => [conduit, conduit])} />
          </FormField>}
          <FormField label="Calibre">
            <SelectInput value={String(cable.gauge)} onChange={v => updateCable({ gauge: v })}
              options={gauges.map(gaugeValue => [String(gaugeValue), String(gaugeValue)])} />
          </FormField>
          <FormField label="Long (m)">
            <FormInput value={cable.len} onChange={v => updateCable({ len: v })} min={1} step={1} />
          </FormField>
        </div>
        <div className="cable-frm__info">
          Z = {impedancePerKm.toFixed(4)} Ω/km × {cable.len}m = <strong>{totalImpedance.toFixed(4)} Ω</strong>
          &nbsp;·&nbsp; R·fp + XL·sen(acos(fp))
        </div>
      </>}
    </div>
  );
}

/* ── RESUMEN DE PARÁMETROS — sub-componentes ───────────────── */
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

        {firstSource?.inCable?.enabled && (
          <>
            <SectionTitle>Acometida de Media Tensión</SectionTitle>
            <SummaryTable>
              <thead><tr>
                {["Alimentador", "Calibre", "Material", "Longitud (m)", "Z (Ω)", "kVAsc"].map(header =>
                  <th key={header} className="rp-th">{header}</th>)}
              </tr></thead>
              <tbody>
                <tr>
                  <td className="rp-td rp-td--bold">RED {data.grid.kV} kV</td>
                  <td className="rp-td">{firstSource.inCable.gauge}</td>
                  <td className="rp-td">{firstSource.inCable.type === "ACSR" ? "Aluminio" : (firstSource.inCable.material ?? "Cobre")}</td>
                  <td className="rp-td">{firstSource.inCable.len}</td>
                  <td className="rp-td">{(getZ(firstSource.inCable.type, firstSource.inCable.gauge, firstSource.inCable.material, firstSource.inCable.canal) * firstSource.inCable.len / 1000).toFixed(4)}</td>
                  <td className="rp-td rp-td--bold rp-td--blue">{firstSource.inCableKVAcc?.toFixed(2) ?? "—"}</td>
                </tr>
              </tbody>
            </SummaryTable>
          </>
        )}

        <SectionTitle>Transformador</SectionTitle>
        <SummaryTable>
          <thead><tr>
            {["Descrip.", "kVA", "Un (kV)", "Z%", "kVAeq"].map(header =>
              <th key={header} className="rp-th">{header}</th>)}
          </tr></thead>
          <tbody>
            {srcResults.map(source => (
              <tr key={source.id}>
                <td className="rp-td rp-td--bold">{source.label}</td>
                <td className="rp-td">{source.kVA}</td>
                <td className="rp-td">{source.kVsec}</td>
                <td className="rp-td">{source.type === "transformer" ? source.zPct : `X''=${source.xdpp}`}</td>
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
                {["Alimentador", "Calibre", "Material", "Longitud (m)", "Z (Ω)", "kVAsc"].map(header =>
                  <th key={header} className="rp-th">{header}</th>)}
              </tr></thead>
              <tbody>
                <tr>
                  <td className="rp-td rp-td--bold">{firstSource.label} - TGA</td>
                  <td className="rp-td">{firstSource.outCable.gauge}</td>
                  <td className="rp-td">{firstSource.outCable.type === "ACSR" ? "Aluminio" : (firstSource.outCable.material ?? "Cobre")}</td>
                  <td className="rp-td">{firstSource.outCable.len}</td>
                  <td className="rp-td">{(getZ(firstSource.outCable.type, firstSource.outCable.gauge, firstSource.outCable.material, firstSource.outCable.canal) * firstSource.outCable.len / 1000).toFixed(4)}</td>
                  <td className="rp-td rp-td--bold rp-td--blue">{firstSource.outCableKVAcc?.toFixed(2) ?? "—"}</td>
                </tr>
              </tbody>
            </SummaryTable>
          </>
        )}

        {loadResults.some(load => load.cable?.enabled) && (
          <>
            <SectionTitle>Alimentador de la Carga</SectionTitle>
            <SummaryTable>
              <thead><tr>
                {["Alimentador", "Calibre", "Material", "Longitud (m)", "Z (Ω)", "kVAsc"].map(header =>
                  <th key={header} className="rp-th">{header}</th>)}
              </tr></thead>
              <tbody>
                {loadResults.filter(load => load.cable?.enabled).map(load => (
                  <tr key={load.id}>
                    <td className="rp-td rp-td--bold">TGA - {load.label}</td>
                    <td className="rp-td">{load.cable.gauge}</td>
                    <td className="rp-td">{load.cable.type === "ACSR" ? "Aluminio" : (load.cable.material ?? "Cobre")}</td>
                    <td className="rp-td">{load.cable.len}</td>
                    <td className="rp-td">{(getZ(load.cable.type, load.cable.gauge, load.cable.material, load.cable.canal) * load.cable.len / 1000).toFixed(4)}</td>
                    <td className="rp-td rp-td--bold rp-td--blue">{load.cableKVAcc?.toFixed(2) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </SummaryTable>
          </>
        )}

        <SectionTitle>Cargas Inductivas</SectionTitle>
        <SummaryTable>
          <thead><tr>
            {["ID", "Descrip.", "HP", "X''", "kVAsc"].map(header =>
              <th key={header} className="rp-th">{header}</th>)}
          </tr></thead>
          <tbody>
            {loadResults.map((load, loadIndex) => (
              <tr key={load.id} className={loadIndex % 2 ? "rp-tr--odd" : ""}>
                <td className="rp-td">{load.id}</td>
                <td className="rp-td rp-td--bold">{load.label}</td>
                <td className="rp-td">{load.hp}</td>
                <td className="rp-td rp-td--amber">{load.xdpp.toFixed(3)}</td>
                <td className="rp-td rp-td--bold rp-td--blue">{load.motorKVAcc.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </SummaryTable>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   APP
══════════════════════════════════════════════════════════════ */
export default function App() {
  const {
    data, view, setView, result, canvasRef,
    updateField, addSource, removeSource, addLoad, removeLoad, calculate,
  } = useIccCalc();

  /* ═══ FORM ═══ */
  if (view === "form") return (
    <div className="app">
      <div className="topbar">
        <div className="topbar__title">⚡ Cálculo de Cortocircuito</div>
        <div className="topbar__sub">Método de los kVA Equivalentes</div>
      </div>

      <div className="form-content">

        {/* STEP 1 – GRID */}
        <Card>
          <SectionHeader number="1" title="Fuente de Red" sub="Datos de la corriente de falla disponible desde la compañía distribuidora" />
          <div className="grid-params">
            <FormField label="Tensión de red (kV)"><FormInput value={data.grid.kV}    onChange={v => updateField("grid.kV",    v)} min={0.1} step={0.1} /></FormField>
            <FormField label="Icc (kA)">            <FormInput value={data.grid.Icc}   onChange={v => updateField("grid.Icc",   v)} min={0}   step={0.1} placeholder="0" /></FormField>
            <FormField label="kVAcc directo (kVA)"> <FormInput value={data.grid.kVAcc} onChange={v => updateField("grid.kVAcc", v)} min={0}   step={100} /></FormField>
          </div>
          <div className="grid-tip">
            💡 Icc en <strong>kA</strong>. Internamente: √3 × kV × Icc(kA)×1000 A = kVA.
            Ej: √3 × 13.2 kV × 10,000 A = 228,624 kVA. Si se ingresa kVAcc directamente, tiene prioridad.
          </div>
        </Card>

        {/* STEP 2 – SOURCES */}
        <Card>
          <div className="section-header">
            <SectionHeader number="2" title="Fuentes de Alimentación" sub="Transformadores y/o generadores que alimentan la barra principal de BT" />
            <button onClick={addSource} className="btn-add">+ Fuente</button>
          </div>
          <div className="sources-list">
            {data.sources.map((source, sourceIndex) => (
              <div key={source.id} className="src-card">
                <div className="src-card__header">
                  <div className="src-card__header-left">
                    <span className={`src-badge src-badge--${source.type === "transformer" ? "trafo" : "gen"}`}>
                      {source.type === "transformer" ? "TRANSFORMADOR" : "GENERADOR"}
                    </span>
                    <input
                      value={source.label}
                      onChange={e => updateField(`sources.${sourceIndex}.label`, e.target.value)}
                      className="label-input"
                    />
                  </div>
                  <div className="src-card__header-right">
                    {["transformer", "generator"].map(sourceType => (
                      <label key={sourceType} className="radio-label">
                        <input type="radio" name={`tp-${source.id}`} value={sourceType} checked={source.type === sourceType}
                          onChange={() => updateField(`sources.${sourceIndex}.type`, sourceType)} />
                        {sourceType === "transformer" ? "Trafo" : "Generador"}
                      </label>
                    ))}
                    {data.sources.length > 1 && (
                      <button onClick={() => removeSource(source.id)} className="btn-remove">✕</button>
                    )}
                  </div>
                </div>
                <div className="src-params-grid">
                  <FormField label="Potencia (kVA)"><FormInput value={source.kVA} onChange={v => updateField(`sources.${sourceIndex}.kVA`, v)} min={1} step={25} /></FormField>
                  <FormField label={source.type === "transformer" ? "%Z impedancia" : "X''d (p.u.)"}>
                    <FormInput value={source.type === "transformer" ? source.zPct : source.xdpp}
                      onChange={v => updateField(`sources.${sourceIndex}.${source.type === "transformer" ? "zPct" : "xdpp"}`, v)} min={0.01} step={0.01} />
                  </FormField>
                  <FormField label="Tensión primaria (kV)">  <FormInput value={source.kVpri} onChange={v => updateField(`sources.${sourceIndex}.kVpri`, v)} min={0.1}   step={0.1}   /></FormField>
                  <FormField label="Tensión secundaria (kV)"><FormInput value={source.kVsec} onChange={v => updateField(`sources.${sourceIndex}.kVsec`, v)} min={0.001} step={0.001} /></FormField>
                </div>
                <div className="src-cables-grid">
                  <div>
                    <div className="cable-section-label">Cable de entrada (MT → fuente)</div>
                    <CableForm cable={source.inCable}  onChange={c => updateField(`sources.${sourceIndex}.inCable`,  c)} />
                  </div>
                  <div>
                    <div className="cable-section-label">Cable de salida (fuente → barra BT)</div>
                    <CableForm cable={source.outCable} onChange={c => updateField(`sources.${sourceIndex}.outCable`, c)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* STEP 3 – LOADS */}
        <Card>
          <div className="section-header">
            <SectionHeader number="3" title="Cargas Inductivas (Motores)"
              sub="Motores de inducción conectados a la barra. Contribuyen aguas abajo al cortocircuito." />
            <button onClick={addLoad} className="btn-add btn-add--green">+ Motor</button>
          </div>
          <div className="loads-grid">
            {data.loads.map((load, loadIndex) => (
              <div key={load.id} className="load-card">
                <div className="load-card__header">
                  <div className="load-card__header-left">
                    <div className="load-num">{loadIndex + 1}</div>
                    <input
                      value={load.label}
                      onChange={e => updateField(`loads.${loadIndex}.label`, e.target.value)}
                      className="load-label-input"
                    />
                  </div>
                  {data.loads.length > 1 && (
                    <button onClick={() => removeLoad(load.id)} className="btn-remove-x">✕</button>
                  )}
                </div>
                <div className="load-params-grid">
                  <FormField label="Potencia (HP)"><FormInput value={load.hp} onChange={v => updateField(`loads.${loadIndex}.hp`, v)} min={0.5} step={0.5} /></FormField>
                  <div className="xdpp-display">
                    <div className="xdpp-display__label">X''d automático</div>
                    <div className="xdpp-display__value">{load.hp >= 50 ? "0.17" : "0.20"}</div>
                    <div className="xdpp-display__hint">{load.hp >= 50 ? "Motor ≥ 50 hp" : "Motor < 50 hp"}</div>
                  </div>
                </div>
                <CableForm cable={load.cable} onChange={c => updateField(`loads.${loadIndex}.cable`, c)} />
              </div>
            ))}
          </div>
        </Card>

        {/* CALCULATE BTN */}
        <button onClick={calculate} className="btn-calc">
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
          <div className="res-topbar__sub">Barra {busVoltageKV} kV — Método kVA Equivalentes</div>
        </div>
        <button onClick={() => setView("form")} className="btn-back">← Editar</button>
      </div>

      {/* KPI strip */}
      <div className="kpi-strip">
        {[
          { label: "kVAcc Total en Barra", value: formatNumber(busKVAcc, 1) + " kVA",                         color: "amber", sub: "Σ upstream + downstream" },
          { label: "Icc Simétrica",        value: formatNumber(symmetricShortCircuitCurrent, 0) + " A",        color: "blue",  sub: `${busVoltageKV} kV` },
          { label: "Icc Asimétrica",       value: formatNumber(asymmetricShortCircuitCurrent, 0) + " A",       color: "red",   sub: `Factor ×${asymmetricFactor}` },
          { label: "Contrib. Motores",     value: formatNumber(downstreamKVAcc, 1) + " kVA",                   color: "green", sub: "Aguas abajo" },
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
                {["Fuente", "kVAcc fuente", "kVAcc pasante", "kVAcc a barra"].map(header => <th key={header} className="res-th">{header}</th>)}
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

        <Card>
          <div className="card-section-label">Contribución Motores → Barra</div>
          <div className="table-overflow">
            <table className="res-table">
              <thead><tr>
                {["Motor", "HP", "X''d", "kVAcc motor", "kVAcc cable", "kVAcc a barra", "Icc (A)"].map(header => <th key={header} className="res-th">{header}</th>)}
              </tr></thead>
              <tbody>
                {loadResults.map((load, loadIndex) => (
                  <tr key={load.id} className={loadIndex % 2 ? "res-tr--striped" : ""}>
                    <td className="res-td res-td--dark res-td--bold">{load.label}</td>
                    <td className="res-td">{load.hp}</td>
                    <td className="res-td res-td--amber">{load.xdpp}</td>
                    <td className="res-td res-td--mono">{formatNumber(load.motorKVAcc, 1)}</td>
                    <td className={`res-td res-td--mono${load.cableKVAcc ? "" : " res-td--light"}`}>
                      {load.cableKVAcc ? formatNumber(load.cableKVAcc, 1) : "—"}
                    </td>
                    <td className="res-td res-td--green res-td--bold res-td--mono">{formatNumber(load.kVAccContributionToBus, 2)}</td>
                    <td className="res-td res-td--mono">{formatNumber(load.kVAccContributionToBus / (Math.sqrt(3) * busVoltageKV), 1)}</td>
                  </tr>
                ))}
                <tr className="res-tr--total-green">
                  <td className="res-td res-td--green res-td--bold" colSpan={5}>Total aguas abajo</td>
                  <td className="res-td res-td--green res-td--bold res-td--mono res-td--lg">{formatNumber(downstreamKVAcc, 1)} kVA</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

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
            <div className="summary-section__title">Corrientes — Barra {busVoltageKV} kV</div>
            {[
              { label: "Icc simétrica",                          value: symmetricShortCircuitCurrent,  color: "blue", unit: "A" },
              { label: `Icc asimétrica ×${asymmetricFactor}`,    value: asymmetricShortCircuitCurrent, color: "red",  unit: "A" },
            ].map(({ label, value, color, unit }) => (
              <div key={label} className="summary-row">
                <span className="summary-row__label">{label}</span>
                <span className={`summary-row__value summary-row__value--${color}`}>{formatNumber(value, 1)} {unit}</span>
              </div>
            ))}
            <div className="formula-box">
              Fórmula: Icc = kVAcc / (√3 × {busVoltageKV} kV)<br />
              Factor asimétrico: {asymmetricFactor} {busVoltageKV < 0.6 ? "(sistema ≤600V)" : "(sistema >600V)"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
