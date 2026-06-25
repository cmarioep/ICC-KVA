import { series } from "./cableUtils";
import { createPrimitives } from "./diagramPrimitives";
import { PALETTE } from "./palette";

export function drawDiagram(canvas, data, results) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const canvasWidth = canvas.width, canvasHeight = canvas.height;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.setLineDash([]);

  const { srcResults, loadResults, busKVAcc, gridKVAcc, upstreamKVAcc } = results;
  const hasGridData = data.grid.kV != null && data.grid.kV > 0 && data.grid.Icc != null && data.grid.Icc > 0;
  const busVoltageKV = srcResults[0]?.kVsec ?? 0.208;
  const asymmetricFactor = busVoltageKV < 0.6 ? 1.25 : 1.6;

  // ── Primitives ──────────────────────────────────────────────────────────────
  const {
    drawVerticalLine, drawText, drawTextWithKVAccSubscript,
    computeSectionTextStartX, drawFlowPairLabels, drawImpedanceBox,
    drawTransformer, drawGridSymbol, drawResistiveLoadSymbol, drawLoadSymbol,
    drawRightArrow, drawBusBar, drawIccLabel,
  } = createPrimitives(ctx);

  // ── Canvas geometry ──────────────────────────────────────────────────────────

  const loadCount       = loadResults.length;
  const loadSpacing     = Math.max(110, Math.min(150, (canvasWidth - 120) / Math.max(loadCount, 1)));
  const busBarHalfWidth = Math.max(180, loadCount * loadSpacing / 2 + 40);
  // Bus bar centered horizontally: first source at diagramCenterX, last at diagramCenterX + (n-1)*230
  const diagramCenterX  = canvasWidth / 2 - (srcResults.length - 1) * 230 / 2;

  // ── Global layout pre-computation (all Y relative to diagramTopY = 0) ───────

  const SEGMENT_LENGTH  = 22;
  const diagramTopY     = 0;
  const conductorStartY = diagramTopY + 40;
  const flowPairAtGridY = conductorStartY + SEGMENT_LENGTH + 4;

  // Reference transformer drives the vertical layout for ALL sources
  const refTransformer   = srcResults.find(s => s.type === "transformer");
  const refHasInCable    = refTransformer?.inCable?.enabled && refTransformer?.inCableKVAcc;
  const refFlowPairBeforeTransformerY = refHasInCable
    ? flowPairAtGridY + 12 + SEGMENT_LENGTH + 11 + 11 + SEGMENT_LENGTH + 4
    : flowPairAtGridY;
  const globalTransformerY = hasGridData
    ? refFlowPairBeforeTransformerY + 12 + SEGMENT_LENGTH + 35
    : diagramTopY + 50;
  const globalFlowPairAtTransformerY = globalTransformerY + 35 + SEGMENT_LENGTH + 4;

  // globalBusBarY = max across all source outCable configs
  const globalBusBarY = srcResults.reduce((maxY, source) => {
    if (source.outCable?.enabled && source.outCableKVAcc) {
      const oCableBoxY  = globalFlowPairAtTransformerY + 12 + SEGMENT_LENGTH + 11;
      const oCableFlowY = oCableBoxY + 11 + SEGMENT_LENGTH + 4;
      return Math.max(maxY, oCableFlowY + 12 + SEGMENT_LENGTH + 4);
    }
    return Math.max(maxY, globalFlowPairAtTransformerY + 12 + SEGMENT_LENGTH + 4);
  }, 0);

  // ── Vertical centering: compute content bounding box ────────────────────────

  const loadFlowPair1Y = globalBusBarY + 4 + SEGMENT_LENGTH + 4;
  let maxLoadBottomY = loadFlowPair1Y;
  loadResults.forEach(load => {
    let flowPairBeforeSymbolY = loadFlowPair1Y;
    if (load.cable?.enabled && load.cableKVAcc) {
      const lb = loadFlowPair1Y + 12 + SEGMENT_LENGTH + 11;
      flowPairBeforeSymbolY = lb + 11 + SEGMENT_LENGTH + 4;
    }
    const symY   = flowPairBeforeSymbolY + 12 + SEGMENT_LENGTH + 24;
    const bottom = symY + (load.loadType === "inducción" ? 86 : 66);
    maxLoadBottomY = Math.max(maxLoadBottomY, bottom);
  });

  const contentTopY    = hasGridData ? diagramTopY : Math.max(diagramTopY, globalTransformerY - 35);
  const contentHeight  = maxLoadBottomY - contentTopY;
  const verticalOffset = Math.round((canvasHeight - contentHeight) / 2) - contentTopY;

  ctx.save();
  ctx.translate(0, verticalOffset);

  let currentY = globalBusBarY;

  // ── Source sections ──────────────────────────────────────────────────────────

  srcResults.forEach((source, sourceIndex) => {
    const isGenerator   = source.type === "generator";
    const sourceCenterX = diagramCenterX + sourceIndex * 230;
    const sourceLabelX  = isGenerator ? sourceCenterX + 28 : sourceCenterX + 44;

    const transformerY         = globalTransformerY;
    const flowPairAtTransformerY = globalFlowPairAtTransformerY;
    const busBarY              = globalBusBarY;

    // Per-source inCable layout (transformers only)
    let incomingCableBoxY = null, flowPairAtIncomingCableY = null;
    if (!isGenerator && source.inCable?.enabled && source.inCableKVAcc) {
      incomingCableBoxY        = flowPairAtGridY + 12 + SEGMENT_LENGTH + 11;
      flowPairAtIncomingCableY = incomingCableBoxY + 11 + SEGMENT_LENGTH + 4;
    }

    // Per-source outCable layout
    let outgoingCableBoxY = null, flowPairAtOutgoingCableY = null;
    if (source.outCable?.enabled && source.outCableKVAcc) {
      outgoingCableBoxY        = flowPairAtTransformerY + 12 + SEGMENT_LENGTH + 11;
      flowPairAtOutgoingCableY = outgoingCableBoxY + 11 + SEGMENT_LENGTH + 4;
    }

    // Generators are local sources at the bus: they don't see their own contribution as downstream
    const downstreamKVAatBus = isGenerator
      ? results.downstreamKVAcc - source.kVAccAtSourceOutput
      : results.downstreamKVAcc;
    const downstreamKVAbelowTransformer = source.outCableKVAcc != null
      ? series(downstreamKVAatBus, source.outCableKVAcc) : downstreamKVAatBus;

    // Downstream labels used only for transformers (grid + inCable section)
    const downstreamKVAbelowIncomingCable = series(downstreamKVAbelowTransformer, source.equipmentKVAcc);
    const downstreamKVAatGrid             = source.inCableKVAcc != null
      ? series(downstreamKVAbelowIncomingCable, source.inCableKVAcc) : downstreamKVAbelowIncomingCable;

    // Collect label texts to compute consistent left edge (per source)
    const srcLabelTexts = [
      source.kVAccPassingThrough.toFixed(2)    + " kVA",
      downstreamKVAbelowTransformer.toFixed(2) + " kVA",
    ];
    if (!isGenerator && hasGridData) {
      srcLabelTexts.push(
        gridKVAcc.toFixed(2)           + " kVA",
        downstreamKVAatGrid.toFixed(2) + " kVA",
      );
      if (incomingCableBoxY !== null) {
        srcLabelTexts.push(
          source.kVAccAtSourceInput.toFixed(2)       + " kVA",
          downstreamKVAbelowIncomingCable.toFixed(2) + " kVA",
          "(" + source.inCableKVAcc.toFixed(2)       + " kVA)",
        );
      }
    }
    if (outgoingCableBoxY !== null) {
      srcLabelTexts.push(
        source.kVAccAtSourceOutput.toFixed(2) + " kVA",
        downstreamKVAatBus.toFixed(2)         + " kVA",
        "(" + source.outCableKVAcc.toFixed(2) + " kVA)",
      );
    }
    // Generators: labels are to the right of the conductor (arrow tip at conductorX+8, 40px arrow, 4px gap)
    const srcTextStartX = isGenerator
      ? sourceCenterX + 52
      : computeSectionTextStartX(sourceCenterX, srcLabelTexts);

    // ── Render pass ──────────────────────────────────────────────────────────

    // 1. Vertical conductor line
    const conductorTopY = isGenerator ? (transformerY - 24) : (hasGridData ? conductorStartY : transformerY - 35);
    drawVerticalLine(sourceCenterX, conductorTopY, busBarY);

    // 2. Symbols
    if (!isGenerator) {
      if (hasGridData) drawGridSymbol(sourceCenterX, diagramTopY);
      if (incomingCableBoxY !== null) drawImpedanceBox(sourceCenterX, incomingCableBoxY, source.inCableKVAcc.toFixed(2), srcTextStartX);
      drawTransformer(sourceCenterX, transformerY);
    } else {
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(sourceCenterX, transformerY, 24, 0, Math.PI * 2);
      ctx.fillStyle = "#fff"; ctx.fill();
      ctx.strokeStyle = PALETTE.motor; ctx.lineWidth = 2; ctx.stroke();
      drawText("G", sourceCenterX, transformerY + 6, 16, PALETTE.motor, "center", true);
    }
    if (outgoingCableBoxY !== null) drawImpedanceBox(sourceCenterX, outgoingCableBoxY, source.outCableKVAcc.toFixed(2), srcTextStartX);

    // 3. Right-side technical data
    if (!isGenerator) {
      if (hasGridData) {
        drawText(`Un: ${data.grid.kV ?? '--'} kV`,                          sourceLabelX, diagramTopY + 4,  11, PALETTE.textPrimary);
        drawText(`Icc: ${data.grid.Icc != null ? data.grid.Icc.toFixed(2) : '--'} kA`, sourceLabelX, diagramTopY + 18, 11, PALETTE.textPrimary);
        drawTextWithKVAccSubscript(`: ${gridKVAcc.toFixed(2)} kVA`, sourceLabelX, diagramTopY + 32, 11, PALETTE.faultCurrent, true);
      }
      drawText(`kVA:  ${source.kVA}`,     sourceLabelX, transformerY - 28, 11, PALETTE.textPrimary);
      drawText(`Un:  ${source.kVsec} kV`, sourceLabelX, transformerY - 14, 11, PALETTE.textPrimary);
      drawText(`Z%:  ${source.zPct}%`,    sourceLabelX, transformerY,      11, PALETTE.textPrimary);
      drawTextWithKVAccSubscript(`:  (${source.equipmentKVAcc.toFixed(2)} kVA)`, sourceLabelX, transformerY + 14, 11, PALETTE.faultCurrent);
    } else {
      drawText(`kVA: ${source.kVA}`,  srcTextStartX, transformerY - 16, 11, PALETTE.textPrimary);
      drawText(`X'': ${source.xdpp}`, srcTextStartX, transformerY - 2,  11, PALETTE.textPrimary);
      drawTextWithKVAccSubscript(`: (${source.equipmentKVAcc.toFixed(2)} kVA)`, srcTextStartX, transformerY + 12, 11, PALETTE.faultCurrent);
    }

    // 4. Flow pair labels (left of conductor for transformers, right for generators)
    const flowSide = isGenerator ? "right" : "left";
    if (!isGenerator && hasGridData) {
      drawFlowPairLabels(sourceCenterX, flowPairAtGridY, gridKVAcc, downstreamKVAatGrid, srcTextStartX);
      if (flowPairAtIncomingCableY !== null)
        drawFlowPairLabels(sourceCenterX, flowPairAtIncomingCableY, source.kVAccAtSourceInput, downstreamKVAbelowIncomingCable, srcTextStartX);
    }
    drawFlowPairLabels(sourceCenterX, flowPairAtTransformerY, source.kVAccPassingThrough, downstreamKVAbelowTransformer, srcTextStartX, flowSide);
    if (flowPairAtOutgoingCableY !== null)
      drawFlowPairLabels(sourceCenterX, flowPairAtOutgoingCableY, source.kVAccAtSourceOutput, downstreamKVAatBus, srcTextStartX, flowSide);
  });

  // ── Bus bar — drawn once spanning all sources and the load zone ──────────────

  const busBarLeftX  = diagramCenterX - busBarHalfWidth;
  const busBarRightX = diagramCenterX + (srcResults.length - 1) * 230 + busBarHalfWidth;
  drawBusBar(busBarLeftX, busBarRightX, currentY);

  // Icc at bus bar — same style/pattern as the unified diagram
  const shortCircuitCurrentAtBus = busKVAcc / (Math.sqrt(3) * busVoltageKV);
  drawIccLabel(`Icc: ${shortCircuitCurrentAtBus.toFixed(2)} A`, busBarRightX, currentY - 12, 11, PALETTE.faultCurrent, "right");

  // ── Load branches — drawn once below the common bus bar ─────────────────────

  const firstLoadCenterX = diagramCenterX - ((loadCount - 1) * loadSpacing) / 2;

  loadResults.forEach((load, loadIndex) => {
    const loadCenterX = firstLoadCenterX + loadIndex * loadSpacing;

    const upstreamKVAatBus = upstreamKVAcc;

    if (load.loadType === "resistive") {
      const terminalKVAcc = load.cableKVAcc
        ? series(upstreamKVAatBus, load.cableKVAcc)
        : upstreamKVAatBus;
      const iccAtTerminal = terminalKVAcc / (Math.sqrt(3) * busVoltageKV);

      const labelTexts = [upstreamKVAatBus.toFixed(2) + " kVA"];
      if (load.cable?.enabled && load.cableKVAcc) {
        labelTexts.push(
          terminalKVAcc.toFixed(2) + " kVA",
          "(" + load.cableKVAcc.toFixed(2) + " kVA)",
        );
      }
      const textStartX = computeSectionTextStartX(loadCenterX, labelTexts);

      const flowPair1Y = currentY + 4 + SEGMENT_LENGTH + 4;
      let cableBoxY = null, flowPair2Y = null;
      if (load.cable?.enabled && load.cableKVAcc) {
        cableBoxY  = flowPair1Y + 12 + SEGMENT_LENGTH + 11;
        flowPair2Y = cableBoxY  + 11 + SEGMENT_LENGTH + 4;
      }
      const flowPairBeforeSymbolY = flowPair2Y ?? flowPair1Y;
      const symbolCenterY = flowPairBeforeSymbolY + 12 + SEGMENT_LENGTH + 24;

      drawVerticalLine(loadCenterX, currentY + 4, symbolCenterY);
      if (cableBoxY !== null) drawImpedanceBox(loadCenterX, cableBoxY, load.cableKVAcc.toFixed(2), textStartX);
      drawResistiveLoadSymbol(loadCenterX, symbolCenterY, load.label);

      drawText(upstreamKVAatBus.toFixed(2) + " kVA", textStartX, flowPair1Y - 4, 10, PALETTE.textPrimary);
      drawRightArrow(loadCenterX - 8, flowPair1Y, 40);
      if (flowPair2Y !== null) {
        drawText(terminalKVAcc.toFixed(2) + " kVA", textStartX, flowPair2Y - 4, 10, PALETTE.textSecondary);
        drawRightArrow(loadCenterX - 8, flowPair2Y, 40);
      }

      drawIccLabel(`Icc: ${iccAtTerminal.toFixed(2)} A`, loadCenterX, symbolCenterY + 52, 11, PALETTE.faultCurrent, "center");
      return;
    }

    // Collect every label text in this branch for consistent left edge
    const loadLabelTexts = [
      upstreamKVAatBus.toFixed(2)            + " kVA",
      load.kVAccContributionToBus.toFixed(2) + " kVA",
    ];
    if (load.cable?.enabled && load.cableKVAcc) {
      const upstreamKVAatTerminalPreview = series(upstreamKVAatBus, load.cableKVAcc);
      loadLabelTexts.push(
        upstreamKVAatTerminalPreview.toFixed(2) + " kVA",
        load.motorKVAcc.toFixed(2)              + " kVA",
        "(" + load.cableKVAcc.toFixed(2)        + " kVA)",
      );
    }
    const loadTextStartX = computeSectionTextStartX(loadCenterX, loadLabelTexts);

    // Load layout pass
    const loadFlowPair1Y = currentY + 4 + SEGMENT_LENGTH + 4;

    let loadCableBoxY = null, loadFlowPair2Y = null;
    if (load.cable?.enabled && load.cableKVAcc) {
      loadCableBoxY  = loadFlowPair1Y + 12 + SEGMENT_LENGTH + 11;
      loadFlowPair2Y = loadCableBoxY  + 11 + SEGMENT_LENGTH + 4;
    }

    const flowPairBeforeLoadCircleY = loadFlowPair2Y ?? loadFlowPair1Y;
    const loadCircleCenterY         = flowPairBeforeLoadCircleY + 12 + SEGMENT_LENGTH + 24;

    // 1. Line
    drawVerticalLine(loadCenterX, currentY + 4, loadCircleCenterY);

    // 2. Symbols
    if (loadCableBoxY !== null) drawImpedanceBox(loadCenterX, loadCableBoxY, load.cableKVAcc.toFixed(2), loadTextStartX);
    drawLoadSymbol(loadCenterX, loadCircleCenterY, load.label);

    // 3. Flow pair labels
    drawFlowPairLabels(loadCenterX, loadFlowPair1Y, upstreamKVAatBus, load.kVAccContributionToBus, loadTextStartX);

    let upstreamKVAatTerminal = upstreamKVAatBus;
    if (loadFlowPair2Y !== null) {
      upstreamKVAatTerminal = series(upstreamKVAatBus, load.cableKVAcc);
      drawFlowPairLabels(loadCenterX, loadFlowPair2Y, upstreamKVAatTerminal, load.motorKVAcc, loadTextStartX);
      const shortCircuitCurrentAtLoad = (upstreamKVAatTerminal + load.motorKVAcc) / (Math.sqrt(3) * busVoltageKV);
      drawIccLabel(`Icc: ${shortCircuitCurrentAtLoad.toFixed(2)}`, loadCenterX, loadCircleCenterY + 52, 11, PALETTE.faultCurrent, "center");
    } else {
      const iccAtLoad  = (upstreamKVAatTerminal + load.motorKVAcc) / (Math.sqrt(3) * busVoltageKV);
      const iascAtLoad = iccAtLoad * asymmetricFactor;
      drawIccLabel(`Icc: ${iccAtLoad.toFixed(2)}`,  loadCenterX, loadCircleCenterY + 52, 11, PALETTE.faultCurrent, "center");
      drawText(`Iasc: ${iascAtLoad.toFixed(2)}`, loadCenterX, loadCircleCenterY + 66, 11, PALETTE.faultCurrent, "center");
    }
  });

  ctx.restore();
}
