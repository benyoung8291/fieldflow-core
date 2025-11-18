-- Force PostgREST to reload schema cache to recognize new columns
NOTIFY pgrst, 'reload schema';