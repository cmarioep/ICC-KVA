import { series } from "./cableUtils";
import { createPrimitives } from "./diagramPrimitives";

// Unified multi-board diagram (analisisCargas.tableros.length > 1):
//   grid → transformer → main feeder → MAIN BUS
//   MAIN BUS → (per tablero) feeder → tablero bus → circuits
export function drawUnifiedDiagram(canvas, data, results) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const canvasWidth = canvas.width, canvasHeight = canvas.height;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.setLineDash([]);

  const {
    drawVerticalLine, drawText, drawTextWithKVAccSubscript, drawRightArrow,
    computeSectionTextStartX, drawImpedanceBox, drawTransformer, drawGridSymbol,
    drawResistiveLoadSymbol, drawLoadSymbol, drawBusBar,
  } = createPrimitives(ctx);

  const { grid } = data;
  const { gridKVAcc, srcResults, mainBusKVAcc, mainBusIcc, tableros } = results;
  const transformer  = srcResults[0];
  const generator    = srcResults.find(s => s.type === "generator");
  const hasGridData  = grid.kV != null && grid.kV > 0 && grid.Icc != null && grid.Icc > 0;
  const mainVoltageKV = results.busVoltageKV ?? 0.208;

  // Upstream-only label: value text to the left of the conductor + a right arrow.
  function drawUpstreamLabel(conductorX, y, kVA, textStartX) {
    drawText(kVA.toFixed(2) + " kVA", textStartX, y + 3, 10, "#111");
    drawRightArrow(conductorX - 8, y, 36);
  }

  // ── Horizontal layout: each tablero owns a slot sized to its circuit count ────
  const LOAD_SPACING = 120;
  const TABLERO_GAP  = 60;
  const tableroWidths = tableros.map(t => Math.max(180, t.loadResults.length * LOAD_SPACING));
  const totalWidth    = tableroWidths.reduce((a, b) => a + b, 0) + (tableros.length - 1) * TABLERO_GAP;

  const tableroCenters = [];
  let slotX = (canvasWidth - totalWidth) / 2;
  tableroWidths.forEach(w => {
    tableroCenters.push(slotX + w / 2);
    slotX += w + TABLERO_GAP;
  });

  const mainColX = (tableroCenters[0] + tableroCenters[tableroCenters.length - 1]) / 2;
  const genX     = mainColX + 170;

  // ── Vertical layout (absolute Y from 0, vertically centered at the end) ───────
  const SEG = 34;
  const hasPsf        = transformer.inCable?.enabled && transformer.inCableKVAcc != null && hasGridData;
  const hasMainFeeder = transformer.outCable?.enabled && transformer.outCableKVAcc != null;
  const anyFeeder     = tableros.some(t => t.feeder?.enabled && t.feederKVAcc != null);

  const gridY = hasGridData ? 0 : null;
  const conductorTopY = hasGridData ? 40 : 0;
  let cursorY = conductorTopY;

  let psfBoxY = null;
  if (hasPsf) { cursorY += SEG; psfBoxY = cursorY; cursorY += 11; }

  cursorY += SEG + 22;
  const trafoY = cursorY;
  cursorY += 35;

  let mainFeederBoxY = null;
  if (hasMainFeeder) { cursorY += SEG; mainFeederBoxY = cursorY; cursorY += 11; }

  const mainBusY = cursorY + SEG;

  let feederBoxY = null;
  let tableroBusY = mainBusY + SEG;
  if (anyFeeder) { feederBoxY = mainBusY + SEG; tableroBusY = feederBoxY + 11 + SEG; }

  const circuitBoxY    = tableroBusY + SEG;
  const circuitSymbolY = circuitBoxY + 11 + SEG + 24;

  const hasMotor      = tableros.some(t => t.loadResults.some(l => l.loadType === "inducción"));
  const contentBottom = circuitSymbolY + (hasMotor ? 86 : 66);
  const contentTopY   = hasGridData ? 0 : trafoY - 35;
  const contentHeight = contentBottom - contentTopY;
  const verticalOffset = Math.round((canvasHeight - contentHeight) / 2) - contentTopY;

  ctx.save();
  ctx.translate(0, verticalOffset);

  // ── Main column: grid → transformer → main feeder → main bus ─────────────────
  const mainLabelTexts = [gridKVAcc.toFixed(2) + " kVA", mainBusKVAcc.toFixed(2) + " kVA"];
  if (hasPsf)        mainLabelTexts.push(transformer.kVAccAtSourceInput.toFixed(2) + " kVA");
  if (hasMainFeeder) mainLabelTexts.push(transformer.kVAccPassingThrough.toFixed(2) + " kVA");
  const mainTextStartX = computeSectionTextStartX(mainColX, mainLabelTexts);
  const sourceLabelX   = mainColX + 44;

  drawVerticalLine(mainColX, conductorTopY, mainBusY);
  if (hasGridData) drawGridSymbol(mainColX, gridY);
  if (psfBoxY !== null) drawImpedanceBox(mainColX, psfBoxY, transformer.inCableKVAcc.toFixed(2), mainTextStartX);
  drawTransformer(mainColX, trafoY);
  if (mainFeederBoxY !== null) drawImpedanceBox(mainColX, mainFeederBoxY, transformer.outCableKVAcc.toFixed(2), mainTextStartX);

  // Right-side technical data
  if (hasGridData) {
    drawText(`Un: ${grid.kV ?? "--"} kV`, sourceLabelX, gridY + 4, 11, "#222");
    drawText(`Icc: ${grid.Icc != null ? grid.Icc.toFixed(1) : "--"} kA`, sourceLabelX, gridY + 18, 11, "#222");
    drawTextWithKVAccSubscript(`: ${gridKVAcc.toFixed(1)} kVA`, sourceLabelX, gridY + 32, 11, "#c00", true);
  }
  drawText(`kVA:  ${transformer.kVA}`,     sourceLabelX, trafoY - 28, 11, "#222");
  drawText(`Un:  ${transformer.kVsec} kV`, sourceLabelX, trafoY - 14, 11, "#222");
  drawText(`Z%:  ${transformer.zPct}%`,    sourceLabelX, trafoY,      11, "#222");
  drawTextWithKVAccSubscript(`:  (${transformer.equipmentKVAcc.toFixed(2)} kVA)`, sourceLabelX, trafoY + 14, 11, "#c00");

  // Generator (optional) — second source landing on the main bus
  if (generator) {
    drawVerticalLine(genX, trafoY - 24, mainBusY);
    ctx.beginPath(); ctx.arc(genX, trafoY, 24, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = "#1a6e1a"; ctx.lineWidth = 2; ctx.stroke();
    drawText("G", genX, trafoY + 6, 16, "#1a6e1a", "center", true);
    drawText(`kVA: ${generator.kVA}`, genX + 30, trafoY - 4, 11, "#222");
    drawTextWithKVAccSubscript(`: (${generator.kVAccAtSourceOutput.toFixed(2)} kVA)`, genX + 30, trafoY + 12, 11, "#c00");
  }

  // ── Main bus bar ─────────────────────────────────────────────────────────────
  const busLeftX  = Math.min(mainColX, tableroCenters[0]) - 40;
  const busRightX = Math.max(generator ? genX : mainColX, tableroCenters[tableroCenters.length - 1]) + 40;
  drawBusBar(busLeftX, busRightX, mainBusY);
  drawText("BARRA PRINCIPAL", busLeftX, mainBusY - 12, 11, "#111", "left", true);
  drawText(`kVAcc: ${mainBusKVAcc.toFixed(1)}  |  Icc: ${mainBusIcc.toFixed(1)} A`, busRightX, mainBusY - 12, 10, "#c00", "right");

  // ── Per-tablero branches ─────────────────────────────────────────────────────
  tableros.forEach((tablero, i) => {
    const colX = tableroCenters[i];
    const busVoltageKV = tablero.busVoltageKV ?? mainVoltageKV;

    // Drop from main bus → feeder box → tablero bus
    drawVerticalLine(colX, mainBusY, tableroBusY);
    const feederTextStartX = computeSectionTextStartX(colX, [tablero.upstreamAtBus.toFixed(2) + " kVA"]);
    if (feederBoxY !== null && tablero.feeder?.enabled && tablero.feederKVAcc != null) {
      drawImpedanceBox(colX, feederBoxY, tablero.feederKVAcc.toFixed(2), feederTextStartX);
      drawUpstreamLabel(colX, feederBoxY - 20, tablero.upstreamAtBus, feederTextStartX);
    }

    // Tablero bus bar (spans its own circuits)
    const loadCount   = tablero.loadResults.length;
    const halfWidth   = Math.max(70, ((loadCount - 1) * LOAD_SPACING) / 2 + 36);
    const tBusLeftX   = colX - halfWidth;
    const tBusRightX  = colX + halfWidth;
    drawBusBar(tBusLeftX, tBusRightX, tableroBusY);
    drawText(tablero.name, tBusLeftX, tableroBusY - 12, 11, "#111", "left", true);
    drawText(`Icc: ${tablero.symmetricShortCircuitCurrent.toFixed(1)} A`, tBusRightX, tableroBusY - 12, 10, "#c00", "right");

    // Circuits hanging off the tablero bus
    const firstLoadX = colX - ((loadCount - 1) * LOAD_SPACING) / 2;
    tablero.loadResults.forEach((load, li) => {
      const loadX = firstLoadX + li * LOAD_SPACING;
      const loadVoltageKV    = load.voltageKV ?? busVoltageKV;
      const terminalUpstream = load.cableKVAcc ? series(tablero.upstreamAtBus, load.cableKVAcc) : tablero.upstreamAtBus;

      drawVerticalLine(loadX, tableroBusY, circuitSymbolY);
      if (load.cable?.enabled && load.cableKVAcc != null) {
        const boxTextStartX = computeSectionTextStartX(loadX, [load.cableKVAcc.toFixed(2) + " kVA"]);
        drawImpedanceBox(loadX, circuitBoxY, load.cableKVAcc.toFixed(2), boxTextStartX);
      }

      if (load.loadType === "resistive") {
        drawResistiveLoadSymbol(loadX, circuitSymbolY, load.label);
        const iccTerminal = terminalUpstream / (Math.sqrt(3) * loadVoltageKV);
        drawText(`Icc: ${iccTerminal.toFixed(1)} A`, loadX, circuitSymbolY + 52, 10, "#333", "center");
      } else {
        drawLoadSymbol(loadX, circuitSymbolY, load.label);
        const iccTerminal = (terminalUpstream + load.motorKVAcc) / (Math.sqrt(3) * loadVoltageKV);
        drawText(`Icc: ${iccTerminal.toFixed(1)} A`, loadX, circuitSymbolY + 52, 10, "#333", "center");
        drawText(`HP: ${load.hp.toFixed(1)}`, loadX, circuitSymbolY + 66, 10, "#1a6e1a", "center");
      }
    });
  });

  ctx.restore();
}
