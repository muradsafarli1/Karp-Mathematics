/**
 * KARP / ABLE server
 * - Serves the existing static KARP site.
 * - Builds a persistent PostgreSQL index of the English MathNet proof archive.
 * - Exposes fast metadata, detail and random-selection APIs so the browser never
 *   has to scan 28k-30k Hugging Face rows.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const MATHNET_DATASET = process.env.MATHNET_DATASET || 'ShadenA/MathNet';
const MATHNET_CONFIG = process.env.MATHNET_CONFIG || 'all';
const MATHNET_SPLIT = process.env.MATHNET_SPLIT || 'train';
const MATHNET_SYNC_VERSION = process.env.MATHNET_SYNC_VERSION || '2026-09-28-v9';
const HF_ROWS_URL = 'https://datasets-server.huggingface.co/rows';
const HF_FILTER_URL = 'https://datasets-server.huggingface.co/filter';
const MAX_PAGE = 100;
const SYNC_CONCURRENCY = Math.max(2, Math.min(12, Number(process.env.MATHNET_SYNC_CONCURRENCY || 8)));

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: /render\.com|onrender\.com/i.test(process.env.DATABASE_URL)
        ? { rejectUnauthorized: false }
        : undefined,
      max: Number(process.env.PGPOOL_MAX || 6)
    })
  : null;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon'
};

const EN_MARKERS = new Set([
  'a','an','and','are','as','assume','because','by','can','consider','find','for',
  'from','given','hence','if','in','is','it','let','may','not','of','on','or','prove',
  'show','since','such','suppose','than','that','the','then','therefore','this','to',
  'we','which','with','where','when','will','would','thus'
]);

const FOREIGN_MARKERS = new Set([
  'der','die','das','und','ist','sind','eine','einer','nicht','für','mit','von','zu','den',
  'que','para','por','una','uno','los','las','del','como','pero','esta','este','son',
  'una','des','le','la','les','dans','avec','pour','une','et','est','sont','sur','ce',
  'ces','cette','mais','alors','es','se','los','las','del','en','un','una','como',
  'porque','sobre','entre','não','nao','uma','um','dos','das','em','por','com','que',
  'quando','seu','sua'
]);

function stripMath(text) {
  return String(text || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/\\\([\s\S]*?\\\)/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\\[A-Za-z]+\*?/g, ' ')
    .replace(/[{}_^$\\]/g, ' ')
    .replace(/[0-9]+/g, ' ');
}

function looksEnglish(text) {
  const raw = stripMath(text).toLowerCase();
  if (!raw.trim()) return false;
  if (/[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Arabic}\p{Script=Han}]/u.test(raw)) return false;
  const tokens = raw.match(/[\p{L}]+/gu) || [];
  if (tokens.length < 3) return true;
  const foreign = tokens.filter(t => FOREIGN_MARKERS.has(t)).length;
  const english = tokens.filter(t => EN_MARKERS.has(t)).length;
  if (foreign >= 2 && foreign > english) return false;
  if (english >= 1) return true;
  // Very short statements can legitimately have few stopwords.
  return tokens.length <= 12 && foreign === 0;
}

function categoryFor(row) {
  const topicText = (Array.isArray(row.topics_flat) ? row.topics_flat.join(' ') : '').toLowerCase();
  const text = String(row.problem_markdown || '').toLowerCase();
  const rules = [
    ['G', /(geometry|triangle|circle|angle|polygon|quadrilateral|concyclic|similarity|incircle|circumcircle|solid geometry)/],
    ['N', /(number theory|divisib|prime|integer|diophant|congruence|modular|gcd|lcm|factor|remainder)/],
    ['C', /(combinatorics|counting|graph theory|permutation|combination|pigeonhole|invariant|coloring|probability)/],
    ['A', /(algebra|equation|polynomial|inequal|functional equation|sequence|series|absolute value)/]
  ];
  for (const [code, re] of rules) if (re.test(topicText) || re.test(text)) return code;
  return 'A';
}

function yearFor(row) {
  if (row.year != null && String(row.year).trim()) return String(row.year).trim();
  const source = [
    row.source_booklet,
    row.booklet_source,
    row.competition
  ].map(v => String(v || '')).join(' ');
  const match = source.match(/(?:^|[^0-9])(19\\d{2}|20\\d{2})(?:[^0-9]|$)/);
  return match ? match[1] : '';
}

function problemNumberFor(row) {
  if (row.problem_number != null && String(row.problem_number).trim()) {
    const v = String(row.problem_number).trim();
    return /^P/i.test(v) ? v : 'P' + v;
  }
  const text = String(row.problem_markdown || '').replace(/<[^>]+>/g, ' ');
  const patterns = [
    /(?:^|[\\n\\r])\\s*(?:#+\\s*)?(?:problem|question|problem\\s*no\\.?|no\\.)\\s*#?\\s*(\\d{1,2})\\b/i,
    /(?:^|[\\n\\r])\\s*\\*{0,2}\\s*(\\d{1,2})\\s*[\\.)]\\s*/,
    /\\bP\\s*([1-9]\\d?)\\b/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return 'P' + m[1];
  }
  return '';
}

function competitionFor(row) {
  return String(row.competition || '').trim() || 'MathNet';
}

function displayTitle(row) {
  const competition = competitionFor(row);
  const year = yearFor(row);
  const problemNumber = problemNumberFor(row);
  return competition + (year || problemNumber
    ? ' — ' + [year, problemNumber].filter(Boolean).join(' · ')
    : '');
}

function difficultyFor(row) {
  const text = String(row.problem_markdown || '');
  const topics = Array.isArray(row.topics_flat) ? row.topics_flat.length : 0;
  const competition = competitionFor(row).toLowerCase();
  let score = Math.min(4, Math.floor(text.length / 900))
    + Math.min(2, Math.max(0, topics - 1));
  if (/imo|shortlist|tst|olympiad/.test(competition)) score++;
  return score >= 3 ? 'hard' : 'easy';
}

function cleanStatement(text) {
  return String(text || '')
    .replace(/\\\\\[/g, '\\[')
    .replace(/\\\\\]/g, '\\]')
    .replace(/\\\\\(/g, '\\(')
    .replace(/\\\\\)/g, '\\)');
}

function normalizeSolutions(raw) {
  const solutions = Array.isArray(raw) ? raw.map(v => String(v || '').trim()).filter(Boolean) : [];
  return solutions.filter(looksEnglish).map(cleanStatement);
}

function rowIsGood(row) {
  const language = String(row.language || '').trim().toLowerCase();
  if (!(language === 'english' || language === 'en' || language.startsWith('en-'))) return false;
  const statement = cleanStatement(row.problem_markdown || '').trim();
  if (!statement || !looksEnglish(statement)) return false;
  const solutions = normalizeSolutions(row.solutions_markdown);
  if (!solutions.length) return false;
  const type = String(row.problem_type || '').trim().toLowerCase();
  if (!['proof','proof only','proof and answer'].includes(type)) return false;
  return true;
}

function normalizedRow(raw) {
  const row = raw && raw.row ? raw.row : raw;
  const sourceIndex = Number(raw && raw.row_idx != null ? raw.row_idx : -1);
  const id = String(row?.id || row?.unique_id || ('mathnet-' + sourceIndex));
  const statement = cleanStatement(row?.problem_markdown || '').trim();
  const solutions = normalizeSolutions(row?.solutions_markdown);
  return {
    id,
    sourceIndex,
    country: String(row?.country || '').trim(),
    competition: competitionFor(row),
    year: yearFor(row),
    section: String(row?.section || '').trim(),
    problemNumber: problemNumberFor(row),
    sourceBooklet: String(row?.source_booklet || '').trim(),
    bookletSource: String(row?.booklet_source || '').trim(),
    language: 'English',
    problemType: String(row?.problem_type || '').trim(),
    statement,
    solutions,
    category: categoryFor(row),
    difficulty: difficultyFor(row),
    hasSolution: solutions.length > 0,
    finalAnswer: row?.final_answer == null ? '' : String(row.final_answer || ''),
    title: displayTitle(row),
    hasImages: /attached_image_\\d+\\.png/i.test(statement)
  };
}

function toDbParams(q, syncVersion) {
  const searchText = [
    q.title, q.country, q.competition, q.year, q.problemNumber,
    q.section, q.sourceBooklet, q.bookletSource, stripMath(q.statement)
  ].filter(Boolean).join(' ');
  return [
    q.id, syncVersion, q.sourceIndex, q.country, q.competition, q.year || null,
    q.section || null, q.problemNumber || null, q.sourceBooklet || null,
    q.bookletSource || null, q.language, q.problemType, q.category, q.difficulty,
    q.statement, JSON.stringify(q.solutions), q.finalAnswer || null,
    q.hasImages, searchText
  ];
}

async function initSchema() {
  if (!pool) return false;
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE TABLE IF NOT EXISTS mathnet_problems (
      id TEXT PRIMARY KEY,
      sync_version TEXT NOT NULL,
      source_index INTEGER NOT NULL,
      country TEXT NOT NULL DEFAULT '',
      competition TEXT NOT NULL DEFAULT '',
      year TEXT,
      section TEXT,
      problem_number TEXT,
      source_booklet TEXT,
      booklet_source TEXT,
      language TEXT NOT NULL DEFAULT 'English',
      problem_type TEXT NOT NULL DEFAULT '',
      category CHAR(1) NOT NULL DEFAULT 'A',
      difficulty TEXT NOT NULL DEFAULT 'easy',
      statement TEXT NOT NULL,
      solutions JSONB NOT NULL DEFAULT '[]'::jsonb,
      final_answer TEXT,
      has_images BOOLEAN NOT NULL DEFAULT FALSE,
      search_text TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mathnet_sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_mathnet_category ON mathnet_problems(category);
    CREATE INDEX IF NOT EXISTS idx_mathnet_difficulty ON mathnet_problems(difficulty);
    CREATE INDEX IF NOT EXISTS idx_mathnet_year ON mathnet_problems(year);
    CREATE INDEX IF NOT EXISTS idx_mathnet_search ON mathnet_problems USING gin(search_text gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_mathnet_sync_version ON mathnet_problems(sync_version);
  `);
  return true;
}

let syncPromise = null;
let indexCache = null;
let indexCacheVersion = null;

async function hfJson(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error('Hugging Face HTTP ' + response.status);
  return response.json();
}

async function fetchFiltered(offset, length = 100) {
  const u = new URL(HF_FILTER_URL);
  u.searchParams.set('dataset', MATHNET_DATASET);
  u.searchParams.set('config', MATHNET_CONFIG);
  u.searchParams.set('split', MATHNET_SPLIT);
  u.searchParams.set('where', '\"language\"=\'English\' AND (\"problem_type\"=\'proof\' OR \"problem_type\"=\'proof only\' OR \"problem_type\"=\'proof and answer\')');
  u.searchParams.set('offset', String(offset));
  u.searchParams.set('length', String(Math.min(MAX_PAGE, length)));
  return hfJson(u);
}

async function syncMathNet() {
  if (!pool) throw new Error('DATABASE_URL is not configured.');
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    console.log('[MathNet] sync started:', MATHNET_DATASET, MATHNET_SYNC_VERSION);

    const first = await fetchFiltered(0, MAX_PAGE);
    const total = Number(first.num_rows_total || 0);
    const offsets = [];
    for (let offset = 0; offset < total; offset += MAX_PAGE) offsets.push(offset);

    let cursor = 0;
    let accepted = 0;
    let fetched = 0;
    const rowsForBatch = [];

    async function worker() {
      while (true) {
        const i = cursor++;
        if (i >= offsets.length) return;
        const offset = offsets[i];
        try {
          const payload = offset === 0 ? first : await fetchFiltered(offset, MAX_PAGE);
          const good = (payload.rows || [])
            .map(normalizedRow)
            .filter(rowIsGood);
          fetched += (payload.rows || []).length;
          rowsForBatch.push(...good);
        } catch (error) {
          console.error('[MathNet] page failed at', offset, error.message);
        }
      }
    }

    await Promise.all(Array.from({ length: SYNC_CONCURRENCY }, worker));

    // Retry missing pages once, sequentially enough to avoid a burst after rate limiting.
    const seenIndexes = new Set(rowsForBatch.map(x => x.sourceIndex));
    for (const offset of offsets) {
      if (offset === 0 || rowsForBatch.length >= total) break;
      if (rowsForBatch.some(x => x.sourceIndex >= offset && x.sourceIndex < offset + MAX_PAGE)) continue;
      try {
        const payload = await fetchFiltered(offset, MAX_PAGE);
        const good = (payload.rows || []).map(normalizedRow).filter(rowIsGood);
        for (const row of good) {
          if (!seenIndexes.has(row.sourceIndex)) {
            rowsForBatch.push(row);
            seenIndexes.add(row.sourceIndex);
          }
        }
        fetched += (payload.rows || []).length;
      } catch (error) {
        console.error('[MathNet] retry failed at', offset, error.message);
      }
    }

    // The filtered API is deterministic by row index. Deduplicate and order for stable labels.
    const unique = Array.from(new Map(rowsForBatch.map(row => [row.id, row])).values())
      .sort((a, b) => a.sourceIndex - b.sourceIndex);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < unique.length; i += 100) {
        const batch = unique.slice(i, i + 100);
        const placeholders = [];
        const values = [];
        batch.forEach((q, rowIndex) => {
          const params = toDbParams(q, MATHNET_SYNC_VERSION);
          const base = rowIndex * params.length;
          placeholders.push('(' + params.map((_, j) => '$' + (base + j + 1)).join(',') + ')');
          values.push(...params);
        });
        await client.query(`
          INSERT INTO mathnet_problems (
            id,sync_version,source_index,country,competition,year,section,problem_number,
            source_booklet,booklet_source,language,problem_type,category,difficulty,
            statement,solutions,final_answer,has_images,search_text,updated_at
          ) VALUES ${placeholders.join(',')}
          ON CONFLICT (id) DO UPDATE SET
            sync_version=EXCLUDED.sync_version,
            source_index=EXCLUDED.source_index,
            country=EXCLUDED.country,
            competition=EXCLUDED.competition,
            year=EXCLUDED.year,
            section=EXCLUDED.section,
            problem_number=EXCLUDED.problem_number,
            source_booklet=EXCLUDED.source_booklet,
            booklet_source=EXCLUDED.booklet_source,
            language=EXCLUDED.language,
            problem_type=EXCLUDED.problem_type,
            category=EXCLUDED.category,
            difficulty=EXCLUDED.difficulty,
            statement=EXCLUDED.statement,
            solutions=EXCLUDED.solutions,
            final_answer=EXCLUDED.final_answer,
            has_images=EXCLUDED.has_images,
            search_text=EXCLUDED.search_text,
            updated_at=NOW()
        `, values);
        accepted += batch.length;
      }
      await client.query('DELETE FROM mathnet_problems WHERE sync_version <> $1', [MATHNET_SYNC_VERSION]);
      await client.query(
        `INSERT INTO mathnet_sync_state(key,value,updated_at)
         VALUES ('version',$1,NOW()),('source',$2,NOW()),('row_count',$3,NOW())
         ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`,
        [MATHNET_SYNC_VERSION, MATHNET_DATASET, String(unique.length)]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    indexCache = null;
    indexCacheVersion = null;
    console.log('[MathNet] sync complete:', unique.length, 'accepted of', total, 'filtered rows.');
    return { totalFiltered: total, fetched, accepted };
  })().catch(error => {
    console.error('[MathNet] sync failed:', error);
    throw error;
  }).finally(() => {
    syncPromise = null;
  });
  return syncPromise;
}

async function currentState() {
  if (!pool) return { available: false, ready: false, syncing: !!syncPromise, count: 0 };
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS count,
       COALESCE(MAX(updated_at), NOW()) AS updated_at,
       (SELECT value FROM mathnet_sync_state WHERE key='version') AS version
     FROM mathnet_problems`
  );
  const count = Number(rows[0]?.count || 0);
  return {
    available: true,
    ready: count > 0,
    syncing: !!syncPromise,
    count,
    version: rows[0]?.version || null,
    expectedVersion: MATHNET_SYNC_VERSION
  };
}

async function getIndex() {
  if (!pool) throw new Error('PostgreSQL is not configured.');
  if (indexCache && indexCacheVersion === MATHNET_SYNC_VERSION) return indexCache;
  const { rows } = await pool.query(`
    SELECT id,source_index,country,competition,year,section,problem_number,
           source_booklet,booklet_source,language,problem_type,category,difficulty,
           has_images, title,
           LEFT(search_text, 900) AS search_preview
    FROM (
      SELECT
        id,source_index,country,competition,year,section,problem_number,source_booklet,
        booklet_source,language,problem_type,category,difficulty,has_images,
        (competition || CASE WHEN COALESCE(year,'') <> '' OR COALESCE(problem_number,'') <> ''
          THEN ' — ' || array_to_string(ARRAY_REMOVE(ARRAY[NULLIF(year,''),NULLIF(problem_number,'')], NULL), ' · ')
          ELSE '' END) AS title,
        search_text
      FROM mathnet_problems
    ) q
    ORDER BY COALESCE(year,'') DESC, country, competition, source_index
  `);
  indexCache = rows.map(x => ({
    id: x.id,
    sourceIndex: Number(x.source_index),
    country: x.country || '',
    competition: x.competition || '',
    year: x.year || '',
    section: x.section || '',
    problemNumber: x.problem_number || '',
    sourceBooklet: x.source_booklet || '',
    bookletSource: x.booklet_source || '',
    language: x.language || 'English',
    problemType: x.problem_type || '',
    category: x.category || 'A',
    difficulty: x.difficulty || 'easy',
    hasSolution: true,
    hasImages: !!x.has_images,
    title: x.title || x.competition || 'MathNet Problem',
    statement: x.search_preview || '',
    solutions: []
  }));
  indexCacheVersion = MATHNET_SYNC_VERSION;
  return indexCache;
}

async function getProblem(id) {
  if (!pool) throw new Error('PostgreSQL is not configured.');
  const { rows } = await pool.query('SELECT * FROM mathnet_problems WHERE id=$1 LIMIT 1', [String(id)]);
  if (!rows.length) return null;
  const x = rows[0];
  return {
    id: x.id,
    sourceIndex: Number(x.source_index),
    country: x.country || '',
    competition: x.competition || '',
    year: x.year || '',
    section: x.section || '',
    problemNumber: x.problem_number || '',
    sourceBooklet: x.source_booklet || '',
    bookletSource: x.booklet_source || '',
    language: x.language || 'English',
    problemType: x.problem_type || '',
    category: x.category || 'A',
    difficulty: x.difficulty || 'easy',
    hasSolution: true,
    hasImages: !!x.has_images,
    statement: x.statement || '',
    solutions: Array.isArray(x.solutions) ? x.solutions : [],
    finalAnswer: x.final_answer || '',
    title: x.competition + ((x.year || x.problem_number)
      ? ' — ' + [x.year, x.problem_number].filter(Boolean).join(' · ')
      : '')
  };
}

function intParam(v, fallback, min, max) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}

async function randomProblems(url) {
  if (!pool) throw new Error('PostgreSQL is not configured.');
  const count = intParam(url.searchParams.get('count'), 6, 1, 30);
  const categories = (url.searchParams.get('categories') || 'A,C,G,N')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(x => ['A','C','G','N'].includes(x));
  const difficulty = url.searchParams.get('difficulty') || 'any';
  const rawSequence = (url.searchParams.get('sequence') || '')
    .split(',')
    .map(x => x.trim().toUpperCase())
    .filter(Boolean);
  const wanted = rawSequence.length === count && rawSequence.every(x => ['A','C','G','N'].includes(x))
    ? rawSequence
    : Array.from({ length: count }, (_, i) => categories[i % categories.length]);

  const uniqueCategories = [...new Set(wanted)];
  const pools = new Map();

  for (const cat of uniqueCategories) {
    const params = [cat];
    let where = 'category=$1';
    if (difficulty !== 'any') {
      params.push(difficulty);
      where += ' AND difficulty=$2';
    }
    const { rows } = await pool.query(
      `SELECT * FROM mathnet_problems WHERE ${where} ORDER BY random() LIMIT ${Math.max(4, count * 2)}`,
      params
    );
    pools.set(cat, rows);
  }

  const used = new Set();
  const picked = [];
  for (const cat of wanted) {
    const list = pools.get(cat) || [];
    let row = list.find(x => !used.has(x.id));
    if (!row && difficulty !== 'any') {
      const { rows } = await pool.query(
        'SELECT * FROM mathnet_problems WHERE category=$1 ORDER BY random() LIMIT 8',
        [cat]
      );
      row = rows.find(x => !used.has(x.id));
    }
    if (!row) {
      const { rows } = await pool.query(
        'SELECT * FROM mathnet_problems WHERE category = ANY($1::text[]) ORDER BY random() LIMIT 8',
        [categories.length ? categories : ['A','C','G','N']]
      );
      row = rows.find(x => !used.has(x.id));
    }
    if (row) {
      used.add(row.id);
      picked.push(row);
    }
  }

  return picked.map(x => ({
    id: x.id,
    sourceIndex: Number(x.source_index),
    country: x.country || '',
    competition: x.competition || '',
    year: x.year || '',
    section: x.section || '',
    problemNumber: x.problem_number || '',
    sourceBooklet: x.source_booklet || '',
    bookletSource: x.booklet_source || '',
    language: x.language || 'English',
    problemType: x.problem_type || '',
    category: x.category || 'A',
    difficulty: x.difficulty || 'easy',
    hasSolution: true,
    hasImages: !!x.has_images,
    statement: x.statement || '',
    solutions: Array.isArray(x.solutions) ? x.solutions : [],
    title: x.competition + ((x.year || x.problem_number)
      ? ' — ' + [x.year, x.problem_number].filter(Boolean).join(' · ')
      : '')
  }));
}

async function maybeStartSync() {
  if (!pool) return;
  try {
    await initSchema();
    const state = await currentState();
    if (!state.ready || state.version !== MATHNET_SYNC_VERSION) {
      syncMathNet().catch(() => {});
    }
  } catch (error) {
    console.error('[MathNet] startup check failed:', error);
  }
}

function sendJson(req, res, value, status = 200, cache = 'no-store') {
  const payload = Buffer.from(JSON.stringify(value));
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.setHeader('Vary', 'Accept-Encoding');
  if (/gzip/i.test(String(req.headers['accept-encoding'] || ''))) {
    res.setHeader('Content-Encoding', 'gzip');
    zlib.gzip(payload, { level: 6 }, (err, data) => {
      if (err) {
        res.end(payload);
        return;
      }
      res.end(data);
    });
  } else {
    res.end(payload);
  }
}

function sendError(req, res, message, status = 500, extra = {}) {
  sendJson(req, res, { error: message, ...extra }, status);
}

function serveStatic(req, res, pathname) {
  let requestPath = pathname;
  const routes = {
    '/': '/index.html',
    '/problems': '/problems.html',
    '/problem': '/problem.html',
    '/contests': '/contests.html',
    '/contest': '/contest.html',
    '/articles': '/articles.html',
    '/article': '/article.html',
    '/exams': '/exams.html',
    '/exam': '/exam.html',
    '/videos': '/videos.html',
    '/about': '/about.html',
    '/account': '/account.html',
    '/admin': '/admin.html',
    '/login': '/login.html',
    '/signup': '/signup.html',
    '/mock': '/mock.html',
    '/calculator': '/calculator.html',
    '/desmos': '/desmos.html',
    '/geogebra': '/geogebra.html'
  };
  requestPath = routes[requestPath] || requestPath;
  if (!path.extname(requestPath)) requestPath += '.html';
  const absolute = path.resolve(ROOT, '.' + requestPath);
  if (!absolute.startsWith(ROOT + path.sep) && absolute !== path.join(ROOT, requestPath)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  fs.readFile(absolute, (err, data) => {
    if (err) {
      res.statusCode = err.code === 'ENOENT' ? 404 : 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(err.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }
    const ext = path.extname(absolute).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    if (ext === '.html' || ext === '.js' || ext === '.css') {
      res.setHeader('Cache-Control', 'public, max-age=300');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.end();
      return;
    }

    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

    if (url.pathname.startsWith('/api/mathnet/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');

      if (url.pathname === '/api/mathnet/status') {
        const state = await currentState();
        sendJson(req, res, {
          ...state,
          dataset: MATHNET_DATASET,
          filteredRule: 'English + proof / proof only / proof and answer + English solution'
        }, 200, 'no-store');
        return;
      }

      if (url.pathname === '/api/mathnet/index') {
        try {
          const state = await currentState();
          if (!state.ready) {
            sendError(req, res, 'MathNet index is still being built.', 503, {
              warmingUp: true,
              syncing: state.syncing,
              count: state.count
            });
            return;
          }
          sendJson(req, res, {
            source: MATHNET_DATASET,
            version: MATHNET_SYNC_VERSION,
            total: state.count,
            problems: await getIndex()
          }, 200, 'public, max-age=300, stale-while-revalidate=86400');
        } catch (error) {
          sendError(req, res, error.message, 500);
        }
        return;
      }

      const problemMatch = url.pathname.match(/^\/api\/mathnet\/problem\/([^/]+)$/);
      if (problemMatch) {
        try {
          const id = decodeURIComponent(problemMatch[1]);
          const problem = await getProblem(id);
          if (!problem) {
            sendError(req, res, 'Problem not found.', 404);
            return;
          }
          // Images in MathNet are delivered as short-lived signed assets. Keep the
          // database durable, but optionally refresh the source row for image URLs.
          if (problem.hasImages && problem.sourceIndex >= 0 && problem.statement.includes('attached_image_')) {
            try {
              const u = new URL(HF_ROWS_URL);
              u.searchParams.set('dataset', MATHNET_DATASET);
              u.searchParams.set('config', MATHNET_CONFIG);
              u.searchParams.set('split', MATHNET_SPLIT);
              u.searchParams.set('offset', String(problem.sourceIndex));
              u.searchParams.set('length', '1');
              const source = await hfJson(u);
              const row = source.rows?.[0]?.row || {};
              const imgs = Array.isArray(row.images) ? row.images
                .map(x => typeof x === 'string' ? x : x?.src || '')
                .filter(Boolean) : [];
              if (imgs.length) {
                problem.statement = problem.statement.replace(
                  /!\[([^\]]*)\]\(attached_image_(\d+)\.png\)/g,
                  (_, alt, n) => imgs[Number(n) - 1] ? '![' + (alt || 'Figure') + '](' + imgs[Number(n) - 1] + ')' : ''
                );
              }
            } catch (_) {}
          }
          sendJson(req, res, problem, 200, 'public, max-age=300');
        } catch (error) {
          sendError(req, res, error.message, 500);
        }
        return;
      }

      if (url.pathname === '/api/mathnet/random') {
        try {
          const problems = await randomProblems(url);
          sendJson(req, res, {
            source: MATHNET_DATASET,
            total: problems.length,
            problems
          }, 200, 'no-store');
        } catch (error) {
          sendError(req, res, error.message, 500);
        }
        return;
      }

      sendError(req, res, 'Unknown MathNet endpoint.', 404);
      return;
    }

    serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error('[KARP] request error:', error);
    sendError(req, res, error.message || 'Server error', 500);
  }
});

server.on('clientError', (_err, socket) => {
  try { socket.end('HTTP/1.1 400 Bad Request\\r\\n\\r\\n'); } catch (_) {}
});

(async () => {
  await maybeStartSync();
  server.listen(PORT, () => {
    console.log('KARP server listening on port ' + PORT);
  });
})();
