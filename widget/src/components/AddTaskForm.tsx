import { useRef, useState } from 'react';

interface Props {
  projects: string[];
  onAdd: (name: string, project: string | null, projectIsNew: boolean, leftMin: number | null) => void;
  onCancel: () => void;
}

export default function AddTaskForm({ projects, onAdd, onCancel }: Props) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [projectValue, setProjectValue] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [leftMin, setLeftMin] = useState('');

  function handleSubmit() {
    const name = nameRef.current?.value.trim() ?? '';
    if (!name) { nameRef.current?.focus(); return; }

    let project: string | null = null;
    let projectIsNew = false;

    if (projectValue === '__new__') {
      project = newProjectName.trim();
      if (!project) return;
      projectIsNew = true;
    } else if (projectValue) {
      project = projectValue;
    }

    const left = leftMin.trim() ? parseInt(leftMin.trim(), 10) : null;
    onAdd(name, project, projectIsNew, left);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className="add-form">
      <input
        ref={nameRef}
        autoFocus
        type="text"
        placeholder="Nombre de la tarea"
        onKeyDown={handleKeyDown}
      />
      <div className="add-form-row">
        <select value={projectValue} onChange={e => setProjectValue(e.target.value)}>
          <option value="">— Sin proyecto —</option>
          {projects.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
          <option value="__new__">+ Nuevo…</option>
        </select>
        <input
          className="add-form-min"
          type="number"
          placeholder="min"
          min="1"
          value={leftMin}
          onChange={e => setLeftMin(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {projectValue === '__new__' && (
        <input
          autoFocus
          type="text"
          placeholder="Nombre del nuevo proyecto"
          value={newProjectName}
          onChange={e => setNewProjectName(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      )}
      <div className="form-actions">
        <button onClick={onCancel}>Cancelar</button>
        <button className="primary" onClick={handleSubmit}>Agregar</button>
      </div>
    </div>
  );
}
