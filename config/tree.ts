/**
 * Tree UI configuration — tweak these values to adjust the appearance.
 */
export const TREE_CONFIG = {
  /** Horizontal indent per depth level (px) */
  indentPx: 24,

  /** Row height Tailwind class */
  rowHeight: 'h-11',

  /** Font size for item names and context menu items */
  fontSize: 'text-sm',

  /** Font size for the collapsed-children badge */
  badgeFontSize: 'text-xs',

  /** Checkbox size */
  checkboxSize: 'w-4 h-4',

  /** Expand caret button size */
  caretButtonSize: 'w-6 h-6',

  /** Caret SVG dimensions */
  caretSvgSize: 10,

  /** Icon size in context menu */
  iconSize: 'w-4 h-4',

  /** Left indent for the first root column (px) */
  rootLeadingIndent: 12,

  /** Left indent for non-root first column (px) */
  childLeadingIndent: 8,

  /** Checkbox column width Tailwind class */
  checkboxColWidth: 'w-9',
} as const;
