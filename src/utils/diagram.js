import { series } from "./cableUtils";

export function drawDiagram(canvas, data, res) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.setLineDash([]);

  const { srcResults, loadResults, busKVAcc, gridKVAcc } = res;
  const kVbus = srcResults[0]?.kVsec ?? 0.208;
  const factor = kVbus < 0.6 ? 1.25 : 1.6;

  const BLUE   = "#1a3a6e";
  const LINE_W = 2;

  // ── Primitives ──────────────────────────────────────────────────────────────

  function line(x1, y1, x2, y2, lw, clr) {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.strokeStyle = clr; ctx.lineWidth = lw;
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  const vl = (x, y1, y2, lw = LINE_W, clr = BLUE) => line(x, y1, x, y2, lw, clr);
  const hl = (x1, x2, y, lw = LINE_W, clr = BLUE) => line(x1, y, x2, y, lw, clr);

  function tx(t, x, y, sz = 11, clr = "#222", al = "left", bold = false) {
    ctx.setLineDash([]);
    ctx.font = `${bold ? "bold " : ""}${sz}px Arial,sans-serif`;
    ctx.fillStyle = clr; ctx.textAlign = al;
    ctx.fillText(t, x, y);
  }

  // "kVA" + small "cc" subscript + rest
  function txKVAcc(rest, x, y, sz = 11, clr = "#222", bold = false) {
    const b = bold ? "bold " : "";
    ctx.setLineDash([]);
    ctx.fillStyle = clr; ctx.textAlign = "left";
    ctx.font = `${b}${sz}px Arial,sans-serif`;
    ctx.fillText("kVA", x, y);
    const w1 = ctx.measureText("kVA").width;
    ctx.font = `${b}${sz - 2}px Arial,sans-serif`;
    ctx.fillText("cc", x + w1, y + 2);
    const w2 = ctx.measureText("cc").width;
    ctx.font = `${b}${sz}px Arial,sans-serif`;
    ctx.fillText(rest, x + w1 + w2, y);
  }

  // Red right-pointing arrow; tipX = arrowhead tip
  function arrowR(tipX, y, len = 38) {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.strokeStyle = "#cc2200"; ctx.lineWidth = 1.5;
    ctx.moveTo(tipX - len, y); ctx.lineTo(tipX - 3, y);
    ctx.stroke();
    ctx.beginPath(); ctx.fillStyle = "#cc2200";
    ctx.moveTo(tipX, y);
    ctx.lineTo(tipX - 8, y - 4);
    ctx.lineTo(tipX - 8, y + 4);
    ctx.closePath(); ctx.fill();
  }

  // Flow pair: upper kVA line (with arrow), lower kVA line
  // All text left-aligned at a fixed margin left of lineX; arrow tip at lineX-10
  function flowPair(lineX, y, above, below) {
    const labelX  = lineX - 160;
    const arrowTip = lineX - 10;
    tx(above.toFixed(2) + " kVA", labelX, y - 4, 10, "#111");
    arrowR(arrowTip, y - 4);
    tx(below.toFixed(2) + " kVA", labelX, y + 12, 10, "#555");
  }

  // Grey impedance box centred on the conductor.
  // Drawing order: grey fill → black border → blue line redrawn through interior
  // so the line visually passes through the box with no break.
  function impBox(x, y, label) {
    ctx.setLineDash([]);
    ctx.fillStyle = "#c0c0c0";
    ctx.fillRect(x - 9, y - 11, 18, 22);
    ctx.strokeStyle = "#444"; ctx.lineWidth = 1;
    ctx.strokeRect(x - 9, y - 11, 18, 22);
    // restore the blue line through the box
    vl(x, y - 11, y + 11);
    // label: right-aligned just left of box
    ctx.font = "9px Arial,sans-serif";
    ctx.fillStyle = "#444"; ctx.textAlign = "right";
    ctx.fillText("(" + label + " kVA)", x - 13, y + 4);
  }

  // Two interlocked circles.
  // A white rectangle masks the line behind the transformer before drawing circles.
  function trafo(cx, cy) {
    const r = 22;
    ctx.setLineDash([]);
    // white mask covering the full extent of both circles + small margin
    ctx.fillStyle = "#fff";
    ctx.fillRect(cx - r - 4, cy - r * 1.6, (r + 4) * 2, r * 3.2);
    // upper circle
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.6, r, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = "#333"; ctx.lineWidth = 2; ctx.stroke();
    // lower circle
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.6, r, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = "#333"; ctx.lineWidth = 2; ctx.stroke();
  }

  // Downward-pointing grey triangle (utility / grid symbol)
  function triangle(cx, cy) {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cx, cy + 40); ctx.lineTo(cx - 24, cy); ctx.lineTo(cx + 24, cy);
    ctx.closePath();
    ctx.fillStyle = "#999"; ctx.fill();
    ctx.strokeStyle = "#555"; ctx.lineWidth = 1.5; ctx.stroke();
  }

  // Plain white circle with bold label below (load symbol)
  function loadCircle(cx, cy, lbl) {
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = "#333"; ctx.lineWidth = 2; ctx.stroke();
    tx(lbl, cx, cy + 38, 10, "#111", "center", true);
  }

  // Thick black bus bar
  function busBar(x1, x2, y) {
    ctx.setLineDash([]);
    ctx.fillStyle = "#111";
    ctx.fillRect(x1, y - 4, x2 - x1, 8);
  }

  // ── Canvas geometry ──────────────────────────────────────────────────────────

  const NL       = loadResults.length;
  const LD_SP    = Math.max(110, Math.min(150, (W - 120) / Math.max(NL, 1)));
  const BUS_HALF = Math.max(180, NL * LD_SP / 2 + 40);
  const CX       = Math.max(W / 2, BUS_HALF + 60);

  let y = 30;
  tx("DIAGRAMA DE kVA's DE CORTOCIRCUITO EQUIVALENTES", W / 2, y, 14, "#111", "center", true);
  y += 24;

  ctx.setLineDash([]);
  ctx.strokeStyle = "#aaa"; ctx.lineWidth = 0.8;
  ctx.strokeRect(CX - 130, y, 260, 24);
  ctx.fillStyle = "#fff"; ctx.fillRect(CX - 130, y, 260, 24);
  tx(`Nivel de Tensión:  ${data.grid.kV} kV  /  ${kVbus} kV`, CX, y + 16, 11, "#333", "center");
  y += 38;

  // ── Source sections ──────────────────────────────────────────────────────────

  srcResults.forEach((src, si) => {
    const cx    = CX + si * 380;
    const infoX = cx + 44;
    const iccX  = cx + 50;   // consistent right-side column for Icc values

    // downstream kVAcc reflected through the network
    const dsc_at_bus       = res.downstreamKVAcc;
    const dsc_below_trafo  = src.outCableKVAcc != null
      ? series(dsc_at_bus, src.outCableKVAcc) : dsc_at_bus;
    const dsc_below_incable = series(dsc_below_trafo, src.srcKVAcc);
    const dsc_at_grid       = src.inCableKVAcc != null
      ? series(dsc_below_incable, src.inCableKVAcc) : dsc_below_incable;

    // ── Layout pass: compute every Y position without drawing anything ──────
    // SEG = desired visible conductor length between any two adjacent components.
    // Each position is computed as: prev_component_bottom + SEG + half_of_next_component.
    // Flow pair text spans fp_Y-4 (top) to fp_Y+12 (bottom), so:
    //   fp_Y = prev_bottom + SEG + 4   (top of text = prev_bottom + SEG)
    //   next_top = fp_Y + 12 + SEG

    const SEG = 22;

    const triangleY  = y;
    const lineStartY = y + 40;                       // line starts at triangle tip

    const fp1Y = lineStartY + SEG + 4;               // top of fp1 text = lineStartY + SEG

    let inCableBoxY = null, fp2Y = null;
    if (src.inCable?.enabled && src.inCableKVAcc) {
      inCableBoxY = fp1Y + 12 + SEG + 11;            // box top  = fp1 bottom + SEG
      fp2Y        = inCableBoxY + 11 + SEG + 4;      // fp2 top  = box bottom + SEG
    }

    const fp_pre_trafo = fp2Y ?? fp1Y;
    const trafoY       = fp_pre_trafo + 12 + SEG + 35; // trafo top = fp bottom + SEG

    const fp3Y = trafoY + 35 + SEG + 4;              // fp3 top  = trafo bottom + SEG

    let outCableBoxY = null, fp4Y = null;
    if (src.outCable?.enabled && src.outCableKVAcc) {
      outCableBoxY = fp3Y + 12 + SEG + 11;
      fp4Y         = outCableBoxY + 11 + SEG + 4;
    }

    const fp_pre_bus = fp4Y ?? fp3Y;
    const busY       = fp_pre_bus + 12 + SEG + 4;   // bus top  = fp bottom + SEG
    const lineEndY   = busY;

    // ── Render pass (strict layering order) ─────────────────────────────────

    // 1. Full continuous blue line — drawn once, no gaps
    vl(cx, lineStartY, lineEndY);

    // 2. Symbols on top of line (they mask or redraw the line as needed)
    triangle(cx, triangleY);

    if (inCableBoxY !== null) impBox(cx, inCableBoxY, src.inCableKVAcc.toFixed(2));

    trafo(cx, trafoY);

    if (outCableBoxY !== null) impBox(cx, outCableBoxY, src.outCableKVAcc.toFixed(2));

    busBar(cx - BUS_HALF, cx + BUS_HALF, busY);

    // 3. Right-side technical data
    tx(`Un: ${data.grid.kV} kV`,           infoX, triangleY + 4,  11, "#222");
    tx(`Icc: ${data.grid.Icc.toFixed(1)} kA`, infoX, triangleY + 18, 11, "#222");
    txKVAcc(`: ${gridKVAcc.toFixed(1)} kVA`,  infoX, triangleY + 32, 11, "#c00", true);

    if (src.type === "transformer") {
      tx(`kVA:  ${src.kVA}`,          infoX, trafoY - 28, 11, "#222");
      tx(`Un:  ${src.kVsec} kV`,      infoX, trafoY - 14, 11, "#222");
      tx(`Z%:  ${src.zPct}%`,         infoX, trafoY,      11, "#222");
      txKVAcc(`:  (${src.srcKVAcc.toFixed(2)} kVA)`, infoX, trafoY + 14, 11, "#c00");
    } else {
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(cx, trafoY, 24, 0, Math.PI * 2);
      ctx.fillStyle = "#fff"; ctx.fill();
      ctx.strokeStyle = "#1a6e1a"; ctx.lineWidth = 2; ctx.stroke();
      tx("G", cx, trafoY + 6, 16, "#1a6e1a", "center", true);
      tx(`kVA: ${src.kVA}`,  infoX, trafoY - 16, 11, "#222");
      tx(`X'': ${src.xdpp}`, infoX, trafoY - 2,  11, "#222");
      txKVAcc(`: (${src.srcKVAcc.toFixed(2)} kVA)`, infoX, trafoY + 12, 11, "#c00");
    }

    // 4. Flow pair labels (left side) — same left margin via flowPair()
    flowPair(cx, fp1Y, gridKVAcc, dsc_at_grid);
    if (fp2Y !== null) flowPair(cx, fp2Y, src.inKVAcc, dsc_below_incable);
    flowPair(cx, fp3Y, src.kVAcc_through, dsc_below_trafo);

    // 5. Icc label just above the bus bar (right side, consistent column)
    if (fp4Y !== null) flowPair(cx, fp4Y, src.outKVAcc, dsc_at_bus);
    const Icc_bus = busKVAcc / (Math.sqrt(3) * kVbus);
    tx(`Icc:  ${Icc_bus.toFixed(3)}`, iccX, busY - 16, 11, "#333");

    y = busY;

    // ── Load branches ────────────────────────────────────────────────────────

    const ldStartX = cx - ((NL - 1) * LD_SP) / 2;

    loadResults.forEach((ld, li) => {
      const lx = ldStartX + li * LD_SP;
      if (lx !== cx) hl(lx, cx, busY);

      const busAbove = busKVAcc - ld.tobus;

      // Load layout pass — same SEG logic as source section
      const ldFp1Y = busY + 4 + SEG + 4;             // bus bottom = busY+4; top of ldFp1 = bus bottom + SEG

      let ldCableBoxY = null, ldFp2Y = null;
      if (ld.cable?.enabled && ld.cableKVAcc) {
        ldCableBoxY = ldFp1Y + 12 + SEG + 11;
        ldFp2Y      = ldCableBoxY + 11 + SEG + 4;
      }

      const fp_pre_circle = ldFp2Y ?? ldFp1Y;
      const ldCircleY     = fp_pre_circle + 12 + SEG + 24; // circle top = fp bottom + SEG
      const ldLineEndY    = ldCircleY;                      // line to circle center; white fill masks interior

      // 1. Full continuous load line
      vl(lx, busY + 4, ldLineEndY);

      // 2. Symbols on top
      if (ldCableBoxY !== null) impBox(lx, ldCableBoxY, ld.cableKVAcc.toFixed(2));
      loadCircle(lx, ldCircleY, ld.label);

      // 3. Flow pair labels
      flowPair(lx, ldFp1Y, busAbove, ld.tobus);

      let upstream_at_terminal = busAbove;
      if (ldFp2Y !== null) {
        upstream_at_terminal = series(busAbove, ld.cableKVAcc);
        flowPair(lx, ldFp2Y, upstream_at_terminal, ld.motorKVAcc);
        const Icc_m = (upstream_at_terminal + ld.motorKVAcc) / (Math.sqrt(3) * kVbus);
        tx(`Icc:  ${Icc_m.toFixed(2)}`, lx + 50, ldFp2Y + 4, 11, "#333");
      } else {
        const Icc_m  = (upstream_at_terminal + ld.motorKVAcc) / (Math.sqrt(3) * kVbus);
        const Iasc_m = Icc_m * factor;
        tx(`Icc: ${Icc_m.toFixed(2)}`,   lx + 30, ldCircleY - 10, 11, "#333");
        tx(`Iasc: ${Iasc_m.toFixed(2)}`, lx + 30, ldCircleY + 4,  11, "#333");
      }
    });
  });
}
