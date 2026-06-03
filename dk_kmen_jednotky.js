/**
 * DK Kmen – Export jednotek
 * Vložit jako skript v Tribal Wars (Nastavení → Skripty)
 * Spouštět na stránce: /game.php?screen=ally&mode=members_troops
 *
 * Označení vesnic:
 *   1/2 off  = 3000–4500 seker  AND  1200–1800 LK  AND  150–200 beranů
 *   fullka   = sekery > 4500  OR  LK > 1800  OR  berany > 200
 *   ostatní  = vše ostatní
 */

(async function() {
  'use strict';

  // ── THRESHOLDS ────────────────────────────────────────────
  const THRESH = {
    axe:  { half_min: 3000, half_max: 4500 },
    lk:   { half_min: 1200, half_max: 1800 },
    ram:  { half_min:  150, half_max:  200 },
  };

  // Mapování názvů sloupců (TW cs) → klíče
  // Pořadí sloupců se může lišit – skript čte header dynamicky
  const COL_MAP = {
    'Kopiník':    'spear',
    'Mečník':     'sword',
    'Sekerník':   'axe',
    'Lučištník':  'archer',
    'Zvěd':       'scout',
    'LK':         'lk',
    'TK':         'tk',
    'Beran':      'ram',
    'Katapult':   'catapult',
    'Šlechtic':   'noble',
    'Paladin':    'paladin',
    // anglické varianty pro jistotu
    'Spear Fighter': 'spear',
    'Swordsman':     'sword',
    'Axeman':        'axe',
    'Archer':        'archer',
    'Scout':         'scout',
    'Light Cavalry': 'lk',
    'Heavy Cavalry': 'tk',
    'Ram':           'ram',
    'Catapult':      'catapult',
    'Nobleman':      'noble',
    'Knight':        'paladin',
  };

  // ── HELPERS ───────────────────────────────────────────────
  function classifyVillage(units) {
    const axe = units.axe  || 0;
    const lk  = units.lk   || 0;
    const ram = units.ram  || 0;

    const isFullka =
      axe > THRESH.axe.half_max ||
      lk  > THRESH.lk.half_max  ||
      ram > THRESH.ram.half_max;

    const isHalf =
      axe >= THRESH.axe.half_min && axe <= THRESH.axe.half_max &&
      lk  >= THRESH.lk.half_min  && lk  <= THRESH.lk.half_max  &&
      ram >= THRESH.ram.half_min  && ram <= THRESH.ram.half_max;

    if (isFullka) return 'fullka';
    if (isHalf)   return 'half_off';
    return 'ostatni';
  }

  function parseNum(str) {
    if (!str) return 0;
    return parseInt(str.replace(/\D/g, ''), 10) || 0;
  }

  function log(msg) {
    console.log(`[DK Export] ${msg}`);
  }

  function showProgress(msg) {
    let box = document.getElementById('dk-export-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'dk-export-box';
      box.style.cssText = `
        position:fixed; top:20px; right:20px; z-index:99999;
        background:#2a1e0e; border:2px solid #d4a84b; border-radius:8px;
        padding:16px 20px; font-family:monospace; font-size:13px;
        color:#e8d5a3; min-width:320px; max-width:420px;
        box-shadow:0 4px 20px rgba(0,0,0,.6);
      `;
      document.body.appendChild(box);
    }
    box.innerHTML = `<b style="color:#f0c96a">⚔️ DK Export jednotek</b><br><br>${msg}`;
  }

  function removeProgress() {
    const box = document.getElementById('dk-export-box');
    if (box) box.remove();
  }

  // ── STEP 1: získat seznam hráčů ───────────────────────────
  showProgress('⌛ Načítám seznam hráčů kmene…');

  const villageId = game_data?.village?.id || location.href.match(/village=(\d+)/)?.[1] || '';
  const baseUrl   = `${location.origin}/game.php?village=${villageId}&screen=ally&mode=members_troops`;

  let mainDoc;
  try {
    const r = await fetch(baseUrl, { credentials: 'include' });
    mainDoc  = new DOMParser().parseFromString(await r.text(), 'text/html');
  } catch(e) {
    showProgress(`❌ Chyba při načítání kmene:<br>${e.message}`);
    return;
  }

  // Hledáme odkazy na player_id v tabulce
  const playerLinks = [...mainDoc.querySelectorAll('a[href*="player_id"]')];
  const playerIds   = [...new Set(
    playerLinks
      .map(a => a.href.match(/player_id=(\d+)/)?.[1])
      .filter(Boolean)
  )];

  if (!playerIds.length) {
    showProgress('❌ Nenalezeni žádní hráči. Spusť skript na stránce Aliance → Přehled vojsk.');
    return;
  }

  log(`Nalezeno ${playerIds.length} hráčů`);
  showProgress(`✓ Nalezeno <b>${playerIds.length} hráčů</b><br>⌛ Načítám detaily vesnic…`);

  // ── STEP 2: pro každého hráče načíst detail vesnic ────────
  const allVillages = [];
  let done = 0;

  for (const pid of playerIds) {
    const url = `${location.origin}/game.php?village=${villageId}&screen=ally&mode=members_troops&player_id=${pid}`;
    try {
      const r    = await fetch(url, { credentials: 'include' });
      const html = await r.text();
      const doc  = new DOMParser().parseFromString(html, 'text/html');

      // Jméno hráče
      const playerName = doc.querySelector('.player-name, #ally_content b, h2')?.textContent?.trim()
        || doc.querySelector(`a[href*="player_id=${pid}"]`)?.textContent?.trim()
        || `Hráč ${pid}`;

      // Najít tabulku s jednotkami
      const tables = [...doc.querySelectorAll('table')];
      const troopTable = tables.find(t =>
        t.innerText?.includes('Sekerník') ||
        t.innerText?.includes('Axeman') ||
        t.innerText?.includes('Beran') ||
        t.innerText?.includes('Ram')
      );

      if (!troopTable) {
        log(`Hráč ${pid}: tabulka jednotek nenalezena`);
        done++;
        showProgress(`✓ <b>${playerIds.length} hráčů</b> | Načteno: <b>${done}/${playerIds.length}</b><br>⌛ Zpracovávám…`);
        continue;
      }

      // Parsovat header → mapování sloupce → klíč
      const headers = [...troopTable.querySelectorAll('thead th, thead td')]
        .map(th => th.textContent.trim());

      // Sloupec 0 = název vesnice, 1 = souřadnice nebo opačně – najdeme dynamicky
      // Sloupec s koordináty poznáme jako "xxx|yyy"
      const colKeys = headers.map(h => COL_MAP[h] || null);

      // Řádky těla tabulky
      const rows = [...troopTable.querySelectorAll('tbody tr')];
      for (const row of rows) {
        const cells = [...row.querySelectorAll('td')].map(td => td.textContent.trim());
        if (cells.length < 3) continue;

        // Najít souřadnice (formát 000|000)
        let coords = null, coordIdx = -1;
        for (let i = 0; i < cells.length; i++) {
          const m = cells[i].match(/(\d+)\|(\d+)/);
          if (m) { coords = { x: +m[1], y: +m[2] }; coordIdx = i; break; }
        }
        if (!coords) continue;

        // Název vesnice – buňka před souřadnicemi nebo ta samá
        const villageName = coordIdx > 0
          ? cells[coordIdx - 1].replace(/\(.*?\)/g,'').trim() || `${coords.x}|${coords.y}`
          : `${coords.x}|${coords.y}`;

        // Parsovat jednotky podle headeru
        const units = {};
        colKeys.forEach((key, i) => {
          if (key && cells[i] !== undefined) {
            units[key] = parseNum(cells[i]);
          }
        });

        const category = classifyVillage(units);
        allVillages.push({
          player_id:   pid,
          player_name: playerName,
          village_name: villageName,
          x: coords.x,
          y: coords.y,
          units,
          category,   // 'half_off' | 'fullka' | 'ostatni'
        });
      }

    } catch(e) {
      log(`Hráč ${pid}: chyba – ${e.message}`);
    }

    done++;
    showProgress(
      `✓ <b>${playerIds.length} hráčů</b> | Načteno: <b>${done}/${playerIds.length}</b><br>` +
      `Vesnic zatím: <b>${allVillages.length}</b><br>⌛ Zpracovávám…`
    );

    // Krátká pauza – nechceme spamovat server
    await new Promise(r => setTimeout(r, 300));
  }

  // ── STEP 3: výstup ────────────────────────────────────────
  const summary = {
    exported_at:  new Date().toISOString(),
    world:        location.hostname.split('.')[0],
    total:        allVillages.length,
    half_off:     allVillages.filter(v => v.category === 'half_off').length,
    fullka:       allVillages.filter(v => v.category === 'fullka').length,
    ostatni:      allVillages.filter(v => v.category === 'ostatni').length,
    thresholds:   THRESH,
    villages:     allVillages,
  };

  const json = JSON.stringify(summary, null, 2);

  try {
    await navigator.clipboard.writeText(json);
    showProgress(
      `✅ <b>Hotovo!</b><br>` +
      `Celkem vesnic: <b>${summary.total}</b><br>` +
      `• 1/2 off: <b>${summary.half_off}</b><br>` +
      `• Fullka: <b>${summary.fullka}</b><br>` +
      `• Ostatní: <b>${summary.ostatni}</b><br><br>` +
      `<span style="color:#7ec87e">✓ JSON zkopírován do schránky</span><br>` +
      `<button onclick="document.getElementById('dk-export-box').remove()" ` +
      `style="margin-top:10px;padding:4px 12px;background:#3d2a0a;border:1px solid #d4a84b;` +
      `color:#e8d5a3;cursor:pointer;border-radius:4px;">Zavřít</button>`
    );
  } catch(e) {
    // Fallback – otevřít v novém okně
    const w = window.open('', '_blank');
    w.document.write(`<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;">${json}</pre>`);
    showProgress(
      `✅ <b>Hotovo!</b> (schránka nedostupná – otevřeno v novém okně)<br>` +
      `Celkem: <b>${summary.total}</b> | 1/2 off: <b>${summary.half_off}</b> | Fullka: <b>${summary.fullka}</b>`
    );
  }

  log(`Export dokončen. ${summary.total} vesnic.`);
})();
