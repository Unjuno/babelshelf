import { CaretRight } from '@phosphor-icons/react';
import { KeyboardInput } from './mobile';
import type { ModelSetGroup } from './model-sets';

type ModelSetItem = {
  id: string;
  group: ModelSetGroup;
  label: string;
  detail: string;
  storage: string;
  textFilesPresent: boolean;
};

type ModelSetListView = {
  screen: 'list';
  items: ModelSetItem[];
  canSave: boolean;
  onSelect: (id: string) => void;
  onSaveCurrent: () => void;
  onCancel: () => void;
};

type ModelSetSaveView = {
  screen: 'save';
  name: string;
  detail: string;
  saving: boolean;
  storagePending: boolean;
  onNameChange: (value: string) => void;
  onDetailChange: (value: string) => void;
  onBack: () => void;
  onSave: () => void;
};

type ModelSetReviewView = {
  screen: 'review';
  detail: string;
  rows: Array<{ label: string; current: string; next: string }>;
  applied: boolean;
  checking: boolean;
  deviceStatus: string | null;
  canCheck: boolean;
  canBack: boolean;
  canApply: boolean;
  canPrepare: boolean;
  onCheck: () => void;
  onDone: () => void;
  onPrepare: () => void;
  onBack: () => void;
  onApply: () => void;
};

export type ModelSetSheetsView =
  | ModelSetListView
  | ModelSetSaveView
  | ModelSetReviewView;

/** Presentation for model-set selection, review, and save. Persistence and validation stay in the host. */
export function ModelSetSheets({ view }: { view: ModelSetSheetsView }) {
  if (view.screen === 'list') {
    return (
      <div className="model-choice-sheet">
        <div className="model-options" role="group" aria-label="Model set">
          {(['Text models', 'Input sets', 'Combined sets', 'Saved by you'] as const)
            .filter(group => view.items.some(item => item.group === group))
            .map(group => (
            <section className="model-set-group" key={group} aria-label={group}>
              <h3 className="model-set-group-heading">{group}</h3>
              {view.items.filter(item => item.group === group).map(item => (
                <button className="model-choice" key={item.id} onClick={() => view.onSelect(item.id)}>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                    <small>Cold assets · {item.storage}{item.textFilesPresent ? ' · Text files found' : ''}</small>
                  </span>
                  <CaretRight size={18} />
                </button>
              ))}
            </section>
          ))}
        </div>
        <p className="source-revision">Selection only · prepare missing files separately</p>
        <div className="action-row">
          <button className="quiet-button" disabled={!view.canSave} onClick={view.onSaveCurrent}>Save current as set</button>
          <button className="quiet-button" onClick={view.onCancel}>Cancel</button>
        </div>
      </div>
    );
  }

  if (view.screen === 'save') {
    return (
      <form className="model-choice-sheet" onSubmit={event => { event.preventDefault(); view.onSave(); }}>
        <label>Name<KeyboardInput aria-label="Model set name" maxLength={48} value={view.name} onChange={event => view.onNameChange(event.target.value)} placeholder="Name" /></label>
        <label>Detail<KeyboardInput aria-label="Model set detail" maxLength={120} value={view.detail} onChange={event => view.onDetailChange(event.target.value)} placeholder="Short detail" /></label>
        <p className="source-revision">Saves the current model choices to Settings/models.md. Applying a set never downloads files.</p>
        <div className="action-row">
          <button type="button" className="quiet-button" disabled={view.saving} onClick={view.onBack}>Back</button>
          <button type="submit" className="solid-button" disabled={view.saving || view.storagePending || !view.name.trim() || !view.detail.trim()}>Save set</button>
        </div>
      </form>
    );
  }

  return (
    <div className="model-choice-sheet">
      <p>{view.detail}</p>
      <div className="model-set-review">
        {view.rows.map(row => (
          <div className="model-set-row" key={row.label}>
            <span>{row.label}</span>
            <span>{row.current} → {row.next}</span>
          </div>
        ))}
      </div>
      <p className="source-revision">{view.applied ? 'Set selected · files are prepared separately' : 'Applying a set does not prepare files. Device compatibility is not guaranteed.'}</p>
      <button className="quiet-button" disabled={!view.canCheck} onClick={view.onCheck}>{view.checking ? 'Checking…' : 'Check device'}</button>
      {view.deviceStatus && <div className="speech-runtime-status" role="status">{view.deviceStatus}</div>}
      <div className="action-row">
        {view.applied ? <>
          <button className="quiet-button" onClick={view.onDone}>Done</button>
          <button className="solid-button" disabled={!view.canPrepare} onClick={view.onPrepare}>Prepare models</button>
        </> : <>
          <button className="quiet-button" disabled={!view.canBack} onClick={view.onBack}>Back</button>
          <button className="solid-button" disabled={!view.canApply} onClick={view.onApply}>Apply set</button>
        </>}
      </div>
    </div>
  );
}
