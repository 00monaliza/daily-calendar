import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const META_PREFIX = '[fin-cat:'
const META_SUFFIX = ']'

const LABEL_ORDER = [
  'Аренда у собственника',
  'Коммунальные услуги',
  'Клининг',
  'Расходники',
  'Комиссия платформы',
  'Ремонт / обслуживание',
  'Прочее',
]

const DB_TO_LABEL = {
  cleaning: 'Клининг',
  repair: 'Ремонт / обслуживание',
  furniture: 'Расходники',
  utilities: 'Коммунальные услуги',
  other: 'Прочее',
}

const KEYWORD_RULES = [
  {
    label: 'Аренда у собственника',
    confidence: 'high',
    patterns: [
      /аренд/i,
      /собственник/i,
      /хозя/i,
      /owner/i,
      /rent/i,
    ],
  },
  {
    label: 'Комиссия платформы',
    confidence: 'high',
    patterns: [
      /комис/i,
      /booking/i,
      /airbnb/i,
      /avito/i,
      /kaspi/i,
      /платформ/i,
      /service\s*fee/i,
    ],
  },
  {
    label: 'Коммунальные услуги',
    confidence: 'medium',
    patterns: [
      /коммун/i,
      /электр/i,
      /свет/i,
      /газ/i,
      /интернет/i,
      /кск/i,
      /отопл/i,
      /utility/i,
      /bill/i,
    ],
  },
  {
    label: 'Клининг',
    confidence: 'medium',
    patterns: [
      /клини/i,
      /уборк/i,
      /горнич/i,
      /прачк/i,
      /clean/i,
      /laundry/i,
    ],
  },
  {
    label: 'Ремонт / обслуживание',
    confidence: 'medium',
    patterns: [
      /ремонт/i,
      /обслуж/i,
      /сантех/i,
      /электрик/i,
      /мастер/i,
      /почин/i,
      /fix/i,
      /service/i,
    ],
  },
  {
    label: 'Расходники',
    confidence: 'medium',
    patterns: [
      /расходник/i,
      /хозтов/i,
      /бытов/i,
      /моющ/i,
      /туалет/i,
      /бумаг/i,
      /soap/i,
      /shampoo/i,
      /suppl/i,
    ],
  },
]

function hasArg(name) {
  return process.argv.includes(name)
}

function loadEnvFromWorkspaceFiles() {
  const envFiles = ['.env.local', '.env']

  for (const fileName of envFiles) {
    const filePath = path.resolve(process.cwd(), fileName)
    if (!fs.existsSync(filePath)) continue

    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split(/\r?\n/)

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const separator = trimmed.indexOf('=')
      if (separator <= 0) continue

      const key = trimmed.slice(0, separator).trim()
      const rawValue = trimmed.slice(separator + 1).trim()
      if (!key || process.env[key] !== undefined) continue

      const unquoted =
        (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'"))
          ? rawValue.slice(1, -1)
          : rawValue

      process.env[key] = unquoted
    }
  }
}

function getArgValue(name) {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

function normalizeText(value) {
  return (value ?? '').trim()
}

function readCategoryMeta(description) {
  const text = normalizeText(description)
  if (!text.startsWith(META_PREFIX)) return null

  const endIndex = text.indexOf(META_SUFFIX, META_PREFIX.length)
  if (endIndex === -1) return null

  const label = text.slice(META_PREFIX.length, endIndex).trim()
  return LABEL_ORDER.includes(label) ? label : null
}

function stripCategoryMeta(description) {
  const text = normalizeText(description)
  if (!text.startsWith(META_PREFIX)) return text

  const endIndex = text.indexOf(META_SUFFIX, META_PREFIX.length)
  if (endIndex === -1) return text

  return text.slice(endIndex + 1).trim()
}

function buildDescriptionWithMeta(label, description) {
  const clean = stripCategoryMeta(description)
  if (!clean) return `${META_PREFIX}${label}${META_SUFFIX}`
  return `${META_PREFIX}${label}${META_SUFFIX} ${clean}`
}

function inferLabel(expense) {
  const existingMeta = readCategoryMeta(expense.description)
  if (existingMeta) {
    return { label: existingMeta, confidence: 'already', reason: 'already-tagged' }
  }

  if (expense.category && expense.category !== 'other' && DB_TO_LABEL[expense.category]) {
    return {
      label: DB_TO_LABEL[expense.category],
      confidence: 'high',
      reason: `from-category:${expense.category}`,
    }
  }

  const text = stripCategoryMeta(expense.description).toLowerCase()
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some(pattern => pattern.test(text))) {
      return {
        label: rule.label,
        confidence: rule.confidence,
        reason: `keyword:${rule.label}`,
      }
    }
  }

  return { label: 'Прочее', confidence: 'low', reason: 'fallback-other' }
}

async function fetchAllExpenses(supabase, ownerId, limit) {
  const rows = []
  const pageSize = 1000
  let from = 0

  while (true) {
    let query = supabase
      .from('expenses')
      .select('id, owner_id, category, description, amount, date, created_at')
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)

    if (ownerId) {
      query = query.eq('owner_id', ownerId)
    }

    const { data, error } = await query
    if (error) throw error

    const chunk = data ?? []
    rows.push(...chunk)

    if (chunk.length < pageSize) break
    if (limit > 0 && rows.length >= limit) break

    from += pageSize
  }

  if (limit > 0) return rows.slice(0, limit)
  return rows
}

function printSummary(summary) {
  console.log('\n=== Backfill Summary ===')
  console.log(`Total scanned: ${summary.total}`)
  console.log(`Already tagged: ${summary.alreadyTagged}`)
  console.log(`Need tagging: ${summary.toUpdate}`)
  console.log('')

  console.log('By label:')
  for (const label of LABEL_ORDER) {
    const count = summary.byLabel[label] ?? 0
    console.log(`  ${label}: ${count}`)
  }

  console.log('')
  console.log('By confidence:')
  for (const key of ['high', 'medium', 'low']) {
    const count = summary.byConfidence[key] ?? 0
    console.log(`  ${key}: ${count}`)
  }

  if (summary.samples.length > 0) {
    console.log('')
    console.log('Sample updates:')
    for (const sample of summary.samples) {
      console.log(`  ${sample.id} | ${sample.label} | ${sample.reason}`)
      if (sample.before) console.log(`    before: ${sample.before}`)
      console.log(`    after : ${sample.after}`)
    }
  }

  console.log('========================\n')
}

async function applyUpdates(supabase, updates) {
  const batchSize = 100
  let updated = 0

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize)
    await Promise.all(
      batch.map(async (item) => {
        const { error } = await supabase
          .from('expenses')
          .update({ description: item.description })
          .eq('id', item.id)

        if (error) {
          throw new Error(`Failed update ${item.id}: ${error.message}`)
        }
      }),
    )

    updated += batch.length
    console.log(`Updated ${updated}/${updates.length}`)
  }
}

async function main() {
  loadEnvFromWorkspaceFiles()

  const apply = hasArg('--apply')
  const ownerId = getArgValue('--owner')
  const limitRaw = getArgValue('--limit')
  const limit = limitRaw ? Number(limitRaw) : 0

  if (Number.isNaN(limit) || limit < 0) {
    throw new Error('--limit must be a positive integer')
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/VITE_SUPABASE_ANON_KEY',
    )
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('Loading expenses...')
  const expenses = await fetchAllExpenses(supabase, ownerId, limit)

  const updates = []
  const summary = {
    total: expenses.length,
    alreadyTagged: 0,
    toUpdate: 0,
    byLabel: {},
    byConfidence: {},
    samples: [],
  }

  for (const expense of expenses) {
    const existingMeta = readCategoryMeta(expense.description)
    if (existingMeta) {
      summary.alreadyTagged += 1
      continue
    }

    const inference = inferLabel(expense)
    const newDescription = buildDescriptionWithMeta(inference.label, expense.description)

    updates.push({
      id: expense.id,
      description: newDescription,
      label: inference.label,
      reason: inference.reason,
      confidence: inference.confidence,
      before: normalizeText(expense.description),
      after: newDescription,
    })

    summary.toUpdate += 1
    summary.byLabel[inference.label] = (summary.byLabel[inference.label] ?? 0) + 1
    if (inference.confidence !== 'already') {
      summary.byConfidence[inference.confidence] = (summary.byConfidence[inference.confidence] ?? 0) + 1
    }

    if (summary.samples.length < 12) {
      summary.samples.push({
        id: expense.id,
        label: inference.label,
        reason: inference.reason,
        before: normalizeText(expense.description),
        after: newDescription,
      })
    }
  }

  printSummary(summary)

  if (!apply) {
    console.log('Dry-run complete. To apply changes run with --apply')
    return
  }

  if (updates.length === 0) {
    console.log('Nothing to update.')
    return
  }

  console.log('Applying updates...')
  await applyUpdates(supabase, updates)
  console.log('Backfill completed successfully.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
