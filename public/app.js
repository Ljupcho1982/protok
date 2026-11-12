// Проток dashboard. The engine runs in a worker; this file only draws.
import { ZONES, ZONE_MAX, SLA, DAY_START, DAY_END, SLOT, NSLOT, slotStart, hhmm, cityEn } from '/engine/day.mjs'

// ---------------------------------------------------------------- text
const T = {
  mk: {
    skip: 'Прескокни до содржината', tagline: 'Агенти за безбедносна контрола', 'tab.ops': 'Операции', 'tab.bench': 'Споредба', 'tab.how': 'Како работи',
    play: 'Пушти', pause: 'Пауза', step: 'Следни 15 мин', reset: 'Од почеток', theme: 'Светла или темна тема', simTime: 'симулирано време', endDay: 'крај на денот',
    simnote: 'Сите летови, патници и настани се измислени. Симулација, не е поврзано со вистински аеродром.',
    map: 'Терминал сега', mapHint: 'Кликни зона за детали', alerts: 'Известувања до персоналот', board: 'Заминувања', feed: 'Фид во живо', bus: 'Што си кажуваат агентите',
    'kpi.queue': 'Во редица сега', 'kpi.mean': 'Просечно чекање', 'kpi.over': 'Чекале над 10 мин', 'kpi.missed': 'Ризик за качување', 'kpi.alerts': 'Известувања',
    pax: 'пат.', min: 'мин', roster: 'без агент', reserves: 'резерви',
    zone: 'Зона', zdesc: { A: 'Шенген · излези A1–A9', B: 'Шенген · излези B1–B8', C: 'Вон Шенген · C1–C4' },
    inQueue: 'во редица', longest: 'најдолго', p90next: 'P90 1 час', ok: 'во рамки', watch: 'внимание', breach: 'над целта',
    noQueue: 'нема редица',
    detail: z => `Зона ${z}: чекање и линии`, r6: '±3 ч', rday: 'цел ден',
    'lg.real': 'вистинско чекање', 'lg.shadow': 'истиот ден без агент', 'lg.fc': 'прогноза P10–P90', 'lg.p50': 'P50', 'lg.sla': 'цел 10 мин', 'lg.lanes': 'линии', 'lg.extra': 'тим од агентот', 'lg.roster': 'распоред',
    tip: { real: 'вистинско', shadow: 'без агент', fc: 'прогноза P50', band: 'P10–P90', lanes: 'линии', roster: 'распоред', pax: 'патници' },
    noAlerts: 'Уште нема известувања. Агентот реагира кога прогнозата ќе ја пробие целта од 10 минути.',
    'st.sent': 'испратено', 'st.ack': 'потврдено', kmove: 'префрлање', kres: 'резерва', R: 'Резерва',
    move: a => `Префрлете 1 тим (2 службеници) од Зона ${a.from} во Зона ${a.to}`,
    reserve: a => `Повикајте резервен тим во Зона ${a.to}`,
    before: 'пред', after: 'после',
    why: (pb, pa) => `Ризик над 10 мин <span class="num">${pb}% → ${pa}%</span>.`,
    donor: (z, p) => ` Зона ${z} останува на P90 <span class="num">${p}</span> мин.`,
    gain: g => ` Заштеда околу <span class="num">${g}</span> мин чекање.`,
    load: 'Кој ја полни редицата', staffOut: 'отсутен тим',
    gatePass: (n, m) => `порта ${n}/${m}`,
    inMv: (a) => a.kind === 'reserve' ? `+1 резерва <b>${hhmm(a.effective)}–${hhmm(a.until)}</b>` : `+1 тим од ${a.from} <b>${hhmm(a.effective)}–${hhmm(a.until)}</b>`,
    outMv: (a) => `−1 тим → ${a.to} <b>${hhmm(a.effective)}–${hhmm(a.until)}</b>`,
    th: ['Време', 'Лет', 'За', 'Зона', 'Пат.', 'Статус'],
    'fs.late': x => `доцни ${x}`, 'fs.cancel': 'откажан', 'fs.gate': 'нов излез', 'fs.new': 'нов лет', 'fs.swap': 'поголем авион', 'fs.board': 'качување', 'fs.gone': 'заминал', 'fs.ok': 'навреме',
    noFeed: 'Сè е по распоред.',
    ev: {
      gate: (e, f) => `${e.flight} (${f?.dest || ''}) се префрла во Зона ${e.zone}${f?.base ? ` од Зона ${f.base.zone}` : ''}.`,
      swap: e => `${e.flight}: поголем авион, ${e.pax} патници.`,
      add: e => `Нов лет ${e.flight.id} за ${e.flight.dest} во ${hhmm(e.flight.std)}, ${e.flight.pax} патници, Зона ${e.flight.zone}.`,
      delay: e => `${e.flight} доцни, ново време ${hhmm(e.std)}.`,
      cancel: e => `${e.flight} е откажан.`,
      staff: e => `Зона ${e.zone}: еден тим отсутен ${hhmm(slotStart(e.from))}–${hhmm(slotStart(e.to))}.`
    },
    who: { feed: 'Фид', sim: 'Симулации', log: 'Логистика', gate: 'Порта', staff: 'Персонал' },
    filters: { all: 'Сите', sim: 'Симулации', log: 'Логистика', gate: 'Порта', staff: 'Персонал', feed: 'Фид' },
    m: {
      ask: x => `→ Симулации: прогноза за следните <b>${x.horizon} мин</b>, ${x.runs} можни иднини`,
      forecast: x => `→ Логистика: ${x.runs} иднини, ~${x.pax} патници за <b>${x.ms} ms</b>` + (x.hot.length ? `. Жешки точки: ${x.hot.map(h => `<b>${h.zone} ${hhmm(slotStart(h.s))}</b> (P90 ${h.p90.toFixed(1)})`).join(', ')}` : '. Нема жешки точки.'),
      correlate: x => `Зона ${x.zone} ${hhmm(slotStart(x.s))} ← ` + x.corr.flights.slice(0, 3).map(f => `<b>${f.id}</b> ${Math.round(f.share * 100)}%${f.events.length ? ' (' + f.events.map(e => T.mk.evShort[e]).join(', ') + ')' : ''}`).join(', ') + (x.corr.staff ? `, ${T.mk.staffOut}` : ''),
      whatif: x => `→ Симулации: <b>${x.n}</b> „што ако“ за ${x.ms} ms; ${x.rejected} ги запре портата, ${x.unsafe} би ја скршиле друга зона`,
      hold: x => `Зона ${x.zone} ${hhmm(slotStart(x.s))}: нема потег што вреди (${Math.round(x.gain)} мин), чекам`,
      pass: x => `→ Логистика: <b>${x.id}</b> ги помина сите ${x.checks} правила`,
      alert: x => `<b>${x.id}</b> испратено до тимовите`,
      event: (x, txt) => txt
    },
    evShort: { gate: 'нов излез', delay: 'доцни', swap: 'поголем авион', add: 'нов лет', cancel: 'откажан' },
    rules: { zones: 'Важечки зони', notice: 'Најава најмалку 15 мин', stay: 'Престој 45–180 мин', donorMin: 'Донорот задржува минимум', targetMax: 'Не над физичките линии', pool: 'Во рамки на персоналот', pingpong: 'Без враќање напред-назад', reserve: 'Најмногу 2 резерви' },
    s: {
      start: ['Денот почнува во 04:00.', 'Првата промена во фидот доаѓа во 06:15. Притисни Пушти или кликни на временската линија за да скокнеш.'],
      act: (a, txt) => [`Агентот испрати ${a}.`, txt],
      warn: (z, tm, p) => [`Внимание: Зона ${z} може да ја пробие целта околу ${tm}.`, `P90 ${p} мин. Агентот нема потег што вреди или веќе ги искористил.`],
      event: txt => [txt, 'Агентите ја проверија прогнозата. Нема потреба од промена.'],
      ok: ['Сите зони се во рамки.', 'Нема жешки точки во следните 3 часа.'],
      done: (a, b) => [`Крај на денот. Над 10 мин чекале ${a} патници, без агент би биле ${b}.`, 'Кликни на временската линија за да се вратиш назад или почни од почеток.'],
      restart: 'Од почеток'
    },
    jumpTo: x => `Скокни на ${x}`, jumping: x => `Симулирам до ${x}…`, future: 'иднината уште не е позната',
    newAlerts: n => `${n} нови известувања`,
    'bench.h': 'Со агент и без агент, на исти денови',
    'bench.p': 'Секој ден е нов скриен примерок на патници (ист распоред, ист фид). Истиот ден се игра двапати: со распоредот од минатата недела и со агентите. Разликата е само агентот. Со 60 иднини по чекор, еден ден трае неколку секунди.',
    'bench.run': 'Пушти споредба', 'bench.again': 'Пушти пак', days: 'дена', running: (a, b) => `${a} од ${b} дена`,
    'b.th': ['Ден', 'Чекање', 'без агент', 'Над 10 мин', 'без агент', 'Ризик', 'без агент', 'Известувања', 'P10–P90'],
    'b.sum': 'Вкупно', 'b.chart': 'Патници над 10 мин по ден', 'b.agent': 'со агент', 'b.none': 'без агент', 'b.empty': 'Избери колку дена и пушти. Резултатите се појавуваат ден по ден.',
    'b.k1': 'Просечно чекање', 'b.k2': 'Патници над 10 мин', 'b.k3': 'Ризик за качување', 'b.k4': 'Најдолго чекање',
    calib: c => `Прогнозата издадена еден час однапред: вистинското просечно чекање паднало во опсегот P10–P90 во <b>${Math.round(c * 100)}%</b> од случаите. Целта е 80%, па прогнозата е малку премногу самоуверена.`,
    keys: 'Кратенки'
  },
  en: {
    skip: 'Skip to content', tagline: 'Agents for security screening', 'tab.ops': 'Operations', 'tab.bench': 'Compare', 'tab.how': 'How it works',
    play: 'Play', pause: 'Pause', step: 'Next 15 min', reset: 'Restart', theme: 'Light or dark theme', simTime: 'simulated time', endDay: 'end of day',
    simnote: 'Every flight, passenger and event is invented. A simulation, not connected to a real airport.',
    map: 'Terminal now', mapHint: 'Click a zone for details', alerts: 'Staff notifications', board: 'Departures', feed: 'Live feed', bus: 'What the agents tell each other',
    'kpi.queue': 'In queue now', 'kpi.mean': 'Average wait', 'kpi.over': 'Waited over 10 min', 'kpi.missed': 'Boarding at risk', 'kpi.alerts': 'Notifications',
    pax: 'pax', min: 'min', roster: 'no agent', reserves: 'reserves',
    zone: 'Zone', zdesc: { A: 'Schengen · gates A1–A9', B: 'Schengen · gates B1–B8', C: 'Non-Schengen · C1–C4' },
    inQueue: 'in queue', longest: 'longest', p90next: 'P90 1 hour', ok: 'on target', watch: 'watch', breach: 'over target',
    noQueue: 'no queue',
    detail: z => `Zone ${z}: wait and lanes`, r6: '±3 h', rday: 'whole day',
    'lg.real': 'real wait', 'lg.shadow': 'same day, no agent', 'lg.fc': 'forecast P10–P90', 'lg.p50': 'P50', 'lg.sla': '10 min target', 'lg.lanes': 'lanes', 'lg.extra': 'team from the agent', 'lg.roster': 'roster',
    tip: { real: 'real', shadow: 'no agent', fc: 'forecast P50', band: 'P10–P90', lanes: 'lanes', roster: 'roster', pax: 'passengers' },
    noAlerts: 'No notifications yet. The agent acts when the forecast breaks the 10-minute target.',
    'st.sent': 'sent', 'st.ack': 'acknowledged', kmove: 'move', kres: 'reserve', R: 'Reserve',
    move: a => `Move 1 team (2 officers) from Zone ${a.from} to Zone ${a.to}`,
    reserve: a => `Call a reserve team to Zone ${a.to}`,
    before: 'before', after: 'after',
    why: (pb, pa) => `Risk over 10 min <span class="num">${pb}% → ${pa}%</span>.`,
    donor: (z, p) => ` Zone ${z} stays at P90 <span class="num">${p}</span> min.`,
    gain: g => ` Saves about <span class="num">${g}</span> waiting minutes.`,
    load: 'Who fills the queue', staffOut: 'team absent',
    gatePass: (n, m) => `gate ${n}/${m}`,
    inMv: (a) => a.kind === 'reserve' ? `+1 reserve <b>${hhmm(a.effective)}–${hhmm(a.until)}</b>` : `+1 team from ${a.from} <b>${hhmm(a.effective)}–${hhmm(a.until)}</b>`,
    outMv: (a) => `−1 team → ${a.to} <b>${hhmm(a.effective)}–${hhmm(a.until)}</b>`,
    th: ['Time', 'Flight', 'To', 'Zone', 'Pax', 'Status'],
    'fs.late': x => `delayed ${x}`, 'fs.cancel': 'cancelled', 'fs.gate': 'gate change', 'fs.new': 'new flight', 'fs.swap': 'larger aircraft', 'fs.board': 'boarding', 'fs.gone': 'departed', 'fs.ok': 'on time',
    noFeed: 'Everything is on schedule.',
    ev: {
      gate: (e, f) => `${e.flight} (${cityEn(f?.dest || '')}) moves to Zone ${e.zone}${f?.base ? ` from Zone ${f.base.zone}` : ''}.`,
      swap: e => `${e.flight}: larger aircraft, ${e.pax} passengers.`,
      add: e => `New flight ${e.flight.id} to ${cityEn(e.flight.dest)} at ${hhmm(e.flight.std)}, ${e.flight.pax} passengers, Zone ${e.flight.zone}.`,
      delay: e => `${e.flight} delayed, new time ${hhmm(e.std)}.`,
      cancel: e => `${e.flight} cancelled.`,
      staff: e => `Zone ${e.zone}: one team absent ${hhmm(slotStart(e.from))}–${hhmm(slotStart(e.to))}.`
    },
    who: { feed: 'Feed', sim: 'Simulation', log: 'Logistics', gate: 'Gate', staff: 'Staff' },
    filters: { all: 'All', sim: 'Simulation', log: 'Logistics', gate: 'Gate', staff: 'Staff', feed: 'Feed' },
    m: {
      ask: x => `→ Simulation: forecast for the next <b>${x.horizon} min</b>, ${x.runs} possible futures`,
      forecast: x => `→ Logistics: ${x.runs} futures, ~${x.pax} passengers in <b>${x.ms} ms</b>` + (x.hot.length ? `. Hotspots: ${x.hot.map(h => `<b>${h.zone} ${hhmm(slotStart(h.s))}</b> (P90 ${h.p90.toFixed(1)})`).join(', ')}` : '. No hotspots.'),
      correlate: x => `Zone ${x.zone} ${hhmm(slotStart(x.s))} ← ` + x.corr.flights.slice(0, 3).map(f => `<b>${f.id}</b> ${Math.round(f.share * 100)}%${f.events.length ? ' (' + f.events.map(e => T.en.evShort[e]).join(', ') + ')' : ''}`).join(', ') + (x.corr.staff ? `, ${T.en.staffOut}` : ''),
      whatif: x => `→ Simulation: <b>${x.n}</b> what-ifs in ${x.ms} ms; ${x.rejected} stopped by the gate, ${x.unsafe} would break another zone`,
      hold: x => `Zone ${x.zone} ${hhmm(slotStart(x.s))}: no move worth it (${Math.round(x.gain)} min), waiting`,
      pass: x => `→ Logistics: <b>${x.id}</b> passed all ${x.checks} rules`,
      alert: x => `<b>${x.id}</b> sent to the teams`,
      event: (x, txt) => txt
    },
    evShort: { gate: 'gate change', delay: 'delayed', swap: 'larger aircraft', add: 'new flight', cancel: 'cancelled' },
    rules: { zones: 'Valid zones', notice: 'At least 15 min notice', stay: 'Stay 45–180 min', donorMin: 'Donor keeps its minimum', targetMax: 'Not above physical lanes', pool: 'Within staff on duty', pingpong: 'No back-and-forth', reserve: 'At most 2 reserves' },
    s: {
      start: ['The day starts at 04:00.', 'The first feed change comes at 06:15. Press Play, or click the timeline to jump ahead.'],
      act: (a, txt) => [`The agent sent ${a}.`, txt],
      warn: (z, tm, p) => [`Watch: Zone ${z} may break the target around ${tm}.`, `P90 ${p} min. The agent has no move worth making, or has used them.`],
      event: txt => [txt, 'The agents checked the forecast. No change needed.'],
      ok: ['All zones are on target.', 'No hotspots in the next 3 hours.'],
      done: (a, b) => [`End of day. ${a} passengers waited over 10 min; without the agent it would be ${b}.`, 'Click the timeline to go back, or restart.'],
      restart: 'Restart'
    },
    jumpTo: x => `Jump to ${x}`, jumping: x => `Simulating to ${x}…`, future: 'the future is not known yet',
    newAlerts: n => `${n} new notifications`,
    'bench.h': 'With and without the agent, on the same days',
    'bench.p': 'Each day is a new hidden draw of passengers (same schedule, same feed). The same day is played twice: with last week\'s roster and with the agents. The only difference is the agent. With 60 futures per step a day takes a few seconds.',
    'bench.run': 'Run comparison', 'bench.again': 'Run again', days: 'days', running: (a, b) => `${a} of ${b} days`,
    'b.th': ['Day', 'Wait', 'no agent', 'Over 10 min', 'no agent', 'At risk', 'no agent', 'Notifications', 'P10–P90'],
    'b.sum': 'Total', 'b.chart': 'Passengers over 10 min per day', 'b.agent': 'with agent', 'b.none': 'no agent', 'b.empty': 'Pick how many days and run. Results appear day by day.',
    'b.k1': 'Average wait', 'b.k2': 'Passengers over 10 min', 'b.k3': 'Boarding at risk', 'b.k4': 'Longest wait',
    calib: c => `Forecast issued one hour ahead: the real average wait fell inside P10–P90 in <b>${Math.round(c * 100)}%</b> of cases. The target is 80%, so the forecast is a little overconfident.`,
    keys: 'Shortcuts'
  }
}

const HOW = {
  mk: `
<div class="panel"><h3>Два агента и една порта</h3>
<p>Проток е мал оперативен систем за терминал. Часовникот оди во чекори од 15 минути. Во секој чекор пристигнува фидот (доцнења, нови излези, откажани летови, поголеми авиони, отсутен персонал), а потоа двата агента разговараат.</p>
FLOW
<p><b>Агентот за симулации</b> извлекува сто можни иднини за следните 3 часа: колку патници ќе дојдат на секој лет, кога ќе стигнат до контролата, колку брзо ќе се прегледуваат. Секоја иднина ја пушта низ редицата на секоја зона и враќа P10, P50 и P90 на чекањето по 15 минути.</p>
<p><b>Агентот за логистика</b> ја чита прогнозата, ги наоѓа жешките точки, ги поврзува со летовите што ги полнат и со настаните од фидот, па бара „што ако“: префрли тим од друга зона или повикај резервен тим. Секој предлог прво поминува низ портата, па се симулира на истите иднини.</p></div>
<div class="panel"><h3>Исти патници за секој „што ако“</h3>
<p>Иднините се извлекуваат еднаш по чекор и се користат за сите предлози (common random numbers). Двата плана се споредуваат на истите патници, па разликата е планот, а не случајноста.</p></div>
<div class="panel"><h3>Кодот одлучува, не агентот</h3>
<p>Агентот за логистика само предлага. Портата во код ги проверува сите осум правила пред да тргне известување:</p>
<ul class="rules">RULES</ul>
<p>Покрај портата, потег не смее да ја поправи една зона така што ќе ја скрши другата: донорот мора да остане под 60% од целта (P90).</p></div>
<div class="panel"><h3>Што е вистинско, а што не</h3>
<ul>
<li>Летовите, патниците, настаните и распоредот се измислени. Нема вистински аеродром.</li>
<li>„Вистинскиот“ ден е скриен примерок што агентите не го гледаат, со скриена брзина на прегледување. Агентите го гледаат само фидот до сега и колку луѓе стојат во редица.</li>
<li>Линијата „без агент“ е истиот ден со распоредот од минатата недела. Разликата е само агентот.</li>
<li>Прогнозата е малку премногу самоуверена. На табот Споредба се гледа колку често вистината паѓа во опсегот P10–P90.</li>
<li>Нема јазичен модел. Известувањата се шаблони, одлуките се во код.</li>
</ul></div>
<div class="panel"><h3>KEYS</h3><div class="keys"><span><kbd>Space</kbd> пушти / пауза</span><span><kbd>→</kbd> +15 мин</span><span><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> зона A/B/C</span><span><kbd>R</kbd> од почеток</span></div></div>`,
  en: `
<div class="panel"><h3>Two agents and one gate</h3>
<p>Проток (Flow) is a small operating system for a terminal. The clock moves in 15-minute steps. Each step the feed arrives (delays, gate changes, cancellations, larger aircraft, absent staff) and then the two agents talk.</p>
FLOW
<p><b>The simulation agent</b> draws a hundred possible futures for the next 3 hours: how many passengers each flight brings, when they reach security, how fast screening runs. It runs every future through each zone's queue and returns P10, P50 and P90 of the wait per 15 minutes.</p>
<p><b>The logistics agent</b> reads the forecast, finds the hotspots, links them to the flights that fill them and to the feed events, and asks for what-ifs: move a team from another zone, or call a reserve team. Each proposal goes through the gate first and is then simulated on the same futures.</p></div>
<div class="panel"><h3>The same passengers for every what-if</h3>
<p>The futures are drawn once per step and reused for every proposal (common random numbers). Two plans are compared on the same passengers, so the difference is the plan, not the noise.</p></div>
<div class="panel"><h3>Code decides, not the agent</h3>
<p>The logistics agent only proposes. The gate in code checks all eight rules before a notification goes out:</p>
<ul class="rules">RULES</ul>
<p>Besides the gate, a move may not fix one zone by breaking another: the donor must stay under 60% of the target (P90).</p></div>
<div class="panel"><h3>What is real and what is not</h3>
<ul>
<li>Flights, passengers, events and the roster are invented. There is no real airport.</li>
<li>The "real" day is a hidden draw the agents never see, with a hidden screening speed. The agents only see the feed so far and how many people stand in each queue.</li>
<li>The "no agent" line is the same day under last week's roster. The only difference is the agent.</li>
<li>The forecast is a little overconfident. The Compare tab shows how often the truth falls inside P10–P90.</li>
<li>There is no language model. Notifications are templates; decisions are in code.</li>
</ul></div>
<div class="panel"><h3>KEYS</h3><div class="keys"><span><kbd>Space</kbd> play / pause</span><span><kbd>→</kbd> +15 min</span><span><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> zone A/B/C</span><span><kbd>R</kbd> restart</span></div></div>`
}

const FLOW = `<svg class="flow" viewBox="0 0 860 180" role="img" aria-label="FLOWLABEL">
<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z"/></marker></defs>
<rect class="box" x="10" y="62" width="130" height="58" rx="12"/><text x="75" y="87" text-anchor="middle">FEED</text><text class="sub" x="75" y="105" text-anchor="middle">FEEDSUB</text>
<rect class="box hl" x="190" y="62" width="170" height="58" rx="12"/><text x="275" y="87" text-anchor="middle">LOG</text><text class="sub" x="275" y="105" text-anchor="middle">LOGSUB</text>
<rect class="box hl" x="190" y="140" width="170" height="36" rx="12"/><text x="275" y="163" text-anchor="middle">SIM</text>
<rect class="box" x="410" y="62" width="140" height="58" rx="12"/><text x="480" y="87" text-anchor="middle">GATE</text><text class="sub" x="480" y="105" text-anchor="middle">GATESUB</text>
<rect class="box" x="600" y="62" width="120" height="58" rx="12"/><text x="660" y="87" text-anchor="middle">STAFF</text><text class="sub" x="660" y="105" text-anchor="middle">STAFFSUB</text>
<rect class="box dim" x="600" y="4" width="250" height="40" rx="12"/><text x="725" y="29" text-anchor="middle">DAY</text>
<path class="arr" d="M140 91H188"/><path class="arr" d="M260 120V138"/><path class="arr" d="M290 140V122"/><path class="arr" d="M360 91H408"/><path class="arr" d="M550 91H598"/><path class="arr" d="M720 76C800 76 800 50 770 46"/>
</svg>`
const FLOWT = {
  mk: { FLOWLABEL: 'Тек: фид, логистика, симулации, порта, персонал', FEED: 'Фид', FEEDSUB: 'летови, персонал', LOG: 'Агент за логистика', LOGSUB: 'корелира, предлага', SIM: 'Агент за симулации', GATE: 'Порта', GATESUB: '8 правила во код', STAFF: 'Персонал', STAFFSUB: 'известување', DAY: 'Вистинскиот ден (скриен)' },
  en: { FLOWLABEL: 'Flow: feed, logistics, simulation, gate, staff', FEED: 'Feed', FEEDSUB: 'flights, staff', LOG: 'Logistics agent', LOGSUB: 'correlates, proposes', SIM: 'Simulation agent', GATE: 'Gate', GATESUB: '8 rules in code', STAFF: 'Staff', STAFFSUB: 'notification', DAY: 'The real day (hidden)' }
}

// ---------------------------------------------------------------- icons
const I = {
  play: '<svg viewBox="0 0 16 16"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 16 16"><path d="M4 2.8h2.8v10.4H4zM9.2 2.8H12v10.4H9.2z" fill="currentColor"/></svg>',
  step: '<svg viewBox="0 0 16 16"><path d="M3 2.8v10.4L9.8 8zM11 2.8h2.2v10.4H11z" fill="currentColor"/></svg>',
  reset: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 6.5A5 5 0 1 1 3 9.5"/><path d="M2.6 2.8v3.9h3.9"/></svg>',
  sun: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" fill="currentColor"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 16 16"><path d="M13.2 10.4A6 6 0 0 1 5.6 2.8a6 6 0 1 0 7.6 7.6z" fill="currentColor"/></svg>',
  lane: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 3v10M13 3v10"/><circle cx="8" cy="6" r="1.8"/><path d="M5.5 13c.5-2.4 4.5-2.4 5 0"/></svg>',
  closed: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M5 5l6 6M11 5l-6 6"/></svg>',
  delay: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="5.6"/><path d="M8 5v3.2l2 1.4"/></svg>',
  gate: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h10M9 4.5L12.5 8 9 11.5"/></svg>',
  swap: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5c.6 0 1 .6 1 1.4v3.3l5 2.8v1.5l-5-1.4v2.7l1.5 1.1V14L8 13.3 5.5 14v-1.1L7 11.8V9.1L2 10.5V9l5-2.8V2.9c0-.8.4-1.4 1-1.4z"/></svg>',
  add: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
  cancel: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  staff: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="6.5" cy="5.5" r="2.4"/><path d="M2 13.5c.6-3 8.4-3 9 0M11 7h4"/></svg>',
  ok: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>',
  warn: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3.5v5.5M8 12.2v.1"/></svg>',
  bolt: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M9.2 1.5L3.5 9h4l-1 5.5L12.5 7h-4z"/></svg>',
  clock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="5.6"/><path d="M8 5v3.2l2 1.4"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>'
}
const EV_LETTER = { delay: '!', gate: '→', swap: '+', add: '+', cancel: '×', staff: '−' }

// ---------------------------------------------------------------- state
const $ = s => document.querySelector(s)
const store = { get (k, d) { try { return localStorage.getItem('protok.' + k) ?? d } catch { return d } }, set (k, v) { try { localStorage.setItem('protok.' + k, v) } catch {} } }
let lang = store.get('lang', 'mk')
let theme = store.get('theme', '')
let view = store.get('view', 'ops')
let zoneSel = store.get('zone', 'A')
let range = store.get('range', '6h')
let speed = Number(store.get('speed', 1))
let busFilter = 'all'
let benchDays = 10
let S = null
let playing = false
let jumping = null
let busAll = []
let seenAlerts = new Set()
let firstState = true
const SPEEDS = [[1, 1300], [4, 330], [16, 0]]
const OPTS = { seed: 1, runs: 100 }
const L = () => T[lang]
const t = k => L()[k] ?? k
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const city = c => lang === 'en' ? cityEn(c) : c
const f1 = x => (Math.round(x * 10) / 10).toFixed(1)
const sNowOf = now => Math.min(NSLOT - 1, Math.max(0, Math.floor((now - DAY_START) / SLOT)))

// ---------------------------------------------------------------- worker
const worker = new Worker('/worker.js', { type: 'module' })
worker.onmessage = (e) => {
  const m = e.data
  if (m.type !== 'state') return
  if (m.reset) { busAll = []; seenAlerts = new Set(); firstState = true }
  S = m.state
  busAll.push(...S.log)
  if (busAll.length > 600) busAll = busAll.slice(-600)
  if (m.partial) { $('#busyText').textContent = L().jumping(hhmm(m.target)) + '  ' + hhmm(S.now); renderTimeline(); $('#clock').textContent = hhmm(S.now); return }
  const fresh = S.alerts.filter(a => !seenAlerts.has(a.id))
  fresh.forEach(a => seenAlerts.add(a.id))
  if (jumping != null || m.jumped) {
    jumping = null
    $('#busy').hidden = true
    if (fresh.length > 1 && !firstState) toast(null, L().newAlerts(fresh.length))
    else if (fresh.length === 1 && !firstState) toast(fresh[0])
  } else if (!firstState) fresh.forEach(a => toast(a))
  firstState = false
  render()
  if (playing && !S.done) setTimeout(() => { if (playing && jumping == null) worker.postMessage({ type: 'tick' }) }, SPEEDS.find(s => s[0] === speed)?.[1] ?? 330)
  if (S.done && playing) { playing = false; renderControls() }
}
function reset () { playing = false; jumping = null; worker.postMessage({ type: 'reset', opts: OPTS }); renderControls() }
function jump (to) {
  if (!S) return
  to = Math.max(DAY_START, Math.min(DAY_END, Math.round((to - DAY_START) / SLOT) * SLOT + DAY_START))
  if (to === S.now) return
  playing = false
  jumping = to
  $('#busyText').textContent = L().jumping(hhmm(to))
  if (Math.abs(to - S.now) > SLOT * 3 || to < S.now) $('#busy').hidden = false
  worker.postMessage({ type: 'jump', to, opts: OPTS })
  renderControls()
}

// ---------------------------------------------------------------- controls
function isDark () { return theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches }
function renderControls () {
  const play = $('#btnPlay')
  play.innerHTML = (playing ? I.pause : I.play) + `<span>${t(playing ? 'pause' : 'play')}</span>`
  play.disabled = !!S?.done
  $('#btnStep').innerHTML = I.step; $('#btnStep').title = t('step'); $('#btnStep').setAttribute('aria-label', t('step')); $('#btnStep').disabled = !!S?.done
  $('#btnReset').innerHTML = I.reset; $('#btnReset').title = t('reset'); $('#btnReset').setAttribute('aria-label', t('reset'))
  $('#btnLang').textContent = lang === 'mk' ? 'EN' : 'МК'
  $('#btnLang').setAttribute('aria-label', lang === 'mk' ? 'English' : 'Македонски')
  $('#btnTheme').innerHTML = isDark() ? I.sun : I.moon
  $('#btnTheme').title = t('theme'); $('#btnTheme').setAttribute('aria-label', t('theme'))
  $('#speed').innerHTML = SPEEDS.map(([s]) => `<button role="radio" aria-checked="${s === speed}" data-s="${s}" aria-label="${s}×">${s}×</button>`).join('')
  $('#range').innerHTML = [['6h', t('r6')], ['day', t('rday')]].map(([k, l]) => `<button role="radio" aria-checked="${k === range}" data-r="${k}">${l}</button>`).join('')
  $('#benchDays').innerHTML = [5, 10, 20].map(d => `<button role="radio" aria-checked="${d === benchDays}" data-d="${d}">${d} ${t('days')}</button>`).join('')
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t) })
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === view))
  for (const v of ['ops', 'bench', 'how']) $('#view-' + v).hidden = v !== view
  document.documentElement.lang = lang
  if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme
  if (!bench.running) $('#btnBench').textContent = bench.rows.length ? t('bench.again') : t('bench.run')
}
$('#btnPlay').onclick = () => { if (!S || S.done || jumping != null) return; playing = !playing; renderControls(); if (playing) worker.postMessage({ type: 'tick' }) }
$('#btnStep').onclick = () => { if (jumping != null || S?.done) return; playing = false; renderControls(); worker.postMessage({ type: 'tick' }) }
$('#btnReset').onclick = reset
$('#btnLang').onclick = () => { lang = lang === 'mk' ? 'en' : 'mk'; store.set('lang', lang); renderControls(); renderHow(); render(); renderBench() }
$('#btnTheme').onclick = () => { theme = isDark() ? 'light' : 'dark'; store.set('theme', theme); renderControls() }
$('#speed').onclick = e => { const b = e.target.closest('button'); if (!b) return; speed = Number(b.dataset.s); store.set('speed', speed); renderControls() }
$('#range').onclick = e => { const b = e.target.closest('button'); if (!b) return; range = b.dataset.r; store.set('range', range); renderControls(); renderDetail() }
$('#benchDays').onclick = e => { const b = e.target.closest('button'); if (!b || bench.running) return; benchDays = Number(b.dataset.d); renderControls() }
document.querySelector('.tabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; view = b.dataset.tab; store.set('view', view); renderControls(); window.scrollTo({ top: 0 }) }
$('#map').onclick = e => { const b = e.target.closest('[data-zone]'); if (!b) return; selectZone(b.dataset.zone) }
$('#busFilter').onclick = e => { const b = e.target.closest('button'); if (!b) return; busFilter = b.dataset.f; renderBus() }
function selectZone (z) { zoneSel = z; store.set('zone', z); renderMap(); renderDetail() }
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return
  if (e.target.closest('#tlTrack')) return
  if (e.code === 'Space' && !e.target.closest('button')) { e.preventDefault(); $('#btnPlay').click() } else if (e.key === 'ArrowRight' && !e.target.closest('[role=radiogroup]')) $('#btnStep').click()
  else if (e.key === 'r' || e.key === 'R') reset()
  else if (['1', '2', '3'].includes(e.key)) selectZone(ZONES[Number(e.key) - 1])
})

// ---------------------------------------------------------------- timeline
const tlX = tm => (tm - DAY_START) / (DAY_END - DAY_START) * 100
function renderTimeline () {
  if (!S) return
  const tr = $('#tlTrack')
  let h = `<div class="tl-fill" style="width:${tlX(S.now)}%"></div>`
  for (let tm = 300; tm < DAY_END; tm += 60) h += `<div class="tl-hour" style="left:${tlX(tm)}%"><span>${hhmm(tm).slice(0, 2)}</span></div>`
  for (const e of S.events) h += `<div class="tl-pin ev" style="left:${tlX(e.t)}%" title="${hhmm(e.t)} ${esc(evText(e))}">${EV_LETTER[e.type]}</div>`
  for (const a of S.alerts) h += `<div class="tl-pin al${a.kind === 'reserve' ? ' res' : ''}" style="left:${tlX(a.t)}%" title="${a.id} ${hhmm(a.t)}"></div>`
  h += '<div class="tl-ghost" id="tlGhost"></div>'
  tr.innerHTML = h
  tr.setAttribute('aria-valuenow', S.now)
  tr.setAttribute('aria-valuetext', hhmm(S.now))
  tr.setAttribute('aria-label', lang === 'mk' ? 'Временска линија на денот' : 'Day timeline')
}
const tlTime = e => { const r = $('#tlTrack').getBoundingClientRect(); return DAY_START + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (DAY_END - DAY_START) }
$('#tlTrack').addEventListener('pointermove', e => {
  const tm = Math.round((tlTime(e) - DAY_START) / SLOT) * SLOT + DAY_START
  const g = $('#tlGhost'); if (g) g.style.left = tlX(tm) + '%'
  showTip(e.clientX, e.clientY + 18, `<h4>${L().jumpTo(hhmm(tm))}</h4>`)
})
$('#tlTrack').addEventListener('pointerleave', hideTip)
$('#tlTrack').addEventListener('click', e => { hideTip(); jump(tlTime(e)) })
$('#tlTrack').addEventListener('keydown', e => {
  if (!S) return
  if (e.key === 'ArrowRight') { e.preventDefault(); $('#btnStep').click() } else if (e.key === 'ArrowLeft') { e.preventDefault(); jump(S.now - SLOT) } else if (e.key === 'PageUp') { e.preventDefault(); jump(S.now + 60) } else if (e.key === 'PageDown') { e.preventDefault(); jump(S.now - 60) } else if (e.key === 'Home') { e.preventDefault(); reset() } else if (e.key === 'End') { e.preventDefault(); jump(DAY_END) }
})

// ---------------------------------------------------------------- render
function render () {
  if (!S) return
  $('#clock').textContent = hhmm(S.now)
  $('#clockSub').textContent = S.done ? t('endDay') : t('simTime')
  renderTimeline(); renderStatus(); renderKpis(); renderMap(); renderDetail(); renderAlerts(); renderBoard(); renderFeed(); renderBus()
  renderControls()
}

function p90Next (z) {
  const fc = S.fc?.[z]?.slots || []
  const next = fc.filter(f => slotStart(f.s) >= S.now && slotStart(f.s) < S.now + 60)
  return next.length ? Math.max(...next.map(f => f.p90)) : 0
}
function firstBreach () {
  let best = null
  for (const z of ZONES) for (const f of S.fc?.[z]?.slots || []) if (f.p90 > SLA && (!best || f.s < best.s)) { best = { z, s: f.s, p90: f.p90 }; break }
  return best
}

function renderStatus () {
  const s = L().s
  let cls = 'ok', icon = I.ok, msg, cta = ''
  const fresh = S.alerts.filter(a => a.t === S.now)
  const evNow = S.events.filter(e => e.t > S.now - SLOT && e.t <= S.now)
  const br = firstBreach()
  if (S.done) { msg = s.done(S.truth.total.over, S.shadow.total.over); cls = 'idle'; icon = I.clock; cta = `<button class="btn cta" id="ctaReset">${I.reset}<span>${s.restart}</span></button>` } else if (S.now === DAY_START) { msg = s.start; cls = 'idle'; icon = I.clock; cta = `<button class="btn btn-primary cta" id="ctaJump">${I.play}<span>${L().jumpTo('06:15')}</span></button>` } else if (fresh.length) { const a = fresh[fresh.length - 1]; msg = s.act(fresh.map(x => x.id).join(', '), L()[a.kind](a) + ', ' + hhmm(a.effective) + '–' + hhmm(a.until) + '.'); cls = 'act'; icon = I.bolt } else if (br && slotStart(br.s) < S.now + 120) { msg = s.warn(br.z, hhmm(slotStart(br.s)), f1(br.p90)); cls = 'warn'; icon = I.warn } else if (evNow.length) { msg = s.event(evText(evNow[evNow.length - 1])); cls = 'ok'; icon = I.ok } else msg = s.ok
  const el = $('#status')
  el.className = 'status ' + cls
  el.innerHTML = `<div class="dot">${icon}</div><div class="smsg"><b>${esc(msg[0])}</b><span>${esc(msg[1])}</span></div>${cta}`
  const cj = $('#ctaJump'); if (cj) cj.onclick = () => jump(375)
  const cr = $('#ctaReset'); if (cr) cr.onclick = reset
}

function delta (a, b) {
  if (!b && !a) return '<span class="delta flat">=</span>'
  if (!b) return '<span class="delta bad">+</span>'
  const p = Math.round((a - b) / b * 100)
  if (p === 0) return '<span class="delta flat">0%</span>'
  return `<span class="delta ${p < 0 ? 'good' : 'bad'}">${p > 0 ? '+' : '−'}${Math.abs(p)}%</span>`
}
function renderKpis () {
  const a = S.truth.total, b = S.shadow.total
  const q = ZONES.reduce((x, z) => x + S.truth[z].queueNow, 0)
  const qb = ZONES.reduce((x, z) => x + S.shadow[z].queueNow, 0)
  const k = (lbl, val, unit, bval, d) => `<div class="kpi"><div class="lbl"><span>${lbl}</span>${d ?? ''}</div><div class="val">${val}${unit ? ` <small>${unit}</small>` : ''}</div><div class="cmp">${bval}</div></div>`
  $('#kpis').innerHTML = [
    k(t('kpi.queue'), q, t('pax'), `${t('roster')}: <b>${qb}</b>`, delta(q, qb)),
    k(t('kpi.mean'), f1(a.meanWait), t('min'), `${t('roster')}: <b>${f1(b.meanWait)}</b>`, delta(a.meanWait, b.meanWait)),
    k(t('kpi.over'), a.over, t('pax'), `${t('roster')}: <b>${b.over}</b>`, delta(a.over, b.over)),
    k(t('kpi.missed'), a.missed, t('pax'), `${t('roster')}: <b>${b.missed}</b>`, delta(a.missed, b.missed)),
    k(t('kpi.alerts'), S.alerts.length, '', `${t('reserves')}: <b>${S.reserves.used}/${S.reserves.limit}</b>`)
  ].join('')
}

// ---------------------------------------------------------------- terminal map
function spark (z) {
  const fc = (S.fc?.[z]?.slots || []).filter(f => slotStart(f.s) >= S.now)
  if (!fc.length) return '<svg class="spark" viewBox="0 0 200 38"></svg>'
  const ymax = Math.max(SLA * 1.4, ...fc.map(f => f.p90))
  const x = i => 2 + i / Math.max(1, fc.length - 1) * 196, y = v => 34 - Math.min(v, ymax) / ymax * 30
  const band = `M${fc.map((f, i) => `${x(i)},${y(f.p90)}`).join('L')}L${fc.map((f, i) => `${x(i)},${y(f.p10)}`).reverse().join('L')}Z`
  return `<svg class="spark" viewBox="0 0 200 38" preserveAspectRatio="none" aria-hidden="true"><line class="s" x1="0" x2="200" y1="${y(SLA)}" y2="${y(SLA)}"/><path class="b" d="${band}"/><path class="m" d="M${fc.map((f, i) => `${x(i)},${y(f.p50)}`).join('L')}"/></svg>`
}
function renderMap () {
  if (!S) return
  const sNow = sNowOf(S.now)
  $('#map').innerHTML = ZONES.map(z => {
    const open = S.plan[z][sNow], base = S.base[z][sNow], max = ZONE_MAX[z]
    let lanes = ''
    for (let i = 0; i < 7; i++) {
      let c = 'ln', ic = I.closed
      if (i >= max) c += ' na', ic = ''
      else if (i < Math.min(open, base)) c += ' open', ic = I.lane
      else if (i < open) c += ' open extra', ic = I.lane
      else if (i < base) c += ' gone', ic = I.closed
      lanes += `<span class="${c}">${ic}</span>`
    }
    const r = S.truth[z]
    const n = r.queueNow
    const hot = r.waitingNow > SLA
    const dots = n ? Array.from({ length: Math.min(60, Math.ceil(n / 2)) }, () => `<i${hot ? ' class="hot"' : ''}></i>`).join('') : `<span class="none">${t('noQueue')}</span>`
    const p90 = p90Next(z)
    const st = p90 > SLA ? 'bad' : p90 > SLA * 0.7 ? 'warn' : 'ok'
    const mv = S.alerts.filter(a => a.until > S.now && (a.to === z || a.from === z)).slice(-2).map(a => a.to === z
      ? `<div class="mv ${a.kind === 'reserve' ? 'res' : 'in'}">${L().inMv(a)}</div>`
      : `<div class="mv out">${L().outMv(a)}</div>`).join('')
    return `<button class="cp" data-zone="${z}" aria-pressed="${z === zoneSel}" style="--zc:var(--z${z});--zs:var(--z${z}-soft)">
      <div class="cp-h"><span class="cp-badge">${z}</span><span class="cp-title">${t('zone')} ${z}<small>${L().zdesc[z]}</small></span><span class="pill ${st}">${t(st === 'bad' ? 'breach' : st === 'warn' ? 'watch' : 'ok')}</span></div>
      <div class="lanes" aria-label="${open} / ${max}">${lanes}</div>
      <div class="queue" aria-label="${n} ${t('inQueue')}">${dots}</div>
      <div class="cp-stats"><div><small>${t('inQueue')}</small><b>${n}</b></div><div><small>${t('longest')}</small><b>${f1(r.waitingNow)}</b></div><div><small>${t('p90next')}</small><b>${f1(p90)}</b></div></div>
      ${spark(z)}
      ${mv ? `<div class="moves">${mv}</div>` : ''}
    </button>`
  }).join('')
}

// ---------------------------------------------------------------- detail chart
const CW = 920, CH1 = 210, CH2 = 56, CGAP = 22, PADL = 34, PADR = 10, CTOP = 10
let geo = null
function renderDetail () {
  if (!S) return
  const z = zoneSel
  $('#detailTitle').textContent = L().detail(z)
  const from = range === 'day' ? DAY_START : Math.max(DAY_START, Math.min(S.now - 180, DAY_END - 360))
  const to = range === 'day' ? DAY_END : Math.min(DAY_END, from + 360)
  const x = tm => PADL + (tm - from) / (to - from) * (CW - PADL - PADR)
  const s0 = Math.max(0, Math.floor((from - DAY_START) / SLOT)), s1 = Math.min(NSLOT, Math.ceil((to - DAY_START) / SLOT))
  const real = S.truth[z], sh = S.shadow[z]
  const fc = (S.fc?.[z]?.slots || []).filter(f => slotStart(f.s) >= from && slotStart(f.s) < to)
  let ymax = 15
  for (let s = s0; s < s1; s++) if (slotStart(s + 1) <= S.now) ymax = Math.max(ymax, real.slotMean[s] ?? 0, sh.slotMean[s] ?? 0)
  for (const f of fc) ymax = Math.max(ymax, f.p90)
  ymax = Math.min(70, Math.ceil(ymax * 1.12 / 5) * 5)
  const y = w => CTOP + (1 - Math.min(w, ymax) / ymax) * (CH1 - CTOP - 4)
  const mid = s => x(slotStart(s) + SLOT / 2)
  let g = ''
  if (S.now < to) g += `<rect class="future-bg" x="${x(Math.max(from, S.now))}" y="${CTOP}" width="${x(to) - x(Math.max(from, S.now))}" height="${CH1 - CTOP}"/>`
  const stepY = ymax > 40 ? 10 : 5
  for (let v = 0; v <= ymax; v += stepY) g += `<line class="grid" x1="${PADL}" x2="${CW - PADR}" y1="${y(v)}" y2="${y(v)}"/><text x="${PADL - 6}" y="${y(v) + 3.5}" text-anchor="end">${v}</text>`
  const hstep = range === 'day' ? 120 : 60
  for (let tm = Math.ceil(from / hstep) * hstep; tm <= to; tm += hstep) g += `<text x="${x(tm)}" y="${CH1 + CGAP + CH2 + 15}" text-anchor="middle">${hhmm(tm)}</text><line class="grid" x1="${x(tm)}" x2="${x(tm)}" y1="${CTOP}" y2="${CH1}"/>`
  g += `<text x="${PADL - 6}" y="${CTOP - 1}" text-anchor="end">${t('min')}</text>`
  // events touching this zone
  for (const e of S.events) {
    const fl = typeof e.flight === 'string' ? S.flights.find(f => f.id === e.flight) : e.flight
    const touches = e.type === 'staff' ? e.zone === z : e.type === 'gate' ? (e.zone === z || fl?.base?.zone === z) : fl?.zone === z
    if (!touches || e.t < from || e.t > to) continue
    g += `<line class="ev" x1="${x(e.t)}" x2="${x(e.t)}" y1="${CTOP}" y2="${CH1}"/><text x="${x(e.t) + 3}" y="${CTOP + 9}">${EV_LETTER[e.type]} ${typeof e.flight === 'string' ? e.flight : e.flight?.id || ''}</text>`
  }
  g += `<line class="sla" x1="${PADL}" x2="${CW - PADR}" y1="${y(SLA)}" y2="${y(SLA)}"/><text class="sla-l" x="${CW - PADR - 2}" y="${y(SLA) - 4}" text-anchor="end">${t('lg.sla')}</text>`
  if (fc.length) {
    g += `<path class="band" d="M${fc.map(f => `${mid(f.s)},${y(f.p90)}`).join('L')}L${fc.slice().reverse().map(f => `${mid(f.s)},${y(f.p10)}`).join('L')}Z"/>`
    g += `<path class="p50" d="M${fc.map(f => `${mid(f.s)},${y(f.p50)}`).join('L')}"/>`
  }
  const pts = arr => { const p = []; for (let s = s0; s < s1; s++) if (slotStart(s + 1) <= S.now && arr[s] != null) p.push([mid(s), y(arr[s])]); return p }
  const sp = pts(sh.slotMean), rp = pts(real.slotMean)
  if (sp.length) g += `<path class="shadow" d="M${sp.map(p => p.join(',')).join('L')}"/>`
  if (rp.length) g += `<path class="real-a" d="M${rp[0][0]},${y(0)}L${rp.map(p => p.join(',')).join('L')}L${rp[rp.length - 1][0]},${y(0)}Z"/><path class="real" d="M${rp.map(p => p.join(',')).join('L')}"/>`
  // lanes
  const ly = CH1 + CGAP, lh = v => v / 7 * CH2
  let roster = ''
  for (let s = s0; s < s1; s++) {
    const xa = x(Math.max(from, slotStart(s))), xb = x(Math.min(to, slotStart(s + 1)))
    const v = S.plan[z][s], b = S.base[z][s], w = Math.max(0, xb - xa - 0.8), fut = slotStart(s) >= S.now ? ' future' : ''
    g += `<rect class="lane${fut}" x="${xa}" y="${ly + CH2 - lh(Math.min(v, b))}" width="${w}" height="${lh(Math.min(v, b))}"/>`
    if (v > b) g += `<rect class="lane extra" x="${xa}" y="${ly + CH2 - lh(v)}" width="${w}" height="${lh(v - b)}"/>`
    roster += (s === s0 ? 'M' : 'L') + `${xa},${ly + CH2 - lh(b)}L${xb},${ly + CH2 - lh(b)}`
  }
  g += `<path class="roster" d="${roster}"/><line class="axis" x1="${PADL}" x2="${CW - PADR}" y1="${ly + CH2}" y2="${ly + CH2}"/><text x="${PADL - 6}" y="${ly + 8}" text-anchor="end">7</text><text x="${PADL - 6}" y="${ly + CH2}" text-anchor="end">0</text><text x="${CW - PADR}" y="${ly - 6}" text-anchor="end">${t('lg.lanes')}</text>`
  for (const a of S.alerts) {
    if ((a.to !== z && a.from !== z) || a.effective < from || a.effective > to) continue
    const cls = a.from === z ? 'mk out' : a.kind === 'reserve' ? 'mk res' : 'mk in'
    g += `<circle class="${cls}" cx="${x(a.effective)}" cy="${ly - 10}" r="6" data-alert="${a.id}" tabindex="0" role="button" aria-label="${a.id}"/>`
  }
  if (S.now >= from && S.now <= to) g += `<line class="now" x1="${x(S.now)}" x2="${x(S.now)}" y1="${CTOP - 2}" y2="${ly + CH2}"/><text class="now-l" x="${x(S.now)}" y="${CTOP - 2}" text-anchor="middle" dy="-1">${hhmm(S.now)}</text>`
  g += `<line class="cross" id="cross" x1="0" x2="0" y1="${CTOP}" y2="${ly + CH2}"/><rect class="hit" id="hit" x="${PADL}" y="${CTOP}" width="${CW - PADL - PADR}" height="${ly + CH2 - CTOP}"/>`
  const H = CH1 + CGAP + CH2 + 20
  $('#detail').innerHTML = `<svg class="chart" id="chart" viewBox="0 -6 ${CW} ${H + 6}" style="--zc:var(--z${z})" role="img" aria-label="${esc(L().detail(z))}">${g}</svg>`
  geo = { from, to, x, z }
  $('#legend').innerHTML = `<span><i style="border-color:var(--z${z})"></i>${t('lg.real')}</span><span><i style="border-color:var(--ink3);border-top-style:dotted"></i>${t('lg.shadow')}</span><span><i class="box" style="background:var(--band)"></i>${t('lg.fc')}</span><span><i style="border-color:var(--accent);border-top-style:dashed"></i>${t('lg.p50')}</span><span><i style="border-color:var(--bad);border-top-style:dashed"></i>${t('lg.sla')}</span><span><i class="box" style="background:var(--accent)"></i>${t('lg.extra')}</span><span><i style="border-color:var(--ink2);border-top-style:dashed"></i>${t('lg.roster')}</span>`
}
$('#detail').addEventListener('pointermove', e => {
  if (!geo || !S) return
  const svg = $('#chart'); if (!svg) return
  if (e.target.closest('[data-alert]')) { const a = S.alerts.find(x => x.id === e.target.closest('[data-alert]').dataset.alert); if (a) showTip(e.clientX + 14, e.clientY + 14, `<h4>${a.id} · ${hhmm(a.t)}</h4>${esc(L()[a.kind](a))}`); return }
  const r = svg.getBoundingClientRect()
  const vx = (e.clientX - r.left) / r.width * CW
  if (vx < PADL || vx > CW - PADR) { hideTip(); svg.classList.remove('hovering'); return }
  const tm = geo.from + (vx - PADL) / (CW - PADL - PADR) * (geo.to - geo.from)
  const s = Math.min(NSLOT - 1, Math.max(0, Math.floor((tm - DAY_START) / SLOT)))
  const z = geo.z, tp = L().tip
  const c = $('#cross'); c.setAttribute('x1', geo.x(slotStart(s) + SLOT / 2)); c.setAttribute('x2', geo.x(slotStart(s) + SLOT / 2))
  svg.classList.add('hovering')
  let rows = ''
  const past = slotStart(s + 1) <= S.now
  if (past) {
    const rv = S.truth[z].slotMean[s], sv = S.shadow[z].slotMean[s]
    rows += `<div><span><i style="background:var(--z${z})"></i>${tp.real}</span><b>${rv == null ? '–' : f1(rv) + ' ' + t('min')}</b></div>`
    rows += `<div><span><i style="background:var(--ink3)"></i>${tp.shadow}</span><b>${sv == null ? '–' : f1(sv) + ' ' + t('min')}</b></div>`
    rows += `<div><span>${tp.pax}</span><b>${S.truth[z].slotPax[s]}</b></div>`
  }
  const f = (S.fc?.[z]?.slots || []).find(q => q.s === s)
  if (f && !past) {
    rows += `<div><span><i style="background:var(--accent)"></i>${tp.fc}</span><b>${f1(f.p50)} ${t('min')}</b></div>`
    rows += `<div><span><i style="background:var(--band)"></i>${tp.band}</span><b>${f1(f.p10)}–${f1(f.p90)}</b></div>`
    rows += `<div><span>${tp.pax}</span><b>~${Math.round(f.pax)}</b></div>`
  }
  rows += `<div><span>${tp.lanes} / ${tp.roster}</span><b>${S.plan[z][s]} / ${S.base[z][s]}</b></div>`
  showTip(e.clientX + 16, e.clientY + 16, `<h4>${hhmm(slotStart(s))}–${hhmm(slotStart(s + 1))}</h4>${rows}`)
})
$('#detail').addEventListener('pointerleave', () => { hideTip(); $('#chart')?.classList.remove('hovering') })
document.addEventListener('click', e => {
  const m = e.target.closest('[data-alert]')
  if (!m) return
  focusAlert(m.dataset.alert)
})
function focusAlert (id) {
  const el = document.getElementById('al-' + id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  el.classList.add('fresh'); setTimeout(() => el.classList.remove('fresh'), 1800)
}

function showTip (x, y, html) {
  const tip = $('#tip')
  tip.innerHTML = html
  tip.hidden = false
  const w = tip.offsetWidth, h = tip.offsetHeight
  tip.style.left = Math.min(innerWidth - w - 8, x) + 'px'
  tip.style.top = (y + h > innerHeight - 8 ? y - h - 28 : y) + 'px'
}
function hideTip () { $('#tip').hidden = true }

// ---------------------------------------------------------------- alerts
function alertHtml (a, fresh) {
  const Lx = L()
  const pct = x => Math.round(x * 100)
  const sc = Math.max(a.target.before.p90, SLA) * 1.15
  const w = v => Math.min(100, v / sc * 100)
  const from = a.kind === 'reserve' ? `<span class="zchip R">${Lx.R}</span>` : `<span class="zchip ${a.from}">${a.from}</span>`
  const chips = a.corr.flights.slice(0, 3).map(f => `<span class="chip${f.events.length ? ' ev' : ''}">${f.id} ${esc(city(f.dest || ''))} · ${Math.round(f.share * 100)}%${f.events.length ? ' · ' + f.events.map(e => Lx.evShort[e]).join(', ') : ''}</span>`).join('') + (a.corr.staff ? `<span class="chip ev">${Lx.staffOut}</span>` : '')
  const passed = a.gate.filter(c => c.ok).length
  return `<article class="alert${fresh ? ' fresh' : ''}" id="al-${a.id}">
    <div class="alert-h"><span class="id">${a.id}</span><span class="mono">${hhmm(a.t)}</span><span class="kind ${a.kind === 'reserve' ? 'res' : 'move'}">${a.kind === 'reserve' ? Lx.kres : Lx.kmove}</span><span class="st ${a.status}">${Lx['st.' + a.status]}</span></div>
    <div class="alert-msg">${esc(Lx[a.kind](a))}</div>
    <div class="route">${from}<span class="arrow"></span><span class="zchip ${a.to}">${a.to}</span><span class="when">${hhmm(a.effective)}–${hhmm(a.until)}</span></div>
    <div class="ba">
      <span class="lbl">${Lx.before}</span><span class="bars"><i class="b" style="width:${w(a.target.before.p90)}%"></i><span class="sl" style="left:${w(SLA)}%"></span></span><span class="v">P90 ${f1(a.target.before.p90)}</span>
      <span class="lbl">${Lx.after}</span><span class="bars"><i class="a" style="width:${w(a.target.after.p90)}%"></i><span class="sl" style="left:${w(SLA)}%"></span></span><span class="v">P90 ${f1(a.target.after.p90)}</span>
    </div>
    <div class="why">${Lx.why(pct(a.target.before.pOver), pct(a.target.after.pOver))}${a.donor ? Lx.donor(a.from, f1(a.donor.after.p90)) : ''}${Lx.gain(Math.round(a.gain))}</div>
    <div class="chips" aria-label="${Lx.load}">${chips}</div>
    <details class="gate-d"><summary>✓ ${Lx.gatePass(passed, a.gate.length)}</summary><ul>${a.gate.map(c => `<li>${Lx.rules[c.id]}${c.note ? ` <span class="mono">(${esc(c.note)})</span>` : ''}</li>`).join('')}</ul></details>
  </article>`
}
function renderAlerts () {
  const open = new Set([...document.querySelectorAll('.alert details[open]')].map(d => d.closest('.alert').id))
  $('#alertCount').textContent = S.alerts.length || ''
  $('#alerts').innerHTML = S.alerts.length ? S.alerts.slice().reverse().map(a => alertHtml(a, a.t === S.now)).join('') : `<div class="empty">${I.bell}${t('noAlerts')}</div>`
  open.forEach(id => { const d = document.querySelector('#' + id + ' details'); if (d) d.open = true })
}

function toast (a, text) {
  const el = document.createElement('div')
  el.className = 'toast' + (a?.kind === 'reserve' ? ' res' : '')
  el.innerHTML = a ? `<small>${a.id} · ${hhmm(a.t)}</small>${esc(L()[a.kind](a))}, ${hhmm(a.effective)}–${hhmm(a.until)}` : esc(text)
  el.onclick = () => { if (a) { view = 'ops'; renderControls(); focusAlert(a.id) } close() }
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260) }
  $('#toasts').append(el)
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove()
  setTimeout(close, 6500)
}

// ---------------------------------------------------------------- board & feed
function renderBoard () {
  const Lx = L()
  const fl = S.flights.filter(f => f.std >= S.now - 20 && f.std <= S.now + 300).slice(0, 12)
  const row = f => {
    let st = ['ok', Lx['fs.ok']]
    if (f.cancelled) st = ['cancel', Lx['fs.cancel']]
    else if (f.std < S.now) st = ['ok', Lx['fs.gone']]
    else if (f.delayed) st = ['late', Lx['fs.late'](hhmm(f.std))]
    else if (f.gateChanged) st = ['gate', Lx['fs.gate']]
    else if (f.added) st = ['new', Lx['fs.new']]
    else if (f.swapped) st = ['swap', Lx['fs.swap']]
    else if (f.std - S.now <= 40) st = ['board', Lx['fs.board']]
    const time = f.delayed ? `<span class="strike">${hhmm(f.base.std)}</span> ${hhmm(f.std)}` : hhmm(f.std)
    const changed = f.delayed || f.gateChanged || f.added || f.swapped
    return `<tr class="${f.cancelled || f.std < S.now ? 'gone' : changed ? 'hl' : ''}"><td class="m">${time}</td><td class="m">${f.id}</td><td>${esc(city(f.dest))}</td><td><span class="zb ${f.zone}">${f.zone}</span> <span class="mono" style="color:var(--ink3)">${f.gate}</span></td><td class="m">${f.pax}</td><td><span class="status-t ${st[0]}">${st[1]}</span></td></tr>`
  }
  $('#board').innerHTML = `<thead><tr>${Lx.th.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${fl.map(row).join('')}</tbody>`
}
function evText (e) {
  const f = S.flights.find(x => x.id === (typeof e.flight === 'string' ? e.flight : e.flight?.id))
  return L().ev[e.type](e, f)
}
function renderFeed () {
  const evs = S.events.slice().reverse()
  $('#feed').innerHTML = evs.length ? evs.map(e => `<li><span class="ico ${e.type}">${I[e.type]}</span><time>${hhmm(e.t)}</time><span>${esc(evText(e))}</span></li>`).join('') : `<li><span class="ico">${I.ok}</span><time>—</time><span style="color:var(--ink3)">${t('noFeed')}</span></li>`
}

// ---------------------------------------------------------------- bus
const PARTY = { event: ['feed', 'log'], ask: ['log', 'sim'], forecast: ['sim', 'log'], correlate: ['log', 'log'], whatif: ['log', 'sim'], hold: ['log', 'log'], pass: ['gate', 'log'], alert: ['log', 'staff'] }
function renderBus () {
  if (!S) return
  const Lx = L()
  $('#busFilter').innerHTML = Object.entries(Lx.filters).map(([k, v]) => `<button role="radio" aria-checked="${k === busFilter}" data-f="${k}">${k === 'all' ? '' : `<i class="c-${k}" style="background:currentColor"></i>`}<span>${v}</span></button>`).join('')
  const recent = busAll.filter(m => busFilter === 'all' || PARTY[m.kind].includes(busFilter)).slice(-160)
  const ticks = [...new Set(recent.map(m => m.t))].sort((a, b) => b - a).slice(0, 30)
  $('#bus').innerHTML = ticks.map(tk => `<div class="tick"><time>${hhmm(tk)}</time><div class="msgs">${recent.filter(m => m.t === tk).map(m => {
    const p = PARTY[m.kind][0]
    const txt = m.kind === 'event' ? esc(evText(m.event)) : Lx.m[m.kind](m)
    return `<div class="msg"><span class="who c-${p}"><i></i>${Lx.who[p]}</span><span class="txt">${txt}</span></div>`
  }).join('')}</div></div>`).join('') || `<div class="empty">${lang === 'mk' ? 'Агентите почнуваат да зборуваат по првиот чекор.' : 'The agents start talking after the first step.'}</div>`
  $('#busCount').textContent = S.sim.evals ? `${S.sim.evals.toLocaleString()} ${lang === 'mk' ? 'симулации' : 'simulations'} · ${(S.sim.pax / 1e6).toFixed(1)}M ${lang === 'mk' ? 'симулирани патници' : 'simulated passengers'}` : ''
}

// ---------------------------------------------------------------- bench
const bench = { rows: [], days: 0, running: false }
let bw = null
$('#btnBench').onclick = () => {
  if (bench.running) return
  if (!bw) { bw = new Worker('/worker.js', { type: 'module' }); bw.onmessage = e => { const m = e.data; if (m.type !== 'bench') return; bench.rows = m.rows; bench.days = m.days; bench.running = m.done < m.days; renderBench(); renderControls() } }
  bench.rows = []; bench.days = benchDays; bench.running = true
  $('#btnBench').disabled = true
  renderBench()
  bw.postMessage({ type: 'bench', days: benchDays, runs: 60 })
}
function renderBench () {
  const Lx = L()
  const prog = $('#benchProg')
  prog.hidden = !bench.running && !bench.rows.length
  prog.querySelector('i').style.width = (bench.days ? bench.rows.length / bench.days * 100 : 0) + '%'
  prog.querySelector('span').textContent = bench.days ? Lx.running(bench.rows.length, bench.days) : ''
  $('#btnBench').disabled = bench.running
  $('#btnBench').textContent = bench.running ? Lx.running(bench.rows.length, bench.days) : bench.rows.length ? Lx['bench.again'] : Lx['bench.run']
  const rows = bench.rows
  if (!rows.length) { $('#benchOut').innerHTML = `<div class="panel empty">${bench.running ? '<div class="spinner" style="margin:0 auto 8px"></div>' : ''}${Lx['b.empty']}</div>`; return }
  const sum = k => rows.reduce((a, r) => a + k(r), 0)
  const n = rows.length
  const cal = sum(r => r.calib.inside * r.calib.n) / Math.max(1, sum(r => r.calib.n))
  const big = (lbl, a, b, d = 0) => `<div class="kpi"><div class="lbl"><span>${lbl}</span>${delta(a, b)}</div><div class="val">${d ? f1(a) : Math.round(a).toLocaleString()}</div><div class="cmp">${t('roster')}: <b>${d ? f1(b) : Math.round(b).toLocaleString()}</b></div></div>`
  // bar chart
  const W = 900, H = 200, pl = 40, pb = 22
  const vmax = Math.max(10, ...rows.map(r => r.roster.over))
  const step = (W - pl) / Math.max(n, bench.days)
  const bwid = Math.min(18, step * 0.32)
  const yy = v => 8 + (1 - v / vmax) * (H - pb - 8)
  let bars = ''
  for (let v = 0; v <= vmax; v += Math.ceil(vmax / 4 / 100) * 100 || 100) bars += `<line class="grid" x1="${pl}" x2="${W}" y1="${yy(v)}" y2="${yy(v)}"/><text x="${pl - 6}" y="${yy(v) + 3}" text-anchor="end">${v}</text>`
  rows.forEach((r, i) => {
    const cx = pl + step * i + step / 2
    bars += `<rect class="rb" x="${cx - bwid - 1}" y="${yy(r.roster.over)}" width="${bwid}" height="${H - pb - yy(r.roster.over)}" rx="3"><title>${Lx['b.none']}: ${r.roster.over}</title></rect>`
    bars += `<rect class="ra" x="${cx + 1}" y="${yy(r.agent.over)}" width="${bwid}" height="${Math.max(1, H - pb - yy(r.agent.over))}" rx="3"><title>${Lx['b.agent']}: ${r.agent.over}</title></rect>`
    bars += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${i + 1}</text>`
  })
  const ring = (() => { const r = 26, c = 2 * Math.PI * r; return `<svg class="ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--line)" stroke-width="7"/><circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--accent)" stroke-width="7" stroke-dasharray="${c * cal} ${c}" transform="rotate(-90 32 32)" stroke-linecap="round"/><circle cx="32" cy="6" r="2.5" fill="var(--ink2)" transform="rotate(${0.8 * 360} 32 32)"/><text x="32" y="36" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)" font-family="var(--mono)">${Math.round(cal * 100)}%</text></svg>` })()
  $('#benchOut').innerHTML = `<div class="big-cmp">
      ${big(Lx['b.k1'] + ' (' + t('min') + ')', sum(r => r.agent.meanWait) / n, sum(r => r.roster.meanWait) / n, 1)}
      ${big(Lx['b.k2'], sum(r => r.agent.over), sum(r => r.roster.over))}
      ${big(Lx['b.k3'], sum(r => r.agent.missed), sum(r => r.roster.missed))}
      ${big(Lx['b.k4'] + ' (' + t('min') + ')', Math.max(...rows.map(r => r.agent.maxWait)), Math.max(...rows.map(r => r.roster.maxWait)), 1)}
    </div>
    <section class="panel"><header class="panel-h"><h2>${Lx['b.chart']}</h2><div class="legend" style="margin:0"><span><i class="box" style="background:var(--accent)"></i>${Lx['b.agent']}</span><span><i class="box" style="background:var(--ink3);opacity:.45"></i>${Lx['b.none']}</span></div></header>
      <svg class="bars-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${Lx['b.chart']}">${bars}</svg></section>
    <section class="panel"><div class="table-wrap"><table class="bench"><thead><tr>${Lx['b.th'].map((h, i) => `<th scope="col"${i === 2 || i === 4 || i === 6 ? ' class="dim"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${f1(r.agent.meanWait)}</td><td class="dim">${f1(r.roster.meanWait)}</td><td>${r.agent.over}</td><td class="dim">${r.roster.over}</td><td>${r.agent.missed}</td><td class="dim">${r.roster.missed}</td><td>${r.alerts}</td><td>${Math.round(r.calib.inside * 100)}%</td></tr>`).join('')}
    </tbody><tfoot><tr><td>${Lx['b.sum']}</td><td>${f1(sum(r => r.agent.meanWait) / n)}</td><td class="dim">${f1(sum(r => r.roster.meanWait) / n)}</td><td>${sum(r => r.agent.over)}</td><td class="dim">${sum(r => r.roster.over)}</td><td>${sum(r => r.agent.missed)}</td><td class="dim">${sum(r => r.roster.missed)}</td><td>${sum(r => r.alerts)}</td><td>${Math.round(cal * 100)}%</td></tr></tfoot></table></div></section>
    <section class="panel calib">${ring}<p>${Lx.calib(cal)}</p></section>`
}

function renderHow () {
  const ft = FLOWT[lang]
  const flow = FLOW.replace(/\b(FLOWLABEL|FEEDSUB|FEED|LOGSUB|LOG|SIM|GATESUB|GATE|STAFFSUB|STAFF|DAY)\b/g, k => ft[k])
  $('#how').innerHTML = HOW[lang].replace('FLOW', flow).replace('RULES', Object.values(T[lang].rules).map(r => `<li>${r}</li>`).join('')).replace('KEYS', t('keys'))
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderControls)
renderControls()
renderHow()
renderBench()
reset()
