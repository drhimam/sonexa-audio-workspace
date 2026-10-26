import { useState, useEffect } from 'react';
import { Folder as FolderIcon, FolderPlus, AudioWaveform, Check } from 'lucide-react';
import { Modal } from './Modal';
import type { Folder } from '@/lib/types';
import { clsx, formatDateLong } from '@/lib/utils';

interface NewSessionModalProps {
  open: boolean;
  onClose: () => void;
  folders: Folder[];
  initialFolderId?: string | null;
  onSubmit: (title: string, folderId: string | null) => Promise<void> | void;
  onCreateFolder?: (name: string) => Promise<Folder | null | void>;
}

export function NewSessionModal({
  open,
  onClose,
  folders,
  initialFolderId = null,
  onSubmit,
  onCreateFolder,
}: NewSessionModalProps) {
  const [title, setTitle] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [creatingFolderBusy, setCreatingFolderBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(`Session ${formatDateLong(Date.now())}`);
      setSelectedFolderId(initialFolderId ?? null);
      setIsCreatingFolder(false);
      setNewFolderName('');
      setSubmitting(false);
    }
  }, [open, initialFolderId]);

  const handleConfirm = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmedTitle, selectedFolderId);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNewFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || !onCreateFolder || creatingFolderBusy) return;
    setCreatingFolderBusy(true);
    try {
      const created = await onCreateFolder(trimmed);
      if (created && typeof created === 'object' && 'id' in created) {
        setSelectedFolderId(created.id);
      }
      setIsCreatingFolder(false);
      setNewFolderName('');
    } finally {
      setCreatingFolderBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Session"
      subtitle="Name your audio recording or transcript session and choose where to store it."
      icon={<AudioWaveform size={20} />}
      maxWidth="max-w-md"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!title.trim() || submitting}
            className="btn-primary"
          >
            {submitting ? 'Creating…' : 'Create Session'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Session Name Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text)] block">
            Session Title <span className="text-red-500">*</span>
          </label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleConfirm();
              }
            }}
            placeholder="e.g. Client Interview, Sprint Planning, Podcast Ep 1…"
            className="input text-sm !py-2.5 w-full font-medium"
          />
          <p className="text-[11px] text-muted">
            A clear name helps you find, search, and organize this session later.
          </p>
        </div>

        {/* Folder Selection */}
        <div className="space-y-2 pt-1 border-t border-app">
          <div className="flex items-center justify-between pt-1">
            <label className="text-xs font-semibold text-[var(--text)] block">
              Save in Folder
            </label>
            {onCreateFolder && !isCreatingFolder && (
              <button
                type="button"
                onClick={() => setIsCreatingFolder(true)}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
              >
                <FolderPlus size={13} />
                <span>+ New folder</span>
              </button>
            )}
          </div>

          {/* Inline Create Folder Form */}
          {isCreatingFolder && (
            <div className="p-3 rounded-xl border border-primary/30 surface-2 space-y-2 animate-fade-in">
              <span className="text-[11px] font-semibold text-primary block">Create Folder</span>
              <div className="flex items-center gap-2">
                <input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      await handleCreateNewFolder();
                    }
                  }}
                  placeholder="Folder name (e.g. Lectures, Meetings)…"
                  className="input text-xs !py-1.5 flex-1"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateNewFolder}
                  disabled={!newFolderName.trim() || creatingFolderBusy}
                  className="btn-primary !py-1.5 !px-3 text-xs"
                >
                  {creatingFolderBusy ? 'Adding…' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingFolder(false);
                    setNewFolderName('');
                  }}
                  className="btn-ghost !py-1.5 !px-2 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Folder Choices */}
          <div className="space-y-1.5 max-h-52 overflow-y-auto scroll-thin pr-1">
            {/* Unfiled option */}
            <button
              type="button"
              onClick={() => setSelectedFolderId(null)}
              className={clsx(
                'w-full text-left rounded-xl p-2.5 text-xs sm:text-sm flex items-center gap-2.5 transition border',
                selectedFolderId === null
                  ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                  : 'border-app hover:bg-black/[0.02] dark:hover:bg-white/[0.03] text-muted'
              )}
            >
              <div
                className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  selectedFolderId === null ? 'bg-primary text-white shadow-xs' : 'bg-black/5 dark:bg-white/5 text-soft'
                )}
              >
                <FolderIcon size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[var(--text)]">Unfiled</div>
                <div className="text-[11px] text-muted">Root library (no folder)</div>
              </div>
              {selectedFolderId === null && <Check size={16} className="text-primary shrink-0" />}
            </button>

            {/* Existing Folders */}
            {folders.map((f) => {
              const isSelected = selectedFolderId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFolderId(f.id)}
                  className={clsx(
                    'w-full text-left rounded-xl p-2.5 text-xs sm:text-sm flex items-center gap-2.5 transition border',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                      : 'border-app hover:bg-black/[0.02] dark:hover:bg-white/[0.03] text-muted'
                  )}
                >
                  <div
                    className={clsx(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      isSelected ? 'bg-primary text-white shadow-xs' : 'bg-primary/15 text-primary'
                    )}
                  >
                    <FolderIcon size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[var(--text)] truncate">{f.name}</div>
                    <div className="text-[11px] text-muted">Folder</div>
                  </div>
                  {isSelected && <Check size={16} className="text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
