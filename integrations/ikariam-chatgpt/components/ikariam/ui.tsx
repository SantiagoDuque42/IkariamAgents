'use client';

import { ChevronDown, ExternalLink, Flame, Gem, Grape, Mountain, TreePine } from 'lucide-react';
import type { ReactNode } from 'react';
import type { City, CityReference, LedgerRecord, MapResource, OwnIsland, Resource } from '../../lib/icariam/dashboard-types';

export const RESOURCES: Resource[] = ['wood', 'wine', 'marble', 'crystal', 'sulfur'];
export const MAP_RESOURCES: MapResource[] = ['wine', 'marble', 'crystal', 'sulfur'];
export const RESOURCE = {
  wood: { label: 'Madera', color: '#65936d', mapColor: '#71a788', icon: TreePine },
  wine: { label: 'Vino', color: '#8f5594', mapColor: '#ce95d1', icon: Grape },
  marble: { label: 'Mármol', color: '#707b88', mapColor: '#c5cdd9', icon: Mountain },
  crystal: { label: 'Cristal', color: '#227f97', mapColor: '#69c8da', icon: Gem },
  sulfur: { label: 'Azufre', color: '#a0782a', mapColor: '#e9bd67', icon: Flame },
};
const number = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1, useGrouping: 'always' });
const date = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
const dateLong = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' });

export function n(value?: number | null) { return value == null || !Number.isFinite(value) ? '—' : number.format(value); }
export function time(value?: string | null, long = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Sin fecha';
  return (long ? dateLong : date).format(new Date(value));
}
export function fieldDate(city: City, field: string) {
  return city._field_observed_at?.[field] ?? city.observed_at;
}
export function hours(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value > 0 && value < 1) return Math.max(1, Math.round(value * 60)) + ' min';
  return n(value) + ' h';
}
export function numeric(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}
export function cityName(city: LedgerRecord<City>) { return city.data.name ?? city.record_id; }
export function wineBudget(city: City, ref?: CityReference) {
  if (!ref || city.buildings?.taberna !== ref.wineModel.tavernLevel
    || (city.buildings?.prensa_vino ?? 0) !== ref.wineModel.pressLevel) return undefined;
  return ref.wineModel.hourlyBudget;
}
export const coordLabel = (x: number, y: number) => '[' + x + ':' + y + ']';
export const islandKey = (island: { x: number; y: number }) => island.x + ':' + island.y;
export function getOwnIsland(islands: OwnIsland[], x: number, y: number) {
  return islands.find((island) => island.x === x && island.y === y);
}

export function ResourceMark({ resource, size = 17 }: { resource: Resource; size?: number }) {
  const { icon: Icon, color } = RESOURCE[resource];
  return <Icon size={size} color={color} aria-hidden="true" />;
}

export function ResourceOptions({ value, onChange, all = false, map = false }: {
  value: Resource | ''; onChange: (value: Resource | '') => void; all?: boolean; map?: boolean;
}) {
  const options = map ? MAP_RESOURCES : RESOURCES;
  return <div className="resource-tabs" role="group" aria-label="Recurso">
    {all && <button type="button" aria-pressed={value === ''} onClick={() => onChange('')}>Todos</button>}
    {options.map((key) => <button type="button" aria-pressed={value === key} key={key} onClick={() => onChange(key)}>
      <ResourceMark resource={key} size={15} />{RESOURCE[key].label}
    </button>)}
  </div>;
}

export function External({ href, children, className = 'text-link' }: { href: string; children: ReactNode; className?: string }) {
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer">
    {children}<ExternalLink size={15} aria-hidden="true" />
  </a>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Select({ children, value, onChange, disabled }: {
  children: ReactNode; value: string | number; onChange: (value: string) => void; disabled?: boolean;
}) {
  return <span className="select-wrap"><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{children}</select>
    <ChevronDown size={17} aria-hidden="true" /></span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export function RecordContent({ content }: { content?: string }) {
  if (!content) return null;
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
  const cells = (line: string) => line.slice(1, -1).split('|').map((cell) => cell.trim());
  const blocks = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.startsWith('|') && lines[index + 1]?.startsWith('|')
      && cells(lines[index + 1]).every((cell) => /^:?-{3,}:?$/.test(cell))) {
      const key = index;
      const rows = [];
      index += 2;
      while (lines[index]?.startsWith('|')) rows.push(cells(lines[index++]));
      index--;
      blocks.push(<div key={key} className="table-wrap"><table><thead><tr>{cells(line).map((cell, column) =>
        <th key={column} scope="col">{cell}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>
          {row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^#{1,4} /.test(line)) { blocks.push(<h4 key={index}>{line.replace(/^#{1,4} /, '')}</h4>); continue; }
    const pieces = line.split(/(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+)/g);
    blocks.push(<p key={index} className={line.startsWith('- ') ? 'record-bullet' : undefined}>{pieces.map((piece, part) => {
      const markdown = piece.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      if (markdown && URL.canParse(markdown[2])) return <a key={part} href={markdown[2]} target="_blank" rel="noopener noreferrer">{markdown[1]}</a>;
      if (/^https?:\/\/\S+$/.test(piece) && URL.canParse(piece)) return <a key={part} href={piece} target="_blank" rel="noopener noreferrer">Fuente {new URL(piece).hostname}</a>;
      return <span key={part}>{part === 0 ? piece.replace(/^- /, '') : piece}</span>;
    })}</p>);
  }
  return <div className="record-content">{blocks}</div>;
}
