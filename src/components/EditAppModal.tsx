/* ============================================
   Edit Connected App Details Modal
   Allows customizing display name & thumbnail image
   ============================================ */
import { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  RotateCcw,
  Check,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Tag,
} from 'lucide-react';
import type { ConnectedApp } from '../types';
import { useWorkspaceStore } from '../store';
import { RUNTIME_LABELS } from '../types';

interface EditAppModalProps {
  app: ConnectedApp | null;
  isOpen: boolean;
  onClose: () => void;
}

const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
];

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export function EditAppModal({ app, isOpen, onClose }: EditAppModalProps) {
  const { updateApp } = useWorkspaceStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(app?.displayName || app?.repoName || '');
  const [thumbnailPreview, setThumbnailPreview] = useState<string>(app?.customThumbnail || '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !app) return null;

  const handleNameChange = (val: string) => {
    setDisplayName(val);
    if (!val.trim()) {
      setNameError('Display name cannot be empty.');
    } else if (val.trim().length > 60) {
      setNameError('Display name cannot exceed 60 characters.');
    } else {
      setNameError(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setThumbnailError(null);

    // Validate format
    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      setThumbnailError('Unsupported format. Please upload a PNG, JPEG, WebP, SVG, or GIF image.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setThumbnailError('File size exceeds 2MB limit. Please choose a smaller image.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setThumbnailPreview(dataUrl);
        setThumbnailError(null);
      }
    };
    reader.onerror = () => {
      setThumbnailError('Failed to read image file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleResetThumbnail = () => {
    setThumbnailPreview('');
    setThumbnailError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleResetName = () => {
    setDisplayName(app.repoName);
    setNameError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = displayName.trim();
    if (!trimmed) {
      setNameError('Display name cannot be empty.');
      return;
    }
    if (trimmed.length > 60) {
      setNameError('Display name cannot exceed 60 characters.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Simulate minor async persistence tick for smooth user feedback
      await new Promise((resolve) => setTimeout(resolve, 150));

      updateApp(app.id, {
        displayName: trimmed !== app.repoName ? trimmed : undefined,
        customThumbnail: thumbnailPreview.trim() ? thumbnailPreview : undefined,
      });

      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update application';
      setSaveError(msg);
      setIsSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 'var(--z-modal)', padding: 'var(--space-4)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-app-title"
    >
      <div
        className="modal-card"
        style={{
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div>
            <h2
              id="edit-app-title"
              style={{
                fontSize: 'var(--font-size-md)',
                fontWeight: 'var(--font-weight-semibold)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Tag size={18} />
              Edit Application
            </h2>
            <p
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-tertiary)',
                marginTop: '2px',
              }}
            >
              Customize display details for {app.repoName}
            </p>
          </div>
          <button
            className="btn btn-icon btn-ghost btn-sm"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ overflowY: 'auto', padding: 'var(--space-5)' }}>
          {saveError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-error-bg)',
                color: 'var(--color-error)',
                fontSize: 'var(--font-size-xs)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{saveError}</span>
            </div>
          )}

          {isSuccess && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-success-bg)',
                color: 'var(--color-success)',
                fontSize: 'var(--font-size-xs)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <Check size={16} style={{ flexShrink: 0 }} />
              <span>Application details updated successfully!</span>
            </div>
          )}

          {/* 1. Display Name Field */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-1)',
              }}
            >
              <label
                htmlFor="edit-app-display-name"
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Display Name <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              {displayName !== app.repoName && (
                <button
                  type="button"
                  onClick={handleResetName}
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-info)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  Reset to repo name
                </button>
              )}
            </div>
            <input
              id="edit-app-display-name"
              className="input-field"
              type="text"
              value={displayName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Production Web Dashboard"
              style={{
                width: '100%',
                borderColor: nameError ? 'var(--color-error)' : undefined,
              }}
              disabled={isSaving}
              autoFocus
            />
            {nameError ? (
              <p
                style={{
                  fontSize: '11px',
                  color: 'var(--color-error)',
                  marginTop: 'var(--space-1)',
                }}
              >
                {nameError}
              </p>
            ) : (
              <p
                style={{
                  fontSize: '11px',
                  color: 'var(--color-text-tertiary)',
                  marginTop: 'var(--space-1)',
                }}
              >
                Changes the visible title in Repomova. GitHub repo ({app.repoFullName}) remains unchanged.
              </p>
            )}
          </div>

          {/* 2. Custom Thumbnail Field */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-2)',
              }}
            >
              <label
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Thumbnail Image
              </label>
              {thumbnailPreview && (
                <button
                  type="button"
                  onClick={handleResetThumbnail}
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-error)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <RotateCcw size={11} /> Reset to default
                </button>
              )}
            </div>

            {/* Thumbnail Preview Area */}
            <div
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: 'var(--color-bg-secondary)',
                position: 'relative',
                height: '140px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'var(--space-3)',
              }}
            >
              {thumbnailPreview ? (
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--space-2)',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <ImageIcon size={20} />
                  </div>
                  <span style={{ fontSize: 'var(--font-size-xs)' }}>
                    Default thumbnail: {RUNTIME_LABELS[app.runtimeType]}
                  </span>
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(',')}
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={isSaving}
            />

            {/* Action buttons for thumbnail */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
              >
                <Upload size={14} />
                <span>{thumbnailPreview ? 'Replace Image' : 'Upload Custom Image'}</span>
              </button>

              {thumbnailPreview && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleResetThumbnail}
                  disabled={isSaving}
                >
                  <RotateCcw size={14} />
                  <span>Use Default</span>
                </button>
              )}
            </div>

            {thumbnailError && (
              <p
                style={{
                  fontSize: '11px',
                  color: 'var(--color-error)',
                  marginTop: 'var(--space-2)',
                }}
              >
                {thumbnailError}
              </p>
            )}

            <p
              style={{
                fontSize: '11px',
                color: 'var(--color-text-tertiary)',
                marginTop: 'var(--space-2)',
              }}
            >
              Supported formats: PNG, JPEG, WebP, SVG, GIF (max 2MB).
            </p>
          </div>

          {/* Footer Controls */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--space-2)',
              marginTop: 'var(--space-6)',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--color-border-subtle)',
            }}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isSaving || Boolean(nameError) || isSuccess}
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : isSuccess ? (
                <>
                  <Check size={14} />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
