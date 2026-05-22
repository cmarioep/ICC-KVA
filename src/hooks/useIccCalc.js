import { useState, useRef, useEffect } from "react";
import { getZ, series, cableKVA } from "../utils/cableUtils";
import { drawDiagram } from "../utils/diagram";

const DEFAULT_JSON = JSON.stringify({
  systemVoltage: "208V",
  networkOperator: {
    tesion: 13.2,
    Icc: 10,
    feeder: { type: "MT15", material: "Cobre", conduit: "PVC", awg: "1/0", long: 50 },
  },
  mainSource: {
    kva: 630,
    feeder: { type: "BT600", material: "Cobre", conduit: "PVC", awg: 500, long: 50 },
  },
  generator: {
    kva: null,
    feeder: { type: null, material: null, conduit: null, awg: null, long: null },
  },
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
}, null, 2);

const FP = 0.9;

const Z_PCT_BY_KVA = {
  "45": 4, "75": 4, "112.5": 4.5,
  "150": 6, "250": 6, "500": 6, "630": 6,
};

function transformJsonInput(input) {
  const busVoltageV  = parseFloat(String(input.systemVoltage));
  const busVoltageKV = busVoltageV / 1000;

  const grid = {
    kV:    input.networkOperator.tesion,
    Icc:   input.networkOperator.Icc,
    kVAcc: 0,
  };

  const netFeeder = input.networkOperator.feeder;
  const trFeeder  = input.mainSource.feeder;

  const sources = [{
    id: 1, type: "transformer", label: "TR",
    kVA:   input.mainSource.kva,
    kVpri: input.networkOperator.tesion,
    kVsec: busVoltageKV,
    zPct:  input.mainSource.zPct ?? Z_PCT_BY_KVA[String(input.mainSource.kva)] ?? 6,
    xdpp:  0.17,
    inCable: {
      enabled:  true,
      type:     netFeeder.type,
      gauge:    String(netFeeder.awg),
      material: netFeeder.material,
      canal:    netFeeder.conduit,
      len:      netFeeder.long,
    },
    outCable: {
      enabled:  true,
      type:     trFeeder.type,
      gauge:    String(trFeeder.awg),
      material: trFeeder.material,
      canal:    trFeeder.conduit,
      len:      trFeeder.long,
    },
  }];

  if (input.generator?.kva != null) {
    const gf = input.generator.feeder;
    sources.push({
      id: 2, type: "generator", label: "GEN",
      kVA:   input.generator.kva,
      kVpri: busVoltageKV,
      kVsec: busVoltageKV,
      zPct:  4.5,
      xdpp:  0.17,
      inCable:  { enabled: false, type: "BT600", gauge: "2/0", material: "Cobre", canal: "PVC", len: 50 },
      outCable: gf?.awg != null
        ? { enabled: true, type: gf.type, gauge: String(gf.awg), material: gf.material, canal: gf.conduit, len: gf.long }
        : { enabled: false, type: "BT600", gauge: "2/0", material: "Cobre", canal: "PVC", len: 50 },
    });
  }

  const loads = input.circuits
    .filter(c => c.active)
    .map((circuit, index) => {
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
          type:     circuit.awgType,
          gauge:    String(circuit.awg),
          material: circuit.material,
          canal:    circuit.conduit,
          len:      parseFloat(circuit.long),
        },
      };
    });

  return { grid, sources, loads, busVoltageKV };
}

function runCalc(data) {
  const { grid, sources, loads } = data;
  const hasGridData = grid.kV != null && grid.kV > 0 && grid.Icc != null && grid.Icc > 0;
  const gridKVAcc = hasGridData
    ? (grid.kVAcc > 0 ? grid.kVAcc : Math.sqrt(3) * grid.kV * (grid.Icc * 1000))
    : 0;

  let upstreamKVAcc = 0;
  let generatorBusKVAcc = 0;
  const srcResults = sources.map(source => {
    const equipmentKVAcc = source.type === "transformer"
      ? source.kVA / (source.zPct / 100)
      : source.kVA / source.xdpp;

    let inCableKVAcc = null;
    let kVAccAtSourceInput = gridKVAcc;
    if (source.type !== "generator" && source.inCable.enabled && hasGridData) {
      inCableKVAcc       = cableKVA(grid.kV, getZ(source.inCable.type, source.inCable.gauge, source.inCable.material, source.inCable.canal), source.inCable.len);
      kVAccAtSourceInput = series(gridKVAcc, inCableKVAcc);
    }

    // Sin datos de red, el transformador es el único limitante (red tratada como bus infinito)
    const kVAccPassingThrough = source.type === "generator"
      ? equipmentKVAcc
      : (hasGridData ? series(kVAccAtSourceInput, equipmentKVAcc) : equipmentKVAcc);

    let outCableKVAcc = null;
    let kVAccAtSourceOutput = kVAccPassingThrough;
    if (source.outCable.enabled) {
      outCableKVAcc       = cableKVA(source.kVsec, getZ(source.outCable.type, source.outCable.gauge, source.outCable.material, source.outCable.canal), source.outCable.len);
      kVAccAtSourceOutput = series(kVAccPassingThrough, outCableKVAcc);
    }

    if (source.type === "generator") generatorBusKVAcc += kVAccAtSourceOutput;
    else upstreamKVAcc += kVAccAtSourceOutput;
    return { ...source, equipmentKVAcc, inCableKVAcc, kVAccAtSourceInput, kVAccPassingThrough, outCableKVAcc, kVAccAtSourceOutput };
  });

  const busVoltageKV = data.busVoltageKV ?? sources[0]?.kVsec ?? 0.48;

  let downstreamKVAcc = generatorBusKVAcc;
  const loadResults = loads.map(load => {
    const loadVoltageKV = load.voltageKV ?? busVoltageKV;

    if (load.loadType === "resistive") {
      let cableKVAcc = null;
      if (load.cable.enabled) {
        cableKVAcc = cableKVA(loadVoltageKV, getZ(load.cable.type, load.cable.gauge, load.cable.material, load.cable.canal), load.cable.len);
      }
      return { ...load, cableKVAcc, kVAccContributionToBus: 0, motorKVAcc: null, xdpp: null };
    }

    const xdpp       = load.hp >= 50 ? 0.17 : 0.20;
    const motorKVAcc = load.hp / xdpp;
    let kVAccContributionToBus = motorKVAcc, cableKVAcc = null;
    if (load.cable.enabled) {
      cableKVAcc             = cableKVA(loadVoltageKV, getZ(load.cable.type, load.cable.gauge, load.cable.material, load.cable.canal), load.cable.len);
      kVAccContributionToBus = series(motorKVAcc, cableKVAcc);
    }
    downstreamKVAcc += kVAccContributionToBus;
    return { ...load, xdpp, motorKVAcc, cableKVAcc, kVAccContributionToBus };
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

export function useIccCalc() {
  const [jsonText,  setJsonText]  = useState(DEFAULT_JSON);
  const [jsonError, setJsonError] = useState(null);
  const [data,      setData]      = useState(null);
  const [view,      setView]      = useState("json");
  const [result,    setResult]    = useState(null);
  const canvasRef                 = useRef(null);

  const parseAndCalculate = () => {
    try {
      const parsed          = JSON.parse(jsonText);
      const transformedData = transformJsonInput(parsed);
      const calcResult      = runCalc(transformedData);
      setData(transformedData);
      setResult(calcResult);
      setJsonError(null);
      setView("results");
    } catch (e) {
      setJsonError(e.message);
    }
  };

  useEffect(() => {
    if (view === "results" && result && data && canvasRef.current) {
      const canvasElement  = canvasRef.current;
      const loadCount      = result.loadResults.length;
      const sourceCount    = result.srcResults.length;
      canvasElement.width  = Math.max(560, 120 + loadCount * 140 + sourceCount * 230);

      const hasMediumVoltageCable = data.sources[0]?.inCable?.enabled  ? 1 : 0;
      const hasLowVoltageCable    = data.sources[0]?.outCable?.enabled ? 1 : 0;
      const hasLoadCable          = data.loads[0]?.cable?.enabled      ? 1 : 0;
      const baseCanvasHeight      = 300 + hasMediumVoltageCable * 80 + hasLowVoltageCable * 80 + hasLoadCable * 80 + 200;
      canvasElement.height        = Math.max(820, baseCanvasHeight);

      drawDiagram(canvasElement, data, result);
    }
  }, [view, result, data]);

  return { jsonText, setJsonText, jsonError, data, view, setView, result, canvasRef, parseAndCalculate };
}
