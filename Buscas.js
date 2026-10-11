
(() => {
    'use strict';

    const ID = 'tw-buscas-rapidas';
    const ID_PAINEL = 'tw-buscas-painel';
    const ID_ESTILO = 'tw-buscas-estilo';

    // Limpar uma execução anterior.
    if (window.__twBuscasRapidas?.destroy) {
        window.__twBuscasRapidas.destroy();
    }

    document.getElementById(ID)?.remove();
    document.getElementById(ID_PAINEL)?.remove();
    document.getElementById(ID_ESTILO)?.remove();

    if (!location.search.includes('mode=scavenge')) {
        console.warn('[Buscas] Abre primeiro a página das buscas.');
        return;
    }

    const UNIDADES = [
        'spear', 'sword', 'axe', 'archer',
        'light', 'marcher', 'heavy', 'knight'
    ];

    const NOMES = {
        spear: 'Lanceiros',
        sword: 'Espadachins',
        axe: 'Machadeiros',
        archer: 'Arqueiros',
        light: 'Cavalaria leve',
        marcher: 'Arqueiros a cavalo',
        heavy: 'Cavalaria pesada',
        knight: 'Paladino'
    };

    // Pesos relativos das quatro buscas.
    const PESOS = [15, 6, 3, 2];

    const INTERVALO = 1000;
    const ATRASO_ENVIO = 500;
    const INTERVALO_ENTRE_ENVIOS = 1800;
    const TEMPO_ANTI_DUPLICADO = 30000;

    let ligado = false;
    let envioAuto = false;
    let aEnviar = false;
    let intervaloId = null;
    let temporizadorEnvio = null;
    let painelAberto = false;
    let ultimaVerificacaoEnvio = 0;

    const estadosAnteriores = new Map();
    const enviadas = new Map();

    // --------------------------------------------------
    // ESTILO
    // --------------------------------------------------

    const estilo = document.createElement('style');
    estilo.id = ID_ESTILO;

    estilo.textContent = `
        #${ID} {
            position: fixed;
            top: 8px;
            right: 12px;
            z-index: 999999;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 5px;
            max-width: calc(100vw - 24px);
            padding: 7px;
            color: #302010;
            background: #f4e4bc;
            border: 1px solid #7d510f;
            border-radius: 5px;
            box-shadow: 0 3px 12px #0004;
            font: 12px Verdana, sans-serif;
        }

        #${ID} button,
        #${ID_PAINEL} button {
            cursor: pointer;
            padding: 6px 9px;
            border: 1px solid #7d510f;
            border-radius: 3px;
            background: #e5c98b;
            color: #302010;
            font: inherit;
        }

        #${ID} button:hover,
        #${ID_PAINEL} button:hover {
            background: #d9b96d;
        }

        #${ID} .ativo {
            background: #b9dcae;
            border-color: #467b37;
        }

        #${ID} .inativo {
            background: #e9b7a7;
            border-color: #a34c35;
        }

        #${ID} .atalho-disponivel {
            background: #c9e2bd;
            font-weight: bold;
        }

        #${ID_PAINEL} {
            position: fixed;
            top: 58px;
            right: 12px;
            z-index: 999998;
            width: min(950px, calc(100vw - 24px));
            max-height: calc(100vh - 75px);
            overflow: auto;
            box-sizing: border-box;
            padding: 13px;
            color: #302010;
            background: #f4e4bc;
            border: 1px solid #7d510f;
            border-radius: 5px;
            box-shadow: 0 4px 16px #0004;
            font: 12px Verdana, sans-serif;
        }

        #${ID_PAINEL}[hidden] {
            display: none !important;
        }

        #${ID_PAINEL} table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }

        #${ID_PAINEL} th,
        #${ID_PAINEL} td {
            padding: 7px 5px;
            border-bottom: 1px solid #c6ad7d;
            text-align: left;
            vertical-align: top;
            overflow-wrap: anywhere;
        }

        #${ID_PAINEL} th {
            background: #e5cf9c;
        }

        #${ID_PAINEL} .curso {
            color: #805600;
            font-weight: bold;
        }

        #${ID_PAINEL} .disponivel {
            color: #176b2b;
            font-weight: bold;
        }

        #${ID_PAINEL} .alerta {
            color: #a32424;
            font-weight: bold;
            background: #f8d9d0;
        }

        #${ID_PAINEL} .mensagem {
            margin-top: 10px;
            padding: 8px;
            background: #fff4d9;
            border: 1px solid #d0b779;
            white-space: pre-wrap;
        }

        #${ID_PAINEL} .scroll {
            overflow-x: auto;
        }
    `;

    document.head.appendChild(estilo);

    // --------------------------------------------------
    // INTERFACE
    // --------------------------------------------------

    function elemento(tag, texto, classe) {
        const el = document.createElement(tag);

        if (texto !== undefined) el.textContent = texto;
        if (classe) el.className = classe;

        return el;
    }

    const barra = elemento('div');
    barra.id = ID;

    const botaoPainel = elemento('button', '☷ Buscas');
    const botaoMonitor = elemento(
        'button',
        'Monitor: OFF',
        'inativo'
    );
    const botaoAuto = elemento(
        'button',
        'Envio automático: OFF',
        'inativo'
    );
    const botaoAtualizar = elemento('button', '↻ Atualizar');
    const atalhos = elemento('div');
    const estadoRapido = elemento('span', 'A iniciar...');
    const botaoFechar = elemento('button', '×');

    Object.assign(atalhos.style, {
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap'
    });

    botaoFechar.title = 'Fechar o gestor';

    barra.append(
        botaoPainel,
        botaoMonitor,
        botaoAuto,
        botaoAtualizar,
        atalhos,
        estadoRapido,
        botaoFechar
    );

    const painel = elemento('section');
    painel.id = ID_PAINEL;
    painel.hidden = true;

    const titulo = elemento('h3', 'Gestor de buscas automáticas');
    const resumo = elemento('p');
    const mensagem = elemento(
        'div',
        'Monitorização desligada.',
        'mensagem'
    );

    const scroll = elemento('div', undefined, 'scroll');
    const tabela = elemento('table');
    const thead = elemento('thead');
    const trHead = elemento('tr');
    const tbody = elemento('tbody');

    [
        'Busca',
        'Estado',
        'Tempo restante',
        'Regresso estimado',
        'Distribuição'
    ].forEach(t => trHead.appendChild(elemento('th', t)));

    thead.appendChild(trHead);
    tabela.append(thead, tbody);
    scroll.appendChild(tabela);

    const nota = elemento(
        'p',
        'O envio automático começa apenas quando ativares o botão correspondente. ' +
        'O navegador deve permanecer aberto. Confirma primeiro o funcionamento ' +
        'com poucas tropas: a distribuição é indicativa e não garante ' +
        'regressos simultâneos.'
    );

    painel.append(titulo, resumo, mensagem, scroll, nota);
    document.body.append(barra, painel);

    // --------------------------------------------------
    // UTILITÁRIOS
    // --------------------------------------------------

    function lerNumero(texto) {
        const numeros = String(texto || '').match(/\d[\d.,\s]*/g);
        if (!numeros) return 0;

        return Number(numeros[numeros.length - 1].replace(/\D/g, '')) || 0;
    }

    function lerContador(texto) {
        const partes = String(texto || '').match(/\d+/g);
        if (!partes) return null;

        const n = partes.map(Number);

        if (n.length >= 4) {
            return n[n.length - 4] * 86400
                + n[n.length - 3] * 3600
                + n[n.length - 2] * 60
                + n[n.length - 1];
        }

        if (n.length === 3) {
            return n[0] * 3600 + n[1] * 60 + n[2];
        }

        if (n.length === 2) {
            return n[0] * 60 + n[1];
        }

        return n[0];
    }

    function formatarTempo(segundos) {
        if (segundos == null) return '—';

        segundos = Math.max(0, Math.floor(segundos));

        const h = Math.floor(segundos / 3600);
        const m = Math.floor((segundos % 3600) / 60);
        const s = segundos % 60;

        return [
            String(h).padStart(2, '0'),
            String(m).padStart(2, '0'),
            String(s).padStart(2, '0')
        ].join(':');
    }

    function horaRegresso(segundos) {
        if (segundos == null || segundos <= 0) return '—';

        return new Date(Date.now() + segundos * 1000)
            .toLocaleTimeString('pt-PT', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
    }

    function desativado(el) {
        return !el ||
            el.disabled ||
            el.classList.contains('disabled') ||
            el.classList.contains('btn-disabled') ||
            el.getAttribute('aria-disabled') === 'true';
    }

    function emitirAlteracao(campo) {
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        campo.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // --------------------------------------------------
    // TROPA DISPONÍVEL
    // --------------------------------------------------

    function lerTropas() {
        const resultado = {};

        for (const unidade of UNIDADES) {
            const atalho = document.querySelector(
                `.units-entry-all[data-unit="${unidade}"]`
            );

            resultado[unidade] = atalho
                ? lerNumero(atalho.textContent)
                : 0;
        }

        return resultado;
    }

    // --------------------------------------------------
    // ESTADO DAS BUSCAS
    // --------------------------------------------------

    function obterElementosBuscas() {
        let elementos = [
            ...document.querySelectorAll('.scavenge-option')
        ];

        if (!elementos.length) {
            elementos = [0, 1, 2, 3]
                .map(i => document.getElementById(`scavenge_option_${i}`))
                .filter(Boolean);
        }

        return elementos;
    }

    function lerBuscas() {
        return obterElementosBuscas().map((el, indice) => {
            const contador = el.querySelector('.return-countdown');
            const botaoEnvio = el.querySelector('.free_send_button');

            const bloqueada = Boolean(
                el.querySelector('.unlock-button, .scavenge-option-locked')
            );

            const segundos = contador
                ? lerContador(contador.textContent)
                : null;

            let estado = 'Indisponível';

            if (bloqueada) {
                estado = 'Bloqueada';
            } else if (contador && segundos > 0) {
                estado = 'Em curso';
            } else if (botaoEnvio && !desativado(botaoEnvio)) {
                estado = 'Disponível';
            } else if (contador && segundos === 0) {
                estado = 'Contador terminado — validar';
            }

            return {
                indice,
                nome: el.querySelector('.title')?.textContent.trim()
                    || `Busca ${indice + 1}`,
                elemento: el,
                segundos,
                estado,
                bloqueada,
                disponivel: estado === 'Disponível'
            };
        });
    }

    // --------------------------------------------------
    // DISTRIBUIÇÃO DE TROPAS
    // --------------------------------------------------

    function calcularDistribuicao(tropas, buscas) {
        const disponiveis = buscas.filter(b => b.disponivel);
        const resultado = new Map();

        for (const busca of disponiveis) {
            resultado.set(busca.indice, {});
        }

        if (!disponiveis.length) return resultado;

        const pesoTotal = disponiveis.reduce(
            (total, busca) => total + (PESOS[busca.indice] || 1),
            0
        );

        for (const unidade of UNIDADES) {
            const quantidade = tropas[unidade] || 0;

            const quotas = disponiveis.map(busca => {
                const quota = quantidade *
                    (PESOS[busca.indice] || 1) / pesoTotal;

                return {
                    indice: busca.indice,
                    valor: Math.floor(quota),
                    resto: quota - Math.floor(quota)
                };
            });

            let atribuido = quotas.reduce(
                (total, q) => total + q.valor,
                0
            );

            const ordenadas = [...quotas].sort(
                (a, b) => b.resto - a.resto
            );

            let posicao = 0;

            while (atribuido < quantidade && ordenadas.length) {
                ordenadas[posicao % ordenadas.length].valor++;
                atribuido++;
                posicao++;
            }

            for (const quota of quotas) {
                resultado.get(quota.indice)[unidade] = quota.valor;
            }
        }

        return resultado;
    }

    function textoDistribuicao(distribuicao) {
        if (!distribuicao) return 'Sem distribuição';

        const linhas = UNIDADES
            .filter(u => (distribuicao[u] || 0) > 0)
            .map(u => `${NOMES[u]}: ${distribuicao[u]}`);

        return linhas.length
            ? linhas.join(' · ')
            : 'Nenhuma tropa detetada';
    }

    // --------------------------------------------------
    // CAMPOS DE TROPAS
    // --------------------------------------------------

    function encontrarCampo(elementoBusca, unidade) {
        // Preferir campos pertencentes à própria busca.
        const local = elementoBusca.querySelector(
            `input.unitsInput[name="${unidade}"], ` +
            `input[name="${unidade}"]`
        );

        if (local) return local;

        // Algumas versões do jogo colocam os campos fora do cartão.
        return document.querySelector(
            `input.unitsInput[name="${unidade}"], ` +
            `input[name="${unidade}"]`
        );
    }

    function preencherTropas(busca, distribuicao) {
        let preenchidos = 0;

        for (const unidade of UNIDADES) {
            const campo = encontrarCampo(busca.elemento, unidade);
            if (!campo) continue;

            let quantidade = Math.max(
                0,
                Math.floor(distribuicao[unidade] || 0)
            );

            if (campo.max !== '' && Number.isFinite(Number(campo.max))) {
                quantidade = Math.min(quantidade, Number(campo.max));
            }

            campo.value = String(quantidade);
            emitirAlteracao(campo);
            preenchidos++;
        }

        return preenchidos;
    }

    // --------------------------------------------------
    // PREPARAÇÃO MANUAL OPCIONAL
    // --------------------------------------------------

    function prepararBusca(indice) {
        const buscas = lerBuscas();
        const busca = buscas.find(b => b.indice === indice);

        if (!busca?.disponivel) {
            mensagem.textContent = `A Busca ${indice + 1} não está disponível.`;
            return;
        }

        const distribuicao = calcularDistribuicao(
            lerTropas(),
            buscas
        ).get(indice);

        if (!distribuicao) return;

        const preenchidos = preencherTropas(busca, distribuicao);

        mensagem.textContent = preenchidos
            ? `${busca.nome}: campos preenchidos.`
            : 'Não foram encontrados campos de tropas.';

        abrirPainel();
        atualizar();
    }

    function abrirPainel() {
        painelAberto = true;
        painel.hidden = false;
        botaoPainel.textContent = 'Ocultar painel';
    }

    // --------------------------------------------------
    // ENVIO AUTOMÁTICO
    // --------------------------------------------------

    function enviarBusca(busca) {
        if (!ligado || !envioAuto || aEnviar) return;
        if (!busca?.disponivel) return;

        const chave = String(busca.indice);
        const ultimoEnvio = enviadas.get(chave) || 0;

        if (Date.now() - ultimoEnvio < TEMPO_ANTI_DUPLICADO) {
            return;
        }

        const botao = busca.elemento.querySelector('.free_send_button');

        if (desativado(botao)) return;

        const buscas = lerBuscas();
        const atual = buscas.find(b => b.indice === busca.indice);

        if (!atual?.disponivel) return;

        const distribuicao = calcularDistribuicao(
            lerTropas(),
            buscas
        ).get(busca.indice);

        if (!distribuicao) return;

        const total = UNIDADES.reduce(
            (soma, unidade) => soma + (distribuicao[unidade] || 0),
            0
        );

        if (total <= 0) {
            mensagem.textContent =
                `${busca.nome}: envio ignorado, não há tropas disponíveis.`;
            return;
        }

        const preenchidos = preencherTropas(busca, distribuicao);

        if (!preenchidos) {
            mensagem.textContent =
                'Envio cancelado: não encontrei os campos de tropas.';
            return;
        }

        aEnviar = true;
        mensagem.textContent =
            `${busca.nome}: a preparar envio automático…\n` +
            textoDistribuicao(distribuicao);

        temporizadorEnvio = window.setTimeout(() => {
            temporizadorEnvio = null;

            try {
                const buscasAtualizadas = lerBuscas();
                const buscaAtualizada = buscasAtualizadas.find(
                    b => b.indice === busca.indice
                );

                const botaoAtualizado =
                    buscaAtualizada?.elemento.querySelector('.free_send_button');

                if (
                    !ligado ||
                    !envioAuto ||
                    !buscaAtualizada?.disponivel ||
                    desativado(botaoAtualizado)
                ) {
                    mensagem.textContent =
                        `${busca.nome}: envio cancelado; a busca deixou de estar disponível.`;
                    return;
                }

                // Registar antes do clique para evitar cliques repetidos
                // enquanto a página atualiza o estado.
                enviadas.set(chave, Date.now());

                botaoAtualizado.click();

                mensagem.textContent =
                    `${busca.nome}: pedido de envio acionado.\n` +
                    'A verificar a atualização do jogo…';

                abrirPainel();

                window.setTimeout(() => {
                    aEnviar = false;
                    atualizar();
                }, INTERVALO_ENTRE_ENVIOS);
            } catch (erro) {
                enviadas.delete(chave);
                aEnviar = false;

                mensagem.textContent =
                    `Erro no envio de ${busca.nome}: ${erro.message}`;
            }
        }, ATRASO_ENVIO);
    }

    function processarEnvios() {
        if (!ligado || !envioAuto || aEnviar) return;

        const agora = Date.now();

        if (agora - ultimaVerificacaoEnvio < INTERVALO_ENTRE_ENVIOS) {
            return;
        }

        ultimaVerificacaoEnvio = agora;

        const buscas = lerBuscas();
        const candidatas = buscas.filter(b => {
            if (!b.disponivel) return false;

            const ultimo = enviadas.get(String(b.indice)) || 0;

            return agora - ultimo >= TEMPO_ANTI_DUPLICADO;
        });

        if (!candidatas.length) return;

        // Enviar uma busca de cada vez para dar tempo ao jogo
        // de atualizar os campos e as tropas disponíveis.
        enviarBusca(candidatas[0]);
    }

    // --------------------------------------------------
    // ATUALIZAÇÃO DO PAINEL
    // --------------------------------------------------

    function atualizarAtalhos(buscas) {
        atalhos.replaceChildren();

        for (const busca of buscas) {
            const botao = elemento(
                'button',
                `B${busca.indice + 1}${busca.disponivel ? ' ✓' : ''}`,
                busca.disponivel ? 'atalho-disponivel' : ''
            );

            botao.disabled = !busca.disponivel;
            botao.title = `${busca.nome}: ${busca.estado}`;

            botao.addEventListener('click', () => {
                prepararBusca(busca.indice);
            });

            atalhos.appendChild(botao);
        }
    }

    function atualizar() {
        const tropas = lerTropas();
        const buscas = lerBuscas();

        const totalTropas = UNIDADES.reduce(
            (soma, u) => soma + tropas[u],
            0
        );

        const disponiveis = buscas.filter(b => b.disponivel);
        const emCurso = buscas.filter(b => b.estado === 'Em curso');

        const distribuicoes = calcularDistribuicao(tropas, buscas);

        resumo.textContent =
            `${totalTropas.toLocaleString('pt-PT')} tropas detetadas · ` +
            `${disponiveis.length} disponíveis · ${emCurso.length} em curso`;

        estadoRapido.textContent =
            `${disponiveis.length} disponíveis · ${emCurso.length} em curso`;

        atualizarAtalhos(buscas);
        tbody.replaceChildren();

        for (const busca of buscas) {
            const linha = elemento('tr');
            const celulaNome = elemento('td', busca.nome);
            const celulaEstado = elemento('td', busca.estado);
            const celulaTempo = elemento('td');
            const celulaRegresso = elemento('td');
            const celulaDistribuicao = elemento('td');

            if (busca.estado === 'Em curso') {
                celulaEstado.className = 'curso';
                celulaTempo.textContent = formatarTempo(busca.segundos);
                celulaRegresso.textContent = horaRegresso(busca.segundos);
                celulaDistribuicao.textContent = 'Tropas em missão';
            } else if (busca.disponivel) {
                celulaEstado.className = 'disponivel';
                celulaTempo.textContent = '00:00:00';
                celulaRegresso.textContent = 'Disponível agora';
                celulaDistribuicao.textContent = textoDistribuicao(
                    distribuicoes.get(busca.indice)
                );

                if (!envioAuto) {
                    const preparar = elemento(
                        'button',
                        `Preparar B${busca.indice + 1}`
                    );

                    preparar.addEventListener('click', () => {
                        prepararBusca(busca.indice);
                    });

                    celulaDistribuicao.append(
                        document.createElement('br'),
                        preparar
                    );
                }
            } else {
                if (busca.estado === 'Contador terminado — validar') {
                    celulaEstado.className = 'alerta';
                }

                celulaTempo.textContent =
                    busca.segundos != null
                        ? formatarTempo(busca.segundos)
                        : '—';

                celulaRegresso.textContent =
                    busca.segundos > 0
                        ? horaRegresso(busca.segundos)
                        : '—';

                celulaDistribuicao.textContent =
                    busca.bloqueada
                        ? 'Nível bloqueado'
                        : 'À espera de disponibilidade';
            }

            linha.append(
                celulaNome,
                celulaEstado,
                celulaTempo,
                celulaRegresso,
                celulaDistribuicao
            );

            tbody.appendChild(linha);

            const anterior = estadosAnteriores.get(busca.indice);

            if (
                ligado &&
                anterior === 'Em curso' &&
                busca.estado !== 'Em curso'
            ) {
                abrirPainel();

                mensagem.textContent =
                    `${busca.nome}: o contador terminou.\n` +
                    (envioAuto
                        ? 'A verificar a disponibilidade para envio automático.'
                        : 'Ativa o envio automático ou prepara as tropas manualmente.');
            }

            estadosAnteriores.set(busca.indice, busca.estado);
        }

        if (ligado && envioAuto) {
            processarEnvios();
        }
    }

    // --------------------------------------------------
    // BOTÕES
    // --------------------------------------------------

    botaoPainel.addEventListener('click', () => {
        painelAberto = !painelAberto;
        painel.hidden = !painelAberto;

        botaoPainel.textContent = painelAberto
            ? 'Ocultar painel'
            : '☷ Buscas';

        if (painelAberto) atualizar();
    });

    botaoMonitor.addEventListener('click', () => {
        ligado = !ligado;

        if (ligado) {
            botaoMonitor.textContent = 'Monitor: ON';
            botaoMonitor.className = 'ativo';

            if (intervaloId === null) {
                intervaloId = window.setInterval(atualizar, INTERVALO);
            }

            mensagem.textContent =
                'Monitorização ativa. Os estados são atualizados a cada segundo.';
        } else {
            botaoMonitor.textContent = 'Monitor: OFF';
            botaoMonitor.className = 'inativo';

            if (intervaloId !== null) {
                window.clearInterval(intervaloId);
                intervaloId = null;
            }

            if (temporizadorEnvio !== null) {
                window.clearTimeout(temporizadorEnvio);
                temporizadorEnvio = null;
            }

            aEnviar = false;
            mensagem.textContent = 'Monitorização desligada.';
        }

        atualizar();
    });

    botaoAuto.addEventListener('click', () => {
        envioAuto = !envioAuto;

        botaoAuto.textContent =
            `Envio automático: ${envioAuto ? 'ON' : 'OFF'}`;

        botaoAuto.className = envioAuto ? 'ativo' : 'inativo';

        mensagem.textContent = envioAuto
            ? 'Envio automático ativado. Liga também o monitor para começar.'
            : 'Envio automático desligado. Nenhuma nova busca será enviada automaticamente.';

        if (envioAuto && !ligado) {
            mensagem.textContent +=
                '\nClica em Monitor: OFF para o ativar.';
        }

        atualizar();
    });

    botaoAtualizar.addEventListener('click', atualizar);

    // --------------------------------------------------
    // LIMPEZA
    // --------------------------------------------------

    const gestor = {
        destroy() {
            if (intervaloId !== null) {
                window.clearInterval(intervaloId);
            }

            if (temporizadorEnvio !== null) {
                window.clearTimeout(temporizadorEnvio);
            }

            barra.remove();
            painel.remove();
            estilo.remove();

            delete window.__twBuscasRapidas;
        }
    };

    botaoFechar.addEventListener('click', () => {
        gestor.destroy();
    });

    window.__twBuscasRapidas = gestor;

    atualizar();

    console.info(
        '[Buscas] Gestor carregado. ' +
        'Ativa o monitor e o envio automático para iniciar.'
    );
})();
