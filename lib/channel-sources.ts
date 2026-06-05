// lib/channel-sources.ts
// Official legal anime YouTube channels — all IDs verified via yt-dlp.
// These are the ONLY sources the discovery system will pull from.
// Do NOT add random/fan/repost channels here.

export interface OfficialChannel {
  id: string;           // YouTube channel ID (UCxxx...)
  name: string;         // Display name
  region: string;       // Licensed region note
  /** When true: only accept playlists matching STRICT_PATTERNS (avoids game/promo noise) */
  strictFilter: boolean;
}

// Exclude playlist/video titles matching these — trailers, shorts, promos, clips, etc.
export const EXCLUDE_PATTERNS =
  /\b(?:trailer|teaser|promo|preview|highlight|recap|short|clip|opening|ending|ost|music\s*video|pv|cm|commercial|announcement|interview|reaction|behind|making|unboxing|review|countdown|ranking|news|q&a|spoiler|collab|collaboration|fan)\b/i;

// Strict channels: only accept playlists matching these (for channels with lots of non-anime content)
export const STRICT_PATTERNS =
  /\b(?:episode|ep\.?|full\s+episode|full\s+series|english\s+sub|english\s+dub|season|movie|film)\b|\[English/i;

// Minimum video duration in seconds to be considered a full episode (8 minutes)
export const MIN_EPISODE_SECONDS = 480;

export const OFFICIAL_ANIME_CHANNELS: OfficialChannel[] = [
  // ── Already-indexed channels (yt-dlp catalog) ──────────────────────────
  {
    id: 'UCGbshtvS9t-8CW11W7TooQg',
    name: 'Muse Asia Official',
    region: 'Asia',
    strictFilter: true,   // only [English Sub/Dub] or (Full Series) playlists
  },
  {
    id: 'UC0wNSTMWIL3qaorLx0jie6A',
    name: 'Ani-One Asia Official',
    region: 'Asia (MediaLink)',
    strictFilter: false,
  },
  {
    id: 'UC67pLBZ_z4Gd46t6mW7uHjA',
    name: 'Ani-One India Official',
    region: 'India (MediaLink)',
    strictFilter: false,
  },
  {
    id: 'UCxxnxya_32jcKj4yN1_kD7A',
    name: 'Muse Indonesia Official',
    region: 'Indonesia (Muse)',
    strictFilter: true,
  },
  {
    id: 'UCott96qGP5ADmsB_yNQMvDA',
    name: 'Muse Vietnam Official',
    region: 'Vietnam (Muse)',
    strictFilter: true,
  },
  {
    id: 'UC8I6E03SVRqPgAnrlrQfoYg',
    name: 'Muse Malaysia Official',
    region: 'Malaysia (Muse)',
    strictFilter: true,
  },
  {
    id: 'UCejtUitnpnf8Be-v5NuDSLw',
    name: 'GUNDAM.INFO Official',
    region: 'Worldwide (Sunrise/Bandai Namco)',
    strictFilter: false,
  },

  // ── New channels being added ────────────────────────────────────────────
  {
    id: 'UCpXeZRcuolNPUVqp21TGdYQ',
    // Handle: @ItsAnime  — verified 2026-06
    name: "It's Anime (powered by REMOW)",
    region: 'Worldwide',
    strictFilter: false,
  },
  {
    id: 'UCV1da9peoqEwqr45bpTJsbQ',
    // Handle: @VIZMedia  — verified 2026-06
    name: 'VIZ Media',
    region: 'Worldwide',
    strictFilter: true,  // VIZ has manga, games, etc. — only take episode playlists
  },
  {
    id: 'UC6pGDc4bFGD1_36IKv3FnYg',
    // Handle: @crunchyroll  — verified 2026-06
    name: 'Crunchyroll',
    region: 'Worldwide',
    strictFilter: true,  // Crunchyroll has clips, shorts, news
  },
  {
    id: 'UCVi2lI40LetxLBKn-rtWC3A',
    // Handle: @CrunchyrollDubs  — verified 2026-06
    name: 'Crunchyroll Dubs',
    region: 'Worldwide',
    strictFilter: true,
  },
  {
    id: 'UCzGf0DdUJVrsbcWL3e_tK1Q',
    // Handle: @AnimeonTMSOfficialChannel  — verified 2026-06
    name: 'Anime! on TMS Official Channel',
    region: 'Worldwide (TMS Entertainment)',
    strictFilter: false,
  },
  {
    id: 'UCTTv0NxWnJsNzAY3Ivj61zg',
    // Handle: @ToeiAnimation  — verified 2026-06
    name: 'Toei Animation Official',
    region: 'Worldwide (Toei Animation)',
    strictFilter: true,  // Toei has lots of non-episode content
  },
  {
    id: 'UCFctpiB_Hnlk3ejWfHqSm6Q',
    // Handle: @Pokemon  — verified 2026-06
    name: 'The Official Pokémon YouTube Channel',
    region: 'Worldwide (The Pokémon Company)',
    strictFilter: true,  // Mostly games/TCG — only take anime episode playlists
  },
  {
    id: 'UCyDicpSC5W69NOhbJthPSvw',
    // Handle: @AnimaxAsia  — verified 2026-06
    name: 'Animax Asia Official',
    region: 'Asia (Animax)',
    strictFilter: true,
  },
  {
    id: 'UCY5fcqgSrQItPAX_Z5Frmwg',
    // Handle: @KADOKAWAanime  — verified 2026-06
    name: 'KADOKAWAanime Official',
    region: 'Worldwide (KADOKAWA)',
    strictFilter: true,  // lots of promos/trailers — only take episode playlists
  },
  {
    id: 'UCOTnNH2Yh09ocsfv3HsDLaA',
    // Handle: @ADNanime  — verified 2026-06
    name: 'ADN (Anime Digital Network)',
    region: 'France (ADN)',
    strictFilter: true,
  },
  {
    id: 'UCwUeTOXP3DD9DIvHttowuSA',
    // Handle: @selectavision  — verified 2026-06
    name: 'Selecta Visión Official',
    region: 'Spain (Selecta Visión)',
    strictFilter: true,
  },
];

/** All known channel IDs as a Set for fast lookup */
export const APPROVED_CHANNEL_IDS = new Set(OFFICIAL_ANIME_CHANNELS.map((c) => c.id));
