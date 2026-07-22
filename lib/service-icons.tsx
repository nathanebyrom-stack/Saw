import { Ship, Warehouse, Truck, ClipboardCheck, LineChart } from "lucide-react";
import type { ServiceIconKey } from "@/content/services";

export const serviceIconMap: Record<ServiceIconKey, typeof Ship> = {
  freight: Ship,
  warehouse: Warehouse,
  lastMile: Truck,
  customs: ClipboardCheck,
  consulting: LineChart,
};
