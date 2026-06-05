// scripts/flag-talkshows.mjs
// Flags entries whose videos are NOT episodes (talkshows/panels/interviews/gameplay).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cat = JSON.parse(readFileSync(resolve('lib', 'expanded-catalog.json'), 'utf8'));
const pl = JSON.parse(readFileSync(resolve('lib', 'expanded-playlists.json'), 'utf8'));

// Episode markers (handles EP01, Episode 12, S3E12, #12, Vol 1, OAD/OVA 01, Movie)
const EPISODE = /(?:\bepisode\b|\bep\b\.?\s*\d|#\s*\d|s\d+\s*e\d+|\bep\s*\d|\bvol\.?\s*\d|\boad\b\s*\d|\bova\b\s*\d|full\s+episode|episodio|\bep\d)/i;
// Non-episode (talkshow/promo) markers
const TALK = /\b(talk\s*show|podcast|radio|reaction|react|watch[- ]?along|commentary|discussion|interview|q&a|behind[- ]the[- ]scenes|behind the|making of|making|let'?s play|gameplay|plays|unboxing|review|after\s*hours|variety|special program|press conference|panel|convention|live\s*stream|livestream|\[live\]|nobar|mabar|cast announcement|voice actors?|creators?,|aftertalk|first impressions|book club|reading guide|quiz|celebration|moonlight party|featurette|studio tour|memories with|dubbing studio|first \d+ minutes|gaming|musegaming|championship awards|sketch)\b/i;

const flagged = [];
for (const c of cat) {
  if (c.type === 'movie') continue;
  const vids = pl[c.key] || [];
  if (!vids.length) continue;
  const ep = vids.filter((v) => EPISODE.test(v.title)).length / vids.length;
  const talk = vids.filter((v) => TALK.test(v.title)).length / vids.length;
  // Real anime = most videos are episodes. Flag only if almost none are episodes
  // AND most are talkshow-flavored (or title itself is talkshow).
  if (ep < 0.2 && (talk >= 0.5 || (TALK.test(c.title) && talk >= 0.3))) {
    flagged.push({ key: c.key, title: c.title, src: c.sourceName, n: vids.length, ep: ep.toFixed(2), talk: talk.toFixed(2), sample: vids[0].title });
  }
}

flagged.sort((a, b) => b.talk - a.talk);
console.log(`Flagged ${flagged.length} talkshow/non-episode entries:\n`);
for (const f of flagged) {
  console.log(`KEY=${f.key}`);
  console.log(`   ${f.title} (${f.src}) | ${f.n} vids | ep=${f.ep} talk=${f.talk}`);
  console.log(`   e.g. "${String(f.sample).slice(0, 75)}"`);
}
// Print just the keys for easy removal
console.log('\nKEYS:', JSON.stringify(flagged.map((f) => f.key)));
