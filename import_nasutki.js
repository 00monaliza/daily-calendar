const NASUTKICALENDAR_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoiOGNkYzUzZjItMzVjOS00M2NkLWE1NzktODhiZTEyYzE3MzZkIiwidXNlcm5hbWUiOiJoZWxsb0Bwb2dvc3RpbS5reiIsImV4cCI6MTc3NTM3NzU3NCwiZW1haWwiOiJoZWxsb0Bwb2dvc3RpbS5reiJ9.zQkx_O1RIirkmJ_xiGbgDoi25h371v9s6MnBLskn60k'
const SUPABASE_URL = 'https://mxszkkqebaroflrcweno.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14c3pra3FlYmFyb2ZscmN3ZW5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg5MTUzNSwiZXhwIjoyMDkwNDY3NTM1fQ.IMzwZ0HQ3_Nnd2xnrlENGly9AK67CR4tUEoqYXKNZro' // из Supabase Dashboard → Settings → API → service_role
const OWNER_ID = '5dd9e818-ecab-42d6-9da3-ab83501d2a2b' // твой user id из предыдущих логов


const NASUTKICALENDAR_API = 'https://api.nasutkicalendar.ru:21802'

// Palette starts at orange — teal (#376E6F) is the DB default so storing it
// for a new property would make getPropertyColor treat it as "no custom color".
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

async function fetchMonthBookings(month, year) {
  const url = `${NASUTKICALENDAR_API}/rents/rents/?month=${month}&year=${year}&expand=1`
  const res = await fetch(url, {
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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?owner_id=eq.${OWNER_ID}&select=id,name`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    }
  })
  return await res.json()
}

// Создаёт квартиру в Supabase и возвращает её id
async function createProperty(name, color) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
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

async function insertBookings(bookings) {
  const batchSize = 50
  let inserted = 0
  let skipped = 0

  for (let i = 0; i < bookings.length; i += batchSize) {
    const batch = bookings.slice(i, i + batchSize)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify(batch)
    })
    if (res.ok || res.status === 201) {
      inserted += batch.length
    } else {
      const err = await res.text()
      console.error(`  ❌ Ошибка вставки батча: ${err}`)
      skipped += batch.length
    }
  }
  return { inserted, skipped }
}

async function main() {
  console.log('Импорт из nasutkicalendar...\n')

  // 1. Загружаем существующие квартиры
  console.log('Загружаем квартиры из Supabase...')
  let properties = await fetchMyProperties()
  console.log(`   Найдено квартир: ${properties.length}`)

  // 2. Собираем все бронирования
  const startYear = 2023
  const endYear = 2026
  const endMonth = new Date().getMonth() + 2

  const allRaw = []
  const seen = new Set()

  for (let year = startYear; year <= endYear; year++) {
    const maxMonth = year === endYear ? endMonth : 12
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
      await new Promise(resolve => setTimeout(resolve, 300))
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
  const { inserted, skipped } = await insertBookings(bookings)

  console.log(`\n✅ Готово!`)
  console.log(`   Вставлено:      ${inserted}`)
  console.log(`   Дубликаты/пропущено: ${skipped}`)
  console.log(`   Не сопоставлено: ${unmatchedCount}`)
}

main().catch(console.error)