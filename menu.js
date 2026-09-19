// ==UserScript==
// @name         TW Menu
// @namespace    https://github.com/micatchulo/Tribos_Menu
// @version      1.0
// @description  Menu central para Tribal Wars
// @match        https://pt117.tribalwars.com.pt/game.php*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    console.log("TW MENU: iniciou");

    function criarMenu() {
        if (!document.body) {
            console.log("TW MENU: body ainda não existe");
            return;
        }

        const antigo = document.getElementById("MenuTribos");
        if (antigo) {
            console.log("TW MENU: menu já existe");
            return;
        }

        const menu = document.createElement("div");
        menu.id = "MenuTribos";

        Object.assign(menu.style, {
            position: "fixed",
            top: "30px",
            right: "30px",
            width: "300px",
            height: "500px",
            padding: "10px",
            background: "#f5e6c8",
            color: "#2b1b0e",
            border: "3px solid #6b4423",
            borderRadius: "4px",
            boxSizing: "border-box",
            zIndex: "2147483647",
            boxShadow: "0 4px 15px rgba(0,0,0,.5)"
        });

        menu.innerHTML = `
            <div style="
                font-size:18px;
                font-weight:bold;
                padding:8px;
                border-bottom:1px solid #6b4423;
                margin-bottom:10px;
            ">
                Tribos Menu
            </div>

            <div>
                Menu carregado com sucesso.
            </div>
        `;

        document.body.appendChild(menu);

        console.log("TW MENU: menu criado", menu);
    }

    criarMenu();
})();