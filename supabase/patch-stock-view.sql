DROP VIEW IF EXISTS public.v_stock_on_hand;
CREATE VIEW public.v_stock_on_hand
  WITH (security_invoker = true) AS
SELECT
  v.owner                          AS owner,
  v.id                             AS vaccine_id,
  v.name                           AS name,
  v.generic_name                   AS generic_name,
  v.unit_mode                      AS unit_mode,
  v.doses_per_vial                 AS doses_per_vial,
  v.min_balance_doses              AS min_balance_doses,
  v.is_active                      AS is_active,
  COALESCE(SUM(m.delta_doses), 0)  AS on_hand_doses,
  -- Mirrors stockLevel() in src/domain/stock.ts. Kept here rather than in
  -- the dashboard so there is ONE definition of "low": the web page must
  -- not re-derive it and quietly disagree with the phone.
  --
  -- The <= is deliberate and load-bearing. Firing at < instead means the
  -- warning never appears at exactly the safety limit, which is a silent
  -- stock-out (CLAUDE.md section 11, test 5).
  CASE
    WHEN COALESCE(SUM(m.delta_doses), 0) < 0 THEN 'NEGATIVE'
    WHEN COALESCE(SUM(m.delta_doses), 0) = 0 THEN 'OUT'
    WHEN v.min_balance_doses > 0
     AND COALESCE(SUM(m.delta_doses), 0) <= v.min_balance_doses THEN 'LOW'
    ELSE 'OK'
  END                              AS level
FROM public.vaccines v
LEFT JOIN public.stock_movements m
       ON m.vaccine_id = v.id
      AND m.owner = v.owner
      AND m.stock_source = 'CLINIC_STOCK'
WHERE v.deleted_at IS NULL
GROUP BY v.owner, v.id;

GRANT SELECT ON public.v_stock_on_hand TO authenticated;
REVOKE ALL ON public.v_stock_on_hand FROM anon;
