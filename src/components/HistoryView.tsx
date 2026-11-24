import React, { useMemo, useState } from 'react';
import { Check, Clock, XCircle } from 'lucide-react';
import {
  DISTRICT_ORDER,
  formatShortMonday,
  getRecentMondays,
} from '../data/initialServices';
import { AppDatabase, SubmissionStatus } from '../types/control';

interface HistoryViewProps {
  db: AppDatabase;
  currentWeekKey: string;
  onSelectWeek: (weekKey: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  db,
  currentWeekKey,
  onSelectWeek,
}) => {
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const mondays = useMemo(
    () => getRecentMondays(currentWeekKey, 8),
    [currentWeekKey]
  );

  const activeServices = useMemo(
    () => db.services.filter((s) => s.active),
    [db.services]
  );

  const orderedDistricts = useMemo(() => {
    const set = new Set(activeServices.map((s) => s.district));
    const ordered = DISTRICT_ORDER.filter((d) => set.has(d));
    for (const d of set) {
      if (!ordered.includes(d)) ordered.push(d);
    }
    return ordered;
  }, [activeServices]);

  const visibleServices = useMemo(() => {
    if (districtFilter === 'ALL') return activeServices;
    return activeServices.filter((s) => s.district === districtFilter);
  }, [activeServices, districtFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Comparativa de cumplimiento semanal
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            Historial de los Últimos 8 Lunes
          </h2>
        </div>

        <select
          value={districtFilter}
          onChange={(e) => setDistrictFilter(e.target.value)}
          aria-label="Filtrar historial por distrito"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:border-sky-700 focus:outline-none"
        >
          <option value="ALL">Todos los distritos ({activeServices.length})</option>
          {orderedDistricts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Distrito</th>
                <th className="px-4 py-3">Servicio</th>
                {mondays.map((mk) => (
                  <th key={mk} className="px-2.5 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => onSelectWeek(mk)}
                      className={`font-mono tabular-nums hover:text-sky-700 cursor-pointer ${
                        mk === currentWeekKey
                          ? 'font-bold text-sky-700 underline underline-offset-4'
                          : ''
                      }`}
                    >
                      {formatShortMonday(mk)}
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Tasa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleServices.map((srv) => {
                let receivedTotal = 0;
                return (
                  <tr key={srv.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 text-slate-500">
                      {srv.district}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">
                      {srv.name}
                    </td>
                    {mondays.map((mk) => {
                      const st: SubmissionStatus =
                        db.weeks[mk]?.records[srv.id]?.status || 'pending';
                      if (st === 'received') receivedTotal++;
                      return (
                        <td key={mk} className="px-2.5 py-2.5 text-center">
                          {st === 'received' ? (
                            <span
                              title={`Lunes ${mk}: Recibida`}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : st === 'overdue' ? (
                            <span
                              title={`Lunes ${mk}: No envió`}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-rose-50 text-rose-700"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <span
                              title={`Lunes ${mk}: Pendiente / Sin registro`}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-400"
                            >
                              <Clock className="h-3 w-3" />
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-800 tabular-nums">
                      {Math.round((receivedTotal / mondays.length) * 100)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
