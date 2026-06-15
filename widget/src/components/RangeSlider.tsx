interface Props {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  formatValue: (v: number) => string;
}

// Dual-handle range slider (two overlapping <input type="range"> with a
// highlighted fill between them), Amazon-price-filter style.
export default function RangeSlider({ min, max, step, value, onChange, formatValue }: Props) {
  const [lo, hi] = value;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  return (
    <div className="range-slider">
      <div className="range-slider-labels">
        <span>{formatValue(lo)}</span>
        <span>{formatValue(hi)}</span>
      </div>
      <div className="range-slider-track-wrap">
        <div className="range-slider-track" />
        <div
          className="range-slider-fill"
          style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={e => onChange([Math.min(Number(e.target.value), hi), hi])}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={e => onChange([lo, Math.max(Number(e.target.value), lo)])}
        />
      </div>
    </div>
  );
}
