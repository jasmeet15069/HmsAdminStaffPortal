import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RoomStatus = "vacant_clean" | "vacant_dirty" | "occupied" | "maintenance" | "blocked";
export type ResStatus = "confirmed" | "pending" | "checked_in" | "checked_out" | "cancelled" | "no_show";

export interface Room {
  id: string;
  number: string;
  floor: number;
  type: "Standard" | "Deluxe" | "Suite" | "Executive";
  status: RoomStatus;
  rate: number;
  capacity: number;
  amenities: string[];
  lastCleaned?: string;
}

export interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
  vip?: boolean;
  loyaltyTier?: "Silver" | "Gold" | "Platinum";
  loyaltyPoints?: number;
  totalStays?: number;
  nationality?: string;
}

export interface Reservation {
  id: string;
  code: string;
  guestId: string;
  roomId: string;
  checkIn: string; // ISO date
  checkOut: string;
  adults: number;
  children: number;
  status: ResStatus;
  rate: number;
  source: "Direct" | "Booking.com" | "Expedia" | "Walk-in" | "Corporate";
  notes?: string;
  createdAt: string;
}

export interface FolioCharge {
  id: string;
  reservationId: string;
  description: string;
  amount: number;
  date: string;
  category: "Room" | "F&B" | "Spa" | "Laundry" | "Mini-bar" | "Tax" | "Other";
}

export interface Payment {
  id: string;
  reservationId: string;
  amount: number;
  method: "Card" | "Cash" | "UPI" | "Bank Transfer";
  date: string;
  reference?: string;
}

export interface HousekeepingTask {
  id: string;
  roomId: string;
  type: "Cleaning" | "Turndown" | "Deep Clean" | "Inspection";
  priority: "Low" | "Normal" | "High" | "Urgent";
  assignedTo?: string;
  status: "Pending" | "In Progress" | "Completed";
  notes?: string;
  createdAt: string;
}

export interface MaintenanceTicket {
  id: string;
  roomId?: string;
  title: string;
  description: string;
  priority: "Low" | "Normal" | "High" | "Critical";
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  assignedTo?: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  reorderLevel: number;
  unitCost: number;
  supplier?: string;
}

export type Outlet = "Restaurant" | "Bar" | "Room Service" | "Spa";
export type OrderChannel = "Dine-In" | "Takeaway" | "Delivery" | "Banquet";

export interface MenuItem {
  id: string;
  outlet: Outlet;
  name: string;
  price: number;
  cat: string;
  desc?: string;
  active: boolean;
}

export interface POSOrder {
  id: string;
  orderNumber: string;
  outlet: Outlet;
  channel?: OrderChannel;
  table?: string;
  roomId?: string;
  customerName?: string;
  deliveryAddress?: string;
  items: { name: string; qty: number; price: number; note?: string; seat?: number; discountPct?: number }[];
  status: "Open" | "Sent" | "Paid";
  total: number;
  // Bill breakdown for accurate invoicing. Optional so legacy/demo orders
  // (which only carry `total`) still type-check; the receipt falls back to a
  // tax-inclusive estimate when these are absent.
  subtotal?: number;
  discount?: number;
  serviceCharge?: number;
  taxRate?: number;
  taxMode?: "gst" | "igst";
  tax?: number;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  items: { name: string; qty: number; unitPrice: number }[];
  status: "Draft" | "Sent" | "Received" | "Cancelled";
  total: number;
  createdAt: string;
}

export type UserRole = "Admin" | "Manager" | "Front Desk" | "Receptionist" | "Housekeeping" | "Accounts" | "F&B" | "Restaurant Manager";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  lastLogin?: string;
}

export interface Property {
  id: string;
  name: string;
  city: string;
  rooms: number;
  occupancy: number;
  adr: number;
}

interface State {
  currentProperty: string;
  businessDate: string;
  auditLog: { id: string; date: string; user: string; action: string }[];
  properties: Property[];
  rooms: Room[];
  guests: Guest[];
  reservations: Reservation[];
  folios: FolioCharge[];
  payments: Payment[];
  tasks: HousekeepingTask[];
  maintenance: MaintenanceTicket[];
  inventory: InventoryItem[];
  orders: POSOrder[];
  purchaseOrders: PurchaseOrder[];
  users: User[];
  menuItems: MenuItem[];

  setProperty: (id: string) => void;
  addReservation: (r: Omit<Reservation, "id" | "code" | "createdAt">) => Reservation;
  updateReservation: (id: string, patch: Partial<Reservation>) => void;
  cancelReservation: (id: string) => void;
  checkIn: (id: string) => void;
  checkOut: (id: string) => void;
  setRoomStatus: (id: string, status: RoomStatus) => void;
  addCharge: (c: Omit<FolioCharge, "id">) => void;
  addPayment: (p: Omit<Payment, "id">) => void;
  addTask: (t: Omit<HousekeepingTask, "id" | "createdAt">) => void;
  updateTask: (id: string, patch: Partial<HousekeepingTask>) => void;
  addTicket: (t: Omit<MaintenanceTicket, "id" | "createdAt">) => void;
  updateTicket: (id: string, patch: Partial<MaintenanceTicket>) => void;
  addOrder: (o: Omit<POSOrder, "id" | "orderNumber" | "createdAt">) => void;
  updateOrder: (id: string, patch: Partial<POSOrder>) => void;
  addMenuItem: (m: Omit<MenuItem, "id">) => void;
  updateMenuItem: (id: string, patch: Partial<MenuItem>) => void;
  removeMenuItem: (id: string) => void;
  addPO: (p: Omit<PurchaseOrder, "id" | "createdAt">) => void;
  updatePO: (id: string, patch: Partial<PurchaseOrder>) => void;
  receivePO: (id: string) => void;
  addGuest: (g: Omit<Guest, "id">) => Guest;
  updateGuest: (id: string, patch: Partial<Guest>) => void;
  updateInventory: (id: string, patch: Partial<InventoryItem>) => void;
  addUser: (u: Omit<User, "id">) => void;
  updateUser: (id: string, patch: Partial<User>) => void;
  rollBusinessDate: () => void;
  logAudit: (user: string, action: string) => void;
  resetData: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const dateOffset = (d: number) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
};

function seed() {
  const roomTypes: Room["type"][] = ["Standard", "Deluxe", "Suite", "Executive"];
  const statuses: RoomStatus[] = ["vacant_clean", "occupied", "vacant_dirty", "occupied", "maintenance"];
  const rooms: Room[] = [];
  for (let f = 1; f <= 5; f++) {
    for (let n = 1; n <= 12; n++) {
      const type = roomTypes[(f + n) % 4];
      rooms.push({
        id: uid(),
        number: `${f}${n.toString().padStart(2, "0")}`,
        floor: f,
        type,
        status: statuses[(f * n) % statuses.length],
        rate: type === "Suite" ? 9500 : type === "Executive" ? 7500 : type === "Deluxe" ? 5500 : 3500,
        capacity: type === "Suite" ? 4 : 2,
        amenities: ["WiFi", "AC", "TV", "Mini-bar"],
        lastCleaned: dateOffset(-1),
      });
    }
  }

  const guestNames = [
    "Aarav Sharma","Priya Mehta","Rohan Kapoor","Ananya Iyer","Vikram Singh",
    "Diya Patel","Arjun Reddy","Isha Nair","Karan Joshi","Meera Pillai",
    "Sara Khan","Aditya Bose","Neha Verma","Rahul Das","Pooja Rao",
    "John Smith","Emily Davis","Liam Wilson","Olivia Brown","Noah Johnson",
  ];
  const guests: Guest[] = guestNames.map((name, i) => ({
    id: uid(),
    name,
    email: name.toLowerCase().replace(/\s/g, ".") + "@example.com",
    phone: "+91 98" + (10000000 + i * 13579).toString().slice(0, 8),
    vip: i % 7 === 0,
    loyaltyTier: i % 3 === 0 ? "Gold" : i % 3 === 1 ? "Silver" : "Platinum",
    loyaltyPoints: 1000 + i * 350,
    totalStays: 1 + (i % 12),
    nationality: i < 15 ? "Indian" : "Foreign",
  }));

  const reservations: Reservation[] = [];
  const sources: Reservation["source"][] = ["Direct", "Booking.com", "Expedia", "Walk-in", "Corporate"];
  for (let i = 0; i < 28; i++) {
    const g = guests[i % guests.length];
    const r = rooms[(i * 3) % rooms.length];
    const offset = (i % 14) - 5;
    const nights = 1 + (i % 5);
    const status: ResStatus =
      offset < 0 ? (i % 4 === 0 ? "checked_out" : "checked_in")
      : offset === 0 ? "confirmed"
      : i % 6 === 0 ? "pending" : "confirmed";
    reservations.push({
      id: uid(),
      code: "RES" + (1000 + i),
      guestId: g.id,
      roomId: r.id,
      checkIn: dateOffset(offset),
      checkOut: dateOffset(offset + nights),
      adults: 1 + (i % 3),
      children: i % 4 === 0 ? 1 : 0,
      status,
      rate: r.rate,
      source: sources[i % sources.length],
      createdAt: dateOffset(-7 + (i % 5)),
    });
  }

  const folios: FolioCharge[] = reservations.flatMap((r) => [
    { id: uid(), reservationId: r.id, description: "Room charge", amount: r.rate, date: r.checkIn, category: "Room" as const },
    { id: uid(), reservationId: r.id, description: "GST 18%", amount: Math.round(r.rate * 0.18), date: r.checkIn, category: "Tax" as const },
  ]);

  const payments: Payment[] = reservations
    .filter((r) => r.status === "checked_out")
    .map((r) => ({ id: uid(), reservationId: r.id, amount: r.rate * 1.18, method: "Card" as const, date: r.checkOut, reference: "TXN" + uid().toUpperCase() }));

  const tasks: HousekeepingTask[] = rooms
    .filter((r) => r.status === "vacant_dirty" || r.status === "occupied")
    .slice(0, 18)
    .map((r, i) => ({
      id: uid(),
      roomId: r.id,
      type: i % 3 === 0 ? "Deep Clean" : "Cleaning",
      priority: i % 5 === 0 ? "High" : "Normal",
      status: i % 4 === 0 ? "Completed" : i % 3 === 0 ? "In Progress" : "Pending",
      assignedTo: ["Sunita", "Ramesh", "Lakshmi", "Vijay"][i % 4],
      createdAt: today(),
    }));

  const maintenance: MaintenanceTicket[] = [
    { id: uid(), roomId: rooms[2].id, title: "AC not cooling", description: "Guest reported", priority: "High", status: "Open", assignedTo: "Anil", createdAt: today() },
    { id: uid(), roomId: rooms[8].id, title: "Leaking faucet", description: "Bathroom sink", priority: "Normal", status: "In Progress", assignedTo: "Rakesh", createdAt: dateOffset(-1) },
    { id: uid(), title: "Lobby light bulb", description: "Replace ceiling bulb", priority: "Low", status: "Resolved", assignedTo: "Anil", createdAt: dateOffset(-3) },
    { id: uid(), roomId: rooms[15].id, title: "TV remote not working", description: "Replace batteries / remote", priority: "Low", status: "Open", createdAt: today() },
  ];

  const inventory: InventoryItem[] = [
    { id: uid(), sku: "LIN-001", name: "Bath towel", category: "Linen", unit: "pcs", stock: 240, reorderLevel: 100, unitCost: 350, supplier: "Cotton Co." },
    { id: uid(), sku: "LIN-002", name: "Bed sheet (Queen)", category: "Linen", unit: "pcs", stock: 80, reorderLevel: 100, unitCost: 850, supplier: "Cotton Co." },
    { id: uid(), sku: "AMN-001", name: "Shampoo bottle 30ml", category: "Amenities", unit: "pcs", stock: 1200, reorderLevel: 500, unitCost: 18, supplier: "Hospitality Supplies" },
    { id: uid(), sku: "AMN-002", name: "Soap bar", category: "Amenities", unit: "pcs", stock: 450, reorderLevel: 300, unitCost: 12, supplier: "Hospitality Supplies" },
    { id: uid(), sku: "FNB-001", name: "Bottled water 1L", category: "F&B", unit: "btl", stock: 320, reorderLevel: 200, unitCost: 25, supplier: "Aqua Pure" },
    { id: uid(), sku: "FNB-002", name: "Coffee sachet", category: "F&B", unit: "pcs", stock: 90, reorderLevel: 150, unitCost: 8, supplier: "Bean Bros" },
    { id: uid(), sku: "CLN-001", name: "Floor cleaner 5L", category: "Cleaning", unit: "can", stock: 22, reorderLevel: 10, unitCost: 480, supplier: "CleanMax" },
  ];

  const orders: POSOrder[] = [
    { id: uid(), orderNumber: "ORD-00001", outlet: "Restaurant", channel: "Dine-In", table: "T-04", items: [{name:"Butter Chicken",qty:1,price:520},{name:"Naan",qty:3,price:60}], status: "Paid", total: 700, createdAt: today() },
    { id: uid(), orderNumber: "ORD-00002", outlet: "Bar", channel: "Dine-In", table: "B-02", items: [{name:"Old Fashioned",qty:2,price:650}], status: "Open", total: 1300, createdAt: today() },
    { id: uid(), orderNumber: "ORD-00003", outlet: "Room Service", items: [{name:"Club Sandwich",qty:1,price:380},{name:"Fresh Juice",qty:2,price:180}], status: "Sent", total: 740, createdAt: today() },
    { id: uid(), orderNumber: "ORD-00004", outlet: "Restaurant", channel: "Delivery", customerName: "Amit Verma", deliveryAddress: "Flat 4B, Green Towers, Bandra West", items: [{name:"Butter Chicken",qty:2,price:520},{name:"Veg Biryani",qty:1,price:340},{name:"Garlic Naan",qty:4,price:80}], status: "Sent", total: 1900, createdAt: today() },
    { id: uid(), orderNumber: "ORD-00005", outlet: "Restaurant", channel: "Delivery", customerName: "Riya Shah", deliveryAddress: "Office Park, 3rd Floor, Andheri East", items: [{name:"Paneer Tikka",qty:1,price:380},{name:"Dal Makhani",qty:1,price:280},{name:"Naan",qty:2,price:60}], status: "Sent", total: 780, createdAt: today() },
  ];

  const purchaseOrders: PurchaseOrder[] = [
    { id: uid(), poNumber: "PO-2026-0042", supplier: "Cotton Co.", items: [{name:"Bath towel",qty:100,unitPrice:350}], status: "Sent", total: 35000, createdAt: dateOffset(-2) },
    { id: uid(), poNumber: "PO-2026-0043", supplier: "Bean Bros", items: [{name:"Coffee sachet",qty:500,unitPrice:8}], status: "Draft", total: 4000, createdAt: today() },
  ];

  const users: User[] = [
    { id: uid(), name: "Sarah Manager", email: "sarah@mhms.app", role: "Manager", active: true, lastLogin: today() },
    { id: uid(), name: "Dev Front Desk", email: "dev@mhms.app", role: "Front Desk", active: true, lastLogin: today() },
    { id: uid(), name: "Sunita HK", email: "sunita@mhms.app", role: "Housekeeping", active: true, lastLogin: dateOffset(-1) },
    { id: uid(), name: "Raj Accounts", email: "raj@mhms.app", role: "Accounts", active: true, lastLogin: dateOffset(-2) },
    { id: uid(), name: "Admin User", email: "admin@mhms.app", role: "Admin", active: true, lastLogin: today() },
  ];

  const properties: Property[] = [
    { id: "p1", name: "Hotel Harmony Mumbai", city: "Mumbai", rooms: 60, occupancy: 78, adr: 6200 },
    { id: "p2", name: "Hotel Harmony Jaipur", city: "Jaipur", rooms: 45, occupancy: 82, adr: 5400 },
    { id: "p3", name: "Hotel Harmony Goa", city: "Goa", rooms: 80, occupancy: 91, adr: 7800 },
  ];

  const menuItems: MenuItem[] = [
    // Restaurant
    { id: "r1",  outlet: "Restaurant", name: "Paneer Tikka",       price: 380,  cat: "Starter",   desc: "Grilled cottage cheese cubes",       active: true },
    { id: "r2",  outlet: "Restaurant", name: "Chicken Tikka",       price: 420,  cat: "Starter",   desc: "Tandoor-smoked chicken",             active: true },
    { id: "r3",  outlet: "Restaurant", name: "Tomato Soup",         price: 220,  cat: "Starter",   desc: "Creamy tomato bisque",               active: true },
    { id: "r4",  outlet: "Restaurant", name: "Spring Rolls",        price: 280,  cat: "Starter",   desc: "Crispy veg rolls",                   active: true },
    { id: "r5",  outlet: "Restaurant", name: "Butter Chicken",      price: 520,  cat: "Main",      desc: "Murgh makhani, butter sauce",        active: true },
    { id: "r6",  outlet: "Restaurant", name: "Dal Makhani",         price: 280,  cat: "Main",      desc: "Slow-cooked black lentil",           active: true },
    { id: "r7",  outlet: "Restaurant", name: "Veg Biryani",         price: 340,  cat: "Main",      desc: "Fragrant basmati rice",              active: true },
    { id: "r8",  outlet: "Restaurant", name: "Chicken Biryani",     price: 420,  cat: "Main",      desc: "Dum-cooked chicken biryani",         active: true },
    { id: "r9",  outlet: "Restaurant", name: "Margherita Pizza",    price: 480,  cat: "Main",      desc: "Fresh mozzarella & basil",           active: true },
    { id: "r10", outlet: "Restaurant", name: "Pasta Arrabiata",     price: 380,  cat: "Main",      desc: "Penne in spicy tomato",              active: true },
    { id: "r11", outlet: "Restaurant", name: "Grilled Fish",        price: 680,  cat: "Main",      desc: "Sea bass with herb butter",          active: true },
    { id: "r12", outlet: "Restaurant", name: "Mushroom Risotto",    price: 460,  cat: "Main",      desc: "Arborio rice, wild mushroom",        active: true },
    { id: "r13", outlet: "Restaurant", name: "Garlic Naan",         price: 80,   cat: "Bread",     desc: "Butter-glazed naan",                 active: true },
    { id: "r14", outlet: "Restaurant", name: "Naan",                price: 60,   cat: "Bread",                                                 active: true },
    { id: "r15", outlet: "Restaurant", name: "Laccha Paratha",      price: 70,   cat: "Bread",                                                 active: true },
    { id: "r16", outlet: "Restaurant", name: "Caesar Salad",        price: 320,  cat: "Salad",     desc: "Romaine, parmesan, croutons",        active: true },
    { id: "r17", outlet: "Restaurant", name: "Greek Salad",         price: 280,  cat: "Salad",                                                 active: true },
    { id: "r18", outlet: "Restaurant", name: "Gulab Jamun",         price: 180,  cat: "Dessert",   desc: "Milk solids in sugar syrup",         active: true },
    { id: "r19", outlet: "Restaurant", name: "Chocolate Brownie",   price: 240,  cat: "Dessert",   desc: "Warm, with vanilla ice cream",       active: true },
    { id: "r20", outlet: "Restaurant", name: "Cheesecake",          price: 280,  cat: "Dessert",                                               active: true },
    { id: "r21", outlet: "Restaurant", name: "Fresh Lime Soda",     price: 120,  cat: "Beverage",                                              active: true },
    { id: "r22", outlet: "Restaurant", name: "Mango Lassi",         price: 160,  cat: "Beverage",                                              active: true },
    { id: "r23", outlet: "Restaurant", name: "Masala Chai",         price: 80,   cat: "Beverage",                                              active: true },
    { id: "r24", outlet: "Restaurant", name: "Cold Coffee",         price: 180,  cat: "Beverage",                                              active: true },
    { id: "r25", outlet: "Restaurant", name: "Cappuccino",          price: 180,  cat: "Beverage",                                              active: true },
    { id: "r26", outlet: "Restaurant", name: "Club Sandwich",       price: 380,  cat: "Snack",     desc: "Triple-decker with fries",           active: true },
    { id: "r27", outlet: "Restaurant", name: "French Fries",        price: 200,  cat: "Snack",                                                 active: true },
    // Bar
    { id: "b1",  outlet: "Bar", name: "Old Fashioned",       price: 680,  cat: "Cocktail",  desc: "Bourbon, bitters, orange",           active: true },
    { id: "b2",  outlet: "Bar", name: "Mojito",              price: 520,  cat: "Cocktail",  desc: "Rum, mint, lime, soda",              active: true },
    { id: "b3",  outlet: "Bar", name: "Cosmopolitan",        price: 580,  cat: "Cocktail",  desc: "Vodka, triple sec, cranberry",       active: true },
    { id: "b4",  outlet: "Bar", name: "Margarita",           price: 560,  cat: "Cocktail",  desc: "Tequila, lime, salt rim",            active: true },
    { id: "b5",  outlet: "Bar", name: "Whiskey Sour",        price: 620,  cat: "Cocktail",  desc: "Bourbon, lemon, egg white",          active: true },
    { id: "b6",  outlet: "Bar", name: "Negroni",             price: 650,  cat: "Cocktail",  desc: "Gin, Campari, vermouth",             active: true },
    { id: "b7",  outlet: "Bar", name: "Virgin Mojito",       price: 280,  cat: "Mocktail",  desc: "Mint, lime, soda",                   active: true },
    { id: "b8",  outlet: "Bar", name: "Shirley Temple",      price: 260,  cat: "Mocktail",                                              active: true },
    { id: "b9",  outlet: "Bar", name: "Blue Lagoon (N/A)",   price: 300,  cat: "Mocktail",                                              active: true },
    { id: "b10", outlet: "Bar", name: "Kingfisher",          price: 380,  cat: "Beer",      desc: "330ml bottle",                       active: true },
    { id: "b11", outlet: "Bar", name: "Heineken",            price: 450,  cat: "Beer",      desc: "330ml bottle",                       active: true },
    { id: "b12", outlet: "Bar", name: "Corona",              price: 480,  cat: "Beer",      desc: "355ml bottle",                       active: true },
    { id: "b13", outlet: "Bar", name: "House Whiskey",       price: 420,  cat: "Spirit",    desc: "60ml peg",                           active: true },
    { id: "b14", outlet: "Bar", name: "Premium Scotch",      price: 780,  cat: "Spirit",    desc: "60ml — single malt",                 active: true },
    { id: "b15", outlet: "Bar", name: "Vodka",               price: 380,  cat: "Spirit",    desc: "60ml peg",                           active: true },
    { id: "b16", outlet: "Bar", name: "House Red Wine",      price: 580,  cat: "Wine",      desc: "150ml glass",                        active: true },
    { id: "b17", outlet: "Bar", name: "House White Wine",    price: 540,  cat: "Wine",      desc: "150ml glass",                        active: true },
    { id: "b18", outlet: "Bar", name: "Prosecco",            price: 780,  cat: "Wine",      desc: "150ml glass",                        active: true },
    { id: "b19", outlet: "Bar", name: "Mixed Nuts",          price: 280,  cat: "Snack",                                                 active: true },
    { id: "b20", outlet: "Bar", name: "Nachos & Salsa",      price: 380,  cat: "Snack",                                                 active: true },
    { id: "b21", outlet: "Bar", name: "Cheese Platter",      price: 680,  cat: "Snack",     desc: "3 cheeses, crackers, fruit",         active: true },
    { id: "b22", outlet: "Bar", name: "Mini Sliders (4 pc)", price: 480,  cat: "Snack",                                                 active: true },
    // Room Service
    { id: "rs1",  outlet: "Room Service", name: "Club Sandwich",          price: 420,  cat: "Snack",     desc: "With waffle fries",                  active: true },
    { id: "rs2",  outlet: "Room Service", name: "Butter Chicken",          price: 580,  cat: "Main",      desc: "With rice & naan",                   active: true },
    { id: "rs3",  outlet: "Room Service", name: "Veg Biryani",             price: 380,  cat: "Main",                                                  active: true },
    { id: "rs4",  outlet: "Room Service", name: "Pasta Arrabiata",         price: 420,  cat: "Main",                                                  active: true },
    { id: "rs5",  outlet: "Room Service", name: "Caesar Salad",            price: 360,  cat: "Salad",                                                 active: true },
    { id: "rs6",  outlet: "Room Service", name: "Continental Breakfast",   price: 680,  cat: "Breakfast", desc: "Eggs, toast, juice, coffee",          active: true },
    { id: "rs7",  outlet: "Room Service", name: "Indian Breakfast",        price: 580,  cat: "Breakfast", desc: "Poha / Idli, chai, fruit",            active: true },
    { id: "rs8",  outlet: "Room Service", name: "Pancakes",                price: 380,  cat: "Breakfast",                                             active: true },
    { id: "rs9",  outlet: "Room Service", name: "Chocolate Brownie",       price: 280,  cat: "Dessert",                                               active: true },
    { id: "rs10", outlet: "Room Service", name: "Fresh Fruit Platter",     price: 380,  cat: "Dessert",                                               active: true },
    { id: "rs11", outlet: "Room Service", name: "Fresh Lime Soda",         price: 160,  cat: "Beverage",                                              active: true },
    { id: "rs12", outlet: "Room Service", name: "Masala Chai",             price: 120,  cat: "Beverage",                                              active: true },
    { id: "rs13", outlet: "Room Service", name: "Cappuccino",              price: 220,  cat: "Beverage",  desc: "Includes delivery surcharge",         active: true },
    { id: "rs14", outlet: "Room Service", name: "Bottled Water (1L)",      price: 80,   cat: "Beverage",                                              active: true },
    { id: "rs15", outlet: "Room Service", name: "Soft Drink",              price: 120,  cat: "Beverage",                                              active: true },
    { id: "rs16", outlet: "Room Service", name: "Beer (Kingfisher)",       price: 480,  cat: "Beverage",                                              active: true },
    // Spa
    { id: "sp1",  outlet: "Spa", name: "Swedish Massage 60 min",  price: 2800, cat: "Massage",  desc: "Full-body relaxation",                active: true },
    { id: "sp2",  outlet: "Spa", name: "Swedish Massage 90 min",  price: 3800, cat: "Massage",  desc: "Extended session",                    active: true },
    { id: "sp3",  outlet: "Spa", name: "Deep Tissue 60 min",      price: 3200, cat: "Massage",  desc: "Targeted muscle relief",              active: true },
    { id: "sp4",  outlet: "Spa", name: "Deep Tissue 90 min",      price: 4500, cat: "Massage",  desc: "Extended deep tissue",                active: true },
    { id: "sp5",  outlet: "Spa", name: "Aromatherapy 60 min",     price: 3000, cat: "Massage",  desc: "Essential oils blend",                active: true },
    { id: "sp6",  outlet: "Spa", name: "Hot Stone Massage",        price: 4200, cat: "Massage",  desc: "Volcanic stones therapy",             active: true },
    { id: "sp7",  outlet: "Spa", name: "Classic Facial",           price: 1800, cat: "Facial",   desc: "Deep cleanse + mask",                 active: true },
    { id: "sp8",  outlet: "Spa", name: "Anti-Ageing Facial",       price: 2800, cat: "Facial",   desc: "Premium collagen treatment",          active: true },
    { id: "sp9",  outlet: "Spa", name: "Manicure",                 price: 1200, cat: "Nails",                                                active: true },
    { id: "sp10", outlet: "Spa", name: "Pedicure",                 price: 1400, cat: "Nails",                                                active: true },
    { id: "sp11", outlet: "Spa", name: "Mani + Pedi Combo",        price: 2200, cat: "Nails",                                                active: true },
    { id: "sp12", outlet: "Spa", name: "Couple Retreat (120 min)", price: 9500, cat: "Package",  desc: "2 × Swedish + bubble bath",           active: true },
    { id: "sp13", outlet: "Spa", name: "Full Body Package",        price: 7800, cat: "Package",  desc: "Massage + facial + mani",             active: true },
    { id: "sp14", outlet: "Spa", name: "Relaxation Escape",        price: 5500, cat: "Package",  desc: "90-min massage + steam",              active: true },
  ];

  return { rooms, guests, reservations, folios, payments, tasks, maintenance, inventory, orders, purchaseOrders, users, properties, menuItems };
}

export const useMHMS = create<State>()(
  persist(
    (set, get) => ({
      currentProperty: "p1",
      businessDate: today(),
      auditLog: [
        { id: uid(), date: today(), user: "System", action: "Property initialized" },
      ],
      ...seed(),
      setProperty: (id) => set({ currentProperty: id }),
      addReservation: (r) => {
        const res: Reservation = { ...r, id: uid(), code: "RES" + (2000 + get().reservations.length), createdAt: today() };
        set({ reservations: [res, ...get().reservations] });
        // seed initial folio
        const charge: FolioCharge = { id: uid(), reservationId: res.id, description: "Room charge", amount: res.rate, date: res.checkIn, category: "Room" };
        const tax: FolioCharge = { id: uid(), reservationId: res.id, description: "GST 18%", amount: Math.round(res.rate * 0.18), date: res.checkIn, category: "Tax" };
        set({ folios: [...get().folios, charge, tax] });
        return res;
      },
      updateReservation: (id, patch) =>
        set({ reservations: get().reservations.map((r) => (r.id === id ? { ...r, ...patch } : r)) }),
      cancelReservation: (id) =>
        set({ reservations: get().reservations.map((r) => (r.id === id ? { ...r, status: "cancelled" } : r)) }),
      checkIn: (id) => {
        const r = get().reservations.find((x) => x.id === id);
        if (!r) return;
        set({
          reservations: get().reservations.map((x) => (x.id === id ? { ...x, status: "checked_in" } : x)),
          rooms: get().rooms.map((rm) => (rm.id === r.roomId ? { ...rm, status: "occupied" } : rm)),
        });
      },
      checkOut: (id) => {
        const r = get().reservations.find((x) => x.id === id);
        if (!r) return;
        set({
          reservations: get().reservations.map((x) => (x.id === id ? { ...x, status: "checked_out" } : x)),
          rooms: get().rooms.map((rm) => (rm.id === r.roomId ? { ...rm, status: "vacant_dirty" } : rm)),
          tasks: [
            { id: uid(), roomId: r.roomId, type: "Cleaning", priority: "High", status: "Pending", createdAt: today() },
            ...get().tasks,
          ],
        });
      },
      setRoomStatus: (id, status) =>
        set({ rooms: get().rooms.map((r) => (r.id === id ? { ...r, status, lastCleaned: status === "vacant_clean" ? today() : r.lastCleaned } : r)) }),
      addCharge: (c) => set({ folios: [...get().folios, { ...c, id: uid() }] }),
      addPayment: (p) => set({ payments: [...get().payments, { ...p, id: uid() }] }),
      addTask: (t) => set({ tasks: [{ ...t, id: uid(), createdAt: today() }, ...get().tasks] }),
      updateTask: (id, patch) => {
        const task = get().tasks.find((t) => t.id === id);
        set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
        if (task && patch.status === "Completed") {
          set({ rooms: get().rooms.map((r) => (r.id === task.roomId ? { ...r, status: "vacant_clean", lastCleaned: today() } : r)) });
        }
      },
      addTicket: (t) => set({ maintenance: [{ ...t, id: uid(), createdAt: today() }, ...get().maintenance] }),
      updateTicket: (id, patch) =>
        set({ maintenance: get().maintenance.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
      addOrder: (o) => {
        const seq = get().orders.length + 1;
        const orderNumber = `ORD-${String(seq).padStart(5, "0")}`;
        set({ orders: [{ ...o, id: uid(), orderNumber, createdAt: new Date().toLocaleString("en-IN") }, ...get().orders] });
      },
      updateOrder: (id, patch) => set({ orders: get().orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) }),
      addPO: (p) => set({ purchaseOrders: [{ ...p, id: uid(), createdAt: today() }, ...get().purchaseOrders] }),
      updatePO: (id, patch) => set({ purchaseOrders: get().purchaseOrders.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),
      receivePO: (id) => {
        const po = get().purchaseOrders.find((p) => p.id === id);
        if (!po) return;
        const inv = get().inventory.map((it) => {
          const line = po.items.find((l) => l.name === it.name);
          return line ? { ...it, stock: it.stock + line.qty } : it;
        });
        set({
          purchaseOrders: get().purchaseOrders.map((p) => (p.id === id ? { ...p, status: "Received" } : p)),
          inventory: inv,
          auditLog: [{ id: uid(), date: today(), user: "Procurement", action: `Received ${po.poNumber}` }, ...get().auditLog],
        });
      },
      addGuest: (g) => {
        const ng: Guest = { ...g, id: uid() };
        set({ guests: [ng, ...get().guests] });
        return ng;
      },
      updateGuest: (id, patch) =>
        set({ guests: get().guests.map((g) => (g.id === id ? { ...g, ...patch } : g)) }),
      updateInventory: (id, patch) =>
        set({ inventory: get().inventory.map((i) => (i.id === id ? { ...i, ...patch } : i)) }),
      addMenuItem: (m) => set({ menuItems: [...get().menuItems, { ...m, id: uid() }] }),
      updateMenuItem: (id, patch) => set({ menuItems: get().menuItems.map((m) => (m.id === id ? { ...m, ...patch } : m)) }),
      removeMenuItem: (id) => set({ menuItems: get().menuItems.filter((m) => m.id !== id) }),
      addUser: (u) => set({ users: [{ ...u, id: uid() }, ...get().users] }),
      updateUser: (id, patch) => set({ users: get().users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }),
      rollBusinessDate: () => {
        const next = new Date(get().businessDate);
        next.setDate(next.getDate() + 1);
        const nd = next.toISOString().slice(0, 10);
        set({
          businessDate: nd,
          auditLog: [{ id: uid(), date: nd, user: "Night Audit", action: "Business date rolled forward" }, ...get().auditLog],
        });
      },
      logAudit: (user, action) =>
        set({ auditLog: [{ id: uid(), date: today(), user, action }, ...get().auditLog].slice(0, 200) }),
      resetData: () => set({ currentProperty: "p1", businessDate: today(), auditLog: [{ id: uid(), date: today(), user: "System", action: "Demo data reset" }], ...seed() }),
    }),
    { name: "mhms-store-v4" },
  ),
);

export const fmtINR = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");

export const roomStatusMeta: Record<RoomStatus, { label: string; color: string }> = {
  vacant_clean: { label: "Vacant Clean", color: "bg-success/15 text-success border-success/30" },
  vacant_dirty: { label: "Vacant Dirty", color: "bg-warning/20 text-warning-foreground border-warning/40" },
  occupied: { label: "Occupied", color: "bg-info/15 text-info border-info/30" },
  maintenance: { label: "Maintenance", color: "bg-destructive/15 text-destructive border-destructive/30" },
  blocked: { label: "Blocked", color: "bg-muted text-muted-foreground border-border" },
};

export const resStatusMeta: Record<ResStatus, { label: string; color: string }> = {
  confirmed: { label: "Confirmed", color: "bg-success/15 text-success border-success/30" },
  pending: { label: "Pending", color: "bg-warning/20 text-warning-foreground border-warning/40" },
  checked_in: { label: "Checked In", color: "bg-info/15 text-info border-info/30" },
  checked_out: { label: "Checked Out", color: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Cancelled", color: "bg-destructive/15 text-destructive border-destructive/30" },
  no_show: { label: "No Show", color: "bg-destructive/15 text-destructive border-destructive/30" },
};
