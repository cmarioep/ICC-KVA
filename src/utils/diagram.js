import { series } from "./cableUtils";

export function drawDiagram(canvas, data, res) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#f8f9fa"; ctx.fillRect(0, 0, W, H);

  const { srcResults, loadResults, busKVAcc, gridKVAcc } = res;
  const kVbus = srcResults[0]?.kVsec ?? 0.208;
  const factor = kVbus < 0.6 ? 1.25 : 1.6;

  function vl(x, y1, y2, lw = 1.5, clr = "#444") {
    ctx.beginPath(); ctx.strokeStyle = clr; ctx.lineWidth = lw; ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
  }
  function hl(x1, x2, y, lw = 1.5, clr = "#444") {
    ctx.beginPath(); ctx.strokeStyle = clr; ctx.lineWidth = lw; ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  }
  function tx(t, x, y, sz = 11, clr = "#222", al = "left", bold = false) {
    ctx.font = `${bold ? "bold " : ""}${sz}px Arial,sans-serif`;
    ctx.fillStyle = clr; ctx.textAlign = al; ctx.fillText(t, x, y);
  }
  function arrowR(x, y, len = 30) {
    ctx.beginPath(); ctx.strokeStyle = "#cc2200"; ctx.lineWidth = 1.5;
    ctx.moveTo(x - len, y); ctx.lineTo(x - 2, y); ctx.stroke();
    ctx.beginPath(); ctx.fillStyle = "#cc2200";
    ctx.moveTo(x, y); ctx.lineTo(x - 9, y - 5); ctx.lineTo(x - 9, y + 5); ctx.closePath(); ctx.fill();
  }
  function flowPair(cx, y, above, below, arrowX = cx + 80) {
    tx(above.toFixed(2) + " kVA", cx - 95, y - 4, 10, "#111");
    arrowR(arrowX, y - 4);
    tx(below.toFixed(2) + " kVA", cx - 95, y + 12, 10, "#555");
  }
  function impBox(x, y, label) {
    ctx.fillStyle = "#ccc"; ctx.fillRect(x - 9, y - 11, 18, 22);
    ctx.strokeStyle = "#888"; ctx.lineWidth = 0.8; ctx.strokeRect(x - 9, y - 11, 18, 22);
    tx("(" + label + " kVA)", x + 14, y + 4, 9, "#555");
  }
  function trafo(cx, cy) {
    const r = 24;
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.55, r, 0, Math.PI * 2);
    ctx.strokeStyle = "#333"; ctx.lineWidth = 2; ctx.fillStyle = "#fff"; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.55, r, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill(); ctx.stroke();
  }
  function gen(cx, cy) {
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.strokeStyle = "#1a6e1a"; ctx.lineWidth = 2; ctx.fillStyle = "#fff"; ctx.fill(); ctx.stroke();
    tx("G", cx, cy + 6, 16, "#1a6e1a", "center", true);
  }
  function triangle(cx, cy) {
    ctx.beginPath(); ctx.moveTo(cx, cy + 30); ctx.lineTo(cx - 28, cy); ctx.lineTo(cx + 28, cy); ctx.closePath();
    ctx.fillStyle = "#888"; ctx.fill(); ctx.strokeStyle = "#444"; ctx.lineWidth = 1.5; ctx.stroke();
  }
  function motor(cx, cy, lbl) {
    ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.strokeStyle = "#224"; ctx.lineWidth = 2; ctx.fillStyle = "#eef2ff"; ctx.fill(); ctx.stroke();
    tx(lbl, cx, cy + 5, 10, "#113", "center", true);
  }
  function busBar(x1, x2, y) {
    ctx.fillStyle = "#222"; ctx.fillRect(x1, y - 5, x2 - x1, 10);
  }

  const NL = loadResults.length;
  const LD_SP = Math.max(110, Math.min(150, (W - 120) / Math.max(NL, 1)));
  const BUS_HALF = Math.max(180, NL * LD_SP / 2 + 40);
  const CX = Math.max(W / 2, BUS_HALF + 60);

  let y = 30;

  tx("DIAGRAMA DE kVA's DE CORTOCIRCUITO EQUIVALENTES", W / 2, y, 14, "#111", "center", true);
  y += 24;

  ctx.strokeStyle = "#aaa"; ctx.lineWidth = 0.8;
  ctx.strokeRect(CX - 130, y, 260, 24);
  ctx.fillStyle = "#fff"; ctx.fillRect(CX - 130, y, 260, 24);
  tx(`Nivel de Tensión:  ${data.grid.kV} kV  /  ${kVbus} kV`, CX, y + 16, 11, "#333", "center");
  y += 38;

  srcResults.forEach((src, si) => {
    const cx = CX + si * 380;
    const infoX = cx + 44;

    // Downstream motor contribution reflected backwards through each network element.
    // These are the "below" values shown in each upstream flow pair.
    const dsc_at_bus = res.downstreamKVAcc;
    const dsc_below_trafo = src.outCableKVAcc != null
      ? series(dsc_at_bus, src.outCableKVAcc)
      : dsc_at_bus;
    const dsc_below_incable = series(dsc_below_trafo, src.srcKVAcc);
    const dsc_at_grid = src.inCableKVAcc != null
      ? series(dsc_below_incable, src.inCableKVAcc)
      : dsc_below_incable;

    triangle(cx, y);
    tx(`Un: ${data.grid.kV} kV`, infoX, y + 6, 11, "#222");
    tx(`Icc: ${data.grid.Icc.toFixed(1)} kA`, infoX, y + 20, 11, "#222");
    tx(`kVAcc: ${gridKVAcc.toFixed(1)} kVA`, infoX, y + 34, 11, "#c00", "left", true);
    y += 34;
    vl(cx, y, y + 14);
    y += 14;

    // above = upstream kVAcc from grid; below = motor contribution seen from here
    flowPair(cx, y + 10, gridKVAcc, dsc_at_grid);
    y += 24;
    vl(cx, y, y + 10);
    y += 10;

    if (src.inCable?.enabled && src.inCableKVAcc) {
      impBox(cx, y, src.inCableKVAcc.toFixed(2));
      vl(cx, y - 11, y + 11);
      y += 18;
      vl(cx, y, y + 10);
      y += 10;
      // above = upstream after inCable; below = motor contribution reflected through trafo+outCable
      flowPair(cx, y + 10, src.inKVAcc, dsc_below_incable);
      y += 24;
      vl(cx, y, y + 10);
      y += 10;
    }

    const symH = 54;
    const symCY = y + symH / 2;
    vl(cx, y, y + symH);
    if (src.type === "transformer") {
      trafo(cx, symCY);
      tx(`kVA: ${src.kVA}`, infoX, symCY - 30, 11, "#222");
      tx(`Un: ${src.kVsec} kV`, infoX, symCY - 16, 11, "#222");
      tx(`Z%: ${src.zPct}%`, infoX, symCY - 2, 11, "#222");
      tx(`kVAcc: (${src.srcKVAcc.toFixed(2)} kVA)`, infoX, symCY + 12, 11, "#c00");
    } else {
      gen(cx, symCY);
      tx(`kVA: ${src.kVA}`, infoX, symCY - 16, 11, "#222");
      tx(`X'': ${src.xdpp}`, infoX, symCY - 2, 11, "#222");
      tx(`kVAcc: (${src.srcKVAcc.toFixed(2)} kVA)`, infoX, symCY + 12, 11, "#c00");
    }
    y += symH + 6;

    // above = upstream through trafo; below = motor contribution reflected through outCable
    flowPair(cx, y + 10, src.kVAcc_through, dsc_below_trafo);
    y += 24;
    vl(cx, y, y + 10);
    y += 10;

    if (src.outCable?.enabled && src.outCableKVAcc) {
      impBox(cx, y, src.outCableKVAcc.toFixed(2));
      vl(cx, y - 11, y + 11);
      y += 18;
      vl(cx, y, y + 10);
      y += 10;
      // above = upstream kVAcc arriving at bus; below = motor contribution at bus
      flowPair(cx, y + 10, src.outKVAcc, dsc_at_bus);
      y += 24;
      vl(cx, y, y + 10);
      y += 10;
    }

    const busY = y + 10;
    busBar(cx - BUS_HALF, cx + BUS_HALF, busY);
    const Icc_bus = busKVAcc / (Math.sqrt(3) * kVbus);
    tx(`Icc: ${Icc_bus.toFixed(4)}`, cx + BUS_HALF + 10, busY + 4, 11, "#c00");
    y = busY;

    const ldStartX = cx - ((NL - 1) * LD_SP) / 2;
    loadResults.forEach((ld, li) => {
      const lx = ldStartX + li * LD_SP;
      if (lx !== cx) hl(lx, cx, busY, 1.5);

      let ly = busY + 5;
      // busAbove = upstream kVAcc at bus excluding this motor's contribution
      const busAbove = busKVAcc - ld.tobus;
      // above = upstream at bus; below = this motor's contribution to bus (through its cable)
      flowPair(lx, ly + 10, busAbove, ld.tobus, lx + 80);
      ly += 24;
      vl(lx, ly, ly + 10);
      ly += 10;

      // upstream kVAcc seen at motor terminals (through cable from bus)
      let upstream_at_terminal = busAbove;
      if (ld.cable?.enabled && ld.cableKVAcc) {
        impBox(lx, ly, ld.cableKVAcc.toFixed(2));
        vl(lx, ly - 11, ly + 11);
        ly += 18;
        vl(lx, ly, ly + 10);
        ly += 10;
        upstream_at_terminal = series(busAbove, ld.cableKVAcc);
        // above = upstream kVAcc at motor terminals; below = motor's own kVAcc
        flowPair(lx, ly + 10, upstream_at_terminal, ld.motorKVAcc, lx + 80);
        ly += 24;
        vl(lx, ly, ly + 10);
        ly += 10;
      }

      motor(lx, ly + 24, "");
      tx(ld.label, lx, ly + 58, 10, "#111", "center", true);
      // Total kVAcc at motor terminals = upstream through cable + motor self-contribution
      const Icc_m = (upstream_at_terminal + ld.motorKVAcc) / (Math.sqrt(3) * kVbus);
      const Iasc_m = Icc_m * factor;
      tx(`Icc: ${Icc_m.toFixed(2)}`, lx + 34, ly + 20, 11, "#333");
      tx(`Iasc: ${Iasc_m.toFixed(2)}`, lx + 34, ly + 34, 11, "#333");
    });
  });
}
