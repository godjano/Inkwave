'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useStore } from '@/lib/store';
import type { WorldEntry } from '@/lib/types';

interface UseCodexHoverReturn {
  hoveredEntry: WorldEntry | null;
  position: { x: number; y: number };
  visible: boolean;
}

/**
 * Extracts the word under the cursor from a given position.
 * Uses caretRangeFromPoint to find the text node at (x, y),
 * then expands to find the full word boundary.
 */
function getWordAtPoint(x: number, y: number): string {
  try {
    const range = document.caretRangeFromPoint(x, y);
    if (!range) return '';

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return '';

    const text = node.textContent || '';
    const offset = range.startOffset;

    // Expand backwards to find word start
    let start = offset;
    while (start > 0 && !/[\s\p{P}]/u.test(text[start - 1])) {
      start--;
    }

    // Expand forwards to find word end
    let end = offset;
    while (end < text.length && !/[\s\p{P}]/u.test(text[end])) {
      end++;
    }

    const word = text.slice(start, end).trim();
    return word;
  } catch {
    return '';
  }
}

export function useCodexHover(): UseCodexHoverReturn {
  const [hoveredEntry, setHoveredEntry] = useState<WorldEntry | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  const getActiveProject = useStore((s) => s.getActiveProject);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMatchRef = useRef<string>('');

  // Build a lookup map: lowercase name -> WorldEntry
  const nameMap = useMemo(() => {
    const project = getActiveProject();
    if (!project) return new Map<string, WorldEntry>();

    const map = new Map<string, WorldEntry>();
    for (const entry of project.worldBible) {
      const key = entry.name.toLowerCase().trim();
      if (key.length > 0) {
        map.set(key, entry);
        // Also store multi-word names for partial matching
        // e.g., "The Iron Throne" -> also check "Iron Throne"
      }
    }
    return map;
  }, [getActiveProject]);

  // Also build a set of multi-word names for extended matching
  const multiWordNames = useMemo(() => {
    const project = getActiveProject();
    if (!project) return [];

    return project.worldBible
      .filter(e => e.name.includes(' '))
      .map(e => ({
        name: e.name,
        lower: e.name.toLowerCase().trim(),
        entry: e,
      }));
  }, [getActiveProject]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      // Check if the mouse is over the editor
      const editor = document.querySelector('.editor-content');
      if (!editor) return;

      const editorRect = editor.getBoundingClientRect();
      if (
        e.clientX < editorRect.left ||
        e.clientX > editorRect.right ||
        e.clientY < editorRect.top ||
        e.clientY > editorRect.bottom
      ) {
        // Mouse left the editor area - hide card
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        if (visible) {
          setVisible(false);
          setHoveredEntry(null);
          lastMatchRef.current = '';
        }
        return;
      }

      const word = getWordAtPoint(e.clientX, e.clientY);
      const wordLower = word.toLowerCase();

      // Check for multi-word name match first (scan surrounding text)
      let matchedEntry: WorldEntry | null = null;

      if (word && wordLower !== lastMatchRef.current) {
        // Simple single-word match
        matchedEntry = nameMap.get(wordLower) || null;

        // If no single-word match, try multi-word matching
        if (!matchedEntry && multiWordNames.length > 0) {
          try {
            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
            if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
              const text = range.startContainer.textContent || '';
              const offset = range.startOffset;

              for (const { name, lower, entry } of multiWordNames) {
                // Check if the multi-word name appears around this offset
                const idx = text.toLowerCase().indexOf(lower, Math.max(0, offset - lower.length));
                if (idx !== -1 && offset >= idx && offset <= idx + lower.length) {
                  matchedEntry = entry;
                  break;
                }
              }
            }
          } catch {
            // ignore
          }
        }
      }

      if (matchedEntry && matchedEntry.name.toLowerCase() === lastMatchRef.current && visible) {
        // Same match, just update position
        const yOffset = 12;
        setPosition({
          x: e.clientX,
          y: e.clientY + yOffset,
        });
        return;
      }

      if (matchedEntry && matchedEntry.name.toLowerCase() !== lastMatchRef.current) {
        // New match - debounce showing the card
        lastMatchRef.current = matchedEntry.name.toLowerCase();
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
          setHoveredEntry(matchedEntry);
          setPosition({
            x: e.clientX,
            y: e.clientY + 12,
          });
          setVisible(true);
        }, 400);
      } else if (!matchedEntry && lastMatchRef.current) {
        // No match anymore - hide card
        lastMatchRef.current = '';
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        setVisible(false);
        setHoveredEntry(null);
      }
    },
    [nameMap, multiWordNames, visible],
  );

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [handleMouseMove]);

  return { hoveredEntry, position, visible };
}
