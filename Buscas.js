
(() => {
    'use strict';

    // =========================================================
    // MicaSVG — Buscas rápidas v4.0
    // Tribos PT — Praça de Reuniões > Busca minuciosa
    // =========================================================

    const VERSION = '4.0.0';
    const PANEL_ID = 'MICASVG_BUSCAS';
    const STYLE_ID = 'MICASVG_BUSCAS_STYLE';
    const VILLAGE_ID =
        new URLSearchParams(location.search).get('village') || 'default';
    const STORAGE_KEY = `micasvg-buscas-${VILLAGE_ID}`;

    // Limpar uma execução anterior.
    window.__micasvgBuscas?.destroy?.();
    document.getElementById(PANEL_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();

    const screen = document.querySelector('#scavenge_screen');

    if (!screen) {
        alert('Abre Praça de Reuniões → Busca minuciosa antes de executar Buscas.js.');
        return;
    }

    // Ordem real dos campos de tropas.
    const UNITS = [
        { id: 'spear', name: 'Lanceiros', carry: 25 },
        { id: 'sword', name: 'Espadachins', carry: 15 },
        { id: 'axe', name: 'Vikings', carry: 10 },
        { id: 'archer', name: 'Arqueiros', carry: 10 },
        { id: 'light', name: 'Cavalaria leve', carry: 80 },
        { id: 'marcher', name: 'Arqueiros a cavalo', carry: 50 },
        { id: 'heavy', name: 'Cavalaria pesada', carry: 50 },
        { id: 'knight', name: 'Paladino', carry: 100 }
    ];

    // Índices dos cartões: 0 = Busca fraca, 1 = Busca humilde, etc.
    const SEARCHES = [
        { index: 0, name: 'Busca fraca', factor: 0.10 },
        { index: 1, name: 'Busca humilde', factor: 0.25 },
        { index: 2, name: 'Busca inteligente', factor: 0.50 },
        { index: 3, name: 'Busca extrema', factor: 0.75 }
    ];

    // Pesos herdados do algoritmo antigo: inverso do fator.
    // A distribuição é proporcional entre as buscas disponíveis.
    const weightOf = search => 1 / search.factor;

    let running = true;
    let minimized = false;
    let timer = null;
    let observer = null;
    let ratioMode = 'weighted';
    let firstSearchPercent = 50;
    let lastAlert = '';
    let lastSnapshot = [];
    let savedState = {};

    try {
        savedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (_) {
        savedState = {};
    }

    // ---------------------------------------------------------
    // Estilos
    // ---------------------------------------------------------

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        #${PANEL_ID} {
            position: fixed;
            top: 20px;
            right: 18px;
            width: 390px;
            max-width: calc(100vw - 24px);
            max-height: calc(100vh - 40px);
            overflow: auto;
            z-index: 999999;
            color: #2c2418;
            background: #f4e4c1;
            border: 2px solid #7d510f;
            border-radius: 7px;
            box-shadow: 0 8px 24px #0008;
            font: 12px/1.45 Verdana, Arial, sans-serif;
        }
        #${PANEL_ID} * { box-sizing: border-box; }
        #${PANEL_ID} .ms-head {
            position: sticky;
            top: 0;
            z-index: 3;
            padding: 9px 10px;
            background: #e1c28f;
            border-bottom: 1px solid #a47232;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
        }
        #${PANEL_ID} .ms-head strong {
            font-size: 14px;
            color: #502500;
        }
        #${PANEL_ID} .ms-content { padding: 10px; }
        #${PANEL_ID} button,
        #${PANEL_ID} select {
            cursor: pointer;
            border: 1px solid #a47232;
            border-radius: 4px;
            padding: 6px 8px;
            color: #38250d;
            background: #fff3d8;
            font: inherit;
        }
        #${PANEL_ID} button:hover { background: #f1d39e; }
        #${PANEL_ID} button:disabled {
            opacity: .45;
            cursor: not-allowed;
        }
        #${PANEL_ID} .ms-status {
            padding: 8px;
            margin-bottom: 9px;
            background: #fff4dc;
            border: 1px solid #d3b37b;
            border-radius: 4px;
        }
        #${PANEL_ID} .ms-alert {
            padding: 9px;
            margin-bottom: 8px;
            background: #ffe6a8;
            border: 1px solid #c28b24;
            border-radius: 4px;
            font-weight: bold;
        }
        #${PANEL_ID} .ms-card {
            padding: 9px;
            margin: 7px 0;
            border: 1px solid #c1a270;
            border-left: 4px solid #9c8b70;
            border-radius: 5px;
            background: #fff8e7;
        }
        #${PANEL_ID} .ms-card.active { border-left-color: #d29a28; }
        #${PANEL_ID} .ms-card.ready { border-left-color: #388746; }
        #${PANEL_ID} .ms-card.locked { opacity: .7; }
        #${PANEL_ID} .ms-card.done {
            border-left-color: #c44336;
            background: #ffe7df;
            animation: micasvg-pulse 1s ease-in-out 2;
        }
        #${PANEL_ID} .ms-title {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 6px;
        }
        #${PANEL_ID} .ms-title strong { font-size: 13px; }
        #${PANEL_ID} .ms-badge {
            font-size: 10px;
            padding: 2px 5px;
            border-radius: 3px;
            background: #eee0c1;
        }
        #${PANEL_ID} .ms-time {
            font-size: 20px;
            font-weight: bold;
            margin: 5px 0;
            font-variant-numeric: tabular-nums;
        }
        #${PANEL_ID} .ms-muted { color: #75664f; font-size: 11px; }
        #${PANEL_ID} .ms-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin-top: 8px;
        }
        #${PANEL_ID} .ms-section {
            border-top: 1px solid #c1a270;
            margin-top: 12px;
            padding-top: 10px;
        }
        #${PANEL_ID} .ms-section h4 {
            margin: 0 0 6px;
            color: #502500;
            font-size: 13px;
        }
        #${PANEL_ID} .ms-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            margin: 6px 0;
        }
        #${PANEL_ID} input[type="range"] { width: 100%; }
        #${PANEL_ID} .ms-table {
            width: 100%;
            border-collapse: collapse;
            text-align: center;
            background: #fff8e7;
            margin: 7px 0;
        }
        #${PANEL_ID} .ms-table th {
            background: #c1a270;
            color: white;
            font-size: 10px;
            padding: 5px 3px;
        }
        #${PANEL_ID} .ms-table td {
            border-bottom: 1px solid #e2d1b1;
            padding: 4px 3px;
        }
        #${PANEL_ID} .ms-table td:first-child { text-align: left; }
        #${PANEL_ID} .ms-footer {
            border-top: 1px solid #c1a270;
            margin-top: 10px;
            padding-top: 8px;
        }
        #${PANEL_ID} .ms-hidden { display: none !important; }
        @keyframes micasvg-pulse {
            50% { box-shadow: 0 0 12px #c4433677; }
        }
    `;
    document.head.appendChild(style);

    // ---------------------------------------------------------
    // Painel
    // ---------------------------------------------------------

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
        <div class="ms-head">
            <strong>⚔ MicaSVG — Buscas v${VERSION}</strong>
            <div style="display:flex;gap:5px">
                <button type="button" data-action="pause">Pausar</button>
                <button type="button" data-action="minimize">−</button>
                <button type="button" data-action="close">×</button>
            </div>
        </div>
        <div class="ms-content" data-role="content">
            <div class="ms-status" data-role="status">A iniciar monitorização…</div>
            <div data-role="alert"></div>
            <div data-role="searches"></div>

            <div class="ms-section">
                <h4>Distribuição das tropas</h4>
                <div class="ms-muted">
                    A distribuição é calculada apenas para buscas desbloqueadas
                    e disponíveis. Preparar tropas não inicia a busca.
                </div>

                <div class="ms-row">
                    <label for="${PANEL_ID}-mode">Método de distribuição</label>
                    <select id="${PANEL_ID}-mode">
                        <option value="weighted">Ponderado (algoritmo antigo)</option>
                        <option value="equal">Partes iguais</option>
                        <option value="manual">Percentagem personalizada</option>
                    </select>
                </div>

                <div data-role="custom-ratio" class="ms-hidden">
                    <div class="ms-row">
                        <label for="${PANEL_ID}-ratio">Percentagem para a primeira busca</label>
                        <strong data-role="ratio-label">50%</strong>
                    </div>
                    <input id="${PANEL_ID}-ratio" type="range"
                        min="0" max="100" step="5" value="50">
                </div>

                <div data-role="distribution"></div>
                <div class="ms-actions">
                    <button type="button" data-action="refresh">Atualizar</button>
                    <button type="button" data-action="notify">Ativar notificações</button>
                </div>
            </div>

            <div class="ms-section">
                <h4>Próximo regresso</h4>
                <div data-role="next" class="ms-muted">A aguardar dados do jogo.</div>
            </div>

            <div class="ms-footer ms-muted">
                Os temporizadores refletem o contador apresentado pelo jogo.
                Confirma sempre os valores antes de iniciares uma busca.
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    const $ = selector => panel.querySelector(selector);
    const searchContainer = $('[data-role="searches"]');

    // ---------------------------------------------------------
    // Funções auxiliares
    // ---------------------------------------------------------

    function parseCount(text) {
        const match = String(text || '').match(/\(([\d.,]+)\)/);
        if (!match) return 0;

        const value = Number(match[1].replace(/[.,](?=\d{3}\b)/g, ''));
        return Number.isFinite(value) ? Math.floor(value) : 0;
    }

    function parseDuration(text) {
        const value = String(text || '').trim();
        if (!value) return null;

        const parts = value.split(':').map(Number);
        if (parts.some(n => !Number.isFinite(n))) return null;

        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        }
        if (parts.length === 1) {
            return parts[0];
        }
        return null;
    }

    function fmtDuration(seconds) {
        if (!Number.isFinite(seconds)) return '—';

        const n = Math.max(0, Math.floor(seconds));
        const h = Math.floor(n / 3600);
        const m = Math.floor((n % 3600) / 60);
        const s = n % 60;

        return h
            ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            : `${m}:${String(s).padStart(2, '0')}`;
    }

    function fmtClock(timestamp) {
        if (!timestamp) return '—';

        return new Date(timestamp).toLocaleTimeString('pt-PT', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    function setText(parent, selector, text) {
        const element = parent.querySelector(selector);
        if (element) element.textContent = text;
    }

    // ---------------------------------------------------------
    // Leitura real da página
    // ---------------------------------------------------------

    function readTroops() {
        return UNITS.map(unit => {
            const input = screen.querySelector(
                `input.unitsInput[name="${unit.id}"]`
            );

            const link = screen.querySelector(
                `.units-entry-all[data-unit="${unit.id}"]`
            );

            const available = parseCount(link?.textContent || '');

            return {
                ...unit,
                input,
                available
            };
        });
    }

    function readSearches() {
        const cards = [
            ...screen.querySelectorAll('.scavenge-option')
        ];

        return cards.map((card, index) => {
            const definition = SEARCHES[index] || {
                index,
                name: `Busca ${index + 1}`,
                factor: 1
            };

            const countdown = card.querySelector('.return-countdown');
            const durationEl = card.querySelector('.inactive-view .duration');
            const button = card.querySelector('.free_send_button');
            const locked = !!card.querySelector('.locked-view');
            const active = !!countdown;

            const durationText =
                countdown?.textContent.trim() ||
                durationEl?.textContent.trim() ||
                '';

            const seconds = parseDuration(durationText);
            const previous = savedState[index] || {};

            let endAt = previous.endAt || null;

            if (active && seconds !== null) {
                const estimated = Date.now() + seconds * 1000;

                // Só reajustar se o tempo estimado tiver divergido
                // do valor guardado por mais de 3 segundos.
                if (!endAt || Math.abs(endAt - estimated) > 3000) {
                    endAt = estimated;
                }
            } else {
                endAt = null;
            }

            return {
                ...definition,
                card,
                active,
                locked,
                available: !active && !locked && !!button,
                button,
                durationText,
                seconds,
                endAt,
                resources: {
                    wood: card.querySelector('.wood-value')?.textContent.trim() || '—',
                    stone: card.querySelector('.stone-value')?.textContent.trim() || '—',
                    iron: card.querySelector('.iron-value')?.textContent.trim() || '—'
                }
            };
        });
    }

    // ---------------------------------------------------------
    // Distribuição de tropas
    // ---------------------------------------------------------

    function getWeight(search, position, searches) {
        if (ratioMode === 'equal') return 1;

        if (ratioMode === 'manual') {
            if (searches.length === 1) return 1;

            if (position === 0) {
                return Math.max(0, firstSearchPercent);
            }

            if (position === 1) {
                return Math.max(0, 100 - firstSearchPercent);
            }

            return 0;
        }

        return weightOf(search);
    }

    function calculateDistribution(searches, troops) {
        const targets = searches.filter(s => s.available);
        const result = new Map();

        targets.forEach(search => result.set(search.index, {}));

        if (!targets.length) {
            return { targets, result, troops };
        }

        const weights = targets.map((search, position) =>
            getWeight(search, position, targets)
        );

        const totalWeight = weights.reduce((sum, value) => sum + value, 0);

        troops.forEach(troop => {
            if (troop.available <= 0) {
                targets.forEach(search => {
                    result.get(search.index)[troop.id] = 0;
                });
                return;
            }

            const effectiveWeights = totalWeight > 0
                ? weights
                : weights.map(() => 1);

            const weightSum = effectiveWeights.reduce((sum, value) => sum + value, 0);

            const exact = effectiveWeights.map(weight =>
                troop.available * weight / weightSum
            );

            const allocation = exact.map(Math.floor);
            let remaining = troop.available -
                allocation.reduce((sum, value) => sum + value, 0);

            // Distribuir restos de arredondamento para preservar o total.
            const order = exact
                .map((value, index) => ({
                    index,
                    fraction: value - Math.floor(value)
                }))
                .sort((a, b) => b.fraction - a.fraction);

            for (let i = 0; i < remaining; i++) {
                allocation[order[i % order.length].index]++;
            }

            targets.forEach((search, index) => {
                result.get(search.index)[troop.id] = allocation[index];
            });
        });

        return { targets, result, troops };
    }

    // ---------------------------------------------------------
    // Alertas e persistência
    // ---------------------------------------------------------

    function showAlert(message, key = message) {
        if (lastAlert === key) return;
        lastAlert = key;

        const area = $('[data-role="alert"]');
        area.innerHTML = '';

        const alertBox = document.createElement('div');
        alertBox.className = 'ms-alert';
        alertBox.textContent = `⏰ ${message}`;
        area.appendChild(alertBox);

        if (
            'Notification' in window &&
            Notification.permission === 'granted'
        ) {
            try {
                new Notification('MicaSVG — Buscas', { body: message });
            } catch (_) {}
        }
    }

    function saveSearchState(searches) {
        const next = {};

        searches.forEach(search => {
            next[search.index] = {
                active: search.active,
                endAt: search.active ? search.endAt : null,
                name: search.name
            };
        });

        savedState = next;

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (_) {}
    }

    // ---------------------------------------------------------
    // Preparar campos para confirmação manual
    // ---------------------------------------------------------

    function prepareSearch(index) {
        const searches = readSearches();
        const troops = readTroops();
        const plan = calculateDistribution(searches, troops);
        const search = searches.find(s => s.index === index);

        if (!search || !search.available) {
            alert('Esta busca não está disponível neste momento.');
            return;
        }

        const allocation = plan.result.get(index) || {};

        for (const troop of troops) {
            if (!troop.input) continue;

            troop.input.value = String(allocation[troop.id] || 0);

            ['input', 'change', 'keyup'].forEach(type => {
                troop.input.dispatchEvent(new Event(type, { bubbles: true }));
            });
        }

        search.card.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        search.card.style.outline = '2px solid #388746';
        setTimeout(() => {
            if (search.card.isConnected) {
                search.card.style.outline = '';
            }
        }, 2500);

        showAlert(
            `Tropas preparadas para ${search.name}. Confirma os valores e inicia a busca manualmente.`,
            `prepared-${index}-${Date.now()}`
        );
    }

    // ---------------------------------------------------------
    // Renderização do painel
    // ---------------------------------------------------------

    function renderSearchCards(searches) {
        searchContainer.innerHTML = '';

        searches.forEach(search => {
            const card = document.createElement('div');
            card.className = 'ms-card';

            if (search.active) card.classList.add('active');
            else if (search.available) card.classList.add('ready');
            else if (search.locked) card.classList.add('locked');

            const title = document.createElement('div');
            title.className = 'ms-title';

            const name = document.createElement('strong');
            name.textContent = search.name;

            const badge = document.createElement('span');
            badge.className = 'ms-badge';
            badge.textContent = search.locked
                ? 'Bloqueada'
                : search.active
                    ? 'Em curso'
                    : search.available
                        ? 'Disponível'
                        : 'Indisponível';

            title.append(name, badge);

            const time = document.createElement('div');
            time.className = 'ms-time';

            if (search.active) {
                const remaining = search.seconds ?? 0;
                time.textContent = fmtDuration(remaining);

                if (remaining <= 0) {
                    badge.textContent = 'A aguardar atualização';
                }
            } else if (search.available) {
                time.textContent = search.durationText
                    ? `Duração: ${search.durationText}`
                    : 'Pronta';
            } else {
                time.textContent = '—';
            }

            const resources = document.createElement('div');
            resources.className = 'ms-muted';
            resources.textContent =
                `Madeira ${search.resources.wood} · ` +
                `Argila ${search.resources.stone} · ` +
                `Ferro ${search.resources.iron}`;

            card.append(title, time, resources);

            if (search.available) {
                const actions = document.createElement('div');
                actions.className = 'ms-actions';

                const prepare = document.createElement('button');
                prepare.type = 'button';
                prepare.textContent = 'Preparar tropas';
                prepare.dataset.action = 'prepare';
                prepare.dataset.index = String(search.index);

                const locate = document.createElement('button');
                locate.type = 'button';
                locate.textContent = 'Ir à busca';
                locate.dataset.action = 'locate';
                locate.dataset.index = String(search.index);

                actions.append(prepare, locate);
                card.appendChild(actions);
            }

            searchContainer.appendChild(card);
        });
    }

    function renderDistribution(searches, troops) {
        const container = $('[data-role="distribution"]');
        container.innerHTML = '';

        const plan = calculateDistribution(searches, troops);

        if (!plan.targets.length) {
            const message = document.createElement('p');
            message.className = 'ms-muted';
            message.textContent =
                'Não há buscas desbloqueadas e disponíveis para distribuir tropas.';
            container.appendChild(message);
            return;
        }

        const table = document.createElement('table');
        table.className = 'ms-table';

        const thead = document.createElement('thead');
        const header = document.createElement('tr');

        const unitHeading = document.createElement('th');
        unitHeading.textContent = 'Tropa';
        header.appendChild(unitHeading);

        plan.targets.forEach(search => {
            const th = document.createElement('th');
            th.textContent = search.name.replace('Busca ', '');
            header.appendChild(th);
        });

        thead.appendChild(header);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        troops.forEach(troop => {
            const tr = document.createElement('tr');

            const label = document.createElement('td');
            label.textContent = troop.name;
            tr.appendChild(label);

            plan.targets.forEach(search => {
                const td = document.createElement('td');
                td.textContent = String(
                    plan.result.get(search.index)?.[troop.id] || 0
                );
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        const capacityRow = document.createElement('tr');
        const capacityLabel = document.createElement('td');
        capacityLabel.textContent = 'Carga teórica';
        capacityLabel.style.fontWeight = 'bold';
        capacityRow.appendChild(capacityLabel);

        plan.targets.forEach(search => {
            const td = document.createElement('td');
            const capacity = troops.reduce((sum, troop) => {
                const count = plan.result.get(search.index)?.[troop.id] || 0;
                return sum + count * troop.carry;
            }, 0);

            td.textContent = capacity.toLocaleString('pt-PT');
            td.title = 'Capacidade teórica de carga das tropas atribuídas';
            capacityRow.appendChild(td);
        });

        tbody.appendChild(capacityRow);
        table.appendChild(tbody);
        container.appendChild(table);

        plan.targets.forEach(search => {
            const row = document.createElement('div');
            row.className = 'ms-row';

            const label = document.createElement('span');
            label.textContent = search.name;

            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Preparar';
            button.dataset.action = 'prepare';
            button.dataset.index = String(search.index);

            row.append(label, button);
            container.appendChild(row);
        });
    }

    function renderNextReturn(searches) {
        const container = $('[data-role="next"]');

        const active = searches
            .filter(search => search.active && search.endAt)
            .sort((a, b) => a.endAt - b.endAt);

        if (!active.length) {
            const available = searches.find(search => search.available);

            container.textContent = available
                ? `${available.name} está disponível. Prepara as tropas e confirma o envio manualmente.`
                : 'Não há regressos ativos identificados.';
            return;
        }

        const next = active[0];
        const remaining = next.seconds ?? 0;
        const predicted = Date.now() + remaining * 1000;

        container.textContent =
            `${next.name}: cerca das ${fmtClock(predicted)} ` +
            `(em ${fmtDuration(remaining)}).`;
    }

    function detectCompletions(searches) {
        for (const search of searches) {
            const previous = savedState[search.index];

            if (previous?.active && !search.active && !search.locked) {
                const key = `finished-${search.index}-${Date.now()}`;

                showAlert(
                    `${search.name} terminou ou ficou disponível. Confirma o estado no jogo.`,
                    key
                );

                const card = search.card;
                card.classList.add('done');

                setTimeout(() => {
                    if (card.isConnected) card.classList.remove('done');
                }, 3500);
            }
        }
    }

    function refresh() {
        if (!document.body.contains(panel)) {
            destroy();
            return;
        }

        if (!document.querySelector('#scavenge_screen')) {
            $('[data-role="status"]').textContent =
                'A página de buscas já não está disponível.';
            return;
        }

        if (!running) return;

        const searches = readSearches();
        const troops = readTroops();

        detectCompletions(searches);
        renderSearchCards(searches);
        renderDistribution(searches, troops);
        renderNextReturn(searches);

        const activeCount = searches.filter(search => search.active).length;
        const availableCount = searches.filter(search => search.available).length;
        const lockedCount = searches.filter(search => search.locked).length;

        $('[data-role="status"]').textContent =
            `Monitorização ativa · ${activeCount} em curso · ` +
            `${availableCount} disponíveis · ${lockedCount} bloqueadas`;

        saveSearchState(searches);
        lastSnapshot = searches;
    }

    // ---------------------------------------------------------
    // Eventos
    // ---------------------------------------------------------

    panel.addEventListener('click', event => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;

        if (action === 'close') {
            destroy();
            return;
        }

        if (action === 'minimize') {
            minimized = !minimized;
            $('[data-role="content"]').classList.toggle('ms-hidden', minimized);
            button.textContent = minimized ? '+' : '−';
            return;
        }

        if (action === 'pause') {
            running = !running;
            button.textContent = running ? 'Pausar' : 'Retomar';

            $('[data-role="status"]').textContent = running
                ? 'Monitorização ativa.'
                : 'Monitorização pausada.';

            if (running) refresh();
            return;
        }

        if (action === 'refresh') {
            refresh();
            return;
        }

        if (action === 'prepare') {
            prepareSearch(Number(button.dataset.index));
            return;
        }

        if (action === 'locate') {
            const index = Number(button.dataset.index);
            const card = screen.querySelectorAll('.scavenge-option')[index];

            card?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });

            if (card) {
                card.style.outline = '2px solid #388746';
                setTimeout(() => {
                    if (card.isConnected) card.style.outline = '';
                }, 2500);
            }
            return;
        }

        if (action === 'notify') {
            if (!('Notification' in window)) {
                alert('Este navegador não suporta notificações.');
                return;
            }

            Notification.requestPermission().then(permission => {
                alert(permission === 'granted'
                    ? 'Notificações autorizadas.'
                    : 'As notificações não foram autorizadas.');
            });
        }
    });

    const mode = document.getElementById(`${PANEL_ID}-mode`);
    mode.addEventListener('change', () => {
        ratioMode = mode.value;
        $('[data-role="custom-ratio"]').classList.toggle(
            'ms-hidden',
            ratioMode !== 'manual'
        );
        refresh();
    });

    const ratio = document.getElementById(`${PANEL_ID}-ratio`);
    ratio.addEventListener('input', () => {
        firstSearchPercent = Number(ratio.value);
        setText(panel, '[data-role="ratio-label"]', `${firstSearchPercent}%`);
        refresh();
    });

    panel.querySelector('[data-action="notify"]').addEventListener('click', () => {});

    // Observar mudanças do jogo sem observar o próprio painel.
    observer = new MutationObserver(() => {
        if (running) refresh();
    });

    observer.observe(screen, {
        subtree: true,
        childList: true,
        characterData: true
    });

    timer = setInterval(refresh, 1000);

    function destroy() {
        if (timer) clearInterval(timer);
        if (observer) observer.disconnect();

        panel.remove();
        style.remove();

        if (window.__micasvgBuscas?.destroy === destroy) {
            delete window.__micasvgBuscas;
        }
    }

    window.__micasvgBuscas = {
        version: VERSION,
        refresh,
        readSearches,
        readTroops,
        destroy
    };

    refresh();

    console.log(`[MicaSVG Buscas v${VERSION}] Painel iniciado.`);
})();
