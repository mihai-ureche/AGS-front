import { Capacitor } from "@capacitor/core";
import { ordersCsv } from "./sales";
import type { Order } from "./sales";

export async function exportSales(orders: Order[], days: number) {
  const filename = `ags-sales-${days}-days.csv`;
  const csv = `\uFEFF${ordersCsv(orders)}`;

  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } =
      await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const file = await Filesystem.writeFile({
      path: filename,
      data: csv,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: "AGS sales report",
      files: [file.uri],
      dialogTitle: "Export sales report",
    });
    return "Report ready in the share sheet.";
  }

  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return `Exported ${orders.length} sample orders as CSV.`;
}
