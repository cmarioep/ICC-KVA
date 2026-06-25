// Shared color palette for the unifilar (one-line) diagrams.
// Single source of truth so diagram.js, unifiedDiagram.js and diagramPrimitives.js
// stay visually consistent. Each entry maps to a kind of element in the diagram.
export const PALETTE = {
  busbar:        "#1E3A5F", // bus bars (barra)
  feeder:        "#2563EB", // conductor / feeder lines (alimentadores)
  transformer:   "#14B8A6", // transformer symbol (transformador)
  motor:         "#22C55E", // motor / generator rotating-machine symbols
  load:          "#F59E0B", // resistive load symbol (carga resistiva)
  faultCurrent:  "#EF4444", // short-circuit current (Icc) arrows and labels
  textPrimary:   "#1F2937", // primary text (names, parameter values)
  textSecondary: "#64748B", // secondary text (downstream kVA labels)
};
