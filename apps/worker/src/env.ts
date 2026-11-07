export interface SweepJob {
  ids: string[];
  page: number;
}

export interface Env {
  DB: D1Database;
  SWEEP_QUEUE: Queue<SweepJob>;
  TICKETMASTER_API_KEY: string;
  DISCORD_BOT_TOKEN: string;
  DISCORD_GUILD_ID: string;
  /** "1" = no publicar en Discord (los avisos se guardan igualmente). */
  DELIVERY_PAUSED?: string;
}
