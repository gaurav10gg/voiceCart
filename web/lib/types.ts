export type Category =
  | "kurta"
  | "saree"
  | "tshirt"
  | "nighty"
  | "nightsuit"
  | "salwar"
  | "shawl"
  | "cardigan"
  | "thermal"
  | "petticoat"
  | "blouse"
  | "dupatta"
  | "socks"
  | "slippers"
  | "mens-kurta"
  | "kids-tee";

export type PrintType =
  | "solid"
  | "floral"
  | "text"
  | "block-print"
  | "checks"
  | "stripes"
  | "polka"
  | "paisley"
  | "embroidered";

export type Flower =
  | "sunflower"
  | "rose"
  | "marigold"
  | "jasmine"
  | "lotus"
  | "daisy"
  | "hibiscus";

export type Placement =
  | "chest-center"
  | "all-over"
  | "border"
  | "sleeve"
  | "back"
  | "yoke"
  | "pallu";

export type Scale = "tiny" | "small" | "medium" | "large" | "oversized";

export type Print = {
  type: PrintType;
  flower?: Flower;
  quote?: string;
  quoteFont?: "script" | "block" | "handwritten";
  motif?: string;
  placement: Placement;
  scale: Scale;
  motifColor: string;
  motifHex: string;
};

export type Embroidery = {
  style: "chikankari" | "phulkari" | "mirror-work" | "zari" | "kantha";
  where: string;
  threadColor: string;
};

export type Variant = {
  sku: string;
  size: string;
  color: string;
  hex: string;
  price: number;
  stock: number;
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  category: Category;
  fabric: string;
  fabricWeightGsm?: number;
  basePrice: number;
  description: string;
  print: Print;
  embroidery?: Embroidery;
  neckline?: "round" | "V-neck" | "collared" | "boat" | "mandarin";
  sleeve?: "sleeveless" | "short" | "three-quarter" | "full";
  fit?: "regular" | "relaxed" | "straight" | "A-line";
  lengthInches?: number;
  closure?: "pullover" | "front-buttons" | "side-zip" | "tie-up";
  pockets?: boolean;
  occasion?: "everyday" | "festive" | "wedding" | "sleepwear" | "winter";
  care?: string;
  aliases: string[];
  nameHi?: string;
  nameTa?: string;
  variants: Variant[];
};

export type CartItem = {
  sku: string;
  productId: string;
  name: string;
  brand: string;
  size: string;
  color: string;
  hex: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  printSummary: string;
};

export type DigitField = "pincode" | "phone";

export type DeliveryAddress = {
  line1: string;
  area?: string;
  city: string;
  pincode: string;
  phone?: string;
  landmark?: string;
  spoken?: string;
};

export type NeedsAddress = {
  status: "needs_address";
  missing: Array<"line1" | "city" | "pincode">;
  address?: DeliveryAddress;
  message: string;
};

export type Cart = {
  sid: string;
  items: CartItem[];
  total: number;
  itemCount: number;
  lastAddedProductId?: string;
  lastAddedSku?: string;
  address?: DeliveryAddress;
  lastOrderId?: string;
  pinBuffer?: string;
  phoneBuffer?: string;
  digitField?: DigitField;
};

export type NeedsClarification = {
  status: "needs_clarification";
  productId: string;
  product: string;
  missing: Array<"size" | "color">;
  options: {
    size: string[];
    color: string[];
  };
  message: string;
};

export type Order = {
  id: string;
  sid: string;
  items: CartItem[];
  total: number;
  createdAt: number;
  shopperName?: string;
  address: DeliveryAddress;
  payment: "cod";
};

export type AgentSettings = {
  prompt: string;
  speaker: string;
  model: string;
  language: string;
  minEndpointingDelay: number;
  pace: number;
};

export type SessionConfig = {
  sid: string;
  roomName: string;
  shopperName?: string;
  settings: AgentSettings;
};

export type TurnLatency = {
  id: string;
  at: number;
  sttFinalMs?: number;
  llmTtftMs?: number;
  ttsTtfbMs?: number;
  turnTotalMs?: number;
  transcript?: string;
};

export type PublicUser = {
  id: string;
  name: string;
  firstName: string;
  email: string;
};
