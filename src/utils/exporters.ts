import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DISTRICT_ORDER, formatMondaySpanish } from '../data/initialServices';
import {
  AppDatabase,
  ServiceItem,
  SubmissionStatus,
  ThermometerReading,
  WeekData,
  WeeklyRecord,
} from '../types/control';

export function getRecordReadings(rec?: WeeklyRecord): ThermometerReading[] {
  if (rec?.readings && rec.readings.length > 0) {
    return rec.readings;
  }
  return [
    {
      id: 't-1',
      label: 'T1',
      minTemp: rec?.minTemp || '',
      maxTemp: rec?.maxTemp || '',
      coldChainAlert: rec?.coldChainAlert || false,
      observation: rec?.observation || '',
    },
  ];
}

export function hasAnyColdChainAlert(rec?: WeeklyRecord): boolean {
  if (!rec) return false;
  if (rec.readings && rec.readings.length > 0) {
    return rec.readings.some((r) => Boolean(r.coldChainAlert)) || Boolean(rec.coldChainAlert);
  }
  return Boolean(rec.coldChainAlert);
}

export function formatObservationsSummary(rec?: WeeklyRecord): string {
  if (!rec) return '';
  const readings = getRecordReadings(rec);
  if (readings.length <= 1) {
    const first = readings[0];
    const hasAlert = Boolean(first?.coldChainAlert ?? rec.coldChainAlert);
    const obs = (first?.observation ?? rec.observation ?? '').trim();
    if (!hasAlert && !obs) return '';
    return `${hasAlert ? '[ALERTA T°] ' : ''}${obs}`.trim();
  }
  const parts = readings
    .map((r, idx) => {
      const hasAlert = Boolean(r.coldChainAlert);
      const obs = (r.observation || '').trim();
      if (!hasAlert && !obs) return '';
      const tag = r.label?.trim() || `T${idx + 1}`;
      return `${tag}: ${hasAlert ? '[ALERTA T°] ' : ''}${obs}`.trim();
    })
    .filter(Boolean);
  return parts.join(' | ');
}

export function formatReadingsSummary(rec?: WeeklyRecord): string {
  const readings = getRecordReadings(rec).filter(
    (r) => r.minTemp.trim() !== '' || r.maxTemp.trim() !== ''
  );
  if (readings.length === 0) return '—';
  if (readings.length === 1) {
    const r = readings[0];
    return `${r.minTemp || '?'}° / ${r.maxTemp || '?'}°`;
  }
  return readings
    .map((r, idx) => {
      const tag = r.label?.trim() || `T${idx + 1}`;
      return `${tag}: ${r.minTemp || '?'}°/${r.maxTemp || '?'}°`;
    })
    .join(' | ');
}

export function statusLabel(status: SubmissionStatus): string {
  switch (status) {
    case 'received':
      return 'Recibida';
    case 'overdue':
      return 'No envió (Rezagado)';
    default:
      return 'Pendiente';
  }
}

export function formatTimeShort(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-PY', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function getOrderedDistricts(services: ServiceItem[]): string[] {
  const set = new Set(services.map((s) => s.district));
  const ordered = DISTRICT_ORDER.filter((d) => set.has(d));
  for (const d of set) {
    if (!ordered.includes(d)) ordered.push(d);
  }
  return ordered;
}

export function exportToExcel(
  weekKey: string,
  services: ServiceItem[],
  weekData: WeekData,
  regionTitle: string
): void {
  const activeServices = services.filter((s) => s.active);
  const districts = getOrderedDistricts(activeServices);
  const mondayLabel = formatMondaySpanish(weekKey);

  // Sheet 1: Resumen por Distrito
  const summaryRows: Array<Record<string, string | number>> = districts.map((district) => {
    const items = activeServices.filter((s) => s.district === district);
    const received = items.filter(
      (s) => weekData.records[s.id]?.status === 'received'
    ).length;
    const overdue = items.filter(
      (s) => weekData.records[s.id]?.status === 'overdue'
    ).length;
    const pending = items.length - received - overdue;
    const pct = items.length > 0 ? Math.round((received / items.length) * 100) : 0;

    return {
      Distrito: district,
      'Total Servicios': items.length,
      Recibidas: received,
      Pendientes: pending,
      'No Envió (Rezagados)': overdue,
      'Cumplimiento (%)': `${pct}%`,
    };
  });

  const totalReceived = activeServices.filter(
    (s) => weekData.records[s.id]?.status === 'received'
  ).length;
  const totalOverdue = activeServices.filter(
    (s) => weekData.records[s.id]?.status === 'overdue'
  ).length;
  const totalPending = activeServices.length - totalReceived - totalOverdue;
  const totalPct =
    activeServices.length > 0
      ? Math.round((totalReceived / activeServices.length) * 100)
      : 0;

  summaryRows.push({
    Distrito: 'TOTAL GENERAL',
    'Total Servicios': activeServices.length,
    Recibidas: totalReceived,
    Pendientes: totalPending,
    'No Envió (Rezagados)': totalOverdue,
    'Cumplimiento (%)': `${totalPct}%`,
  });

  // Sheet 2: Planilla Detallada
  const detailRows = activeServices.map((srv, index) => {
    const rec = weekData.records[srv.id];
    const status = rec?.status || 'pending';
    const readings = getRecordReadings(rec);
    const first = readings[0];
    return {
      'N°': index + 1,
      Distrito: srv.district,
      Servicio: srv.name,
      Estado: statusLabel(status),
      'Fecha / Hora Recepción': formatTimeShort(rec?.receivedAt),
      'Temp. Mín (°C)': first?.minTemp || rec?.minTemp || '',
      'Temp. Máx (°C)': first?.maxTemp || rec?.maxTemp || '',
      'Lecturas Termómetros': formatReadingsSummary(rec),
      'Alerta Cadena Frío': hasAnyColdChainAlert(rec) ? 'SÍ' : 'No',
      Observaciones: formatObservationsSummary(rec),
      Responsable: srv.responsible || '',
      WhatsApp: srv.whatsapp || '',
      Correo: srv.email || '',
      'Último Recordatorio': formatTimeShort(rec?.reminderSentAt),
    };
  });

  // Sheet 3: Rezagados
  const laggingRows = activeServices
    .filter((srv) => (weekData.records[srv.id]?.status || 'pending') !== 'received')
    .map((srv, index) => {
      const rec = weekData.records[srv.id];
      return {
        'N°': index + 1,
        Distrito: srv.district,
        Servicio: srv.name,
        Estado: statusLabel(rec?.status || 'pending'),
        Responsable: srv.responsible || '',
        WhatsApp: srv.whatsapp || '',
        Correo: srv.email || '',
        'Recordatorio Enviado': formatTimeShort(rec?.reminderSentAt),
      };
    });

  const wb = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 24 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Distritos');

  const wsDetail = XLSX.utils.json_to_sheet(detailRows);
  wsDetail['!cols'] = [
    { wch: 5 },
    { wch: 20 },
    { wch: 28 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 28 },
    { wch: 18 },
    { wch: 30 },
    { wch: 20 },
    { wch: 16 },
    { wch: 24 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle Servicios');

  const wsLagging = XLSX.utils.json_to_sheet(
    laggingRows.length > 0
      ? laggingRows
      : [{ Mensaje: `Todos los servicios cumplieron el ${mondayLabel}.` }]
  );
  wsLagging['!cols'] = [
    { wch: 5 },
    { wch: 20 },
    { wch: 28 },
    { wch: 20 },
    { wch: 20 },
    { wch: 16 },
    { wch: 24 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsLagging, 'Rezagados');

  wb.Props = {
    Title: `Control de Temperatura - ${mondayLabel}`,
    Subject: regionTitle,
    CreatedDate: new Date(),
  };

  XLSX.writeFile(wb, `Control_Temperatura_Lunes_${weekKey}.xlsx`);
}

export function exportToPdf(
  weekKey: string,
  services: ServiceItem[],
  weekData: WeekData,
  regionTitle: string,
  coordinatorName: string
): void {
  const activeServices = services.filter((s) => s.active);
  const districts = getOrderedDistricts(activeServices);
  const mondayLabel = formatMondaySpanish(weekKey);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header
  doc.setFillColor(3, 105, 161);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORME SEMANAL DE CONTROL DE TEMPERATURA', 14, 11);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${regionTitle}  |  ${mondayLabel}`, 14, 18);
  doc.text(`Emitido: ${new Date().toLocaleDateString('es-PY')}`, 196, 18, {
    align: 'right',
  });

  // KPI summary
  const receivedCount = activeServices.filter(
    (s) => weekData.records[s.id]?.status === 'received'
  ).length;
  const overdueCount = activeServices.filter(
    (s) => weekData.records[s.id]?.status === 'overdue'
  ).length;
  const pendingCount = activeServices.length - receivedCount - overdueCount;
  const pct =
    activeServices.length > 0
      ? Math.round((receivedCount / activeServices.length) * 100)
      : 0;

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Cumplimiento Global: ${pct}% (${receivedCount}/${activeServices.length} recibidas)   ·   Pendientes: ${pendingCount}   ·   Rezagados: ${overdueCount}`,
    14,
    34
  );

  // District summary table
  const districtBody = districts.map((d) => {
    const items = activeServices.filter((s) => s.district === d);
    const rec = items.filter((s) => weekData.records[s.id]?.status === 'received').length;
    const ov = items.filter((s) => weekData.records[s.id]?.status === 'overdue').length;
    const pen = items.length - rec - ov;
    const dpct = items.length > 0 ? Math.round((rec / items.length) * 100) : 0;
    return [d, String(items.length), String(rec), String(pen), String(ov), `${dpct}%`];
  });

  autoTable(doc, {
    startY: 38,
    head: [['Distrito', 'Servicios', 'Recibidas', 'Pendientes', 'No Envió', 'Cumplimiento']],
    body: districtBody,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  const afterDistrictY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ||
    110;

  // Service detail table
  const detailBody = activeServices.map((srv, i) => {
    const rec = weekData.records[srv.id];
    const st = rec?.status || 'pending';
    const tempRange = formatReadingsSummary(rec);
    return [
      String(i + 1),
      srv.district,
      srv.name,
      statusLabel(st),
      formatTimeShort(rec?.receivedAt),
      tempRange,
      formatObservationsSummary(rec),
    ];
  });

  autoTable(doc, {
    startY: afterDistrictY + 6,
    head: [['#', 'Distrito', 'Servicio', 'Estado', 'Recepción', 'Rango T°', 'Observaciones']],
    body: detailBody,
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    headStyles: { fillColor: [3, 105, 161], textColor: 255 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const val = String(data.cell.raw || '');
        if (val === 'Recibida') {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = 'bold';
        } else if (val.includes('No envió')) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [217, 119, 6];
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Footer signature line on last page
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${coordinatorName}`, 14, 287);
    doc.text(`Página ${p} de ${pageCount}`, 196, 287, { align: 'right' });
  }

  doc.save(`Informe_Temperatura_${weekKey}.pdf`);
}

export function exportStandaloneOfflineHtml(db: AppDatabase, weekKey: string): void {
  const weekData = db.weeks[weekKey] || {
    weekKey,
    updatedAt: new Date().toISOString(),
    records: {},
  };
  const activeServices = db.services.filter((s) => s.active);
  const mondayLabel = formatMondaySpanish(weekKey);
  const receivedCount = activeServices.filter(
    (s) => weekData.records[s.id]?.status === 'received'
  ).length;
  const pct =
    activeServices.length > 0
      ? Math.round((receivedCount / activeServices.length) * 100)
      : 0;

  const payloadJson = JSON.stringify({
    weekKey,
    regionTitle: db.regionTitle,
    coordinatorName: db.coordinatorName,
    services: activeServices,
    records: weekData.records,
  }).replace(/</g, '\\u003c');

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Control de Temperatura Offline — ${mondayLabel}</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 24px 16px; }
  .head { background: #0369a1; color: #fff; padding: 20px 24px; border-radius: 12px; margin-bottom: 16px; }
  .head h1 { margin: 0 0 4px; font-size: 20px; }
  .head p { margin: 0; font-size: 13px; opacity: 0.9; }
  .bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; font-size: 13px; }
  .kpi strong { font-size: 20px; display: block; }
  button, select, input { font: inherit; padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; }
  button.primary { background: #0369a1; color: #fff; border-color: #0369a1; cursor: pointer; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
  th, td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
  th { background: #f1f5f9; font-weight: 600; }
  .st-received { color: #15803d; font-weight: 700; }
  .st-overdue { color: #dc2626; font-weight: 700; }
  .st-pending { color: #b45309; font-weight: 600; }
  @media print { .no-print { display: none; } body { background: #fff; } }
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <h1>${escapeHtml(db.regionTitle)}</h1>
    <p>Control de Temperatura Offline · ${escapeHtml(mondayLabel)} · Cumplimiento inicial: ${pct}% (${receivedCount}/${activeServices.length})</p>
  </div>
  <div class="bar no-print">
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <input id="q" type="search" placeholder="Buscar servicio o distrito..." />
      <select id="f">
        <option value="all">Todos los estados</option>
        <option value="received">Recibidas</option>
        <option value="pending">Pendientes</option>
        <option value="overdue">No envió</option>
      </select>
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="window.print()" class="primary">Imprimir Informe</button>
    </div>
  </div>
  <div id="stats" class="bar"></div>
  <table>
    <thead>
      <tr><th>Distrito</th><th>Servicio</th><th>Estado</th><th>Observaciones</th></tr>
    </thead>
    <tbody id="rows"></tbody>
  </table>
</div>
<script>
  const DATA = ${payloadJson};
  const LS_KEY = "controlterm_portable_" + DATA.weekKey;
  const saved = localStorage.getItem(LS_KEY);
  const records = saved ? JSON.parse(saved) : DATA.records || {};

  function save() { localStorage.setItem(LS_KEY, JSON.stringify(records)); render(); }

  function render() {
    const q = document.getElementById("q").value.toLowerCase();
    const f = document.getElementById("f").value;
    let rec = 0, pen = 0, ov = 0;
    const tbody = document.getElementById("rows");
    tbody.innerHTML = "";
    DATA.services.forEach(s => {
      const r = records[s.id] || { status: "pending" };
      if (r.status === "received") rec++;
      else if (r.status === "overdue") ov++;
      else pen++;
      if (f !== "all" && r.status !== f) return;
      if (q && !(s.name.toLowerCase().includes(q) || s.district.toLowerCase().includes(q))) return;
      const tr = document.createElement("tr");
      const cls = r.status === "received" ? "st-received" : (r.status === "overdue" ? "st-overdue" : "st-pending");
      const lbl = r.status === "received" ? "Recibida" : (r.status === "overdue" ? "No envió" : "Pendiente");
      tr.innerHTML = "<td>" + s.district + "</td><td><strong>" + s.name + "</strong></td><td class='" + cls + "'>" + lbl + "</td><td></td>";
      const tdSel = tr.children[2];
      const sel = document.createElement("select");
      sel.className = "no-print";
      [["received","Recibida"],["pending","Pendiente"],["overdue","No envió"]].forEach(([v,t]) => {
        const o = document.createElement("option"); o.value = v; o.textContent = t;
        if (r.status === v) o.selected = true;
        sel.appendChild(o);
      });
      sel.onchange = () => { records[s.id] = { ...(records[s.id]||{}), status: sel.value }; save(); };
      tdSel.innerHTML = ""; tdSel.appendChild(sel);
      const inp = document.createElement("input");
      inp.value = r.observation || "";
      inp.placeholder = "Observación...";
      inp.onchange = () => { records[s.id] = { ...(records[s.id]||{}), status: r.status, observation: inp.value }; save(); };
      tr.children[3].appendChild(inp);
      tbody.appendChild(tr);
    });
    const tot = DATA.services.length || 1;
    document.getElementById("stats").innerHTML =
      "<div class='kpi'>Cumplimiento<strong>" + Math.round((rec/tot)*100) + "% (" + rec + "/" + DATA.services.length + ")</strong></div>" +
      "<div class='kpi'>Recibidas<strong>" + rec + "</strong></div>" +
      "<div class='kpi'>Pendientes<strong>" + pen + "</strong></div>" +
      "<div class='kpi'>No envió<strong>" + ov + "</strong></div>";
  }
  document.getElementById("q").oninput = render;
  document.getElementById("f").onchange = render;
  render();
</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ControlTerm_Offline_${weekKey}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportFullLocalHtmlApp(
  db: AppDatabase,
  weekKey: string
): Promise<'full' | 'snapshot'> {
  try {
    const res = await fetch('./ControlTerm_App_Completa.html', { cache: 'no-store' });
    if (res.ok) {
      const templateHtml = await res.text();
      if (templateHtml.includes('<div id="root"></div>')) {
        const seedJson = JSON.stringify(db)
          .replace(/</g, '\\u003c')
          .replace(/>/g, '\\u003e');
        const seedTag = `<script>window.__CONTROLTERM_SEED_DB__=${seedJson};</script>`;
        const injected = templateHtml.replace(
          '<div id="root"></div>',
          () => `<div id="root"></div>\n${seedTag}`
        );
        const blob = new Blob([injected], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ControlTerm_Local_Completa_${weekKey}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return 'full';
      }
    }
  } catch {
    // Fallback below
  }
  exportStandaloneOfflineHtml(db, weekKey);
  return 'snapshot';
}

function escapeHtml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
