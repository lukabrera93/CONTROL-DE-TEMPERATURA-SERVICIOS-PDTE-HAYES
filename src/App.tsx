import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Laptop,
  Printer,
  Shield,
} from 'lucide-react';
import { DashboardPanel } from './components/DashboardPanel';
import {
  DirectoryAndBackupModal,
  ModalSection,
} from './components/DirectoryAndBackupModal';
import { HistoryView } from './components/HistoryView';
import { OfflineBanner } from './components/OfflineBanner';
import { PrintableReport } from './components/PrintableReport';
import { PWAInstallButton } from './components/PWAInstallButton';
import { RemindersCenter } from './components/RemindersCenter';
import { WeeklyChecklist } from './components/WeeklyChecklist';
import {
  formatMondaySpanish,
  getMondayOfDate,
  parseISODateLocal,
  shiftMonday,
} from './data/initialServices';
import {
  ActiveTab,
  AppDatabase,
  ReminderTemplates,
  ServiceItem,
  WeekData,
  WeeklyRecord,
} from './types/control';
import { exportToExcel, exportToPdf } from './utils/exporters';
import { createDefaultDatabase, loadDatabase, saveDatabase } from './utils/storage';

export default function App() {
  const [db, setDb] = useState<AppDatabase>(() => createDefaultDatabase());
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentWeekKey, setCurrentWeekKey] = useState<string>(() =>
    getMondayOfDate(new Date())
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>('ALL');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [modalSection, setModalSection] = useState<ModalSection>('windows');

  const openModal = useCallback((section: ModalSection) => {
    setModalSection(section);
    setShowBackupModal(true);
  }, []);

  useEffect(() => {
    let active = true;
    loadDatabase().then((loaded) => {
      if (active) {
        setDb(loaded);
        setIsLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const persistDb = useCallback((updater: (prev: AppDatabase) => AppDatabase) => {
    setDb((prev) => {
      const next = updater(prev);
      saveDatabase(next);
      return next;
    });
  }, []);

  const currentWeekData: WeekData = useMemo(() => {
    return (
      db.weeks[currentWeekKey] || {
        weekKey: currentWeekKey,
        updatedAt: new Date().toISOString(),
        records: {},
      }
    );
  }, [db.weeks, currentWeekKey]);

  const handleUpdateRecord = useCallback(
    (serviceId: string, patch: Partial<WeeklyRecord>) => {
      persistDb((prev) => {
        const existingWeek = prev.weeks[currentWeekKey] || {
          weekKey: currentWeekKey,
          updatedAt: new Date().toISOString(),
          records: {},
        };
        const existingRec = existingWeek.records[serviceId] || { status: 'pending' };
        return {
          ...prev,
          weeks: {
            ...prev.weeks,
            [currentWeekKey]: {
              ...existingWeek,
              updatedAt: new Date().toISOString(),
              records: {
                ...existingWeek.records,
                [serviceId]: {
                  ...existingRec,
                  ...patch,
                },
              },
            },
          },
        };
      });
    },
    [currentWeekKey, persistDb]
  );

  const handleMarkDistrictReceived = useCallback(
    (district: string) => {
      const now = new Date().toISOString();
      persistDb((prev) => {
        const existingWeek = prev.weeks[currentWeekKey] || {
          weekKey: currentWeekKey,
          updatedAt: now,
          records: {},
        };
        const nextRecords = { ...existingWeek.records };
        for (const srv of prev.services) {
          if (srv.active && srv.district === district) {
            const cur = nextRecords[srv.id];
            nextRecords[srv.id] = {
              ...(cur || {}),
              status: 'received',
              receivedAt: cur?.receivedAt || now,
            };
          }
        }
        return {
          ...prev,
          weeks: {
            ...prev.weeks,
            [currentWeekKey]: {
              ...existingWeek,
              updatedAt: now,
              records: nextRecords,
            },
          },
        };
      });
    },
    [currentWeekKey, persistDb]
  );

  const handleUpdateServiceContact = useCallback(
    (
      serviceId: string,
      patch: Partial<Pick<ServiceItem, 'responsible' | 'whatsapp' | 'email'>>
    ) => {
      persistDb((prev) => ({
        ...prev,
        services: prev.services.map((s) =>
          s.id === serviceId ? { ...s, ...patch } : s
        ),
      }));
    },
    [persistDb]
  );

  const handleUpdateTemplates = useCallback(
    (templates: ReminderTemplates) => {
      persistDb((prev) => ({ ...prev, templates }));
    },
    [persistDb]
  );

  const handleUpdateMeta = useCallback(
    (regionTitle: string, coordinatorName: string) => {
      persistDb((prev) => ({ ...prev, regionTitle, coordinatorName }));
    },
    [persistDb]
  );

  const handleAddService = useCallback(
    (service: Omit<ServiceItem, 'id'>) => {
      persistDb((prev) => ({
        ...prev,
        services: [
          ...prev.services,
          {
            ...service,
            id: `srv-${Date.now()}`,
          },
        ],
      }));
    },
    [persistDb]
  );

  const handleToggleServiceActive = useCallback(
    (serviceId: string) => {
      persistDb((prev) => ({
        ...prev,
        services: prev.services.map((s) =>
          s.id === serviceId ? { ...s, active: !s.active } : s
        ),
      }));
    },
    [persistDb]
  );

  const handleUpdateServiceInfo = useCallback(
    (serviceId: string, patch: Partial<Pick<ServiceItem, 'name' | 'district'>>) => {
      persistDb((prev) => ({
        ...prev,
        services: prev.services.map((s) =>
          s.id === serviceId ? { ...s, ...patch } : s
        ),
      }));
    },
    [persistDb]
  );

  const handleDeleteService = useCallback(
    (serviceId: string) => {
      persistDb((prev) => ({
        ...prev,
        services: prev.services.filter((s) => s.id !== serviceId),
      }));
    },
    [persistDb]
  );

  const handleRestoreDatabase = useCallback(
    (nextDb: AppDatabase) => {
      setDb(nextDb);
      saveDatabase(nextDb);
    },
    []
  );

  const handleDatePickerChange = (rawDate: string) => {
    if (!rawDate) return;
    const mondayKey = getMondayOfDate(parseISODateLocal(rawDate));
    setCurrentWeekKey(mondayKey);
  };

  const thisMondayKey = useMemo(() => getMondayOfDate(new Date()), []);
  const laggingCount = useMemo(() => {
    return db.services
      .filter((s) => s.active)
      .filter((s) => (currentWeekData.records[s.id]?.status || 'pending') !== 'received')
      .length;
  }, [db.services, currentWeekData]);

  return (
    <>
      <div className="no-print min-h-screen bg-slate-50 text-slate-900">
        {/* Strict 3-Zone Top Navigation Bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
            {/* Zone 1: Single-line Brand Wordmark */}
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              ControlTerm
            </button>

            {/* Zone 2: Clean single-line text nav links */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'font-semibold text-sky-700 underline decoration-2 underline-offset-8'
                    : 'hover:text-slate-900'
                }`}
              >
                Panel
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('checklist')}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'checklist'
                    ? 'font-semibold text-sky-700 underline decoration-2 underline-offset-8'
                    : 'hover:text-slate-900'
                }`}
              >
                Planilla Lunes
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reminders')}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'reminders'
                    ? 'font-semibold text-sky-700 underline decoration-2 underline-offset-8'
                    : 'hover:text-slate-900'
                }`}
              >
                Rezagados ({laggingCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'history'
                    ? 'font-semibold text-sky-700 underline decoration-2 underline-offset-8'
                    : 'hover:text-slate-900'
                }`}
              >
                Historial
              </button>
            </nav>

            {/* Zone 3: Primary Action + Install button */}
            <div className="flex items-center gap-2.5 shrink-0">
              <PWAInstallButton />
              <button
                type="button"
                onClick={() => openModal('windows')}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>App Local y Servicios</span>
              </button>
            </div>
          </div>

          {/* Mobile Nav Row */}
          <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
            {(
              [
                ['dashboard', 'Panel'],
                ['checklist', 'Planilla Lunes'],
                ['reminders', `Rezagados (${laggingCount})`],
                ['history', 'Historial'],
              ] as Array<[ActiveTab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === key
                    ? 'bg-sky-50 text-sky-800'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {/* Workspace Monday Control Bar */}
        <div className="border-b border-slate-200 bg-white/80">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentWeekKey((k) => shiftMonday(k, -1))}
                aria-label="Lunes anterior"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
                <Calendar className="h-4 w-4 text-sky-700 shrink-0" />
                <span className="text-sm font-semibold text-slate-900">
                  {formatMondaySpanish(currentWeekKey)}
                </span>
                <input
                  type="date"
                  value={currentWeekKey}
                  onChange={(e) => handleDatePickerChange(e.target.value)}
                  aria-label="Seleccionar fecha de lunes"
                  className="w-6 cursor-pointer border-0 bg-transparent text-xs text-slate-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => setCurrentWeekKey((k) => shiftMonday(k, 1))}
                aria-label="Lunes siguiente"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              {currentWeekKey !== thisMondayKey && (
                <button
                  type="button"
                  onClick={() => setCurrentWeekKey(thisMondayKey)}
                  className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Ir a este lunes
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden text-xs text-slate-500 xl:inline">
                {db.regionTitle}
              </span>
              <span className="hidden text-slate-300 xl:inline" aria-hidden="true">
                ·
              </span>
              <button
                type="button"
                onClick={() =>
                  exportToExcel(
                    currentWeekKey,
                    db.services,
                    currentWeekData,
                    db.regionTitle
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                <span>Excel</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  exportToPdf(
                    currentWeekKey,
                    db.services,
                    currentWeekData,
                    db.regionTitle,
                    db.coordinatorName
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5 text-rose-700" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 text-slate-700" />
                <span>Imprimir</span>
              </button>
              <button
                type="button"
                onClick={() => openModal('windows')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Laptop className="h-3.5 w-3.5 text-sky-700" />
                <span>Ejecutar Local / Windows</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Viewport */}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {!isLoaded ? (
            <div className="space-y-4">
              <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
                <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
                <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
                <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardPanel
                  db={db}
                  weekKey={currentWeekKey}
                  weekData={currentWeekData}
                  onSelectDistrict={(district) => {
                    setSelectedDistrictFilter(district);
                    setActiveTab('checklist');
                  }}
                  onGoToChecklist={() => setActiveTab('checklist')}
                  onGoToReminders={() => setActiveTab('reminders')}
                  onExportExcel={() =>
                    exportToExcel(
                      currentWeekKey,
                      db.services,
                      currentWeekData,
                      db.regionTitle
                    )
                  }
                  onExportPdf={() =>
                    exportToPdf(
                      currentWeekKey,
                      db.services,
                      currentWeekData,
                      db.regionTitle,
                      db.coordinatorName
                    )
                  }
                  onPrint={() => window.print()}
                />
              )}

              {activeTab === 'checklist' && (
                <WeeklyChecklist
                  services={db.services}
                  weekKey={currentWeekKey}
                  weekData={currentWeekData}
                  coordinatorName={db.coordinatorName}
                  templates={db.templates}
                  selectedDistrictFilter={selectedDistrictFilter}
                  onChangeDistrictFilter={setSelectedDistrictFilter}
                  onUpdateRecord={handleUpdateRecord}
                  onMarkDistrictReceived={handleMarkDistrictReceived}
                  onUpdateServiceContact={handleUpdateServiceContact}
                  onOpenManageServices={() => openModal('services')}
                />
              )}

              {activeTab === 'reminders' && (
                <RemindersCenter
                  services={db.services}
                  weekKey={currentWeekKey}
                  weekData={currentWeekData}
                  regionTitle={db.regionTitle}
                  coordinatorName={db.coordinatorName}
                  templates={db.templates}
                  onUpdateTemplates={handleUpdateTemplates}
                  onUpdateRecord={handleUpdateRecord}
                  onUpdateServiceContact={handleUpdateServiceContact}
                />
              )}

              {activeTab === 'history' && (
                <HistoryView
                  db={db}
                  currentWeekKey={currentWeekKey}
                  onSelectWeek={(wk) => {
                    setCurrentWeekKey(wk);
                    setActiveTab('checklist');
                  }}
                />
              )}
            </>
          )}
        </main>

        <footer className="mx-auto max-w-7xl border-t border-slate-200 px-4 py-5 text-xs text-slate-500 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {db.regionTitle} · Almacenamiento local privado sin envío a servidores externos
            </span>
            <button
              type="button"
              onClick={() => openModal('windows')}
              className="text-left font-medium text-sky-700 hover:underline sm:text-right cursor-pointer"
            >
              Descargar versión local Windows (.html) o respaldo cifrado
            </button>
          </div>
          <div className="mt-2.5 flex flex-col gap-1 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              © {new Date().getFullYear()} ControlTerm · Todos los derechos reservados.
            </span>
            <span>
              Desarrollador:{' '}
              <strong className="font-semibold text-slate-700">
                Lucio Pastor Cabrera Olmedo
              </strong>
            </span>
          </div>
        </footer>

        <OfflineBanner />

        {showBackupModal && (
          <DirectoryAndBackupModal
            db={db}
            currentWeekKey={currentWeekKey}
            initialSection={modalSection}
            onClose={() => setShowBackupModal(false)}
            onUpdateMeta={handleUpdateMeta}
            onAddService={handleAddService}
            onUpdateServiceInfo={handleUpdateServiceInfo}
            onToggleServiceActive={handleToggleServiceActive}
            onDeleteService={handleDeleteService}
            onRestoreDatabase={handleRestoreDatabase}
          />
        )}
      </div>

      {/* Print-Only Official Compliance Report */}
      <PrintableReport
        db={db}
        weekKey={currentWeekKey}
        weekData={currentWeekData}
      />
    </>
  );
}
