import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Mail,
  MessageCircle,
  Play,
  RotateCcw,
  Send,
  UserPen,
  XCircle,
} from 'lucide-react';
import { ContactEditModal } from './ContactEditModal';
import { DEFAULT_TEMPLATES, formatMondaySpanish } from '../data/initialServices';
import {
  ReminderTemplates,
  ServiceItem,
  WeekData,
  WeeklyRecord,
} from '../types/control';
import { formatTimeShort } from '../utils/exporters';
import {
  buildGroupSummaryText,
  buildMailtoUrl,
  buildWhatsAppUrl,
  interpolateTemplate,
} from '../utils/reminders';

interface RemindersCenterProps {
  services: ServiceItem[];
  weekKey: string;
  weekData: WeekData;
  regionTitle: string;
  coordinatorName: string;
  templates: ReminderTemplates;
  onUpdateTemplates: (next: ReminderTemplates) => void;
  onUpdateRecord: (serviceId: string, patch: Partial<WeeklyRecord>) => void;
  onUpdateServiceContact: (
    serviceId: string,
    patch: Partial<Pick<ServiceItem, 'responsible' | 'whatsapp' | 'email'>>
  ) => void;
}

export const RemindersCenter: React.FC<RemindersCenterProps> = ({
  services,
  weekKey,
  weekData,
  regionTitle,
  coordinatorName,
  templates,
  onUpdateTemplates,
  onUpdateRecord,
  onUpdateServiceContact,
}) => {
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [queueIndex, setQueueIndex] = useState<number | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [contactHint, setContactHint] = useState<string | null>(null);

  const laggingServices = useMemo(() => {
    return services
      .filter((s) => s.active)
      .filter((s) => (weekData.records[s.id]?.status || 'pending') !== 'received');
  }, [services, weekData]);

  const emailsAvailable = useMemo(
    () =>
      laggingServices
        .map((s) => s.email?.trim())
        .filter((e): e is string => !!e),
    [laggingServices]
  );

  const handleCopyGroupSummary = async () => {
    const text = buildGroupSummaryText(weekKey, laggingServices, regionTitle);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    }
  };

  const sendWhatsAppNow = (srv: ServiceItem) => {
    const message = interpolateTemplate(templates.whatsappTemplate, {
      service: srv,
      weekKey,
      coordinatorName,
    });
    onUpdateRecord(srv.id, {
      reminderSentAt: new Date().toISOString(),
      reminderChannel: 'whatsapp',
    });
    window.open(buildWhatsAppUrl(srv.whatsapp, message), '_blank', 'noopener,noreferrer');
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
    onUpdateRecord(srv.id, {
      reminderSentAt: new Date().toISOString(),
      reminderChannel: 'email',
    });
    window.location.href = buildMailtoUrl(srv.email, subject, body);
  };

  const handleSendWhatsApp = (srv: ServiceItem) => {
    if (!srv.whatsapp?.trim()) {
      setContactHint(
        'Agrega el número de WhatsApp de este servicio para enviarlo directo, o pulsa "Guardar y WhatsApp" para elegir el contacto manualmente.'
      );
      setEditingService(srv);
      return;
    }
    sendWhatsAppNow(srv);
  };

  const handleSendEmail = (srv: ServiceItem) => {
    if (!srv.email?.trim()) {
      setContactHint(
        'Agrega el correo electrónico de este servicio para preparar el envío automáticamente.'
      );
      setEditingService(srv);
      return;
    }
    sendEmailNow(srv);
  };

  const handleBulkBccEmail = () => {
    const dateLabel = formatMondaySpanish(weekKey);
    const subject = `Recordatorio Semanal: Planilla de Temperatura — ${dateLabel}`;
    const body = `Estimados responsables,\n\nLes recordamos enviar la planilla semanal de control de temperatura correspondiente al ${dateLabel} para mantener actualizado el informe de cumplimiento.\n\nAtentamente,\n${coordinatorName}`;
    const url = buildMailtoUrl(undefined, subject, body, emailsAvailable);
    const now = new Date().toISOString();
    for (const srv of laggingServices) {
      if (srv.email?.trim()) {
        onUpdateRecord(srv.id, {
          reminderSentAt: now,
          reminderChannel: 'email',
        });
      }
    }
    window.location.href = url;
  };

  const handleMarkAllPendingAsOverdue = () => {
    for (const srv of laggingServices) {
      const current = weekData.records[srv.id];
      if (!current || current.status === 'pending') {
        onUpdateRecord(srv.id, { status: 'overdue' });
      }
    }
  };

  const currentQueueService =
    queueIndex !== null && laggingServices[queueIndex]
      ? laggingServices[queueIndex]
      : null;

  return (
    <div className="space-y-6">
      {/* Header & Automation Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Seguimiento de rezagados · {formatMondaySpanish(weekKey)}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Centro de Recordatorios (WhatsApp y Correo)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowTemplates((v) => !v)}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {showTemplates ? 'Ocultar Plantillas' : 'Personalizar Mensajes'}
            </button>

            <button
              type="button"
              onClick={handleCopyGroupSummary}
              disabled={laggingServices.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedSummary ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Lista copiada para WhatsApp</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-slate-600" />
                  <span>Copiar lista para Grupo WhatsApp</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleBulkBccEmail}
              disabled={emailsAvailable.length === 0}
              title={
                emailsAvailable.length === 0
                  ? 'Carga correos en los servicios para usar el envío masivo'
                  : `Abrir correo con ${emailsAvailable.length} destinatarios en CCO`
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-700 bg-white px-3.5 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-50 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Mail className="h-4 w-4" />
              <span>Correo Masivo ({emailsAvailable.length})</span>
            </button>

            {laggingServices.length > 0 && (
              <button
                type="button"
                onClick={() => setQueueIndex(0)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Enviar en Cola ({laggingServices.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Editable Templates Panel */}
        {showTemplates && (
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 lg:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800">
                  Plantilla de WhatsApp
                </label>
                <button
                  type="button"
                  onClick={() => onUpdateTemplates(DEFAULT_TEMPLATES)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Restablecer</span>
                </button>
              </div>
              <textarea
                rows={4}
                value={templates.whatsappTemplate}
                onChange={(e) =>
                  onUpdateTemplates({
                    ...templates,
                    whatsappTemplate: e.target.value,
                  })
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 p-3 text-xs leading-relaxed text-slate-800 focus:border-sky-700 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Variables disponibles: {'{servicio}'}, {'{distrito}'},{' '}
                {'{fecha_lunes}'}, {'{responsable}'}, {'{coordinador}'}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-800">
                  Asunto de Correo Electrónico
                </label>
                <input
                  type="text"
                  value={templates.emailSubjectTemplate}
                  onChange={(e) =>
                    onUpdateTemplates({
                      ...templates,
                      emailSubjectTemplate: e.target.value,
                    })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-sky-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-800">
                  Cuerpo de Correo Electrónico
                </label>
                <textarea
                  rows={3}
                  value={templates.emailBodyTemplate}
                  onChange={(e) =>
                    onUpdateTemplates({
                      ...templates,
                      emailBodyTemplate: e.target.value,
                    })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-300 p-3 text-xs leading-relaxed text-slate-800 focus:border-sky-700 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sequential Queue Assistant Banner */}
      {currentQueueService && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-xs font-semibold text-emerald-800 tabular-nums">
                Asistente de envío · Servicio {(queueIndex || 0) + 1} de{' '}
                {laggingServices.length}
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">
                {currentQueueService.name}{' '}
                <span className="text-sm font-normal text-slate-600">
                  ({currentQueueService.district})
                </span>
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                {currentQueueService.responsible || 'Responsable sin asignar'} ·{' '}
                {currentQueueService.whatsapp || 'Sin WhatsApp cargado (puedes elegir el contacto al abrir WhatsApp)'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  handleSendWhatsApp(currentQueueService);
                  if ((queueIndex || 0) + 1 < laggingServices.length) {
                    setQueueIndex((queueIndex || 0) + 1);
                  } else {
                    setQueueIndex(null);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Abrir WhatsApp y Siguiente</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSendEmail(currentQueueService);
                  if ((queueIndex || 0) + 1 < laggingServices.length) {
                    setQueueIndex((queueIndex || 0) + 1);
                  } else {
                    setQueueIndex(null);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-700 bg-white px-3.5 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-50 cursor-pointer"
              >
                <Mail className="h-4 w-4" />
                <span>Correo y Siguiente</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if ((queueIndex || 0) + 1 < laggingServices.length) {
                    setQueueIndex((queueIndex || 0) + 1);
                  } else {
                    setQueueIndex(null);
                  }
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Saltar
              </button>
              <button
                type="button"
                onClick={() => setQueueIndex(null)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lagging Services Table */}
      {laggingServices.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <h3 className="mt-3 text-base font-bold text-slate-900">
            No hay servicios rezagados en este lunes
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            El 100% de los servicios activos ya entregaron su planilla de temperatura.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3.5">
            <span className="text-sm font-semibold text-slate-900 tabular-nums">
              {laggingServices.length} servicios sin planilla recibida
            </span>
            <button
              type="button"
              onClick={handleMarkAllPendingAsOverdue}
              className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Marcar todos los pendientes como "No envió"</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Distrito</th>
                  <th className="px-4 py-3">Servicio</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Último Recordatorio</th>
                  <th className="px-4 py-3 text-right">Acciones Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {laggingServices.map((srv) => {
                  const rec = weekData.records[srv.id];
                  const isOverdue = rec?.status === 'overdue';
                  return (
                    <tr key={srv.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-xs font-medium text-slate-600">
                        {srv.district}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {srv.name}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold">
                        <span
                          className={
                            isOverdue ? 'text-rose-700' : 'text-amber-700'
                          }
                        >
                          {isOverdue ? 'No envió' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium text-slate-800">
                              {srv.responsible || 'Sin responsable'}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500">
                              {[srv.whatsapp, srv.email].filter(Boolean).join(' · ') ||
                                'Sin teléfono/correo'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setContactHint(null);
                              setEditingService(srv);
                            }}
                            title="Editar número y correo"
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <UserPen className="h-3 w-3" />
                            <span>Editar</span>
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 tabular-nums">
                        {rec?.reminderSentAt
                          ? `${rec.reminderChannel === 'whatsapp' ? 'WA' : 'Email'} · ${formatTimeShort(rec.reminderSentAt)}`
                          : 'Sin enviar'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendWhatsApp(srv)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>WhatsApp</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendEmail(srv)}
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>Correo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateRecord(srv.id, {
                                status: 'received',
                                receivedAt: new Date().toISOString(),
                              })
                            }
                            title="Ya entregó su planilla"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-600 hover:text-emerald-700 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Recibida</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
