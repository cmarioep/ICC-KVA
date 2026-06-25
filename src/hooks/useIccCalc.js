import { useState, useRef, useEffect } from "react";
import { getZ, series, cableKVA } from "../utils/cableUtils";
import { drawDiagram } from "../utils/diagram";
import { drawUnifiedDiagram } from "../utils/unifiedDiagram";

const DEFAULT_JSON = JSON.stringify({
  networkOperator: {
    tesion: 13.2,
    Icc: 10,
  },
  primaryServiceFeeder: { type: "MT15", material: "Cobre", conduit: "PVC", awg: "1/0", long: 50 },
  mainSource: { kva: 630 },
  existingFeeder: { type: "BT600", material: null, conduit: null, awg: null, long: null, wireQuantity: null, conductorsPerPhase: null, selected: false },
  generator: { kva: null },
  generatorFeeder: { type: "BT600", material: null, conduit: null, awg: null, long: null, wireQuantity: null, conductorsPerPhase: null },
  totalDemandLoad: 10000,
  mainFeeder: { type: "BT600", material: "Cobre", conduit: "PVC", awg: "500", long: 50, wireQuantity: 3, conductorsPerPhase: null, selected: true },
  economicMainFeeder: { type: "BT600", material: null, conduit: null, awg: null, long: null, wireQuantity: null, conductorsPerPhase: null, selected: false },
  analisisCargas: {
    tableros: [
      {
        id: "tablero-1",
        config: {
          name: "TD-1", boardType: "trifasico", switchboardLength: 6,
          systemVoltage: 208, environmentTemperature: 30,
          material: "Cobre", conduit: "PVC", wireQuantity: 3, temperatureAWG: 60,
        },
        feeder: { type: "BT600", material: "Cobre", conduit: "PVC", awg: 6, long: 30, selected: true },
        economicFeeder: { type: "BT600", material: "Cobre", conduit: "PVC", awg: 350, long: 30, selected: false },
        circuits: [
          {
            active: true, name: "Bomba", loadType: "Inducción", type: "monofasico",
            voltage: 208, load: "2486.67", awgType: "BT600", material: "Cobre", conduit: "PVC", awg: 8, long: "25",
            circuitNumber: 1, circuitNumbers: [1],
          },
          {
            active: true, name: "General", loadType: "Iluminacion", type: "monofasico",
            voltage: 120, load: "1500", awgType: "BT600", material: "Cobre", conduit: "PVC", awg: 8, long: "25",
            circuitNumber: 3, circuitNumbers: [3],
          },
        ],
      },
      {
        id: "tablero-2",
        config: {
          name: "TD-2", boardType: "trifasico", switchboardLength: 6,
          systemVoltage: 208, environmentTemperature: 30,
          material: "Cobre", conduit: "PVC", wireQuantity: 3, temperatureAWG: 60,
        },
        feeder: { type: "BT600", material: "Cobre", conduit: "PVC", awg: 6, long: 30, selected: true },
        economicFeeder: { type: "BT600", material: "Cobre", conduit: "PVC", awg: 350, long: 30, selected: false },
        circuits: [
          {
            active: true, name: "Bomba", loadType: "Inducción", type: "monofasico",
            voltage: 208, load: "2486.67", awgType: "BT600", material: "Cobre", conduit: "PVC", awg: 8, long: "25",
            circuitNumber: 1, circuitNumbers: [1],
          },
          {
            active: true, name: "General", loadType: "Iluminacion", type: "monofasico",
            voltage: 120, load: "1500", awgType: "BT600", material: "Cobre", conduit: "PVC", awg: 8, long: "25",
            circuitNumber: 3, circuitNumbers: [3],
          },
        ],
      },
    ],
  },
}, null, 2);

const FP = 0.9;

const Z_PCT_BY_KVA = {
  "45": 4, "75": 4, "112.5": 4.5,
  "150": 6, "250": 6, "500": 6, "630": 6,
};

// Pick the feeder object flagged with selected:true among the candidates.
function selectFeeder(...candidates) {
  return candidates.find(f => f && f.selected) ?? null;
}

// Map a feeder/cable JSON object to the internal cable shape used by the calc/diagram.
function feederToCable(feeder) {
  return {
    enabled:  feeder?.awg != null,
    type:     feeder?.type,
    gauge:    feeder?.awg != null ? String(feeder.awg) : null,
    material: feeder?.material,
    canal:    feeder?.conduit,
    len:      feeder?.long,
    parallel: feeder?.conductorsPerPhase ?? 1,
  };
}

// Map a tablero circuit to the internal load shape. Tablero circuits are always
// low-voltage runs, so the cable type defaults to BT600 when not specified.
function circuitToLoad(circuit, index) {
  const isMotor   = circuit.loadType === "Inducción";
  const voltageKV = circuit.voltage / 1000;
  const loadVA    = parseFloat(circuit.load);
  const hp        = isMotor ? (loadVA * FP) / 746 : null;

  return {
    id:              index + 1,
    loadType:        isMotor ? "inducción" : "resistive",
    label:           circuit.name,
    hp,
    voltageKV,
    circuitNumber:   circuit.circuitNumber,
    circuitNumbers:  circuit.circuitNumbers,
    circuitLoadType: circuit.loadType,
    circuitPhase:    circuit.type,
    loadVA,
    cable: {
      enabled:  true,
      type:     circuit.awgType ?? "BT600",
      gauge:    String(circuit.awg),
      material: circuit.material,
      canal:    circuit.conduit,
      len:      parseFloat(circuit.long),
      parallel: circuit.conductorsPerPhase ?? 1,
    },
  };
}

function mapCircuitsToLoads(circuits) {
  return (circuits ?? [])
    .filter(c => c.active && parseFloat(c.load) > 0 && c.loadType && c.voltage)
    .map(circuitToLoad);
}

function buildSources(input, busVoltageKV, mainFeeder) {
  const psf = input.primaryServiceFeeder;

  const sources = [{
    id: 1, type: "transformer", label: "TR",
    kVA:   input.mainSource.kva,
    kVpri: input.networkOperator.tesion,
    kVsec: busVoltageKV,
    zPct:  input.mainSource.zPct ?? Z_PCT_BY_KVA[String(input.mainSource.kva)] ?? 6,
    xdpp:  0.17,
    inCable:  feederToCable(psf),
    outCable: feederToCable(mainFeeder),
  }];

  if (input.generator?.kva != null) {
    const gf = input.generatorFeeder;
    sources.push({
      id: 2, type: "generator", label: "GEN",
      kVA:   input.generator.kva,
      kVpri: busVoltageKV,
      kVsec: busVoltageKV,
      zPct:  4.5,
      xdpp:  0.17,
      inCable:  { enabled: false, type: "BT600", gauge: "2/0", material: "Cobre", canal: "PVC", len: 50, parallel: 1 },
      outCable: gf?.awg != null
        ? { enabled: true, type: gf.type, gauge: String(gf.awg), material: gf.material, canal: gf.conduit, len: gf.long, parallel: gf.conductorsPerPhase ?? 1 }
        : { enabled: false, type: "BT600", gauge: "2/0", material: "Cobre", canal: "PVC", len: 50, parallel: 1 },
    });
  }
  return sources;
}

// ── Single-bus input (one tablero): existing topology ─────────────────────────
function transformJsonInput(input, tablero) {
  const busVoltageV  = tablero.config?.systemVoltage ?? parseFloat(String(input.systemVoltage));
  const busVoltageKV = busVoltageV / 1000;

  const grid = {
    kV:    input.networkOperator.tesion,
    Icc:   input.networkOperator.Icc,
    kVAcc: 0,
  };

  // The feeder from the transformer to the (single) board bus.
  const feeder = selectFeeder(tablero.feeder, tablero.economicFeeder) ?? tablero.feeder;
  const sources = buildSources(input, busVoltageKV, feeder);
  const loads   = mapCircuitsToLoads(tablero.circuits);

  return { grid, sources, loads, busVoltageKV };
}

// ── Unified input (multiple tableros): main feeder → main bus → tablero feeders ─
function transformUnifiedInput(input) {
  const tableros = input.analisisCargas?.tableros ?? [];
  const mainBusVoltageKV = (tableros[0]?.config?.systemVoltage ?? 208) / 1000;

  const grid = {
    kV:    input.networkOperator.tesion,
    Icc:   input.networkOperator.Icc,
    kVAcc: 0,
  };

  // Main feeder = selected among existingFeeder / mainFeeder / economicMainFeeder.
  const mainFeeder = selectFeeder(input.existingFeeder, input.mainFeeder, input.economicMainFeeder);
  const sources    = buildSources(input, mainBusVoltageKV, mainFeeder);

  const tableroData = tableros.map(tablero => {
    const busVoltageKV = (tablero.config?.systemVoltage ?? 208) / 1000;
    // Tablero feeder = selected among feeder / economicFeeder.
    const feeder = selectFeeder(tablero.feeder, tablero.economicFeeder);
    return {
      id:    tablero.id,
      name:  tablero.config?.name ?? tablero.id,
      busVoltageKV,
      feeder: feederToCable(feeder),
      loads:  mapCircuitsToLoads(tablero.circuits),
    };
  });

  return { grid, sources, busVoltageKV: mainBusVoltageKV, tableros: tableroData };
}

// kVAcc of a single load and its contribution to its own bus.
function calcLoad(load, busVoltageKV) {
  const loadVoltageKV = load.voltageKV ?? busVoltageKV;

  if (load.loadType === "resistive") {
    let cableKVAcc = null;
    if (load.cable.enabled) {
      cableKVAcc = cableKVA(loadVoltageKV, getZ(load.cable.type, load.cable.gauge, load.cable.material, load.cable.canal), load.cable.len, load.cable.parallel);
    }
    return { ...load, cableKVAcc, kVAccContributionToBus: 0, motorKVAcc: null, xdpp: null };
  }

  const xdpp       = load.hp >= 50 ? 0.17 : 0.20;
  const motorKVAcc = load.hp / xdpp;
  let kVAccContributionToBus = motorKVAcc, cableKVAcc = null;
  if (load.cable.enabled) {
    cableKVAcc             = cableKVA(loadVoltageKV, getZ(load.cable.type, load.cable.gauge, load.cable.material, load.cable.canal), load.cable.len, load.cable.parallel);
    kVAccContributionToBus = series(motorKVAcc, cableKVAcc);
  }
  return { ...load, xdpp, motorKVAcc, cableKVAcc, kVAccContributionToBus };
}

// Process the upstream sources (transformer + optional generator) feeding a bus.
function calcSources(grid, sources, hasGridData, gridKVAcc) {
  let upstreamKVAcc = 0;
  let generatorBusKVAcc = 0;
  const srcResults = sources.map(source => {
    const equipmentKVAcc = source.type === "transformer"
      ? source.kVA / (source.zPct / 100)
      : source.kVA / source.xdpp;

    let inCableKVAcc = null;
    let kVAccAtSourceInput = gridKVAcc;
    if (source.type !== "generator" && source.inCable.enabled && hasGridData) {
      inCableKVAcc       = cableKVA(grid.kV, getZ(source.inCable.type, source.inCable.gauge, source.inCable.material, source.inCable.canal), source.inCable.len, source.inCable.parallel);
      kVAccAtSourceInput = series(gridKVAcc, inCableKVAcc);
    }

    // Sin datos de red, el transformador es el único limitante (red tratada como bus infinito)
    const kVAccPassingThrough = source.type === "generator"
      ? equipmentKVAcc
      : (hasGridData ? series(kVAccAtSourceInput, equipmentKVAcc) : equipmentKVAcc);

    let outCableKVAcc = null;
    let kVAccAtSourceOutput = kVAccPassingThrough;
    if (source.outCable.enabled) {
      outCableKVAcc       = cableKVA(source.kVsec, getZ(source.outCable.type, source.outCable.gauge, source.outCable.material, source.outCable.canal), source.outCable.len, source.outCable.parallel);
      kVAccAtSourceOutput = series(kVAccPassingThrough, outCableKVAcc);
    }

    if (source.type === "generator") generatorBusKVAcc += kVAccAtSourceOutput;
    else upstreamKVAcc += kVAccAtSourceOutput;
    return { ...source, equipmentKVAcc, inCableKVAcc, kVAccAtSourceInput, kVAccPassingThrough, outCableKVAcc, kVAccAtSourceOutput };
  });

  return { srcResults, upstreamKVAcc, generatorBusKVAcc };
}

function runCalc(data) {
  const { grid, sources, loads } = data;
  const hasGridData = grid.kV != null && grid.kV > 0 && grid.Icc != null && grid.Icc > 0;
  const gridKVAcc = hasGridData
    ? (grid.kVAcc > 0 ? grid.kVAcc : Math.sqrt(3) * grid.kV * (grid.Icc * 1000))
    : 0;

  const { srcResults, upstreamKVAcc, generatorBusKVAcc } = calcSources(grid, sources, hasGridData, gridKVAcc);

  const busVoltageKV = data.busVoltageKV ?? sources[0]?.kVsec ?? 0.48;

  let downstreamKVAcc = generatorBusKVAcc;
  const loadResults = loads.map(load => {
    const result = calcLoad(load, busVoltageKV);
    downstreamKVAcc += result.kVAccContributionToBus;
    return result;
  });

  const busKVAcc                      = upstreamKVAcc + downstreamKVAcc;
  const symmetricShortCircuitCurrent  = busKVAcc / (Math.sqrt(3) * busVoltageKV);
  const asymmetricFactor              = busVoltageKV < 0.6 ? 1.25 : 1.6;

  return {
    gridKVAcc,
    srcResults,
    loadResults,
    upstreamKVAcc,
    downstreamKVAcc,
    busKVAcc,
    symmetricShortCircuitCurrent,
    asymmetricShortCircuitCurrent: asymmetricFactor * symmetricShortCircuitCurrent,
    asymmetricFactor,
    busVoltageKV,
  };
}

// Two-level network: sources → main bus → per-tablero feeder → tablero bus → circuits.
//
// Fully bidirectional kVAcc model: under fault conditions the short-circuit power
// flows from EVERY source (utility/transformer/generators AND motors) toward the fault
// through any available path. In kVAcc terms each element is an admittance — series
// branches combine via series() and parallel injections add. The radial network is a
// star: the main bus connects to the source equivalent (S) directly and to each board
// bus through a feeder (F_i); each board bus connects to its own motors (D_i).
//
//   main bus fault:  Y_main = S + Σ_i series(F_i, D_i)
//   board i fault:   Y_i    = D_i + series(F_i, R_i),  R_i = Y_main − series(F_i, D_i)
//
// where R_i is the rest of the network seen at the main bus excluding board i's branch
// (i.e. the sources plus every sibling board's motor contribution). This lets motor
// contributions propagate up to the main bus and across to sibling boards.
function runUnifiedCalc(data) {
  const { grid, sources, tableros } = data;
  const hasGridData = grid.kV != null && grid.kV > 0 && grid.Icc != null && grid.Icc > 0;
  const gridKVAcc = hasGridData
    ? (grid.kVAcc > 0 ? grid.kVAcc : Math.sqrt(3) * grid.kV * (grid.Icc * 1000))
    : 0;

  const { srcResults, upstreamKVAcc, generatorBusKVAcc } = calcSources(grid, sources, hasGridData, gridKVAcc);

  // S: source contribution available at the main bus (sources + local generators).
  const sourceKVAcc      = upstreamKVAcc + generatorBusKVAcc;
  const mainBusVoltageKV = data.busVoltageKV ?? sources[0]?.kVsec ?? 0.208;

  // Per-board intermediates: feeder admittance (F_i), own-motor admittance at the board
  // bus (D_i = downstreamKVAcc) and the contribution this board injects up to the main
  // bus through its feeder, series(D_i, F_i). A disabled feeder acts as a perfect link
  // (infinite admittance), so series() leaves the board contribution unchanged.
  const boards = tableros.map(tablero => {
    const busVoltageKV = tablero.busVoltageKV ?? mainBusVoltageKV;

    const feederKVAcc = tablero.feeder.enabled
      ? cableKVA(busVoltageKV, getZ(tablero.feeder.type, tablero.feeder.gauge, tablero.feeder.material, tablero.feeder.canal), tablero.feeder.len, tablero.feeder.parallel)
      : null;
    const feederAdmittance = feederKVAcc ?? Infinity;

    let downstreamKVAcc = 0;
    const loadResults = tablero.loads.map(load => {
      const result = calcLoad(load, busVoltageKV);
      downstreamKVAcc += result.kVAccContributionToBus;
      return result;
    });

    const contribToMain = series(downstreamKVAcc, feederAdmittance);
    return { tablero, busVoltageKV, feederKVAcc, feederAdmittance, downstreamKVAcc, loadResults, contribToMain };
  });

  // Main bus fault: sources + every board's motor contribution through its feeder.
  const mainBusDownstreamKVAcc = boards.reduce((sum, b) => sum + b.contribToMain, 0);
  const mainBusKVAcc           = sourceKVAcc + mainBusDownstreamKVAcc;
  const mainAsymmetricFactor   = mainBusVoltageKV < 0.6 ? 1.25 : 1.6;
  const mainBusIcc             = mainBusKVAcc / (Math.sqrt(3) * mainBusVoltageKV);

  const tableroResults = boards.map(b => {
    const { tablero, busVoltageKV, feederKVAcc, feederAdmittance, downstreamKVAcc, loadResults, contribToMain } = b;

    // R_i: rest of the network seen at the main bus excluding this board's branch.
    const restAtMain = mainBusKVAcc - contribToMain;
    // Upstream contribution arriving at this board bus through its own feeder.
    const upstreamAtBus = series(feederAdmittance, restAtMain);

    const busKVAcc                     = upstreamAtBus + downstreamKVAcc;
    const asymmetricFactor             = busVoltageKV < 0.6 ? 1.25 : 1.6;
    const symmetricShortCircuitCurrent = busKVAcc / (Math.sqrt(3) * busVoltageKV);

    return {
      id: tablero.id,
      name: tablero.name,
      feeder: tablero.feeder,
      busVoltageKV,
      feederKVAcc,
      upstreamAtBus,
      loadResults,
      downstreamKVAcc,
      busKVAcc,
      symmetricShortCircuitCurrent,
      asymmetricShortCircuitCurrent: asymmetricFactor * symmetricShortCircuitCurrent,
      asymmetricFactor,
    };
  });

  return {
    gridKVAcc,
    srcResults,
    upstreamKVAcc: mainBusKVAcc,
    mainBusKVAcc,
    mainBusUpstreamKVAcc: sourceKVAcc,
    mainBusDownstreamKVAcc,
    mainBusIcc,
    mainAsymmetricFactor,
    busVoltageKV: mainBusVoltageKV,
    tableros: tableroResults,
  };
}

export function useIccCalc() {
  const [jsonText,       setJsonText]       = useState(DEFAULT_JSON);
  const [jsonError,      setJsonError]      = useState(null);
  const [tableroResults, setTableroResults] = useState([]);
  const [activeTab,      setActiveTab]      = useState(0);
  const [mode,           setMode]           = useState("single"); // "single" | "unified"
  const [unified,        setUnified]        = useState(null);     // { data, result }
  const [view,           setView]           = useState("json");
  const canvasRef = useRef(null);

  const parseAndCalculate = () => {
    try {
      const parsed   = JSON.parse(jsonText);
      const tableros = parsed.analisisCargas?.tableros ?? [];

      if (tableros.length > 1) {
        const data   = transformUnifiedInput(parsed);
        const result = runUnifiedCalc(data);
        setUnified({ data, result });
        setMode("unified");
      } else {
        const results = tableros.map(tablero => {
          const data   = transformJsonInput(parsed, tablero);
          const result = runCalc(data);
          return { id: tablero.id, name: tablero.config?.name ?? tablero.id, data, result };
        });
        setTableroResults(results);
        setActiveTab(0);
        setMode("single");
      }
      setJsonError(null);
      setView("results");
    } catch (e) {
      setJsonError(e.message);
    }
  };

  useEffect(() => {
    if (view !== "results") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (mode === "unified") {
      if (!unified) return;
      const { data, result } = unified;

      const tableroWidths  = result.tableros.map(t => Math.max(180, t.loadResults.length * 170));
      const totalWidth     = tableroWidths.reduce((a, b) => a + b, 0) + (result.tableros.length - 1) * 120;
      const intrinsicWidth = Math.max(720, totalWidth + 160);

      // drawUnifiedDiagram reads canvas.width as the intrinsic drawing width, then resizes
      // the bitmap to fit the container at device resolution — so reset it before each draw.
      const render = () => {
        canvas.width = intrinsicWidth;
        drawUnifiedDiagram(canvas, data, result);
      };
      render();

      // Re-render (re-fit) when the container size changes, keeping the diagram crisp.
      const ro = canvas.parentElement && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(render) : null;
      if (ro) ro.observe(canvas.parentElement);
      return () => ro?.disconnect();
    }

    if (!tableroResults.length) return;
    const { data, result } = tableroResults[activeTab];

    const loadCount   = result.loadResults.length;
    const sourceCount = result.srcResults.length;
    canvas.width  = Math.max(560, 120 + loadCount * 140 + sourceCount * 230);

    const hasMediumVoltageCable = data.sources[0]?.inCable?.enabled  ? 1 : 0;
    const hasLowVoltageCable    = data.sources[0]?.outCable?.enabled ? 1 : 0;
    const hasLoadCable          = data.loads[0]?.cable?.enabled      ? 1 : 0;
    const baseCanvasHeight      = 300 + hasMediumVoltageCable * 80 + hasLowVoltageCable * 80 + hasLoadCable * 80 + 200;
    canvas.height = Math.max(820, baseCanvasHeight);

    drawDiagram(canvas, data, result);
  }, [view, mode, unified, tableroResults, activeTab]);

  return {
    jsonText, setJsonText, jsonError,
    mode, unified, tableroResults, activeTab, setActiveTab,
    view, setView, canvasRef, parseAndCalculate,
  };
}
