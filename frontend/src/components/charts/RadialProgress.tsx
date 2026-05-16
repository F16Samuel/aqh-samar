import { ResponsiveContainer, RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";

interface Props {
  value: number; // 0..1
  label?: string;
  size?: number;
}

export function RadialProgress({ value, label, size = 180 }: Props) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const data = [{ name: "p", value: pct, fill: "hsl(var(--primary, 222 47% 11%))" }];
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer>
        <RadialBarChart
          innerRadius="70%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background dataKey="value" cornerRadius={12} fill="var(--primary)" />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight">{pct}%</span>
        {label && <span className="mt-1 text-xs text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}
