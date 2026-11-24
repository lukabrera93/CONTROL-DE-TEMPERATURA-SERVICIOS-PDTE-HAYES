import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Printer,
  Send,
} from 'lucide-react';
import {
  DISTRICT_ORDER,
  formatMondaySpanish,
  formatShortMonday,
  getRecentMondays,
} from '../data/initialServices';
import { AppDatabase, WeekData } from '../types/control';
import { hasAnyColdChainAlert } from '../utils/exporters';

interface DashboardPanelProps {
  db: AppDatabase;
  weekKey: string;
  weekData: WeekData;
  onSelectDistrict: (district: string) => void;
  onGoToChecklist: () => void;
  onGoToReminders: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onPrint: () => void;
}

export const DashboardPanel: React.FC<DashboardPanelProps> = ({
  db,
  weekKey,
  weekData,
  onSelectDistrict,
  onGoToChecklist,
  onGoToReminders,
  onExportExcel,
  onExportPdf,
  onPrint,
}) => {
  const activeServices = useMemo(
    () => db.services.filter((s) => s.active),
    [db.services]
  );

  const stats = useMemo(() => {
    const total = activeServices.length;
    let received = 0;
    let overdue = 0;
    let pending = 0;
    let alerts = 0;

    for (const srv of activeServices) {
      const rec = weekData.records[srv.id];
      const st = rec?.status || 'pending';
      if (st === 'received') received++;
      else if (st === 'overdue') overdue++;
      else pending++;
      if (hasAnyColdChainAlert(rec)) alerts++;
    }

    const compliancePct = total > 0 ? Math.round((received / total) * 100) : 0;

    const districtSet = new Set(activeServices.map((s) => s.district));
    const orderedDistricts = DISTRICT_ORDER.filter((d) => districtSet.has(d));
    for (const d of districtSet) {
      if (!orderedDistricts.includes(d)) orderedDistricts.push(d);
    }

    const districtStats = orderedDistricts.map((district) => {
      const items = activeServices.filter((s) => s.district === district);
      const rec = items.filter(
        (s) => weekData.records[s.id]?.status === 'received'
      ).length;
      const ov = items.filter(
        (s) => weekData.records[s.id]?.status === 'overdue'
      ).length;
      const pen = items.length - rec - ov;
      const pct = items.length > 0 ? Math.round((rec / items.length) * 100) : 0;
      return {
        district,
        total: items.length,
        received: rec,
        pending: pen,
        overdue: ov,
        pct,
      };
    });

    const completedDistricts = districtStats.filter(
      (d) => d.total > 0 && d.received === d.total
    ).length;

    return {
      total,
      received,
      pending,
      overdue,
      lagging: pending + overdue,
      alerts,
      compliancePct,
      districtStats,
      completedDistricts,
      totalDistricts: districtStats.length,
    };
  }, [activeServices, weekData]);

  const weeklyTrend = useMemo(() => {
    const mondays = getRecentMondays(weekKey, 8);
    return mondays.map((mk) => {
      const w = db.weeks[mk];
      const total = activeServices.length;
      if (!w || total === 0) {
        return { weekKey: mk, label: formatShortMonday(mk), pct: 0, received: 0 };
      }
      const rec = activeServices.filter(
        (s) => w.records[s.id]?.status === 'received'
      ).length;
      return {
        weekKey: mk,
        label: formatShortMonday(mk),
        pct: Math.round((rec / total) * 100),
        received: rec,
      };
    });
  }, [db.weeks, weekKey, activeServices]);

  const laggingList = useMemo(
    () =>
      activeServices.filter(
        (s) => (weekData.records[s.id]?.status || 'pending') !== 'received'
      ),
    [activeServices, weekData]
  );

  return (
    <div className="space-y-6">
      {/* Top Action & Context Strip */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Monitoreo semanal de cumplimiento · {formatMondaySpanish(weekKey)}
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Panel de Progreso en Tiempo Real
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onExportExcel}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <span>Exportar Excel</span>
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="h-4 w-4 text-rose-700" />
            <span>Exportar PDF</span>
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="h-4 w-4 text-slate-700" />
            <span>Imprimir Informe</span>
          </button>
          <button
            type="button"
            onClick={onGoToChecklist}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Registrar Planillas</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 4-Column KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Cumplimiento Global
            </span>
            <CheckCircle2 className="h-4 w-4 text-sky-700" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
              {stats.compliancePct}%
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {stats.received} de {stats.total} servicios
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-sky-700 transition-all duration-300"
              style={{ width: `${stats.compliancePct}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Planillas Recibidas
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-emerald-700 tabular-nums">
              {stats.received}
            </span>
            <span className="text-xs text-slate-500">entregadas a tiempo</span>
          </div>
          <p className="mt-3 text-xs text-slate-500 tabular-nums">
            {stats.alerts > 0
              ? `${stats.alerts} con alerta de cadena de frío`
              : 'Sin alertas de temperatura registradas'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Pendientes / Rezagados
            </span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-amber-700 tabular-nums">
              {stats.lagging}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {stats.pending} pend. · {stats.overdue} no envió
            </span>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={onGoToReminders}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-900 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Enviar recordatorios ahora</span>
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Distritos al 100%
            </span>
            <AlertTriangle className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
              {stats.completedDistricts}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              de {stats.totalDistricts} distritos
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Haz clic en cualquier distrito abajo para filtrar su planilla
          </p>
        </div>
      </div>

      {/* Main Split: District Breakdown + 8-Week Trend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* District Progress Matrix */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Cumplimiento por Distrito
              </h3>
              <p className="text-xs text-slate-500">
                Progreso detallado de los {stats.totalDistricts} distritos en este lunes
              </p>
            </div>
            <span className="font-mono text-xs font-medium text-slate-500 tabular-nums">
              {stats.received}/{stats.total}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {stats.districtStats.map((d) => {
              const barColor =
                d.pct === 100
                  ? 'bg-emerald-600'
                  : d.pct >= 50
                  ? 'bg-sky-700'
                  : d.pct > 0
                  ? 'bg-amber-600'
                  : 'bg-slate-300';

              return (
                <button
                  key={d.district}
                  type="button"
                  onClick={() => onSelectDistrict(d.district)}
                  className="group block w-full rounded-lg p-2 text-left transition-colors hover:bg-slate-50 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-semibold text-slate-800 group-hover:text-sky-800 truncate">
                      {d.district}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-slate-600 tabular-nums shrink-0">
                      <span>
                        {d.received}/{d.total} recibidas
                      </span>
                      {d.overdue > 0 && (
                        <span className="font-medium text-rose-700">
                          · {d.overdue} no envió
                        </span>
                      )}
                      <span className="w-10 text-right font-mono font-semibold text-slate-900">
                        {d.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                      style={{ width: `${d.pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: 8-Week Trend & Immediate Lagging Preview */}
        <div className="space-y-6 lg:col-span-5">
          {/* Trend Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Tendencia Últimos 8 Lunes
                </h3>
                <p className="text-xs text-slate-500">
                  Porcentaje histórico de planillas recibidas
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex h-44 items-end justify-between gap-2 border-b border-slate-200 pb-2">
                {weeklyTrend.map((point) => {
                  const isCurrent = point.weekKey === weekKey;
                  return (
                    <div
                      key={point.weekKey}
                      className="flex flex-1 flex-col items-center gap-1.5 h-full justify-end"
                    >
                      <span className="font-mono text-[11px] font-medium text-slate-600 tabular-nums">
                        {point.pct}%
                      </span>
                      <div className="relative flex w-full max-w-[34px] flex-1 items-end rounded-t-md bg-slate-100 overflow-hidden">
                        <div
                          className={`w-full rounded-t-md transition-all duration-300 ${
                            isCurrent ? 'bg-sky-700' : 'bg-slate-400'
                          }`}
                          style={{ height: `${Math.max(point.pct, 3)}%` }}
                          title={`Lunes ${point.weekKey}: ${point.pct}% (${point.received} servicios)`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between gap-2">
                {weeklyTrend.map((point) => {
                  const isCurrent = point.weekKey === weekKey;
                  return (
                    <div
                      key={point.weekKey}
                      className={`flex-1 text-center font-mono text-[11px] tabular-nums ${
                        isCurrent ? 'font-bold text-sky-700' : 'text-slate-500'
                      }`}
                    >
                      {point.label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Lagging Summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Rezagados Prioritarios
                </h3>
                <p className="text-xs text-slate-500">
                  {laggingList.length === 0
                    ? 'Todos los servicios enviaron su planilla'
                    : `${laggingList.length} servicios pendientes de recepción`}
                </p>
              </div>
              {laggingList.length > 0 && (
                <button
                  type="button"
                  onClick={onGoToReminders}
                  className="text-xs font-semibold text-sky-700 hover:text-sky-900 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Gestionar todos
                </button>
              )}
            </div>

            {laggingList.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                <p className="mt-2 text-sm font-medium text-slate-800">
                  100% de cumplimiento alcanzado
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Ya puedes imprimir o exportar el informe oficial de esta semana.
                </p>
              </div>
            ) : (
              <div className="mt-3 divide-y divide-slate-100">
                {laggingList.slice(0, 6).map((srv) => {
                  const rec = weekData.records[srv.id];
                  const isOverdue = rec?.status === 'overdue';
                  return (
                    <div
                      key={srv.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">
                          {srv.name}
                        </p>
                        <p className="truncate text-slate-500">{srv.district}</p>
                      </div>
                      <span
                        className={`font-semibold whitespace-nowrap shrink-0 ${
                          isOverdue ? 'text-rose-700' : 'text-amber-700'
                        }`}
                      >
                        {isOverdue ? 'No envió' : 'Pendiente'}
                      </span>
                    </div>
                  );
                })}
                {laggingList.length > 6 && (
                  <p className="pt-3 text-center text-xs text-slate-500">
                    Y {laggingList.length - 6} servicios más en la pestaña Rezagados.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
