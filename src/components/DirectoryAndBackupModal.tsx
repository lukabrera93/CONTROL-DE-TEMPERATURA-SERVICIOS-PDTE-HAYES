import React, { useRef, useState } from 'react';
import {
  Check,
  Download,
  FileCode2,
  Laptop,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Terminal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { DISTRICT_ORDER } from '../data/initialServices';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { AppDatabase, ServiceItem } from '../types/control';
import { exportFullLocalHtmlApp } from '../utils/exporters';
import {
  decryptDatabaseBackup,
  encryptDatabaseBackup,
} from '../utils/storage';

export type ModalSection = 'windows' | 'backup' | 'services' | 'settings';

interface DirectoryAndBackupModalProps {
  db: AppDatabase;
  currentWeekKey: string;
  initialSection?: ModalSection;
  onClose: () => void;
  onUpdateMeta: (regionTitle: string, coordinatorName: string) => void;
  onAddService: (service: Omit<ServiceItem, 'id'>) => void;
  onUpdateServiceInfo: (
    serviceId: string,
    patch: Partial<Pick<ServiceItem, 'name' | 'district'>>
  ) => void;
  onToggleServiceActive: (serviceId: string) => void;
  onDeleteService: (serviceId: string) => void;
  onRestoreDatabase: (nextDb: AppDatabase) => void;
}

export const DirectoryAndBackupModal: React.FC<DirectoryAndBackupModalProps> = ({
  db,
  currentWeekKey,
  initialSection = 'windows',
  onClose,
  onUpdateMeta,
  onAddService,
  onUpdateServiceInfo,
  onToggleServiceActive,
  onDeleteService,
  onRestoreDatabase,
}) => {
  const [activeSection, setActiveSection] = useState<ModalSection>(initialSection);
  const [regionTitle, setRegionTitle] = useState(db.regionTitle);
  const [coordinatorName, setCoordinatorName] = useState(db.coordinatorName);
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // New service form
  const [newName, setNewName] = useState('');
  const [newDistrict, setNewDistrict] = useState(DISTRICT_ORDER[0]);
  const [customDistrict, setCustomDistrict] = useState('');
  const [newResponsible, setNewResponsible] = useState('');
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Inline service editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDistrict, setEditDistrict] = useState('');

  // Backup / encryption / export state
  const [encryptPass, setEncryptPass] = useState('');
  const [decryptPass, setDecryptPass] = useState('');
  const [pendingRestoreText, setPendingRestoreText] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [isExportingHtml, setIsExportingHtml] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveMeta = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateMeta(
      regionTitle.trim() || db.regionTitle,
      coordinatorName.trim() || db.coordinatorName
    );
    setBackupMessage('Configuración institucional guardada.');
  };

  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    const districtFinal =
      newDistrict === '__CUSTOM__'
        ? customDistrict.trim().toUpperCase()
        : newDistrict;
    if (!newName.trim() || !districtFinal) return;
    onAddService({
      name: newName.trim().toUpperCase(),
      district: districtFinal,
      responsible: newResponsible.trim(),
      whatsapp: newWhatsapp.trim(),
      email: newEmail.trim(),
      active: true,
    });
    setNewName('');
    setNewResponsible('');
    setNewWhatsapp('');
    setNewEmail('');
    setCustomDistrict('');
    setBackupMessage(`Servicio "${newName.trim().toUpperCase()}" agregado correctamente.`);
  };

  const triggerDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadFullLocalHtml = async () => {
    setBackupError(null);
    setBackupMessage(null);
    setIsExportingHtml(true);
    try {
      const mode = await exportFullLocalHtmlApp(db, currentWeekKey);
      if (mode === 'full') {
        setBackupMessage(
          'Aplicación completa descargada (ControlTerm_Local_Completa.html) con tu base de datos y todos los complementos (Excel, PDF, Impresión, Gráficos, Recordatorios y Alta de Servicios). Haz doble clic para abrirla en Windows sin internet.'
        );
      } else {
        setBackupMessage(
          'Planilla HTML offline descargada. Para la versión completa con gráficos y Excel/PDF, instala la App en Windows desde Chrome o Edge.'
        );
      }
    } finally {
      setIsExportingHtml(false);
    }
  };

  const handleExportEncryptedBackup = async () => {
    setBackupError(null);
    setBackupMessage(null);
    if (encryptPass.trim().length < 4) {
      setBackupError(
        'Ingresa una contraseña de al menos 4 caracteres para cifrar el respaldo.'
      );
      return;
    }
    try {
      const payload = await encryptDatabaseBackup(db, encryptPass.trim());
      triggerDownload(
        payload,
        `Respaldo_Cifrado_ControlTerm_${currentWeekKey}.ctbackup`,
        'application/json'
      );
      setBackupMessage(
        'Respaldo cifrado (AES-256) descargado. Puedes guardarlo en Google Drive, OneDrive o USB con total privacidad.'
      );
      setEncryptPass('');
    } catch {
      setBackupError('No se pudo generar el respaldo cifrado.');
    }
  };

  const handleExportPlainJson = () => {
    setBackupError(null);
    triggerDownload(
      JSON.stringify(db, null, 2),
      `Respaldo_ControlTerm_${currentWeekKey}.json`,
      'application/json'
    );
    setBackupMessage('Respaldo JSON descargado correctamente.');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupError(null);
    setBackupMessage(null);
    try {
      const text = await file.text();
      try {
        const restored = await decryptDatabaseBackup(text);
        onRestoreDatabase(restored);
        setBackupMessage('Datos restaurados correctamente desde el respaldo.');
      } catch (err) {
        if (err instanceof Error && err.message === 'PASSWORD_REQUIRED') {
          setPendingRestoreText(text);
        } else {
          setBackupError(
            'El archivo no corresponde a un respaldo válido de ControlTerm.'
          );
        }
      }
    } catch {
      setBackupError('No se pudo leer el archivo seleccionado.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDecryptAndRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingRestoreText) return;
    setBackupError(null);
    try {
      const restored = await decryptDatabaseBackup(
        pendingRestoreText,
        decryptPass.trim()
      );
      onRestoreDatabase(restored);
      setPendingRestoreText(null);
      setDecryptPass('');
      setBackupMessage('Respaldo cifrado descifrado y restaurado con éxito.');
    } catch {
      setBackupError('Contraseña incorrecta o archivo dañado.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Ejecución Local en Windows, Servicios y Respaldos
            </h3>
            <p className="text-xs text-slate-500">
              Base de datos local privada con exportación portátil y gestión de servicios
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-6 py-2.5">
          <button
            type="button"
            onClick={() => setActiveSection('windows')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeSection === 'windows'
                ? 'bg-white text-sky-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Windows / App Local
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('services')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeSection === 'services'
                ? 'bg-white text-sky-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Servicios y Distritos ({db.services.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('backup')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeSection === 'backup'
                ? 'bg-white text-sky-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Respaldo Cifrado
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('settings')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeSection === 'settings'
                ? 'bg-white text-sky-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Datos del Informe
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {backupMessage && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
              {backupMessage}
            </div>
          )}

          {backupError && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
              {backupError}
            </div>
          )}

          {activeSection === 'windows' && (
            <div className="space-y-4">
              {/* Option 1: Single-file complete HTML app */}
              <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <FileCode2 className="h-4 w-4 text-sky-700" />
                      <span>1. Descargar Aplicación Completa Portátil (.html)</span>
                    </h4>
                    <p className="text-xs leading-relaxed text-slate-700">
                      Descarga un único archivo autónomo que incluye{' '}
                      <strong>toda la aplicación y tu base de datos actual</strong>{' '}
                      (los {db.services.length} servicios, historial, exportación automática
                      a Excel y PDF, impresión de reportes, recordatorios WhatsApp/correo y
                      alta de nuevos servicios). Ábrelo con doble clic en cualquier PC con
                      Windows sin internet ni instalación.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isExportingHtml}
                    onClick={handleDownloadFullLocalHtml}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>
                      {isExportingHtml
                        ? 'Empaquetando...'
                        : 'Descargar App Completa (.html)'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Option 2: Install native Windows Desktop App via Edge / Chrome */}
              <div className="rounded-xl border border-slate-200 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <Laptop className="h-4 w-4 text-slate-700" />
                      <span>2. Instalar como Programa de Escritorio en Windows (Edge / Chrome)</span>
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Crea un acceso directo en el Escritorio y Menú Inicio de Windows,
                      abre en ventana propia y funciona 100% sin conexión con tu base de
                      datos local persistente.
                    </p>
                  </div>
                  {isInstallable && !isInstalled && (
                    <button
                      type="button"
                      onClick={install}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Instalar ahora en Windows</span>
                    </button>
                  )}
                </div>
                {!isInstallable && !isInstalled && (
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    En Microsoft Edge o Google Chrome, abre el menú del navegador (
                    <strong>⋮</strong> o <strong>···</strong>) &rarr;{' '}
                    <strong>Aplicaciones</strong> &rarr;{' '}
                    <strong>Instalar este sitio como una aplicación</strong>.
                  </p>
                )}
                {isInstalled && (
                  <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                    La aplicación ya está ejecutándose como aplicación de escritorio instalada.
                  </p>
                )}
              </div>

              {/* Option 3: Native .exe installer with Electron */}
              <div className="rounded-xl border border-slate-200 p-5">
                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Terminal className="h-4 w-4 text-slate-700" />
                  <span>3. Generar Instalador Nativo .exe para Windows (Electron)</span>
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Por seguridad, este entorno web en la nube no puede compilar binarios
                  ejecutables <code>.exe</code> directamente en tu equipo, pero el proyecto
                  ya incluye la configuración completa de escritorio (
                  <code>electron/main.cjs</code>, <code>electron-builder.json</code> y{' '}
                  <code>Construir_Instalador_Windows.bat</code>). Si descargas el código del
                  proyecto en Windows con Node.js instalado, ejecuta{' '}
                  <strong>Construir_Instalador_Windows.bat</strong> para generar{' '}
                  <code>ControlTerm-Setup.exe</code> y la versión portable.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'backup' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700 shrink-0" />
                  <div className="text-xs leading-relaxed text-slate-700">
                    <strong>Almacenamiento 100% privado y offline:</strong> toda la
                    información permanece exclusivamente en este dispositivo (IndexedDB +
                    LocalStorage). Para resguardar tu historial en otra PC o en tu nube
                    personal, genera un respaldo cifrado con contraseña.
                  </div>
                </div>
              </div>

              {/* Encrypted Backup */}
              <div className="rounded-xl border border-slate-200 p-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Lock className="h-4 w-4 text-sky-700" />
                  <span>Exportar Respaldo Cifrado (AES-256)</span>
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Protege los nombres, contactos y registros con una contraseña antes de
                  guardar el archivo.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="password"
                    value={encryptPass}
                    onChange={(e) => setEncryptPass(e.target.value)}
                    placeholder="Contraseña de cifrado (mín. 4 caracteres)"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-700 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleExportEncryptedBackup}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Descargar Respaldo Cifrado</span>
                  </button>
                </div>
              </div>

              {/* Restore & Plain JSON */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <h4 className="text-sm font-bold text-slate-900">
                    Restaurar Respaldo
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Importa un archivo <code>.ctbackup</code> cifrado o <code>.json</code>.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ctbackup,.json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Seleccionar archivo</span>
                  </button>

                  {pendingRestoreText && (
                    <form onSubmit={handleDecryptAndRestore} className="mt-3 space-y-2">
                      <input
                        type="password"
                        value={decryptPass}
                        onChange={(e) => setDecryptPass(e.target.value)}
                        placeholder="Ingresa contraseña del respaldo"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-700 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                      >
                        Descifrar y Restaurar
                      </button>
                    </form>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <h4 className="text-sm font-bold text-slate-900">
                    Exportar Base en JSON
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Copia legible de toda tu base de servicios, contactos e historial.
                  </p>
                  <button
                    type="button"
                    onClick={handleExportPlainJson}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Descargar JSON</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'services' && (
            <div className="space-y-5">
              <form
                onSubmit={handleCreateService}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
              >
                <h4 className="text-xs font-bold text-slate-900">
                  Agregar Nuevo Servicio a la Base de Datos
                </h4>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <select
                    value={newDistrict}
                    onChange={(e) => setNewDistrict(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    {Array.from(
                      new Set([...DISTRICT_ORDER, ...db.services.map((s) => s.district)])
                    ).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    <option value="__CUSTOM__">+ Otro distrito...</option>
                  </select>

                  {newDistrict === '__CUSTOM__' && (
                    <input
                      type="text"
                      value={customDistrict}
                      onChange={(e) => setCustomDistrict(e.target.value)}
                      placeholder="Nombre del nuevo distrito"
                      required
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    />
                  )}

                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nombre del servicio (ej: USF NUEVA)"
                    required
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />

                  <input
                    type="text"
                    value={newResponsible}
                    onChange={(e) => setNewResponsible(e.target.value)}
                    placeholder="Responsable (opcional)"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />

                  <input
                    type="tel"
                    value={newWhatsapp}
                    onChange={(e) => setNewWhatsapp(e.target.value)}
                    placeholder="WhatsApp (opcional)"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />

                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Correo (opcional)"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-800 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Agregar Servicio</span>
                </button>
              </form>

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {db.services.map((srv) => {
                  const isEditing = editingId === srv.id;
                  return (
                    <div
                      key={srv.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs"
                    >
                      {isEditing ? (
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            aria-label="Editar nombre del servicio"
                            className="min-w-44 flex-1 rounded border border-sky-400 bg-white px-2.5 py-1 text-xs font-semibold text-slate-900 focus:outline-none"
                          />
                          <select
                            value={editDistrict}
                            onChange={(e) => setEditDistrict(e.target.value)}
                            aria-label="Editar distrito del servicio"
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                          >
                            {Array.from(
                              new Set([
                                ...DISTRICT_ORDER,
                                ...db.services.map((s) => s.district),
                              ])
                            ).map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const cleaned = editName.trim().toUpperCase();
                              if (!cleaned) return;
                              onUpdateServiceInfo(srv.id, {
                                name: cleaned,
                                district: editDistrict || srv.district,
                              });
                              setEditingId(null);
                              setBackupMessage(`Servicio actualizado a "${cleaned}".`);
                            }}
                            title="Guardar cambios"
                            className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Guardar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            title="Cancelar edición"
                            className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0">
                            <span
                              className={`font-semibold ${
                                srv.active ? 'text-slate-900' : 'text-slate-400 line-through'
                              }`}
                            >
                              {srv.name}
                            </span>
                            <span className="ml-2 text-slate-500">· {srv.district}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(srv.id);
                                setEditName(srv.name);
                                setEditDistrict(srv.district);
                              }}
                              title="Editar nombre o distrito"
                              className="rounded p-1 text-slate-400 hover:bg-sky-50 hover:text-sky-700 cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleServiceActive(srv.id)}
                              className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              {srv.active ? 'Activo' : 'Inactivo'}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteService(srv.id)}
                              title="Eliminar servicio"
                              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeSection === 'settings' && (
            <form onSubmit={handleSaveMeta} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Título de la Región o Institución (aparece en PDF e impresión)
                </label>
                <input
                  type="text"
                  value={regionTitle}
                  onChange={(e) => setRegionTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Coordinador / Firma del Informe
                </label>
                <input
                  type="text"
                  value={coordinatorName}
                  onChange={(e) => setCoordinatorName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-700 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 cursor-pointer"
              >
                Guardar Datos del Informe
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
