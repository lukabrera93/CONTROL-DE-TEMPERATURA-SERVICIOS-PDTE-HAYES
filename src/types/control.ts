export type SubmissionStatus = 'pending' | 'received' | 'overdue';

export interface ServiceItem {
  id: string;
  name: string;
  district: string;
  responsible?: string;
  whatsapp?: string;
  email?: string;
  active: boolean;
}

export interface ThermometerReading {
  id: string;
  label?: string;
  minTemp: string;
  maxTemp: string;
  coldChainAlert?: boolean;
  observation?: string;
}

export interface WeeklyRecord {
  status: SubmissionStatus;
  receivedAt?: string; // ISO timestamp
  observation?: string;
  minTemp?: string;
  maxTemp?: string;
  readings?: ThermometerReading[];
  coldChainAlert?: boolean;
  reminderSentAt?: string; // ISO timestamp
  reminderChannel?: 'whatsapp' | 'email';
}

export interface WeekData {
  weekKey: string; // Monday YYYY-MM-DD
  updatedAt: string;
  records: Record<string, WeeklyRecord>; // keyed by service.id
}

export interface ReminderTemplates {
  whatsappTemplate: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
}

export interface AppDatabase {
  version: number;
  regionTitle: string;
  coordinatorName: string;
  services: ServiceItem[];
  weeks: Record<string, WeekData>;
  templates: ReminderTemplates;
}

export type ActiveTab = 'dashboard' | 'checklist' | 'reminders' | 'history';
