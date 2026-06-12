interface Props {
  confirmOpen: boolean;
  cancelConfirmOpen: boolean;
  onAskConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirmClose: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onCancel: () => void;
  onCancelCancelConfirm: () => void;
  onConfirmCancel: () => void;
}

export default function Controls({
  confirmOpen,
  cancelConfirmOpen,
  onAskConfirm,
  onCancelConfirm,
  onConfirmClose,
  isPaused,
  onTogglePause,
  onCancel,
  onCancelCancelConfirm,
  onConfirmCancel,
}: Props) {
  if (confirmOpen) {
    return (
      <div className="controls">
        <div className="close-confirm">
          <div className="confirm-text">¿Cerrar la sesión y guardar en Notion?</div>
          <div className="confirm-actions">
            <button onClick={onCancelConfirm}>Volver</button>
            <button className="close-btn" onClick={onConfirmClose}>Sí, cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  if (cancelConfirmOpen) {
    return (
      <div className="controls">
        <div className="close-confirm">
          <div className="confirm-text">¿Cancelar sin guardar? Las tareas volverán a su estado anterior.</div>
          <div className="confirm-actions">
            <button onClick={onCancelCancelConfirm}>Volver</button>
            <button className="cancel-session-btn" onClick={onConfirmCancel}>Sí, cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="controls">
      <button className="close-btn" onClick={onAskConfirm}>Close session</button>
      <button
        className={`icon-btn pause-icon-btn${isPaused ? ' is-paused' : ''}`}
        onClick={onTogglePause}
        title={isPaused ? 'Reanudar' : 'Pausar todos los timers'}
      >
        {isPaused ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 1.5V10.5L10 6L2.5 1.5Z" fill="currentColor" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="1" width="3" height="10" rx="1" fill="currentColor" />
            <rect x="7" y="1" width="3" height="10" rx="1" fill="currentColor" />
          </svg>
        )}
      </button>
      <button className="icon-btn cancel-icon-btn" onClick={onCancel} title="Cancel session (no Notion changes)">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
