ALTER TABLE "recovery_decisions" ADD COLUMN "safety_context" jsonb;
CREATE OR REPLACE FUNCTION enforce_automated_recovery_limit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE max_actions integer; existing_actions integer;
BEGIN
  IF NEW.action NOT IN ('RETRY_ORIGINAL_CHECKOUT', 'OFFER_ALTERNATE_CHECKOUT', 'CREATE_PAYMENT_LINK') THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.journey_id::text));
  max_actions := COALESCE(NULLIF(current_setting('recovery.max_automated_actions', true), '')::integer, 2);
  SELECT count(*) INTO existing_actions FROM recovery_decisions WHERE journey_id = NEW.journey_id AND action IN ('RETRY_ORIGINAL_CHECKOUT', 'OFFER_ALTERNATE_CHECKOUT', 'CREATE_PAYMENT_LINK');
  IF existing_actions >= max_actions THEN RAISE EXCEPTION 'AUTOMATED_ACTION_LIMIT'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER recovery_decisions_enforce_automated_limit BEFORE INSERT ON "recovery_decisions" FOR EACH ROW EXECUTE FUNCTION enforce_automated_recovery_limit();
