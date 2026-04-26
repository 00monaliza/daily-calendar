alter table settings
add column if not exists booking_sources text[] not null default array['direct','kaspi','booking','airbnb','avito','cash','other'];

alter table bookings
drop constraint if exists bookings_source_check;

alter table bookings
alter column source set default 'direct';
