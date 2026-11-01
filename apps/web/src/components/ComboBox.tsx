// @ts-nocheck : code repris du widget Grist (grist/composants/ComboBox), typé progressivement.
'use client';
// Porté par scripts/port-page.mjs puis adapté à la main : ne pas regénérer par-dessus.
import React from 'react';
const { useState, useEffect, useMemo, useCallback } = React;

// Composant partagé "ComboBox" (type=component)
// Usage: gristUI.ComboBox dans les pages

const ComboBox = (props) => {
  const {
    id,
    label,
    options = [],
    value,
    onChange,
    multiple = false,
    placeholder = 'Sélectionner…',
    searchPlaceholder = 'Rechercher…',
    disabled = false,
    required = false,
    className = '',
    summaryMode = 'count' // 'count' | 'list'
  } = props || {};

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [pos, setPos] = React.useState({ top: 0, left: 0, width: 0 });
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const boxRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const listRef = React.useRef(null);

  const valueArray = Array.isArray(value) ? value : (value == null || value === '' ? [] : [value]);

  const sortedOptions = React.useMemo(() => {
    return [...(options || [])].sort((a, b) =>
      String(a?.label || '').localeCompare(String(b?.label || ''), 'fr', { sensitivity: 'base' })
    );
  }, [options]);

  const filteredOptions = React.useMemo(() => {
    const q = String(search || '').toLowerCase().trim();
    if (!q) return sortedOptions;
    return sortedOptions.filter(o => String(o.label || '').toLowerCase().includes(q));
  }, [sortedOptions, search]);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onScroll = () => updatePos();
    const onResize = () => setOpen(false);
    document.addEventListener('click', onClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    setActiveIndex(-1);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
  }, [open]);

  React.useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const valueKey = (v) => String(v);
  const isSelected = (val) => valueArray.map(valueKey).includes(valueKey(val));

  const updatePos = () => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  };

  const toggle = () => {
    updatePos();
    setOpen(o => !o);
  };

  const selectOne = (opt) => {
    if (!opt || opt.disabled) return;
    if (multiple) {
      const next = isSelected(opt.value)
        ? valueArray.filter(v => valueKey(v) !== valueKey(opt.value))
        : [...valueArray, opt.value];
      onChange && onChange(next);
    } else {
      onChange && onChange(opt.value);
      setOpen(false);
    }
    setSearch('');
  };

  const clearAll = () => {
    onChange && onChange(multiple ? [] : '');
  };

  const displayText = () => {
    if (multiple) {
      if (!valueArray.length) return placeholder;
      if (summaryMode === 'list') {
        return valueArray
          .map(v => sortedOptions.find(o => valueKey(o.value) === valueKey(v))?.label || String(v))
          .join(', ');
      }
      return `${valueArray.length} sélectionné(s)`;
    }
    if (!valueArray[0]) return placeholder;
    return sortedOptions.find(o => valueKey(o.value) === valueKey(valueArray[0]))?.label || String(valueArray[0]);
  };

  const displayStyle = multiple && summaryMode === 'list'
    ? {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    : {};

  return (
    <div className={`fr-input-group ${className || ''}`.trim()}>
      {label && (
        <label className="fr-label fr-mb-1w" htmlFor={id}>
          {label}
          {required && <span className="fr-text-default--error" aria-hidden="true"> *</span>}
        </label>
      )}
      <div
        ref={boxRef}
        style={{ position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="fr-input-wrap" style={{ display: 'flex' }}>
          <button
            type="button"
            className="fr-input"
            id={id}
            aria-expanded={open}
            onClick={(e) => { e.stopPropagation(); if (!disabled) toggle(); }}
            style={{ flex: '1 1 240px', textAlign: 'left', ...displayStyle }}
            disabled={disabled}
          >
            {displayText()}
          </button>
        </div>
        {open && (
          <div
            className="fr-card"
            style={{
              position: 'fixed',
              zIndex: 9999,
              background: 'var(--background-raised-grey, #fff)',
              border: '1px solid var(--border-default-grey)',
              borderRadius: '0.5rem',
              width: (pos.width && pos.width > 0) ? pos.width : '320px',
              top: pos.top || 0,
              left: pos.left || 0,
              maxHeight: '320px',
              overflow: 'hidden',
              boxShadow: '0 8px 18px rgba(0,0,0,0.15)',
              pointerEvents: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-default-grey)' }}>
              <input
                ref={inputRef}
                className="fr-input"
                type="search"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveIndex(i => Math.min(i + 1, filteredOptions.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveIndex(i => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const opt = filteredOptions[activeIndex];
                    if (opt) selectOne(opt);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setOpen(false);
                  }
                }}
              />
            </div>
            <div ref={listRef} style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {filteredOptions.map((o, idx) => {
                const checked = isSelected(o.value);
                const active = idx === activeIndex;
                const optId = `${id || 'combo'}-opt-${String(o.value)}`;
                const tooltip = String(o.tooltip || '').trim();
                const tooltipId = tooltip ? `${optId}-tooltip` : null;
                return (
                  <div
                    key={o.value}
                    data-idx={idx}
                    className="fr-px-1w fr-py-0_5w"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: active ? '#EEEEEE' : 'transparent',
                      cursor: o.disabled ? 'not-allowed' : 'pointer',
                      opacity: o.disabled ? 0.6 : 1
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => selectOne(o)}
                  >
                    {multiple ? (
                      <div className="fr-checkbox-group fr-checkbox-group--sm">
                        <input
                          id={optId}
                          type="checkbox"
                          checked={checked}
                          disabled={o.disabled}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => selectOne(o)}
                        />
                        <label
                          className="fr-label"
                          htmlFor={optId}
                          onClick={(e) => e.stopPropagation()}
                          aria-describedby={tooltipId || undefined}
                        >
                          <span>{o.label}</span>
                          {tooltipId && (
                            <span className="fr-tooltip fr-placement" id={tooltipId} role="tooltip">
                              {tooltip}
                            </span>
                          )}
                        </label>
                      </div>
                    ) : (
                      <>
                        <span aria-describedby={tooltipId || undefined}>{o.label}</span>
                        {tooltipId && (
                          <span className="fr-tooltip fr-placement" id={tooltipId} role="tooltip">
                            {tooltip}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              {!filteredOptions.length && (
                <p className="fr-text--sm fr-pt-1w fr-px-1w">Aucun résultat.</p>
              )}
            </div>
            <div className="fr-px-1w fr-py-1w" style={{ borderTop: '1px solid var(--border-default-grey)', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              {multiple && (
                <button type="button" className="fr-btn fr-btn--secondary" onClick={clearAll} disabled={!valueArray.length}>
                  Tout effacer
                </button>
              )}
              <button type="button" className="fr-btn" onClick={() => setOpen(false)}>Enregistrer</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComboBox;
