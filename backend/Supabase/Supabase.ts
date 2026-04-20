// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://cfivvfmdwbguzroctoed.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmaXZ2Zm1kd2JndXpyb2N0b2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzI2NzIsImV4cCI6MjA5MjI0ODY3Mn0.3cfCJb0clRsjpm2toYquBAIVGWmwRrs8NAmSu2AACGI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
