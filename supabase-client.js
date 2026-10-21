(() => {
  const config = window.CEBRI_CONFIG || {};
  window.CEBRI_SUPABASE = null;
  if (window.supabase?.createClient && config.supabaseUrl && config.supabaseAnonKey) {
    window.CEBRI_SUPABASE = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }
})();
