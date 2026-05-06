import { useState, useRef, useEffect } from "react";
import { getZ, series, cableKVA } from "../utils/cableUtils";
import { drawDiagram } from "../utils/diagram";

const mkC = () => ({ enabled: false, type: "BT600", gauge: "2/0", material: "Cobre", canal: "PVC", len: 50 });
const mkSrc = (id) => ({ id, type: "transformer", label: `Trafo ${id}`, kVA: 150, kVpri: 13.2, kVsec: 0.208, zPct: 4.5, xdpp: 0.17, inCable: mkC(), outCable: mkC() });
const mkLoad = (id) => ({ id, label: `Motor ${id}`, hp: 50, cable: { enabled: true, type: "BT600", gauge: "2/0", material: "Cobre", canal: "PVC", len: 50 } });

const initData = () => ({
  grid: { kV: 13.2, Icc: 10, kVAcc: 0 },
  sources: [{
    id: 1, type: "transformer", label: "TR",
    kVA: 630, kVpri: 13.2, kVsec: 0.208, zPct: 6, xdpp: 0.17,
    inCable: { enabled: true, type: "MT15", gauge: "1/0", material: "Cobre", canal: "PVC", len: 50 },
    outCable: { enabled: true, type: "BT600", gauge: "500", material: "Cobre", canal: "PVC", len: 50 },
  }],
  loads: [{
    id: 1, label: "BOMBA",
    hp: 3,
    cable: { enabled: true, type: "BT600", gauge: "8", material: "Cobre", canal: "PVC", len: 25 },
  }],
});

function runCalc(data) {
  const { grid, sources, loads } = data;
  // √3 × kV × Icc(A) = kVA — usuario ingresa kA, se convierte a A multiplicando ×1000
  const gridKVAcc = grid.kVAcc > 0 ? grid.kVAcc : Math.sqrt(3) * grid.kV * (grid.Icc * 1000);
  let upstreamKVAcc = 0;
  const srcResults = sources.map(src => {
    const srcKVAcc = src.type === "transformer" ? src.kVA / (src.zPct / 100) : src.kVA / src.xdpp;
    let inCableKVAcc = null;
    let inKVAcc = gridKVAcc;
    if (src.inCable.enabled) {
      inCableKVAcc = cableKVA(grid.kV, getZ(src.inCable.type, src.inCable.gauge, src.inCable.material, src.inCable.canal), src.inCable.len);
      inKVAcc = series(gridKVAcc, inCableKVAcc);
    }
    const kVAcc_through = series(inKVAcc, srcKVAcc);
    let outCableKVAcc = null;
    let outKVAcc = kVAcc_through;
    if (src.outCable.enabled) {
      outCableKVAcc = cableKVA(src.kVsec, getZ(src.outCable.type, src.outCable.gauge, src.outCable.material, src.outCable.canal), src.outCable.len);
      outKVAcc = series(kVAcc_through, outCableKVAcc);
    }
    upstreamKVAcc += outKVAcc;
    return { ...src, srcKVAcc, inCableKVAcc, inKVAcc, kVAcc_through, outCableKVAcc, outKVAcc };
  });
  const kVbus = sources[0]?.kVsec ?? 0.48;
  let downstreamKVAcc = 0;
  const loadResults = loads.map(ld => {
    const xdpp = ld.hp >= 50 ? 0.17 : 0.20;
    const motorKVAcc = ld.hp / xdpp;
    let tobus = motorKVAcc, cableKVAcc = null;
    if (ld.cable.enabled) {
      cableKVAcc = cableKVA(kVbus, getZ(ld.cable.type, ld.cable.gauge, ld.cable.material, ld.cable.canal), ld.cable.len);
      tobus = series(motorKVAcc, cableKVAcc);
    }
    downstreamKVAcc += tobus;
    return { ...ld, xdpp, motorKVAcc, cableKVAcc, tobus };
  });
  const busKVAcc = upstreamKVAcc + downstreamKVAcc;
  const Icc_sym = busKVAcc / (Math.sqrt(3) * kVbus);
  const factor = kVbus < 0.6 ? 1.25 : 1.6;
  return { gridKVAcc, srcResults, loadResults, upstreamKVAcc, downstreamKVAcc, busKVAcc, Icc_sym, Icc_asym: factor * Icc_sym, factor, kVbus };
}

export function useIccCalc() {
  const [data, setData] = useState(initData());
  const [view, setView] = useState("form");
  const [result, setResult] = useState(null);
  const canvasRef = useRef(null);

  const upd = (path, val) => setData(d => {
    const next = JSON.parse(JSON.stringify(d));
    const parts = path.split(".");
    let obj = next;
    parts.slice(0, -1).forEach(k => { obj = k.match(/^\d+$/) ? obj[+k] : obj[k]; });
    const last = parts[parts.length - 1];
    if (last.match(/^\d+$/)) obj[+last] = val; else obj[last] = val;
    return next;
  });

  const addSrc = () => setData(d => ({ ...d, sources: [...d.sources, mkSrc(d.sources.length + 1)] }));
  const rmSrc = (id) => setData(d => ({ ...d, sources: d.sources.filter(s => s.id !== id) }));
  const addLd = () => setData(d => ({ ...d, loads: [...d.loads, mkLoad(d.loads.length + 1)] }));
  const rmLd = (id) => setData(d => ({ ...d, loads: d.loads.filter(l => l.id !== id) }));

  const calc = () => { const r = runCalc(data); setResult(r); setView("results"); };

  useEffect(() => {
    if (view === "results" && result && canvasRef.current) {
      const cv = canvasRef.current;
      const NL = result.loadResults.length;
      const NS = result.srcResults.length;
      cv.width = Math.max(560, 120 + NL * 140 + NS * 380);
      const hasCableMT = data.sources[0]?.inCable?.enabled ? 1 : 0;
      const hasCableBT = data.sources[0]?.outCable?.enabled ? 1 : 0;
      const hasCableLoad = data.loads[0]?.cable?.enabled ? 1 : 0;
      const baseH = 300 + hasCableMT * 80 + hasCableBT * 80 + hasCableLoad * 80 + 200;
      cv.height = Math.max(820, baseH);
      drawDiagram(cv, data, result);
    }
  }, [view, result, data]);

  return { data, view, setView, result, canvasRef, upd, addSrc, rmSrc, addLd, rmLd, calc };
}
