export interface SweepJob {
  ids: string[];
  page: number;
  /** Zona del barrido: Europa (por defecto) y después América (EE. UU., Canadá y México). */
  region?: "eu" | "am";
}

export interface Env {
  DB: D1Database;
  /** Ficheros de la app (PWA) en public/. */
  ASSETS?: Fetcher;
  SWEEP_QUEUE: Queue<SweepJob>;
  TICKETMASTER_API_KEY: string;
  DISCORD_BOT_TOKEN: string;
  DISCORD_GUILD_ID: string;
  /** Token de GitHub (Actions: write) para lanzar los trabajos a su hora desde el cron del Worker. */
  GH_DISPATCH_TOKEN?: string;
  /** Clave pública de la aplicación de Discord (verifica la firma de los comandos). */
  DISCORD_PUBLIC_KEY?: string;
  /** "1" = no publicar en Discord (los avisos se guardan igualmente). */
  DELIVERY_PAUSED?: string;
}
