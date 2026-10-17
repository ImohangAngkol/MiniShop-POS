export interface User {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}
export interface Category {
  id: number;
  name: string;
}
export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  categoryId: number;
  categoryName: string;
  unit: "piece" | "gram" | "kilogram";
  costPrice: number | null;
  sellingPrice: number;
  lowStockThreshold: number;
  active: boolean;
  stock: number;
  availableStock: number;
}
export interface Customer {
  id: number;
  name: string;
  contact: string | null;
  creditLimit: number | null;
  active: boolean;
  balance: number;
}
export interface Batch {
  id: number;
  productId: number;
  productName: string;
  unit: string;
  reference: string;
  quantity: number;
  unitCost: number;
  expiresOn: string | null;
  receivedAt: string;
}
export interface Movement {
  id: number;
  productName: string;
  batchId: number;
  quantity: number;
  kind: string;
  reason: string;
  actorId: string;
  createdAt: string;
}
export interface SaleItem {
  productId: number;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}
export interface Sale {
  id: number;
  reference: string;
  cashierName: string;
  customerId: number | null;
  customerName: string | null;
  createdAt: string;
  subtotal: number;
  discount: number;
  total: number;
  cashReceived: number;
  cashApplied: number;
  change: number;
  credit: number;
  status: string;
  refundCash: number;
  refundReason: string | null;
  items: SaleItem[];
}
export interface StoreSettings {
  storeName: string;
  contact: string;
  address: string;
  receiptFooter: string;
  thermalWidthMm: number;
  demoData: boolean;
}
export interface SalesReport {
  from: string;
  to: string;
  revenue: number;
  grossProfit: number;
  costOfGoods: number;
  discounts: number;
  transactions: number;
  refunds: number;
  cashSales: number;
  refundCash: number;
  repayments: number;
  daily: { date: string; sales: number }[];
  products: {
    id: number;
    name: string;
    quantity: number;
    revenue: number;
    grossProfit: number;
  }[];
}
export interface Dashboard {
  today: SalesReport;
  trend: SalesReport;
  outstandingCredit: number;
  lowStock: {
    id: number;
    name: string;
    unit: string;
    stock: number;
    lowStockThreshold: number;
  }[];
  nearExpiry: {
    id: number;
    productName: string;
    quantity: number;
    expiresOn: string;
    expired: boolean;
  }[];
  recent: Sale[];
}
export interface Ledger {
  balance: number;
  items: {
    id: number;
    saleId: number;
    reference: string;
    amount: number;
    kind: string;
    createdAt: string;
  }[];
}
export interface Employee {
  id: string;
  email: string;
  displayName: string;
  active: boolean;
  roles: string[];
}
export interface Audit {
  id: number;
  actorId: string;
  action: string;
  detail: string;
  createdAt: string;
}
