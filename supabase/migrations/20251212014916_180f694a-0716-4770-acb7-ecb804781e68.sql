-- Add Availability Calendar menu item under People folder
INSERT INTO menu_items (id, label, icon, path, parent_id, item_order, is_folder, is_visible, is_system, tenant_id)
VALUES (
  gen_random_uuid(),
  'Availability Calendar',
  'CalendarDays',
  '/worker-availability-calendar',
  'f55cf64f-20f1-49e5-a2b9-14e47034ca77',
  2,
  false,
  true,
  true,
  '60afd0e1-d7bd-41d3-8d91-34ab21be2cd5'
);