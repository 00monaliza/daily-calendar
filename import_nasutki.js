const NASUTKICALENDAR_TOKEN = process.env.NASUTKI_TOKEN || 'REPLACE_ME'
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mxszkkqebaroflrcweno.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'REPLACE_ME' // Supabase Dashboard -> Settings -> API -> service_role
const OWNER_ID = process.env.OWNER_ID || 'REPLACE_ME' // id пользователя из auth.users

const START_YEAR = Number(process.env.START_YEAR || 2023)
const END_YEAR = Number(process.env.END_YEAR || new Date().getFullYear())
const END_MONTH = Number(process.env.END_MONTH || Math.min(12, new Date().getMonth() + 2))
const FULL_REPLACE = process.env.FULL_REPLACE === '1'


const NASUTKICALENDAR_API = 'https://api.nasutkicalendar.ru:21802'

const PROPERTY_COLORS = [
  '#E67E22', '#8E44AD', '#2980B9', '#27AE60', '#E74C3C',
  '#16A085', '#D35400', '#2C3E50', '#F39C12', '#376E6F',
]

function parseDate(dateStr) {
  if (!dateStr) return null
  // Если уже в формате YYYY-MM-DD — оставляем
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10)
  // Конвертируем DD.MM.YYYY → YYYY-MM-DD
  if (/^\d{2}\.\d{2}\.\d{4}/.test(dateStr)) {
    const [d, m, y] = dateStr.split('.')
    return `${y}-${m}-${d}`
  }
  return dateStr
}
function mapSource(sourceConnection) {
  if (!sourceConnection) return 'direct'
  const s = String(sourceConnection).toLowerCase()
  if (s.includes('kaspi')) return 'kaspi'
  if (s.includes('booking')) return 'booking'
  if (s.includes('airbnb')) return 'airbnb'
  if (s.includes('avito')) return 'avito'
  return 'other'
}

function mapPaymentStatus(paid, totalCost) {
  if (!paid || paid === 0) return 'waiting'
  if (paid >= totalCost) return 'paid'
  return 'partial'
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function validateConfig() {
  const missing = []
  if (NASUTKICALENDAR_TOKEN === 'REPLACE_ME') missing.push('NASUTKI_TOKEN')
  if (SUPABASE_SERVICE_KEY === 'REPLACE_ME') missing.push('SUPABASE_SERVICE_KEY')
  if (OWNER_ID === 'REPLACE_ME') missing.push('OWNER_ID')

  if (missing.length > 0) {
    throw new Error(`Не заданы обязательные переменные окружения: ${missing.join(', ')}`)
  }
}

async function fetchWithRetry(url, options, retries = 3) {
  let lastError = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options)
      if (res.ok) return res

      // Для 5xx пробуем повторно
      if (res.status >= 500 && attempt < retries) {
        await sleep(300 * attempt)
        continue
      }

      return res
    } catch (err) {
      lastError = err
      if (attempt < retries) {
        await sleep(300 * attempt)
        continue
      }
    }
  }

  throw lastError || new Error('Сетевая ошибка')
}

async function fetchMonthBookings(month, year) {
  const url = `${NASUTKICALENDAR_API}/rents/rents/?month=${month}&year=${year}&expand=1`
  const res = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${NASUTKICALENDAR_TOKEN}` }
  })
  if (!res.ok) {
    console.warn(`  ⚠️  ${year}-${String(month).padStart(2, '0')}: статус ${res.status}`)
    return []
  }
  const data = await res.json()
  return data.results || []
}

async function fetchMyProperties() {
  const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/properties?owner_id=eq.${OWNER_ID}&select=id,name`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    }
  })
  return await res.json()
}

// Создаёт квартиру в Supabase и возвращает её id
async function createProperty(name, color) {
  const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/properties`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      owner_id: OWNER_ID,
      name: name,
      base_price: 0,
      color: color,
    })
  })
  const data = await res.json()
  if (!res.ok) {
    console.error(`  ❌ Не удалось создать квартиру "${name}": ${JSON.stringify(data)}`)
    return null
  }
  return data[0]?.id || null
}

async function deleteOwnerBookings() {
  const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/bookings?owner_id=eq.${OWNER_ID}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: 'count=exact',
    }
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Не удалось очистить bookings: ${err}`)
  }

  const contentRange = res.headers.get('content-range') || '0-0/0'
  const totalDeleted = Number(contentRange.split('/')[1] || 0)
  return Number.isNaN(totalDeleted) ? 0 : totalDeleted
}

async function fetchOwnerBookingCount() {
  const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/bookings?owner_id=eq.${OWNER_ID}&select=id`, {
    method: 'HEAD',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: 'count=exact',
    }
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Не удалось получить count bookings: ${err}`)
  }

  const contentRange = res.headers.get('content-range') || '0-0/0'
  const total = Number(contentRange.split('/')[1] || 0)
  return Number.isNaN(total) ? 0 : total
}

async function insertBookings(bookings) {
  const batchSize = 50
  let attempted = 0
  let skipped = 0

  for (let i = 0; i < bookings.length; i += batchSize) {
    const batch = bookings.slice(i, i + batchSize)
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/bookings`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(batch)
    })
    if (res.ok || res.status === 201) {
      attempted += batch.length
    } else {
      const err = await res.text()
      console.error(`  ❌ Ошибка вставки батча: ${err}`)
      skipped += batch.length
    }
  }
  return { attempted, skipped }
}

async function main() {
  validateConfig()

  console.log('Импорт из nasutkicalendar...\n')
  console.log(`Период: ${START_YEAR}-01 .. ${END_YEAR}-${String(END_MONTH).padStart(2, '0')}`)
  console.log(`Режим: ${FULL_REPLACE ? 'FULL_REPLACE (полная замена)' : 'append (добавление)'}`)

  if (FULL_REPLACE) {
    console.log('\nОчищаем старые бронирования владельца...')
    const deleted = await deleteOwnerBookings()
    console.log(`   Удалено записей: ${deleted}`)
  }

  // 1. Загружаем существующие квартиры
  console.log('Загружаем квартиры из Supabase...')
  let properties = await fetchMyProperties()
  console.log(`   Найдено квартир: ${properties.length}`)

  // 2. Собираем все бронирования
  const allRaw = []
  const seen = new Set()

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    const maxMonth = year === END_YEAR ? END_MONTH : 12
    for (let month = 1; month <= maxMonth; month++) {
      process.stdout.write(`  Загружаем ${year}-${String(month).padStart(2, '0')}... `)
      const rents = await fetchMonthBookings(month, year)
      let newCount = 0
      for (const r of rents) {
        if (!seen.has(r.id)) {
          seen.add(r.id)
          allRaw.push(r)
          newCount++
        }
      }
      console.log(`${rents.length} записей (новых: ${newCount})`)
      await sleep(300)
    }
  }

  console.log(`\nВсего уникальных бронирований: ${allRaw.length}`)

  // 3. Собираем все уникальные названия квартир из nasutkicalendar
  const flatNamesFromNasutki = new Map() // flatShortName → flat объект
  for (const r of allRaw) {
    const name = r._flat?.short_name
    if (name && !flatNamesFromNasutki.has(name)) {
      flatNamesFromNasutki.set(name, r._flat)
    }
  }

  console.log(`\nУникальных квартир в nasutkicalendar: ${flatNamesFromNasutki.size}`)

  // 4. Для каждой квартиры из nasutkicalendar — найти или создать в Supabase
  // Строим map: flatShortName → property_id
  const flatToPropertyId = new Map()

  let colorIndex = 0

  for (const [flatName] of flatNamesFromNasutki) {
    // Ищем существующую
    const existing = properties.find(p =>
      p.name.toLowerCase() === flatName.toLowerCase() ||
      p.name.toLowerCase().includes(flatName.toLowerCase()) ||
      flatName.toLowerCase().includes(p.name.toLowerCase())
    )

    if (existing) {
      flatToPropertyId.set(flatName, existing.id)
      console.log(`  ✅ Найдена: "${flatName}" → "${existing.name}"`)
    } else {
      // Создаём новую квартиру
      console.log(`  ➕ Создаём новую квартиру: "${flatName}"`)
      const newId = await createProperty(flatName, PROPERTY_COLORS[colorIndex % PROPERTY_COLORS.length])
      colorIndex++
      if (newId) {
        flatToPropertyId.set(flatName, newId)
        // Обновляем локальный список
        properties.push({ id: newId, name: flatName })
        console.log(`     → Создано с id: ${newId}`)
      }
    }
  }

  // 5. Трансформируем бронирования
  const bookings = []
  let unmatchedCount = 0

  for (const r of allRaw) {
    const flatName = r._flat?.short_name || ''
    const propertyId = flatToPropertyId.get(flatName)

    if (!propertyId) {
      unmatchedCount++
      continue
    }

    bookings.push({
      owner_id: OWNER_ID,
      property_id: propertyId,
      guest_name: r.tenant_name || 'Неизвестный гость',
      guest_phone: r.tenant_phone ? String(r.tenant_phone) : null,
      check_in: parseDate(r.start),   
      check_out: parseDate(r.end), 
      total_price: r.total_cost || 0,
      prepayment: r.paid || 0,
      payment_status: mapPaymentStatus(r.paid, r.total_cost),
      source: mapSource(r.source_connection),
      comment: r.comment || null,
    })
  }

  console.log(`\nГотово к вставке: ${bookings.length} бронирований`)
  if (unmatchedCount > 0) console.log(`Не сопоставлено: ${unmatchedCount}`)

  // 6. Вставляем
  console.log('Вставляем в Supabase...')
  const { attempted, skipped } = await insertBookings(bookings)
  const totalInDb = await fetchOwnerBookingCount()

  console.log(`\n✅ Готово!`)
  console.log(`   Отправлено в insert: ${attempted}`)
  console.log(`   Ошибки вставки:      ${skipped}`)
  console.log(`   Не сопоставлено: ${unmatchedCount}`)
  console.log(`   Итого в БД у owner: ${totalInDb}`)

  if (FULL_REPLACE && totalInDb !== bookings.length - skipped) {
    console.warn('   ⚠️  Внимание: итоговый count в БД не равен ожидаемому количеству после полной замены.')
  }
}

main().catch(console.error)