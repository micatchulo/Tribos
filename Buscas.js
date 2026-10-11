(() => {
    'use strict';

    const ID = 'tw-buscas-rapidas';
    const ID_PAINEL = 'tw-buscas-painel';
    const ID_ESTILO = 'tw-buscas-estilo';

    // Limpar uma execução anterior deste script.
    if (window.__twBuscasRapidas?.destroy) {
        window.__twBuscasRapidas.destroy();
    }

    document.getElementById(ID)?.remove();
    document.getElementById(ID_PAINEL)?.remove();
    document.getElementById(ID_ESTILO)?.remove();

    if (!location.search.includes('mode=scavenge')) {
        console.warn('Abre primeiro a página das buscas.');
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

    // Pesos indicativos, não garantem regressos iguais.
    const PESOS = [15, 6, 3, 2];

    let ligado = false;
    let intervaloId = null;
    let painelAberto = false;

    const estadosAnteriores = new Map();

    // -----------------------------------------------------
    // ESTILO
    // -----------------------------------------------------

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
            box-sizing: border-box;
            color: #302010;
            background: #f4e4bc;
            border: 1px solid #7d510f;
            border-radius: 5px;
            box-shadow: 0 3px 12px rgba(0,0,0,.25);
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

        #${ID} button:disabled {
            cursor: not-allowed;
            opacity: .45;
        }

        #${ID} .monitor-ligado {
            background: #b9dcae;
            border-color: #467b37;
        }

        #${ID} .monitor-desligado {
            background: #e9b7a7;
            border-color: #a34c35;
        }

        #${ID} .atalho-disponivel {
            background: #c9e2bd;
            border-color: #467b37;
            font-weight: bold;
        }

        #${ID} .estado-rapido {
            white-space: nowrap;
            padding: 4px;
            font-size: 11px;
        }

        #${ID_PAINEL} {
            position: fixed;
            top: 56px;
            right: 12px;
            z-index: 999998;
            width: min(900px, calc(100vw - 24px));
            max-height: calc(100vh - 75px);
            overflow: auto;
            box-sizing: border-box;
            padding: 13px;
            color: #302010;
            background: #f4e4bc;
            border: 1px solid #7d510f;
            border-radius: 5px;
            box-shadow: 0 4px 16px rgba(0,0,0,.25);
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

        #${ID_PAINEL} .estado-curso {
            color: #805600;
            font-weight: bold;
        }

        #${ID_PAINEL} .estado-disponivel {
            color: #176b2b;
            font-weight: bold;
        }

        #${ID_PAINEL} .estado-alerta {
            color: #a32424;
            font-weight: bold;
            background: #f8d9d0;
        }

        #${ID_PAINEL} .mensagem {
            margin-top: 10px;
            padding: 8px;
            background: #fff4d9;
            border: 1px solid #d0b779;
        }

        #${ID_PAINEL} .distribuicao {
            line-height: 1.6;
        }

        #${ID_PAINEL} .tabela-scroll {
            overflow-x: auto;
        }
    `;

    document.head.appendChild(estilo);

    // -----------------------------------------------------
    // CRIAÇÃO DA BARRA E DO PAINEL
    // -----------------------------------------------------

    function elemento(tag, texto, classe) {
        const el = document.createElement(tag);

        if (texto !== undefined) {
            el.textContent = texto;
        }

        if (classe) {
            el.className = classe;
        }

        return el;
    }

    const barra = elemento('div');
    barra.id = ID;

    const botaoPainel = elemento('button', '☷ Buscas');
    const botaoMonitor = elemento(
        'button',
        '● Monitor: OFF',
        'monitor-desligado'
    );
    const botaoAtualizar = elemento('button', '↻ Atualizar');
    const atalhos = elemento('div');
    const estadoRapido = elemento(
        'span',
        'A iniciar...',
        'estado-rapido'
    );
    const botaoFechar = elemento('button', '×');

    Object.assign(atalhos.style, {
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap'
    });

    botaoFechar.title = 'Fechar o gestor e parar a monitorização';

    barra.append(
        botaoPainel,
        botaoMonitor,
        botaoAtualizar,
        atalhos,
        estadoRapido,
        botaoFechar
    );

    const painel = elemento('section');
    painel.id = ID_PAINEL;
    painel.hidden = true;

    const titulo = elemento(
        'h3',
        'Gestor de buscas — acesso rápido'
    );

    const resumo = elemento('p');
    const mensagem = elemento(
        'div',
        'Monitorização desligada.',
        'mensagem'
    );

    const tabelaScroll = elemento('div', undefined, 'tabela-scroll');
    const tabela = elemento('table');

    const cabecalho = elemento('thead');
    const linhaCabecalho = elemento('tr');

    [
        'Busca',
        'Estado',
        'Contagem',
        'Regresso estimado',
        'Distribuição'
    ].forEach(texto => {
        linhaCabecalho.appendChild(elemento('th', texto));
    });

    cabecalho.appendChild(linhaCabecalho);

    const corpo = elemento('tbody');

    tabela.append(cabecalho, corpo);
    tabelaScroll.appendChild(tabela);

    const nota = elemento(
        'p',
        'Os atalhos B1–B4 preparam os campos de tropas. ' +
        'É necessário confirmar e enviar a busca manualmente. ' +
        'A distribuição é indicativa e não garante tempos de regresso iguais.'
    );

    painel.append(titulo, resumo, mensagem, tabelaScroll, nota);

    document.body.append(barra, painel);

    // -----------------------------------------------------
    // LEITURA E FORMATAÇÃO DOS DADOS
    // -----------------------------------------------------

    function lerNumero(texto) {
        const match = String(texto || '').match(/\d[\d.,\s]*/g);
        if (!match) return 0;

        const valor = match[match.length - 1]
            .replace(/\D/g, '');

        return Number(valor) || 0;
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
        if (segundos === null || segundos === undefined) {
            return '—';
        }

        segundos = Math.max(0, Math.floor(segundos));

        const horas = Math.floor(segundos / 3600);
        const minutos = Math.floor((segundos % 3600) / 60);
        const segs = segundos % 60;

        return [
            String(horas).padStart(2, '0'),
            String(minutos).padStart(2, '0'),
            String(segs).padStart(2, '0')
        ].join(':');
    }

    function horaRegresso(segundos) {
        if (segundos === null || segundos <= 0) {
            return '—';
        }

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

    // -----------------------------------------------------
    // DETEÇÃO DAS TROPAS DISPONÍVEIS
    // -----------------------------------------------------

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

    // -----------------------------------------------------
    // DETEÇÃO DO ESTADO DAS BUSCAS
    // -----------------------------------------------------

    function obterElementosBuscas() {
        let elementos = [
            ...document.querySelectorAll('.scavenge-option')
        ];

        if (!elementos.length) {
            elementos = [0, 1, 2, 3]
                .map(i => document.getElementById(
                    `scavenge_option_${i}`
                ))
                .filter(Boolean);
        }

        return elementos;
    }

    function lerBuscas() {
        return obterElementosBuscas().map((el, indice) => {
            const contador = el.querySelector(
                '.return-countdown'
            );

            const botaoEnvio = el.querySelector(
                '.free_send_button'
            );

            const bloqueada = Boolean(
                el.querySelector(
                    '.unlock-button, .scavenge-option-locked'
                )
            );

            const segundos = contador
                ? lerContador(contador.textContent)
                : null;

            let estado = 'Indisponível';

            if (bloqueada) {
                estado = 'Bloqueada';
            } else if (contador && segundos > 0) {
                estado = 'Em curso';
            } else if (
                botaoEnvio &&
                !desativado(botaoEnvio)
            ) {
                estado = 'Disponível';
            } else if (contador && segundos === 0) {
                estado = 'Contador terminado — validar';
            }

            return {
                indice,
                nome: el.querySelector('.title')
                    ?.textContent.trim() || `Busca ${indice + 1}`,
                elemento: el,
                segundos,
                estado,
                bloqueada,
                disponivel: estado === 'Disponível'
            };
        });
    }

    // -----------------------------------------------------
    // CÁLCULO DA DISTRIBUIÇÃO
    // -----------------------------------------------------

    function calcularDistribuicao(tropas, buscas) {
        const disponiveis = buscas.filter(
            busca => busca.disponivel
        );

        const resultado = new Map();

        for (const busca of disponiveis) {
            resultado.set(busca.indice, {});
        }

        if (!disponiveis.length) return resultado;

        const pesoTotal = disponiveis.reduce(
            (total, busca) =>
                total + (PESOS[busca.indice] || 1),
            0
        );

        for (const unidade of UNIDADES) {
            const quantidade = tropas[unidade] || 0;

            const quotas = disponiveis.map(busca => {
                const quota = quantidade *
                    (PESOS[busca.indice] || 1) /
                    pesoTotal;

                return {
                    indice: busca.indice,
                    valor: Math.floor(quota),
                    resto: quota - Math.floor(quota)
                };
            });

            let atribuido = quotas.reduce(
                (total, quota) => total + quota.valor,
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
                resultado.get(quota.indice)[unidade] =
                    quota.valor;
            }
        }

        return resultado;
    }

    function textoDistribuicao(distribuicao) {
        if (!distribuicao) return 'Sem distribuição';

        const linhas = UNIDADES
            .filter(u => (distribuicao[u] || 0) > 0)
            .map(u =>
                `${NOMES[u]}: ${
                    distribuicao[u].toLocaleString('pt-PT')
                }`
            );

        return linhas.length
            ? linhas.join(' · ')
            : 'Nenhuma tropa detetada';
    }

    // -----------------------------------------------------
    // PREPARAR UMA BUSCA
    // -----------------------------------------------------

    function prepararBusca(indice) {
        const buscas = lerBuscas();
        const busca = buscas.find(
            item => item.indice === indice
        );

        if (!busca || !busca.disponivel) {
            mensagem.textContent =
                `A Busca ${indice + 1} não está disponível. Atualiza o painel.`;

            atualizar();
            return;
        }

        const tropas = lerTropas();
        const distribuicoes = calcularDistribuicao(tropas, buscas);
        const distribuicao = distribuicoes.get(indice);

        if (!distribuicao) {
            mensagem.textContent =
                'Não foi possível calcular a distribuição.';
            return;
        }

        let preenchidos = 0;

        for (const unidade of UNIDADES) {
            // Os campos de tropas podem ser partilhados
            // pelos diferentes níveis de busca.
            const campo = document.querySelector(
                `input.unitsInput[name="${unidade}"], ` +
                `input[name="${unidade}"]`
            );

            if (!campo) continue;

            let quantidade = distribuicao[unidade] || 0;

            if (
                campo.max !== '' &&
                Number.isFinite(Number(campo.max))
            ) {
                quantidade = Math.min(
                    quantidade,
                    Number(campo.max)
                );
            }

            quantidade = Math.max(
                0,
                Math.floor(quantidade)
            );

            campo.value = String(quantidade);

            campo.dispatchEvent(
                new Event('input', { bubbles: true })
            );

            campo.dispatchEvent(
                new Event('change', { bubbles: true })
            );

            preenchidos++;
        }

        if (!preenchidos) {
            mensagem.textContent =
                'Não foram encontrados os campos das tropas. ' +
                'Os seletores desta versão do jogo podem ser diferentes.';
            return;
        }

        mensagem.textContent =
            `${busca.nome}: ${preenchidos} campos preparados. ` +
            'Confirma as quantidades e inicia manualmente a busca correspondente.';

        painel.hidden = false;
        painelAberto = true;
        botaoPainel.textContent = 'Ocultar painel';

        atualizar();
    }

    // -----------------------------------------------------
    // ATUALIZAR ATALHOS B1, B2, B3, B4
    // -----------------------------------------------------

    function atualizarAtalhos(buscas) {
        atalhos.replaceChildren();

        const niveis = buscas.length
            ? buscas
            : [0, 1, 2, 3].map(indice => ({
                indice,
                nome: `Busca ${indice + 1}`,
                estado: 'Indisponível',
                disponivel: false,
                segundos: null
            }));

        for (const busca of niveis) {
            const disponivel = busca.disponivel;

            const botao = elemento(
                'button',
                `B${busca.indice + 1}${disponivel ? ' ✓' : ''}`,
                disponivel ? 'atalho-disponivel' : ''
            );

            botao.disabled = !disponivel;

            botao.title = disponivel
                ? `Preparar tropas para ${busca.nome}`
                : `${busca.nome}: ${busca.estado}` +
                    (busca.segundos > 0
                        ? ` — ${formatarTempo(busca.segundos)}`
                        : '');

            botao.addEventListener('click', () => {
                prepararBusca(busca.indice);
            });

            atalhos.appendChild(botao);
        }
    }

    // -----------------------------------------------------
    // ATUALIZAR PAINEL E CONTADORES
    // -----------------------------------------------------

    function atualizar() {
        const tropas = lerTropas();
        const buscas = lerBuscas();

        const totalTropas = UNIDADES.reduce(
            (soma, unidade) => soma + tropas[unidade],
            0
        );

        const disponiveis = buscas.filter(
            busca => busca.disponivel
        );

        const emCurso = buscas.filter(
            busca => busca.estado === 'Em curso'
        );

        const distribuicoes = calcularDistribuicao(
            tropas,
            buscas
        );

        resumo.textContent =
            `${totalTropas.toLocaleString('pt-PT')} tropas detetadas · ` +
            `${disponiveis.length} disponíveis · ` +
            `${emCurso.length} em curso · ` +
            `Monitorização ${ligado ? 'LIGADA' : 'DESLIGADA'}.`;

        estadoRapido.textContent =
            `${disponiveis.length} disponíveis · ${emCurso.length} em curso`;

        atualizarAtalhos(buscas);

        corpo.replaceChildren();

        for (const busca of buscas) {
            const linha = elemento('tr');

            const celulaNome = elemento('td', busca.nome);
            const celulaEstado = elemento('td', busca.estado);
            const celulaTempo = elemento('td');
            const celulaRegresso = elemento('td');
            const celulaDistribuicao = elemento(
                'td',
                '',
                'distribuicao'
            );

            if (busca.estado === 'Em curso') {
                celulaEstado.className = 'estado-curso';
                celulaTempo.textContent =
                    formatarTempo(busca.segundos);

                celulaRegresso.textContent =
                    horaRegresso(busca.segundos);
            } else if (busca.disponivel) {
                celulaEstado.className = 'estado-disponivel';
                celulaTempo.textContent = '00:00:00';
                celulaRegresso.textContent = 'Disponível agora';

                celulaDistribuicao.textContent =
                    textoDistribuicao(
                        distribuicoes.get(busca.indice)
                    );

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
            } else {
                if (
                    busca.estado === 'Contador terminado — validar'
                ) {
                    celulaEstado.className = 'estado-alerta';
                }

                celulaTempo.textContent =
                    busca.segundos !== null
                        ? formatarTempo(busca.segundos)
                        : '—';

                celulaRegresso.textContent =
                    busca.segundos > 0
                        ? horaRegresso(busca.segundos)
                        : '—';

                celulaDistribuicao.textContent =
                    busca.bloqueada
                        ? 'Nível bloqueado'
                        : 'A aguardar disponibilidade';
            }

            linha.append(
                celulaNome,
                celulaEstado,
                celulaTempo,
                celulaRegresso,
                celulaDistribuicao
            );

            corpo.appendChild(linha);

            // Aviso visual na transição de uma busca em curso.
            const anterior = estadosAnteriores.get(busca.indice);

            if (
                ligado &&
                anterior === 'Em curso' &&
                (
                    busca.estado === 'Disponível' ||
                    busca.estado === 'Contador terminado — validar'
                )
            ) {
                mensagem.textContent =
                    `${busca.nome}: o contador terminou. ` +
                    'Confirma se já está disponível para preparar as tropas.';

                painel.hidden = false;
                painelAberto = true;
                botaoPainel.textContent = 'Ocultar painel';
            }

            estadosAnteriores.set(
                busca.indice,
                busca.estado
            );
        }
    }

    // -----------------------------------------------------
    // BOTÕES DA BARRA
    // -----------------------------------------------------

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
            atualizar();

            intervaloId = window.setInterval(
                atualizar,
                1000
            );

            botaoMonitor.textContent = '● Monitor: ON';
            botaoMonitor.className = 'monitor-ligado';

            mensagem.textContent =
                'Monitorização ativa: os contadores são atualizados ' +
                'a cada segundo. O envio permanece manual.';
        } else {
            if (intervaloId !== null) {
                window.clearInterval(intervaloId);
                intervaloId = null;
            }

            botaoMonitor.textContent = '● Monitor: OFF';
            botaoMonitor.className = 'monitor-desligado';

            mensagem.textContent =
                'Monitorização desligada. Usa Atualizar para consultar o estado.';
        }

        atualizar();
    });

    botaoAtualizar.addEventListener('click', atualizar);

    // -----------------------------------------------------
    // FECHAR E LIMPAR
    // -----------------------------------------------------

    const gestor = {
        destroy() {
            if (intervaloId !== null) {
                window.clearInterval(intervaloId);
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

    // Começar com a barra visível e o painel recolhido.
    atualizar();

    console.info(
        'Barra de acesso rápido carregada. ' +
        'O envio das buscas requer confirmação manual.'
    );
})();
