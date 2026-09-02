import type { Product, Variant } from "@/lib/types";

type Props = {
  product: Product;
  variant?: Variant;
  className?: string;
};

function flowerPath(kind: string) {
  switch (kind) {
    case "rose":
      return "M0-18 C8-18 14-10 12-2 C18 0 18 10 8 12 C10 20 2 22 0 16 C-2 22 -10 20 -8 12 C-18 10 -18 0 -12 -2 C-14-10 -8-18 0-18Z";
    case "marigold":
      return "M0-16 L4-6 L15-6 L6 1 L10 12 L0 6 L-10 12 L-6 1 L-15-6 L-4-6Z";
    case "jasmine":
      return "M0-12 C4-12 6-6 4-2 C8 0 8 6 2 6 C2 12 -2 12 -2 6 C-8 6 -8 0 -4-2 C-6-6 -4-12 0-12Z";
    case "lotus":
      return "M0 12 C-16 12 -18 0 0-16 C18 0 16 12 0 12 M-10 8 C-4 2 4 2 10 8";
    case "daisy":
      return "M0-14 C3-14 4-8 2-4 C8-6 14-2 10 2 C14 6 8 10 2 6 C4 12 0 16 0 10 C0 16 -4 12 -2 6 C-8 10 -14 6 -10 2 C-14-2 -8-6 -2-4 C-4-8 -3-14 0-14Z";
    case "hibiscus":
      return "M0-18 C10-14 16-4 12 4 C18 8 10 18 0 12 C-10 18 -18 8 -12 4 C-16-4 -10-14 0-18Z";
    default:
      return "M0-16 C6-16 12-8 10 0 C16 4 12 14 4 12 C4 20 -4 20 -4 12 C-12 14 -16 4 -10 0 C-12-8 -6-16 0-16Z";
  }
}

function placement(p: Product["print"]["placement"], w: number, h: number) {
  switch (p) {
    case "chest-center":
      return { x: w / 2, y: h * 0.42 };
    case "yoke":
      return { x: w / 2, y: h * 0.28 };
    case "sleeve":
      return { x: w * 0.22, y: h * 0.38 };
    case "back":
      return { x: w / 2, y: h * 0.5 };
    case "border":
      return { x: w / 2, y: h * 0.88 };
    case "pallu":
      return { x: w * 0.72, y: h * 0.55 };
    default:
      return { x: w / 2, y: h * 0.48 };
  }
}

function scaleN(s: Product["print"]["scale"]) {
  switch (s) {
    case "tiny":
      return 0.35;
    case "small":
      return 0.55;
    case "medium":
      return 0.85;
    case "large":
      return 1.2;
    case "oversized":
      return 1.8;
  }
}

function silhouette(category: Product["category"], fill: string) {
  const stroke = "#1C2430";
  if (category === "saree") {
    return (
      <path
        d="M70 30 H150 C170 30 180 50 180 70 V360 H40 V70 C40 50 50 30 70 30Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
      />
    );
  }
  if (category === "slippers") {
    return (
      <path
        d="M50 160 C50 80 170 80 170 160 C170 230 50 230 50 160Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
      />
    );
  }
  if (category === "socks") {
    return (
      <path
        d="M90 40 H130 V180 C130 220 170 230 170 260 C170 300 120 310 90 280 C70 260 70 230 90 210 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
      />
    );
  }
  if (category === "shawl" || category === "dupatta") {
    return (
      <path
        d="M40 50 L180 40 L190 340 L50 350 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
      />
    );
  }
  if (category === "petticoat") {
    return (
      <path
        d="M80 40 H140 L180 360 H40 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
      />
    );
  }
  if (category === "blouse") {
    return (
      <path
        d="M70 70 L40 110 L55 130 L70 110 V200 H150 V110 L165 130 L180 110 L150 70 C140 50 80 50 70 70Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
      />
    );
  }
  // default garment: tee / kurta / nighty / cardigan
  const long = ["kurta", "mens-kurta", "nighty", "nightsuit", "salwar", "thermal"].includes(category);
  const bottom = long ? 360 : 250;
  return (
    <path
      d={`M70 70 L30 110 L50 130 L70 108 V${bottom} H150 V108 L170 130 L190 110 L150 70 C140 42 80 42 70 70Z`}
      fill={fill}
      stroke={stroke}
      strokeWidth="3"
    />
  );
}

export function GarmentTile({ product, variant, className }: Props) {
  const fill = variant?.hex ?? product.variants[0]?.hex ?? "#EFE6D2";
  const pr = product.print;
  const pos = placement(pr.placement, 220, 400);
  const s = scaleN(pr.scale);
  const repeats = pr.placement === "all-over" ? 12 : pr.placement === "border" ? 6 : 1;
  const motifs = Array.from({ length: repeats }, (_, i) => {
    if (repeats === 1) return pos;
    if (pr.placement === "border") {
      return { x: 40 + i * 28, y: 350 };
    }
    const col = i % 4;
    const row = Math.floor(i / 4);
    return { x: 55 + col * 38, y: 110 + row * 70 };
  });

  return (
    <svg viewBox="0 0 220 400" className={className} role="img" aria-label={product.name}>
      <rect width="220" height="400" fill="#D9D3C6" />
      {silhouette(product.category, fill)}
      {pr.type === "text" && pr.quote ? (
        <text
          x={pos.x}
          y={pos.y}
          textAnchor="middle"
          fill={pr.motifHex}
          fontSize={pr.scale === "large" ? 16 : 13}
          fontFamily={pr.quoteFont === "script" ? "cursive" : "ui-sans-serif, system-ui"}
          fontWeight={pr.quoteFont === "block" ? 800 : 600}
        >
          {pr.quote.split(" ").slice(0, 3).map((word, i) => (
            <tspan key={word} x={pos.x} dy={i === 0 ? 0 : 16}>
              {word}
            </tspan>
          ))}
        </text>
      ) : pr.type !== "solid" ? (
        motifs.map((m, i) => (
          <g key={i} transform={`translate(${m.x} ${m.y}) scale(${s})`}>
            {pr.type === "polka" ? (
              <circle r="6" fill={pr.motifHex} />
            ) : pr.type === "stripes" || pr.type === "checks" ? (
              <rect x="-10" y="-10" width="20" height="20" fill={pr.motifHex} opacity="0.45" />
            ) : pr.motif === "paisley" || pr.type === "paisley" ? (
              <path d="M0-20 C12-10 12 10 0 20 C-8 10 -8-8 0-20Z" fill={pr.motifHex} />
            ) : (
              <path d={flowerPath(pr.flower ?? "sunflower")} fill={pr.motifHex} />
            )}
          </g>
        ))
      ) : null}
    </svg>
  );
}
