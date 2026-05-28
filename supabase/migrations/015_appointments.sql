-- ============================================================
-- Migration 015_appointments.sql
-- ============================================================

-- Enable uuid-ossp if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create table for slots
CREATE TABLE IF NOT EXISTS appointment_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_booked BOOLEAN NOT NULL DEFAULT FALSE,
  capacity INTEGER NOT NULL DEFAULT 1,
  booked_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  locked_by_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, slot_date, start_time, location)
);

CREATE INDEX IF NOT EXISTS idx_appointment_slots_user_id ON appointment_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_date ON appointment_slots(slot_date);

ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own appointment slots" ON appointment_slots;
CREATE POLICY "Users can manage own appointment slots" ON appointment_slots FOR ALL USING (auth.uid() = user_id);

-- 2. Create table for tokens
CREATE TABLE IF NOT EXISTS appointment_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_number TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  branch_prefix TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_tokens_user_id ON appointment_tokens(user_id);

ALTER TABLE appointment_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own appointment tokens" ON appointment_tokens;
CREATE POLICY "Users can manage own appointment tokens" ON appointment_tokens FOR ALL USING (auth.uid() = user_id);

-- 3. Create table for appointments
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  slot_id UUID REFERENCES appointment_slots(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show', 'waitlist')),
  token_id UUID REFERENCES appointment_tokens(id) ON DELETE SET NULL,
  agent_id UUID, -- references profiles.id or auth.users.id
  location TEXT,
  notes TEXT,
  revenue NUMERIC DEFAULT 0,
  google_calendar_event_id TEXT,
  google_calendar_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_contact_id ON appointments(contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own appointments" ON appointments;
CREATE POLICY "Users can manage own appointments" ON appointments FOR ALL USING (auth.uid() = user_id);

-- 4. Create table for reminders
CREATE TABLE IF NOT EXISTS appointment_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('before_24h', 'before_2h', 'before_30m', 'after_feedback', 'after_review', 'after_upsell')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  is_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_reminders_appointment_id ON appointment_reminders(appointment_id);

ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own reminders" ON appointment_reminders;
CREATE POLICY "Users can manage own reminders" ON appointment_reminders FOR ALL
  USING (EXISTS (SELECT 1 FROM appointments WHERE appointments.id = appointment_reminders.appointment_id AND appointments.user_id = auth.uid()));

-- 5. Create table for logs
CREATE TABLE IF NOT EXISTS appointment_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_logs_appointment_id ON appointment_logs(appointment_id);

ALTER TABLE appointment_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own logs" ON appointment_logs;
CREATE POLICY "Users can manage own logs" ON appointment_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM appointments WHERE appointments.id = appointment_logs.appointment_id AND appointments.user_id = auth.uid()));

-- Trigger set_updated_at for appointments
DROP TRIGGER IF EXISTS set_updated_at ON appointments;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
