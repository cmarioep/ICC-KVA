# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page React + Vite tool that computes **short-circuit current (Icc / corriente de cortocircuito)** for low/medium-voltage electrical distribution systems using the **kVAcc method** (short-circuit power in kVA, equivalent to the per-unit/MVA method). Input is a JSON description of the network (grid operator, transformer/generator sources, feeders, panel boards with circuits); output is a set of calculated summary tables plus a hand-drawn one-line (unifilar) diagram rendered to a `<canvas>`.

The UI text, JSON keys, and domain terms are in **Spanish** — keep that convention. Common terms: `tablero` = panel board, `acometida` = service entry, `alimentador`/`feeder` = feeder cable, `barra` = bus, `carga` = load, `Icc` = short-circuit current, `kVAcc` = short-circuit power.

## Commands

```bash
npm run dev      # Vite dev server with HMR
npm run build    # production build to dist/
npm run preview  # serve the production build
npm run lint     # ESLint (flat config in eslint.config.js)
```

There is **no test suite** and no test runner configured. Verify changes by running `npm run dev` and pasting JSON into the input view.

## Architecture

The entire app is driven by one hook and rendered by one component; there is no router and no global state library.

- **`src/hooks/useIccCalc.js`** — the brain. Holds all state, parses the JSON, transforms it, runs the calculation, and drives the canvas via a `useEffect`. Three stages:
  1. **Transform** raw JSON → internal `data` shape: `transformJsonInput` (single board) and `transformUnifiedInput` (multiple boards). Helpers `feederToCable`, `circuitToLoad`, `mapCircuitsToLoads`, `buildSources`, `selectFeeder`.
  2. **Calculate**: `runCalc` (single-bus) and `runUnifiedCalc` (two-level: sources → main bus → per-board feeder → board bus). Shared pieces: `calcSources` (transformer/generator contribution) and `calcLoad` (per-circuit; motors contribute, resistive loads don't).
  3. **Draw**: dispatches to `drawDiagram` or `drawUnifiedDiagram`, sizing the canvas first.
- **`src/App.jsx`** — all rendering. Pure presentational components (`KVTable`, `ParameterSummary`, `UnifiedMainSummary`, `TableroSummary`). Switches on `view` (`"json"` vs `"results"`) and `mode` (`"single"` vs `"unified"`).
- **`src/utils/cableUtils.js`** + **`src/utils/cableParams.js`** — cable impedance model. `cableParams.js` is the lookup tables of R and XL per gauge/material/conduit for three cable families (`BT600` low-voltage AWG/MCM, `MT15` 15kV XLPE, `ACSR` overhead). `cableUtils.js` derives Z, computes `cableKVA`, and provides the critical `series()` combiner.
- **`src/utils/diagram.js`** / **`src/utils/unifiedDiagram.js`** — imperative canvas drawing of the one-line diagrams. **`src/utils/diagramPrimitives.js`** — `createPrimitives(ctx)` returns shared drawing closures (transformer/grid/load symbols, bus bars, impedance boxes) so both diagrams share one visual language.

### How the calculation actually works (key to not breaking it)

Everything is computed in **kVAcc (short-circuit power, kVA)**, *not* impedance, then converted to current only at the end: `Icc = kVAcc / (√3 × kV)`.

- Impedances in series combine via **`series(a, b) = 1/(1/a + 1/b)`** because in kVAcc terms, series impedances add *reciprocally* (more impedance = less short-circuit power). `series()` returns 0 if either input is ≤ 0.
- Grid: `gridKVAcc = √3 × kV × (Icc_kA × 1000)`. If grid data is absent, the transformer is treated as an infinite bus (grid ignored).
- Transformer equipment: `kVA / (Z% / 100)`. Generator/motor: `kVA / X''d`.
- A cable's `cableKVA = 1000·kV² / ((Z/parallel)·km)`. `conductorsPerPhase` (parallel conductors) divides effective impedance.
- **Upstream** (sources/grid through feeders) and **downstream** (motor contributions) sum at the bus: `busKVAcc = upstreamKVAcc + downstreamKVAcc`. Resistive loads contribute 0 to the bus.
- Asymmetric factor is **1.25** for systems ≤ 600 V, **1.6** above.
- Motor X''d: **0.17** for ≥ 50 HP, else **0.20**. HP = `loadVA × 0.9 / 746` (FP fixed at 0.9).
- The unified (multi-board) model is **fully bidirectional**: under fault, short-circuit power flows from every source *and* every motor toward the fault through any available path. The radial network is a star (main bus ↔ source equivalent `S`; main bus ↔ each board bus via feeder `F_i`; board bus ↔ its motors `D_i`), reduced as: main bus `Y_main = S + Σ series(F_i, D_i)`; board *i* `Y_i = D_i + series(F_i, R_i)` where `R_i = Y_main − series(F_i, D_i)` is the rest of the network seen at the main bus excluding board *i*. So board motor contributions **do** propagate up to the main bus and across to sibling boards.

### Single vs unified mode

`parseAndCalculate` chooses by board count: `analisisCargas.tableros.length > 1` → unified; otherwise single (rendered per-board, selected via `activeTab`). The JSON input shape is documented inline by `DEFAULT_JSON` at the top of `useIccCalc.js` — that constant is the canonical example of every accepted field.

### Feeder selection

Feeders come in pairs where exactly one is flagged `selected: true` (e.g. `mainFeeder` vs `economicMainFeeder`, `feeder` vs `economicFeeder`). `selectFeeder(...candidates)` picks the selected one. A cable is "enabled" only when its `awg` is non-null.
