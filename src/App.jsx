import "./App.scss";
import { CABLE_TYPES } from "./utils/cableParams";
import { getZ, getGauges } from "./utils/cableUtils";
import { f } from "./utils/format";
import { useIccCalc } from "./hooks/useIccCalc";

/* ── PRIMITIVOS DE UI ──────────────────────────────────────── */
function Inp({ value, onChange, type = "number", min, step, placeholder }) {
  return (
    <input
      type={type} value={value} placeholder={placeholder} min={min} step={step ?? "any"}
      className="inp"
      onChange={e => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
    />
  );
}

function Sel({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="sel">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function Fld({ label, children }) {
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

function SecHead({ n, title, sub }) {
  return (
    <div className="sec-head">
      <div className="sec-head__row">
        <div className="sec-head__num">{n}</div>
        <h3 className="sec-head__title">{title}</h3>
      </div>
      {sub && <p className="sec-head__sub">{sub}</p>}
    </div>
  );
}

function CableFrm({ cable, onChange }) {
  const isACSR = cable.type === "ACSR";
  const types = Object.entries(CABLE_TYPES).map(([v, l]) => [v, l]);
  const mats = ["Cobre", "Aluminio"];
  const canals = ["PVC", "Acero"];
  const mat = cable.material ?? "Cobre";
  const canal = cable.canal ?? "PVC";
  const gauges = getGauges(cable.type, mat, canal);

  const upd = (patch) => {
    const next = { ...cable, ...patch };
    const gs = getGauges(next.type, next.material ?? mat, next.canal ?? canal);
    if (!gs.includes(String(next.gauge))) next.gauge = gs[0] ?? next.gauge;
    onChange(next);
  };

  const zKm = cable.enabled ? getZ(cable.type, cable.gauge, mat, canal) : 0;
  const zTot = cable.enabled ? (zKm * (cable.len / 1000)) : 0;

  return (
    <div className="cable-frm">
      <label className={`cable-frm__toggle${cable.enabled ? " cable-frm__toggle--open" : ""}`}>
        <input type="checkbox" checked={cable.enabled} onChange={e => upd({ enabled: e.target.checked })} />
        Incluir cable alimentador
      </label>
      {cable.enabled && <>
        <div className={`cable-frm__grid${isACSR ? " cable-frm__grid--acsr" : ""}`}>
          <Fld label="Tipo">
            <Sel value={cable.type} onChange={v => upd({ type: v })} options={types} />
          </Fld>
          {!isACSR && <Fld label="Material">
            <Sel value={mat} onChange={v => upd({ material: v })} options={mats.map(m => [m, m])} />
          </Fld>}
          {!isACSR && <Fld label="Canalización">
            <Sel value={canal} onChange={v => upd({ canal: v })} options={canals.map(c => [c, c])} />
          </Fld>}
          <Fld label="Calibre">
            <Sel value={String(cable.gauge)} onChange={v => upd({ gauge: v })}
              options={gauges.map(g => [String(g), String(g)])} />
          </Fld>
          <Fld label="Long (m)">
            <Inp value={cable.len} onChange={v => upd({ len: v })} min={1} step={1} />
          </Fld>
        </div>
        <div className="cable-frm__info">
          Z = {zKm.toFixed(4)} Ω/km × {cable.len}m = <strong>{zTot.toFixed(4)} Ω</strong>
          &nbsp;·&nbsp; R·fp + XL·sen(acos(fp))
        </div>
      </>}
    </div>
  );
}

/* ── RESUMEN DE PARÁMETROS — sub-componentes ───────────────── */
function SecTitle({ children }) {
  return <div className="sec-title">{children}</div>;
}

function ResumenTable({ children }) {
  return (
    <div className="resumen-table">
      <table>{children}</table>
    </div>
  );
}

function ResumenParametros({ data, result }) {
  const { gridKVAcc, srcResults, loadResults } = result;
  const src = srcResults[0];

  return (
    <div className="rp">
      <div className="rp__header">
        <div className="rp__title">Resumen de los Parámetros</div>
      </div>

      <div className="rp__body">

        <SecTitle>Parámetros Operador de Red</SecTitle>
        <ResumenTable>
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
        </ResumenTable>

        {src?.inCable?.enabled && (
          <>
            <SecTitle>Acometida de Media Tensión</SecTitle>
            <ResumenTable>
              <thead><tr>
                {["Alimentador", "Calibre", "Material", "Longitud (m)", "Z (Ω)", "kVAsc"].map(h =>
                  <th key={h} className="rp-th">{h}</th>)}
              </tr></thead>
              <tbody>
                <tr>
                  <td className="rp-td rp-td--bold">RED {data.grid.kV} kV</td>
                  <td className="rp-td">{src.inCable.gauge}</td>
                  <td className="rp-td">{src.inCable.type === "ACSR" ? "Aluminio" : (src.inCable.material ?? "Cobre")}</td>
                  <td className="rp-td">{src.inCable.len}</td>
                  <td className="rp-td">{(getZ(src.inCable.type, src.inCable.gauge, src.inCable.material, src.inCable.canal) * src.inCable.len / 1000).toFixed(4)}</td>
                  <td className="rp-td rp-td--bold rp-td--blue">{src.inCableKVAcc?.toFixed(2) ?? "—"}</td>
                </tr>
              </tbody>
            </ResumenTable>
          </>
        )}

        <SecTitle>Transformador</SecTitle>
        <ResumenTable>
          <thead><tr>
            {["Descrip.", "kVA", "Un (kV)", "Z%", "kVAeq"].map(h =>
              <th key={h} className="rp-th">{h}</th>)}
          </tr></thead>
          <tbody>
            {srcResults.map(s => (
              <tr key={s.id}>
                <td className="rp-td rp-td--bold">{s.label}</td>
                <td className="rp-td">{s.kVA}</td>
                <td className="rp-td">{s.kVsec}</td>
                <td className="rp-td">{s.type === "transformer" ? s.zPct : `X''=${s.xdpp}`}</td>
                <td className="rp-td rp-td--bold rp-td--blue">{s.srcKVAcc.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </ResumenTable>

        {src?.outCable?.enabled && (
          <>
            <SecTitle>Acometida de Baja Tensión</SecTitle>
            <ResumenTable>
              <thead><tr>
                {["Alimentador", "Calibre", "Material", "Longitud (m)", "Z (Ω)", "kVAsc"].map(h =>
                  <th key={h} className="rp-th">{h}</th>)}
              </tr></thead>
              <tbody>
                <tr>
                  <td className="rp-td rp-td--bold">{src.label} - TGA</td>
                  <td className="rp-td">{src.outCable.gauge}</td>
                  <td className="rp-td">{src.outCable.type === "ACSR" ? "Aluminio" : (src.outCable.material ?? "Cobre")}</td>
                  <td className="rp-td">{src.outCable.len}</td>
                  <td className="rp-td">{(getZ(src.outCable.type, src.outCable.gauge, src.outCable.material, src.outCable.canal) * src.outCable.len / 1000).toFixed(4)}</td>
                  <td className="rp-td rp-td--bold rp-td--blue">{src.outCableKVAcc?.toFixed(2) ?? "—"}</td>
                </tr>
              </tbody>
            </ResumenTable>
          </>
        )}

        {loadResults.some(ld => ld.cable?.enabled) && (
          <>
            <SecTitle>Alimentador de la Carga</SecTitle>
            <ResumenTable>
              <thead><tr>
                {["Alimentador", "Calibre", "Material", "Longitud (m)", "Z (Ω)", "kVAsc"].map(h =>
                  <th key={h} className="rp-th">{h}</th>)}
              </tr></thead>
              <tbody>
                {loadResults.filter(ld => ld.cable?.enabled).map(ld => (
                  <tr key={ld.id}>
                    <td className="rp-td rp-td--bold">TGA - {ld.label}</td>
                    <td className="rp-td">{ld.cable.gauge}</td>
                    <td className="rp-td">{ld.cable.type === "ACSR" ? "Aluminio" : (ld.cable.material ?? "Cobre")}</td>
                    <td className="rp-td">{ld.cable.len}</td>
                    <td className="rp-td">{(getZ(ld.cable.type, ld.cable.gauge, ld.cable.material, ld.cable.canal) * ld.cable.len / 1000).toFixed(4)}</td>
                    <td className="rp-td rp-td--bold rp-td--blue">{ld.cableKVAcc?.toFixed(2) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </ResumenTable>
          </>
        )}

        <SecTitle>Cargas Inductivas</SecTitle>
        <ResumenTable>
          <thead><tr>
            {["ID", "Descrip.", "HP", "X''", "kVAsc"].map(h =>
              <th key={h} className="rp-th">{h}</th>)}
          </tr></thead>
          <tbody>
            {loadResults.map((ld, i) => (
              <tr key={ld.id} className={i % 2 ? "rp-tr--odd" : ""}>
                <td className="rp-td">{ld.id}</td>
                <td className="rp-td rp-td--bold">{ld.label}</td>
                <td className="rp-td">{ld.hp}</td>
                <td className="rp-td rp-td--amber">{ld.xdpp.toFixed(3)}</td>
                <td className="rp-td rp-td--bold rp-td--blue">{ld.motorKVAcc.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </ResumenTable>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   APP
══════════════════════════════════════════════════════════════ */
export default function App() {
  const { data, view, setView, result, canvasRef, upd, addSrc, rmSrc, addLd, rmLd, calc } = useIccCalc();

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
          <SecHead n="1" title="Fuente de Red" sub="Datos de la corriente de falla disponible desde la compañía distribuidora" />
          <div className="grid-params">
            <Fld label="Tensión de red (kV)"><Inp value={data.grid.kV} onChange={v => upd("grid.kV", v)} min={0.1} step={0.1} /></Fld>
            <Fld label="Icc (kA)"><Inp value={data.grid.Icc} onChange={v => upd("grid.Icc", v)} min={0} step={0.1} placeholder="0" /></Fld>
            <Fld label="kVAcc directo (kVA)"><Inp value={data.grid.kVAcc} onChange={v => upd("grid.kVAcc", v)} min={0} step={100} /></Fld>
          </div>
          <div className="grid-tip">
            💡 Icc en <strong>kA</strong>. Internamente: √3 × kV × Icc(kA)×1000 A = kVA.
            Ej: √3 × 13.2 kV × 10,000 A = 228,624 kVA. Si se ingresa kVAcc directamente, tiene prioridad.
          </div>
        </Card>

        {/* STEP 2 – SOURCES */}
        <Card>
          <div className="section-header">
            <SecHead n="2" title="Fuentes de Alimentación" sub="Transformadores y/o generadores que alimentan la barra principal de BT" />
            <button onClick={addSrc} className="btn-add">+ Fuente</button>
          </div>
          <div className="sources-list">
            {data.sources.map((src, i) => (
              <div key={src.id} className="src-card">
                <div className="src-card__header">
                  <div className="src-card__header-left">
                    <span className={`src-badge src-badge--${src.type === "transformer" ? "trafo" : "gen"}`}>
                      {src.type === "transformer" ? "TRANSFORMADOR" : "GENERADOR"}
                    </span>
                    <input
                      value={src.label}
                      onChange={e => upd(`sources.${i}.label`, e.target.value)}
                      className="label-input"
                    />
                  </div>
                  <div className="src-card__header-right">
                    {["transformer", "generator"].map(t => (
                      <label key={t} className="radio-label">
                        <input type="radio" name={`tp-${src.id}`} value={t} checked={src.type === t}
                          onChange={() => upd(`sources.${i}.type`, t)} />
                        {t === "transformer" ? "Trafo" : "Generador"}
                      </label>
                    ))}
                    {data.sources.length > 1 && (
                      <button onClick={() => rmSrc(src.id)} className="btn-remove">✕</button>
                    )}
                  </div>
                </div>
                <div className="src-params-grid">
                  <Fld label="Potencia (kVA)"><Inp value={src.kVA} onChange={v => upd(`sources.${i}.kVA`, v)} min={1} step={25} /></Fld>
                  <Fld label={src.type === "transformer" ? "%Z impedancia" : "X''d (p.u.)"}>
                    <Inp value={src.type === "transformer" ? src.zPct : src.xdpp}
                      onChange={v => upd(`sources.${i}.${src.type === "transformer" ? "zPct" : "xdpp"}`, v)} min={0.01} step={0.01} />
                  </Fld>
                  <Fld label="Tensión primaria (kV)"><Inp value={src.kVpri} onChange={v => upd(`sources.${i}.kVpri`, v)} min={0.1} step={0.1} /></Fld>
                  <Fld label="Tensión secundaria (kV)"><Inp value={src.kVsec} onChange={v => upd(`sources.${i}.kVsec`, v)} min={0.001} step={0.001} /></Fld>
                </div>
                <div className="src-cables-grid">
                  <div>
                    <div className="cable-section-label">Cable de entrada (MT → fuente)</div>
                    <CableFrm cable={src.inCable} onChange={c => upd(`sources.${i}.inCable`, c)} />
                  </div>
                  <div>
                    <div className="cable-section-label">Cable de salida (fuente → barra BT)</div>
                    <CableFrm cable={src.outCable} onChange={c => upd(`sources.${i}.outCable`, c)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* STEP 3 – LOADS */}
        <Card>
          <div className="section-header">
            <SecHead n="3" title="Cargas Inductivas (Motores)"
              sub="Motores de inducción conectados a la barra. Contribuyen aguas abajo al cortocircuito." />
            <button onClick={addLd} className="btn-add btn-add--green">+ Motor</button>
          </div>
          <div className="loads-grid">
            {data.loads.map((ld, i) => (
              <div key={ld.id} className="load-card">
                <div className="load-card__header">
                  <div className="load-card__header-left">
                    <div className="load-num">{i + 1}</div>
                    <input
                      value={ld.label}
                      onChange={e => upd(`loads.${i}.label`, e.target.value)}
                      className="load-label-input"
                    />
                  </div>
                  {data.loads.length > 1 && (
                    <button onClick={() => rmLd(ld.id)} className="btn-remove-x">✕</button>
                  )}
                </div>
                <div className="load-params-grid">
                  <Fld label="Potencia (HP)"><Inp value={ld.hp} onChange={v => upd(`loads.${i}.hp`, v)} min={0.5} step={0.5} /></Fld>
                  <div className="xdpp-display">
                    <div className="xdpp-display__label">X''d automático</div>
                    <div className="xdpp-display__value">{ld.hp >= 50 ? "0.17" : "0.20"}</div>
                    <div className="xdpp-display__hint">{ld.hp >= 50 ? "Motor ≥ 50 hp" : "Motor < 50 hp"}</div>
                  </div>
                </div>
                <CableFrm cable={ld.cable} onChange={c => upd(`loads.${i}.cable`, c)} />
              </div>
            ))}
          </div>
        </Card>

        {/* CALCULATE BTN */}
        <button onClick={calc} className="btn-calc">
          ⚡ Calcular y Ver Diagrama Unifilar →
        </button>
      </div>
    </div>
  );

  /* ═══ RESULTS ═══ */
  const { srcResults, loadResults, busKVAcc, upstreamKVAcc, downstreamKVAcc, Icc_sym, Icc_asym, factor, kVbus, gridKVAcc } = result;

  return (
    <div className="app">
      <div className="res-topbar">
        <div>
          <div className="res-topbar__title">⚡ Diagrama de kVA's de Cortocircuito</div>
          <div className="res-topbar__sub">Barra {kVbus} kV — Método kVA Equivalentes</div>
        </div>
        <button onClick={() => setView("form")} className="btn-back">← Editar</button>
      </div>

      {/* KPI strip */}
      <div className="kpi-strip">
        {[
          { label: "kVAcc Total en Barra", value: f(busKVAcc, 1) + " kVA", color: "amber", sub: "Σ upstream + downstream" },
          { label: "Icc Simétrica",        value: f(Icc_sym, 0) + " A",   color: "blue",  sub: `${kVbus} kV` },
          { label: "Icc Asimétrica",       value: f(Icc_asym, 0) + " A",  color: "red",   sub: `Factor ×${factor}` },
          { label: "Contrib. Motores",     value: f(downstreamKVAcc, 1) + " kVA", color: "green", sub: "Aguas abajo" },
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
        <ResumenParametros data={data} result={result} />

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
                  <td className="res-td res-td--amber res-td--bold res-td--mono">{f(gridKVAcc, 1)} kVA</td>
                  <td className="res-td">—</td>
                  <td className="res-td">—</td>
                </tr>
                {srcResults.map(s => (
                  <tr key={s.id}>
                    <td className="res-td res-td--dark res-td--bold">{s.label}</td>
                    <td className="res-td res-td--mono">{f(s.srcKVAcc, 1)} kVA</td>
                    <td className="res-td res-td--mono">{f(s.kVAcc_through, 1)} kVA</td>
                    <td className="res-td res-td--blue res-td--bold res-td--mono">{f(s.outKVAcc, 1)} kVA</td>
                  </tr>
                ))}
                <tr className="res-tr--total-blue">
                  <td className="res-td res-td--amber res-td--bold" colSpan={3}>Total aguas arriba</td>
                  <td className="res-td res-td--amber res-td--bold res-td--mono res-td--lg">{f(upstreamKVAcc, 1)} kVA</td>
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
                {["Motor", "HP", "X''d", "kVAcc motor", "kVAcc cable", "kVAcc a barra", "Icc (A)"].map(h => <th key={h} className="res-th">{h}</th>)}
              </tr></thead>
              <tbody>
                {loadResults.map((ld, idx) => (
                  <tr key={ld.id} className={idx % 2 ? "res-tr--striped" : ""}>
                    <td className="res-td res-td--dark res-td--bold">{ld.label}</td>
                    <td className="res-td">{ld.hp}</td>
                    <td className="res-td res-td--amber">{ld.xdpp}</td>
                    <td className="res-td res-td--mono">{f(ld.motorKVAcc, 1)}</td>
                    <td className={`res-td res-td--mono${ld.cableKVAcc ? "" : " res-td--light"}`}>
                      {ld.cableKVAcc ? f(ld.cableKVAcc, 1) : "—"}
                    </td>
                    <td className="res-td res-td--green res-td--bold res-td--mono">{f(ld.tobus, 2)}</td>
                    <td className="res-td res-td--mono">{f(ld.tobus / (Math.sqrt(3) * kVbus), 1)}</td>
                  </tr>
                ))}
                <tr className="res-tr--total-green">
                  <td className="res-td res-td--green res-td--bold" colSpan={5}>Total aguas abajo</td>
                  <td className="res-td res-td--green res-td--bold res-td--mono res-td--lg">{f(downstreamKVAcc, 1)} kVA</td>
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
                <span className={`summary-row__value summary-row__value--${color}`}>{f(value, 1)} {unit}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="summary-section__title">Corrientes — Barra {kVbus} kV</div>
            {[
              { label: "Icc simétrica",           value: Icc_sym,  color: "blue", unit: "A" },
              { label: `Icc asimétrica ×${factor}`, value: Icc_asym, color: "red",  unit: "A" },
            ].map(({ label, value, color, unit }) => (
              <div key={label} className="summary-row">
                <span className="summary-row__label">{label}</span>
                <span className={`summary-row__value summary-row__value--${color}`}>{f(value, 1)} {unit}</span>
              </div>
            ))}
            <div className="formula-box">
              Fórmula: Icc = kVAcc / (√3 × {kVbus} kV)<br />
              Factor asimétrico: {factor} {kVbus < 0.6 ? "(sistema ≤600V)" : "(sistema >600V)"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
