import { formatMondaySpanish } from '../data/initialServices';
import { ServiceItem } from '../types/control';

export interface TemplateContext {
  service: ServiceItem;
  weekKey: string;
  coordinatorName: string;
}

export function interpolateTemplate(template: string, ctx: TemplateContext): string {
  const fechaLunes = formatMondaySpanish(ctx.weekKey);
  const responsable = ctx.service.responsible?.trim() || 'equipo responsable';
  return template
    .replaceAll('{servicio}', ctx.service.name)
    .replaceAll('{distrito}', ctx.service.district)
    .replaceAll('{fecha_lunes}', fechaLunes)
    .replaceAll('{responsable}', responsable)
    .replaceAll('{coordinador}', ctx.coordinatorName || 'Coordinación');
}

export function normalizeWhatsAppPhone(raw?: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  // If local Paraguay number like 0981123456 (10 digits starting with 0)
  if (digits.startsWith('0') && digits.length === 10) {
    return '595' + digits.slice(1);
  }
  // If 9 digits starting with 9 (e.g. 981123456)
  if (digits.length === 9 && digits.startsWith('9')) {
    return '595' + digits;
  }
  return digits;
}

export function buildWhatsAppUrl(phone: string | undefined, message: string): string {
  const clean = normalizeWhatsAppPhone(phone);
  const encoded = encodeURIComponent(message);
  if (clean) {
    return `https://wa.me/${clean}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

export function buildMailtoUrl(
  toEmail: string | undefined,
  subject: string,
  body: string,
  bccList?: string[]
): string {
  const params = new URLSearchParams();
  if (bccList && bccList.length > 0) {
    params.set('bcc', bccList.join(','));
  }
  params.set('subject', subject);
  params.set('body', body);
  const to = toEmail ? encodeURIComponent(toEmail) : '';
  return `mailto:${to}?${params.toString().replace(/\+/g, '%20')}`;
}

export function buildGroupSummaryText(
  weekKey: string,
  laggingServices: ServiceItem[],
  regionTitle: string
): string {
  const dateLabel = formatMondaySpanish(weekKey);
  const byDistrict = new Map<string, ServiceItem[]>();
  for (const srv of laggingServices) {
    const arr = byDistrict.get(srv.district) || [];
    arr.push(srv);
    byDistrict.set(srv.district, arr);
  }

  const lines: string[] = [
    `*${regionTitle}*`,
    `Control de Planillas de Temperatura — *${dateLabel}*`,
    `Servicios pendientes de envío (${laggingServices.length}):`,
    '',
  ];

  for (const [district, items] of byDistrict.entries()) {
    lines.push(`*${district}*`);
    for (const item of items) {
      lines.push(`  • ${item.name}`);
    }
    lines.push('');
  }

  lines.push('Por favor, remitir las planillas pendientes a la brevedad. Muchas gracias.');
  return lines.join('\n');
}
