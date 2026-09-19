// ==UserScript==
// @name         TW Menu
// @namespace    https://github.com/micatchulo/Tribos_Menu
// @version      1.0
// @description  Menu central para Tribal Wars
// @match        https://pt117.tribalwars.com.pt/game.php*
// @grant        none
// ==/UserScript==

(async function() {

    //-----------------------------------------
    // Loader de módulos via fetch()
    //-----------------------------------------
    async function loadModule(url) {
        const code = await fetch(url).then(r => r.text());

        // cria função isolada
        const moduleFunc = new Function(`
            const exports = {};
            ${code}
            return exports;
        `);

        return moduleFunc();
    }

    //-----------------------------------------
    // Carregar módulos
    //-----------------------------------------
    const header = await loadModule("https://raw.githubusercontent.com/micatchulo/Tribos_Menu/main/header.js");

    //-----------------------------------------
    // Criar menu
    //-----------------------------------------
    const menu = document.createElement("div");
    menu.id = "MenuTribos";

    Object.assign(menu.style, {
        width: "300px",
        height: "500px",
        position: "fixed",
        top: "30px",
        right: "30px",
        backgroundColor: "white",
        zIndex: "99999",
        border: "1px solid #444",
        padding: "10px"
    });

    document.body.appendChild(menu);

    //-----------------------------------------
    // Usar módulo carregado
    //-----------------------------------------
    if (header?.criarHeader) {
        menu.appendChild(header.criarHeader());
    } else {
        menu.innerHTML += "<b>Erro ao carregar header.js</b>";
    }

})();
