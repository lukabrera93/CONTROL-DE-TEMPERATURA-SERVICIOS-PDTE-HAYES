import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Mail,
  MessageCircle,
  Plus,
  Search,
  Thermometer,
  UserPen,
  X,
  XCircle,
} from 'lucide-react';
import { ContactEditModal } from './ContactEditModal';
import { DISTRICT_ORDER } from '../data/initialServices';
import {
  ReminderTemplates,
  ServiceItem,
  SubmissionStatus,
  ThermometerReading,
  WeekData,
  WeeklyRecord,
} from '../types/control';
import { formatTimeShort, getRecordReadings } from '../utils/exporters';
import {
  buildMailtoUrl,
  buildWhatsAppUrl,
  interpolateTemplate,
} from '../utils/reminders';

interface WeeklyChecklistProps {
  services: ServiceItem[];
  weekKey: string;
  weekData: WeekData;
  coordinatorName: string;
  templates: ReminderTemplates;
  selectedDistrictFilter: string;
  onChangeDistrictFilter: (district: string) => void;
  onUpdateRecord: (serviceId: string, patch: Partial<WeeklyRecord>) => void;
  onMarkDistrictReceived: (district: string) => void;
  onUpdateServiceContact: (
    serviceId: string,
    patch: Partial<Pick<ServiceItem, 'responsible' | 'whatsapp' | 'email'>>
  ) => void;
  onOpenManageServices: () => void;
}

export const WeeklyChecklist: React.FC<WeeklyChecklistProps> = ({
  services,
  weekKey,
  weekData,
  coordinatorName,
  templates,
  selectedDistrictFilter,
  onChangeDistrictFilter,
  onUpdateRecord,
  onMarkDistrictReceived,
  onUpdateServiceContact,
  onOpenManageServices,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionStatus>('all');
  const [collapsedDistricts, setCollapsedDistricts] = useState<Record<string, boolean>>({});
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [contactHint, setContactHint] = useState<string | null>(null);

  const activeServices = useMemo(
    () => services.filter((s) => s.active),
    [services]
  );

  const orderedDistricts = useMemo(() => {
    const set = new Set(activeServices.map((s) => s.district));
    const ordered = DISTRICT_ORDER.filter((d) => set.has(d));
    for (const d of set) {
      if (!ordered.includes(d)) ordered.push(d);
    }
    return ordered;
  }, [activeServices]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeServices.filter((srv) => {
      if (
        selectedDistrictFilter !== 'ALL' &&
        srv.district !== selectedDistrictFilter
      ) {
        return false;
      }
      const st = weekData.records[srv.id]?.status || 'pending';
      if (statusFilter !== 'all' && st !== statusFilter) {
        return false;
      }
      if (q) {
        const hay = `${srv.name} ${srv.district} ${srv.responsible || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeServices, selectedDistrictFilter, statusFilter, searchQuery, weekData]);

  const groupedByDistrict = useMemo(() => {
    const map = new Map<string, ServiceItem[]>();
    for (const d of orderedDistricts) {
      const items = filteredServices.filter((s) => s.district === d);
      if (items.length > 0) {
        map.set(d, items);
      }
    }
    return map;
  }, [orderedDistricts, filteredServices]);

  const counts = useMemo(() => {
    let received = 0;
    let pending = 0;
    let overdue = 0;
    for (const srv of activeServices) {
      const st = weekData.records[srv.id]?.status || 'pending';
      if (st === 'received') received++;
      else if (st === 'overdue') overdue++;
      else pending++;
    }
    return { total: activeServices.length, received, pending, overdue };
  }, [activeServices, weekData]);

  const toggleDistrictCollapse = (district: string) => {
    setCollapsedDistricts((prev) => ({ ...prev, [district]: !prev[district] }));
  };

  const handleSetStatus = (serviceId: string, nextStatus: SubmissionStatus) => {
    const current = weekData.records[serviceId];
    onUpdateRecord(serviceId, {
      status: nextStatus,
      receivedAt:
        nextStatus === 'received'
          ? current?.receivedAt || new Date().toISOString()
          : undefined,
    });
  };

  const commitReadings = (
    serviceId: string,
    currentStatus: SubmissionStatus,
    nextReadings: ThermometerReading[]
  ) => {
    const first = nextReadings[0];
    const anyAlert = nextReadings.some((r) => Boolean(r.coldChainAlert));
    const combinedObs =
      nextReadings.length <= 1
        ? first?.observation || ''
        : nextReadings
            .map((r, i) => {
              const obs = (r.observation || '').trim();
              if (!obs) return '';
              const tag = r.label?.trim() || `T${i + 1}`;
              return `${tag}: ${obs}`;
            })
            .filter(Boolean)
            .join(' | ');

    onUpdateRecord(serviceId, {
      status: currentStatus,
      readings: nextReadings,
      minTemp: first?.minTemp || '',
      maxTemp: first?.maxTemp || '',
      coldChainAlert: anyAlert,
      observation: combinedObs,
    });
  };

  const handleUpdateReadingField = (
    serviceId: string,
    rec: WeeklyRecord,
    index: number,
    field: 'label' | 'minTemp' | 'maxTemp' | 'observation',
    value: string
  ) => {
    const base = getRecordReadings(rec).map((r) => ({ ...r }));
    if (!base[index]) return;
    base[index][field] = value;
    commitReadings(serviceId, rec.status || 'pending', base);
  };

  const handleToggleReadingAlert = (
    serviceId: string,
    rec: WeeklyRecord,
    index: number
  ) => {
    const base = getRecordReadings(rec).map((r) => ({ ...r }));
    if (!base[index]) return;
    base[index].coldChainAlert = !base[index].coldChainAlert;
    commitReadings(serviceId, rec.status || 'pending', base);
  };

  const handleAddReading = (serviceId: string, rec: WeeklyRecord) => {
    const base = getRecordReadings(rec).map((r, i) => ({
      ...r,
      label: r.label?.trim() || `T${i + 1}`,
    }));
    const nextIdx = base.length + 1;
    base.push({
      id: `t-${nextIdx}-${Date.now()}`,
      label: `T${nextIdx}`,
      minTemp: '',
      maxTemp: '',
      coldChainAlert: false,
      observation: '',
    });
    commitReadings(serviceId, rec.status || 'pending', base);
  };

  const handleRemoveReading = (
    serviceId: string,
    rec: WeeklyRecord,
    index: number
  ) => {
    const base = getRecordReadings(rec);
    if (base.length <= 1) return;
    const nextReadings = base.filter((_, idx) => idx !== index);
    commitReadings(serviceId, rec.status || 'pending', nextReadings);
  };

  const openContactModal = (srv: ServiceItem, hint: string | null = null) => {
    setContactHint(hint);
    setEditingService(srv);
  };

  const sendWhatsAppNow = (srv: ServiceItem) => {
    const msg = interpolateTemplate(templates.whatsappTemplate, {
      service: srv,
      weekKey,
      coordinatorName,
    });
    const url = buildWhatsAppUrl(srv.whatsapp, msg);
    onUpdateRecord(srv.id, {
      reminderSentAt: new Date().toISOString(),
      reminderChannel: 'whatsapp',
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const sendEmailNow = (srv: ServiceItem) => {
    const subject = interpolateTemplate(templates.emailSubjectTemplate, {
      service: srv,
      weekKey,
      coordinatorName,
    });
    const body = interpolateTemplate(templates.emailBodyTemplate, {
      service: srv,
      weekKey,
      coordinatorName,
    });
    const url = buildMailtoUrl(srv.email, subject, body);
    onUpdateRecord(srv.id, {
      reminderSentAt: new Date().toISOString(),
      reminderChannel: 'email',
    });
    window.location.href = url;
  };

  const triggerQuickWhatsApp = (srv: ServiceItem) => {
    if (!srv.whatsapp?.trim()) {
      openContactModal(
        srv,
        'Agrega el número de WhatsApp de este servicio para enviarlo directo, o pulsa "Guardar y WhatsApp" para elegir el contacto manualmente.'
      );
      return;
    }
    sendWhatsAppNow(srv);
  };

  const triggerQuickEmail = (srv: ServiceItem) => {
    if (!srv.email?.trim()) {
      openContactModal(
        srv,
        'Agrega el correo electrónico de este servicio para preparar el envío automáticamente.'
      );
      return;
    }
    sendEmailNow(srv);
  };

  return (
    <div className="space-y-5">
      {/* Filter & Search Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar servicio, distrito o responsable..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-700 focus:outline-none"
              />
            </div>

            <select
              value={selectedDistrictFilter}
              onChange={(e) => onChangeDistrictFilter(e.target.value)}
              aria-label="Filtrar por distrito"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:border-sky-700 focus:outline-none"
            >
              <option value="ALL">Todos los distritos ({orderedDistricts.length})</option>
              {orderedDistricts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onOpenManageServices}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-700 bg-white px-3 py-2 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Agregar Servicio</span>
            </button>
          </div>

          {/* Interactive Status Filter Segmented Buttons */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('received')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === 'received'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Recibidas ({counts.received})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pendientes ({counts.pending})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('overdue')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === 'overdue'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              No envió ({counts.overdue})
            </button>
          </div>
        </div>
      </div>

      {/* Grouped District Sections */}
      {groupedByDistrict.size === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-800">
            No se encontraron servicios con los filtros actuales
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Prueba limpiar la búsqueda o seleccionar otro distrito.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              onChangeDistrictFilter('ALL');
            }}
            className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            Mostrar todos los servicios
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(groupedByDistrict.entries()).map(([district, items]) => {
            const districtAllItems = activeServices.filter(
              (s) => s.district === district
            );
            const receivedCount = districtAllItems.filter(
              (s) => weekData.records[s.id]?.status === 'received'
            ).length;
            const isCollapsed = !!collapsedDistricts[district];
            const allDone =
              districtAllItems.length > 0 &&
              receivedCount === districtAllItems.length;

            return (
              <section
                key={district}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                {/* District Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleDistrictCollapse(district)}
                    className="flex items-center gap-2 text-left cursor-pointer"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    )}
                    <h3 className="text-sm font-bold tracking-tight text-slate-900">
                      {district}
                    </h3>
                    <span className="text-xs text-slate-500 tabular-nums">
                      · {receivedCount}/{districtAllItems.length} recibidas
                    </span>
                  </button>

                  {!allDone && (
                    <button
                      type="button"
                      onClick={() => onMarkDistrictReceived(district)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-emerald-600 hover:text-emerald-700 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      <span>Marcar distrito completo</span>
                    </button>
                  )}
                </div>

                {/* Service Rows */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-100">
                    {items.map((srv) => {
                      const rawRec = weekData.records?.[srv.id];
                      const status: SubmissionStatus = rawRec?.status || 'pending';
                      const rec: WeeklyRecord = {
                        ...(rawRec || {}),
                        status,
                      };
                      const isLagging = status !== 'received';

                      return (
                        <div
                          key={srv.id}
                          className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-slate-50/60 lg:flex-row lg:items-center lg:justify-between"
                        >
                          {/* Service Info & Prominent Contact Edit */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {srv.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => openContactModal(srv)}
                                title="Editar responsable, número de WhatsApp y correo"
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                                  srv.whatsapp || srv.email || srv.responsible
                                    ? 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800'
                                    : 'border-sky-200 bg-sky-50/70 text-sky-800 hover:bg-sky-100'
                                }`}
                              >
                                <UserPen className="h-3 w-3" />
                                <span>
                                  {srv.whatsapp || srv.email || srv.responsible
                                    ? 'Editar contacto'
                                    : '+ Editar contacto'}
                                </span>
                              </button>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 tabular-nums">
                              {(srv.responsible || srv.whatsapp || srv.email) && (
                                <span className="text-slate-600">
                                  {[srv.responsible, srv.whatsapp, srv.email]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              )}
                              {status === 'received' && rec.receivedAt && (
                                <>
                                  {(srv.responsible || srv.whatsapp || srv.email) && (
                                    <span aria-hidden="true">·</span>
                                  )}
                                  <span className="text-emerald-700">
                                    Recibida: {formatTimeShort(rec.receivedAt)}
                                  </span>
                                </>
                              )}
                              {rec.reminderSentAt && isLagging && (
                                <>
                                  {(srv.responsible || srv.whatsapp || srv.email) && (
                                    <span aria-hidden="true">·</span>
                                  )}
                                  <span className="text-sky-700">
                                    Recordatorio ({rec.reminderChannel || 'enviado'}):{' '}
                                    {formatTimeShort(rec.reminderSentAt)}
                                  </span>
                                </>
                              )}
                              {!srv.responsible &&
                                !srv.whatsapp &&
                                !srv.email &&
                                !rec.receivedAt &&
                                !rec.reminderSentAt && (
                                  <span>Sin número ni correo guardado</span>
                                )}
                            </div>
                          </div>

                          {/* Per-Thermometer Readings (Temp + Alerta T° + Observación) */}
                          {(() => {
                            const readings = getRecordReadings(rec);
                            const hasMultipleReadings = readings.length > 1;
                            return (
                              <div className="flex flex-col gap-1.5">
                                {readings.map((reading, idx) => {
                                  const readingTag = reading.label?.trim() || `T${idx + 1}`;
                                  return (
                                    <div
                                      key={reading.id || idx}
                                      className="flex flex-wrap items-center gap-1.5"
                                    >
                                      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1">
                                        <Thermometer className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        {hasMultipleReadings && (
                                          <input
                                            type="text"
                                            value={reading.label ?? `T${idx + 1}`}
                                            onChange={(e) =>
                                              handleUpdateReadingField(
                                                srv.id,
                                                rec,
                                                idx,
                                                'label',
                                                e.target.value
                                              )
                                            }
                                            placeholder={`T${idx + 1}`}
                                            aria-label={`Nombre termómetro ${idx + 1} ${srv.name}`}
                                            className="w-16 rounded bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 placeholder:text-slate-400 focus:bg-sky-50 focus:outline-none"
                                          />
                                        )}
                                        <input
                                          type="text"
                                          value={reading.minTemp || ''}
                                          onChange={(e) =>
                                            handleUpdateReadingField(
                                              srv.id,
                                              rec,
                                              idx,
                                              'minTemp',
                                              e.target.value
                                            )
                                          }
                                          placeholder="Mín"
                                          aria-label={`Temperatura mínima ${readingTag} ${srv.name}`}
                                          className="w-11 bg-transparent font-mono text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none tabular-nums"
                                        />
                                        <span className="text-slate-300">/</span>
                                        <input
                                          type="text"
                                          value={reading.maxTemp || ''}
                                          onChange={(e) =>
                                            handleUpdateReadingField(
                                              srv.id,
                                              rec,
                                              idx,
                                              'maxTemp',
                                              e.target.value
                                            )
                                          }
                                          placeholder="Máx"
                                          aria-label={`Temperatura máxima ${readingTag} ${srv.name}`}
                                          className="w-11 bg-transparent font-mono text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none tabular-nums"
                                        />
                                        {hasMultipleReadings && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleRemoveReading(srv.id, rec, idx)
                                            }
                                            title="Quitar esta lectura de termómetro"
                                            aria-label={`Quitar termómetro ${idx + 1}`}
                                            className="ml-0.5 rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleToggleReadingAlert(srv.id, rec, idx)
                                        }
                                        title={`Marcar alerta de cadena de frío (${readingTag}, fuera de rango 2°C - 8°C)`}
                                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                          reading.coldChainAlert
                                            ? 'border-rose-300 bg-rose-50 text-rose-700'
                                            : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800'
                                        }`}
                                      >
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        <span className="hidden xl:inline">Alerta T°</span>
                                      </button>

                                      <input
                                        type="text"
                                        value={reading.observation || ''}
                                        onChange={(e) =>
                                          handleUpdateReadingField(
                                            srv.id,
                                            rec,
                                            idx,
                                            'observation',
                                            e.target.value
                                          )
                                        }
                                        placeholder={
                                          hasMultipleReadings
                                            ? `Observación ${readingTag}...`
                                            : 'Observación...'
                                        }
                                        aria-label={`Observación ${readingTag} ${srv.name}`}
                                        className="w-36 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-700 focus:outline-none sm:w-44"
                                      />
                                    </div>
                                  );
                                })}
                                <button
                                  type="button"
                                  onClick={() => handleAddReading(srv.id, rec)}
                                  title="Agregar otra lectura de termómetro para este servicio"
                                  className="inline-flex w-fit items-center gap-1 rounded-md border border-dashed border-slate-300 bg-slate-50/70 px-2 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-sky-400 hover:bg-sky-50 hover:text-sky-800 whitespace-nowrap cursor-pointer"
                                >
                                  <Plus className="h-3 w-3" />
                                  <span>Agregar termómetro</span>
                                </button>
                              </div>
                            );
                          })()}

                          {/* 1-Click Status Toggle Buttons + Quick Reminder */}
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                              <button
                                type="button"
                                onClick={() => handleSetStatus(srv.id, 'received')}
                                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                  status === 'received'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-emerald-700'
                                }`}
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Recibida</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetStatus(srv.id, 'pending')}
                                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                  status === 'pending'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-amber-700'
                                }`}
                              >
                                <Clock className="h-3.5 w-3.5" />
                                <span>Pendiente</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetStatus(srv.id, 'overdue')}
                                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                  status === 'overdue'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-rose-700'
                                }`}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                <span>No envió</span>
                              </button>
                            </div>

                            {isLagging && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => triggerQuickWhatsApp(srv)}
                                  title="Enviar recordatorio por WhatsApp"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 cursor-pointer"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => triggerQuickEmail(srv)}
                                  title="Enviar recordatorio por correo"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100 cursor-pointer"
                                >
                                  <Mail className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Contact Edit Modal */}
      {editingService && (
        <ContactEditModal
          service={editingService}
          hintMessage={contactHint}
          onClose={() => {
            setEditingService(null);
            setContactHint(null);
          }}
          onSave={(patch) => onUpdateServiceContact(editingService.id, patch)}
          onSaveAndSendWhatsApp={sendWhatsAppNow}
          onSaveAndSendEmail={sendEmailNow}
        />
      )}
    </div>
  );
};
