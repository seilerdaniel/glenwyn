import React, { useState, useEffect } from 'react';
import { displayFont, monoFont } from '../theme';
import { Table2, LayoutGrid, Calendar as CalendarIcon, GalleryHorizontal, Database, X, ExternalLink, Trash2, Pencil, Check } from 'lucide-react';
import { IconPicker } from './SidebarViews';
import {
  PROPERTY_TYPES,
  ROLLUP_AGGREGATIONS,
  getDatabaseRecords,
  getPropertyValue,
  getRelatedRecords,
  resolvePropertyValue,
} from '../lib/pageUtils';

export function DatabaseView({ t, page, database, viewMode, onChangeViewMode, onRenameDatabase, onSetDatabaseIcon, ...viewProps }) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const tabs = [
    { id: 'table', label: 'Tabla', Icon: Table2 },
    { id: 'board', label: 'Tablero', Icon: LayoutGrid },
    { id: 'calendar', label: 'Calendario', Icon: CalendarIcon },
    { id: 'gallery', label: 'Galería', Icon: GalleryHorizontal },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIconPickerOpen((o) => !o);
            }}
            title="Cambiar el ícono de la base de datos"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, display: 'flex' }}
          >
            {page.icon ? (
              <span style={{ fontSize: 26 }}>{page.icon}</span>
            ) : (
              <Database size={26} strokeWidth={1.5} color={t.moss} />
            )}
          </button>
          {iconPickerOpen && (
            <IconPicker
              t={t}
              current={page.icon}
              onPick={(icon) => {
                onSetDatabaseIcon(icon);
                setIconPickerOpen(false);
              }}
            />
          )}
        </div>
        <input
          className="glenwyn-focus"
          value={page.title}
          onChange={(e) => onRenameDatabase(e.target.value)}
          placeholder="Sin título"
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            background: 'transparent',
            fontFamily: displayFont,
            fontWeight: 600,
            fontSize: 30,
            color: t.bark,
            outline: 'none',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 22, borderBottom: `1px solid ${t.clay}` }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChangeViewMode(tab.id)}
            className="glenwyn-focus"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              borderBottom: viewMode === tab.id ? `2px solid ${t.moss}` : '2px solid transparent',
              marginBottom: -1,
              cursor: 'pointer',
              color: viewMode === tab.id ? t.bark : t.fern,
              fontSize: 13,
              fontWeight: viewMode === tab.id ? 600 : 400,
            }}
          >
            <tab.Icon size={14} strokeWidth={1.75} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      {viewMode === 'board' ? (
        <DatabaseBoardView t={t} database={database} {...viewProps} />
      ) : viewMode === 'calendar' ? (
        <DatabaseCalendarView t={t} database={database} {...viewProps} />
      ) : viewMode === 'gallery' ? (
        <DatabaseGalleryView t={t} database={database} {...viewProps} />
      ) : (
        <DatabaseTableView t={t} database={database} {...viewProps} />
      )}
    </div>
  );
}

// Groups records into columns by the first 'select' property on the database.
// If there's no select property yet, says so plainly instead of guessing which
// column the person "probably" wants — Fase A's default schema always includes
// one ("Estado"), so this mostly matters for databases someone stripped down.
export function DatabaseBoardView({ t, database, records, onAddRecord, onOpenRecord }) {
  const groupProperty = database.properties.find((p) => p.type === 'select');

  if (!groupProperty) {
    return (
      <div style={{ color: t.fern, fontSize: 13.5, padding: '20px 0' }}>
        El tablero agrupa por una propiedad de tipo "Selección" — esta base de datos no tiene ninguna todavía.
        Agregá una desde la vista de Tabla para poder usar el tablero.
      </div>
    );
  }

  const columns = groupProperty.options || [];
  const columnsWithNone = ['', ...columns];

  return (
    <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
      {columnsWithNone.map((col) => {
        const columnRecords = records.filter(
          (r) => (getPropertyValue(r, groupProperty.id, groupProperty.type) || '') === col
        );
        return (
          <div key={col || '__none__'} style={{ width: 220, flexShrink: 0 }}>
            <div
              style={{
                fontSize: 11.5,
                fontFamily: monoFont,
                color: t.fern,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                marginBottom: 8,
                padding: '0 4px',
              }}
            >
              {col || 'Sin estado'} · {columnRecords.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {columnRecords.map((r) => (
                <div
                  key={r.id}
                  onClick={() => onOpenRecord(r.id)}
                  role="button"
                  tabIndex={0}
                  className="glenwyn-focus"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onOpenRecord(r.id);
                  }}
                  style={{
                    background: t.canvas,
                    border: `1px solid ${t.clay}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: t.bark,
                  }}
                >
                  {r.title || 'Sin título'}
                </div>
              ))}
              <button
                onClick={() => onAddRecord({ [groupProperty.id]: col })}
                className="glenwyn-focus"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: t.fern,
                  fontSize: 12.5,
                  padding: '6px 4px',
                  textAlign: 'left',
                }}
              >
                + agregar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// A month grid, placing records on the day matching the first 'date' property.
// Kept intentionally simple — a monthly agenda, not a full scheduling widget —
// records with no date set for that property just don't appear on the grid.
export function DatabaseCalendarView({ t, database, records, onAddRecord, onOpenRecord }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const dateProperty = database.properties.find((p) => p.type === 'date');

  if (!dateProperty) {
    return (
      <div style={{ color: t.fern, fontSize: 13.5, padding: '20px 0' }}>
        El calendario ubica registros por una propiedad de tipo "Fecha" — esta base de datos no tiene ninguna
        todavía. Agregá una desde la vista de Tabla para poder usar el calendario.
      </div>
    );
  }

  const recordsByDate = {};
  for (const r of records) {
    const value = getPropertyValue(r, dateProperty.id, 'date');
    if (!value) continue;
    (recordsByDate[value] = recordsByDate[value] || []).push(r);
  }

  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0 = Sunday
  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  const toISODate = (day) => {
    const mm = String(cursor.month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${cursor.year}-${mm}-${dd}`;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontFamily: displayFont, fontSize: 17, fontWeight: 600, color: t.bark, textTransform: 'capitalize' }}>
          {monthLabel}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))}
            className="glenwyn-focus"
            style={{ background: 'none', border: `1px solid ${t.clay}`, borderRadius: 6, cursor: 'pointer', color: t.fern, padding: '4px 10px' }}
          >
            ‹
          </button>
          <button
            onClick={() => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))}
            className="glenwyn-focus"
            style={{ background: 'none', border: `1px solid ${t.clay}`, borderRadius: 6, cursor: 'pointer', color: t.fern, padding: '4px 10px' }}
          >
            ›
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, fontSize: 10.5, color: t.fern, marginBottom: 4 }}>
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', padding: '2px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const iso = toISODate(day);
          const dayRecords = recordsByDate[iso] || [];
          return (
            <div
              key={iso}
              style={{
                minHeight: 74,
                border: `1px solid ${t.clay}`,
                borderRadius: 6,
                padding: 4,
                fontSize: 11,
              }}
            >
              <div style={{ color: t.fern, marginBottom: 3 }}>{day}</div>
              {dayRecords.slice(0, 3).map((r) => (
                <div
                  key={r.id}
                  onClick={() => onOpenRecord(r.id)}
                  role="button"
                  tabIndex={0}
                  className="glenwyn-focus"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenRecord(r.id);
                    }
                  }}
                  style={{
                    cursor: 'pointer',
                    color: t.bark,
                    background: t.clay,
                    borderRadius: 4,
                    padding: '2px 4px',
                    marginBottom: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.title || 'Sin título'}
                </div>
              ))}
              {dayRecords.length > 3 && (
                <div style={{ color: t.fern, fontSize: 10 }}>+{dayRecords.length - 3} más</div>
              )}
              <button
                onClick={() => onAddRecord({ [dateProperty.id]: iso })}
                className="glenwyn-focus"
                title="Agregar registro este día"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.fern, fontSize: 11, padding: 0 }}
              >
                +
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// A card grid over the same records. Deliberately doesn't try to pull a cover
// image out of a record's blocks (real cover-image extraction is more work than
// it looks, and honestly not needed for the main win here, which is just seeing
// several properties at a glance instead of scrolling a wide table sideways).
export function DatabaseGalleryView({ t, database, records, onAddRecord, onOpenRecord }) {
  const badgeProperties = database.properties.filter((p) => ['text', 'number', 'select', 'date', 'checkbox'].includes(p.type));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
        {records.map((r) => (
          <div
            key={r.id}
            onClick={() => onOpenRecord(r.id)}
            role="button"
            tabIndex={0}
            className="glenwyn-focus"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onOpenRecord(r.id);
            }}
            style={{
              background: t.canvas,
              border: `1px solid ${t.clay}`,
              borderRadius: 10,
              padding: 14,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: t.bark }}>{r.title || 'Sin título'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {badgeProperties.map((prop) => {
                const value = getPropertyValue(r, prop.id, prop.type);
                if (value === '' || value === false || value === null || value === undefined) return null;
                return (
                  <span
                    key={prop.id}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: t.fern, background: t.clay, borderRadius: 4, padding: '2px 6px' }}
                  >
                    {prop.type === 'checkbox' ? (
                      <>
                        <Check size={11} strokeWidth={2} /> {prop.name}
                      </>
                    ) : (
                      String(value)
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        <button
          onClick={() => onAddRecord()}
          className="glenwyn-focus"
          style={{
            border: `1px dashed ${t.clay}`,
            borderRadius: 10,
            padding: 14,
            cursor: 'pointer',
            background: 'none',
            color: t.fern,
            fontSize: 13,
            minHeight: 60,
          }}
        >
          + Nueva tarjeta
        </button>
      </div>
    </div>
  );
}

export function DatabaseTableView({
  t,
  database,
  databases,
  allPages,
  records,
  onRenameProperty,
  onChangePropertyType,
  onRemoveProperty,
  onAddProperty,
  onSetRelatedDatabase,
  onSetRollupConfig,
  onSetDefaultValue,
  onUpdateCell,
  onToggleRelation,
  onRenameRecord,
  onAddRecord,
  onOpenRecord,
  onDeleteRecord,
}) {
  const properties = database.properties;
  const gridTemplateColumns = `220px repeat(${properties.length}, minmax(150px, 1fr)) 36px`;
  const cellStyle = { padding: '8px 10px', borderBottom: `1px solid ${t.clay}`, display: 'flex', alignItems: 'center', minWidth: 0 };
  const headerCellStyle = { ...cellStyle, borderBottom: `1.5px solid ${t.clay}`, paddingBottom: 8, flexDirection: 'column', alignItems: 'stretch', gap: 4 };
  const otherDatabases = databases.filter((d) => d.id !== database.id);
  const databaseLabel = (db) => {
    const dbPage = allPages.find((p) => p.id === db.pageId);
    return dbPage ? dbPage.title || 'Sin título' : 'Base de datos';
  };

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns, minWidth: 640 }}>
          <div style={{ ...headerCellStyle, fontSize: 11, fontFamily: monoFont, color: t.fern, textTransform: 'uppercase', flexDirection: 'row' }}>
            Título
          </div>
          {properties.map((prop) => {
            const relationProperty = database.properties.find((p) => p.id === prop.relationPropertyId);
            const relatedDatabaseForRollup = relationProperty
              ? databases.find((d) => d.id === relationProperty.relatedDatabaseId)
              : null;
            return (
              <div key={prop.id} style={headerCellStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    value={prop.name}
                    onChange={(e) => onRenameProperty(prop.id, e.target.value)}
                    className="glenwyn-focus"
                    style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontSize: 12, fontWeight: 600, color: t.bark, outline: 'none' }}
                  />
                  <select
                    value={prop.type}
                    onChange={(e) => onChangePropertyType(prop.id, e.target.value)}
                    title="Tipo de propiedad"
                    style={{ fontSize: 10.5, color: t.fern, background: 'transparent', border: 'none', flexShrink: 0 }}
                  >
                    {PROPERTY_TYPES.map((pt) => (
                      <option key={pt.type} value={pt.type}>{pt.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => onRemoveProperty(prop.id)}
                    title="Quitar columna"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.fern, flexShrink: 0, padding: 2, display: 'flex' }}
                  >
                    <X size={11} strokeWidth={2} />
                  </button>
                </div>
                {prop.type === 'relation' && (
                  <select
                    value={prop.relatedDatabaseId || ''}
                    onChange={(e) => onSetRelatedDatabase(prop.id, e.target.value)}
                    style={{ fontSize: 10.5, color: t.fern, border: `1px solid ${t.clay}`, borderRadius: 4, background: 'transparent' }}
                  >
                    <option value="">relacionar con…</option>
                    {otherDatabases.map((db) => (
                      <option key={db.id} value={db.id}>{databaseLabel(db)}</option>
                    ))}
                  </select>
                )}
                {prop.type === 'rollup' && (
                  <>
                    <select
                      value={prop.relationPropertyId || ''}
                      onChange={(e) => onSetRollupConfig(prop.id, { relationPropertyId: e.target.value, targetPropertyId: undefined })}
                      style={{ fontSize: 10.5, color: t.fern, border: `1px solid ${t.clay}`, borderRadius: 4, background: 'transparent' }}
                    >
                      <option value="">a través de…</option>
                      {database.properties
                        .filter((p) => p.type === 'relation')
                        .map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    {relatedDatabaseForRollup && (
                      <select
                        value={prop.targetPropertyId || ''}
                        onChange={(e) => onSetRollupConfig(prop.id, { targetPropertyId: e.target.value })}
                        style={{ fontSize: 10.5, color: t.fern, border: `1px solid ${t.clay}`, borderRadius: 4, background: 'transparent' }}
                      >
                        <option value="">propiedad…</option>
                        {relatedDatabaseForRollup.properties.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    )}
                    <select
                      value={prop.aggregation || 'count'}
                      onChange={(e) => onSetRollupConfig(prop.id, { aggregation: e.target.value })}
                      style={{ fontSize: 10.5, color: t.fern, border: `1px solid ${t.clay}`, borderRadius: 4, background: 'transparent' }}
                    >
                      {ROLLUP_AGGREGATIONS.map((agg) => (
                        <option key={agg.type} value={agg.type}>{agg.label}</option>
                      ))}
                    </select>
                  </>
                )}
                {['text', 'number', 'select', 'checkbox', 'date'].includes(prop.type) && (
                  <DefaultValueControl t={t} property={prop} onChange={(v) => onSetDefaultValue(prop.id, v)} />
                )}
              </div>
            );
          })}
          <div style={headerCellStyle}>
            <button
              onClick={onAddProperty}
              title="Agregar propiedad"
              className="glenwyn-focus"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.fern, fontSize: 15 }}
            >
              +
            </button>
          </div>

          {records.map((record) => (
            <React.Fragment key={record.id}>
              <div style={cellStyle}>
                <input
                  value={record.title}
                  onChange={(e) => onRenameRecord(record.id, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="Sin título"
                  className="glenwyn-focus"
                  style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontSize: 13.5, color: t.bark, outline: 'none' }}
                />
                <button
                  onClick={() => onOpenRecord(record.id)}
                  title="Abrir como página completa"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.fern, flexShrink: 0, display: 'flex' }}
                >
                  <ExternalLink size={13} strokeWidth={1.75} />
                </button>
              </div>
              {properties.map((prop) => (
                <div key={prop.id} style={cellStyle}>
                  {prop.type === 'relation' ? (
                    <RelationCell
                      t={t}
                      property={prop}
                      record={record}
                      databases={databases}
                      allPages={allPages}
                      onToggle={(relatedId) => onToggleRelation(record.id, prop.id, relatedId)}
                    />
                  ) : prop.type === 'rollup' ? (
                    <RollupCell t={t} property={prop} record={record} database={database} databases={databases} allPages={allPages} />
                  ) : (
                    <PropertyCell
                      t={t}
                      property={prop}
                      value={getPropertyValue(record, prop.id, prop.type)}
                      onChange={(v) => onUpdateCell(record.id, prop.id, v)}
                    />
                  )}
                </div>
              ))}
              <div style={cellStyle}>
                <button
                  onClick={() => onDeleteRecord(record.id)}
                  title="Eliminar fila (va a la papelera)"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.fern, display: 'flex' }}
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
      <button
        onClick={() => onAddRecord()}
        className="glenwyn-focus"
        style={{
          marginTop: 10,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: t.fern,
          fontSize: 13.5,
          padding: '8px 10px',
        }}
      >
        + Nueva fila
      </button>
    </div>
  );
}

// A relation cell shows the related records as small removable chips, plus a
// button that opens a checklist of every record in the related database — kept
// deliberately simple (no search filter) since Fase C's related databases are
// expected to be small; a search box can be added later if that stops holding.
export function RelationCell({ t, property, record, databases, allPages, onToggle }) {
  const [open, setOpen] = useState(false);
  const relatedDatabase = databases.find((d) => d.id === property.relatedDatabaseId);
  const relatedRecords = getRelatedRecords(allPages, record, property.id);

  // A popover that can only be dismissed by clicking the exact button that opened
  // it isn't really closable for a keyboard user — Escape and an outside click
  // both need to work, same as every other popover in the app.
  useEffect(() => {
    if (!open) return;
    const closeIt = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const closeOnOutsideClick = () => setOpen(false);
    window.addEventListener('keydown', closeIt);
    window.addEventListener('click', closeOnOutsideClick);
    return () => {
      window.removeEventListener('keydown', closeIt);
      window.removeEventListener('click', closeOnOutsideClick);
    };
  }, [open]);

  if (!relatedDatabase) {
    return <span style={{ fontSize: 11.5, color: t.fern, fontStyle: 'italic' }}>sin configurar</span>;
  }

  const candidates = getDatabaseRecords(allPages, relatedDatabase.id);
  const selectedIds = new Set((record.properties && record.properties[property.id]) || []);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
        {relatedRecords.map((r) => (
          <span
            key={r.id}
            style={{ background: t.clay, color: t.bark, borderRadius: 4, padding: '1px 6px', fontSize: 11, whiteSpace: 'nowrap' }}
          >
            {r.title || 'Sin título'}
          </span>
        ))}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className="glenwyn-focus"
          aria-label={relatedRecords.length ? 'Editar relaciones' : 'Relacionar con un registro'}
          title={relatedRecords.length ? 'Editar relaciones' : 'Relacionar con un registro'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.fern, fontSize: 12, display: 'flex', alignItems: 'center' }}
        >
          {relatedRecords.length ? <Pencil size={11} strokeWidth={1.75} /> : '+ relacionar'}
        </button>
      </div>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            width: 200,
            maxHeight: 220,
            overflowY: 'auto',
            background: t.canvas,
            border: `1px solid ${t.clay}`,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            zIndex: 8,
          }}
        >
          {candidates.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: t.fern }}>sin registros todavía</div>
          ) : (
            candidates.map((c) => (
              <label
                key={c.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', fontSize: 12.5, color: t.bark, cursor: 'pointer' }}
              >
                <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => onToggle(c.id)} style={{ accentColor: t.moss }} />
                {c.title || 'Sin título'}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Read-only — a rollup's value is always computed, never stored or edited directly.
export function RollupCell({ t, property, record, database, databases, allPages }) {
  const { value, error } = resolvePropertyValue(allPages, databases, record, property, database);
  if (error) {
    return <span style={{ fontSize: 11.5, color: t.error, fontStyle: 'italic' }} title={`No se pudo calcular: ${error}`}>—</span>;
  }
  return <span style={{ fontSize: 13, color: t.bark }}>{value ?? '—'}</span>;
}

// Fase D "plantillas para registros nuevos" — the simple version. Rather than
// separate named templates, each property just carries a default that every
// new record picks up automatically.
export function DefaultValueControl({ t, property, onChange }) {
  const labelStyle = { fontSize: 10, color: t.fern };
  const controlStyle = { fontSize: 10.5, color: t.fern, border: `1px solid ${t.clay}`, borderRadius: 4, background: 'transparent', width: '100%' };

  if (property.type === 'checkbox') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, ...labelStyle }}>
        <input type="checkbox" checked={!!property.defaultValue} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: t.moss }} />
        marcada por defecto
      </label>
    );
  }
  if (property.type === 'select') {
    return (
      <select value={property.defaultValue || ''} onChange={(e) => onChange(e.target.value)} style={controlStyle}>
        <option value="">sin default</option>
        {(property.options || []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }
  if (property.type === 'date') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, ...labelStyle }}>
        <input
          type="checkbox"
          checked={property.defaultValue === '__today__'}
          onChange={(e) => onChange(e.target.checked ? '__today__' : '')}
          style={{ accentColor: t.moss }}
        />
        usar hoy
      </label>
    );
  }
  return (
    <input
      type={property.type === 'number' ? 'number' : 'text'}
      value={property.defaultValue ?? ''}
      onChange={(e) => onChange(property.type === 'number' ? e.target.value : e.target.value)}
      placeholder="sin default"
      style={controlStyle}
    />
  );
}

export function PropertyCell({ t, property, value, onChange }) {
  const sharedStyle = { width: '100%', border: 'none', background: 'transparent', fontSize: 13, color: t.bark, outline: 'none' };

  if (property.type === 'checkbox') {
    return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: t.moss, cursor: 'pointer' }} />;
  }
  if (property.type === 'date') {
    return <input type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} className="glenwyn-focus" style={{ ...sharedStyle, fontFamily: monoFont, fontSize: 12 }} />;
  }
  if (property.type === 'number') {
    return <input type="number" value={value === '' ? '' : value} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} className="glenwyn-focus" style={sharedStyle} />;
  }
  if (property.type === 'select') {
    return (
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ ...sharedStyle, cursor: 'pointer' }}>
        <option value="">—</option>
        {(property.options || []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }
  return <input value={value || ''} onChange={(e) => onChange(e.target.value)} className="glenwyn-focus" style={sharedStyle} />;
}
