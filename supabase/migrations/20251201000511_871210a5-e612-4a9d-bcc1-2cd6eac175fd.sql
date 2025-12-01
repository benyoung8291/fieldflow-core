-- Fix the calculate_next_generation_date function to handle correct enum values
CREATE OR REPLACE FUNCTION calculate_next_generation_date(
  p_current_date DATE,
  p_frequency recurrence_frequency
) RETURNS DATE AS $$
BEGIN
  RETURN CASE p_frequency
    WHEN 'daily' THEN p_current_date + INTERVAL '1 day'
    WHEN 'weekly' THEN p_current_date + INTERVAL '1 week'
    WHEN 'bi_weekly' THEN p_current_date + INTERVAL '2 weeks'
    WHEN 'monthly' THEN p_current_date + INTERVAL '1 month'
    WHEN 'quarterly' THEN p_current_date + INTERVAL '3 months'
    WHEN 'semi_annually' THEN p_current_date + INTERVAL '6 months'
    WHEN 'annually' THEN p_current_date + INTERVAL '1 year'
    WHEN 'one_time' THEN NULL
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;