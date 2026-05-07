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

  const MAIN_LINE_COLOR  = "#1a3a6e";
  const DEFAULT_LINE_WIDTH = 2;

  // ── Primitives ──────────────────────────────────────────────────────────────

  function drawLine(x1, y1, x2, y2, lineWidth, color) {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  const drawVerticalLine   = (x, y1, y2, lineWidth = DEFAULT_LINE_WIDTH, color = MAIN_LINE_COLOR) => drawLine(x, y1, x, y2, lineWidth, color);
  const drawHorizontalLine = (x1, x2, y, lineWidth = DEFAULT_LINE_WIDTH, color = MAIN_LINE_COLOR) => drawLine(x1, y, x2, y, lineWidth, color);

  function drawText(text, x, y, fontSize = 11, color = "#222", textAlign = "left", isBold = false) {
    ctx.setLineDash([]);
    ctx.font = `${isBold ? "bold " : ""}${fontSize}px Arial,sans-serif`;
    ctx.fillStyle = color; ctx.textAlign = textAlign;
    ctx.fillText(text, x, y);
  }

  // "kVA" + small "cc" subscript + rest
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
  function drawRightArrow(tipX, y, arrowLength = 38) {
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

  // Flow pair: upper kVA line (with arrow), lower kVA line
  // All text left-aligned at a fixed margin left of conductorX; arrow tip at conductorX-10
  function drawFlowPairLabels(conductorX, y, upstreamKVA, downstreamKVA) {
    const textStartX = conductorX - 160;
    const arrowTipX  = conductorX - 10;
    drawText(upstreamKVA.toFixed(2) + " kVA", textStartX, y - 4, 10, "#111");
    drawRightArrow(arrowTipX, y - 4);
    drawText(downstreamKVA.toFixed(2) + " kVA", textStartX, y + 12, 10, "#555");
  }

  // Grey impedance box centred on the conductor.
  // Drawing order: grey fill → black border → blue line redrawn through interior
  // so the line visually passes through the box with no break.
  function drawImpedanceBox(x, y, label) {
    ctx.setLineDash([]);
    ctx.fillStyle = "#c0c0c0";
    ctx.fillRect(x - 9, y - 11, 18, 22);
    ctx.strokeStyle = "#444"; ctx.lineWidth = 1;
    ctx.strokeRect(x - 9, y - 11, 18, 22);
    // restore the blue line through the box
    drawVerticalLine(x, y - 11, y + 11);
    // label: right-aligned just left of box
    ctx.font = "9px Arial,sans-serif";
    ctx.fillStyle = "#444"; ctx.textAlign = "right";
    ctx.fillText("(" + label + " kVA)", x - 13, y + 4);
  }

  // Two interlocked circles.
  // A white rectangle masks the line behind the transformer before drawing circles.
  function drawTransformer(centerX, centerY) {
    const circleRadius = 22;
    ctx.setLineDash([]);
    // white mask covering the full extent of both circles + small margin
    ctx.fillStyle = "#fff";
    ctx.fillRect(centerX - circleRadius - 4, centerY - circleRadius * 1.6, (circleRadius + 4) * 2, circleRadius * 3.2);
    // upper circle
    ctx.beginPath(); ctx.arc(centerX, centerY - circleRadius * 0.6, circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = "#333"; ctx.lineWidth = 2; ctx.stroke();
    // lower circle
    ctx.beginPath(); ctx.arc(centerX, centerY + circleRadius * 0.6, circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = "#333"; ctx.lineWidth = 2; ctx.stroke();
  }

  // Downward-pointing grey triangle (utility / grid symbol)
  function drawGridSymbol(centerX, centerY) {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + 40); ctx.lineTo(centerX - 24, centerY); ctx.lineTo(centerX + 24, centerY);
    ctx.closePath();
    ctx.fillStyle = "#999"; ctx.fill();
    ctx.strokeStyle = "#555"; ctx.lineWidth = 1.5; ctx.stroke();
  }

  // Plain white circle with bold label below (load symbol)
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
    const iccLabelX     = sourceCenterX + 50;   // consistent right-side column for Icc values

    // downstream kVAcc reflected through the network
    const downstreamKVAatBus              = results.downstreamKVAcc;
    const downstreamKVAbelowTransformer   = source.outCableKVAcc != null
      ? series(downstreamKVAatBus, source.outCableKVAcc) : downstreamKVAatBus;
    const downstreamKVAbelowIncomingCable = series(downstreamKVAbelowTransformer, source.equipmentKVAcc);
    const downstreamKVAatGrid             = source.inCableKVAcc != null
      ? series(downstreamKVAbelowIncomingCable, source.inCableKVAcc) : downstreamKVAbelowIncomingCable;

    // ── Layout pass: compute every Y position without drawing anything ──────
    // SEGMENT_LENGTH = desired visible conductor length between any two adjacent components.
    // Each position is computed as: prev_component_bottom + SEGMENT_LENGTH + half_of_next_component.
    // Flow pair text spans flowPairY-4 (top) to flowPairY+12 (bottom), so:
    //   flowPairY = prev_bottom + SEGMENT_LENGTH + 4   (top of text = prev_bottom + SEGMENT_LENGTH)
    //   next_top = flowPairY + 12 + SEGMENT_LENGTH

    const SEGMENT_LENGTH = 22;

    const gridSymbolY     = currentY;
    const conductorStartY = currentY + 40;                            // line starts at triangle tip

    const flowPairAtGridY = conductorStartY + SEGMENT_LENGTH + 4;     // top of text = conductorStartY + SEGMENT_LENGTH

    let incomingCableBoxY = null, flowPairAtIncomingCableY = null;
    if (source.inCable?.enabled && source.inCableKVAcc) {
      incomingCableBoxY        = flowPairAtGridY + 12 + SEGMENT_LENGTH + 11;       // box top  = fp1 bottom + SEGMENT_LENGTH
      flowPairAtIncomingCableY = incomingCableBoxY + 11 + SEGMENT_LENGTH + 4;      // fp2 top  = box bottom + SEGMENT_LENGTH
    }

    const flowPairBeforeTransformerY = flowPairAtIncomingCableY ?? flowPairAtGridY;
    const transformerY               = flowPairBeforeTransformerY + 12 + SEGMENT_LENGTH + 35; // trafo top = fp bottom + SEGMENT_LENGTH

    const flowPairAtTransformerY = transformerY + 35 + SEGMENT_LENGTH + 4;         // fp3 top  = trafo bottom + SEGMENT_LENGTH

    let outgoingCableBoxY = null, flowPairAtOutgoingCableY = null;
    if (source.outCable?.enabled && source.outCableKVAcc) {
      outgoingCableBoxY        = flowPairAtTransformerY + 12 + SEGMENT_LENGTH + 11;
      flowPairAtOutgoingCableY = outgoingCableBoxY + 11 + SEGMENT_LENGTH + 4;
    }

    const flowPairBeforeBusY = flowPairAtOutgoingCableY ?? flowPairAtTransformerY;
    const busBarY            = flowPairBeforeBusY + 12 + SEGMENT_LENGTH + 4;      // bus top  = fp bottom + SEGMENT_LENGTH
    const conductorEndY      = busBarY;

    // ── Render pass (strict layering order) ─────────────────────────────────

    // 1. Full continuous blue line — drawn once, no gaps
    drawVerticalLine(sourceCenterX, conductorStartY, conductorEndY);

    // 2. Symbols on top of line (they mask or redraw the line as needed)
    drawGridSymbol(sourceCenterX, gridSymbolY);

    if (incomingCableBoxY !== null) drawImpedanceBox(sourceCenterX, incomingCableBoxY, source.inCableKVAcc.toFixed(2));

    drawTransformer(sourceCenterX, transformerY);

    if (outgoingCableBoxY !== null) drawImpedanceBox(sourceCenterX, outgoingCableBoxY, source.outCableKVAcc.toFixed(2));

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

    // 4. Flow pair labels (left side) — same left margin via drawFlowPairLabels()
    drawFlowPairLabels(sourceCenterX, flowPairAtGridY, gridKVAcc, downstreamKVAatGrid);
    if (flowPairAtIncomingCableY !== null) drawFlowPairLabels(sourceCenterX, flowPairAtIncomingCableY, source.kVAccAtSourceInput, downstreamKVAbelowIncomingCable);
    drawFlowPairLabels(sourceCenterX, flowPairAtTransformerY, source.kVAccPassingThrough, downstreamKVAbelowTransformer);

    // 5. Icc label just above the bus bar (right side, consistent column)
    if (flowPairAtOutgoingCableY !== null) drawFlowPairLabels(sourceCenterX, flowPairAtOutgoingCableY, source.kVAccAtSourceOutput, downstreamKVAatBus);
    const shortCircuitCurrentAtBus = busKVAcc / (Math.sqrt(3) * busVoltageKV);
    drawText(`Icc:  ${shortCircuitCurrentAtBus.toFixed(3)}`, iccLabelX, busBarY - 16, 11, "#333");

    currentY = busBarY;

    // ── Load branches ────────────────────────────────────────────────────────

    const firstLoadCenterX = sourceCenterX - ((loadCount - 1) * loadSpacing) / 2;

    loadResults.forEach((load, loadIndex) => {
      const loadCenterX = firstLoadCenterX + loadIndex * loadSpacing;
      if (loadCenterX !== sourceCenterX) drawHorizontalLine(loadCenterX, sourceCenterX, busBarY);

      const upstreamKVAatBus = busKVAcc - load.kVAccContributionToBus;

      // Load layout pass — same SEGMENT_LENGTH logic as source section
      const loadFlowPair1Y = busBarY + 4 + SEGMENT_LENGTH + 4;   // bus bottom = busBarY+4; top of text = bus bottom + SEGMENT_LENGTH

      let loadCableBoxY = null, loadFlowPair2Y = null;
      if (load.cable?.enabled && load.cableKVAcc) {
        loadCableBoxY  = loadFlowPair1Y + 12 + SEGMENT_LENGTH + 11;
        loadFlowPair2Y = loadCableBoxY + 11 + SEGMENT_LENGTH + 4;
      }

      const flowPairBeforeLoadCircleY = loadFlowPair2Y ?? loadFlowPair1Y;
      const loadCircleCenterY         = flowPairBeforeLoadCircleY + 12 + SEGMENT_LENGTH + 24; // circle top = fp bottom + SEGMENT_LENGTH
      const loadConductorEndY         = loadCircleCenterY;                                    // line to circle center; white fill masks interior

      // 1. Full continuous load line
      drawVerticalLine(loadCenterX, busBarY + 4, loadConductorEndY);

      // 2. Symbols on top
      if (loadCableBoxY !== null) drawImpedanceBox(loadCenterX, loadCableBoxY, load.cableKVAcc.toFixed(2));
      drawLoadSymbol(loadCenterX, loadCircleCenterY, load.label);

      // 3. Flow pair labels
      drawFlowPairLabels(loadCenterX, loadFlowPair1Y, upstreamKVAatBus, load.kVAccContributionToBus);

      let upstreamKVAatTerminal = upstreamKVAatBus;
      if (loadFlowPair2Y !== null) {
        upstreamKVAatTerminal = series(upstreamKVAatBus, load.cableKVAcc);
        drawFlowPairLabels(loadCenterX, loadFlowPair2Y, upstreamKVAatTerminal, load.motorKVAcc);
        const shortCircuitCurrentAtLoad = (upstreamKVAatTerminal + load.motorKVAcc) / (Math.sqrt(3) * busVoltageKV);
        drawText(`Icc:  ${shortCircuitCurrentAtLoad.toFixed(2)}`, loadCenterX + 50, loadFlowPair2Y + 4, 11, "#333");
      } else {
        const shortCircuitCurrentAtLoad              = (upstreamKVAatTerminal + load.motorKVAcc) / (Math.sqrt(3) * busVoltageKV);
        const asymmetricShortCircuitCurrentAtLoad    = shortCircuitCurrentAtLoad * asymmetricFactor;
        drawText(`Icc: ${shortCircuitCurrentAtLoad.toFixed(2)}`,                   loadCenterX + 30, loadCircleCenterY - 10, 11, "#333");
        drawText(`Iasc: ${asymmetricShortCircuitCurrentAtLoad.toFixed(2)}`,        loadCenterX + 30, loadCircleCenterY + 4,  11, "#333");
      }
    });
  });
}
