export const MUSE_ASIA_CHANNEL_ID = 'UCGbshtvS9t-8CW11W7TooQg';

export interface SeriesConfig {
  key: string;
  id: string;
  title: string;
  description: string;
  genres: string[];
  year?: number;
  playlistId: string;
  trending: number;
  type?: 'series' | 'movie';
  sourceName?: string;
  channelId?: string;
  regionNote?: string;
}

export interface TrailerConfig {
  id: string;
  animeTitle: string;
  videoId: string;
  genres: string[];
  year: number;
  trending: number;
}

const FEATURED_SERIES_CONFIGS: SeriesConfig[] = [
  {
    key: 'spyFamily',
    id: 'spy-family-trailer',
    title: 'SPY x FAMILY',
    description: 'The Forger family balances espionage, assassination, and school life.',
    genres: ['Action', 'Comedy', 'Family'],
    year: 2022,
    playlistId: 'PLwLSw1_eDZl1wGMYg5oB3uEns0CZNl6sI',
    trending: 110,
  },
  {
    key: 'hunterXHunter',
    id: 'hunter-x-hunter',
    title: 'HUNTER x HUNTER',
    description: 'Gon begins a dangerous journey to become a Hunter and find his father.',
    genres: ['Adventure', 'Action', 'Fantasy'],
    year: 2011,
    playlistId: 'PLwLSw1_eDZl2SdSro00Nvg38MQUf-5ZL8',
    trending: 108,
  },
  {
    key: 'fairyTail',
    id: 'fairy-tail',
    title: 'Fairy Tail',
    description: 'Lucy joins the Fairy Tail guild and sets out on magical adventures.',
    genres: ['Fantasy', 'Adventure', 'Action'],
    year: 2009,
    playlistId: 'PLwLSw1_eDZl2VQRIahDF73hnkdPjNRYnu',
    trending: 106,
  },
  {
    key: 'shangriLaFrontier',
    id: 'shangri-la-frontier',
    title: 'Shangri-La Frontier',
    description: 'A skilled gamer challenges a vast virtual reality game.',
    genres: ['Action', 'Adventure', 'Fantasy'],
    year: 2023,
    playlistId: 'PLwLSw1_eDZl1k3PpCugshhYpSQVWUAaib',
    trending: 104,
  },
  {
    key: 'frieren',
    id: 'frieren-beyond-journeys-end',
    title: "Frieren: Beyond Journey's End",
    description: 'An elven mage retraces her journey to understand the people she outlived.',
    genres: ['Fantasy', 'Adventure', 'Drama'],
    year: 2023,
    playlistId: 'PLwLSw1_eDZl10YPPR7qDsVf10wZfYnIMK',
    trending: 102,
  },
  {
    key: 'irumaKun',
    id: 'welcome-to-demon-school-iruma-kun',
    title: 'Welcome to Demon School! Iruma-kun',
    description: 'A human boy attends a demon school while hiding his identity.',
    genres: ['Comedy', 'Fantasy', 'School'],
    year: 2019,
    playlistId: 'PLwLSw1_eDZl1Sf_lALh99YZAJTp5IaRft',
    trending: 98,
  },
  {
    key: 'ragnaCrimson',
    id: 'ragna-crimson',
    title: 'Ragna Crimson',
    description: 'A dragon hunter fights against overwhelming enemies to change fate.',
    genres: ['Action', 'Fantasy', 'Drama'],
    year: 2023,
    playlistId: 'PLwLSw1_eDZl2gLJyLH6BkSr4l1XPaKDjT',
    trending: 96,
  },
];

export const SERIES_CONFIGS: SeriesConfig[] = FEATURED_SERIES_CONFIGS;

export const TRAILER_CONFIGS: TrailerConfig[] = [
  {
    id: 'spy-family-main-trailer',
    animeTitle: 'SPY x FAMILY',
    videoId: 'ZWXuGxQ5G_0',
    genres: ['Trailer', 'Action', 'Comedy'],
    year: 2022,
    trending: 70,
  },
];
