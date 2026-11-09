function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}. Veja .env.example.`);
  return value;
}

// Lidas sob demanda para o build não exigir segredos.
export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  asaasUrl: () => process.env.ASAAS_API_URL ?? "https://api-sandbox.asaas.com/v3",
  asaasKey: () => required("ASAAS_API_KEY"),
  asaasWebhookToken: () => required("ASAAS_WEBHOOK_TOKEN"),
  bunnyLibraryId: () => process.env.BUNNY_LIBRARY_ID ?? "",
  bunnyApiKey: () => required("BUNNY_API_KEY"),
  bunnyEmbedKey: () => process.env.BUNNY_EMBED_TOKEN_KEY ?? "",
  bunnyCdnHost: () => process.env.BUNNY_CDN_HOST ?? "",
  bunnyCdnTokenKey: () => process.env.BUNNY_CDN_TOKEN_KEY ?? "",
};
