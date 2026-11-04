/**
 * Chart colours validated for the dark surface (#13131a) with the dataviz
 * palette checks: lightness band, chroma, CVD separation and contrast.
 */
export const CHART = {
  series: ["#c2636b", "#5b8fd0", "#b08a3a", "#3f9e85"],
  primary: "#c2636b",
  secondary: "#5b8fd0",
  grid: "rgba(255, 255, 255, 0.04)",
  axis: "#7c8392",
  text: "#8e95a3",
  tooltipBg: "#1c1e24",
  muted: "rgba(255, 255, 255, 0.12)",
} as const;

export const tooltipStyle = {
  contentStyle: {
    background: CHART.tooltipBg,
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 16px 40px -8px rgba(0,0,0,0.6)",
    borderRadius: 6,
    color: "#ececec",
    fontSize: 12,
    padding: "8px 10px",
  },
  labelStyle: { color: "#ececec", fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: CHART.text },
  cursor: { fill: "rgba(255,255,255,0.04)" },
} as const;
