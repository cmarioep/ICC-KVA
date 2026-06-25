// Shared canvas drawing primitives for the unifilar diagrams.
// createPrimitives(ctx) returns a set of closures bound to the given 2D context.
// Used by both the single-bus diagram (diagram.js) and the unified multi-board
// diagram (unifiedDiagram.js) so the visual language stays identical.

import { PALETTE } from "./palette";

const MAIN_LINE_COLOR    = PALETTE.feeder;
const DEFAULT_LINE_WIDTH = 2;

// Lightning-bolt icon authored as an SVG path (viewBox 0 0 24 24), rendered via Path2D.
// Swap this string for any other SVG icon's `d` attribute to change the symbol.
const BOLT_PATH = new Path2D("M12 0 L3.6 13.92 H10.08 L5.28 24 L20.4 9.12 H13.2 L17.28 0 Z");

export function createPrimitives(ctx) {
  function drawLine(x1, y1, x2, y2, lineWidth, color) {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  const drawVerticalLine = (x, y1, y2, lw = DEFAULT_LINE_WIDTH, color = MAIN_LINE_COLOR) => drawLine(x, y1, x, y2, lw, color);

  function drawText(text, x, y, fontSize = 11, color = PALETTE.textPrimary, textAlign = "left", isBold = false) {
    ctx.setLineDash([]);
    ctx.font = `${isBold ? "bold " : ""}${fontSize}px Arial,sans-serif`;
    ctx.fillStyle = color; ctx.textAlign = textAlign;
    ctx.fillText(text, x, y);
  }

  function drawTextWithKVAccSubscript(remainingText, x, y, fontSize = 11, color = PALETTE.textPrimary, isBold = false) {
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

  // Small filled lightning-bolt icon. (x, y) = top-left corner of its bounding box.
  // The icon is an SVG path (BOLT_PATH, viewBox 24×24) scaled into width×height.
  function drawLightningIcon(x, y, width = 8, height = 12, color = PALETTE.faultCurrent) {
    ctx.save();
    ctx.setLineDash([]);
    ctx.translate(x, y);
    ctx.scale(width / 24, height / 24);
    ctx.fillStyle = color;
    ctx.fill(BOLT_PATH);
    ctx.restore();
  }

  // Icc value preceded by a lightning bolt to its left. Mirrors drawText's alignment
  // (the bolt sits just left of the text's left edge for any textAlign).
  function drawIccLabel(text, x, y, fontSize = 10, color = PALETTE.faultCurrent, textAlign = "left") {
    ctx.font = `bold ${fontSize}px Arial,sans-serif`;
    const textWidth = ctx.measureText(text).width;
    const textLeftX = textAlign === "right" ? x - textWidth
                    : textAlign === "center" ? x - textWidth / 2
                    : x;
    const iconW = fontSize * 1.1, iconH = fontSize * 1.65, gap = 3;
    drawLightningIcon(textLeftX - iconW - gap, y - iconH + 1, iconW, iconH, color);
    drawText(text, x, y, fontSize, color, textAlign, true);
  }

  // Red right-pointing arrow; tipX = arrowhead tip
  function drawRightArrow(tipX, y, arrowLength = 40) {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.strokeStyle = PALETTE.faultCurrent; ctx.lineWidth = 1.5;
    ctx.moveTo(tipX - arrowLength, y); ctx.lineTo(tipX - 3, y);
    ctx.stroke();
    ctx.beginPath(); ctx.fillStyle = PALETTE.faultCurrent;
    ctx.moveTo(tipX, y);
    ctx.lineTo(tipX - 8, y - 4);
    ctx.lineTo(tipX - 8, y + 4);
    ctx.closePath(); ctx.fill();
  }

  // Red left-pointing arrow; tipX = arrowhead tip
  function drawLeftArrow(tipX, y, arrowLength = 40) {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.strokeStyle = PALETTE.faultCurrent; ctx.lineWidth = 1.5;
    ctx.moveTo(tipX + 3, y); ctx.lineTo(tipX + arrowLength, y);
    ctx.stroke();
    ctx.beginPath(); ctx.fillStyle = PALETTE.faultCurrent;
    ctx.moveTo(tipX, y);
    ctx.lineTo(tipX + 8, y - 4);
    ctx.lineTo(tipX + 8, y + 4);
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

  // Flow pair: upper kVA line (with arrow), lower kVA line, plus a grey convergence
  // line under the text block (at arrow level) separating the two values.
  // side="left": labels+arrow to the left of conductor (default, for transformers).
  // side="right": labels+arrow to the right of conductor (for generators).
  function drawFlowPairLabels(conductorX, y, upstreamKVA, downstreamKVA, textStartX, side = "left") {
    const arrowY = y; // midpoint between upper text (y-4) and lower text (y+12)
    const upstreamText   = upstreamKVA.toFixed(2)   + " kVA";
    const downstreamText = downstreamKVA.toFixed(2) + " kVA";
    if (side === "right") {
      ctx.font = "10px Arial,sans-serif";
      const textWidth = Math.max(ctx.measureText(upstreamText).width, ctx.measureText(downstreamText).width);
      drawLine(conductorX + 52, arrowY, textStartX + textWidth, arrowY, 1, "#888");
      drawLeftArrow(conductorX + 8, arrowY, 40);
      drawText(upstreamText,   textStartX, y - 4,  10, PALETTE.textPrimary);
      drawText(downstreamText, textStartX, y + 12, 10, PALETTE.textSecondary);
    } else {
      drawLine(textStartX, arrowY, conductorX - 52, arrowY, 1, "#888");
      drawText(upstreamText,   textStartX, y - 4,  10, PALETTE.textPrimary);
      drawRightArrow(conductorX - 8, arrowY, 40);
      drawText(downstreamText, textStartX, y + 12, 10, PALETTE.textSecondary);
    }
  }

  // Grey impedance box. textStartX shared with flow pair labels for a uniform left edge.
  function drawImpedanceBox(x, y, label, textStartX) {
    ctx.setLineDash([]);
    ctx.fillStyle = "#D2E5FC";
    ctx.fillRect(x - 9, y - 11, 18, 22);
    ctx.strokeStyle = MAIN_LINE_COLOR; ctx.lineWidth = 1;
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
    ctx.strokeStyle = PALETTE.transformer; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(centerX, centerY + r * 0.6, r, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = PALETTE.transformer; ctx.lineWidth = 2; ctx.stroke();
  }

  // Downward-pointing grey triangle
  function drawGridSymbol(centerX, centerY) {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + 40); ctx.lineTo(centerX - 24, centerY); ctx.lineTo(centerX + 24, centerY);
    ctx.closePath();
    ctx.fillStyle = "#9A81F2"; ctx.fill();
    ctx.strokeStyle = "#7349AD"; ctx.lineWidth = 1.5; ctx.stroke();
  }

  // Amber rectangle with "R" label — resistive load
  function drawResistiveLoadSymbol(centerX, centerY, label) {
    ctx.setLineDash([]);
    ctx.fillStyle = "#fffbeb";
    ctx.fillRect(centerX - 22, centerY - 24, 44, 48);
    ctx.strokeStyle = PALETTE.load; ctx.lineWidth = 2;
    ctx.strokeRect(centerX - 22, centerY - 24, 44, 48);
    drawText("R", centerX, centerY + 5, 13, PALETTE.load, "center", true);
    drawText(label, centerX, centerY + 38, 10, PALETTE.textPrimary, "center", true);
  }

  // Plain white circle with bold label below
  function drawLoadSymbol(centerX, centerY, label) {
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(centerX, centerY, 24, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = PALETTE.motor; ctx.lineWidth = 2; ctx.stroke();
    drawText(label, centerX, centerY + 38, 10, PALETTE.textPrimary, "center", true);
  }

  // Thick black bus bar
  function drawBusBar(startX, endX, y, thickness = 8) {
    ctx.setLineDash([]);
    ctx.fillStyle = PALETTE.busbar;
    ctx.fillRect(startX, y - thickness / 2, endX - startX, thickness);
  }

  return {
    drawLine, drawVerticalLine, drawText, drawTextWithKVAccSubscript,
    drawRightArrow, drawLeftArrow, computeSectionTextStartX, drawFlowPairLabels,
    drawImpedanceBox, drawTransformer, drawGridSymbol, drawResistiveLoadSymbol,
    drawLoadSymbol, drawBusBar, drawLightningIcon, drawIccLabel,
  };
}
