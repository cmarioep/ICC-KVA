import { useState, useRef, useEffect } from "react";
import { getZ, series, cableKVA } from "../utils/cableUtils";
import { drawDiagram } from "../utils/diagram";

const createDefaultCable = () => ({
  enabled: false, type: "BT600", gauge: "2/0", material: "Cobre", canal: "PVC", len: 50,
});

const createDefaultSource = (id) => ({
  id, type: "transformer", label: `Trafo ${id}`,
  kVA: 150, kVpri: 13.2, kVsec: 0.208, zPct: 4.5, xdpp: 0.17,
  inCable: createDefaultCable(), outCable: createDefaultCable(),
});

const createDefaultLoad = (id) => ({
  id, label: `Motor ${id}`, hp: 50,
  cable: { enabled: true, type: "BT600", gauge: "2/0", material: "Cobre", canal: "PVC", len: 50 },
});

const createInitialData = () => ({
  grid: { kV: 13.2, Icc: 10, kVAcc: 0 },
  sources: [{
    id: 1, type: "transformer", label: "TR",
    kVA: 630, kVpri: 13.2, kVsec: 0.208, zPct: 6, xdpp: 0.17,
    inCable:  { enabled: true, type: "MT15",  gauge: "1/0", material: "Cobre", canal: "PVC", len: 50 },
    outCable: { enabled: true, type: "BT600", gauge: "500", material: "Cobre", canal: "PVC", len: 50 },
  }],
  loads: [{
    id: 1, label: "BOMBA", hp: 3,
    cable: { enabled: true, type: "BT600", gauge: "8", material: "Cobre", canal: "PVC", len: 25 },
  }],
});

function runCalc(data) {
  const { grid, sources, loads } = data;
  // √3 × kV × Icc(A) = kVA — usuario ingresa kA, se convierte a A multiplicando ×1000
  const gridKVAcc = grid.kVAcc > 0 ? grid.kVAcc : Math.sqrt(3) * grid.kV * (grid.Icc * 1000);

  let upstreamKVAcc = 0;
  const srcResults = sources.map(source => {
    const equipmentKVAcc = source.type === "transformer"
      ? source.kVA / (source.zPct / 100)
      : source.kVA / source.xdpp;

    let inCableKVAcc = null;
    let kVAccAtSourceInput = gridKVAcc;
    if (source.type !== "generator" && source.inCable.enabled) {
      inCableKVAcc      = cableKVA(grid.kV, getZ(source.inCable.type, source.inCable.gauge, source.inCable.material, source.inCable.canal), source.inCable.len);
      kVAccAtSourceInput = series(gridKVAcc, inCableKVAcc);
    }

    // Generator is an independent source — not in series with the grid
    const kVAccPassingThrough = source.type === "generator"
      ? equipmentKVAcc
      : series(kVAccAtSourceInput, equipmentKVAcc);

    let outCableKVAcc = null;
    let kVAccAtSourceOutput = kVAccPassingThrough;
    if (source.outCable.enabled) {
      outCableKVAcc       = cableKVA(source.kVsec, getZ(source.outCable.type, source.outCable.gauge, source.outCable.material, source.outCable.canal), source.outCable.len);
      kVAccAtSourceOutput = series(kVAccPassingThrough, outCableKVAcc);
    }

    upstreamKVAcc += kVAccAtSourceOutput;
    return { ...source, equipmentKVAcc, inCableKVAcc, kVAccAtSourceInput, kVAccPassingThrough, outCableKVAcc, kVAccAtSourceOutput };
  });

  const busVoltageKV = sources[0]?.kVsec ?? 0.48;

  let downstreamKVAcc = 0;
  const loadResults = loads.map(load => {
    const xdpp         = load.hp >= 50 ? 0.17 : 0.20;
    const motorKVAcc   = load.hp / xdpp;
    let kVAccContributionToBus = motorKVAcc, cableKVAcc = null;
    if (load.cable.enabled) {
      cableKVAcc              = cableKVA(busVoltageKV, getZ(load.cable.type, load.cable.gauge, load.cable.material, load.cable.canal), load.cable.len);
      kVAccContributionToBus  = series(motorKVAcc, cableKVAcc);
    }
    downstreamKVAcc += kVAccContributionToBus;
    return { ...load, xdpp, motorKVAcc, cableKVAcc, kVAccContributionToBus };
  });

  const busKVAcc                   = upstreamKVAcc + downstreamKVAcc;
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
  const [data, setData]     = useState(createInitialData());
  const [view, setView]     = useState("form");
  const [result, setResult] = useState(null);
  const canvasRef           = useRef(null);

  const updateField = (path, value) => setData(prevData => {
    const updatedData  = JSON.parse(JSON.stringify(prevData));
    const pathSegments = path.split(".");
    let node = updatedData;
    pathSegments.slice(0, -1).forEach(segment => {
      node = segment.match(/^\d+$/) ? node[+segment] : node[segment];
    });
    const leafKey = pathSegments[pathSegments.length - 1];
    if (leafKey.match(/^\d+$/)) node[+leafKey] = value; else node[leafKey] = value;
    return updatedData;
  });

  const addSource    = () => setData(prevData => ({ ...prevData, sources: [...prevData.sources, createDefaultSource(prevData.sources.length + 1)] }));
  const removeSource = (id) => setData(prevData => ({ ...prevData, sources: prevData.sources.filter(source => source.id !== id) }));
  const addLoad      = () => setData(prevData => ({ ...prevData, loads: [...prevData.loads, createDefaultLoad(prevData.loads.length + 1)] }));
  const removeLoad   = (id) => setData(prevData => ({ ...prevData, loads: prevData.loads.filter(load => load.id !== id) }));

  const calculate = () => {
    const calculationResult = runCalc(data);
    setResult(calculationResult);
    setView("results");
  };

  useEffect(() => {
    if (view === "results" && result && canvasRef.current) {
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

  return { data, view, setView, result, canvasRef, updateField, addSource, removeSource, addLoad, removeLoad, calculate };
}
