# MHMS — Hotel Management System · Knowledge Document

> This document describes what MHMS is, what it does, and how every feature works.
> Written as prose so it can be refined, expanded, or handed to a marketing / documentation writer.

---

## What is MHMS?

MHMS (Master Hotel Management System) is a full-stack hotel operations platform built for independent hotels and small chains. It consists of two main components: a **Go REST API** (backend) and a **React admin portal** (frontend). Both run inside Docker containers on a Linux VM and are served over HTTPS via Nginx. The admin portal is accessible at `https://hmsadmin.jazverse.online`.

The system operates in two modes. When a staff member is logged in with live credentials, data is fetched from the Go API backed by a real PostgreSQL database. When no user is signed in (demo mode), the portal uses a rich in-browser Zustand store seeded with realistic dummy data — allowing the full UI to be explored without a backend connection.

---

## Global Navigation Shell

Every page in MHMS shares a consistent layout consisting of a fixed left sidebar and a sticky top header. The left sidebar shows the Hotel Harmony logo, the full navigation menu (19 items), and a version indicator at the bottom. The active page is highlighted with the primary accent colour. The sidebar is always visible and does not collapse on desktop, giving staff one-click access to any module without navigating through sub-menus.

The top header contains four zones. On the left is a **Property Switcher** — a dropdown that shows the current property name and lets staff switch between all properties in the group (Hotel Harmony Mumbai, Jaipur, and Goa). Switching property updates the dashboard KPIs and data context across all pages. In the centre is a **global search bar** for quickly finding guests, reservations, and rooms by keyword. On the far right, separated from the search bar by a visible border, is a **Notification Bell** and a **Profile Avatar**.

The notification bell shows a red dot badge when there are unread notifications. Clicking it opens a dropdown with the three most recent unread alerts; each alert can be clicked to mark it as read. At the bottom of the dropdown is a "View all notifications →" button that opens a full-height right-side panel (Sheet) listing all notifications. The panel shows each notification's icon, title, full body text, category badge (e.g. Front Desk, Maintenance, Billing), and timestamp. Staff can mark individual notifications as read by clicking them, mark all as read with a single button, or clear all notifications. The bell dot disappears automatically when all notifications are read.

The profile avatar shows the user's initials in a coloured circle. On medium and larger screens it also shows the user's name and role label (e.g. "Admin"). Clicking it opens a dropdown with options for Profile, Preferences, and Sign Out.

---

## Authentication & Access Control

MHMS uses email/password authentication managed by the Go API. After sign-in, a JWT token is stored and attached to every API request. The frontend has a route guard that redirects unauthenticated visitors to the `/login` page and prevents signed-in users from accessing it again.

Security is also enforced on the **backend**, not only at the page level: every staff-only API endpoint sits behind an authentication gate, and each request's tenant (hotel) is resolved from the signed JWT so a user can only read and write data belonging to their own hotel. Endpoints that are intentionally public (sign-in/sign-up, public hotel branding, the booking/payment flows) are the exception. This means a missing or invalid token returns `401`, and one tenant's session can never reach another tenant's reservations, guests, billing, reports, or settings.

Role-based access control is enforced at the page level. The system recognises eight roles: **Admin**, **Manager**, **Front Desk / Receptionist**, **Housekeeping**, **Accounts**, **F&B** (Food & Beverage / Restaurant Manager), and **Restaurant Manager**. Certain pages, such as Menu Management, check the user's role before allowing write operations. Users without the required role see a read-only view or an access-restricted message. Admins can manage all roles from the Users & Roles page. Admin-only API writes (e.g. payment-gateway settings) additionally require a `hotel_admin`, `super_admin`, or `platform_admin` role on the backend.

---

## Dashboard

The dashboard is the first page a staff member sees after login. It shows live key performance indicators including today's occupancy percentage, total revenue, number of arrivals and departures, and average daily rate. A breakdown by room type and a weekly revenue trend line chart give managers a quick visual summary. A "Recent Activity" panel shows the latest reservations, check-ins, and system events. All figures are pulled live from the API when authenticated, or from the demo store otherwise.

---

## Reservations

The reservations page displays all bookings in a searchable, filterable list. Staff can filter by status (confirmed, pending, checked-in, checked-out, cancelled, no-show) and by date range. Each reservation row shows the booking code, guest name, room number, check-in and check-out dates, rate, source channel (Direct, Booking.com, Expedia, Walk-in, Corporate), and current status.

Clicking a reservation opens a detail view where staff can view the full folio, add charges, record payments, or update the reservation. A "New Reservation" dialog lets staff enter guest details, select a room from the available inventory, choose dates, and set the rate. The system automatically seeds an initial room charge and GST folio entry when a reservation is created. Reservation codes are auto-generated in the format RES2001, RES2002, and so on.

---

## Front Desk

The front desk page is the primary operational hub for reception staff. It is divided into four tabs.

The **Arrivals** tab shows expected arrivals in a card grid. Each card displays the guest's name with a loyalty tier badge and VIP star if applicable, the assigned room number and type, the check-in and check-out dates, and any guest preferences or special requests. Staff can add a note (forwarded to housekeeping) or click Check In to update the reservation status.

The **Departures** tab shows in-house guests grouped by checkout. Each card shows the folio total, amount paid, and outstanding balance. A "Settle" button allows staff to record a full payment directly from this view, and a "Check Out" button completes the departure.

The **In-House** tab lists all currently staying guests in a searchable table. Columns include room number, check-in date, number of nights remaining (colour-coded green/yellow/red), and outstanding balance. A message button allows staff to log a guest request.

The **Room Map** tab shows a floor-by-floor grid of every room in the property. Rooms are colour-coded by status (vacant clean, vacant dirty, occupied, maintenance, blocked). Clicking on any room shows its current details. Floor filter buttons allow staff to focus on a single floor. The map is live — changes made here or in housekeeping are reflected immediately.

The **Walk-In Registration** dialog (accessible via the "Walk-In" button) allows reception staff to register a new guest who arrives without a prior booking. It collects full name, phone, email, room type preference, number of nights, ID type and number, and preferred payment method.

---

## Housekeeping

The housekeeping page gives housekeeping supervisors and staff a complete view of room cleanliness and task progress. It has five tabs.

The **Room Grid** tab shows all rooms as coloured tiles, filterable by floor. Clicking a tile opens a dialog to change the room status (vacant clean, vacant dirty, occupied, maintenance, blocked). When a task is completed, the corresponding room is automatically marked as vacant clean.

The **Floor View** tab groups rooms by floor and shows a progress bar for each floor indicating what percentage of rooms are clean. Per-floor counts of clean, dirty, occupied, and maintenance rooms give supervisors an instant floor-level summary. Staff currently assigned to each floor are listed below the progress bar.

The **Tasks** tab displays all housekeeping tasks in a table. Tasks can be filtered by priority (Low, Normal, High, Urgent) and by status (Pending, In Progress, Completed). Staff can start a task or mark it as done with inline buttons. New tasks can be created via the "New Task" dialog where a room, task type, priority, and staff assignee are selected.

The **Staff** tab lists all housekeeping attendants with their current shift, assigned floor, number of tasks today, and completion rate shown as a progress bar. Supervisors can reassign a staff member to a different floor using a dropdown, which is reflected immediately in the Floor View.

The **Lost & Found** tab maintains a register of items found on the property. Each entry records the date, item description, location found, staff member who found it, and current status (Logged, Claimed, or Disposed). Staff can log new items via a dialog and mark them as claimed by entering the claimant's name.

---

## POS & Restaurant

The POS page handles all food and beverage transactions across four outlets: Restaurant, Bar, Room Service, and Spa.

The **New Order** tab is the main ordering interface. Staff select the outlet (which changes the menu), then select a table from the available table grid or a room number for room service. A server (waiter) can be assigned to the order. Menu items are presented as cards grouped by category with a search bar. Clicking an item adds it to the order cart; each cart item supports inline quantity adjustment, an item note (for special preparation instructions like "no onion" or "extra spicy"), and removal. The cart shows a running total with options for a percentage discount, GST toggle (18% split as CGST 9% + SGST 9%), and payment method selection. Payment supports four methods: Cash, Card, UPI, and Room Charge. A **Split Payment** mode lets staff divide a bill across two payment methods with custom amounts. Staff can Send a KOT (Kitchen Order Ticket) to the kitchen without collecting payment, or Pay directly.

The **Table Management** tab shows all tables across Restaurant, Bar, and Spa. Each table tile is colour-coded by status: available (green), occupied (red), reserved (blue), or cleaning (yellow). Clicking a table tile selects it, allowing staff to change its status and record the number of covers seated.

The **Kitchen Display** tab acts as a kitchen display system. Orders that have been sent to the kitchen (status "Sent") appear as ticket cards. Elapsed time is shown on each card with colour coding: green for under 8 minutes, yellow for 8–15 minutes, and a pulsing red with an alert for over 15 minutes. Kitchen staff can mark an order as ready and served directly from this view.

The **Live Orders** tab shows all open orders (not yet paid) across all outlets, allowing floor managers to track the status of active orders and mark them as sent or paid.

The **History** tab shows all paid orders in a searchable table. Each order has an auto-generated order number in the format ORD-00001, ORD-00002, and so on. Staff can reprint a receipt from any historical order; the receipt prints with full GST breakdown, outlet, table, and itemised amounts. A **Void** button on each order opens a confirmation dialog requiring the staff member to enter a reason; voided orders are moved back to Open status for correction or re-payment.

The **Analytics** tab shows revenue by outlet (bar chart), payment method distribution (pie chart), simulated hourly revenue trend (area chart), and a top-selling items chart (horizontal bar chart).

The **Table Reservations** tab manages advance table bookings for the restaurant. Each reservation records the date, time, table, number of covers, guest name, and phone number. Staff can confirm pending reservations, cancel them, or add new ones through a booking dialog.

---

## Menu Management

The Menu Management page is a dedicated interface for maintaining the food and beverage catalogue. It is separate from the POS so that menus can be managed without interrupting active service. The page is permission-restricted: only users with Admin, Manager, F&B / Restaurant Manager, or Front Desk / Receptionist roles can add, edit, or remove items. Users without these roles see an access-restricted message.

Items are organised into four outlet tabs: Restaurant, Bar, Room Service, and Spa. Within each tab, items can be filtered by category. Each item card shows the category badge, name, description, and price. An active/inactive toggle on every card controls whether the item appears in the POS ordering screen — hiding an item does not delete it. Staff can edit any item's details through an edit dialog, or permanently remove it with a delete confirmation. New items are added via an "Add Item" dialog that collects outlet, name, category, price, description, and active status.

Because the menu catalogue lives in the shared data store, any change made here is instantly reflected in the POS New Order tab — no page refresh needed.

---

## Billing & Finance

The billing page manages guest folios, payment processing, invoices, and accounts receivable.

The **Guest Folios** tab shows a split-panel view: the left panel lists all reservations with their outstanding balance; selecting one shows the full itemised folio on the right. Folio charges are categorised as Room, F&B, Spa, Laundry, Mini-bar, Tax, or Other. Staff can add a new charge via a dialog, record a payment (Card, Cash, UPI, or Bank Transfer), and see CGST/SGST split on the running total. The balance is shown in green when fully settled and red when outstanding.

The **Payments** tab shows a bar chart of payment method distribution and a table of all payment transactions with date, method, reference number, and amount.

The **Invoices** tab lists all checked-out reservations with their final invoice totals. Staff can download or print a formatted invoice for any reservation. The printed invoice includes the hotel name, GSTIN, guest details, itemised charges, tax breakdown, and payment summary.

The **AR Aging** tab shows outstanding accounts receivable grouped by aging bucket (0–30 days, 31–60 days, 61–90 days, 90+ days). Each entry shows the guest name, amount due, and a follow-up action button.

---

## Revenue Management

The revenue management page helps revenue managers maximise occupancy and rate.

A demand calendar shows projected occupancy for the next 30 days colour-coded by demand level. A forecast chart shows projected vs actual occupancy and revenue. A competitive set comparison panel lets managers see their property's rate against simulated competitor rates. Rate recommendation cards suggest optimal pricing for the next seven days based on demand signals. A channel performance breakdown shows contribution from each booking source with conversion rates and revenue.

---

## Channel Manager

The channel manager page connects the property to online travel agents and distribution channels.

An OTA connections panel shows each connected channel (Booking.com, Expedia, Agoda, MakeMyTrip, direct website) with a live/inactive toggle, commission rate, and last sync timestamp. A rate parity checker shows whether room rates are consistent across channels and flags any discrepancies. A channel performance chart shows bookings and revenue by source over the past 30 days. An inventory distribution matrix shows how room inventory is allocated across channels.

---

## Booking Engine

The booking engine page manages the hotel's direct booking widget configuration.

A live preview of the booking widget shows how it looks when embedded on the hotel's website. Staff can configure availability calendar settings, promotional rates, and discount codes. An analytics panel shows widget impressions, click-through rates, and direct booking conversion. Promo code management allows staff to create, activate, deactivate, and track usage of discount codes.

---

## CRM & Loyalty

The CRM page manages guest relationships and the hotel's loyalty programme.

The **Guest Database** tab shows all guests in a searchable, filterable list. Filters include loyalty tier (Platinum, Gold, Silver, Standard) and VIP status. Clicking a guest opens a detail dialog showing stay history, total spend, preferences, and loyalty points. Staff can send a templated email or add the guest to a marketing campaign from this view.

The **Loyalty Programme** tab shows the four loyalty tiers with their point thresholds and perks. A leaderboard shows the top five loyalty members by points. The programme structure can be viewed but requires admin access to modify.

The **Campaigns** tab shows all active and past marketing campaigns with their send count, open rate, and revenue attributed. Staff can launch a campaign, duplicate one for reuse, or create a new campaign with a target tier, channel (Email or SMS), and subject.

The **Analytics** tab shows a guest tier distribution pie chart and a stay frequency bar chart visualising how often different guest segments return.

---

## Inventory

The inventory page manages the hotel's consumable stock.

A stats bar shows total SKUs, items below reorder threshold, total stock value, and number of pending purchase orders. Items are presented in a table with SKU, name, category, unit, current stock level (with a progress bar relative to reorder level), unit cost, and supplier. Items below the reorder threshold are highlighted. Staff can adjust stock quantities, edit item details, or initiate a reorder directly from the table. A stock movement log tracks all additions and deductions with timestamps.

---

## Procurement

The procurement page manages supplier purchase orders.

Staff can create purchase orders with line items, quantities, and unit prices. Orders move through statuses: Draft, Sent, Received, and Cancelled. When a PO is marked as Received, the corresponding inventory quantities are automatically incremented. A supplier master list stores contact details and lead times. A delivery tracker shows expected delivery dates for open POs.

---

## Maintenance

The maintenance page manages work orders and the property's asset register.

Work orders are created with a title, description, location (room or common area), priority (Low, Normal, High, Critical), and assigned technician. Orders move through Open, In Progress, Resolved, and Closed statuses. An asset register lists all equipment with last service date and next scheduled maintenance. A preventive maintenance schedule shows upcoming tasks by asset. A KPI panel shows open tickets, overdue tickets, average resolution time, and a breakdown by priority.

---

## Reports & Analytics

The reports page provides an 18-report catalogue covering revenue, occupancy, guest demographics, channel performance, financial summaries, and operational metrics.

An overview tab shows a dual-axis line chart of revenue and occupancy over time, a booking source pie chart, a department revenue bar chart, and an ADR (average daily rate) area chart. A financial tab shows monthly revenue and RevPAR in both chart and table format. An all-reports tab lists every available report with a search bar and category filter. Any report can be exported as a CSV file with one click.

---

## Night Audit

The night audit page guides the front office manager through the end-of-day audit procedure.

An audit checklist tab shows 10 sequential steps including verifying arrivals and departures, posting room charges, reconciling the cash drawer, generating the revenue summary, and rolling the business date. Each step has a "Run" button that executes the relevant action (such as auto-posting room charges or running a balance check) and marks the step as complete. A progress bar tracks overall audit completion.

A revenue summary tab shows the day's cash drawer reconciliation with opening balance, cash received, cash paid out, and closing balance. An AR aging tab shows outstanding balances with follow-up flags. An audit log tab shows a timestamped history of all audit actions taken. The completed audit report can be printed as a formatted PDF.

---

## Multi-Property Support

MHMS is designed to manage a group of hotels from a single portal. The current demo has three properties: Hotel Harmony Mumbai (60 rooms), Hotel Harmony Jaipur (45 rooms), and Hotel Harmony Goa (80 rooms). The active property is always visible in the header property switcher. Switching property scopes all operational data — rooms, reservations, guests, tasks, orders — to the selected property. The Properties page gives a portfolio-wide overview comparing all properties side by side. Future versions can add more properties through the System Admin configuration.

---

## Properties

The properties page shows a portfolio overview for multi-property groups.

Each property is displayed as a card with city, room count, current occupancy, and ADR. A radar chart compares all properties across five dimensions: occupancy, ADR, RevPAR, guest satisfaction, and operational efficiency. A room type matrix shows the distribution of room categories (Standard, Deluxe, Suite, Executive) at each property. Portfolio-level KPIs aggregate totals across all properties.

---

## Users & Roles

The users page allows admin staff to manage system access.

A user table shows all staff accounts with name, email, role, active status, and last login date. Admins can add new users, edit existing ones, toggle their active status, and reset passwords. A permissions matrix shows which pages and actions each role can access. An activity log shows recent login events and significant actions taken by each user.

---

## System Admin

The system admin page provides hotel-level configuration and integration management.

An organisation settings panel shows and allows editing of the hotel name, GSTIN, time zone, currency, and default language. An integrations panel lists all third-party connections (payment gateway, OTAs, email provider) with connection status. An API keys panel shows keys for external integrations with copy and regenerate actions. A system audit log records all configuration changes with user and timestamp. A data management section allows authorised admins to reset demo data to the seeded defaults.

---

## GST & Indian Compliance

MHMS is built for the Indian hospitality market. All monetary figures are displayed in Indian Rupees (₹) formatted with the Indian numbering system (lakhs, crores). Tax is computed as 18% GST split equally between CGST (9%) and SGST (9%) and shown as separate line items on all folios, invoices, and POS receipts. The hotel's GSTIN is printed on every guest-facing document. Night audit reports include GST collected for the day. The billing AR aging and folio settlement flows are designed around Indian payment methods: Cash, Card, UPI, and Bank Transfer.

---

## Technical Architecture

MHMS is built with modern open-source technology. The backend is written in Go 1.22 using the Fiber framework, connects to PostgreSQL 16 for persistent data, and uses Redis 7 for caching and session management. The admin portal is a server-side rendered React 19 application built with TanStack Start (using Nitro as the SSR server) and TanStack Router for file-based routing. UI components come from shadcn/ui styled with Tailwind CSS v4. Server state is managed by TanStack Query; client/demo state is managed by Zustand with localStorage persistence. Charts are rendered with Recharts. Toast notifications use Sonner.

All services run as Docker containers on a Linode VPS (4 GB RAM, Mumbai datacenter) orchestrated by Docker Compose. HTTPS is handled by Nginx with Let's Encrypt certificates. The admin portal's production build is compiled locally with `NITRO_PRESET=node-server`, packaged as a tar archive, uploaded to the VM, and then rebuilt into a Docker image — typically taking under two minutes from code change to live deployment.

---

*Last updated: 2026-06-17 · Covers all 19 pages + global shell + multi-property + GST compliance*
