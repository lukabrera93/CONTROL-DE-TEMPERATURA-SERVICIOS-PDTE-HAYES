import { ReminderTemplates, ServiceItem } from '../types/control';

export const DISTRICT_ORDER: string[] = [
  'BENJAMIN ACEVAL',
  'JOSE FALCON',
  'NUEVA ASUNCION',
  'GRAL BRUGUEZ',
  'VILLA HAYES',
  'PINASCO',
  'NANAWA',
  'IRALA FERNANDEZ',
  'ESTEBAN MARTINEZ',
];

const RAW_SERVICES: Array<{ district: string; name: string }> = [
  // BENJAMIN ACEVAL (7)
  { district: 'BENJAMIN ACEVAL', name: 'CS BENJAMIN ACEVAL' },
  { district: 'BENJAMIN ACEVAL', name: 'PS LA VICTORIA' },
  { district: 'BENJAMIN ACEVAL', name: 'PS MONTE LINDO' },
  { district: 'BENJAMIN ACEVAL', name: 'USF RIO VERDE CERRITO' },
  { district: 'BENJAMIN ACEVAL', name: 'USF MARIA AUXILIADORA' },
  { district: 'BENJAMIN ACEVAL', name: 'USF MONTE SOCIEDAD' },
  { district: 'BENJAMIN ACEVAL', name: 'PS MARIA MEDIANERA' },

  // JOSE FALCON (3)
  { district: 'JOSE FALCON', name: 'HD JOSE FALCON' },
  { district: 'JOSE FALCON', name: 'PS OLIVORIO TALAVERA' },
  { district: 'JOSE FALCON', name: 'USF FALCON SANTA ROSA' },

  // NUEVA ASUNCION (1)
  { district: 'NUEVA ASUNCION', name: "USF CHACO'I" },

  // GRAL BRUGUEZ (2)
  { district: 'GRAL BRUGUEZ', name: 'PS CADETE PANDO' },
  { district: 'GRAL BRUGUEZ', name: 'USF GRAL BRUGUEZ' },

  // VILLA HAYES (8)
  { district: 'VILLA HAYES', name: 'HR VILLA HAYES' },
  { district: 'VILLA HAYES', name: 'USF RIO VERDE 325' },
  { district: 'VILLA HAYES', name: 'PS REMANSITO' },
  { district: 'VILLA HAYES', name: 'USF BOUVIER' },
  { district: 'VILLA HAYES', name: 'USF CIUDAD NUEVA' },
  { district: 'VILLA HAYES', name: 'USF SAN JORGE' },
  { district: 'VILLA HAYES', name: 'USF POZO COLORADO' },
  { district: 'VILLA HAYES', name: 'USF PAI ROBERTO' },

  // PINASCO (2)
  { district: 'PINASCO', name: 'USF MEMON' },
  { district: 'PINASCO', name: 'USF PTO PINASCO' },

  // NANAWA (2)
  { district: 'NANAWA', name: 'CS NANAWA' },
  { district: 'NANAWA', name: 'PS GASPAR R DE FRANCIA' },

  // IRALA FERNANDEZ (11)
  { district: 'IRALA FERNANDEZ', name: 'CS IRALA FERNANDEZ' },
  { district: 'IRALA FERNANDEZ', name: 'PRIVADO PARATODO' },
  { district: 'IRALA FERNANDEZ', name: 'PS NUEVA VIDA' },
  { district: 'IRALA FERNANDEZ', name: 'PS SANTA AURELIA' },
  { district: 'IRALA FERNANDEZ', name: 'USF 1 PIONEROS' },
  { district: 'IRALA FERNANDEZ', name: 'USF 2 EL ESTRIBO' },
  { district: 'IRALA FERNANDEZ', name: 'USF 3 CONAMOCTOLOLAC' },
  { district: 'IRALA FERNANDEZ', name: 'USF CAMPO ACEVAL' },
  { district: 'IRALA FERNANDEZ', name: 'VAC PRIV IND PARATODO' },
  { district: 'IRALA FERNANDEZ', name: 'PRIVADO LOLITA' },
  { district: 'IRALA FERNANDEZ', name: 'PS 10 LEGUAS' },

  // ESTEBAN MARTINEZ (2)
  { district: 'ESTEBAN MARTINEZ', name: 'USF ESTEBAN MARTINEZ' },
  { district: 'ESTEBAN MARTINEZ', name: 'USF LAGUNA ESCALANTE' },
];

export function createInitialServices(): ServiceItem[] {
  return RAW_SERVICES.map((item, idx) => ({
    id: `srv-${String(idx + 1).padStart(3, '0')}`,
    name: item.name,
    district: item.district,
    responsible: '',
    whatsapp: '',
    email: '',
    active: true,
  }));
}

export const DEFAULT_TEMPLATES: ReminderTemplates = {
  whatsappTemplate:
    'Buen día {responsable}. Recordatorio cordial del control semanal de cadena de frío: aún no registramos la planilla de temperatura de *{servicio}* (Distrito {distrito}) correspondiente al *{fecha_lunes}*. Por favor, remitir a la brevedad. Muchas gracias. {coordinador}',
  emailSubjectTemplate:
    'Recordatorio: Planilla de Control de Temperatura — {servicio} ({fecha_lunes})',
  emailBodyTemplate:
    'Estimado/a {responsable},\n\nPor medio del presente le recordamos enviar la planilla semanal de control de temperatura correspondiente al {fecha_lunes} del establecimiento {servicio} (Distrito {distrito}).\n\nAgradecemos su pronta gestión para mantener actualizado el monitoreo regional.\n\nAtentamente,\n{coordinador}',
};

export function toISODateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODateLocal(iso: string): Date {
  const parts = String(iso || '').split('-').map(Number);
  const y = Number.isFinite(parts[0]) && parts[0] > 1900 ? parts[0] : new Date().getFullYear();
  const m = Number.isFinite(parts[1]) && parts[1] >= 1 && parts[1] <= 12 ? parts[1] : 1;
  const d = Number.isFinite(parts[2]) && parts[2] >= 1 && parts[2] <= 31 ? parts[2] : 1;
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * Returns YYYY-MM-DD of the Monday for the week containing `date`.
 */
export function getMondayOfDate(date: Date = new Date()): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const day = copy.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return toISODateLocal(copy);
}

export function shiftMonday(weekKey: string, deltaWeeks: number): string {
  const d = parseISODateLocal(weekKey);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return getMondayOfDate(d);
}

export function formatMondaySpanish(weekKey: string): string {
  const d = parseISODateLocal(weekKey);
  const formatted = d.toLocaleDateString('es-PY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatShortMonday(weekKey: string): string {
  const [, m, d] = weekKey.split('-');
  return `${d}/${m}`;
}

export function getRecentMondays(anchorWeekKey: string, count: number): string[] {
  const result: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    result.push(shiftMonday(anchorWeekKey, -i));
  }
  return result;
}
