import { useState, useRef } from 'react';
import {
  Download, Upload, FileJson, AlertCircle, CheckCircle2,
  Loader2, RefreshCw, Database, FileText, Music,
} from 'lucide-react';
import { Modal } from './Modal';
import {
  downloadDatabaseBackup,
  inspectBackupFile,
  importDatabaseFromJson,
  type SonexaDatabaseDump,
  type ImportSummary,
} from '@/lib/databaseBackup';

interface DataBackupModalProps {
  open: boolean;
  onClose: () => void;
  onDataChanged: () => Promise<void>;
}

export function DataBackupModal({ open, onClose, onDataChanged }: DataBackupModalProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // Export State
  const [includeAudio, setIncludeAudio] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ ratio: number; label: string } | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Import State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [dumpData, setDumpData] = useState<SonexaDatabaseDump | null>(null);
  const [fileSummary, setFileSummary] = useState<ImportSummary | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ ratio: number; label: string } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<{
    sessions: number;
    folders: number;
    audio: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportProgress({ ratio: 0.1, label: 'Gathering local data…' });
    setExportSuccess(false);

    try {
      await downloadDatabaseBackup({
        includeAudioBlobs: includeAudio,
        onProgress: (ratio, label) => setExportProgress({ ratio, label }),
      });
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setInspecting(true);
    setImportError(null);
    setDumpData(null);
    setFileSummary(null);
    setImportSuccess(null);

    try {
      const { dump, summary } = await inspectBackupFile(file);
      setDumpData(dump);
      setFileSummary(summary);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Invalid backup JSON file.');
      setSelectedFile(null);
    } finally {
      setInspecting(false);
    }
  };

  const handleImport = async () => {
    if (!dumpData) return;

    setImporting(true);
    setImportError(null);
    setImportProgress({ ratio: 0.1, label: 'Starting import…' });

    try {
      const result = await importDatabaseFromJson(dumpData, importMode, (ratio, label) => {
        setImportProgress({ ratio, label });
      });

      if (result.success) {
        setImportSuccess({
          sessions: result.sessionsImported,
          folders: result.foldersImported,
          audio: result.audioBlobsImported,
        });
        await onDataChanged();
      } else {
        setImportError(result.error || 'Failed to import backup.');
      }
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transfer & Backup Database"
      subtitle="Export all your sessions, folders, and recordings to a JSON file to transfer between devices or restore a previous backup."
      icon={<Database size={18} className="text-primary" />}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4 pt-1">
        {/* Tab switch */}
        <div className="flex border-b border-app">
          <button
            onClick={() => setActiveTab('export')}
            className={`pb-2.5 px-4 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'export'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-[var(--text)]'
            }`}
          >
            <Download size={14} />
            <span>Export Database (JSON)</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`pb-2.5 px-4 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'import'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-[var(--text)]'
            }`}
          >
            <Upload size={14} />
            <span>Import & Restore (JSON)</span>
          </button>
        </div>

        {/* 1. EXPORT TAB */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div className="p-3 surface-2 rounded-xl border border-app text-xs text-muted leading-relaxed">
              Generate a portable <strong>Sonexa Database Backup (.json)</strong>. You can copy this file to any computer, phone, or browser and import it to access all your sessions and documents.
            </div>

            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-[var(--text)] block">Backup Options</label>
              
              <div
                onClick={() => setIncludeAudio(true)}
                className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                  includeAudio
                    ? 'border-primary bg-primary/5 text-[var(--text)]'
                    : 'border-app hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  includeAudio ? 'border-primary' : 'border-app'
                }`}>
                  {includeAudio && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <div className="text-xs font-semibold flex items-center gap-1.5">
                    <Music size={13} className="text-primary" />
                    <span>Complete Backup (Recommended)</span>
                  </div>
                  <p className="text-[11px] text-muted mt-0.5">
                    Includes all sessions, transcripts, AI summaries, chats, generated documents, folders, settings, and base64-encoded audio recordings.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setIncludeAudio(false)}
                className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                  !includeAudio
                    ? 'border-primary bg-primary/5 text-[var(--text)]'
                    : 'border-app hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  !includeAudio ? 'border-primary' : 'border-app'
                }`}>
                  {!includeAudio && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <div className="text-xs font-semibold flex items-center gap-1.5">
                    <FileText size={13} className="text-primary" />
                    <span>Lightweight Text Backup (Faster, smaller file)</span>
                  </div>
                  <p className="text-[11px] text-muted mt-0.5">
                    Includes all transcripts, chats, documents, and folders, but excludes heavy audio recordings. Ideal for quick transfer or email.
                  </p>
                </div>
              </div>
            </div>

            {/* Export Progress bar */}
            {exportProgress && (
              <div className="space-y-1.5 p-3 rounded-lg surface-2 border border-app animate-slide-up">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">{exportProgress.label}</span>
                  <span className="font-mono text-primary font-bold">
                    {Math.round(exportProgress.ratio * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-200 rounded-full"
                    style={{ width: `${exportProgress.ratio * 100}%` }}
                  />
                </div>
              </div>
            )}

            {exportSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs animate-slide-up">
                <CheckCircle2 size={16} />
                <span>Backup JSON file downloaded successfully!</span>
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn-primary w-full !py-2.5 text-xs font-semibold shadow-soft"
            >
              {exporting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Generating Backup JSON…</span>
                </>
              ) : (
                <>
                  <Download size={15} />
                  <span>Download Backup File (.json)</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* 2. IMPORT TAB */}
        {activeTab === 'import' && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-app hover:border-primary/50 surface-2 p-8 rounded-xl text-center cursor-pointer transition"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                  <Upload size={22} />
                </div>
                <p className="text-sm font-semibold">Click to choose a Sonexa backup file (.json)</p>
                <p className="text-xs text-soft mt-1">Accepts any valid Sonexa JSON database dump</p>
              </div>
            ) : (
              <div className="space-y-3 animate-slide-up">
                {/* File Inspection Card */}
                <div className="p-3.5 surface-2 rounded-xl border border-app space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[var(--text)] flex items-center gap-1.5 truncate">
                      <FileJson size={15} className="text-primary shrink-0" />
                      <span className="truncate">{selectedFile.name}</span>
                    </span>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setDumpData(null);
                        setFileSummary(null);
                        setImportSuccess(null);
                      }}
                      className="text-xs text-soft hover:text-red-500 ml-2"
                    >
                      Change file
                    </button>
                  </div>

                  {inspecting && (
                    <div className="flex items-center gap-2 text-xs text-muted py-2">
                      <Loader2 size={13} className="animate-spin text-primary" />
                      <span>Reading and verifying backup structure…</span>
                    </div>
                  )}

                  {fileSummary && (
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-app text-center">
                      <div className="p-2 surface rounded-lg">
                        <div className="text-base font-bold text-primary">{fileSummary.sessionCount}</div>
                        <div className="text-[10px] text-muted">Sessions</div>
                      </div>
                      <div className="p-2 surface rounded-lg">
                        <div className="text-base font-bold text-primary">{fileSummary.folderCount}</div>
                        <div className="text-[10px] text-muted">Folders</div>
                      </div>
                      <div className="p-2 surface rounded-lg">
                        <div className="text-base font-bold text-primary">{fileSummary.audioCount}</div>
                        <div className="text-[10px] text-muted">Audio Files</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Import Mode selection */}
                {fileSummary && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text)] block">Restore Mode</label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setImportMode('merge')}
                        className={`p-2.5 rounded-lg border text-left transition ${
                          importMode === 'merge'
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-app text-muted hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <CheckCircle2 size={13} /> Merge (Safe)
                        </div>
                        <p className="text-[10px] font-normal opacity-80">
                          Adds imported items to your current database. No data lost.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImportMode('replace')}
                        className={`p-2.5 rounded-lg border text-left transition ${
                          importMode === 'replace'
                            ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold'
                            : 'border-app text-muted hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <RefreshCw size={13} /> Replace All
                        </div>
                        <p className="text-[10px] font-normal opacity-80">
                          Wipes current local database and restores exact state.
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                {/* Import progress */}
                {importProgress && (
                  <div className="space-y-1.5 p-3 rounded-lg surface-2 border border-app animate-slide-up">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted">{importProgress.label}</span>
                      <span className="font-mono text-primary font-bold">
                        {Math.round(importProgress.ratio * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-200 rounded-full"
                        style={{ width: `${importProgress.ratio * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {importError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <div className="flex-1">{importError}</div>
                  </div>
                )}

                {importSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs space-y-1 animate-slide-up">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 size={16} />
                      <span>Database restored successfully!</span>
                    </div>
                    <p className="text-[11px] opacity-90 pl-6">
                      Restored {importSuccess.sessions} sessions, {importSuccess.folders} folders, and {importSuccess.audio} audio files.
                    </p>
                  </div>
                )}

                {!importSuccess && (
                  <button
                    onClick={handleImport}
                    disabled={importing || !dumpData}
                    className="btn-primary w-full !py-2.5 text-xs font-semibold shadow-soft"
                  >
                    {importing ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Restoring Database…</span>
                      </>
                    ) : (
                      <>
                        <Upload size={15} />
                        <span>Restore from this Backup</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
