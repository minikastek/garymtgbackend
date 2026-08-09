/**
 * Semilla: 3 usuarios, cada uno con binder (≥30 cartas distintas)
 * y wishlist (≥10 cartas), sets lo más distintos posible entre usuarios.
 */
const API = 'http://localhost:3001/api';

const USERS = [
  {
    username: 'alice',
    email: 'alice@garymtg.com',
    password: 'password123',
    binderQuery: 'c=r f:modern -t:land',
    wishlistQuery: 'c=w f:modern (r:rare OR r:mythic)',
    binderName: 'Binder Rojo',
    binderDesc: 'Colección agresiva roja',
    wishlistName: 'Wishlist Blancas',
    wishlistDesc: 'Cartas blancas que quiero',
  },
  {
    username: 'bob',
    email: 'bob@garymtg.com',
    password: 'password123',
    binderQuery: 'c=u f:modern -t:land',
    wishlistQuery: 'c=b f:modern (r:rare OR r:mythic)',
    binderName: 'Binder Azul',
    binderDesc: 'Control y counterspells',
    wishlistName: 'Wishlist Negras',
    wishlistDesc: 'Cartas negras objetivo',
  },
  {
    username: 'carol',
    email: 'carol@garymtg.com',
    password: 'password123',
    binderQuery: 'c=g f:modern -t:land',
    wishlistQuery: 'c=r f:modern (r:rare OR r:mythic)',
    binderName: 'Binder Verde',
    binderDesc: 'Criaturas y ramp',
    wishlistName: 'Wishlist Rojas',
    wishlistDesc: 'Cartas rojas en la mira',
  },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toCard(c) {
  const img = c.image_uris || c.card_faces?.[0]?.image_uris;
  return {
    id: c.id,
    name: c.name,
    set: String(c.set || '').toUpperCase(),
    collectorNumber: String(c.collector_number || ''),
    rarity: c.rarity,
    type: c.type_line,
    image: img?.normal || null,
    imageLarge: img?.large || null,
    prices: c.prices?.usd
      ? { scryfallUsd: Number(c.prices.usd), cardkingdom: null }
      : null,
    quantity: 1,
  };
}

async function fetchDistinctCards(query, minCount) {
  let url = `https://api.scryfall.com/cards/search?unique=cards&order=name&q=${encodeURIComponent(query)}`;
  const seen = new Set();
  const cards = [];

  while (url && cards.length < minCount) {
    await sleep(120);
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'GaryMTG-Seed/1.0' },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Scryfall ${res.status}: ${text.slice(0, 160)}`);
    }
    const data = await res.json();
    for (const raw of data.data || []) {
      if (seen.has(raw.id)) continue;
      seen.add(raw.id);
      cards.push(toCard(raw));
      if (cards.length >= minCount) break;
    }
    url = data.has_more ? data.next_page : null;
  }

  return cards;
}

async function registerOrLogin(user) {
  let res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: user.username,
      email: user.email,
      password: user.password,
    }),
  });
  if (res.status === 409) {
    res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: user.password }),
    });
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Auth falló para ${user.username}`);
  return data;
}

async function api(token, path, method, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${method} ${path} falló`);
  return data;
}

async function seedUser(user) {
  console.log(`\n→ ${user.username}`);
  const { token, user: profile } = await registerOrLogin(user);
  console.log(`  auth ok (${profile.id})`);

  const binderCards = await fetchDistinctCards(user.binderQuery, 30);
  const wishlistCards = await fetchDistinctCards(user.wishlistQuery, 10);
  console.log(`  cartas binder=${binderCards.length} wishlist=${wishlistCards.length}`);

  // reemplazar binders/wishlists previos de seed si existen (por nombre)
  const { binders } = await api(token, '/binders', 'GET');
  for (const b of binders.filter((x) => x.name === user.binderName)) {
    await api(token, `/binders/${b.id}`, 'DELETE');
  }
  const { wishlists } = await api(token, '/wishlists', 'GET');
  for (const w of wishlists.filter((x) => x.name === user.wishlistName)) {
    await api(token, `/wishlists/${w.id}`, 'DELETE');
  }

  const { binder } = await api(token, '/binders', 'POST', {
    name: user.binderName,
    description: user.binderDesc,
  });
  await api(token, `/binders/${binder.id}`, 'PATCH', {
    name: user.binderName,
    description: user.binderDesc,
    cards: binderCards,
  });

  const { wishlist } = await api(token, '/wishlists', 'POST', {
    name: user.wishlistName,
    description: user.wishlistDesc,
  });
  await api(token, `/wishlists/${wishlist.id}`, 'PATCH', {
    name: user.wishlistName,
    description: user.wishlistDesc,
    cards: wishlistCards,
  });

  return {
    username: user.username,
    email: user.email,
    password: user.password,
    binderCards: binderCards.length,
    wishlistCards: wishlistCards.length,
    binderIds: binderCards.map((c) => c.id),
    wishlistIds: wishlistCards.map((c) => c.id),
  };
}

async function main() {
  const results = [];
  for (const user of USERS) {
    results.push(await seedUser(user));
  }

  // overlap check
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const a = new Set(results[i].binderIds);
      const overlap = results[j].binderIds.filter((id) => a.has(id)).length;
      console.log(`\noverlap binders ${results[i].username}↔${results[j].username}: ${overlap}`);
    }
  }

  console.log('\n=== Usuarios listos ===');
  for (const r of results) {
    console.log(`${r.username} | ${r.email} | ${r.password} | binder ${r.binderCards} | wishlist ${r.wishlistCards}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
