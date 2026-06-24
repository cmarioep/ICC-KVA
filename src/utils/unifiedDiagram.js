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
    computeSectionTextStartX, drawFlowPairLabels, drawImpedanceBox, drawTransformer,
    drawGridSymbol, drawResistiveLoadSymbol, drawLoadSymbol, drawBusBar,
  } = createPrimitives(ctx);

  const { grid } = data;
  const { gridKVAcc, srcResults, mainBusKVAcc, mainBusIcc, tableros } = results;
  const transformer  = srcResults[0];
  const generator    = srcResults.find(s => s.type === "generator");
  const hasGridData  = grid.kV != null && grid.kV > 0 && grid.Icc != null && grid.Icc > 0;
  const mainVoltageKV = results.busVoltageKV ?? 0.208;

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
  // Segment lengths mirror the single-board diagram (drawDiagram) so feeders and
  // conductor runs have the same dimensions as the single-tablero case.
  const SEG = 22; // matches SEGMENT_LENGTH in drawDiagram
  const hasPsf        = transformer.inCable?.enabled && transformer.inCableKVAcc != null && hasGridData;
  const hasMainFeeder = transformer.outCable?.enabled && transformer.outCableKVAcc != null;
  const anyFeeder     = tableros.some(t => t.feeder?.enabled && t.feederKVAcc != null);

  const gridY = hasGridData ? 0 : null;
  const conductorTopY = hasGridData ? 40 : 0;
  const flowAtGridY = conductorTopY + SEG + 4;

  // grid → (PSF box) → transformer
  let psfBoxY = null;
  let trafoApproachY = flowAtGridY;
  if (hasPsf) {
    psfBoxY = flowAtGridY + 12 + SEG + 11;
    trafoApproachY = psfBoxY + 11 + SEG + 4;
  }
  const trafoY = hasGridData ? trafoApproachY + 12 + SEG + 35 : 50;
  const flowAtTrafoY = trafoY + 35 + SEG + 4;

  // transformer → (main feeder box) → main bus
  let mainFeederBoxY = null;
  let mainBusY;
  if (hasMainFeeder) {
    mainFeederBoxY = flowAtTrafoY + 12 + SEG + 11;
    const flowAfterMainFeederY = mainFeederBoxY + 11 + SEG + 4;
    mainBusY = flowAfterMainFeederY + 12 + SEG + 4;
  } else {
    mainBusY = flowAtTrafoY + 12 + SEG + 4;
  }

  // main bus → (per-tablero feeder box) → tablero bus
  const feederFlow1Y = mainBusY + 4 + SEG + 4;
  let feederBoxY = null;
  let feederFlow2Y = null;
  let tableroBusY;
  if (anyFeeder) {
    feederBoxY = feederFlow1Y + 12 + SEG + 11;
    feederFlow2Y = feederBoxY + 11 + SEG + 4;
    tableroBusY = feederFlow2Y + 12 + SEG + 4;
  } else {
    tableroBusY = feederFlow1Y + 12 + SEG + 4;
  }

  // tablero bus → (circuit box) → circuit symbol
  const circuitFlow1Y  = tableroBusY + 4 + SEG + 4;
  const circuitBoxY    = circuitFlow1Y + 12 + SEG + 11;
  const circuitFlow2Y  = circuitBoxY + 11 + SEG + 4;
  const circuitSymbolY = circuitFlow2Y + 12 + SEG + 24;

  const hasMotor      = tableros.some(t => t.loadResults.some(l => l.loadType === "inducción"));
  const contentBottom = circuitSymbolY + (hasMotor ? 86 : 66);
  const contentTopY   = hasGridData ? 0 : trafoY - 35;
  const contentHeight = contentBottom - contentTopY;
  const verticalOffset = Math.round((canvasHeight - contentHeight) / 2) - contentTopY;

  ctx.save();
  ctx.translate(0, verticalOffset);

  // ── Main column: grid → transformer → main feeder → main bus ─────────────────
  // Downstream (motor) contribution reflected toward the main bus. Board motors do
  // not change the main-bus Icc (kept upstream-only in the calc), but for visual
  // parity with the single diagram we show each board's aggregate motor kVAcc,
  // reflected up through its own feeder, summed at the bus and propagated upward.
  const downstreamAtBus = tableros.reduce((sum, t) => {
    const contrib = t.feederKVAcc != null ? series(t.downstreamKVAcc, t.feederKVAcc) : t.downstreamKVAcc;
    return sum + contrib;
  }, 0) + (generator ? generator.kVAccAtSourceOutput : 0);
  const downstreamBelowTrafo = hasMainFeeder ? series(downstreamAtBus, transformer.outCableKVAcc) : downstreamAtBus;
  const downstreamBelowPsf   = series(downstreamBelowTrafo, transformer.equipmentKVAcc);
  const downstreamAtGrid     = hasPsf ? series(downstreamBelowPsf, transformer.inCableKVAcc) : downstreamBelowPsf;

  const mainLabelTexts = [
    gridKVAcc.toFixed(2) + " kVA", downstreamAtGrid.toFixed(2) + " kVA",
    transformer.kVAccAtSourceOutput.toFixed(2) + " kVA", downstreamAtBus.toFixed(2) + " kVA",
    transformer.kVAccPassingThrough.toFixed(2) + " kVA", downstreamBelowTrafo.toFixed(2) + " kVA",
  ];
  if (hasPsf) mainLabelTexts.push(transformer.kVAccAtSourceInput.toFixed(2) + " kVA", downstreamBelowPsf.toFixed(2) + " kVA");
  const mainTextStartX = computeSectionTextStartX(mainColX, mainLabelTexts);
  const sourceLabelX   = mainColX + 44;

  drawVerticalLine(mainColX, conductorTopY, mainBusY);
  if (hasGridData) drawGridSymbol(mainColX, gridY);
  if (psfBoxY !== null) drawImpedanceBox(mainColX, psfBoxY, transformer.inCableKVAcc.toFixed(2), mainTextStartX);
  drawTransformer(mainColX, trafoY);
  if (mainFeederBoxY !== null) drawImpedanceBox(mainColX, mainFeederBoxY, transformer.outCableKVAcc.toFixed(2), mainTextStartX);

  // Flow-pair labels down the main column (upstream black, downstream grey + arrow)
  if (hasGridData) {
    drawFlowPairLabels(mainColX, flowAtGridY, gridKVAcc, downstreamAtGrid, mainTextStartX);
    if (hasPsf) drawFlowPairLabels(mainColX, trafoApproachY, transformer.kVAccAtSourceInput, downstreamBelowPsf, mainTextStartX);
  }
  drawFlowPairLabels(mainColX, flowAtTrafoY, transformer.kVAccPassingThrough, downstreamBelowTrafo, mainTextStartX);
  if (hasMainFeeder) {
    const flowAfterMainFeederY = mainFeederBoxY + 11 + SEG + 4;
    drawFlowPairLabels(mainColX, flowAfterMainFeederY, transformer.kVAccAtSourceOutput, downstreamAtBus, mainTextStartX);
  }

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
    const hasFeeder = feederBoxY !== null && tablero.feeder?.enabled && tablero.feederKVAcc != null;

    // This board's aggregate motor contribution, reflected up through its feeder
    const tableroContribToMain = hasFeeder
      ? series(tablero.downstreamKVAcc, tablero.feederKVAcc)
      : tablero.downstreamKVAcc;

    const feederLabelTexts = [
      mainBusKVAcc.toFixed(2) + " kVA", tableroContribToMain.toFixed(2) + " kVA",
      tablero.upstreamAtBus.toFixed(2) + " kVA", tablero.downstreamKVAcc.toFixed(2) + " kVA",
    ];
    if (hasFeeder) feederLabelTexts.push("(" + tablero.feederKVAcc.toFixed(2) + " kVA)");
    const feederTextStartX = computeSectionTextStartX(colX, feederLabelTexts);

    drawFlowPairLabels(colX, feederFlow1Y, mainBusKVAcc, tableroContribToMain, feederTextStartX);
    if (hasFeeder) {
      drawImpedanceBox(colX, feederBoxY, tablero.feederKVAcc.toFixed(2), feederTextStartX);
      drawFlowPairLabels(colX, feederFlow2Y, tablero.upstreamAtBus, tablero.downstreamKVAcc, feederTextStartX);
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
      const hasCable         = load.cable?.enabled && load.cableKVAcc != null;
      const terminalUpstream = hasCable ? series(tablero.upstreamAtBus, load.cableKVAcc) : tablero.upstreamAtBus;

      drawVerticalLine(loadX, tableroBusY, circuitSymbolY);

      if (load.loadType === "resistive") {
        // Resistive: single upstream label per level (kVAcc decreasing through the cable)
        const labelTexts = [tablero.upstreamAtBus.toFixed(2) + " kVA"];
        if (hasCable) labelTexts.push(terminalUpstream.toFixed(2) + " kVA", "(" + load.cableKVAcc.toFixed(2) + " kVA)");
        const textStartX = computeSectionTextStartX(loadX, labelTexts);

        drawText(tablero.upstreamAtBus.toFixed(2) + " kVA", textStartX, circuitFlow1Y - 4, 10, "#111");
        drawRightArrow(loadX - 8, circuitFlow1Y, 40);
        if (hasCable) {
          drawImpedanceBox(loadX, circuitBoxY, load.cableKVAcc.toFixed(2), textStartX);
          drawText(terminalUpstream.toFixed(2) + " kVA", textStartX, circuitFlow2Y - 4, 10, "#555");
          drawRightArrow(loadX - 8, circuitFlow2Y, 40);
        }

        drawResistiveLoadSymbol(loadX, circuitSymbolY, load.label);
        const iccTerminal = terminalUpstream / (Math.sqrt(3) * loadVoltageKV);
        drawText(`Icc: ${iccTerminal.toFixed(1)} A`, loadX, circuitSymbolY + 52, 10, "#333", "center");
      } else {
        // Motor: flow pair (upstream black, motor contribution grey) per level
        const labelTexts = [
          tablero.upstreamAtBus.toFixed(2) + " kVA", load.kVAccContributionToBus.toFixed(2) + " kVA",
        ];
        if (hasCable) labelTexts.push(terminalUpstream.toFixed(2) + " kVA", load.motorKVAcc.toFixed(2) + " kVA", "(" + load.cableKVAcc.toFixed(2) + " kVA)");
        const textStartX = computeSectionTextStartX(loadX, labelTexts);

        drawFlowPairLabels(loadX, circuitFlow1Y, tablero.upstreamAtBus, load.kVAccContributionToBus, textStartX);
        if (hasCable) {
          drawImpedanceBox(loadX, circuitBoxY, load.cableKVAcc.toFixed(2), textStartX);
          drawFlowPairLabels(loadX, circuitFlow2Y, terminalUpstream, load.motorKVAcc, textStartX);
        }

        drawLoadSymbol(loadX, circuitSymbolY, load.label);
        const iccTerminal = (terminalUpstream + load.motorKVAcc) / (Math.sqrt(3) * loadVoltageKV);
        drawText(`Icc: ${iccTerminal.toFixed(1)} A`, loadX, circuitSymbolY + 52, 10, "#333", "center");
        drawText(`HP: ${load.hp.toFixed(1)}`, loadX, circuitSymbolY + 66, 10, "#1a6e1a", "center");
      }
    });
  });

  ctx.restore();
}
