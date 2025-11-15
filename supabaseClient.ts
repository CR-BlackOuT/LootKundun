import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vctghrjfopbnthsupuyi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjdGdocmpmb3BibnRoc3VwdXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMjMyMjAsImV4cCI6MjA3ODc5OTIyMH0.wrKrGaxemnCIAOjB7whBgBwNJJmOfg1lbKmjuiTM8So';

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL and Key must be provided in supabaseClient.ts");
}

export const supabase = createClient(supabaseUrl, supabaseKey);