import type { ExpenseCategory } from '@/entities/expenses/types'

const EXPENSE_META_PREFIX = '[fin-cat:'
const EXPENSE_META_SUFFIX = ']'

export const EXPENSE_CATEGORY_OPTIONS = [
  { label: 'Аренда у собственника', dbValue: 'other' },
  { label: 'Коммунальные услуги', dbValue: 'utilities' },
  { label: 'Клининг', dbValue: 'cleaning' },
  { label: 'Расходники', dbValue: 'furniture' },
  { label: 'Комиссия платформы', dbValue: 'other' },
  { label: 'Ремонт / обслуживание', dbValue: 'repair' },
  { label: 'Прочее', dbValue: 'other' },
] as const

export const EXPENSE_CATEGORY_LABEL_ORDER = EXPENSE_CATEGORY_OPTIONS.map(option => option.label)

const UI_LABEL_SET = new Set<string>(EXPENSE_CATEGORY_LABEL_ORDER)

const DB_CATEGORY_TO_LABEL: Record<ExpenseCategory, string> = {
  cleaning: 'Клининг',
  repair: 'Ремонт / обслуживание',
  furniture: 'Расходники',
  utilities: 'Коммунальные услуги',
  other: 'Прочее',
}

export const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  'Аренда у собственника': '#7A9E9F',
  'Коммунальные услуги': '#2D9D8F',
  Клининг: '#5B8DEF',
  Расходники: '#F4A261',
  'Комиссия платформы': '#E76F51',
  'Ремонт / обслуживание': '#9C6ADE',
  Прочее: '#9CA3AF',
}

export function getExpenseCategoryColor(category: string): string {
  return EXPENSE_CATEGORY_COLORS[category] ?? '#94A3B8'
}

export function getExpenseCategoryDbValue(categoryLabel: string): ExpenseCategory {
  return (
    EXPENSE_CATEGORY_OPTIONS.find(option => option.label === categoryLabel)?.dbValue ??
    'other'
  )
}

function readCategoryMeta(description: string | null | undefined): string | null {
  const text = description?.trim()
  if (!text?.startsWith(EXPENSE_META_PREFIX)) return null

  const endIndex = text.indexOf(EXPENSE_META_SUFFIX, EXPENSE_META_PREFIX.length)
  if (endIndex === -1) return null

  const rawLabel = text.slice(EXPENSE_META_PREFIX.length, endIndex).trim()
  return rawLabel || null
}

export function buildExpenseDescriptionWithMeta(
  categoryLabel: string,
  userDescription: string | null | undefined,
): string {
  const cleanDescription = stripExpenseCategoryMeta(userDescription)
  const safeLabel = UI_LABEL_SET.has(categoryLabel) ? categoryLabel : 'Прочее'

  if (!cleanDescription) {
    return `${EXPENSE_META_PREFIX}${safeLabel}${EXPENSE_META_SUFFIX}`
  }

  return `${EXPENSE_META_PREFIX}${safeLabel}${EXPENSE_META_SUFFIX} ${cleanDescription}`
}

export function stripExpenseCategoryMeta(description: string | null | undefined): string {
  const text = description?.trim() ?? ''
  if (!text.startsWith(EXPENSE_META_PREFIX)) return text

  const endIndex = text.indexOf(EXPENSE_META_SUFFIX, EXPENSE_META_PREFIX.length)
  if (endIndex === -1) return text

  return text.slice(endIndex + 1).trim()
}

export function getExpenseCategoryLabel(categoryValue: string | null | undefined): string {
  const normalized = categoryValue?.trim()
  if (!normalized) return 'Прочее'

  if (normalized in DB_CATEGORY_TO_LABEL) {
    return DB_CATEGORY_TO_LABEL[normalized as ExpenseCategory]
  }

  return normalized
}

export function getExpenseCategoryLabelFromExpense(
  categoryValue: string | null | undefined,
  description: string | null | undefined,
): string {
  const fromMeta = readCategoryMeta(description)
  if (fromMeta && UI_LABEL_SET.has(fromMeta)) return fromMeta
  return getExpenseCategoryLabel(categoryValue)
}
