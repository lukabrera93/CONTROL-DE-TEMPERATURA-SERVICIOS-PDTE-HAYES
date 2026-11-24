import React from 'react';
import { DISTRICT_ORDER, formatMondaySpanish } from '../data/initialServices';
import { AppDatabase, WeekData } from '../types/control';
import {
  formatObservationsSummary,
  formatReadingsSummary,
  formatTimeShort,
  statusLabel,
} from '../utils/exporters';

interface PrintableReportProps {
  db: AppDatabase;
  weekKey: string;
  weekData: WeekData;
}

export const PrintableReport: React.FC<PrintableReportProps> = ({
  db,
  weekKey,
  weekData,
}) => {
  const activeServices = db.services.filter((s) => s.active);
  const set = new Set(activeServices.map((s) => s.district));
  const orderedDistricts = DISTRICT_ORDER.filter((d) => set.has(d));
  for (const d of set) {
    if (!orderedDistricts.includes(d)) orderedDistricts.push(d);
  }

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

  return (
    <div className="hidden print:block text-slate-900">
      <div className="border-b-2 border-slate-900 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold uppercase tracking-tight">
              Informe Semanal de Control de Planillas de Temperatura
            </h1>
            <p className="text-xs text-slate-700">
              {db.regionTitle} · {formatMondaySpanish(weekKey)}
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div>Fecha de impresión: {new Date().toLocaleDateString('es-PY')}</div>
            <div className="font-mono font-bold text-slate-900">
              Cumplimiento: {pct}% ({receivedCount}/{activeServices.length})
            </div>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="my-4 grid grid-cols-4 gap-3 text-xs">
        <div className="rounded border border-slate-300 p-2.5">
          <div className="text-slate-500">Total Servicios</div>
          <div className="mt-0.5 font-mono text-base font-bold">{activeServices.length}</div>
        </div>
        <div className="rounded border border-slate-300 p-2.5">
          <div className="text-slate-500">Planillas Recibidas</div>
          <div className="mt-0.5 font-mono text-base font-bold text-emerald-700">
            {receivedCount}
          </div>
        </div>
        <div className="rounded border border-slate-300 p-2.5">
          <div className="text-slate-500">Pendientes</div>
          <div className="mt-0.5 font-mono text-base font-bold text-amber-700">
            {pendingCount}
          </div>
        </div>
        <div className="rounded border border-slate-300 p-2.5">
          <div className="text-slate-500">No Envió (Rezagados)</div>
          <div className="mt-0.5 font-mono text-base font-bold text-rose-700">
            {overdueCount}
          </div>
        </div>
      </div>

      {/* District Summary */}
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-700">
        Resumen por Distrito
      </h2>
      <table className="mb-5 w-full border-collapse text-[11px]">
        <thead>
          <tr className="border border-slate-300 bg-slate-100">
            <th className="border border-slate-300 px-2 py-1.5 text-left">Distrito</th>
            <th className="border border-slate-300 px-2 py-1.5 text-center">Total</th>
            <th className="border border-slate-300 px-2 py-1.5 text-center">Recibidas</th>
            <th className="border border-slate-300 px-2 py-1.5 text-center">Pendientes</th>
            <th className="border border-slate-300 px-2 py-1.5 text-center">No Envió</th>
            <th className="border border-slate-300 px-2 py-1.5 text-right">% Cumplimiento</th>
          </tr>
        </thead>
        <tbody>
          {orderedDistricts.map((d) => {
            const items = activeServices.filter((s) => s.district === d);
            const rec = items.filter(
              (s) => weekData.records[s.id]?.status === 'received'
            ).length;
            const ov = items.filter(
              (s) => weekData.records[s.id]?.status === 'overdue'
            ).length;
            const pen = items.length - rec - ov;
            const dpct = items.length > 0 ? Math.round((rec / items.length) * 100) : 0;
            return (
              <tr key={d}>
                <td className="border border-slate-300 px-2 py-1 font-semibold">{d}</td>
                <td className="border border-slate-300 px-2 py-1 text-center font-mono">
                  {items.length}
                </td>
                <td className="border border-slate-300 px-2 py-1 text-center font-mono">
                  {rec}
                </td>
                <td className="border border-slate-300 px-2 py-1 text-center font-mono">
                  {pen}
                </td>
                <td className="border border-slate-300 px-2 py-1 text-center font-mono">
                  {ov}
                </td>
                <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold">
                  {dpct}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Complete Service Table */}
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-700">
        Detalle por Servicio
      </h2>
      <table className="w-full border-collapse text-[10.5px]">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-2 py-1.5 text-left">#</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left">Distrito</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left">Servicio</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left">Estado</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left">Recepción</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left">Temp. (°C)</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {activeServices.map((srv, idx) => {
            const rec = weekData.records[srv.id];
            const st = rec?.status || 'pending';
            const tempStr = formatReadingsSummary(rec);
            return (
              <tr key={srv.id} className="print-break-inside-avoid">
                <td className="border border-slate-300 px-2 py-1 font-mono">{idx + 1}</td>
                <td className="border border-slate-300 px-2 py-1">{srv.district}</td>
                <td className="border border-slate-300 px-2 py-1 font-semibold">
                  {srv.name}
                </td>
                <td className="border border-slate-300 px-2 py-1 font-semibold">
                  {statusLabel(st)}
                </td>
                <td className="border border-slate-300 px-2 py-1 font-mono">
                  {formatTimeShort(rec?.receivedAt)}
                </td>
                <td className="border border-slate-300 px-2 py-1 font-mono">{tempStr}</td>
                <td className="border border-slate-300 px-2 py-1">
                  {formatObservationsSummary(rec)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-8 flex justify-between pt-6 text-xs text-slate-600 print-break-inside-avoid">
        <div>
          <div className="w-56 border-t border-slate-400 pt-1">
            {db.coordinatorName}
          </div>
          <div>Responsable de Control Regional</div>
        </div>
        <div className="text-right">
          <div className="w-44 border-t border-slate-400 pt-1">V° B° Jefatura</div>
        </div>
      </div>
    </div>
  );
};
