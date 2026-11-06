import { useRef } from 'react';
import { CaretRight, Plus } from '@phosphor-icons/react';
import { settings } from './app-settings';
import type { LocalFontFile } from './local-fonts';
import type { Preferences } from './preference-records';

type AppearancePreferences = Preferences['appearance'];

type Props = {
  preferences: AppearancePreferences;
  onThemeChange: (value: string) => void;
  onBackgroundChange: (value: string) => void;
  onGlassChange: (value: string) => void;
  onPaletteChange: (id: string) => void;
  onEditFile: () => void;
  onFontChange: (id: string) => void;
  onFontRemove: (font: LocalFontFile) => void;
  onFontImport: (file: File) => void;
  onReset: () => void;
};

export function AppearanceSettings({
  preferences,
  onThemeChange,
  onBackgroundChange,
  onGlassChange,
  onPaletteChange,
  onEditFile,
  onFontChange,
  onFontRemove,
  onFontImport,
  onReset,
}: Props) {
  const fontInput = useRef<HTMLInputElement>(null);
  const activePalette = preferences.paletteRegistry.find(palette => palette.id === preferences.activePaletteId) ?? null;

  return <>
    <section aria-label="Theme options">
      <h2>Theme</h2>
      <div className="appearance-options" role="group" aria-label="Theme">
        {settings.appearance.themes.map(value => <button key={value} aria-pressed={preferences.theme === value} onClick={() => onThemeChange(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
      </div>
    </section>
    <section aria-label="Background options">
      <h2>Background</h2>
      <div className="appearance-options" role="group" aria-label="Background">
        {settings.appearance.backgrounds.map(value => <button key={value} aria-pressed={preferences.background === value} onClick={() => onBackgroundChange(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
      </div>
    </section>
    {activePalette && <section aria-label="Glass options">
      <h2>Glass</h2>
      <div className="appearance-options" role="group" aria-label="Glass">
        {settings.appearance.glass.map(value => <button key={value} aria-pressed={preferences.glass === value} onClick={() => onGlassChange(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
      </div>
    </section>}
    <section aria-label="Color palette">
      <h2>Palette</h2>
      <div className="appearance-options" role="group" aria-label="Color palette">
        <button aria-pressed={!activePalette} onClick={() => onPaletteChange('')}>Default</button>
        {preferences.paletteRegistry.map(palette => <button key={palette.id} aria-pressed={preferences.activePaletteId === palette.id} onClick={() => onPaletteChange(palette.id)}>{palette.name}</button>)}
      </div>
      <button className="settings-action" onClick={onEditFile}>Edit appearance file<CaretRight size={18}/></button>
    </section>
    <section aria-label="Font options">
      <h2>Font</h2>
      <div className="appearance-options" role="group" aria-label="Font family">
        <button aria-pressed={preferences.fontFamily === 'system'} onClick={() => onFontChange('system')}>System</button>
        {preferences.fonts.map(font => <div className="local-font-choice" key={font.id}>
          <button aria-pressed={preferences.fontFamily === font.id} onClick={() => onFontChange(font.id)}>{font.label}</button>
          <button className="quiet-button" aria-label={'Remove font ' + font.label} onClick={() => onFontRemove(font)}>Remove</button>
        </div>)}
      </div>
      <input ref={fontInput} type="file" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" hidden onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) onFontImport(file);
      }}/>
      <button className="settings-action" onClick={() => fontInput.current?.click()}>Import font file<Plus size={18}/></button>
      <div className="source-revision">Font files stay on this device</div>
    </section>
    <button className="quiet-button settings-reset" onClick={onReset}>Reset appearance</button>
  </>;
}
