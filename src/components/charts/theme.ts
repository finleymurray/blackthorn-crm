/**
 * Chart colours validated for the dark surface (#13131a) with the dataviz
 * palette checks: lightness band, chroma, CVD separation and contrast.
 */
export const CHART = {
  series: ["#cf5d66", "#4a8fd8", "#b8891f", "#2fa883"],
  primary: "#cf5d66",
  secondary: "#4a8fd8",
  grid: "#2a2a35",
  axis: "#a4a4b3",
  text: "#c6c6d2",
  tooltipBg: "#1a1a23",
  muted: "#3a3a48",
} as const;

export const tooltipStyle = {
  contentStyle: {
    background: CHART.tooltipBg,
    border: `1px solid ${CHART.grid}`,
    borderRadius: 6,
    color: "#ececec",
    fontSize: 12,
    padding: "8px 10px",
  },
  labelStyle: { color: "#ececec", fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: CHART.text },
  cursor: { fill: "rgba(255,255,255,0.04)" },
} as const;
