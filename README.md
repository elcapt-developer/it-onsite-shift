# IT Onsite Shift

A modern, responsive, and clean web application designed to manage, schedule, and track IT onsite shifts across multiple campuses.

---

## 🌟 Key Features

1. **Dual-View Calendar Scheduling**
   - **Daily Schedule View**: Focused daily timetable with a 5-day weekday strip card selector (`Mon` ~ `Fri`) featuring active day elevation and status indicators.
   - **Monthly Calendar View**: 7-column monthly overview with `Weekend` labels, shift badges, and conditional `approval needed` alerts.

2. **1-Hour Timeline Shift Slots (8:00 AM ~ 4:00 PM)**
   - 8 one-hour major slots (`8A`, `9A`, `10A`, `11A`, `12P`, `1P`, `2P`, `3P`).
   - Click to set range, shrink, or clear shift hours with visual `IN` and `OUT` indicators.
   - Automatic shift duration and formatted time display (e.g. `9:00 AM - 1:00 PM`).

3. **Fixed Personnel Order & Campus Identification**
   - Personnel are always organized in fixed order: **John** ➔ **Ben** ➔ **Harry** ➔ **Joseph**.
   - Campus badges distinguish locations:
     - **Campus RDM**: John, Ben
     - **Campus HIO**: Harry, Joseph

4. **Supervisor Mode & Approval Workflow**
   - 3-stage status cycling: **`Pending`** ➔ **`Approved`** ➔ **`Denied`**.
   - Security-locked for Supervisors: requires password authentication (`haa`) to toggle shift approval statuses.
   - Single-click **`✓ Approve Entire Week`** bulk approval tool for rapid supervisor sign-offs.

5. **Date-Range CSV Export with Notes**
   - Export shift records for any custom date range (`Start Date` ~ `End Date`).
   - Quick presets: `This Week`, `This Month`, `All Data`.
   - **Smart End Date**: Automatically detects and sets the end date to the latest registered shift in the database.
   - Outputs 5 standardized columns: `Date`, `Onsite`, `Shift Time`, `Approval`, `Notes`.
   - Formatted with UTF-8 BOM (`\uFEFF`) for immediate compatibility with Microsoft Excel without text corruption.

6. **Local Persistence**
   - Instant real-time saving to browser `localStorage` (`IT_ONSITE_SHIFT_DATA_V6`).
   - All edits, notes, and approval states persist across page reloads.

---

## 🚀 Getting Started

### Option 1: Open Directly in Browser
Simply open [`index.html`](file:///Users/elcapt/.gemini/antigravity/scratch/IT%20Onsite%20Shift/index.html) in any modern browser (Chrome, Safari, Edge, Firefox). No installation or build steps required.

### Option 2: Run Local Python Server
```bash
python3 server.py
```
Open `http://localhost:8080` in your browser.

---

## 📁 Project Structure

- [`index.html`](file:///Users/elcapt/.gemini/antigravity/scratch/IT%20Onsite%20Shift/index.html) : Main application markup and modals.
- [`styles.css`](file:///Users/elcapt/.gemini/antigravity/scratch/IT%20Onsite%20Shift/styles.css) : Sober, minimal white styling and responsive design.
- [`app.js`](file:///Users/elcapt/.gemini/antigravity/scratch/IT%20Onsite%20Shift/app.js) : Application core logic, calendar rendering, supervisor auth, and CSV exporter.
- [`initial_data.js`](file:///Users/elcapt/.gemini/antigravity/scratch/IT%20Onsite%20Shift/initial_data.js) : Seed schedules (Weeks 36~39) and employee rosters.
- [`server.py`](file:///Users/elcapt/.gemini/antigravity/scratch/IT%20Onsite%20Shift/server.py) : Lightweight development HTTP server.

---

## 📄 License & Copyright

&copy; 2026 Mingyun 'John' Kim. All rights reserved.
