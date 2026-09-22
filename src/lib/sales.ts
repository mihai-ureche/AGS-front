export type Period = 7 | 30 | 90;
export type OrderStatus = "Completed" | "Processing" | "Refunded";
export type Order = {
  id: string;
  customer: string;
  email: string;
  product: string;
  category: string;
  date: string;
  amount: number;
  status: OrderStatus;
  channel: "Online store" | "Retail" | "Partners";
};

const customers = [
  "Olivia Martin",
  "Andrei Popescu",
  "Emma Wilson",
  "Alex Morgan",
  "Sofia Ionescu",
  "James Taylor",
  "Mia Anderson",
  "Lucas Brown",
  "Charlotte Lee",
  "Noah Davis",
  "Amelia Clark",
  "Ethan Harris",
];
const products = [
  { name: "Studio Headphones", category: "Electronics", price: 249 },
  { name: "Everyday Backpack", category: "Accessories", price: 89 },
  { name: "Mechanical Keyboard", category: "Electronics", price: 159 },
  { name: "Essential Desk Lamp", category: "Home & living", price: 79 },
  { name: "Classic Watch", category: "Accessories", price: 189 },
  { name: "Ceramic Coffee Set", category: "Home & living", price: 49 },
];

export function createSampleOrders(now = new Date()): Order[] {
  let seed = 42;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: 180 }, (_, day) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - day);
    return Array.from({ length: 4 + Math.floor(random() * 7) }, (_, index) => {
      const customer = customers[Math.floor(random() * customers.length)];
      const product = products[Math.floor(random() * products.length)];
      const roll = random();
      return {
        id: `AGS-${String(10240 - day * 12 - index)}`,
        customer,
        email: `${customer.toLowerCase().replaceAll(" ", ".")}@example.com`,
        product: product.name,
        category: product.category,
        date: localDate(date),
        amount: product.price * (1 + Math.floor(random() * 3)),
        status:
          roll > 0.94
            ? "Refunded"
            : day < 4 && roll > 0.6
              ? "Processing"
              : "Completed",
        channel:
          roll < 0.58 ? "Online store" : roll < 0.85 ? "Retail" : "Partners",
      } satisfies Order;
    });
  }).flat();
}

export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function periodOrders(
  orders: Order[],
  days: Period,
  now = new Date(),
  previous = false,
) {
  const end = new Date(now);
  end.setDate(end.getDate() - (previous ? days : 0));
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  return orders.filter(
    (order) => order.date >= localDate(start) && order.date <= localDate(end),
  );
}

export function summarize(orders: Order[]) {
  const paid = orders.filter((order) => order.status === "Completed");
  const revenue = paid.reduce((total, order) => total + order.amount, 0);
  return {
    revenue,
    orders: orders.length,
    customers: new Set(orders.map((order) => order.email)).size,
    average: paid.length ? revenue / paid.length : 0,
  };
}

export function change(current: number, previous: number): number | null {
  return previous === 0 ? null : ((current - previous) / previous) * 100;
}

export const money = (value: number, compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: compact ? 1 : 2,
    notation: compact ? "compact" : "standard",
  }).format(value);

export function ordersCsv(orders: Order[]) {
  const escape = (value: string | number) => {
    const text = String(value);
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return [
    [
      "Order",
      "Customer",
      "Email",
      "Product",
      "Date",
      "Amount (EUR)",
      "Status",
      "Channel",
    ],
    ...orders.map((order) => [
      order.id,
      order.customer,
      order.email,
      order.product,
      order.date,
      order.amount,
      order.status,
      order.channel,
    ]),
  ]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
}
