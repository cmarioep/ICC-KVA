import { series } from "./cableUtils";

export function drawDiagram(canvas, data, results) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const canvasWidth = canvas.width, canvasHeight = canvas.height;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.setLineDash([]);

  const { srcResults, loadResults, busKVAcc, gridKVAcc } = results;
  const busVoltageKV = srcResults[0]?.kVsec ?? 0.208;
  const asymmetricFactor = busVoltageKV < 0.6 ? 1.25 : 1.6;

  const MAIN_LINE_COLOR   = "#1a3a6e";
  const DEFAULT_LINE_WIDTH = 2;

  // ── Primitives ──────────────────────────────────────────────────────────────

  function drawLine(x1, y1, x2, y2, lineWidth, color) {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  const drawVerticalLine   = (x, y1, y2, lw = DEFAULT_LINE_WIDTH, color = MAIN_LINE_COLOR) => drawLine(x, y1, x, y2, lw, color);
  const drawHorizontalLine = (x1, x2, y, lw = DEFAULT_LINE_WIDTH, color = MAIN_LINE_COLOR) => drawLine(x1, y, x2, y, lw, color);

  function drawText(text, x, y, fontSize = 11, color = "#222", textAlign = "left", isBold = false) {
    ctx.setLineDash([]);
    ctx.font = `${isBold ? "bold " : ""}${fontSize}px Arial,sans-serif`;
    ctx.fillStyle = color; ctx.textAlign = textAlign;
    ctx.fillText(text, x, y);
  }

  function drawTextWithKVAccSubscript(remainingText, x, y, fontSize = 11, color = "#222", isBold = false) {
    const boldPrefix = isBold ? "bold " : "";
    ctx.setLineDash([]);
    ctx.fillStyle = color; ctx.textAlign = "left";
    ctx.font = `${boldPrefix}${fontSize}px Arial,sans-serif`;
    ctx.fillText("kVA", x, y);
    const kVATextWidth = ctx.measureText("kVA").width;
    ctx.font = `${boldPrefix}${fontSize - 2}px Arial,sans-serif`;
    ctx.fillText("cc", x + kVATextWidth, y + 2);
    const subscriptWidth = ctx.measureText("cc").width;
    ctx.font = `${boldPrefix}${fontSize}px Arial,sans-serif`;
    ctx.fillText(remainingText, x + kVATextWidth + subscriptWidth, y);
  }

  // Red right-pointing arrow; tipX = arrowhead tip
  function drawRightArrow(tipX, y, arrowLength = 40) {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.strokeStyle = "#cc2200"; ctx.lineWidth = 1.5;
    ctx.moveTo(tipX - arrowLength, y); ctx.lineTo(tipX - 3, y);
    ctx.stroke();
    ctx.beginPath(); ctx.fillStyle = "#cc2200";
    ctx.moveTo(tipX, y);
    ctx.lineTo(tipX - 8, y - 4);
    ctx.lineTo(tipX - 8, y + 4);
    ctx.closePath(); ctx.fill();
  }

  // Returns the shared left-edge X for all labels in a section.
  // Measures every text at 10 px, finds the widest, and anchors so:
  //   textStartX + maxWidth + gap(4) + arrowLength(40) = conductorX - 8
  function computeSectionTextStartX(conductorX, texts) {
    ctx.font = "10px Arial,sans-serif";
    const maxWidth = Math.max(...texts.map(t => ctx.measureText(t).width));
    return (conductorX - 8) - 40 - 4 - maxWidth;
  }

  // Flow pair: upper kVA line (with arrow), lower kVA line.
  // textStartX is pre-computed for the whole section — every call shares the same left edge.
  function drawFlowPairLabels(conductorX, y, upstreamKVA, downstreamKVA, textStartX) {
    const arrowTipX = conductorX - 8;
    drawText(upstreamKVA.toFixed(2)   + " kVA", textStartX, y - 4,  10, "#111");
    drawRightArrow(arrowTipX, y - 4, 40);
    drawText(downstreamKVA.toFixed(2) + " kVA", textStartX, y + 12, 10, "#555");
  }

  // Grey impedance box. textStartX shared with flow pair labels for a uniform left edge.
  function drawImpedanceBox(x, y, label, textStartX) {
    ctx.setLineDash([]);
    ctx.fillStyle = "#c0c0c0";
    ctx.fillRect(x - 9, y - 11, 18, 22);
    ctx.strokeStyle = "#444"; ctx.lineWidth = 1;
    ctx.strokeRect(x - 9, y - 11, 18, 22);
    drawVerticalLine(x, y - 11, y + 11);
    ctx.font = "9px Arial,sans-serif";
    ctx.fillStyle = "#444"; ctx.textAlign = "left";
    ctx.fillText("(" + label + " kVA)", textStartX, y + 4);
  }

  // Two interlocked circles
  function drawTransformer(centerX, centerY) {
    const r = 22;
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff";
    ctx.fillRect(centerX - r - 4, centerY - r * 1.6, (r + 4) * 2, r * 3.2);
    ctx.beginPath(); ctx.arc(centerX, centerY - r * 0.6, r, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = "#333"; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(centerX, centerY + r * 0.6, r, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = "#333"; ctx.lineWidth = 2; ctx.stroke();
  }

  // Downward-pointing grey triangle
  function drawGridSymbol(centerX, centerY) {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + 40); ctx.lineTo(centerX - 24, centerY); ctx.lineTo(centerX + 24, centerY);
    ctx.closePath();
    ctx.fillStyle = "#999"; ctx.fill();
    ctx.strokeStyle = "#555"; ctx.lineWidth = 1.5; ctx.stroke();
  }

  // Plain white circle with bold label below
  function drawLoadSymbol(centerX, centerY, label) {
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(centerX, centerY, 24, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = "#333"; ctx.lineWidth = 2; ctx.stroke();
    drawText(label, centerX, centerY + 38, 10, "#111", "center", true);
  }

  // Thick black bus bar
  function drawBusBar(startX, endX, y) {
    ctx.setLineDash([]);
    ctx.fillStyle = "#111";
    ctx.fillRect(startX, y - 4, endX - startX, 8);
  }

  // ── Canvas geometry ──────────────────────────────────────────────────────────

  const loadCount       = loadResults.length;
  const loadSpacing     = Math.max(110, Math.min(150, (canvasWidth - 120) / Math.max(loadCount, 1)));
  const busBarHalfWidth = Math.max(180, loadCount * loadSpacing / 2 + 40);
  const diagramCenterX  = Math.max(canvasWidth / 2, busBarHalfWidth + 60);

  let currentY = 30;
  drawText("DIAGRAMA DE kVA's DE CORTOCIRCUITO EQUIVALENTES", canvasWidth / 2, currentY, 14, "#111", "center", true);
  currentY += 24;

  ctx.setLineDash([]);
  ctx.strokeStyle = "#aaa"; ctx.lineWidth = 0.8;
  ctx.strokeRect(diagramCenterX - 130, currentY, 260, 24);
  ctx.fillStyle = "#fff"; ctx.fillRect(diagramCenterX - 130, currentY, 260, 24);
  drawText(`Nivel de Tensión:  ${data.grid.kV} kV  /  ${busVoltageKV} kV`, diagramCenterX, currentY + 16, 11, "#333", "center");
  currentY += 38;

  // ── Source sections ──────────────────────────────────────────────────────────

  srcResults.forEach((source, sourceIndex) => {
    const sourceCenterX = diagramCenterX + sourceIndex * 380;
    const sourceLabelX  = sourceCenterX + 44;
    const iccLabelX     = sourceCenterX + 50;

    const downstreamKVAatBus              = results.downstreamKVAcc;
    const downstreamKVAbelowTransformer   = source.outCableKVAcc != null
      ? series(downstreamKVAatBus, source.outCableKVAcc) : downstreamKVAatBus;
    const downstreamKVAbelowIncomingCable = series(downstreamKVAbelowTransformer, source.equipmentKVAcc);
    const downstreamKVAatGrid             = source.inCableKVAcc != null
      ? series(downstreamKVAbelowIncomingCable, source.inCableKVAcc) : downstreamKVAbelowIncomingCable;

    // Collect every left-side label text so all share the same left edge
    const srcLabelTexts = [
      gridKVAcc.toFixed(2)                         + " kVA",
      downstreamKVAatGrid.toFixed(2)               + " kVA",
      source.kVAccPassingThrough.toFixed(2)        + " kVA",
      downstreamKVAbelowTransformer.toFixed(2)     + " kVA",
    ];
    if (source.inCable?.enabled && source.inCableKVAcc) {
      srcLabelTexts.push(
        source.kVAccAtSourceInput.toFixed(2)       + " kVA",
        downstreamKVAbelowIncomingCable.toFixed(2) + " kVA",
        "(" + source.inCableKVAcc.toFixed(2)       + " kVA)",
      );
    }
    if (source.outCable?.enabled && source.outCableKVAcc) {
      srcLabelTexts.push(
        source.kVAccAtSourceOutput.toFixed(2)      + " kVA",
        downstreamKVAatBus.toFixed(2)              + " kVA",
        "(" + source.outCableKVAcc.toFixed(2)      + " kVA)",
      );
    }
    const srcTextStartX = computeSectionTextStartX(sourceCenterX, srcLabelTexts);

    // ── Layout pass ──────────────────────────────────────────────────────────

    const SEGMENT_LENGTH = 22;

    const gridSymbolY     = currentY;
    const conductorStartY = currentY + 40;

    const flowPairAtGridY = conductorStartY + SEGMENT_LENGTH + 4;

    let incomingCableBoxY = null, flowPairAtIncomingCableY = null;
    if (source.inCable?.enabled && source.inCableKVAcc) {
      incomingCableBoxY        = flowPairAtGridY + 12 + SEGMENT_LENGTH + 11;
      flowPairAtIncomingCableY = incomingCableBoxY + 11 + SEGMENT_LENGTH + 4;
    }

    const flowPairBeforeTransformerY = flowPairAtIncomingCableY ?? flowPairAtGridY;
    const transformerY               = flowPairBeforeTransformerY + 12 + SEGMENT_LENGTH + 35;

    const flowPairAtTransformerY = transformerY + 35 + SEGMENT_LENGTH + 4;

    let outgoingCableBoxY = null, flowPairAtOutgoingCableY = null;
    if (source.outCable?.enabled && source.outCableKVAcc) {
      outgoingCableBoxY        = flowPairAtTransformerY + 12 + SEGMENT_LENGTH + 11;
      flowPairAtOutgoingCableY = outgoingCableBoxY + 11 + SEGMENT_LENGTH + 4;
    }

    const flowPairBeforeBusY = flowPairAtOutgoingCableY ?? flowPairAtTransformerY;
    const busBarY            = flowPairBeforeBusY + 12 + SEGMENT_LENGTH + 4;
    const conductorEndY      = busBarY;

    // ── Render pass ──────────────────────────────────────────────────────────

    // 1. Continuous blue line
    drawVerticalLine(sourceCenterX, conductorStartY, conductorEndY);

    // 2. Symbols
    drawGridSymbol(sourceCenterX, gridSymbolY);
    if (incomingCableBoxY !== null) drawImpedanceBox(sourceCenterX, incomingCableBoxY, source.inCableKVAcc.toFixed(2), srcTextStartX);
    drawTransformer(sourceCenterX, transformerY);
    if (outgoingCableBoxY !== null) drawImpedanceBox(sourceCenterX, outgoingCableBoxY, source.outCableKVAcc.toFixed(2), srcTextStartX);
    drawBusBar(sourceCenterX - busBarHalfWidth, sourceCenterX + busBarHalfWidth, busBarY);

    // 3. Right-side technical data
    drawText(`Un: ${data.grid.kV} kV`,                             sourceLabelX, gridSymbolY + 4,  11, "#222");
    drawText(`Icc: ${data.grid.Icc.toFixed(1)} kA`,                sourceLabelX, gridSymbolY + 18, 11, "#222");
    drawTextWithKVAccSubscript(`: ${gridKVAcc.toFixed(1)} kVA`,    sourceLabelX, gridSymbolY + 32, 11, "#c00", true);

    if (source.type === "transformer") {
      drawText(`kVA:  ${source.kVA}`,          sourceLabelX, transformerY - 28, 11, "#222");
      drawText(`Un:  ${source.kVsec} kV`,      sourceLabelX, transformerY - 14, 11, "#222");
      drawText(`Z%:  ${source.zPct}%`,         sourceLabelX, transformerY,      11, "#222");
      drawTextWithKVAccSubscript(`:  (${source.equipmentKVAcc.toFixed(2)} kVA)`, sourceLabelX, transformerY + 14, 11, "#c00");
    } else {
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(sourceCenterX, transformerY, 24, 0, Math.PI * 2);
      ctx.fillStyle = "#fff"; ctx.fill();
      ctx.strokeStyle = "#1a6e1a"; ctx.lineWidth = 2; ctx.stroke();
      drawText("G", sourceCenterX, transformerY + 6, 16, "#1a6e1a", "center", true);
      drawText(`kVA: ${source.kVA}`,  sourceLabelX, transformerY - 16, 11, "#222");
      drawText(`X'': ${source.xdpp}`, sourceLabelX, transformerY - 2,  11, "#222");
      drawTextWithKVAccSubscript(`: (${source.equipmentKVAcc.toFixed(2)} kVA)`, sourceLabelX, transformerY + 12, 11, "#c00");
    }

    // 4. Left-side flow pair labels — all share srcTextStartX
    drawFlowPairLabels(sourceCenterX, flowPairAtGridY, gridKVAcc, downstreamKVAatGrid, srcTextStartX);
    if (flowPairAtIncomingCableY !== null)
      drawFlowPairLabels(sourceCenterX, flowPairAtIncomingCableY, source.kVAccAtSourceInput, downstreamKVAbelowIncomingCable, srcTextStartX);
    drawFlowPairLabels(sourceCenterX, flowPairAtTransformerY, source.kVAccPassingThrough, downstreamKVAbelowTransformer, srcTextStartX);
    if (flowPairAtOutgoingCableY !== null)
      drawFlowPairLabels(sourceCenterX, flowPairAtOutgoingCableY, source.kVAccAtSourceOutput, downstreamKVAatBus, srcTextStartX);

    // 5. Icc above bus bar
    const shortCircuitCurrentAtBus = busKVAcc / (Math.sqrt(3) * busVoltageKV);
    drawText(`Icc:  ${shortCircuitCurrentAtBus.toFixed(3)}`, iccLabelX, busBarY - 16, 11, "#333");

    currentY = busBarY;

    // ── Load branches ────────────────────────────────────────────────────────

    const firstLoadCenterX = sourceCenterX - ((loadCount - 1) * loadSpacing) / 2;

    loadResults.forEach((load, loadIndex) => {
      const loadCenterX  = firstLoadCenterX + loadIndex * loadSpacing;
      if (loadCenterX !== sourceCenterX) drawHorizontalLine(loadCenterX, sourceCenterX, busBarY);

      const upstreamKVAatBus = busKVAcc - load.kVAccContributionToBus;

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
      const loadFlowPair1Y = busBarY + 4 + SEGMENT_LENGTH + 4;

      let loadCableBoxY = null, loadFlowPair2Y = null;
      if (load.cable?.enabled && load.cableKVAcc) {
        loadCableBoxY  = loadFlowPair1Y + 12 + SEGMENT_LENGTH + 11;
        loadFlowPair2Y = loadCableBoxY  + 11 + SEGMENT_LENGTH + 4;
      }

      const flowPairBeforeLoadCircleY = loadFlowPair2Y ?? loadFlowPair1Y;
      const loadCircleCenterY         = flowPairBeforeLoadCircleY + 12 + SEGMENT_LENGTH + 24;

      // 1. Line
      drawVerticalLine(loadCenterX, busBarY + 4, loadCircleCenterY);

      // 2. Symbols
      if (loadCableBoxY !== null) drawImpedanceBox(loadCenterX, loadCableBoxY, load.cableKVAcc.toFixed(2), loadTextStartX);
      drawLoadSymbol(loadCenterX, loadCircleCenterY, load.label);

      // 3. Flow pair labels — all share loadTextStartX
      drawFlowPairLabels(loadCenterX, loadFlowPair1Y, upstreamKVAatBus, load.kVAccContributionToBus, loadTextStartX);

      let upstreamKVAatTerminal = upstreamKVAatBus;
      if (loadFlowPair2Y !== null) {
        upstreamKVAatTerminal = series(upstreamKVAatBus, load.cableKVAcc);
        drawFlowPairLabels(loadCenterX, loadFlowPair2Y, upstreamKVAatTerminal, load.motorKVAcc, loadTextStartX);
        const shortCircuitCurrentAtLoad = (upstreamKVAatTerminal + load.motorKVAcc) / (Math.sqrt(3) * busVoltageKV);
        drawText(`Icc:  ${shortCircuitCurrentAtLoad.toFixed(2)}`, loadCenterX + 50, loadFlowPair2Y + 4, 11, "#333");
      } else {
        const iccAtLoad  = (upstreamKVAatTerminal + load.motorKVAcc) / (Math.sqrt(3) * busVoltageKV);
        const iascAtLoad = iccAtLoad * asymmetricFactor;
        drawText(`Icc: ${iccAtLoad.toFixed(2)}`,  loadCenterX + 30, loadCircleCenterY - 10, 11, "#333");
        drawText(`Iasc: ${iascAtLoad.toFixed(2)}`, loadCenterX + 30, loadCircleCenterY + 4,  11, "#333");
      }
    });
  });
}
