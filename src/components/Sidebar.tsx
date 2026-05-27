'use client';

import React, { useCallback } from 'react';
import { useStore } from '@/lib/store';
import type { EditorMode } from '@/lib/types';
import {
  IconWrite,
  IconGrid,
  IconOutline,
  IconTimeline,
  IconRead,
  IconStats,
  IconGenerators,
  IconWorldMap,
  IconFamilyTree,
  IconScenes,
  IconBack,
  IconCollapse,
  IconExpand,
} from './icons';

interface NavItem {
  mode: EditorMode;
  icon: React.ReactNode;
  label: string;
}

const navItems: NavItem[] = [
  { mode: 'write', icon: <IconWrite size={18} />, label: 'Write' },
  { mode: 'grid', icon: <IconGrid size={18} />, label: 'Grid' },
  { mode: 'outline', icon: <IconOutline size={18} />, label: 'Outline' },
  { mode: 'timeline', icon: <IconTimeline size={18} />, label: 'Timeline' },
  { mode: 'read', icon: <IconRead size={18} />, label: 'Read' },
  { mode: 'stats', icon: <IconStats size={18} />, label: 'Stats' },
  { mode: 'generators', icon: <IconGenerators size={18} />, label: 'Generators' },
  { mode: 'world-map', icon: <IconWorldMap size={18} />, label: 'World Map' },
  { mode: 'family-tree', icon: <IconFamilyTree size={18} />, label: 'Family Tree' },
  { mode: 'scenes', icon: <IconScenes size={18} />, label: 'Scenes & Beats' },
  { mode: 'characters', icon: <IconWorldBible size={18} />, label: 'Characters' },
];

export default function Sidebar() {
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const editorMode = useStore((s) => s.editorMode);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const projects = useStore((s) => s.projects);

  const setEditorMode = useStore((s) => s.setEditorMode);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const setActiveProject = useStore((s) => s.setActiveProject);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const handleBack = useCallback(() => {
    setActiveProject(null);
  }, [setActiveProject]);

  return (
    <aside
      className="flex flex-col h-full shrink-0 animate-fade-in select-none"
      style={{
        width: sidebarCollapsed ? 56 : 180,
        background:
          'radial-gradient(ellipse at 50% 20%, rgba(160,128,56,0.06) 0%, transparent 60%), linear-gradient(180deg, var(--bg-secondary), var(--bg-primary) 60%, var(--bg-secondary))',
        borderRight: '1px solid rgba(212,173,74,0.18)',
        transition: 'width 0.2s ease',
        position: 'relative',
        fontFamily: "'Georgia', 'Palatino Linotype', 'Book Antiqua', serif",
      }}
    >
      {/* ── Subtle ruled lines overlay ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 32px, rgba(212,173,74,0.015) 32px, rgba(212,173,74,0.015) 33px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* ── Top: project name + back ── */}
      <div
        className="flex items-center gap-2 px-3 py-3"
        style={{
          borderBottom: '1px solid rgba(212,173,74,0.12)',
          minHeight: 48,
          position: 'relative',
          zIndex: 1,
          background: 'linear-gradient(180deg, rgba(160,128,56,0.04), transparent)',
        }}
      >
        <button
          onClick={handleBack}
          className="flex items-center justify-center shrink-0 rounded-md transition-colors"
          style={{
            width: 32,
            height: 32,
            background: 'linear-gradient(135deg, rgba(160,128,56,0.12), rgba(160,128,56,0.05))',
            border: '1px solid rgba(212,173,74,0.2)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 16,
          }}
          aria-label="Back to projects"
          title="Back to projects"
        >
          <IconBack size={16} />
        </button>

        {!sidebarCollapsed && (
          <span
            className="truncate text-sm font-semibold"
            style={{
              color: 'var(--accent-gold)',
              maxWidth: 120,
              letterSpacing: '0.3px',
              textShadow: '0 0 12px rgba(212,173,74,0.15)',
            }}
            title={activeProject?.name}
          >
            {activeProject?.name || 'Project'}
          </span>
        )}
      </div>

      {/* ── Navigation items ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1" style={{ position: 'relative', zIndex: 1 }}>
        {navItems.map((item) => {
          const isActive = editorMode === item.mode;
          return (
            <button
              key={item.mode}
              onClick={() => setEditorMode(item.mode)}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              style={{
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                padding: sidebarCollapsed ? '8px 0' : undefined,
                width: '100%',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: "'Georgia', 'Palatino Linotype', 'Book Antiqua', serif",
                letterSpacing: '0.3px',
              }}
              title={sidebarCollapsed ? item.label : undefined}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                className="shrink-0 flex items-center justify-center"
                style={{ width: 18, height: 18 }}
                aria-hidden="true"
              >
                {item.icon}
              </span>
              {!sidebarCollapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Ornamental divider between nav and collapse ── */}
      {!sidebarCollapsed && (
        <div
          className="manuscript-divider mx-4"
          style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(212,173,74,0.2), transparent)',
          }}
        />
      )}

            {/* ── Keyboard shortcuts hint ── */}
      {!sidebarCollapsed && (
        <div
          className="px-3 py-2 text-center"
          style={{ position: 'relative', zIndex: 1, opacity: 0.5 }}
          title="Keyboard shortcuts: Ctrl+Shift+F = Focus mode, Ctrl+Shift+H = Back to shelf, Escape = Exit focus"
        >
          <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 9, letterSpacing: '0.5px' }}>
            <span className="kbd-hint">Ctrl+Shift+F</span> Focus
          </span>
        </div>
      )}

      {/* ── Collapse toggle ── */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center mx-2 mb-2 rounded-md transition-colors"
        style={{
          height: 32,
          background: 'linear-gradient(180deg, rgba(160,128,56,0.1), rgba(160,128,56,0.04))',
          border: '1px solid rgba(212,173,74,0.18)',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: 14,
          position: 'relative',
          zIndex: 1,
          fontFamily: "'Georgia', serif",
        }}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <IconExpand size={14} /> : <IconCollapse size={14} />}
      </button>
    </aside>
  );
}
