javascript:
// ── DK Export jednotek ──────────────────────────────────────
// Spustit na stránce: Kmen → Členové (nebo Vojenské jednotky)
// Přesměruje na správnou stránku pokud je potřeba.

if (window.location.href.indexOf('screen=ally&mode=members_troops') > -1 ||
    window.location.href.indexOf('screen=ally&mode=members') < 0) {
    window.location.assign(game_data.link_base_pure + 'ally&mode=members');
}

// ── THRESHOLDS ─────────────────────────────────────────────
var THRESH = {
    axe: { half_min: 3000, half_max: 4500 },
    lk:  { half_min: 1200, half_max: 1800 },
    ram: { half_min:  150, half_max:  200 }
};

// Mapování TW interních názvů → naše klíče
var UNIT_MAP = {
    spear: 'spear', sword: 'sword', axe: 'axe', archer: 'archer',
    spy: 'scout', light: 'lk', marcher: 'archer2', heavy: 'tk',
    ram: 'ram', catapult: 'catapult', snob: 'noble', knight: 'paladin'
};

// ── UI ─────────────────────────────────────────────────────
$('.dk-export-box').remove();
var $box = $('<div class="dk-export-box"></div>').css({
    position: 'fixed', top: '20px', right: '20px', zIndex: 99999,
    background: '#2a1e0e', border: '2px solid #d4a84b', borderRadius: '8px',
    padding: '16px 20px', fontFamily: 'monospace', fontSize: '13px',
    color: '#e8d5a3', minWidth: '320px', maxWidth: '420px',
    boxShadow: '0 4px 20px rgba(0,0,0,.6)'
});
$('body').append($box);

function showProgress(msg) {
    $box.html('<b style="color:#f0c96a">⚔️ DK Export jednotek</b><br><br>' + msg);
}

function classifyVillage(units) {
    var axe = units.axe || 0;
    var lk  = units.lk  || 0;
    var ram = units.ram  || 0;

    if (axe > THRESH.axe.half_max || lk > THRESH.lk.half_max || ram > THRESH.ram.half_max)
        return 'fullka';
    if (axe >= THRESH.axe.half_min && axe <= THRESH.axe.half_max &&
        lk  >= THRESH.lk.half_min  && lk  <= THRESH.lk.half_max  &&
        ram >= THRESH.ram.half_min  && ram <= THRESH.ram.half_max)
        return 'half_off';
    return 'ostatni';
}

// ── SBÍRÁNÍ HRÁČŮ ─────────────────────────────────────────
var baseURL    = 'game.php?screen=ally&mode=members_troops&player_id=';
var playerURLs = [];
var players    = [];

$('input:radio[name=player]').each(function() {
    var pid  = $(this).attr('value');
    var name = $(this).parent().text().trim();
    playerURLs.push(baseURL + pid);
    players.push({ id: pid, name: name });
});

if (!players.length) {
    showProgress('❌ Nenalezeni žádní hráči.<br>Spusť skript na stránce <b>Kmen → Členové</b>.');
    return;
}

showProgress('✓ Nalezeno <b>' + players.length + ' hráčů</b><br>⌛ Načítám vesnice…');

// ── PROGRESS BAR ───────────────────────────────────────────
$('#dk-progressbar').remove();
var $bar = $('<div id="dk-progressbar" style="width:100%;background:#1a1208;border-bottom:2px solid #6b4f2a;">' +
    '<div id="dk-progress" style="width:0%;height:8px;background:#d4a84b;transition:width .3s;"></div></div>');
$('body').prepend($bar);

function setProgress(done, total) {
    $('#dk-progress').css('width', (done / total * 100) + '%');
}

// ── GETALL (jQuery style, jako Shinko skript) ──────────────
$.getAll = function(urls, onLoad, onDone, onError) {
    var numDone = 0;
    var lastReq = 0;
    var minWait = 250;
    loadNext();
    function loadNext() {
        if (numDone === urls.length) { onDone(); return; }
        var now = Date.now();
        var elapsed = now - lastReq;
        if (elapsed < minWait) { setTimeout(loadNext, minWait - elapsed); return; }
        lastReq = now;
        $.get(urls[numDone])
            .done(function(data) {
                try { onLoad(numDone, data); numDone++; loadNext(); }
                catch(e) { onError(e); }
            })
            .fail(function(xhr) { onError(xhr); });
    }
};

// ── HLAVNÍ LOGIKA ─────────────────────────────────────────
var allVillages = [];

$.getAll(
    playerURLs,
    function(i, data) {
        setProgress(i + 1, players.length);
        var playerName = players[i].name;

        // Řádky vesnic – stejný selektor jako Shinko skript
        var rows;
        if ($(data).find('.paged-nav-item').length === 0) {
            rows = $(data).find('.vis.w100 tr').not(':first');
        } else {
            rows = $(data).find('.vis.w100 tr').not(':first').not(':first').not(':last');
        }

        // Extra stránky pokud jich má hráč víc
        var extraPages = [];
        for (var p = 0; p < $(data).find('.paged-nav-item').length / 2; p++) {
            extraPages.push($(data).find('.paged-nav-item').eq(p).attr('href'));
        }

        $.getAll(extraPages,
            function(p, moreData) {
                if ($(moreData).find('.paged-nav-item').length === 0) {
                    rows = $.merge(rows, $(moreData).find('.vis.w100 tr').not(':first'));
                } else {
                    rows = $.merge(rows, $(moreData).find('.vis.w100 tr').not(':first').not(':first').not(':last'));
                }
            },
            function() {
                // Zpracovat řádky vesnic
                $.each(rows, function(rowNr) {
                    var $row = rows.eq(rowNr);
                    var link = $row.find('a').first();
                    if (!link.length) return;

                    // Souřadnice z textu odkazu (formát "NázevVesnice (xxx|yyy)")
                    var linkText = link.text().trim();
                    var coordMatch = linkText.match(/\((\d+)\|(\d+)\)/) || link.attr('href').match(/x=(\d+).*y=(\d+)/);
                    if (!coordMatch) return;
                    var x = +coordMatch[1], y = +coordMatch[2];
                    var villageName = linkText.replace(/\s*\(\d+\|\d+\)/, '').trim() || (x + '|' + y);

                    // Jednotky – stejné pořadí jako game_data.units
                    var units = {};
                    $.each(game_data.units, function(idx) {
                        var twName  = game_data.units[idx];
                        var ourKey  = UNIT_MAP[twName] || twName;
                        var cellTxt = $row.children().not(':first').eq(idx).text().trim();
                        units[ourKey] = cellTxt === '?' ? 0 : (parseInt(cellTxt) || 0);
                    });

                    allVillages.push({
                        player_name:  playerName,
                        village_name: villageName,
                        x: x, y: y,
                        units: units,
                        category: classifyVillage(units)
                    });
                });

                showProgress(
                    '✓ <b>' + players.length + ' hráčů</b> | Načteno: <b>' + (i+1) + '/' + players.length + '</b><br>' +
                    'Vesnic zatím: <b>' + allVillages.length + '</b><br>⌛ Zpracovávám…'
                );
            },
            function(e) { console.error('Stránka hráče chyba:', e); }
        );
    },
    function() {
        // ── VÝSTUP ────────────────────────────────────────
        $('#dk-progressbar').remove();

        var summary = {
            exported_at: new Date().toISOString(),
            world:       location.hostname.split('.')[0],
            total:       allVillages.length,
            half_off:    allVillages.filter(function(v){ return v.category==='half_off'; }).length,
            fullka:      allVillages.filter(function(v){ return v.category==='fullka'; }).length,
            ostatni:     allVillages.filter(function(v){ return v.category==='ostatni'; }).length,
            thresholds:  THRESH,
            villages:    allVillages
        };

        var json = JSON.stringify(summary, null, 2);

        if (navigator.clipboard) {
            navigator.clipboard.writeText(json).then(function() {
                showProgress(
                    '✅ <b>Hotovo!</b><br>' +
                    'Celkem vesnic: <b>' + summary.total + '</b><br>' +
                    '• 1/2 off: <b>' + summary.half_off + '</b><br>' +
                    '• Fullka: <b>' + summary.fullka + '</b><br>' +
                    '• Ostatní: <b>' + summary.ostatni + '</b><br><br>' +
                    '<span style="color:#7ec87e">✓ JSON zkopírován do schránky</span><br>' +
                    '<button onclick="$(\'.dk-export-box\').remove()" ' +
                    'style="margin-top:10px;padding:4px 12px;background:#3d2a0a;border:1px solid #d4a84b;color:#e8d5a3;cursor:pointer;border-radius:4px;">Zavřít</button>'
                );
            });
        } else {
            var w = window.open('', '_blank');
            w.document.write('<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;">' + json + '</pre>');
            showProgress('✅ <b>Hotovo!</b> JSON otevřen v novém okně.<br>Celkem: <b>' + summary.total + '</b>');
        }
    },
    function(e) {
        console.error('Chyba:', e);
        showProgress('❌ Chyba při načítání: ' + e.statusText);
    }
);
