javascript:(function(){

// ── DK Export vlastních jednotek ────────────────────────────
// Spustit na stránce: Přehled → Vesnice → Jednotky
// URL: game.php?screen=overview_villages&type=complete&mode=units&group=0
// Pokud jsi na jiné stránce, přesměruje automaticky.

var targetURL = 'screen=overview_villages&mode=units';
if (window.location.href.indexOf(targetURL) === -1) {
    if (typeof game_data !== 'undefined') {
        window.location.assign(game_data.link_base_pure + 'overview_villages&type=complete&mode=units&group=0');
    } else {
        alert('Spusť tento bookmarklet na stránce Divokých kmenů (Přehled → Vesnice → Jednotky).');
    }
    return;
}

// ── THRESHOLDS (stejné jako kmenový export) ─────────────────
var UNIT_POP = {
    spear: 1, sword: 1, axe: 1, archer: 1,
    scout: 2, lk: 4, archer2: 5, tk: 6,
    ram: 5, catapult: 8, noble: 100, paladin: 10
};
var THRESH = { axe_min: 1000, half: 10000, triq: 15000, full: 18000 };

// ── UI BOX ──────────────────────────────────────────────────
var existing = document.getElementById('dk-hrac-box');
if (existing) existing.remove();

var box = document.createElement('div');
box.id = 'dk-hrac-box';
box.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;background:#2a1e0e;border:2px solid #d4a84b;border-radius:8px;padding:16px 20px;font-family:monospace;font-size:13px;color:#e8d5a3;min-width:300px;max-width:420px;box-shadow:0 4px 20px rgba(0,0,0,.6);';
document.body.appendChild(box);

function show(msg) { box.innerHTML = '<b style="color:#f0c96a">⚔️ DK Export jednotek</b><br><br>' + msg; }
show('⌛ Načítám tabulku…');

// ── MAPOVÁNÍ SLOUPCŮ ────────────────────────────────────────
// Stránka overview_villages má v záhlaví obrázky jednotek
var IMG_TO_KEY = {
    'unit_spear':    'spear',
    'unit_sword':    'sword',
    'unit_axe':      'axe',
    'unit_archer':   'archer',
    'unit_spy':      'scout',
    'unit_light':    'lk',
    'unit_marcher':  'archer2',
    'unit_heavy':    'tk',
    'unit_ram':      'ram',
    'unit_catapult': 'catapult',
    'unit_snob':     'noble',
    'unit_knight':   'paladin',
    'unit_militia':  'militia'
};

// ── PARSOVÁNÍ ───────────────────────────────────────────────
// Najdi hlavní tabulku s jednotkami
// Na overview_villages má tabulka class "vis"
var tables = document.querySelectorAll('table.vis');
var unitTable = null;

// Najdi tu tabulku která má v záhlaví obrázky jednotek
for (var t = 0; t < tables.length; t++) {
    var headerImgs = tables[t].querySelectorAll('thead img, tr:first-child img');
    var hasUnits = false;
    headerImgs.forEach(function(img) {
        var src = img.src || '';
        if (src.indexOf('unit_') > -1) hasUnits = true;
    });
    if (hasUnits) { unitTable = tables[t]; break; }
}

if (!unitTable) {
    show('❌ Tabulka jednotek nenalezena.<br>Jsi na stránce <b>Přehled → Vesnice → Jednotky</b>?<br><small style="color:#cc8040">Zkus: Přehled → Vesnice → záložka Jednotky</small>');
    return;
}

// Přečti pořadí sloupců z hlavičky
var colMap = []; // {key, colIdx}
var headerRow = unitTable.querySelector('thead tr, tr:first-child');
if (headerRow) {
    var cells = headerRow.children;
    for (var c = 0; c < cells.length; c++) {
        var img = cells[c].querySelector('img');
        if (!img) continue;
        var src = img.src || img.getAttribute('src') || '';
        var m = src.match(/unit_(spear|sword|axe|archer|spy|light|marcher|heavy|ram|catapult|snob|knight|militia)/);
        if (m) {
            var key = IMG_TO_KEY['unit_' + m[1]] || m[1];
            colMap.push({ key: key, colIdx: c });
        }
    }
}

if (!colMap.length) {
    show('❌ Nepodařilo se přečíst záhlaví tabulky.<br><small>Zkontroluj že jsi na správné stránce.</small>');
    return;
}

// Přečti řádky vesnic
var rows = unitTable.querySelectorAll('tbody tr');
if (!rows.length) {
    // Fallback – zkus všechny řádky mimo první
    var allRows = unitTable.querySelectorAll('tr');
    rows = Array.prototype.slice.call(allRows, 1);
}

var villages = [];
var playerName = '';

// Pokus o získání jména hráče z game_data nebo stránky
try {
    if (typeof game_data !== 'undefined' && game_data.player && game_data.player.name) {
        playerName = game_data.player.name;
    } else {
        var profileLink = document.querySelector('a[href*="screen=info_player"]');
        if (profileLink) playerName = profileLink.textContent.trim();
    }
} catch(e) {}

rows.forEach(function(row) {
    // Přeskoč řádky bez odkazu na vesnici
    var link = row.querySelector('a[href*="village="], a[href*="screen=info_village"]');
    if (!link) return;

    // Souřadnice z textu nebo href
    var linkText = link.textContent.trim();
    var coordMatch = linkText.match(/\((\d+)\|(\d+)\)/) ||
                     (link.href || '').match(/x=(\d+).*?y=(\d+)/) ||
                     (link.href || '').match(/y=(\d+).*?x=(\d+)/);

    // Alternativa: souřadnice v separátním elementu
    if (!coordMatch) {
        var coordEl = row.querySelector('.village-anchor, [class*="coord"]');
        if (coordEl) coordMatch = coordEl.textContent.match(/\((\d+)\|(\d+)\)/);
    }

    var x, y, villageName, villageId;

    if (coordMatch) {
        x = +coordMatch[1]; y = +coordMatch[2];
    } else {
        // Zkus najít souřadnice v celém textu řádku
        var rowText = row.textContent;
        var m2 = rowText.match(/\((\d+)\|(\d+)\)/);
        if (!m2) return; // nelze určit souřadnice
        x = +m2[1]; y = +m2[2];
    }

    // Název vesnice
    villageName = linkText.replace(/\s*\(\d+\|\d+\).*/, '').trim() || (x + '|' + y);

    // ID vesnice z href
    var idMatch = (link.href || '').match(/village=(\d+)/);
    villageId = idMatch ? idMatch[1] : null;

    // Jednotky z buněk dle colMap
    var cells = row.children;
    var units = {};
    colMap.forEach(function(col) {
        var cell = cells[col.colIdx];
        if (!cell) return;
        var txt = cell.textContent.trim().replace(/[^\d]/g, '');
        units[col.key] = txt ? (parseInt(txt) || 0) : 0;
    });

    // Klasifikace vesnice
    var offPop = 0;
    ['axe','lk','tk','ram','catapult','archer2'].forEach(function(k) {
        offPop += (units[k]||0) * (UNIT_POP[k]||0);
    });
    var axe = units.axe || 0;
    var noble = units.noble || 0;

    var category = null;
    if (axe >= THRESH.axe_min) {
        if      (offPop >= THRESH.full) category = 'fullka';
        else if (offPop >= THRESH.triq) category = 'triq_off';
        else if (offPop >= THRESH.half) category = 'half_off';
        else                            category = 'mini_off';
    } else {
        category = 'def'; // obranná / neurčená
    }

    villages.push({
        village_name: villageName,
        village_id: villageId,
        x: x, y: y,
        player_name: playerName,
        units: units,
        category: category,
        noble: noble,
        off_pop: offPop
    });
});

if (!villages.length) {
    show('❌ Žádné vesnice nenalezeny.<br><small>Zkontroluj že tabulka obsahuje data.</small>');
    return;
}

// ── SUMMARY ─────────────────────────────────────────────────
var summary = {
    exported_at: new Date().toISOString(),
    world: location.hostname.split('.')[0],
    player_name: playerName,
    total: villages.length,
    fullka:   villages.filter(function(v){ return v.category==='fullka';   }).length,
    triq_off: villages.filter(function(v){ return v.category==='triq_off'; }).length,
    half_off: villages.filter(function(v){ return v.category==='half_off'; }).length,
    mini_off: villages.filter(function(v){ return v.category==='mini_off'; }).length,
    nobles:   villages.filter(function(v){ return v.noble > 0; }).length,
    villages: villages
};

var json = JSON.stringify(summary, null, 2);

function doShow(copied) {
    show(
        '✅ <b>Hotovo!</b><br>' +
        'Vesnic celkem: <b>' + summary.total + '</b><br>' +
        '• Fullka: <b>' + summary.fullka + '</b><br>' +
        '• 3/4 off: <b>' + summary.triq_off + '</b><br>' +
        '• 1/2 off: <b>' + summary.half_off + '</b><br>' +
        '• Mini off: <b>' + summary.mini_off + '</b><br>' +
        '• Se šlechtici: <b>' + summary.nobles + '</b><br><br>' +
        (copied
            ? '<span style="color:#7ec87e">✓ JSON zkopírován do schránky</span>'
            : '<span style="color:#cc8040">⚠ Nelze zkopírovat – otevřeno v novém okně</span>') +
        '<br><button onclick="document.getElementById(\'dk-hrac-box\').remove()" ' +
        'style="margin-top:10px;padding:4px 12px;background:#3d2a0a;border:1px solid #d4a84b;color:#e8d5a3;cursor:pointer;border-radius:4px;">Zavřít</button>'
    );
}

if (navigator.clipboard) {
    navigator.clipboard.writeText(json).then(function() {
        doShow(true);
    }).catch(function() {
        var w = window.open('', '_blank');
        w.document.write('<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;">' + json + '</pre>');
        doShow(false);
    });
} else {
    var w = window.open('', '_blank');
    w.document.write('<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;">' + json + '</pre>');
    doShow(false);
}

})();
