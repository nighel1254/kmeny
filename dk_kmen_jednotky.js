javascript:(function(){

// ── DK Export jednotek ──────────────────────────────────────
// Spustit na stránce: Kmen → Členové
// Pokud jsi na jiné stránce, přesměruje tě automaticky.

if (window.location.href.indexOf('screen=ally&mode=members_troops') > -1 ||
    window.location.href.indexOf('screen=ally&mode=members') < 0) {
    window.location.assign(game_data.link_base_pure + 'ally&mode=members');
    return;
}

// ── THRESHOLDS ─────────────────────────────────────────────
// Klasifikace podle seker:
//   minioff  = < 3000
//   half_off = 3000–4499
//   triq_off = 4500–4999
//   fullka   = 5000+
var THRESH = {
    axe: { mini: 3000, half: 4500, triq: 5000 }
};

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
    if (axe >= THRESH.axe.triq) return 'fullka';
    if (axe >= THRESH.axe.half) return 'triq_off';
    if (axe >= THRESH.axe.mini) return 'half_off';
    return 'minioff';
}

// ── SBÍRÁNÍ HRÁČŮ ─────────────────────────────────────────
var baseURL    = 'game.php?screen=ally&mode=members_troops&player_id=';
var playerURLs = [];
var players    = [];

$('input:radio[name=player]').each(function() {
    playerURLs.push(baseURL + $(this).attr('value'));
    players.push({ id: $(this).attr('value'), name: $(this).parent().text().trim() });
});

if (!players.length) {
    showProgress('❌ Nenalezeni žádní hráči.<br>Jsi na stránce <b>Kmen → Členové</b>?');
    return;
}

showProgress('✓ Nalezeno <b>' + players.length + ' hráčů</b><br>⌛ Načítám vesnice…');

// ── PROGRESS BAR ───────────────────────────────────────────
$('#dk-progressbar').remove();
$('body').prepend('<div id="dk-progressbar" style="position:fixed;top:0;left:0;width:100%;z-index:99998;background:#1a1208;">' +
    '<div id="dk-progress" style="width:0%;height:6px;background:#d4a84b;transition:width .3s;"></div></div>');

function setProgress(done, total) {
    $('#dk-progress').css('width', (done / total * 100) + '%');
}

// ── GETALL ─────────────────────────────────────────────────
$.getAll = function(urls, onLoad, onDone, onError) {
    var numDone = 0, lastReq = 0, minWait = 250;
    if (!urls.length) { onDone(); return; }
    loadNext();
    function loadNext() {
        if (numDone === urls.length) { onDone(); return; }
        var elapsed = Date.now() - lastReq;
        if (elapsed < minWait) { setTimeout(loadNext, minWait - elapsed); return; }
        lastReq = Date.now();
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
var processed   = 0;

$.getAll(
    playerURLs,
    function(i, data) {
        setProgress(i + 1, players.length);
        var playerName = players[i].name;

        var rows;
        if ($(data).find('.paged-nav-item').length === 0) {
            rows = $(data).find('.vis.w100 tr').not(':first');
        } else {
            rows = $(data).find('.vis.w100 tr').not(':first').not(':last');
        }

        var extraPages = [];
        for (var p = 0; p < $(data).find('.paged-nav-item').length / 2; p++) {
            extraPages.push($(data).find('.paged-nav-item').eq(p).attr('href'));
        }

        $.getAll(extraPages,
            function(p, moreData) {
                var moreRows = $(moreData).find('.paged-nav-item').length === 0
                    ? $(moreData).find('.vis.w100 tr').not(':first')
                    : $(moreData).find('.vis.w100 tr').not(':first').not(':last');
                rows = $.merge(rows, moreRows);
            },
            function() {
                $.each(rows, function(rowNr) {
                    var $row = rows.eq(rowNr);
                    var $link = $row.find('a').first();
                    if (!$link.length) return;

                    var linkText   = $link.text().trim();
                    var coordMatch = linkText.match(/\((\d+)\|(\d+)\)/);
                    if (!coordMatch) {
                        // zkus href
                        var href = $link.attr('href') || '';
                        coordMatch = href.match(/x=(\d+).*?y=(\d+)/) || href.match(/y=(\d+).*?x=(\d+)/);
                        if (!coordMatch) return;
                    }
                    var x = +coordMatch[1], y = +coordMatch[2];
                    var villageName = linkText.replace(/\s*\(\d+\|\d+\)/, '').trim() || (x + '|' + y);

                    var units = {};
                    $.each(game_data.units, function(idx) {
                        var twName = game_data.units[idx];
                        var ourKey = UNIT_MAP[twName] || twName;
                        var txt    = $row.children().not(':first').eq(idx).text().trim();
                        units[ourKey] = (txt === '?' || txt === '') ? 0 : (parseInt(txt) || 0);
                    });

                    allVillages.push({
                        player_name:  playerName,
                        village_name: villageName,
                        x: x, y: y,
                        units:    units,
                        category: classifyVillage(units)
                    });
                });

                processed++;
                showProgress(
                    '✓ <b>' + players.length + ' hráčů</b> | Zpracováno: <b>' + processed + '/' + players.length + '</b><br>' +
                    'Vesnic: <b>' + allVillages.length + '</b><br>⌛ Načítám…'
                );
            },
            function(e) { console.error('Chyba stránky:', e); processed++; }
        );
    },
    function() {
        $('#dk-progressbar').remove();
        var summary = {
            exported_at: new Date().toISOString(),
            world:       location.hostname.split('.')[0],
            total:       allVillages.length,
            minioff:     allVillages.filter(function(v){ return v.category==='minioff'; }).length,
            half_off:    allVillages.filter(function(v){ return v.category==='half_off'; }).length,
            triq_off:    allVillages.filter(function(v){ return v.category==='triq_off'; }).length,
            fullka:      allVillages.filter(function(v){ return v.category==='fullka'; }).length,
            thresholds:  THRESH,
            villages:    allVillages
        };

        var json = JSON.stringify(summary, null, 2);

        if (navigator.clipboard) {
            navigator.clipboard.writeText(json).then(function() {
                showProgress(
                    '✅ <b>Hotovo!</b><br>' +
                    'Celkem vesnic: <b>' + summary.total + '</b><br>' +
                    '• Mini off: <b>' + summary.minioff + '</b><br>' +
                    '• 1/2 off: <b>' + summary.half_off + '</b><br>' +
                    '• 3/4 off: <b>' + summary.triq_off + '</b><br>' +
                    '• Fullka: <b>' + summary.fullka + '</b><br><br>' +
                    '<span style="color:#7ec87e">✓ JSON zkopírován do schránky</span><br>' +
                    '<button onclick="$(\'.dk-export-box,#dk-progressbar\').remove()" ' +
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
        $('#dk-progressbar').remove();
        console.error('Chyba:', e);
        showProgress('❌ Chyba při načítání dat.');
    }
);

})();
