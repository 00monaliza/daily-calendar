# Drag-and-Drop сортировка квартир в шахматке

**Дата:** 2026-04-08  
**Статус:** Approved

---

## Цель

Пользователь может менять порядок квартир в списке шахматки (левая колонка) через drag-and-drop. Порядок сохраняется в Supabase и восстанавливается после обновления страницы на всех устройствах.

---

## База данных

### Миграция
Добавить колонку `sort_order` (integer, nullable) в таблицу `properties`.

```sql
ALTER TABLE properties ADD COLUMN sort_order integer;
```

Nullable — существующие записи получают `null`, что обеспечивает обратную совместимость.

### Сортировка
`getAll` меняет порядок сортировки:
```
.order('sort_order', { nullsFirst: false }).order('created_at')
```
Квартиры с `sort_order = null` встают в конец по дате создания.

---

## Слой данных

### `propertyApi.reorder(ids: string[])`
Batch-update: каждому id присваивает `sort_order = index` (0-based).  
Реализация: последовательные UPDATE или `upsert` по id.

### `useReorderProperties()`
Хук-мутация (`useMutation`). После успеха инвалидирует `['properties']`.

---

## Компоненты

### Зависимости
```
@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### ChessPage
- Держит `orderedProperties: Property[]` в локальном state
- Синхронизирует с данными из `useProperties` при первой загрузке
- Функция `handleReorder(ids: string[])`:
  1. Optimistic update: переставляет `orderedProperties` немедленно
  2. Вызывает `reorderProperties(ids)` на сервере
- Передаёт `orderedProperties` (вместо `properties`) в грид и `onReorder={handleReorder}`

### SortablePropertyRow
Компонент-обёртка для `<tr>` строки квартиры.
- Использует `useSortable({ id: property.id })`
- `listeners` и `attributes` (drag handle) — только на иконке grip, не на всей строке
- `transform` через `CSS.Transform.toString` для смещения во время drag
- `transition` для плавной анимации остальных строк
- `opacity: 0.5` на перетаскиваемом элементе (`isDragging`)

### Иконка grip
SVG иконка (6 точек 2×3) слева от цветного кружка в ячейке с именем квартиры.  
Стили: `cursor: grab` в обычном состоянии, `cursor: grabbing` во время drag.

### DnD-обёртка в ChessGrid / MobileChessGrid
```tsx
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={propertyIds} strategy={verticalListSortingStrategy}>
    <tbody>
      {properties.map(p => <SortablePropertyRow key={p.id} ... />)}
    </tbody>
  </SortableContext>
</DndContext>
```

### Сенсор
`PointerSensor` с `activationConstraint: { distance: 5 }` — активация после 5px движения, исключает случайные клики.

### Анимация
dnd-kit перемещает элементы через CSS transform — строки плавно "раздвигаются" без отдельного placeholder.

---

## Поток данных

```
[grip mousedown/touchstart]
  → PointerSensor (5px threshold)
    → DragStart: isDragging=true, opacity 0.5 на строке
      → DragOver: остальные строки анимированно сдвигаются
        → DragEnd: arrayMove() → обновить state → вызвать API
```

---

## Что НЕ входит в scope

- Drag между разными списками
- Drag столбцов (дат)
- Undo/redo
- Сортировка по другим критериям (кнопки)
