-- Enable realtime for critical tables used by QControl Dashboard

-- First, ensure the tables are added to the 'supabase_realtime' publication
begin;

  -- Create publication if it doesn't exist (it usually does by default, but safe to check/create)
  create publication supabase_realtime if not exists;

  -- Add tables to the publication
  alter publication supabase_realtime add table sessions;
  alter publication supabase_realtime add table bookings;
  alter publication supabase_realtime add table notifications;
  alter publication supabase_realtime add table customers;
  alter publication supabase_realtime add table payments;

commit;
