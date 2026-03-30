import { useState } from 'react'
import { useUser } from '@/features/auth/useUser'
import { useProperties, useCreateProperty, useUpdateProperty, useDeleteProperty } from '@/entities/property/queries'
import type { Property, PropertyInsert } from '@/entities/property/types'

const COLORS = ['#376E6F', '#DA7B93', '#2F4454', '#F4A261', '#8B5CF6', '#0EA5E9', '#10B981', '#EF4444']

function PropertyModal({
  property,
  onClose,
}: {
  property: Property | null
  onClose: () => void
}) {
  const createProperty = useCreateProperty()
  const updateProperty = useUpdateProperty()

  const [name, setName] = useState(property?.name ?? '')
  const [address, setAddress] = useState(property?.address ?? '')
  const [rooms, setRooms] = useState(property?.rooms ?? 1)
  const [basePrice, setBasePrice] = useState(property?.base_price ?? 0)
  const [description, setDescription] = useState(property?.description ?? '')
  const [color, setColor] = useState(property?.color ?? '#376E6F')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data: PropertyInsert = {
      name,
      address: address || null,
      rooms,
      base_price: basePrice,
      description: description || null,
      color,
      is_active: property?.is_active ?? true,
    }
    if (property) {
      await updateProperty.mutateAsync({ id: property.id, data })
    } else {
      await createProperty.mutateAsync(data)
    }
    onClose()
  }

  const isLoading = createProperty.isPending || updateProperty.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {property ? 'Редактировать квартиру' : 'Добавить квартиру'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
              placeholder="Квартира на Абая 10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Адрес</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
              placeholder="г. Алматы, ул. Абая 10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Комнат</label>
              <input
                type="number"
                min={1}
                value={rooms}
                onChange={e => setRooms(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Цена/ночь (₸)</label>
              <input
                type="number"
                min={0}
                value={basePrice}
                onChange={e => setBasePrice(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Цвет</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? '#1C3334' : 'transparent',
                    transform: color === c ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F] resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#376E6F] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#1C3334] transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function PropertiesPage() {
  const { user } = useUser()
  const { data: properties = [], isLoading } = useProperties(user?.id)
  const deleteProperty = useDeleteProperty()
  const updateProperty = useUpdateProperty()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)

  function openCreate() {
    setEditingProperty(null)
    setModalOpen(true)
  }

  function openEdit(property: Property) {
    setEditingProperty(property)
    setModalOpen(true)
  }

  async function handleToggleActive(property: Property) {
    await updateProperty.mutateAsync({ id: property.id, data: { is_active: !property.is_active } })
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Квартиры</h1>
        <button
          onClick={openCreate}
          className="bg-[#376E6F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1C3334] transition-colors"
        >
          + Добавить квартиру
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#376E6F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : properties.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">Квартир пока нет</p>
          <p className="text-sm mt-1">Нажмите "+ Добавить квартиру" чтобы начать</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {properties.map(property => (
            <div
              key={property.id}
              className={`bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 ${!property.is_active ? 'opacity-60' : ''}`}
            >
              <div
                className="w-12 h-12 rounded-lg flex-shrink-0"
                style={{ backgroundColor: property.color + '33' }}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: property.color }} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800">{property.name}</h3>
                  {!property.is_active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Архив</span>
                  )}
                </div>
                {property.address && (
                  <p className="text-sm text-gray-500 truncate">{property.address}</p>
                )}
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                  <span>{property.rooms} {property.rooms === 1 ? 'комната' : 'комнат'}</span>
                  <span>{property.base_price.toLocaleString()} ₸/ночь</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(property)}
                  className="text-xs text-[#376E6F] hover:underline"
                >
                  Изменить
                </button>
                <button
                  onClick={() => handleToggleActive(property)}
                  className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
                >
                  {property.is_active ? 'Архивировать' : 'Восстановить'}
                </button>
                <button
                  onClick={() => {
                    if (confirm('Удалить квартиру и все её брони?')) {
                      deleteProperty.mutate(property.id)
                    }
                  }}
                  className="text-xs text-red-400 hover:text-red-600 hover:underline"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <PropertyModal
          property={editingProperty}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
