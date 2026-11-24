import React, { useState } from 'react';
import { Mail, MessageCircle, X } from 'lucide-react';
import { ServiceItem } from '../types/control';

interface ContactEditModalProps {
  service: ServiceItem;
  hintMessage?: string | null;
  onClose: () => void;
  onSave: (patch: {
    responsible: string;
    whatsapp: string;
    email: string;
  }) => void;
  onSaveAndSendWhatsApp?: (updatedService: ServiceItem) => void;
  onSaveAndSendEmail?: (updatedService: ServiceItem) => void;
}

export const ContactEditModal: React.FC<ContactEditModalProps> = ({
  service,
  hintMessage,
  onClose,
  onSave,
  onSaveAndSendWhatsApp,
  onSaveAndSendEmail,
}) => {
  const [responsible, setResponsible] = useState(service.responsible || '');
  const [whatsapp, setWhatsapp] = useState(service.whatsapp || '');
  const [email, setEmail] = useState(service.email || '');

  const buildUpdated = (): ServiceItem => ({
    ...service,
    responsible: responsible.trim(),
    whatsapp: whatsapp.trim(),
    email: email.trim(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      responsible: responsible.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">{service.district}</p>
            <h3 className="text-base font-bold text-slate-900">
              Contacto · {service.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {hintMessage && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {hintMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Responsable / Encargado
            </label>
            <input
              type="text"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              placeholder="Ej: Lic. María González"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Número de WhatsApp
            </label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Ej: 0981123456 o +595981123456"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-700 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Se guarda automáticamente para enviar recordatorios con 1 clic.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@salud.gov.py"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {onSaveAndSendWhatsApp && (
                <button
                  type="button"
                  onClick={() => {
                    const updated = buildUpdated();
                    onSave({
                      responsible: updated.responsible || '',
                      whatsapp: updated.whatsapp || '',
                      email: updated.email || '',
                    });
                    onSaveAndSendWhatsApp(updated);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Guardar y WhatsApp</span>
                </button>
              )}
              {onSaveAndSendEmail && (
                <button
                  type="button"
                  onClick={() => {
                    const updated = buildUpdated();
                    onSave({
                      responsible: updated.responsible || '',
                      whatsapp: updated.whatsapp || '',
                      email: updated.email || '',
                    });
                    onSaveAndSendEmail(updated);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100 cursor-pointer"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Guardar y Correo</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 cursor-pointer"
              >
                Guardar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
